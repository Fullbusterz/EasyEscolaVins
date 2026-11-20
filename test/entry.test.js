import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanEntry, goTo, entryDistanceM, ENTRY_MAX_M } from '../js/entry.js';

const shop = { lat: 41.3800, lon: 2.0900 };
// ~150 m al este: el otro lado de la manzana
const ramp = { lat: 41.3800, lon: 2.0918 };

test('el punto de entrada manda sobre la dirección para ir en furgoneta', () => {
  const x = { ...shop, entry: { ...ramp, note: 'Rampa de mercancías' } };
  assert.deepEqual(goTo(x), ramp);
  assert.deepEqual(goTo({ ...shop }), shop);
  assert.deepEqual(goTo({ ...shop, entry: null }), shop);
});

test('se limpia: solo números, nota corta y sin HTML colado como tipo raro', () => {
  const e = cleanEntry({ lat: ramp.lat, lon: ramp.lon, note: '  Rampa '.padEnd(200, 'x'), evil: 1 }, shop);
  assert.deepEqual(Object.keys(e).sort(), ['lat', 'lon', 'note']);
  assert.equal(e.note.length, 80);
  assert.equal(e.note.startsWith('Rampa'), true);
  assert.equal(cleanEntry({ lat: '41.38', lon: 2.09 }, shop), null);
  assert.equal(cleanEntry({ lat: 91, lon: 2.09 }, shop), null);
  assert.equal(cleanEntry('41.38,2.09', shop), null);
  assert.equal(cleanEntry(null, shop), null);
  assert.equal(cleanEntry({ ...ramp, note: 42 }, shop).note, '42');
});

test('un punto lejos de la dirección no vale: el cliente se ha mudado o es un error', () => {
  assert.ok(entryDistanceM(shop, ramp) > 100 && entryDistanceM(shop, ramp) < 200);
  const far = { lat: shop.lat + 0.01, lon: shop.lon }; // ~1,1 km
  assert.equal(cleanEntry(far, shop), null);
  const edge = { lat: shop.lat + (ENTRY_MAX_M - 20) / 111200, lon: shop.lon };
  assert.ok(cleanEntry(edge, shop));
  // Sin dirección ubicada no hay con qué comparar: no hay punto de entrada.
  assert.equal(cleanEntry(ramp, { lat: null, lon: null }), null);
  // Y goTo tampoco usa uno lejano que se hubiera colado.
  assert.deepEqual(goTo({ ...shop, entry: far }), shop);
});

test('marcarlo encima de la dirección no tiene sentido: se descarta', () => {
  assert.equal(cleanEntry({ lat: shop.lat + 0.00005, lon: shop.lon }, shop), null); // ~5 m
});
