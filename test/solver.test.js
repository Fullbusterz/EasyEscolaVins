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

test('no se queda parado esperando a media ruta si hay clientes abiertos (caso de Ferran)', () => {
  // Reparto real del 9/11 por el Eixample: tiempos redondeados a minutos y las ventanas ya con el margen de
  // hours.js. La vuelta la marca la parada 8 (no abre hasta las 11:00), así que el día acaba a la misma hora
  // se haga el orden que se haga; con eso clavado, el desempate quedaba entre conducir y esperar, y salía
  // más barato plantarse en la parada 1 (que no abre hasta las 9) y esperar allí una hora.
  const D = [
    [0, 35, 34, 43, 47, 42, 43, 41, 35],
    [35, 0, 6, 12, 16, 11, 12, 11, 7],
    [34, 6, 0, 13, 17, 12, 13, 12, 8],
    [43, 12, 13, 0, 9, 5, 5, 8, 12],
    [47, 16, 17, 9, 0, 10, 9, 11, 17],
    [42, 11, 12, 5, 10, 0, 6, 8, 11],
    [43, 12, 13, 5, 9, 6, 0, 8, 12],
    [41, 11, 12, 8, 11, 8, 8, 0, 10],
    [35, 7, 8, 12, 17, 11, 12, 10, 0],
  ];
  const W = [[540, 900], [480, 750], [510, 900], [480, 750], [420, 630], [480, 810], [420, 810], [660, 840]];
  const stops = W.map((w) => ({ windows: [w], service: 10 }));
  const ctx = { matrix: D, back: D.map((row) => row[0]), stops, start: 463, returnTo: true };
  const r = optimize(ctx);
  assert.equal(r.late, 0);
  // Toda la espera que quede tiene que ser en la última parada (la que no abre hasta las 11): esa no hay
  // orden que la evite. Parado a media ruta, con entregas por hacer, ninguna.
  const esperaEnMedio = r.legs.slice(0, -1).reduce((s, l) => s + l.wait, 0);
  assert.equal(esperaEnMedio, 0, `${esperaEnMedio} min parado a media ruta, orden ${r.order}`);
  // Y el día no puede alargarse por esto: la vuelta sigue marcada por la parada 8.
  assert.ok(r.end <= 705, `vuelta ${r.end}`);
});

test('esperar parado cuesta más que conducir, pero la vuelta pronto manda sobre las dos', () => {
  // Dos paradas iguales sin ventana: no hay espera posible y gana la ruta corta (nada cambia respecto a antes).
  const D = [[0, 10, 20], [10, 0, 12], [20, 12, 0]];
  const stops = [{ windows: [], service: 10 }, { windows: [], service: 10 }];
  const r = optimize({ matrix: D, back: D.map((row) => row[0]), stops, start: 450, returnTo: true });
  assert.deepEqual(r.order, [1, 2]);
  assert.equal(r.wait, 0);
});
