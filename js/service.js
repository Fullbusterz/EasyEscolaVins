// Lo que se tarda en una entrega. Antes eran 10 minutos fijos para todo el mundo, lo mismo 1 caja que 25,
// así que los pedidos grandes salían siempre cortos. Ahora son tres partes:
//
//   descarga  Lo fijo de ese cliente una vez has aparcado: entrar, encontrar a quien firma, el albarán, salir.
//             12 minutos por defecto (medido con un pedido de una caja); se ajusta por cliente en su ficha.
//   aparcar   Lo que cuesta encontrar sitio justo ahí. Varía demasiado de un sitio a otro para calcularlo
//             (en el Eixample a media mañana no es lo mismo que en un polígono), así que se pone a mano por
//             cliente y por defecto es 0: no se inventa tiempo que no se sabe.
//   viajes    En la carretilla caben 12 cajas, y 12 botellas sueltas cuentan como una caja. Cada viaje de más
//             son 10 minutos: volver a la furgoneta, cargarla, llevarla y descargarla.
//
// El paseo de la furgoneta al local cuando se aparca una vez para varias entregas NO entra aquí: lo pone
// walkPlan() en planner.js, que sabe dónde está aparcada. Los 10 minutos del viaje suponen la furgoneta al
// lado, así que para un grupo con la furgoneta a dos manzanas se suman las dos cosas.

import { trips } from './parking.js';

export const TRIP_MIN = 10; // cada viaje de más con la carretilla
export const DEFAULT_SERVICE = 12; // descarga de un pedido de una caja, una vez aparcado
export const DEFAULT_PARK = 0; // lo que cuesta aparcar ahí: se pone por cliente

/** Minutos de la parada: descarga del cliente + aparcar + los viajes de más con la carretilla. */
export function serviceFor(stop, def = {}) {
  const unload = stop?.service ?? def.service ?? DEFAULT_SERVICE;
  const park = stop?.park ?? def.park ?? DEFAULT_PARK;
  return unload + park + extraTrips(stop) * TRIP_MIN;
}

/** Viajes con la carretilla por encima del primero (0 si el pedido cabe en uno, o si no se sabe qué lleva). */
export const extraTrips = (stop) => Math.max(0, trips(stop || {}) - 1);

/**
 * Al revés, para aprender: de lo que ha tardado de verdad en una entrega, lo que es tiempo fijo del cliente.
 * Se le quitan los viajes de más y lo de aparcar, que ya se cuentan aparte, y así la mediana que se guarda
 * vale igual el día que le lleva 2 cajas que el día que le lleva 20.
 */
export function unloadFrom(minutes, stop, def = {}) {
  const park = stop?.park ?? def.park ?? DEFAULT_PARK;
  return minutes - extraTrips(stop) * TRIP_MIN - park;
}
