import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { geocode, normalizeAddress } from '../js/geo.js';

// Buscadores falsos que se portan como los de verdad: ICGC solo devuelve lo que cae dentro del rectángulo
// que se le pide, y CartoCiudad da portales por número y la calle entera (sin portales) por su nombre.
// Las respuestas son las reales de la ruta del lunes 23/11/2026 (Terrassa, el Masnou, Canovelles).
const ICGC = {
  'jacint badiella': { etiqueta: 'Carrer de Jacint Badiella 5, Terrassa (el Pla del Bon Aire)', municipi: 'Terrassa', lon: 2.017, lat: 41.5901 },
  'fabra': { etiqueta: 'Passeig de Romà Fabra 25-27, el Masnou', municipi: 'el Masnou', lon: 2.3154, lat: 41.4822 },
  'aneto': { etiqueta: "Carrer de l'Aneto 73, Terrassa", municipi: 'Terrassa', lon: 2.0373, lat: 41.5719 },
};
const CIERVA_LINE = 'LINESTRING(2.28688 41.62638,2.28600 41.62634,2.28500 41.62630)';
const realFetch = globalThis.fetch;
let urls = [];
function fakeFetch(url) {
  urls.push(String(url));
  const u = new URL(url);
  const json = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
  if (u.host === 'eines.icgc.cat') {
    const text = u.searchParams.get('text').toLowerCase().normalize('NFC');
    const r = (k) => +u.searchParams.get(`boundary.rect.${k}`);
    const features = Object.entries(ICGC).filter(([k]) => text.includes(k))
      .map(([, f]) => f)
      .filter((f) => f.lon >= r('min_lon') && f.lon <= r('max_lon') && f.lat >= r('min_lat') && f.lat <= r('max_lat'))
      .map((f) => ({ geometry: { coordinates: [f.lon, f.lat] }, properties: { etiqueta: f.etiqueta, municipi: f.municipi } }));
    return json({ features });
  }
  if (u.pathname.endsWith('/candidates')) {
    const q = u.searchParams.get('q');
    if (/cierva/i.test(q) && /\d/.test(q.split(',')[0] + (q.split(',')[1] || ''))) {
      // Con número da los portales de otra «Joan de Cierva» (Algemesí): en Canovelles no hay portales.
      return json([{ type: 'portal', address: 'JOAN DE CIERVA 13', muni: 'Algemesí', lat: 39.195, lng: -0.433 }]);
    }
    if (/cierva/i.test(q)) {
      return json([{ id: '80410000064', type: 'callejero', address: 'CALLE JOAN DE LA CIERVA, Polígon Industrial Can Castells (Canovelles)',
        muni: 'Canovelles', tip_via: 'CALLE', lat: 0, lng: 0 }]);
    }
    return json([]);
  }
  if (u.pathname.endsWith('/find')) {
    assert.equal(u.searchParams.get('id'), '80410000064');
    return json({ id: '80410000064', type: 'callejero', address: 'JOAN DE LA CIERVA', muni: 'Canovelles', tip_via: 'CALLE', geom: CIERVA_LINE });
  }
  if (u.host === 'nominatim.openstreetmap.org') return json([]);
  throw new Error(`petición inesperada ${url}`);
}
afterEach(() => { globalThis.fetch = realFetch; urls = []; });

test('Terrassa y el Masnou se encuentran: la zona de reparto no es solo el área de Barcelona', async () => {
  globalThis.fetch = fakeFetch;
  for (const [addr, want] of [
    ['CARRER JACINT BADIELLA, 5, TERRASSA', { lat: 41.5901, lon: 2.017 }],
    ['PASSEIG ROMAN FABRA, 25, EL MASNOU', { lat: 41.4822, lon: 2.3154 }],
    ['ANETO,73, .TERRASSA', { lat: 41.5719, lon: 2.0373 }],
  ]) {
    const [hit] = await geocode(addr);
    assert.ok(hit, `sin resultado para ${addr}`);
    assert.deepEqual({ lat: hit.lat, lon: hit.lon }, want, addr);
    assert.equal(hit.doubt, false, addr);
  }
});

test('sin población, el buscador prefiere lo cercano al almacén (no un «Carrer Major» de Lleida)', async () => {
  globalThis.fetch = fakeFetch;
  await geocode('Carrer Major 5');
  const icgc = new URL(urls.find((x) => x.includes('icgc')));
  assert.ok(icgc.searchParams.get('focus.point.lat') && icgc.searchParams.get('focus.point.lon'));
});

test('con la población escrita no se prefiere lo cercano: cambia el orden y «La Rambla 31» daba otra Rambla', async () => {
  globalThis.fetch = fakeFetch;
  await geocode('RAMBLA CAPUTXINS 31, BARCELONA');
  const icgc = new URL(urls.find((x) => x.includes('icgc')));
  assert.equal(icgc.searchParams.get('focus.point.lat'), null);
});

test('la calle sin número tiene que ser la misma calle, no una que se le parezca («Riera» ≠ «Riera Basté»)', async () => {
  globalThis.fetch = (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/candidates') && !/\d/.test(u.searchParams.get('q'))) {
      return Promise.resolve({ ok: true, json: async () => [{ id: '1', type: 'callejero', address: 'CALLE RIERA BASTÉ, Sant Boi de Llobregat', muni: 'Sant Boi de Llobregat' }] });
    }
    if (u.pathname.endsWith('/find')) return Promise.resolve({ ok: true, json: async () => ({ geom: 'LINESTRING(2.03 41.34,2.04 41.35)' }) });
    return fakeFetch(url);
  };
  const res = await geocode('Av Riera 10-12 nave 4, SANT BOI DE LLOBREGAT');
  assert.ok(!res.some((c) => c.noNumber), JSON.stringify(res));
});

test('una calle de polígono sin portales en el callejero (Canovelles) se ubica en la calle, sin número', async () => {
  globalThis.fetch = fakeFetch;
  const [hit] = await geocode('CARRER JOAN DE LA CIERVA, 14 -NAVE CAN CASTELLS-, CANOVELLES');
  assert.ok(hit, 'sin resultado');
  assert.equal(hit.doubt, false);
  assert.equal(hit.noNumber, true);
  assert.ok(Math.abs(hit.lat - 41.6263) < 0.001 && Math.abs(hit.lon - 2.286) < 0.002, `${hit.lat},${hit.lon}`);
  assert.match(hit.label, /Joan de la Cierva/i);
  assert.match(hit.label, /sin número/);
  assert.match(hit.label, /Canovelles/);
});

test('la calle sin número solo vale si es de la población escrita', async () => {
  globalThis.fetch = fakeFetch;
  const res = await geocode('CARRER JOAN DE LA CIERVA, 14, GRANOLLERS');
  assert.ok(!res.some((c) => c.noNumber && !c.doubt));
});

test('la nave entre guiones tras el número no se busca («14 -NAVE CAN CASTELLS-»)', () => {
  assert.equal(normalizeAddress('CARRER JOAN DE LA CIERVA, 14 -NAVE CAN CASTELLS-, CANOVELLES'), 'CARRER JOAN DE LA CIERVA, 14, CANOVELLES');
});
