// Direcciones y tiempos de viaje, solo con servicios que permiten este uso (de empresa) y guardar resultados:
// - Direcciones: ICGC (Institut Cartogràfic i Geològic de Catalunya) y, si no, CartoCiudad (IGN). Ambos CC BY 4.0.
//   Para buscar un local por su nombre: OpenStreetMap (Nominatim), con calma (1 petición/s).
// - Tiempos entre paradas y tráfico: Google Maps (Routes API), con la clave de la empresa. Ver más abajo.
//   Esos tiempos no se guardan: las condiciones de Google no permiten almacenarlos.

// Almacén (Sant Joan Despí): sin población escrita, el buscador prefiere lo que queda cerca.
const BCN = { lat: 41.372, lon: 2.077 };
// Zona de reparto: toda Cataluña (los buscadores solo devuelven resultados dentro). Antes era solo el área
// de Barcelona y una ruta por Terrassa, el Masnou o Canovelles se quedaba sin ninguna dirección.
const BOX = { minLon: 0.15, minLat: 40.5, maxLon: 3.35, maxLat: 42.9 };
const inBox = (p) => p.lon >= BOX.minLon && p.lon <= BOX.maxLon && p.lat >= BOX.minLat && p.lat <= BOX.maxLat;

// Con poca cobertura una petición puede quedarse colgada: mejor fallar rápido y seguir con lo que hay.
function get(url, opts = {}, ms = 12000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}

// Las etiquetas de los buscadores traen comarca, provincia y país: sobran para ir a repartir.
export function cleanLabel(label) {
  return String(label || '')
    .split(', ')
    .filter((p) => !/^(catalunya|cataluña|españa|espanya|spain|barcelona \(provincia\)|bajo llobregat|baix llobregat|barcelonès|barcelones|área metropolitana de barcelona|àrea metropolitana de barcelona|\d{5})$/i.test(p.trim()))
    .join(', ');
}

export function haversineKm(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Coordenadas pegadas a mano o dentro de un enlace de Google Maps.
export function coordsFromText(text) {
  const s = String(text || '');
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    s.match(/[?&](?:q|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})\s*$/);
  return m ? { lat: +m[1], lon: +m[2] } : null;
}

