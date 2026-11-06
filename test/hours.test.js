import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWindows, lateOk } from '../js/hours.js';

const h = (t) => { const [a, b = '0'] = t.split(':'); return +a * 60 + +b; };
const W = (...ws) => ws.map(([a, b]) => [h(a), h(b)]);

test('de tarde se da una hora de margen; de mañana, media hora', () => {
  assert.equal(lateOk(h('11')), 30);
  assert.equal(lateOk(h('12')), 60); // «hasta las 12» ya cuenta como mediodía: a la 13 no pasa nada
  assert.deepEqual(planWindows(W(['9', '12'])), W(['9', '13']));
  assert.deepEqual(planWindows(W(['8', '10'])), W(['8', '10:30']));
  assert.deepEqual(planWindows(W(['9', '12'], ['19', '20'])), W(['9', '13'], ['19', '21']));
});

test('la hora de apertura no se adelanta', () => {
  assert.equal(planWindows(W(['16', '18']))[0][0], h('16'));
});

test('estricto: sin margen y 10 min antes de que cierre; flexible: media hora más', () => {
  assert.deepEqual(planWindows(W(['9', '12']), 'strict'), W(['9', '11:50']));
  assert.deepEqual(planWindows(W(['9', '12']), 'flex'), W(['9', '13:30']));
  assert.deepEqual(planWindows(W(['8', '10']), 'flex'), W(['8', '11']));
});

test('nunca pasa de medianoche y sin horario sigue sin horario', () => {
  assert.deepEqual(planWindows(W(['20', '23:30'])), [[h('20'), 23 * 60 + 59]]);
  assert.deepEqual(planWindows([]), []);
  assert.deepEqual(planWindows(undefined), []);
});

test('horario de tarde sospechoso: todas las franjas empiezan después de las 13:00', async () => {
  const { oddHours, ODD_WINDOWS } = await import('../js/hours.js');
  assert.equal(oddHours(W(['16', '18'])), true);
  assert.equal(oddHours(W(['18', '21'])), true);
  assert.equal(oddHours(W(['13', '15'])), false); // a las 13 justas todavía es mediodía
  assert.equal(oddHours(W(['9', '12'], ['19', '20'])), false); // tiene franja de mañana
  assert.equal(oddHours([]), false);
  assert.deepEqual(ODD_WINDOWS, [[h('10'), 23 * 60 + 59]]);
});
