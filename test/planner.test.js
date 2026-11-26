import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let matrixCalls = [], routeCalls = [], elements = 0, matrixStatus = 200, routeStatus = 200, jam = null;
const reset = () => { matrixCalls = []; routeCalls = []; elements = 0; matrixStatus = 200; routeStatus = 200; jam = null; };
const minutesBetween = (a, b) => Math.hypot(a.lat - b.lat, a.lon - b.lon) * 1000;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.includes('/openrouteservice/v2/matrix/driving-car')) {
    const body = JSON.parse(opts.body);
    assert.ok(opts.headers.Authorization, 'la clave ORS va en Authorization');
    assert.deepEqual(body.metrics, ['duration', 'distance']);
    assert.equal(body.units, 'km');
    matrixCalls.push(body);
    elements += body.sources.length * body.destinations.length;
    if (matrixStatus !== 200) return { ok: false, status: matrixStatus, json: async () => ({}) };
    const points = body.locations.map(([lon, lat]) => ({ lat, lon }));
    return {
      ok: true, status: 200,
      json: async () => ({
        durations: body.sources.map((s) => body.destinations.map((d) => Math.round(minutesBetween(points[s], points[d]) * 60))),
        distances: body.sources.map((s) => body.destinations.map((d) => minutesBetween(points[s], points[d]))),
      }),
    };
  }
  if (url.includes('/calculateRoute/')) {
    assert.match(url, /traffic=true/);
    assert.match(url, /routeType=fastest/);
    assert.match(url, /travelMode=car/);
    assert.match(url, /routeRepresentation=summaryOnly/);
    routeCalls.push(url);
    if (routeStatus !== 200) return { ok: false, status: routeStatus, json: async () => ({}) };
    const path = url.split('/calculateRoute/')[1].split('/json?')[0];
    const points = path.split(':').map((pair) => {
      const [lat, lon] = pair.split(',').map(Number);
      return { lat, lon };
    });
    const legs = points.slice(1).map((to, i) => ({
      summary: { travelTimeInSeconds: Math.round((jam?.(points[i], to) ?? 5) * 60) },
    }));
    return { ok: true, status: 200, json: async () => ({ routes: [{ legs }] }) };
  }
  throw new Error(`URL inesperada: ${url}`);
};

const { computePlan, fitService, wantedPairs, FULL_UP_TO } = await import('../js/planner.js');
const { orsMatrix, trafficLegs } = await import('../js/geo.js');
const depot = { lat: 41.37, lon: 2.07 };
const stops = [
  { id: 'a', lat: 41.38, lon: 2.08, windows: [], service: 5 },
  { id: 'b', lat: 41.39, lon: 2.09, windows: [], service: 5 },
];
const base = { from: depot, depot, startMin: 450, departAt: new Date('2026-11-03T03:00:00'), orsKey: 'ors-company' };
const near = (p, q) => Math.abs(p.lat - q.lat) < 1e-4 && Math.abs(p.lon - q.lon) < 1e-4;

test('ORS calcula la matriz y los pares se reutilizan en memoria', async () => {
  reset();
  const p1 = await computePlan({ ...base, stops, trafficRounds: 0 });
  assert.equal(p1.source, 'ors');
  assert.equal(matrixCalls.length, 1);
  assert.ok(Object.values(p1.pairs).every((x) => x.src === 'ors'));
  const p2 = await computePlan({ ...base, stops, pairs: p1.pairs, trafficRounds: 0 });
  assert.equal(matrixCalls.length, 1);
  assert.deepEqual(p2.order, p1.order);
});

test('ORS solo pide las celdas que faltan', async () => {
  reset();
  const pts = [depot, stops[0], stops[1]];
  const got = await orsMatrix(pts, pts, { key: 'ors-company', cells: [[0, 1], [2, 0]] });
  assert.deepEqual(matrixCalls[0].sources, [0, 1]);
  assert.deepEqual(matrixCalls[0].destinations, [2, 0]);
  assert.deepEqual(got.map(({ i, j }) => [i, j]), [[0, 1], [2, 0]]);
  assert.ok(Math.abs(got[0].min - 14.15) < 0.01);
});

