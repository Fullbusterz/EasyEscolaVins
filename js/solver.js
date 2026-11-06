// Optimizador de ruta con ventanas horarias (TSPTW).
// Tiempos en minutos desde medianoche. Matriz de viaje en minutos.
// Nodo 0 = punto de salida (almacén o posición actual); nodos 1..n = paradas.

const LATE_PENALTY = 1000; // cada minuto tarde pesa como ~17 h de ruta: llegar tarde es lo último
// A igual hora de vuelta, mejor entregar antes que esperar parado a que abra otro: cada minuto que se
// adelanta una entrega vale muy poco (≈330 minutos·parada = 1 minuto de jornada): solo deshace empates.
const EARLY = 0.003;

// Recorre un orden y devuelve horarios, esperas y retrasos.
export function evaluate(order, ctx) {
  const { matrix, stops, start, returnTo } = ctx;
  let t = start;
  let prev = 0;
  let late = 0;
  let wait = 0;
  let early = 0;
  const legs = [];
  for (const i of order) {
    const s = stops[i - 1];
    const arrive = t + matrix[prev][i];
    const { begin, lateBy } = serviceStart(arrive, s.windows);
    wait += begin - arrive;
    early += begin - start;
    late += lateBy;
    legs.push({ node: i, arrive, begin, wait: begin - arrive, late: lateBy, drive: matrix[prev][i] });
    t = begin + (s.service ?? 0);
    prev = i;
  }
  // back[i] = minutos del nodo i al almacén, cuando el punto de salida no es el almacén (p. ej. tras una entrega)
  const back = returnTo !== false && order.length ? (ctx.back ? ctx.back[prev] : matrix[prev][0]) : 0;
  const end = t + back;
  const drive = legs.reduce((s, l) => s + l.drive, 0) + back;
  // Primero no llegar tarde, luego acabar antes; a igual hora de fin, menos conducción, menos esperas
  // parado y entregas más pronto.
  const cost = late * LATE_PENALTY + (end - start) + 0.25 * drive + 0.1 * wait + EARLY * early;
  return { legs, end, late, wait, drive, cost };
}

// Primera ventana en la que se puede atender; si ya han cerrado todas, se atiende al llegar y cuenta el retraso.
export function serviceStart(arrive, windows) {
  if (!windows || windows.length === 0) return { begin: arrive, lateBy: 0 };
  const ws = [...windows].sort((a, b) => a[0] - b[0]);
  for (const [open, close] of ws) {
    if (arrive <= close) return { begin: Math.max(arrive, open), lateBy: 0 };
  }
  const lastClose = ws[ws.length - 1][1];
  return { begin: arrive, lateBy: arrive - lastClose };
}

// ---- Evaluador interno rápido: solo coste, sin objetos ----
// Mismas operaciones y en el mismo orden que evaluate(), así que da exactamente el mismo número.

// Datos en arrays planos: matriz en Float64Array y ventanas ordenadas una sola vez.
function prepare(ctx) {
  const { matrix, stops, start } = ctx;
  const n = stops.length, N = n + 1;
  const M = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) M[i * N + j] = matrix[i][j];
  const sorted = stops.map((s) => (s.windows?.length ? [...s.windows].sort((a, b) => a[0] - b[0]) : []));
  const wOpen = new Float64Array(sorted.reduce((s, w) => s + w.length, 0)), wClose = new Float64Array(wOpen.length);
  const wo = new Int32Array(N + 1), svc = new Float64Array(N), back = new Float64Array(N);
  let q = 0;
  for (let i = 1; i < N; i++) {
    wo[i] = q;
    for (const [o, c] of sorted[i - 1]) { wOpen[q] = o; wClose[q++] = c; }
    svc[i] = stops[i - 1].service ?? 0;
  }
  wo[N] = q;
  const ret = ctx.returnTo !== false;
  for (let i = 0; i < N; i++) back[i] = ret ? (ctx.back ? ctx.back[i] : matrix[i][0]) : 0;
  // con tiempos no negativos el coste parcial es cota inferior del final y se puede podar
  const nonneg = M.every((v) => v >= 0) && svc.every((v) => v >= 0) && back.every((v) => v >= 0);
  return { n, N, M, wo, wOpen, wClose, svc, back, start, nonneg };
}

