import test from 'node:test';
import assert from 'node:assert/strict';

// Google simulado. Matriz (sin tráfico): minutos = distancia en "grados" × 1000. Ruta con tráfico: lo que diga
// `jam` (5 min por tramo si no). `failWith`: la respuesta de error que dará la matriz.
let elements = 0, matrixCalls = [], routeCalls = [], jam = null, failWith = null;
const ll = (w) => [w.location.latLng.latitude, w.location.latLng.longitude];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const body = JSON.parse(opts.body || '{}');
  assert.ok(opts.headers['X-Goog-Api-Key'], 'la clave va en la cabecera');
  assert.ok(opts.headers['X-Goog-FieldMask'], 'Google exige la máscara de campos');
  if (url.endsWith('/distanceMatrix/v2:computeRouteMatrix')) {
    if (failWith) return { ok: false, status: failWith.status, json: async () => [{ error: failWith.error }] };
    const os = body.origins.map((o) => ll(o.waypoint)), ds = body.destinations.map((d) => ll(d.waypoint));
    assert.equal(body.routingPreference, 'TRAFFIC_UNAWARE', 'la matriz va sin tráfico: es la tarifa barata');
    elements += os.length * ds.length;
    matrixCalls.push([os.length, ds.length]);
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 1000;
    const out = [];
    os.forEach((a, i) => ds.forEach((b, j) => out.push({ originIndex: i, destinationIndex: j, duration: `${Math.round(d(a, b) * 60)}s`, distanceMeters: Math.round(d(a, b) * 1000), condition: 'ROUTE_EXISTS' })));
    return { ok: true, status: 200, json: async () => out };
  }
  if (url.endsWith('/directions/v2:computeRoutes')) {
    routeCalls.push(body);
    assert.equal(body.routingPreference, 'TRAFFIC_AWARE');
    const pts = [body.origin, ...body.intermediates, body.destination].map(ll);
    const legs = pts.slice(1).map((b, i) => ({ duration: `${(jam?.(pts[i], b) ?? 5) * 60}s`, distanceMeters: 1000 }));
    return { ok: true, status: 200, json: async () => ({ routes: [{ legs }] }) };
  }
  throw new Error('URL inesperada ' + url);
};
const { computePlan, fitService, wantedPairs, FULL_UP_TO } = await import('../js/planner.js');
const { trafficLegs } = await import('../js/geo.js');

const depot = { lat: 41.37, lon: 2.07 };
const night = new Date('2026-11-03T03:00:00'); // factor de tráfico 1,1
const stops = [
  { id: 'a', lat: 41.38, lon: 2.08, windows: [], service: 5 },
  { id: 'b', lat: 41.39, lon: 2.09, windows: [], service: 5 },
];
const base = { from: depot, depot, startMin: 450, departAt: night, key: 'k' };
const reset = () => { elements = 0; matrixCalls = []; routeCalls = []; };
const near = (p, q) => Math.abs(p[0] - q.lat) < 1e-4 && Math.abs(p[1] - q.lon) < 1e-4;

test('reutiliza los tiempos entre paradas: la segunda vez no pide ninguna matriz', async () => {
  reset();
  const p1 = await computePlan({ ...base, stops });
  // Salida (almacén) a las 2 paradas, a ↔ b, y las 2 paradas al almacén.
  assert.equal(elements, 6);
  const p2 = await computePlan({ ...base, stops, pairs: p1.pairs });
  assert.equal(elements, 6);
  assert.deepEqual(p2.order, p1.order);
  assert.equal(p1.source, 'traffic');
  assert.ok(Object.values(p1.pairs).every((x) => x.src === 'google'));
});

test('si una parada cambia de sitio, solo se piden otra vez sus tiempos', async () => {
  reset();
  const p1 = await computePlan({ ...base, stops });
  const before = elements;
  const moved = [stops[0], { ...stops[1], lat: 41.5, lon: 2.3 }];
  await computePlan({ ...base, stops: moved, pairs: p1.pairs });
  // almacén → b, a → b, b → a, b → almacén
  assert.equal(elements - before, 4);
});