test('ORS parte las matrices que superan 3.500 pares', async () => {
  reset();
  const origins = Array.from({ length: 60 }, (_, i) => ({ lat: 41 + i * 0.001, lon: 2 }));
  const destinations = Array.from({ length: 60 }, (_, i) => ({ lat: 43 + i * 0.001, lon: 2 }));
  const got = await orsMatrix(origins, destinations, { key: 'ors-company' });
  assert.equal(got.length, 3600);
  assert.equal(matrixCalls.length, 2);
  assert.ok(matrixCalls.every((x) => x.sources.length * x.destinations.length <= 3500));
});

test('ORS 403 deja una ruta estimada y avisa', async () => {
  reset(); matrixStatus = 403;
  const p = await computePlan({ ...base, stops, tomtomKey: '', trafficRounds: 0 });
  assert.equal(p.source, 'estimate');
  assert.equal(p.order.length, 2);
  assert.match(p.warning, /clave de openrouteservice/);
  assert.deepEqual(p.pairs, {});
});

test('TomTom aplica los tiempos de tráfico a los tramos elegidos', async () => {
  reset(); jam = () => 15;
  const p = await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', fixedOrder: ['a', 'b'], trafficRounds: 1 });
  assert.equal(routeCalls.length, 1);
  assert.equal(p.source, 'traffic');
  assert.equal(p.legs[0].drive, 15);
});

test('TomTom 401 avisa y conserva el plan de carretera de ORS', async () => {
  reset(); routeStatus = 401;
  const p = await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', trafficRounds: 1 });
  assert.equal(p.source, 'ors');
  assert.match(p.warning, /clave de TomTom no es válida/);
});

test('TomTom 429 devuelve null y el plan sigue sin fallar', async () => {
  reset(); routeStatus = 429;
  const legs = await trafficLegs([depot, stops[0]], { key: 'tomtom-company', live: true });
  assert.equal(legs, null);
  const p = await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', trafficRounds: 1 });
  assert.equal(p.source, 'ors');
  assert.equal(p.warning, undefined);
  assert.equal(p.order.length, 2);
});

test('sin claves usa estimaciones y no consulta los servicios', async () => {
  reset();
  const p = await computePlan({ ...base, stops, orsKey: '', tomtomKey: '', trafficRounds: 2 });
  assert.equal(p.source, 'estimate');
  assert.equal(matrixCalls.length + routeCalls.length, 0);
  assert.equal(p.order.length, 2);
  assert.deepEqual(p.pairs, {});
});

test('TomTom acepta tramos de hasta 150 puntos por petición', async () => {
  reset();
  const points = Array.from({ length: 151 }, (_, i) => ({ lat: 41 + i * 0.001, lon: 2 }));
  const legs = await trafficLegs(points, { key: 'tomtom-company', live: true });
  assert.equal(legs.length, 150);
  assert.equal(routeCalls.length, 2);
  assert.equal(routeCalls[0].split('/calculateRoute/')[1].split('/json?')[0].split(':').length, 150);
});

test('las claves personales tienen prioridad sobre las claves de empresa', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /settings\(\)\.tomtomKey \|\| COMPANY_TOMTOM_KEY/);
  assert.match(app, /settings\(\)\.orsKey \|\| COMPANY_ORS_KEY/);
});

test('reutiliza los tiempos entre paradas: la segunda vez no pide ninguna matriz', async () => {
  reset();
  const p1 = await computePlan({ ...base, stops, trafficRounds: 0 });
  const requests = matrixCalls.length;
  assert.ok(elements > 0);
  const p2 = await computePlan({ ...base, stops, pairs: p1.pairs, trafficRounds: 0 });
  assert.equal(matrixCalls.length, requests);
  assert.deepEqual(p2.order, p1.order);
  assert.ok(Object.values(p1.pairs).every((x) => x.src === 'ors'));
});