// Estado de ruta por posición k: hora al acabar la parada k-1 (T[0] = salida) y acumulados de retraso,
// conducción y W = coste blando (0,1·espera + EARLY·minutos desde la salida hasta cada entrega).
const makeState = (n) => ({ T: new Float64Array(n + 1), L: new Float64Array(n + 1), W: new Float64Array(n + 1), D: new Float64Array(n + 1) });

// Coste de o[] reaprovechando el estado S hasta la posición a; escribe el resto en X (puede ser el mismo S).
// Si el coste parcial ya supera limit devuelve Infinity sin acabar (solo válido con tiempos no negativos).
function tail(P, o, a, S, X, limit) {
  const { n, N, M, wo, wOpen, wClose, svc, back, start } = P;
  let t = S.T[a], late = S.L[a], wait = S.W[a], drive = S.D[a], prev = a ? o[a - 1] : 0;
  for (let k = a; k < n; k++) {
    const i = o[k], d = M[prev * N + i], arrive = t + d;
    drive += d;
    let begin = arrive;
    const w1 = wo[i + 1];
    let q = wo[i];
    if (w1 > q) {
      while (q < w1 && arrive > wClose[q]) q++;
      if (q < w1) { if (wOpen[q] > arrive) begin = wOpen[q]; }
      else late += arrive - wClose[w1 - 1];
    }
    wait += 0.1 * (begin - arrive) + EARLY * (begin - start);
    t = begin + svc[i];
    prev = i;
    X.T[k + 1] = t; X.L[k + 1] = late; X.W[k + 1] = wait; X.D[k + 1] = drive;
    if (late * LATE_PENALTY + (t - start) + 0.25 * drive + wait > limit) return Infinity;
  }
  const b = n ? back[prev] : 0;
  return late * LATE_PENALTY + (t + b - start) + 0.25 * (drive + b) + wait;
}

function fullCost(P, o, S) { S.T[0] = P.start; S.L[0] = S.W[0] = S.D[0] = 0; return tail(P, o, 0, S, S, Infinity); }

// Búsqueda exhaustiva en orden lexicográfico (el mismo que el generador de permutaciones de antes),
// con estado incremental por prefijo y poda por cota: mismo resultado, mucho más rápida.
export function bruteForce(ctx) {
  const P = prepare(ctx), n = P.n, N = P.N;
  if (n === 0) return { order: [], ...evaluate([], ctx) };
  const S = makeState(n), o = new Int32Array(n), used = new Uint8Array(N + 1);
  S.T[0] = P.start;
  let best = null, bestC = Infinity;
  const { M, wo, wOpen, wClose, svc, back, start, nonneg } = P;
  const dfs = (k) => {
    const prev = k ? o[k - 1] : 0;
    for (let i = 1; i <= n; i++) {
      if (used[i]) continue;
      // un paso de tail() a mano para no recorrer el prefijo otra vez
      const d = M[prev * N + i], arrive = S.T[k] + d;
      let begin = arrive, late = S.L[k];
      const w1 = wo[i + 1];
      let q = wo[i];
      if (w1 > q) {
        while (q < w1 && arrive > wClose[q]) q++;
        if (q < w1) { if (wOpen[q] > arrive) begin = wOpen[q]; }
        else late += arrive - wClose[w1 - 1];
      }
      const t = begin + svc[i], wait = S.W[k] + 0.1 * (begin - arrive) + EARLY * (begin - start), drive = S.D[k] + d;
      if (nonneg && late * LATE_PENALTY + (t - start) + 0.25 * drive + wait >= bestC) continue;
      o[k] = i;
      if (k === n - 1) {
        const b = back[i], c = late * LATE_PENALTY + (t + b - start) + 0.25 * (drive + b) + wait;
        if (c < bestC) { bestC = c; best = Array.from(o); }
        continue;
      }
      S.T[k + 1] = t; S.L[k + 1] = late; S.W[k + 1] = wait; S.D[k + 1] = drive;
      used[i] = 1; dfs(k + 1); used[i] = 0;
    }
  };
  dfs(0);
  return { order: best, ...evaluate(best, ctx) };
}