// ---------- Búsqueda de direcciones ----------

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(l'|el |la )/, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Los nombres oficiales están en catalán: "Calle Mayor, Esplugas" no lo encuentra, "Carrer Major, Esplugues" sí.
const TYPE_ES_CA = [
  [/^(c\/|c\.|cl\.|calle)\s*/i, 'Carrer '], [/^(avda\.?|avenida|av\.|av(?=\s))\s*/i, 'Avinguda '], [/^(paseo|pg\.|pº)\s*/i, 'Passeig '],
  [/^(plaza|pl\.|pza\.?)\s*/i, 'Plaça '], [/^(rbla\.)\s*/i, 'Rambla '], [/^(ctra\.?)\s*/i, 'Carretera '], [/^(trav\.|travesera)\s*/i, 'Travessera '],
  [/^(ptge\.|pasaje)\s*/i, 'Passatge '], [/^plazoleta\s*/i, 'Placeta '],
];
const TOWN_ES_CA = {
  'san juan despi': 'Sant Joan Despí', 'cornella': 'Cornellà de Llobregat', 'hospitalet': "L'Hospitalet de Llobregat",
  'hospitalet de llobregat': "L'Hospitalet de Llobregat", 'san feliu': 'Sant Feliu de Llobregat', 'san feliu de llobregat': 'Sant Feliu de Llobregat',
  'esplugas': 'Esplugues de Llobregat', 'esplugas de llobregat': 'Esplugues de Llobregat', 'prat': 'El Prat de Llobregat',
  'san boi': 'Sant Boi de Llobregat', 'san baudilio de llobregat': 'Sant Boi de Llobregat', 'molins de rey': 'Molins de Rei',
  'gava': 'Gavà', 'san just': 'Sant Just Desvern', 'san just desvern': 'Sant Just Desvern', 'san vicente dels horts': 'Sant Vicenç dels Horts',
  'castelldefels': 'Castelldefels', 'viladecans': 'Viladecans', 'santa coloma de cervello': 'Santa Coloma de Cervelló',
  'pallejà': 'Pallejà', 'palleja': 'Pallejà', 'badalona': 'Badalona', 'barcelona': 'Barcelona',
};

// Lo que es del local y no del portal: los buscadores no lo entienden y no devuelven nada.
const LOCAL_WORDS = String.raw`(?:local|loc\.|bajos|baixos|bjos?\.?|bxs\.?|tienda|botiga|planta|piso|pis|esc\.?|escalera|escala|naves?|nau)`;
const LOCAL_PART = new RegExp(String.raw`^\s*${LOCAL_WORDS}(?![\p{L}])`, 'iu');
// También entre guiones o paréntesis: «14 -NAVE CAN CASTELLS-», «7 (LOCAL 2)».
const LOCAL_TAIL = new RegExp(String.raw`(\b\d+\s*[a-z]?)(?:\s+|\s*[-–(]\s*)${LOCAL_WORDS}(?![\p{L}]).*$`, 'iu');
// «C.C.GRAN VIA- GRAN VIA, 75» o «CENTRO COMERCIAL X, CALLE…»: el nombre del centro comercial delante de la calle.
const MALL = /^\s*(?:c\.\s?c\.?|c\.c\b|centro comercial|centre comercial)\s*[^,-]*(?:-\s*|,\s*(?=[^,]*,))/i;
// «268 BIS», «12 TER», «5 DUP»: el bis es parte del portal, no de la calle, y el callejero casi nunca lo tiene.
// Con el sufijo, ICGC se va a otra población (busca «Provença 268 bis» y devuelve «Provença 2 bis, Montcada»)
// y CartoCiudad devuelve los portales de al lado (267, 269), así que la parada se queda sin ubicar. Se busca el
// portal sin el sufijo: es la misma puerta o la de al lado, a unos metros, y para ir a repartir da igual.
const PORTAL_SUFFIX = /(\d)\s*(?:bis|ter|quater|dup(?:licado|do)?|dpdo)\b\.?/gi;

// Calles que solo con su nombre corto el buscador confunde con otra, por población.
const STREET_ALIAS = { "L'Hospitalet de Llobregat": [[/^\s*gran\s+via\b/i, 'Avinguda de la Gran Via']] };
const DISTRICTS = new Set(['ciutat vella', 'eixample', 'sants montjuic', 'les corts', 'sarria sant gervasi', 'gracia',
  'horta guinardo', 'nou barris', 'sant andreu', 'sant marti']);

export function normalizeAddress(q) {
  let s = String(q || '').trim().replace(/\s+/g, ' ').replace(MALL, '');
  for (const [re, rep] of TYPE_ES_CA) s = s.replace(re, rep);
  // Los tramos de la Rambla (Canaletes, Caputxins, Santa Mònica…) son una sola calle con una sola numeración
  // en el callejero: «Rambla dels Caputxins 31» no la encuentra nadie; «La Rambla 31» sí.
  s = s.replace(/^\s*(?:la\s+)?rambla\s+(?:de\s+les\s+|de\s+la\s+|dels?\s+|de\s+)?(?:canaletes|estudis|sant\s+josep|caputxins|santa\s+m[oò]nica|flors)\b/i, 'La Rambla');
  s = s.replace(/ de las /gi, ' de les ').replace(/ de los /gi, ' dels ').replace(/\bn[ºo°]\.?\s*/gi, '');
  s = s.replace(PORTAL_SUFFIX, '$1');
  // Lo que va tras el número es del local ("75 LOCAL 2", "12 BAJOS", "3 PISO 2"): los buscadores no lo
  // entienden y no devuelven nada. Se busca el portal.
  const parts = s.split(',').map((p) => p.replace(LOCAL_TAIL, '$1').trimEnd())
    // Lo mismo en un trozo aparte ("25, LOCAL IZQUIERDA", "54, BAJOS") y el distrito metido en medio
    // ("31, CIUTAT VELLA, BARCELONA"): con eso el buscador no encuentra nada o da el número de enfrente.
    .filter((p, i, all) => i === 0 || i === all.length - 1 || !(LOCAL_PART.test(p) || DISTRICTS.has(fold(p).replace(/[^a-z]+/g, ' ').trim())));
  if (parts.length > 1) {
    const town = TOWN_ES_CA[fold(parts[parts.length - 1])];
    if (town) parts[parts.length - 1] = ` ${town}`;
    for (const [re, rep] of STREET_ALIAS[town] || []) parts[0] = parts[0].replace(re, rep);
  }
  return parts.join(',').trim();
}

// Población escrita por el conductor (lo que va tras la última coma), para comprobar que el resultado cae ahí.
function wantedTown(q) {
  const parts = String(q).split(',');
  if (parts.length < 2) return '';
  const t = fold(parts[parts.length - 1].replace(/\b\d{5}\b/, ''));
  return /[a-z]/.test(t) ? t : '';
}
const sameTown = (want, got) => !want || (got && (fold(got).includes(want) || want.includes(fold(got))));

// Palabras clave de la calle escrita ("Carrer de la Marquesa 20" → marquesa), para detectar que el
// buscador ha devuelto otra calle parecida.
const STREET_STOP = new Set(['carrer', 'calle', 'avinguda', 'avenida', 'passeig', 'paseo', 'placa', 'plaza', 'rambla', 'ronda', 'carretera',
  'travessera', 'passatge', 'placeta', 'cami', 'via', 'de', 'del', 'dels', 'la', 'les', 'el', 'els', 'i', 'y', 'sn', 'local', 'bloc', 'bajos', 'baixos']);
export function streetWords(q) {
  const first = String(q).split(',')[0];
  const words = (x) => fold(x).split(' ').filter((w) => w.length > 2 && !/\d/.test(w) && !STREET_STOP.has(w));
  // Lo que va detrás del número es del portal, no de la calle («268 BIS», «12 esquina Aribau»). El callejero no
  // lo devuelve en la etiqueta, así que exigirlo tumbaba resultados buenos. Si al cortar no queda nombre
  // (calles que empiezan por un número, «11 de Setembre»), se mira la línea entera como antes.
  const before = words(first.replace(/\b\d{1,4}\b[\s\S]*$/, ''));
  return before.length ? before : words(first);
}
// Nombre en castellano frente al catalán del mapa: "aragon"/"arago", "corcega"/"corsega", "valencia"/"valencia".
function nearWord(w, l) {
  if (w.length < 5 || l.slice(0, 2) !== w.slice(0, 2) || Math.abs(w.length - l.length) > 2) return false;
  if (w.startsWith(l) || l.startsWith(w)) return true;
  let prev = Array.from({ length: l.length + 1 }, (_, j) => j);
  for (let i = 1; i <= w.length; i++) {
    const row = [i];
    for (let j = 1; j <= l.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (w[i - 1] === l[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[l.length] <= 1;
}
const sameStreet = (words, label) => {
  const l = fold(label);
  const lw = l.split(/[^a-z0-9]+/);
  return words.every((w) => l.includes(w) || lw.some((x) => nearWord(w, x)));
};

// near: preferir lo cercano al almacén. Solo sin población escrita: con ella, el punto cambia el orden y
// «La Rambla 31, Barcelona» pasaba a dar la Rambla de la Muntanya.
async function icgc(q, near) {
  const url = `https://eines.icgc.cat/geocodificador/cerca?text=${encodeURIComponent(q)}&layers=address&size=5` +
    `&boundary.rect.min_lon=${BOX.minLon}&boundary.rect.min_lat=${BOX.minLat}&boundary.rect.max_lon=${BOX.maxLon}&boundary.rect.max_lat=${BOX.maxLat}` +
    (near ? `&focus.point.lat=${BCN.lat}&focus.point.lon=${BCN.lon}` : '');
  const res = await get(url);
  if (!res.ok) throw new Error(`ICGC ${res.status}`);
  const data = await res.json();
  return (data.features || []).map((f) => ({
    lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
    label: f.properties.etiqueta || f.properties.nom, town: f.properties.municipi, source: 'icgc',
  }));
}

// CartoCiudad devuelve "CALLE LAUREA MIRO 301" y a veces ya incluye la población.
function cartoLabel(c) {
  const street = String(c.address || '').toLowerCase().replace(/(^|[\s'(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  return cleanLabel(fold(street).includes(fold(c.muni)) ? street : `${street}, ${c.muni}`);
}

async function cartociudad(q) {
  const res = await get(`https://www.cartociudad.es/geocoder/api/geocoder/candidates?q=${encodeURIComponent(q)}&limit=5`);
  if (!res.ok) throw new Error(`CartoCiudad ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    // Solo portales: también devuelve puntos de recarga u otros lugares con nombres parecidos.
    .filter((c) => c.type === 'portal' && c.lat != null)
    .map((c) => ({ lat: c.lat, lon: c.lng, label: cartoLabel(c), town: c.muni, source: 'cartociudad' }))
    .filter(inBox);
}

// Calles de polígono que el callejero tiene sin portales (Joan de la Cierva, Canovelles): ningún buscador da el
// número, pero CartoCiudad sí tiene la calle entera. Se ubica en medio de la calle, sin número, y solo si es de la
// población escrita: en un polígono la calle es corta y el conductor lo revisa al llegar.
async function cartoStreet(q, want) {
  const parts = q.split(',');
  if (!want || parts.length < 2) return [];
  const street = parts[0].replace(/\s+\d{1,4}\b.*$/, '').trim();
  const town = parts[parts.length - 1].trim();
  const res = await get(`https://www.cartociudad.es/geocoder/api/geocoder/candidates?q=${encodeURIComponent(`${street}, ${town}`)}&limit=5`);
  if (!res.ok) throw new Error(`CartoCiudad ${res.status}`);
  const data = await res.json();
  // La misma calle en las dos direcciones: el buscador también da las que se le parecen («Riera» → «Riera Basté»).
  const words = streetWords(street);
  const c = (Array.isArray(data) ? data : []).find((x) => {
    const name = String(x.address || '').split(',')[0];
    return x.type === 'callejero' && x.id && sameTown(want, x.muni) && words.length &&
      sameStreet(words, name) && sameStreet(streetWords(name), street);
  });
  if (!c) return [];
  const found = await get(`https://www.cartociudad.es/geocoder/api/geocoder/find?id=${encodeURIComponent(c.id)}&type=callejero`);
  if (!found.ok) throw new Error(`CartoCiudad ${found.status}`);
  const geom = String((await found.json()).geom || '');
  const pts = [...geom.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map((m) => ({ lon: +m[1], lat: +m[2] }));
  const mid = pts[Math.floor(pts.length / 2)];
  if (!mid || !inBox(mid)) return [];
  const name = cartoLabel({ address: String(c.address).split(',')[0], muni: '' }).replace(/,\s*$/, '');
  return [{ ...mid, label: `${name} (sin número), ${c.muni}`, town: c.muni, source: 'cartociudad', noNumber: true }];
}

let lastNominatim = 0;
async function nominatim(q) {
  const wait = lastNominatim + 1100 - Date.now(); // máx. 1 petición/s según su política de uso
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const res = await get(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=es&bounded=1` +
    `&viewbox=${BOX.minLon},${BOX.maxLat},${BOX.maxLon},${BOX.minLat}&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } });
  if (!res.ok) throw new Error(`OpenStreetMap ${res.status}`);
  const data = await res.json();
  return data.map((r) => ({ lat: +r.lat, lon: +r.lon, label: cleanLabel(r.display_name).split(', ').slice(0, 4).join(', '), source: 'osm' }));
}

/**
 * Devuelve candidatos [{lat, lon, label, source, otherTown, doubt}] del más fiable al menos.
 * kind 'address' (por defecto): ICGC → CartoCiudad → OpenStreetMap. kind 'name': un local por su nombre (OpenStreetMap).
 * otherTown: no está en la población escrita. otherNumber: otro portal. doubt: otra población, calle o número; hay que revisarlo.
 */
// Números de portal de una dirección («6-8» → [6, 8]), sin el código postal.
const numbersOf = (s) => (String(s).match(/\b\d{1,4}\b(?:\s*-\s*\d{1,4}\b)?/g) || []).map((n) => n.split('-').map((x) => +x));
/** ¿El resultado es el portal buscado? Un buscador puede dar la calle buena con otro número (la otra acera, otra punta). */
export function sameNumber(query, label) {
  const want = numbersOf(String(query).split(',').slice(0, -1).join(',') || query);
  const got = numbersOf(label);
  if (!want.length || !got.length) return true;
  const inRange = (n, [a, b = a]) => n >= Math.min(a, b) && n <= Math.max(a, b);
  return want.some((w) => got.some((g) => w.some((n) => inRange(n, g)) || g.some((n) => inRange(n, w))));
}

export async function geocode(query, { kind = 'address' } = {}) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const direct = coordsFromText(raw);
  if (direct) return [{ ...direct, label: `${direct.lat.toFixed(5)}, ${direct.lon.toFixed(5)}`, source: 'coords', otherTown: false, doubt: false }];

  const want = wantedTown(normalizeAddress(raw));
  const words = kind === 'name' ? [] : streetWords(normalizeAddress(raw));
  const mark = (list) => list.map((c) => {
    const otherTown = !sameTown(want, c.town || c.label);
    const otherNumber = kind !== 'name' && !sameNumber(normalizeAddress(raw), c.label);
    return { ...c, otherTown, otherNumber, doubt: otherTown || otherNumber || !sameStreet(words, c.label) };
  });
  if (kind === 'name') return mark(await nominatim(raw));

  const q = normalizeAddress(raw);
  const tried = [];
  for (const provider of [() => icgc(q, !want), () => cartociudad(q), () => nominatim(raw), () => cartoStreet(q, want)]) {
    let list;
    try { list = mark(await provider()); } catch { continue; }
    if (list.some((c) => !c.doubt)) return [...list.filter((c) => !c.doubt), ...list.filter((c) => c.doubt), ...tried].slice(0, 5);
    tried.push(...list);
  }
  return tried.slice(0, 5);
}

// ---------- Tiempos de viaje: Google Maps ----------
//
// Los tiempos salen de Google (Routes API), que es el mismo tráfico que ven Google Maps y Waze. Se usan dos
// consultas distintas, de precio muy distinto, y cada una para lo suyo:
//
//   matriz      Tiempos entre paradas SIN tráfico (la tarifa más barata). Se pide solo lo que el optimizador
//               necesita: de cada parada a sus vecinas más cercanas (ver planner.js). Los pares que no se
//               piden se estiman con la línea recta, ajustada con lo que Google ha dicho de los que sí.
//               Se corrige con un factor por franja horaria, como antes.
//   ruta        La ruta elegida, de punta a punta, CON tráfico (el previsto para la hora de salida o el de
//               ahora mismo). Una sola consulta por cálculo: corrige los tramos con atasco y se vuelve a
//               optimizar (como hacía TomTom).
//
// Las condiciones de Google no permiten guardar sus tiempos: la app los tiene solo en memoria mientras dura
// el día (ver app.js), nunca en el almacenamiento del móvil ni en las copias.

// openrouteservice / Google sin tráfico dan tiempos de carretera vacía. Corrección orientativa para el área
// de Barcelona; la consulta con tráfico de la ruta elegida pone luego los tiempos de verdad.
export function trafficFactor(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  if (weekend) return 1.1;
  if (h >= 7 && h < 9.75) return 1.45;
  if (h >= 9.75 && h < 13) return 1.2;
  if (h >= 13 && h < 16) return 1.15;
  if (h >= 16 && h < 20) return 1.4;
  return 1.1;
}

// Sin servicio de rutas: estimación prudente, 1,4× la línea recta a 25 km/h + 3 min de aparcar.
export function estimate(a, b) {
  return (haversineKm(a, b) * 1.4 / 25) * 60 + 3;
}

const GOOGLE = 'https://routes.googleapis.com';
// Cuántos elementos (origen × destino) caben en una consulta de matriz sin tráfico.
const MATRIX_MAX = 625;
// Puntos intermedios que admite una ruta (más la salida y la llegada).
const ROUTE_MAX_INTERMEDIATES = 25;

// Lo que se ha gastado de Google, para enseñarlo en Ajustes (lo apunta app.js en el móvil).
let usageHook = () => {};
export function onGoogleUsage(fn) { usageHook = typeof fn === 'function' ? fn : () => {}; }

const latLng = (p) => ({ location: { latLng: { latitude: +Number(p.lat).toFixed(6), longitude: +Number(p.lon).toFixed(6) } } });
const seconds = (d) => { const m = /^(\d+(?:\.\d+)?)s$/.exec(String(d ?? '')); return m ? +m[1] : null; };

// Google devuelve los errores como { error } o, en la matriz, como [{ error }].
async function googleError(res) {
  let msg = '', status = '';
  try {
    const body = await res.json();
    const e = (Array.isArray(body) ? body[0] : body)?.error || {};
    msg = String(e.message || ''); status = String(e.status || '');
  } catch { /* sin cuerpo */ }
  if (res.status === 429 || status === 'RESOURCE_EXHAUSTED') return new Error('Se ha gastado la cuota de Google de hoy: ruta aproximada');
  if (res.status === 400 && /api key|API_KEY/i.test(msg + status)) return new Error('La clave de Google no es válida');
  if (res.status === 403 || status === 'PERMISSION_DENIED') {
    return new Error(/referer|referrer|blocked/i.test(msg) ? 'La clave de Google no acepta esta web: revisa sus restricciones'
      : /not been used|disabled|enable/i.test(msg) ? 'Falta activar «Routes API» en la cuenta de Google'
      : /billing/i.test(msg) ? 'La cuenta de Google no tiene la facturación activada'
      : 'La clave de Google no tiene permiso para calcular rutas');
  }
  return new Error(`Google ${res.status}${msg ? `: ${msg.slice(0, 80)}` : ''}`);
}

async function googlePost(path, body, fieldMask, key, ms) {
  const res = await get(`${GOOGLE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
  }, ms);
  if (!res.ok) throw await googleError(res);
  return res.json();
}

// Una consulta de matriz sin tráfico: origins × destinations (como mucho MATRIX_MAX elementos).
async function googleMatrixChunk(origins, destinations, key) {
  const data = await googlePost('/distanceMatrix/v2:computeRouteMatrix', {
    origins: origins.map((p) => ({ waypoint: latLng(p) })),
    destinations: destinations.map((p) => ({ waypoint: latLng(p) })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
  }, 'originIndex,destinationIndex,duration,distanceMeters,condition', key, 20000);
  usageHook({ elements: origins.length * destinations.length });
  const out = [];
  for (const el of Array.isArray(data) ? data : []) {
    if (el?.error) throw new Error(`Google: ${String(el.error.message || 'error').slice(0, 80)}`);
    const s = seconds(el?.duration);
    if (el?.condition === 'ROUTE_NOT_FOUND' || s == null) continue;
    out.push({ o: el.originIndex ?? 0, d: el.destinationIndex ?? 0, min: s / 60, km: (el.distanceMeters ?? 0) / 1000 });
  }
  return out;
}

// Varias consultas a la vez, pero no todas: con poca cobertura es mejor ir de pocas en pocas.
async function inBatches(jobs, n = 4) {
  const out = [];
  for (let i = 0; i < jobs.length; i += n) out.push(...(await Promise.all(jobs.slice(i, i + n).map((f) => f()))).flat());
  return out;
}

/**
 * Minutos por kilómetro en línea recta según lo que Google acaba de decir: con eso se estiman los pares que no
 * se han pedido. Mediana, para que un par raro (un puente, una salida de ronda) no lo tuerza.
 */
export function calibrate(samples) {
  const r = samples.filter((x) => x.km > 0.3 && x.min > 0).map((x) => x.min / x.km).sort((a, b) => a - b);
  if (r.length < 3) return null;
  return Math.min(8, Math.max(1.2, r[Math.floor(r.length / 2)]));
}

/** Estimación de un par sin consulta: la línea recta a los minutos/km de esa ruta, o la prudente de siempre. */
export function guess(a, b, perKm) {
  if (sameSpot(a, b)) return 0;
  return perKm ? Math.max(1.5, haversineKm(a, b) * perKm) : estimate(a, b);
}

/**
 * Tiempos sin tráfico de Google para los pares pedidos. `cells` es la lista de pares [i, j] (índices de
 * `origins` y `destinations`); sin ella se piden todos. Se agrupan por origen para gastar solo lo justo.
 * Devuelve [{ i, j, min, km }] con los minutos ya corregidos por la franja horaria de `departAt`.
 */
export async function googleMatrix(origins, destinations, { key, departAt = new Date(), cells = null } = {}) {
  if (!key) throw new Error('Falta la clave de Google');
  const f = trafficFactor(departAt instanceof Date ? departAt : new Date());
  const byOrigin = new Map();
  const all = cells || origins.flatMap((_, i) => destinations.map((__, j) => [i, j]));
  for (const [i, j] of all) {
    if (sameSpot(origins[i], destinations[j])) continue;
    if (!byOrigin.has(i)) byOrigin.set(i, new Set());
    byOrigin.get(i).add(j);
  }
  if (!byOrigin.size) return [];
  const jobs = [];
  // Sin lista de pares (todos con todos) va en bloques de varias filas; con lista, una fila por origen.
  if (!cells) {
    const os = [...byOrigin.keys()];
    const ds = destinations.map((_, j) => j);
    const rows = Math.max(1, Math.floor(MATRIX_MAX / ds.length));
    for (let k = 0; k < os.length; k += rows) {
      const part = os.slice(k, k + rows);
      jobs.push(async () => (await googleMatrixChunk(part.map((i) => origins[i]), ds.map((j) => destinations[j]), key))
        .map((x) => ({ i: part[x.o], j: ds[x.d], min: x.min * f, km: x.km })));
    }
  } else {
    for (const [i, set] of byOrigin) {
      const ds = [...set];
      for (let k = 0; k < ds.length; k += MATRIX_MAX) {
        const part = ds.slice(k, k + MATRIX_MAX);
        jobs.push(async () => (await googleMatrixChunk([origins[i]], part.map((j) => destinations[j]), key))
          .map((x) => ({ i, j: part[x.d], min: x.min * f, km: x.km })));
      }
    }
  }
  return inBatches(jobs);
}

// Devuelve { minutes[o][d], km[o][d], source }: todos con todos. Sin clave (o si Google falla), estimación.
export async function travelMatrix(origins, destinations, { key, departAt } = {}) {
  const depart = departAt instanceof Date ? departAt : new Date();
  if (key) {
    // Si el servicio de rutas falla (clave, cuota o cobertura), mejor una ruta aproximada que ninguna.
    try {
      const got = await googleMatrix(origins, destinations, { key, departAt: depart });
      const mx = estimateMatrix(origins, destinations, depart);
      for (const x of got) { mx.minutes[x.i][x.j] = x.min; mx.km[x.i][x.j] = x.km; }
      return { ...mx, source: 'google' };
    } catch (e) {
      return { ...estimateMatrix(origins, destinations, depart), warning: netWarning(e) };
    }
  }
  return estimateMatrix(origins, destinations, depart);
}

export const netWarning = (e) => (e?.name === 'TimeoutError' || e?.name === 'TypeError' ? 'Sin conexión con Google' : e?.message || 'Google no ha respondido');

function estimateMatrix(origins, destinations, depart) {
  return {
    minutes: origins.map((a) => destinations.map((b) => (sameSpot(a, b) ? 0 : estimate(a, b) * trafficFactor(depart)))),
    km: origins.map((a) => destinations.map((b) => haversineKm(a, b) * 1.4)),
    source: 'estimate',
  };
}

export function sameSpot(a, b) {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lon - b.lon) < 1e-5;
}

/**
 * Tiempos con tráfico de Google para una ruta ya ordenada: points = [salida, parada1, ..., (almacén)].
 * Una consulta por cada 27 puntos. Devuelve los minutos de cada tramo, o null si no se pudo.
 * live: tráfico de ahora (al salir y en ruta); si no, el previsto para departAt.
 * Una clave mala o sin permiso lanza el error (hay que decírselo a alguien); lo demás devuelve null.
 */
export async function trafficLegs(points, { key, departAt, live }) {
  if (!key || points.length < 2) return null;
  const step = ROUTE_MAX_INTERMEDIATES + 1;
  const chunks = [];
  for (let k = 0; k < points.length - 1; k += step) chunks.push(points.slice(k, k + step + 1));
  // Google solo acepta una hora de salida futura; para «ahora» no se pone.
  const future = !live && departAt instanceof Date && departAt.getTime() > Date.now() + 60000;
  const legs = [];
  for (const pts of chunks) {
    let data;
    try {
      data = await googlePost('/directions/v2:computeRoutes', {
        origin: latLng(pts[0]),
        destination: latLng(pts[pts.length - 1]),
        intermediates: pts.slice(1, -1).map(latLng),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        ...(future ? { departureTime: departAt.toISOString() } : {}),
        computeAlternativeRoutes: false,
      }, 'routes.legs.duration,routes.legs.distanceMeters', key, 15000);
    } catch (e) {
      if (/clave|permiso|activar|facturación/.test(e.message)) throw e;
      return null;
    }
    usageHook({ routes: 1 });
    const ls = data?.routes?.[0]?.legs;
    if (!Array.isArray(ls) || ls.length !== pts.length - 1) return null;
    for (const l of ls) {
      const s = seconds(l.duration);
      if (s == null) return null;
      legs.push(s / 60);
    }
  }
  return legs.length === points.length - 1 ? legs : null;
}

// ---------- Navegación ----------

export function navUrl(app, p) {
  p = { lat: Number(p.lat), lon: Number(p.lon) };
  if (app === 'gmaps') return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving&dir_action=navigate`;
  return `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`;
}

export function currentPosition(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}