test('sin clave de Google: estimación por distancia, sin red', async () => {
  reset();
  const p = await computePlan({ ...base, stops, key: '' });
  assert.equal(p.source, 'estimate');
  assert.equal(elements + routeCalls.length, 0);
  assert.equal(p.order.length, 2);
  assert.deepEqual(p.pairs, {});
});

test('con tráfico: un atasco en un tramo cambia el orden, y los tiempos con tráfico no se guardan', async () => {
  const p0 = await computePlan({ ...base, stops, key: '' });
  reset();
  jam = (from, to) => (near(from, depot) && near(to, stops[0]) ? 60 : 5);
  const p1 = await computePlan({ ...base, stops, live: true });
  jam = null;
  assert.deepEqual(p0.order, ['a', 'b']);
  assert.deepEqual(p1.order, ['b', 'a']);
  assert.ok(routeCalls.length >= 1 && routeCalls.length <= 3, `${routeCalls.length} consultas`);
  assert.equal(p1.source, 'traffic');
  assert.ok(p1.live);
  // En la memoria solo quedan los de la matriz (sin tráfico), nunca los de la ruta.
  assert.ok(Object.values(p1.pairs).every((x) => x.src === 'google' && x.m < 60));
});

test('la hora de salida solo se manda si es futura y no se pide el tráfico de ahora', async () => {
  reset();
  const tomorrow = new Date(Date.now() + 86400000);
  await computePlan({ ...base, stops, departAt: tomorrow });
  assert.equal(routeCalls[0].departureTime, tomorrow.toISOString());
  reset();
  await computePlan({ ...base, stops, departAt: tomorrow, live: true });
  assert.equal(routeCalls[0].departureTime, undefined);
  reset();
  await computePlan({ ...base, stops, departAt: new Date(Date.now() - 3600000) });
  assert.equal(routeCalls[0].departureTime, undefined, 'Google no acepta horas pasadas');
});

test('si Google falla, calcula una ruta aproximada y avisa (no se queda sin ruta)', async () => {
  reset();
  failWith = { status: 403, error: { code: 403, status: 'PERMISSION_DENIED', message: 'Routes API has not been used in project 123 before or it is disabled.' } };
  const p = await computePlan({ ...base, stops });
  failWith = null;
  assert.equal(p.order.length, 2);
  assert.equal(p.source, 'estimate');
  assert.match(p.warning, /Routes API/);
  assert.equal(routeCalls.length, 0, 'con la matriz rota no se insiste con la ruta');
  assert.deepEqual(p.pairs, {}); // no se reutilizarán como si fueran de Google
});

test('clave mala: el aviso lo dice claro', async () => {
  failWith = { status: 400, error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } };
  const p = await computePlan({ ...base, stops });
  failWith = null;
  assert.match(p.warning, /clave de Google no es válida/);
});

test('con muchas paradas solo se piden los pares entre vecinas: mucho menos que todos con todos', async () => {
  reset();
  const many = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, lat: 41.35 + (i % 5) * 0.01, lon: 2.05 + Math.floor(i / 5) * 0.01, windows: [], service: 5 }));
  const p = await computePlan({ ...base, stops: many });
  assert.equal(p.order.length, 25);
  assert.ok(elements < 26 * 26 / 2, `${elements} tiempos pedidos`);
  assert.ok(elements >= 25 + 25 * 6, 'cada parada con sus vecinas, y la salida con todas');
  // La segunda vez no se pide nada: todo está en memoria.
  const before = elements;
  await computePlan({ ...base, stops: many, pairs: p.pairs });
  assert.equal(elements, before);
});

test('los pares pedidos: todos con todos con pocas paradas, vecinas con muchas', () => {
  const few = stops;
  assert.equal(wantedPairs(few).length, 2 + 2); // a↔b, y las dos al almacén
  const many = Array.from({ length: FULL_UP_TO + 5 }, (_, i) => ({ lat: 41 + i * 0.01, lon: 2 }));
  const w = wantedPairs(many);
  assert.ok(w.every(([i, j]) => i !== j && i >= 1 && j >= 1));
  // En línea, cada una tiene como vecinas las de al lado: la primera nunca va directa a la última.
  assert.ok(!w.some(([i, j]) => i === 1 && j === many.length));
});