test('si una parada cambia de sitio, solo se piden otra vez sus tiempos', async () => {
  reset();
  const p1 = await computePlan({ ...base, stops, trafficRounds: 0 });
  const requests = matrixCalls.length;
  const moved = [stops[0], { ...stops[1], lat: 41.5, lon: 2.3 }];
  const p2 = await computePlan({ ...base, stops: moved, pairs: p1.pairs, trafficRounds: 0 });
  assert.ok(matrixCalls.length > requests);
  const refreshed = Object.keys(p2.pairs).filter((k) => !p1.pairs[k]);
  assert.ok(refreshed.length > 0);
  assert.ok(refreshed.every((k) => k.includes('b@41.50000,2.30000')));
  assert.ok(Object.keys(p2.pairs).some((k) => k.includes('a@41.38000,2.08000')));
});

test('con tráfico: un atasco en un tramo cambia el orden (TomTom)', async () => {
  reset();
  const p0 = await computePlan({ ...base, stops, trafficRounds: 0 });
  jam = (from, to) => (near(from, depot) && near(to, stops[0]) ? 60 : 5);
  const p1 = await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', live: true, trafficRounds: 3 });
  jam = null;
  assert.deepEqual(p0.order, ['a', 'b']);
  assert.deepEqual(p1.order, ['b', 'a']);
  assert.ok(routeCalls.length >= 1 && routeCalls.length <= 3);
  assert.equal(p1.source, 'traffic');
  assert.ok(p1.live);
  assert.ok(Object.values(p1.pairs).every((x) => x.src === 'ors'));
});

test('la hora de salida solo se manda si es futura: TomTom usa now en vivo o pasado', async () => {
  reset();
  const future = new Date(Date.now() + 86400000);
  await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', departAt: future, fixedOrder: ['a', 'b'], trafficRounds: 1 });
  const futureParam = decodeURIComponent(new URL(routeCalls[0]).searchParams.get('departAt'));
  assert.match(futureParam, /^\d{4}-\d\d-\d\dT\d\d:\d\d:00$/);
  assert.ok(!futureParam.endsWith('Z'));
  reset();
  await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', departAt: future, live: true, fixedOrder: ['a', 'b'], trafficRounds: 1 });
  assert.equal(new URL(routeCalls[0]).searchParams.get('departAt'), 'now');
  reset();
  await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', departAt: new Date(Date.now() - 3600000), fixedOrder: ['a', 'b'], trafficRounds: 1 });
  assert.equal(new URL(routeCalls[0]).searchParams.get('departAt'), 'now');
});

test('clave mala: el aviso lo dice claro (ORS 401/403 y TomTom 401/403)', async () => {
  for (const status of [401, 403]) {
    reset(); matrixStatus = status;
    const ors = await computePlan({ ...base, stops, tomtomKey: '', trafficRounds: 0 });
    assert.match(ors.warning, /clave de openrouteservice/);
    assert.equal(ors.source, 'estimate');
    reset(); routeStatus = status;
    const tt = await computePlan({ ...base, stops, tomtomKey: 'tomtom-company', trafficRounds: 1 });
    assert.match(tt.warning, /clave de TomTom/);
    assert.equal(tt.source, 'ors');
  }
});

test('con muchas paradas solo se piden los pares entre vecinas: mucho menos que todos con todos', async () => {
  reset();
  const many = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, lat: 41.35 + (i % 5) * 0.01, lon: 2.05 + Math.floor(i / 5) * 0.01, windows: [], service: 5 }));
  const p = await computePlan({ ...base, stops: many, trafficRounds: 0 });
  assert.equal(p.order.length, 25);
  assert.ok(elements < 26 * 26, `${elements} celdas solicitadas`);
  assert.ok(elements >= 25, 'se piden tiempos de las paradas');
  const requests = matrixCalls.length;
  await computePlan({ ...base, stops: many, pairs: p.pairs, trafficRounds: 0 });
  assert.equal(matrixCalls.length, requests);
});

