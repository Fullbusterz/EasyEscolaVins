// Lo que se tarda en una entrega. Hay dos maneras de saberlo, y la primera manda:
//
//   lo que dices tú   Cada local es un mundo: en uno aparcas delante y en 10 minutos estás fuera, y en otro
//                     das tres vueltas para aparcar y subes en montacargas. Eso no hay cuenta que lo adivine,
//                     así que la app te lo pregunta por parada («told»): tus minutos son el total de la parada
//                     —aparcar, entrar, entregar y los viajes con la carretilla— y sustituyen a lo de abajo.
//
//   lo que calcula    Mientras no digas nada, tres partes:
//     descarga  Lo fijo de ese cliente una vez has aparcado: entrar, encontrar a quien firma, el albarán, salir.
//               12 minutos por defecto (medido con un pedido de una caja); se ajusta por cliente en su ficha.
//     aparcar   Lo que cuesta encontrar sitio justo ahí. Varía demasiado de un sitio a otro para calcularlo
//               (en el Eixample a media mañana no es lo mismo que en un polígono), así que se pone a mano por
//               cliente y por defecto es 0: no se inventa tiempo que no se sabe.
//     viajes    En la carretilla caben 12 cajas, y 12 botellas sueltas cuentan como una caja. Cada viaje de más
//               son 10 minutos: volver a la furgoneta, cargarla, llevarla y descargarla.
//
// El paseo de la furgoneta al local cuando se aparca una vez para varias entregas NO entra aquí: lo pone
// walkPlan() en planner.js, que sabe dónde está aparcada. Los 10 minutos del viaje suponen la furgoneta al
// lado, así que para un grupo con la furgoneta a dos manzanas se suman las dos cosas.

import { trips } from './parking.js';
import { bigOrder } from './portal.js';

export const TRIP_MIN = 10; // cada viaje de más con la carretilla
export const DEFAULT_SERVICE = 12; // descarga de un pedido de una caja, una vez aparcado
export const DEFAULT_PARK = 0; // lo que cuesta aparcar ahí: se pone por cliente
export const TOLD_MIN = 1, TOLD_MAX = 180; // lo que puede decir el repartidor, en minutos
// Los tiempos que ofrece la app cuando pregunta. El de en medio es lo normal; los de los extremos son
// el local donde aparcas delante y el que es un infierno.
export const TOLD_CHOICES = [5, 10, 15, 20, 30, 45, 60];

/** Los minutos que ha dicho el repartidor para esta parada, o null si no ha dicho nada. */
export const toldOf = (stop) => {
  const v = stop?.told;
  return Number.isFinite(v) && v >= TOLD_MIN && v <= TOLD_MAX ? Math.round(v) : null;
};

/** Minutos de la parada: lo que has dicho tú, o la descarga del cliente + aparcar + los viajes de más. */
export function serviceFor(stop, def = {}) {
  const { unload, park, tripsMin } = stopParts(stop, def);
  return unload + park + tripsMin;
}

/**
 * Lo mismo, en trozos, para quien necesite tratarlos por separado. El planificador lo necesita porque
 * aparcar se paga una vez por sitio: si dejas la furgoneta y haces tres entregas andando, son tres
 * descargas pero un solo aparcamiento, y cobrárselo a las tres sería contarlo tres veces.
 *
 * Cuando lo has dicho tú, tus minutos son el total: lo de aparcar ya va dentro (no se suma otra vez) y de
 * los viajes de la carretilla se queda lo que sobra para la descarga, así que la suma es exactamente lo
 * que has dicho (con un mínimo de 1 min de descarga si dices menos de lo que duran los viajes).
 */
export function stopParts(stop, def = {}) {
  const tripsMin = extraTrips(stop) * TRIP_MIN;
  const told = toldOf(stop);
  if (told != null) return { unload: Math.max(1, told - tripsMin), park: 0, tripsMin, told };
  return {
    unload: stop?.service ?? def.service ?? DEFAULT_SERVICE,
    park: stop?.park ?? def.park ?? DEFAULT_PARK,
    tripsMin,
    told: null,
  };
}

/** Viajes con la carretilla por encima del primero (0 si el pedido cabe en uno, o si no se sabe qué lleva). */
export const extraTrips = (stop) => Math.max(0, trips(stop || {}) - 1);

// ---------- ¿Por cuáles merece la pena preguntar? ----------

// Preguntar por las 25 paradas de un día es una hoja interminable, y en la mayoría no hace falta: la app ya
// ha medido allí lo que cuesta otras veces y el pedido de hoy es el de siempre. Su número baila de verdad
// en dos sitios: el local donde nunca ha medido nada, y el día en que el pedido se sale de lo normal
// (porque entonces lo de otras veces ya no sirve). Por esas pregunta de entrada; por el resto, solo si se
// lo pides.

/**
 * Por qué vale la pena preguntar cuánto se tarda en esta parada, en frases para leer de corrido.
 * Vacío = no hace falta molestar: o ya lo has dicho, o la app tiene un tiempo medido allí y el pedido de
 * hoy es normal. `mem` es lo que hay guardado de ese cliente (store.findClient), o null si no hay nada.
 */
export function toldWhy(stop, mem) {
  if (toldOf(stop) != null) return [];
  const why = [];
  if (!(mem?.serviceLearned || mem?.parkLearned)) why.push('nunca lo he medido aquí');
  if (bigOrder(stop?.load)) why.push('hoy el pedido es grande');
  else if (extraTrips(stop) > 0) why.push('hoy no cabe en un viaje de carretilla');
  return why;
}

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
  const { park, tripsMin } = stopParts(stop, def);
  return minutes - tripsMin - park;
}