// Generador pseudoaleatorio reproducible (mulberry32) para que dos ejecuciones den la misma ruta.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Construcción voraz: siempre la parada que antes se puede empezar a atender, priorizando las que cierran antes.
function greedy(ctx) {
  const left = new Set(ctx.stops.map((_, i) => i + 1));
  const order = [];
  let t = ctx.start;
  let prev = 0;
  while (left.size) {
    let pick = null;
    let pickScore = Infinity;
    for (const i of left) {
      const s = ctx.stops[i - 1];
      const arrive = t + ctx.matrix[prev][i];
      const { begin, lateBy } = serviceStart(arrive, s.windows);
      const closes = s.windows?.length ? Math.max(...s.windows.map((w) => w[1])) : 24 * 60;
      const score = lateBy * LATE_PENALTY + begin + (closes - begin) * 0.05;
      if (score < pickScore) { pickScore = score; pick = i; }
    }
    const s = ctx.stops[pick - 1];
    const { begin } = serviceStart(t + ctx.matrix[prev][pick], s.windows);
    t = begin + (s.service ?? 0);
    prev = pick;
    order.push(pick);
    left.delete(pick);
  }
  return order;
}

// Movimientos sobre el array, en el sitio (para deshacer: relocate(j, i), swap igual, reverse igual).
function relocate(o, i, j) {
  const x = o[i];
  if (i < j) for (let k = i; k < j; k++) o[k] = o[k + 1];
  else for (let k = i; k > j; k--) o[k] = o[k - 1];
  o[j] = x;
}
function reverse(o, a, b) { for (; a < b; a++, b--) { const x = o[a]; o[a] = o[b]; o[b] = x; } }

// Recocido simulado desde init. Solo se reevalúa desde la primera posición que cambia,
// y el umbral de aceptación se sortea antes para cortar la evaluación en cuanto se pasa.
function anneal(P, init, rand, iters, S, X) {
  const n = P.n, cur = Int32Array.from(init);
  let curC = fullCost(P, cur, S);
  const best = cur.slice();
  let bestC = curC;
  let temp = 30;
  const cool = Math.pow(0.05 / temp, 1 / iters);
  const prune = P.nonneg;
  for (let k = 0; k < iters; k++, temp *= cool) {
    const i = Math.floor(rand() * n);
    let j = Math.floor(rand() * (n - 1));
    if (j >= i) j++;
    const move = rand();
    const a = i < j ? i : j, b = i < j ? j : i;
    if (move < 0.4) relocate(cur, i, j); // mover una parada a otra posición
    else if (move < 0.7) { const x = cur[i]; cur[i] = cur[j]; cur[j] = x; }
    else reverse(cur, a, b); // invertir un tramo (2-opt)
    // acepta si delta < -temp·ln(u): lo mismo que u < exp(-delta/temp)
    const limit = curC - temp * Math.log(rand());
    const c = tail(P, cur, a, S, X, prune ? limit : Infinity);
    if (c <= limit) {
      for (let q = a + 1; q <= n; q++) { S.T[q] = X.T[q]; S.L[q] = X.L[q]; S.W[q] = X.W[q]; S.D[q] = X.D[q]; }
      curC = c;
      if (c < bestC) { bestC = c; best.set(cur); }
    } else if (move < 0.4) relocate(cur, j, i);
    else if (move < 0.7) { const x = cur[i]; cur[i] = cur[j]; cur[j] = x; }
    else reverse(cur, a, b);
  }
  return { order: best, cost: bestC };
}

