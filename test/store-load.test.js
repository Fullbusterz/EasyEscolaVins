import test from 'node:test';
import assert from 'node:assert/strict';

// Este archivo arranca con datos ya guardados (cada archivo de test va en su propio proceso).
const mem = new Map([['ruta-escola-v1', JSON.stringify({
  settings: { shiftStart: '08:00', orsKey: 'claveORS', tomtomKey: 'claveTomTom' },
  clients: {
    paco: { name: 'Vinos Paco', address: 'C/ Major 12', lat: 41.38, lon: 2.05, windows: [[540, 690]], visits: 4, updatedAt: 1 },
    evil: { name: 'Evil', visits: '<img src=x onerror=alert(1)>', service: '"><img src=x>', windows: 'abc' },
  },
  routes: { '2099-01-01': { date: '2099-01-01', stops: [{ id: 'a', name: 'Vinos Paco' }], status: 'draft', pairs: { 'a>b': { m: 3, src: 'ors' } } } },
})]]);
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import('../js/store.js');

test('al abrir la app conserva los datos guardados y sanea lo raro', () => {
  assert.equal(store.settings().shiftStart, '08:00');
  assert.equal(store.findClient('vinos paco').visits, 4);
  assert.deepEqual(store.findClient('vinos paco').windows, [[540, 690]]);
  assert.equal(store.findClient('evil').visits, 0);
  assert.equal(store.findClient('evil').service, 12);
  assert.equal(store.route('2099-01-01').stops.length, 1);
  assert.equal([...mem.keys()].some((k) => k.includes('dañado')), false);
});

test('las claves de openrouteservice y TomTom y sus tiempos guardados se van al pasar a Google', () => {
  assert.equal(store.settings().orsKey, undefined);
  assert.equal(store.settings().tomtomKey, undefined);
  assert.equal(store.settings().googleKey, '');
  assert.deepEqual(store.route('2099-01-01').pairs, {});
});
