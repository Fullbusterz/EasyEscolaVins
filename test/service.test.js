import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceFor, unloadFrom, extraTrips, measure, TRIP_MIN, DEFAULT_SERVICE } from '../js/service.js';
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

// ---------- Aprender de lo que ha pasado de verdad ----------

const t = (h, m) => new Date(2026, 10, 9, h, m).getTime();

test('con el toque de «he aparcado» se separa llegar y aparcar de la entrega', () => {
  // Sales a las 9:00, aparcas a las 9:20 (se preveían 12 min de viaje) y acabas a las 9:35.
  const r = measure({ leftAt: t(9, 0), parkedAt: t(9, 20), doneAt: t(9, 35), driveEst: 12, stop: stop(1) });
  assert.equal(r.unload, 15); // lo que has tardado en entregar, medido
  assert.equal(r.park, 8); // los 20 de llegar menos los 12 previstos de viaje: buscar sitio
});

test('lo que ya se cuenta aparte no se aprende dos veces', () => {
  // 40 min en la parada, pero 25 cajas (2 viajes de más = 20 min) y 5 andando desde la furgoneta.
  const r = measure({ leftAt: t(9, 0), parkedAt: t(9, 10), doneAt: t(9, 50), driveEst: 10, walkEst: 5, stop: stop(25) });
  assert.equal(r.unload, 15); // 40 − 5 de paseo − 20 de viajes
  // Y la espera a que abriera el cliente tampoco es tiempo de descarga
  const esperando = measure({ leftAt: t(9, 0), parkedAt: t(9, 10), doneAt: t(9, 40), driveEst: 10, waitEst: 18, stop: stop(1) });
  assert.equal(esperando.unload, 12);
});

test('si no has movido la furgoneta no has aparcado, y no se aprende nada de aparcar', () => {
  const r = measure({ leftAt: t(9, 0), parkedAt: t(9, 0), doneAt: t(9, 14), walkEst: 2, moved: false, stop: stop(1) });
  assert.equal(r.unload, 12);
  assert.equal(r.park, null);
});

test('las muestras raras se tiran en vez de aprenderlas', () => {
  // Parada a desayunar entre dos entregas: dos horas de parada no es el tiempo de descarga del cliente.
  assert.equal(measure({ leftAt: t(9, 0), parkedAt: t(9, 10), doneAt: t(11, 10), stop: stop(1) }).unload, null);
  // Un viaje que se preveía mucho más largo de lo que ha sido: aparcar saldría negativo
  assert.equal(measure({ leftAt: t(9, 0), parkedAt: t(9, 5), doneAt: t(9, 20), driveEst: 30, stop: stop(1) }).park, null);
  // Horas que faltan o que van al revés
  assert.deepEqual(measure({ leftAt: t(9, 0), doneAt: t(9, 20), stop: stop(1) }), { unload: null, park: null });
  assert.equal(measure({ leftAt: t(9, 0), parkedAt: t(9, 30), doneAt: t(9, 10), stop: stop(1) }).unload, null);
});