// Búsqueda local hasta óptimo local: Or-opt (tramos de 1 a 3, también al revés), intercambio y 2-opt.
// Primera mejora; se repite mientras algo mejore.
function polish(P, order, S, X) {
  const n = P.n, cur = Int32Array.from(order), C = new Int32Array(n);
  let curC = fullCost(P, cur, S);
  const limitOf = () => (P.nonneg ? curC - 1e-9 : Infinity);
  const tryC = (a) => {
    const c = tail(P, C, a, S, X, limitOf());
    if (!(c < curC - 1e-9)) return false;
    cur.set(C); curC = c;
    for (let q = a + 1; q <= n; q++) { S.T[q] = X.T[q]; S.L[q] = X.L[q]; S.W[q] = X.W[q]; S.D[q] = X.D[q]; }
    return true;
  };
  let improved = true;
  while (improved) {
    improved = false;
    for (let len = 1; len <= 3; len++) {
      for (let i = 0; i + len <= n; i++) {
        for (const rev of len > 1 ? [false, true] : [false]) {
          // quitar cur[i..i+len) e insertarlo en la posición j del resto
          for (let j = 0; j <= n - len; j++) {
            if (j === i && !rev) continue;
            let p = 0;
            for (let q = 0; q < n; q++) {
              if (q === i) q += len;
              if (p === j) { for (let r = 0; r < len; r++) C[p++] = cur[rev ? i + len - 1 - r : i + r]; }
              if (q < n) C[p++] = cur[q];
            }
            if (p === j) for (let r = 0; r < len; r++) C[p++] = cur[rev ? i + len - 1 - r : i + r];
            if (tryC(i < j ? i : j)) improved = true;
          }
        }
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        C.set(cur); const x = C[i]; C[i] = C[j]; C[j] = x;
        if (tryC(i)) { improved = true; continue; }
        C.set(cur); reverse(C, i, j);
        if (tryC(i)) improved = true;
      }
    }
  }
  return { order: cur, cost: curC };
}

function shuffle(order, rand, swaps) {
  const o = order.slice();
  for (let k = 0; k < swaps; k++) {
    const i = Math.floor(rand() * o.length), j = Math.floor(rand() * o.length);
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

const now = () => globalThis.performance?.now?.() ?? Date.now();

// Varios recocidos independientes (cada uno con su propia semilla) y pulido local de cada resultado.
// Para pocas paradas, búsqueda exhaustiva. Determinista: misma entrada → misma ruta, salvo que se agote
// opts.budgetMs (se mira entre arranques; en un móvil lento puede cortar antes con muchas paradas).
export function optimize(ctx, opts = {}) {
  const n = ctx.stops.length;
  if (n === 0) return { order: [], ...evaluate([], ctx) };
  if (n <= 8) return bruteForce(ctx);
  const t0 = now();
  const P = prepare(ctx), S = makeState(n), X = makeState(n);
  const seed = opts.seed ?? 12345;
  // Más arranques cuando son baratos: con las rutas normales (10–25 paradas) caben de sobra.
  const restarts = opts.restarts ?? (n <= 20 ? 32 : n <= 30 ? 24 : 16);
  const iters = opts.iterations ?? Math.min(60000, 1500 * n);
  const budget = opts.budgetMs ?? 700;
  const g = greedy(ctx);
  let best = null, bestC = Infinity;
  for (let r = 0; r < restarts; r++) {
    // al menos dos arranques; después, solo si cabe otro en el presupuesto al ritmo medio hasta ahora
    if (r >= 2 && now() - t0 + (now() - t0) / r > budget) break;
    const rand = rng(seed + Math.imul(r, 0x9e3779b9));
    const init = r === 0 ? g : shuffle(g, rand, Math.ceil(n / 3));
    const sa = anneal(P, init, rand, iters, S, X);
    const loc = polish(P, sa.order, S, X);
    if (loc.cost < bestC) { bestC = loc.cost; best = loc.order; }
  }
  const order = Array.from(best);
  return { order, ...evaluate(order, ctx) };
}
