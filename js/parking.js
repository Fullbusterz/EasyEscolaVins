// Aparcar una vez y repartir andando.
// El conductor elige en el mapa qué entregas hace desde un mismo sitio; aquí se busca dónde dejar la furgoneta
// (una zona de carga y descarga si la hay a mano) y se calcula lo que supone. Se cuenta ida y vuelta a la
// furgoneta por cada pedido, que es como se lleva la mercancía con la carretilla.
// Zonas DUM: Ajuntament de Barcelona, Open Data BCN, «Zones de càrrega i descàrrega» (CC BY 4.0).

import { haversineKm } from './geo.js';
import { serviceStart } from './solver.js';

export const BLOCK_M = 133; // una manzana del Eixample (113 m) más la calle
export const WALK_M_MIN = 70; // a pie con la carretilla, unos 4,2 km/h
const DETOUR = 1.25; // por las calles se anda algo más que en línea recta
export const DUM_MINUTES = 30; // lo máximo que deja SPRO en una zona DUM
const REACH_M = 800; // zonas más lejos que esto de alguna entrega no se proponen (unas 6 manzanas)
const SAME_SPOT_M = 50; // «otro sitio» tiene que estar a más de esto de los ya descartados
const SNAP_M = 30; // al mover la P a mano, si cae junto a una zona DUM se toma esa zona

export const TROLLEY_BOXES = 8; // cajas por viaje con la carretilla (6 botellas sueltas cuentan como una caja)

export const walkM = (a, b) => haversineKm(a, b) * 1000 * DETOUR;
// Viajes de la furgoneta al local: un pedido grande son varios, y por eso pesa más al elegir dónde aparcar.
export const trips = (s) => (s.load ? Math.max(1, Math.ceil((s.load.boxes + s.load.loose / 6) / TROLLEY_BOXES)) : 1);
export const walkMin = (a, b) => walkM(a, b) / WALK_M_MIN;
export const groupKey = (ids) => [...ids].sort().join('+');

// Punto que hace mínima la suma de distancias a todas, cada una por su peso (mediana geométrica, Weiszfeld).
export function medianPoint(points, weight = () => 1) {
  const W = points.reduce((s, q) => s + weight(q), 0);
  let p = { lat: points.reduce((s, q) => s + q.lat * weight(q), 0) / W, lon: points.reduce((s, q) => s + q.lon * weight(q), 0) / W };
  for (let k = 0; k < 60; k++) {
    let wsum = 0, lat = 0, lon = 0;
    for (const q of points) {
      const d = Math.max(haversineKm(p, q), 1e-6) / weight(q);
      wsum += 1 / d; lat += q.lat / d; lon += q.lon / d;
    }
    const next = { lat: lat / wsum, lon: lon / wsum };
    if (haversineKm(p, next) < 1e-5) return next;
    p = next;
  }
  return p;
}

/**
 * Sitios para aparcar a un grupo, del mejor al peor: zonas DUM a mano de todas, ordenadas por lo que se anda
 * en total contando los viajes de cada pedido (así queda más cerca del pedido grande). Si no hay ninguna (fuera de
 * Barcelona), el punto medio, también pesado por los viajes. Los descartados no vuelven a salir, ni otro
 * pegado a ellos. zones: [[lat, lon, "calle, número"], …].
 */
export function spotsFor(members, zones, rejected = []) {
  const center = medianPoint(members, trips);
  const dLat = (REACH_M / 1000) / 111.2, dLon = dLat / Math.cos(center.lat * Math.PI / 180);
  const near = [];
  for (const [lat, lon, label] of zones) {
    if (Math.abs(lat - center.lat) > dLat || Math.abs(lon - center.lon) > dLon) continue;
    const z = { lat, lon, label, dum: true };
    if (members.every((s) => walkM(z, s) <= REACH_M)) near.push({ ...z, cost: members.reduce((sum, s) => sum + walkM(z, s) * trips(s), 0) });
  }
  near.sort((a, b) => a.cost - b.cost);
  const apart = (z, list) => !list.some((p) => haversineKm(p, z) * 1000 < SAME_SPOT_M);
  const out = [];
  for (const z of near) if (apart(z, rejected) && apart(z, out)) out.push(z);
  if (!out.length && apart(center, rejected)) out.push({ lat: center.lat, lon: center.lon, label: '', dum: false });
  return out.map(({ cost, ...z }) => z);
}

// Un punto puesto a mano: si cae junto a una zona DUM, es esa zona.
export function spotAt(p, zones) {
  let best = null, bestM = SNAP_M;
  for (const [lat, lon, label] of zones) {
    const m = haversineKm(p, { lat, lon }) * 1000;
    if (m < bestM) { best = { lat, lon, label, dum: true }; bestM = m; }
  }
  return best || { lat: p.lat, lon: p.lon, label: '', dum: false };
}

/**
 * Lo que supone hacer el grupo desde ese sitio, en el orden de la ruta: minutos con la furgoneta aparcada y qué
 * entregas pasarían a llegar tarde. legs: Map id → tramo del plan (si no hay plan, null).
 * Si la primera aún no ha abierto, se aparca (y se valida SPRO) justo a tiempo: esa espera no cuenta.
 */
export function parkedTime(members, spot, legs) {
  const first = legs?.get(members[0].id);
  if (!first) return null;
  let t = first.arrive, start = null;
  const late = [];
  for (const s of members) {
    const walk = walkMin(spot, s);
    const { begin, lateBy } = serviceStart(t + walk, s.windows);
    if (lateBy > 0.5 && !(legs.get(s.id)?.late > 0.5)) late.push(s.id);
    if (start == null) start = begin - walk;
    t = begin + (s.service ?? 10) + walk + 2 * walk * (trips(s) - 1);
  }
  return { minutes: t - start, late };
}

// Para el optimizador: a qué aparcamiento va cada parada y cuánto se anda de la furgoneta a ella.
// parking: [{ids, lat, lon}]. Devuelve { group: índice o -1, walk: minutos, extra: viajes de más, ida y vuelta }.
export function walkPlan(stops, parking) {
  const at = new Map();
  parking.forEach((p, g) => p.ids.forEach((id) => at.set(id, g)));
  return stops.map((s) => {
    const g = at.has(s.id) ? at.get(s.id) : -1;
    const walk = g < 0 ? 0 : walkMin(parking[g], s);
    return { group: g, walk, extra: 2 * walk * (trips(s) - 1) };
  });
}