test('los pares pedidos: todos con todos con pocas paradas, vecinas con muchas (wantedPairs)', () => {
  assert.equal(wantedPairs(stops).length, 2 + 2); // a↔b y las dos al almacén
  const many = Array.from({ length: FULL_UP_TO + 5 }, (_, i) => ({ lat: 41 + i * 0.01, lon: 2 }));
  const wanted = wantedPairs(many);
  assert.ok(wanted.every(([i, j]) => i !== j && i >= 1 && j >= 1));
  assert.ok(!wanted.some(([i, j]) => i === 1 && j === many.length));
});

test('en ruta, desde donde estás: no se gasta matriz en ese tramo, lo da la consulta con tráfico', async () => {
  reset();
  const p1 = await computePlan({ ...base, stops, trafficRounds: 0 });
  reset();
  const here = { lat: 41.381, lon: 2.081 };
  const p = await computePlan({ ...base, from: here, stops, pairs: p1.pairs, tomtomKey: 'tomtom-company', live: true, trafficRounds: 1 });
  assert.equal(matrixCalls.length, 0);
  assert.equal(routeCalls.length, 1);
  assert.ok(Object.keys(p.pairs).every((k) => !k.startsWith('null')));
  assert.equal(p.order.length, 2);
  assert.equal(p.legs[0].drive, 5);
});

test('los tiempos de la mañana valen por la tarde: el factor de la hora se pone al usarlos', async () => {
  reset();
  const p1 = await computePlan({ ...base, stops, trafficRounds: 0 });
  const rush = new Date('2026-11-03T08:00:00');
  const p2 = await computePlan({ ...base, stops, departAt: rush, pairs: p1.pairs, maxAgeMin: 1e9, trafficRounds: 0 });
  assert.equal(matrixCalls.length, 1, 'no se vuelve a pedir ninguna matriz');
  assert.deepEqual(p2.order, p1.order);
  assert.ok(p2.legs[0].drive > p1.legs[0].drive, 'se aplica el factor de tráfico de la hora nueva');
});

test('una ruta de más de 150 puntos se pide a trozos y los tramos casan (TomTom)', async () => {
  reset();
  const points = Array.from({ length: 301 }, (_, i) => ({ lat: 41 + i * 0.001, lon: 2 }));
  const legs = await trafficLegs(points, { key: 'tomtom-company', live: true });
  assert.equal(legs.length, 300);
  assert.equal(routeCalls.length, 3);
  const paths = routeCalls.map((url) => url.split('/calculateRoute/')[1].split('/json?')[0].split(':'));
  const counts = paths.map((path) => path.length);
  assert.deepEqual(counts, [150, 150, 3]);
  assert.equal(paths[0].at(-1), paths[1][0]);
  assert.equal(paths[1].at(-1), paths[2][0]);
});

test('orden puesto a mano: se respeta y solo se calculan las horas (también con tráfico y paradas nuevas)', async () => {
  const three = [...stops, { id: 'c', lat: 41.40, lon: 2.10, windows: [], service: 5 }];
  const auto = await computePlan({ ...base, stops: three, orsKey: '', trafficRounds: 0 });
  assert.deepEqual(auto.order, ['a', 'b', 'c']);
  const hand = await computePlan({ ...base, stops: three, orsKey: '', fixedOrder: ['c', 'a', 'b'], trafficRounds: 0 });
  assert.deepEqual(hand.order, ['c', 'a', 'b']);
  assert.ok(hand.end > auto.end);
  assert.ok(hand.legs[0].arrive < hand.legs[1].arrive && hand.legs[1].arrive < hand.legs[2].arrive);
  const later = await computePlan({ ...base, stops: three, orsKey: '', fixedOrder: ['b', 'zz', 'a'], trafficRounds: 0 });
  assert.deepEqual(later.order, ['b', 'a', 'c']);
  jam = (from, to) => (near(from, depot) && near(to, stops[0]) ? 60 : 5);
  const tt = await computePlan({ ...base, stops, orsKey: '', tomtomKey: 'tomtom-company', live: true, fixedOrder: ['a', 'b'], trafficRounds: 1 });
  jam = null;
  assert.deepEqual(tt.order, ['a', 'b']);
  assert.equal(tt.source, 'traffic');
  assert.ok(tt.legs[0].drive >= 60);
});

