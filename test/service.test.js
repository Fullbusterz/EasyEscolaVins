import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceFor, unloadFrom, extraTrips, TRIP_MIN, DEFAULT_SERVICE } from '../js/service.js';
import { TROLLEY_BOXES, LOOSE_PER_BOX } from '../js/parking.js';

const stop = (boxes, loose = 0, rest = {}) => ({ load: { boxes, loose, bottles: boxes * 6 + loose }, ...rest });

test('el tiempo de una entrega sale del pedido, no es fijo', () => {
  // Antes eran 10 min para todo el mundo: 1 caja y 25 cajas valían lo mismo.
  assert.equal(serviceFor(stop(1)), DEFAULT_SERVICE);
  assert.equal(serviceFor(stop(TROLLEY_BOXES)), DEFAULT_SERVICE); // la carretilla justa: sigue siendo un viaje
  assert.equal(serviceFor(stop(TROLLEY_BOXES + 1)), DEFAULT_SERVICE + TRIP_MIN);
  assert.equal(serviceFor(stop(25)), DEFAULT_SERVICE + 2 * TRIP_MIN); // 3 viajes: 12 + 20 = 32 min
  // Sin datos del pedido (parada a mano) no se inventa nada: el tiempo de siempre.
  assert.equal(serviceFor({}), DEFAULT_SERVICE);
  assert.equal(serviceFor({ load: null }), DEFAULT_SERVICE);
});

test('las botellas sueltas ocupan sitio en la carretilla', () => {
  assert.equal(extraTrips(stop(0, LOOSE_PER_BOX * TROLLEY_BOXES)), 0); // justo un viaje
  assert.equal(extraTrips(stop(0, LOOSE_PER_BOX * TROLLEY_BOXES + 1)), 1);
  assert.equal(extraTrips(stop(TROLLEY_BOXES, LOOSE_PER_BOX)), 1); // la carretilla llena más una caja suelta
  // 10 cajas + 24 sueltas son 12 cajas de sitio: cabe en un viaje
  assert.equal(extraTrips(stop(10, 24)), 0);
});

test('la descarga del cliente y lo de aparcar se suman al pedido', () => {
  assert.equal(serviceFor(stop(1, 0, { service: 20 })), 20);
  assert.equal(serviceFor(stop(1, 0, { park: 7 })), DEFAULT_SERVICE + 7);
  assert.equal(serviceFor(stop(25, 0, { service: 15, park: 5 })), 15 + 5 + 2 * TRIP_MIN);
  // Los valores por defecto de Ajustes se usan cuando el cliente no tiene los suyos
  assert.equal(serviceFor(stop(1), { service: 9, park: 4 }), 13);
  assert.equal(serviceFor(stop(1, 0, { service: 20 }), { service: 9 }), 20);
});

test('al aprender se guarda solo la parte fija, no el pedido de ese día', () => {
  // Un día de 25 cajas se tarda 32 min, pero el tiempo fijo del cliente siguen siendo 12.
  assert.equal(unloadFrom(32, stop(25)), 12);
  assert.equal(unloadFrom(12, stop(1)), 12);
  // Y lo de aparcar tampoco engorda la media: ya se cuenta aparte.
  assert.equal(unloadFrom(20, stop(1, 0, { park: 8 })), 12);
  // Es la vuelta exacta de serviceFor: lo que se mide es lo que se vuelve a predecir.
  for (const s of [stop(1), stop(25), stop(13, 0, { park: 5 }), stop(0, 200, { service: 18 })]) {
    assert.equal(unloadFrom(serviceFor(s), s), s.service ?? DEFAULT_SERVICE);
  }
});