test('en ruta, desde donde estás: se pregunta a las más cercanas y ese tramo no se guarda', async () => {
  reset();
  const here = { lat: 41.381, lon: 2.081 };
  const p = await computePlan({ ...base, from: here, stops });
  assert.ok(Object.keys(p.pairs).every((k) => !k.startsWith('null')));
  assert.ok(matrixCalls.some(([o]) => o === 1));
  assert.equal(p.order.length, 2);
});

test('una ruta de más de 27 puntos se pide a trozos y los tramos casan', async () => {
  reset();
  const pts = Array.from({ length: 40 }, (_, i) => ({ lat: 41 + i * 0.001, lon: 2 }));
  const legs = await trafficLegs(pts, { key: 'k', live: true });
  assert.equal(legs.length, 39);
  assert.equal(routeCalls.length, 2);
  assert.equal(routeCalls[0].intermediates.length, 25);
});

test('orden puesto a mano: se respeta y solo se calculan las horas (también con tráfico y paradas nuevas)', async () => {
  const three = [...stops, { id: 'c', lat: 41.40, lon: 2.10, windows: [], service: 5 }];
  const auto = await computePlan({ ...base, stops: three, key: '' });
  assert.deepEqual(auto.order, ['a', 'b', 'c']);
  const hand = await computePlan({ ...base, stops: three, fixedOrder: ['c', 'a', 'b'], key: '' });
  assert.deepEqual(hand.order, ['c', 'a', 'b']);
  assert.ok(hand.end > auto.end, 'el orden a mano es más largo y se nota en la hora de vuelta');
  assert.ok(hand.legs[0].arrive < hand.legs[1].arrive && hand.legs[1].arrive < hand.legs[2].arrive);
  // Paradas que no estaban en el orden (añadidas después) van al final; ids que ya no existen se ignoran.
  const later = await computePlan({ ...base, stops: three, fixedOrder: ['b', 'zz', 'a'], key: '' });
  assert.deepEqual(later.order, ['b', 'a', 'c']);
  // Con tráfico: un atasco que antes cambiaba el orden ya no lo cambia.
  jam = (from, to) => (near(from, depot) && near(to, stops[0]) ? 60 : 5);
  const tt = await computePlan({ ...base, stops, live: true, fixedOrder: ['a', 'b'] });
  jam = null;
  assert.deepEqual(tt.order, ['a', 'b']);
  assert.equal(tt.source, 'traffic');
  assert.ok(tt.legs[0].drive >= 60, 'el atasco se ve en la hora de llegada');
});

test('con la ventana de un cliente, el orden a mano avisa de que llegas tarde', async () => {
  const w = [{ ...stops[0], windows: [[450, 470]] }, stops[1]]; // «a» cierra a las 7:50
  const hand = await computePlan({ ...base, stops: w, fixedOrder: ['b', 'a'], key: '' });
  assert.deepEqual(hand.order, ['b', 'a']);
  assert.ok(hand.late > 0);
});

test('la ventana se recorta por la descarga: hay que acabar antes de que cierren, no solo llegar', () => {
  // 25 cajas (35 min de descarga) en un cliente que cierra a las 14:00: hay que estar allí a las 13:25,
  // porque empezar a las 13:56 significa seguir descargando a las 14:31, con el cliente cerrado.
  assert.deepEqual(fitService([[480, 840]], 35), [[480, 805]]);
  assert.deepEqual(fitService([[480, 840]], 10), [[480, 830]]);
  assert.deepEqual(fitService([[480, 840], [960, 1140]], 20), [[480, 820], [960, 1120]]);
  // Sin descarga conocida, la ventana no se toca
  assert.deepEqual(fitService([[480, 840]], 0), [[480, 840]]);
  assert.deepEqual(fitService([], 30), []);
  // Si la descarga no cabe en la franja no se declara imposible: se deja un hueco mínimo y que el
  // optimizador la ordene con criterio (el aviso de que va justo es cosa de la pantalla, no del solver).
  assert.deepEqual(fitService([[480, 500]], 40), [[480, 490]]);
});
