import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spotsFor, spotAt, parkedTime, medianPoint, walkM, walkMin } from '../js/parking.js';
import { computePlan } from '../js/planner.js';

// Puntos a x metros al este e y al norte de una esquina del Eixample.
const O = { lat: 41.39, lon: 2.16 };
const at = (x, y) => ({ lat: O.lat + y / 111200, lon: O.lon + x / (111200 * Math.cos(O.lat * Math.PI / 180)) });
const stop = (id, x, y, windows = [], service = 10) => ({ id, ...at(x, y), windows, service });
const zone = (x, y, label) => { const p = at(x, y); return [p.lat, p.lon, label]; };
const legsOf = (list, t0 = 600) => new Map(list.map((s, i) => [s.id, { id: s.id, arrive: t0 + i * 20, begin: t0 + i * 20, wait: 0, late: 0, drive: 4 }]));

test('el punto medio de tres entregas queda entre ellas', () => {
  const m = medianPoint([at(0, 0), at(200, 0), at(100, 150)]);
  assert.ok(walkM(m, at(100, 50)) < 60);
});

test('sitios: primero la zona DUM con la que menos se anda; «otro sitio» no repite ni da una pegada', () => {
  const members = [stop('a', 0, 0), stop('b', 140, 0), stop('c', 70, 120)];
  const zones = [zone(70, 40, 'Mejor'), zone(85, 40, 'Pegada a la mejor'), zone(0, -60, 'Otra'), zone(3000, 0, 'Lejos')];
  const first = spotsFor(members, zones);
  assert.deepEqual(first.map((z) => z.label), ['Mejor', 'Otra']); // la lejana no sale y la pegada se salta
  assert.equal(first[0].dum, true);
  assert.deepEqual(spotsFor(members, zones, [first[0]]).map((z) => z.label), ['Otra']);
});

test('sitios: sin zonas DUM cerca sale el punto medio, y una sola vez', () => {
  const members = [stop('a', 0, 0), stop('b', 140, 0)];
  const [mid] = spotsFor(members, [zone(3000, 0, 'Lejos')]);
  assert.equal(mid.dum, false);
  assert.equal(spotsFor(members, [], [mid]).length, 0);
});

test('mover la P a mano: si cae junto a una zona DUM, es esa zona; si no, el punto elegido', () => {
  const zones = [zone(100, 0, 'C Tuset, 20')];
  assert.equal(spotAt(at(110, 5), zones).label, 'C Tuset, 20');
  const free = spotAt(at(300, 0), zones);
  assert.equal(free.dum, false);
  assert.ok(walkM(free, at(300, 0)) < 1);
});

test('tiempo aparcado: ida y vuelta a cada entrega más descargas; la espera de la primera no cuenta', () => {
  const stops = [stop('a', 0, 0, [[640, 700]]), stop('b', 140, 0, [[600, 720]])];
  const spot = at(70, 0);
  const p = parkedTime(stops, spot, legsOf(stops, 600)); // se llega a las 10:00 y la primera abre a las 10:40
  const expected = 2 * walkMin(spot, stops[0]) + 10 + 2 * walkMin(spot, stops[1]) + 10;
  assert.ok(Math.abs(p.minutes - expected) < 0.01, `${p.minutes} ≠ ${expected}`);
  assert.deepEqual(p.late, []);
});

test('tiempo aparcado: avisa de quién pasaría a llegar tarde', () => {
  const stops = [stop('a', 0, 0, [], 25), stop('b', 140, 0, [[600, 620]])];
  const p = parkedTime(stops, at(70, 0), legsOf(stops, 600));
  assert.deepEqual(p.late, ['b']);
  assert.equal(parkedTime(stops, at(70, 0), null), null); // sin plan no se puede calcular
});

test('con un aparcamiento aceptado, entre sus entregas se va a pie pasando por la furgoneta', async () => {
  const depot = at(-4000, 0);
  const stops = [stop('a', 0, 0), stop('b', 140, 0)];
  const spot = at(70, 0);
  const plan = await computePlan({ from: depot, depot, stops, startMin: 540, departAt: new Date('2026-11-04T09:00:00'), returnToDepot: true,
    parking: [{ ids: ['a', 'b'], ...spot }] });
  const [first, second] = plan.legs;
  assert.equal(first.foot, false);
  assert.ok(first.walk > 0.5 && first.walk < 2); // del aparcamiento a la primera
  assert.equal(second.foot, true);
  assert.equal(second.km, 0);
  assert.ok(Math.abs(second.drive - (walkM(spot, stops[0]) + walkM(spot, stops[1])) / 70) < 0.01);
  // Sin aparcamiento, el mismo tramo es en coche
  const car = await computePlan({ from: depot, depot, stops, startMin: 540, departAt: new Date('2026-11-04T09:00:00'), returnToDepot: true });
  assert.equal(car.legs[1].foot, false);
});

test('un pedido grande son varios viajes y acerca el aparcamiento a ese local', async () => {
  const { trips } = await import('../js/parking.js');
  assert.equal(trips({}), 1);
  assert.equal(trips({ load: { boxes: 5, loose: 6 } }), 1);
  assert.equal(trips({ load: { boxes: 24, loose: 52 } }), 5); // (24 + 52/6) / 8 → 5 viajes
  const small = stop('a', 0, 0), big = { ...stop('b', 200, 0), load: { boxes: 30, loose: 0 } };
  const zones = [zone(40, 0, 'Junto a la pequeña'), zone(160, 0, 'Junto a la grande')];
  assert.equal(spotsFor([small, big], zones)[0].label, 'Junto a la grande');
  assert.equal(spotsFor([small, { ...big, load: null }], zones)[0].label, 'Junto a la pequeña'); // sin carga, empate: la primera
  const mid = medianPoint([small, big], trips);
  assert.ok(walkM(mid, big) < walkM(mid, small));
  // El tiempo aparcado cuenta los viajes de más
  const one = parkedTime([small, { ...big, load: null }], at(100, 0), legsOf([small, big]));
  const many = parkedTime([small, big], at(100, 0), legsOf([small, big]));
  assert.ok(Math.abs(many.minutes - one.minutes - 2 * walkMin(at(100, 0), big) * 3) < 0.01);
});
