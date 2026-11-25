// Une los tiempos de Google con el optimizador.
//
// Pedir a Google todos los pares de 25 paradas son 676 tiempos en cada cálculo, y se pagan uno a uno. Pero
// una buena ruta casi nunca salta de una punta a la otra: va de una parada a alguna de sus vecinas. Así que
// se piden solo los pares entre cada parada y sus vecinas más cercanas (y la salida a todas); los demás se
// estiman con la línea recta y los minutos por kilómetro que Google acaba de dar para esa zona. Luego la
// consulta con tráfico de la ruta elegida pone los tiempos de verdad en los tramos que se van a hacer.
//
// Los pares se reutilizan en cada «Siguiente» y al añadir una parada solo se piden los suyos. Viven en
// memoria (app.js): las condiciones de Google no dejan guardarlos en el móvil.

import { googleMatrix, trafficLegs, haversineKm, trafficFactor, estimate, calibrate, guess, sameSpot, netWarning } from './geo.js';
import { optimize, evaluate } from './solver.js';
import { walkPlan, walkMin } from './parking.js';

// La clave incluye la ubicación: si una parada o el almacén se mueven, sus tiempos guardados dejan de valer.
const nodeKey = (p, id) => `${id}@${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
const pairKey = (a, b) => `${a}>${b}`;

// Con pocas paradas se piden todos los pares (son pocos); con más, cada parada con sus vecinas.
export const FULL_UP_TO = 8;
export const NEIGHBORS = 6;
// Desde donde estás (en ruta), a cuántas de las paradas pendientes más cercanas se pregunta.
export const FROM_NEAREST = 8;

// Índices de `list` más cercanos a p (en línea recta), sin contar `skip`.
const nearest = (p, list, k, skip = -1) => list.map((q, idx) => ({ idx, d: haversineKm(p, q) }))
  .filter((x) => x.idx !== skip).sort((a, b) => a.d - b.d).slice(0, k).map((x) => x.idx);

/**
 * Qué pares (índices de nodo: 1..n paradas, n+1 almacén) merece la pena pedir a Google entre las paradas.
 * Todos con todos hasta FULL_UP_TO paradas; con más, cada parada con sus NEIGHBORS más cercanas, en los dos
 * sentidos. Devuelve una lista de [i, j].
 */
export function wantedPairs(stops, { full = FULL_UP_TO, k = NEIGHBORS, returnToDepot = true } = {}) {
  const n = stops.length;
  const out = new Map();
  const add = (i, j) => { if (i !== j) out.set(`${i},${j}`, [i, j]); };
  if (n <= full) {
    for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) add(i, j);
    if (returnToDepot) for (let i = 1; i <= n; i++) add(i, n + 1);
  } else {
    stops.forEach((s, a) => {
      for (const b of nearest(s, stops, k, a)) { add(a + 1, b + 1); add(b + 1, a + 1); }
    });
  }
  return [...out.values()];
}

/**
 * from: {lat, lon} punto de salida. stops: [{id, lat, lon, windows:[[a,b]], service}].
 * startMin: minuto del día en que se sale. departAt: Date de salida (para el tráfico).
 * key: clave de Google. Sin ella se estima por distancia. live: tráfico de ahora (si no, el previsto).
 * pairs: tiempos entre paradas ya pedidos ({ "idA@lat,lon>idB@lat,lon": { m, km, at, src } }), en memoria.
 * maxAgeMin: antigüedad máxima de esos tiempos para reutilizarlos.
 * parking: aparcamientos aceptados [{ids, lat, lon}]: entre paradas del mismo se va a pie pasando por la furgoneta.
 * parkedAt: índice del aparcamiento donde está ahora la furgoneta (si se sale andando desde from).
 * fixedOrder: ids en el orden que ha puesto el repartidor. Se respeta y solo se calculan las horas; las paradas
 * que no estén (añadidas después) van al final y los ids que ya no existen se ignoran.
 */
export async function computePlan({ from, stops, depot, startMin, departAt, key, live, pairs = {}, maxAgeMin = 90, returnToDepot = true, parking = [], parkedAt = null, fixedOrder = null }) {
  if (stops.length === 0) return { order: [], legs: [], end: startMin, late: 0, wait: 0, km: 0, pairs: {} };
  const n = stops.length;
  const depart = departAt instanceof Date ? departAt : new Date();
  const now = Date.now();
  // Nodos: 0 = salida, 1..n = paradas, n+1 = almacén.
  const fromIsDepot = sameSpot(from, depot);
  const keys = [fromIsDepot ? nodeKey(depot, 'depot') : null, ...stops.map((s) => nodeKey(s, s.id)), nodeKey(depot, 'depot')];
  const point = (i) => (i === 0 ? from : i === n + 1 ? depot : stops[i - 1]);
  const limit = now - maxAgeMin * 60000;
  const fresh = (k) => { const p = pairs[k]; return p && p.src === 'google' && p.at >= limit ? p : null; };

  // Lo que ya se sabe (de antes o de ahora) y lo que hay que pedir.
  const known = new Map(); // "i,j" -> { m, km }
  const next = {}; // pares que se quedan en memoria para el próximo cálculo
  let warning, source = 'estimate';
  if (key) {
    const want = wantedPairs(stops, { returnToDepot });
    // Salida: desde el almacén se piden todas (y se guardan); desde otro sitio, las más cercanas y no se guardan.
    const fromRow = fromIsDepot ? stops.map((_, i) => [0, i + 1])
      : nearest(from, stops, n <= FULL_UP_TO ? n : FROM_NEAREST).map((i) => [0, i + 1]);
    const missing = [];
    for (const [i, j] of [...fromRow, ...want]) {
      const k = keys[i] && pairKey(keys[i], keys[j]);
      const hit = k && fresh(k);
      if (hit) { known.set(`${i},${j}`, hit); next[k] = hit; } else missing.push([i, j]);
    }
    try {
      if (missing.length) {
        const pts = Array.from({ length: n + 2 }, (_, i) => point(i));
        const got = await googleMatrix(pts, pts, { key, departAt: depart, cells: missing });
        for (const x of got) {
          const v = { m: x.min, km: x.km, at: now, src: 'google' };
          known.set(`${x.i},${x.j}`, v);
          if (keys[x.i]) next[pairKey(keys[x.i], keys[x.j])] = v;
        }
      }
      source = 'google';
    } catch (e) {
      warning = netWarning(e);
    }
  }

  // Minutos por kilómetro en línea recta según Google, para estimar los pares que no se han pedido.
  const perKm = calibrate([...known.entries()].map(([ij, v]) => {
    const [i, j] = ij.split(',').map(Number);
    return { min: v.m, km: haversineKm(point(i), point(j)) };
  }));
  const f = trafficFactor(depart);
  const minutes = (i, j) => {
    if (i === j) return { m: 0, km: 0 };
    const hit = known.get(`${i},${j}`);
    if (hit) return hit;
    // De una parada al almacén: lo mismo que del almacén a ella, si se sabe (casi siempre es la misma vía).
    if (j === n + 1 && known.has(`0,${i}`) && fromIsDepot) return known.get(`0,${i}`);
    const a = point(i), b = point(j);
    return { m: perKm ? guess(a, b, perKm) : sameSpot(a, b) ? 0 : estimate(a, b) * f, km: haversineKm(a, b) * 1.4 };
  };

  // A pie: dentro de un aparcamiento, de la entrega a la furgoneta y de ahí a la siguiente (sin coche);
  // para llegar a él o salir de él, el coche más el paseo entre la furgoneta y la entrega.
  const wp = walkPlan(stops, parking);
  // Cuántas entregas comparten el aparcamiento de la parada i (1 si va por su cuenta).
  const groupSize = (i) => (wp[i].group < 0 ? 1 : Math.max(1, wp.filter((w) => w.group === wp[i].group).length));
  const fromG = parkedAt != null && parking[parkedAt] ? parkedAt : -1;
  const fromWalk = fromG >= 0 ? walkMin(from, parking[fromG]) : 0;
  const node = (i) => (i === 0 ? { group: fromG, walk: fromWalk } : i === n + 1 ? { group: -1, walk: 0 } : wp[i - 1]);
  const onFoot = (i, j) => { const a = node(i), b = node(j); return a.group >= 0 && a.group === b.group; };
  const walkOf = (i, j) => node(i).walk + node(j).walk;
  const travel = (i, j, car) => (onFoot(i, j) ? walkOf(i, j) : car + walkOf(i, j));

  const matrix = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (j === 0 ? 0 : i === j ? 0 : travel(i, j, minutes(i, j).m))));
  const back = Array.from({ length: n + 1 }, (_, i) => travel(i, n + 1, minutes(i, n + 1).m));

  const ctx = {
    matrix,
    back,
    start: startMin,
    returnTo: returnToDepot,
    // El cliente tiene que poder recibir el pedido entero antes de cerrar, no solo verte llegar: una descarga de
    // 25 cajas que empieza 4 minutos antes de la hora de cierre acaba media hora después de que hayan cerrado.
    // Por eso se planifica con la ventana recortada por lo que dura la descarga (ver fitService).
    stops: stops.map((s, i) => {
      // Aparcar se paga una vez por sitio, no por entrega: si dejas la furgoneta y haces tres entregas
      // andando desde ahí, son tres descargas y un solo aparcamiento. Se reparte entre las del grupo para
      // que la suma salga bien sea cual sea el orden en que el optimizador las acabe poniendo.
      const service = (s.service ?? 12) + (s.park ?? 0) / groupSize(i) + wp[i].extra;
      return { windows: fitService(s.windows || [], service), service };
    }),
  };
  let fixed = null;
  if (Array.isArray(fixedOrder)) {
    const pos = new Map(stops.map((s, i) => [s.id, i + 1]));
    const listed = [...new Set(fixedOrder)].filter((id) => pos.has(id)).map((id) => pos.get(id));
    fixed = [...listed, ...stops.map((_, i) => i + 1).filter((i) => !listed.includes(i))];
  }
  const solve = () => (fixed ? evaluateOrder(fixed, ctx) : optimize(ctx));
  let best = solve();

  // Con Google: se piden los tiempos con tráfico de la ruta elegida (una consulta), se corrigen esos tramos
  // y se vuelve a optimizar; si el orden cambia, se comprueba también el nuevo (máximo 3 consultas).
  // Si la matriz ya ha fallado (sin conexión, clave mala), no se insiste.
  let traffic = false;
  if (key && !warning) {
    const seen = new Set();
    for (let round = 0; round < 3; round++) {
      const order = best.order.join(',');
      if (seen.has(order)) break;
      seen.add(order);
      const nodes = [0, ...best.order, ...(returnToDepot ? [n + 1] : [])];
      let legsMin = null;
      try { legsMin = await trafficLegs(nodes.map(point), { key, departAt: depart, live }); } catch (e) { warning = e.message; break; }
      if (!legsMin) break;
      traffic = true;
      legsMin.forEach((m, k) => {
        const a = nodes[k], b = nodes[k + 1];
        if (onFoot(a, b)) return; // ese tramo se hace andando: el tráfico no cuenta
        if (b === n + 1) back[a] = travel(a, b, m); else matrix[a][b] = travel(a, b, m);
      });
      const again = solve();
      best = again.order.join(',') === order ? evaluateOrder(best.order, ctx) : again;
    }
  }

  let km = 0, prev = 0;
  const legs = best.legs.map((leg) => {
    const foot = onFoot(prev, leg.node);
    const d = foot ? { km: 0 } : minutes(prev, leg.node);
    const walk = walkOf(prev, leg.node);
    km += d.km || 0;
    prev = leg.node;
    return { id: stops[leg.node - 1].id, arrive: leg.arrive, begin: leg.begin, wait: leg.wait, late: leg.late, drive: leg.drive, walk, foot, km: d.km };
  });
  if (returnToDepot && legs.length) km += minutes(prev, n + 1).km || 0;

  return {
    order: legs.map((l) => l.id),
    legs,
    end: best.end,
    late: best.late,
    wait: best.wait,
    km,
    source: traffic ? 'traffic' : source,
    warning,
    live: traffic && !!live,
    computedAt: now,
    startMin,
    pairs: next,
  };
}

// Ventanas recortadas por lo que se tarda en descargar: hay que llegar con tiempo de acabar antes de que cierren.
// Si la descarga no cabe entera en la franja, se deja un hueco mínimo para no declararla imposible (el
// optimizador la pondría «tarde» pase lo que pase y dejaría de ordenarla con criterio).
const MIN_FIT = 10;
export function fitService(windows, service) {
  return (windows || []).map(([open, close]) => [open, Math.max(open + MIN_FIT, close - (service || 0))])
    .filter(([open, close]) => close >= open);
}

function evaluateOrder(order, ctx) {
  return { order, ...evaluate(order, ctx) };
}