test('con la ventana de un cliente, el orden a mano avisa de que llegas tarde', async () => {
  const w = [{ ...stops[0], windows: [[450, 470]] }, stops[1]];
  const hand = await computePlan({ ...base, stops: w, fixedOrder: ['b', 'a'], orsKey: '', trafficRounds: 0 });
  assert.deepEqual(hand.order, ['b', 'a']);
  assert.ok(hand.late > 0);
});

test('la ventana se recorta por la descarga', () => {
  assert.deepEqual(fitService([[480, 840]], 35), [[480, 805]]);
  assert.deepEqual(fitService([[480, 840]], 10), [[480, 830]]);
  assert.deepEqual(fitService([[480, 840], [960, 1140]], 20), [[480, 820], [960, 1120]]);
  assert.deepEqual(fitService([[480, 840]], 0), [[480, 840]]);
  assert.deepEqual(fitService([], 30), []);
  assert.deepEqual(fitService([[480, 500]], 40), [[480, 490]]);
});

test('sin matriz (solo TomTom, sin orsKey): ni un solo tiempo de matriz, una o dos rutas, y el resto ajustado con TomTom', async () => {
  reset();
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, lat: 41.35 + (i % 5) * 0.01, lon: 2.05 + Math.floor(i / 5) * 0.01, windows: [], service: 5 }));
  const p = await computePlan({ ...base, stops: many, orsKey: '', tomtomKey: 'tomtom-company', trafficRounds: 2 });
  assert.equal(matrixCalls.length, 0);
  assert.ok(routeCalls.length >= 1 && routeCalls.length <= 2);
  assert.equal(p.source, 'traffic');
  assert.equal(p.order.length, 20);
  assert.deepEqual(p.pairs, {});
  reset();
  await computePlan({ ...base, from: { lat: 41.36, lon: 2.06 }, stops: many.slice(5), orsKey: '', tomtomKey: 'tomtom-company', trafficRounds: 1, live: true });
  assert.equal(routeCalls.length, 1);
});

test('sin matriz, un atasco sigue cambiando el orden', async () => {
  reset();
  jam = (from, to) => (near(from, depot) && near(to, stops[0]) ? 60 : 5);
  const p = await computePlan({ ...base, stops, orsKey: '', tomtomKey: 'tomtom-company', trafficRounds: 2, live: true });
  jam = null;
  assert.deepEqual(p.order, ['b', 'a']);
});

test('lo que dijo TomTom se reutiliza: un «Siguiente» sin preguntar mantiene el atasco que se vio', async () => {
  reset();
  jam = (from, to) => (near(from, depot) && near(to, stops[0]) ? 60 : 5);
  const p1 = await computePlan({ ...base, stops, orsKey: '', tomtomKey: 'tomtom-company', trafficRounds: 2, live: true });
  jam = null;
  assert.ok(p1.traffic?.perKm > 0 && Object.keys(p1.traffic.pairs).length >= 2);
  reset();
  const p2 = await computePlan({ ...base, stops, orsKey: '', tomtomKey: 'tomtom-company', trafficRounds: 0, hint: p1.traffic });
  assert.equal(routeCalls.length, 0);
  assert.deepEqual(p2.order, ['b', 'a']);
  assert.equal(p2.traffic, null);
});
