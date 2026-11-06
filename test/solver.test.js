import test from 'node:test';
import assert from 'node:assert/strict';
import { optimize, bruteForce, evaluate, serviceStart } from '../js/solver.js';

function rand(seed) { let a = seed; return () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648); }

// Instancia aleatoria con geometría plausible (puntos en un plano, 2 min/km aprox) y ventanas.
function instance(n, seed, withWindows = true) {
  const r = rand(seed);
  const pts = [[0, 0], ...Array.from({ length: n }, () => [r() * 20 - 10, r() * 20 - 10])];
  const matrix = pts.map((a, i) => pts.map((b, j) => (i === j ? 0 : Math.round(2 * Math.hypot(a[0] - b[0], a[1] - b[1]) + 3 + r() * 4))));
  const stops = pts.slice(1).map(() => {
    if (!withWindows || r() < 0.4) return { windows: [], service: 10 };
    const open = 450 + Math.floor(r() * 240);
    return { windows: [[open, open + 60 + Math.floor(r() * 150)]], service: 10 };
  });
  return { matrix, stops, start: 450, returnTo: true };
}

test('ventanas: espera hasta abrir, elige la segunda franja, cuenta retraso', () => {
  assert.deepEqual(serviceStart(480, [[600, 690]]), { begin: 600, lateBy: 0 });
  assert.deepEqual(serviceStart(800, [[540, 780], [960, 1140]]), { begin: 960, lateBy: 0 });
  assert.deepEqual(serviceStart(700, [[540, 690]]), { begin: 700, lateBy: 10 });
  assert.deepEqual(serviceStart(700, []), { begin: 700, lateBy: 0 });
});

test('no empieza por el local de al lado si aún no abre (caso de Ferran)', () => {
  // parada 1 a 2 min del almacén pero abre a las 10:00; paradas 2 y 3 lejos pero abiertas desde las 7:30
  const matrix = [
    [0, 2, 25, 30],
    [2, 0, 25, 30],
    [25, 25, 0, 10],
    [30, 30, 10, 0],
  ];
  const stops = [
    { windows: [[600, 720]], service: 10 },
    { windows: [], service: 10 },
    { windows: [], service: 10 },
  ];
  const best = optimize({ matrix, stops, start: 450, returnTo: true });
  assert.notEqual(best.order[0], 1, `orden ${best.order}`);
  assert.equal(best.late, 0);
});

test('el recocido iguala a la búsqueda exhaustiva en 9 paradas', () => {
  let worse = 0;
  for (let s = 1; s <= 12; s++) {
    const ctx = instance(9, s * 7919);
    const exact = bruteForce(ctx);
    const heur = optimize(ctx);
    assert.equal(heur.late <= exact.late || heur.cost <= exact.cost * 1.001, true);
    if (heur.cost > exact.cost + 0.5) worse++;
  }
  assert.ok(worse <= 1, `peor que el óptimo en ${worse}/12 casos`);
});

test('25 paradas: rápido, sin retrasos evitables y mejor que el orden de entrada', () => {
  const ctx = instance(25, 42, false);
  const t0 = Date.now();
  const best = optimize(ctx);
  const ms = Date.now() - t0;
  const naive = evaluate(ctx.stops.map((_, i) => i + 1), ctx);
  assert.equal(new Set(best.order).size, 25);
  assert.ok(best.cost < naive.cost * 0.7, `${best.cost} vs ${naive.cost}`);
  assert.ok(ms < 3000, `${ms} ms`);
});

import { makeInstance } from './fixtures/instances.mjs';

test('regresión: 15 paradas donde la versión anterior llegaba 10 min más tarde de lo necesario', () => {
  const { ctx } = makeInstance(15, 4);
  const best = optimize(ctx);
  // Óptimo exacto calculado en la auditoría: 29,44 min de retraso inevitable y vuelta a los 1033,3 min.
  assert.ok(best.late < 29.5, `retraso ${best.late}`);
  assert.ok(best.end < 1033.3 + 3, `vuelta ${best.end}`);
});

test('30 paradas en menos de 1 s', () => {
  const { ctx } = makeInstance(30, 1);
  const t0 = Date.now();
  optimize(ctx);
  assert.ok(Date.now() - t0 < 1000);
});

test('a igual hora de vuelta, entrega antes en vez de esperar a que abra otro', () => {
  // A abre a las 9:00 y está a 5 min; B está abierto y a 6 min. Hacer B primero no retrasa nada.
  const matrix = [
    [0, 5, 6],
    [5, 0, 4],
    [6, 4, 0],
  ];
  const stops = [{ windows: [[540, 780]], service: 10 }, { windows: [], service: 10 }];
  const best = optimize({ matrix, stops, start: 450, returnTo: false });
  assert.deepEqual(best.order, [2, 1]);
});
