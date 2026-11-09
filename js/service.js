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
  const { unload, park, tripsMin } = stopParts(stop, def);
  return unload + park + tripsMin;
}

/**
 * Lo mismo, en trozos, para quien necesite tratarlos por separado. El planificador lo necesita porque
 * aparcar se paga una vez por sitio: si dejas la furgoneta y haces tres entregas andando, son tres
 * descargas pero un solo aparcamiento, y cobrárselo a las tres sería contarlo tres veces.
 */
export function stopParts(stop, def = {}) {
  return {
    unload: stop?.service ?? def.service ?? DEFAULT_SERVICE,
    park: stop?.park ?? def.park ?? DEFAULT_PARK,
    tripsMin: extraTrips(stop) * TRIP_MIN,
  };
}

/** Viajes con la carretilla por encima del primero (0 si el pedido cabe en uno, o si no se sabe qué lleva). */
export const extraTrips = (stop) => Math.max(0, trips(stop || {}) - 1);

// ---------- Aprender de lo que ha pasado de verdad ----------

// Dos metros de GPS en el Eixample bailan bastante; por debajo de esto se da por hecho que la furgoneta
// sigue donde estaba y que la entrega se ha hecho andando desde el mismo sitio.
export const MOVED_M = 60;

const sane = (v, lo, hi) => (v != null && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const mins = (a, b) => (a > 0 && b > a ? (b - a) / 60000 : null);

/**
 * Lo que de verdad ha costado una entrega, repartido en las dos cosas que se aprenden. Tres momentos:
 *   leftAt    saliste de la parada anterior (o empezaste la ruta)
 *   parkedAt  tocaste «he aparcado» (o validaste SPRO)
 *   doneAt    tocaste «hecha»
 *
 * descarga = (doneAt − parkedAt) menos lo que ya se cuenta aparte: la espera a que abriera, el paseo desde
 * la furgoneta y los viajes de más con la carretilla. Medido, sin previsiones de por medio.
 *
 * aparcar = (parkedAt − leftAt) menos la conducción prevista. Esta sí lleva una previsión dentro, así que
 * es más ruidosa; lo que importa es que su ruido ya no ensucia la descarga, que es lo que pasaba antes.
 * Si no has movido la furgoneta (moved = false) no has aparcado, y no se aprende nada de aparcar.
 *
 * Lo que salga fuera de rango se descarta: si entre dos entregas paras a desayunar, esa muestra no vale.
 * Devuelve { unload, park }, cada uno en minutos o null si esa medida no es de fiar.
 */
export function measure({ leftAt, parkedAt, doneAt, driveEst = 0, waitEst = 0, walkEst = 0, moved = true, stop = {} }) {
  const atStop = mins(parkedAt, doneAt);
  const toStop = mins(leftAt, parkedAt);
  const unload = atStop == null ? null : atStop - waitEst - walkEst - extraTrips(stop) * TRIP_MIN;
  const park = !moved || toStop == null ? null : toStop - driveEst;
  return { unload: sane(unload, 1, 90), park: sane(park, 0, 45) };
}

/**
 * Para cuando no hay toque de «he aparcado»: de lo que ha tardado en total, la parte fija del cliente.
 * Lleva dentro la conducción prevista, así que es la medida mala; se usa solo si no hay otra.
 */
export function unloadFrom(minutes, stop, def = {}) {
  const park = stop?.park ?? def.park ?? DEFAULT_PARK;
  return minutes - extraTrips(stop) * TRIP_MIN - park;
}
