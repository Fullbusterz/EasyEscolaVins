// Direcciones y tiempos de viaje, solo con servicios que permiten este uso (de empresa) y guardar resultados:
// - Direcciones: ICGC (Institut Cartogràfic i Geològic de Catalunya) y, si no, CartoCiudad (IGN). Ambos CC BY 4.0.
//   Para buscar un local por su nombre: OpenStreetMap (Nominatim), con calma (1 petición/s).
// - Tiempos entre paradas: openrouteservice (clave gratuita), con un factor de tráfico por franja horaria.
// - Tráfico real (opcional, clave de TomTom): una sola consulta por ruta corrige los tramos elegidos.
//   Esos tiempos no se guardan: las condiciones de TomTom no permiten almacenarlos.

const BCN = { lat: 41.372, lon: 2.077 };
// Zona de reparto: Barcelona y área metropolitana (los buscadores solo devuelven resultados dentro).
const BOX = { minLon: 1.85, minLat: 41.22, maxLon: 2.3, maxLat: 41.52 };
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
const LOCAL_TAIL = new RegExp(String.raw`(\b\d+\s*[a-z]?)\s+${LOCAL_WORDS}(?![\p{L}]).*$`, 'iu');
// «C.C.GRAN VIA- GRAN VIA, 75» o «CENTRO COMERCIAL X, CALLE…»: el nombre del centro comercial delante de la calle.
const MALL = /^\s*(?:c\.\s?c\.?|c\.c\b|centro comercial|centre comercial)\s*[^,-]*(?:-\s*|,\s*(?=[^,]*,))/i;
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
  // Lo que va tras el número es del local ("75 LOCAL 2", "12 BAJOS", "3 PISO 2"): los buscadores no lo
  // entienden y no devuelven nada. Se busca el portal.
  const parts = s.split(',').map((p) => p.replace(LOCAL_TAIL, '$1'))
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
function streetWords(q) {
  return fold(String(q).split(',')[0]).split(' ').filter((w) => w.length > 2 && !/\d/.test(w) && !STREET_STOP.has(w));
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

async function icgc(q) {
  const url = `https://eines.icgc.cat/geocodificador/cerca?text=${encodeURIComponent(q)}&layers=address&size=5` +
    `&boundary.rect.min_lon=${BOX.minLon}&boundary.rect.min_lat=${BOX.minLat}&boundary.rect.max_lon=${BOX.maxLon}&boundary.rect.max_lat=${BOX.maxLat}`;
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
  for (const provider of [() => icgc(q), () => cartociudad(q), () => nominatim(raw)]) {
    let list;
    try { list = mark(await provider()); } catch { continue; }
    if (list.some((c) => !c.doubt)) return [...list.filter((c) => !c.doubt), ...list.filter((c) => c.doubt), ...tried].slice(0, 5);
    tried.push(...list);
  }
  return tried.slice(0, 5);
}

// ---------- Tiempos de viaje ----------

// openrouteservice da tiempos de carretera vacía. Corrección orientativa para el área de Barcelona.
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

// Devuelve { minutes[o][d], km[o][d], source }.
export async function travelMatrix(origins, destinations, { orsKey, departAt } = {}) {
  const depart = departAt instanceof Date ? departAt : new Date();
  if (orsKey) {
    // Si el servicio de rutas falla (clave, cuota o cobertura), mejor una ruta aproximada que ninguna.
    try { return await orsMatrix(origins, destinations, orsKey, depart); } catch (e) {
      return { ...estimateMatrix(origins, destinations, depart), warning: e.name === 'TimeoutError' || e.name === 'TypeError' ? 'Sin conexión con el servicio de rutas' : e.message };
    }
  }
  return estimateMatrix(origins, destinations, depart);
}

function estimateMatrix(origins, destinations, depart) {
  return {
    minutes: origins.map((a) => destinations.map((b) => (sameSpot(a, b) ? 0 : estimate(a, b) * trafficFactor(depart)))),
    km: origins.map((a) => destinations.map((b) => haversineKm(a, b) * 1.4)),
    source: 'estimate',
  };
}

async function orsMatrix(origins, destinations, key, depart) {
  // Cada punto se manda una sola vez aunque sea origen y destino.
  const pts = [], index = new Map();
  const idx = (p) => {
    const k = `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`;
    if (!index.has(k)) { index.set(k, pts.length); pts.push([+p.lon.toFixed(6), +p.lat.toFixed(6)]); }
    return index.get(k);
  };
  const sources = origins.map(idx), dests = destinations.map(idx);
  const res = await get('https://api.heigit.org/openrouteservice/v2/matrix/driving-car', {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: pts, sources, destinations: dests, metrics: ['duration', 'distance'], units: 'km' }),
  });
  if (res.status === 401 || res.status === 403) throw new Error('La clave de openrouteservice no es válida o se ha gastado la cuota de hoy');
  if (res.status === 429) throw new Error('Demasiadas consultas seguidas a openrouteservice: espera un minuto');
  if (!res.ok) throw new Error(`openrouteservice ${res.status}`);
  const data = await res.json();
  const f = trafficFactor(depart);
  return {
    minutes: data.durations.map((row, i) => row.map((s, j) => (s == null ? estimate(origins[i], destinations[j]) * f : (s / 60) * f))),
    km: data.distances.map((row, i) => row.map((d, j) => (d == null ? haversineKm(origins[i], destinations[j]) * 1.4 : d))),
    source: 'ors',
  };
}

function sameSpot(a, b) {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lon - b.lon) < 1e-5;
}

function localIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/**
 * Tiempos con tráfico de TomTom para una ruta ya ordenada: points = [salida, parada1, ..., (almacén)].
 * Una sola consulta (hasta 150 puntos). Devuelve los minutos de cada tramo, o null si no se pudo.
 * live: tráfico de ahora (al salir y en ruta); si no, el previsto para departAt.
 */
export async function trafficLegs(points, { key, departAt, live }) {
  if (!key || points.length < 2) return null;
  const path = points.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join(':');
  const when = live || !(departAt > new Date()) ? 'now' : localIso(departAt);
  const res = await get(`https://api.tomtom.com/routing/1/calculateRoute/${path}/json?key=${encodeURIComponent(key)}` +
    `&traffic=true&departAt=${encodeURIComponent(when)}&routeType=fastest&travelMode=car&routeRepresentation=summaryOnly`, {}, 15000);
  if (res.status === 401 || res.status === 403) throw new Error('La clave de TomTom no es válida');
  if (!res.ok) return null;
  const data = await res.json();
  const legs = data.routes?.[0]?.legs;
  if (!legs || legs.length !== points.length - 1) return null;
  return legs.map((l) => l.summary.travelTimeInSeconds / 60);
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
