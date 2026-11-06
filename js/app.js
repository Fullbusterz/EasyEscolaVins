import { parseList, fmt, toMin, clientKey } from './parse.js';
import { geocode, navUrl, currentPosition, coordsFromText, travelMatrix, trafficLegs } from './geo.js';
import { computePlan } from './planner.js';
import { groupKey, walkMin } from './parking.js';
import { bigOrder } from './portal.js';
import { oddHours, ODD_WINDOWS } from './hours.js';
import { planWindows as marginWindows, STRICT_MARGIN, FLEX_EXTRA, LATE_OK_MORNING, LATE_OK_AFTERNOON } from './hours.js';
import { serviceStart } from './solver.js';
import { parsePortal, readPortalHash } from './portal.js';
import * as store from './store.js';

export const VERSION = '1.14.0';

// ---------- Utilidades ----------

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
const todayIso = () => store.isoDate();
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return store.isoDate(d); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

const I = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/></svg>',
  nav: '<svg viewBox="0 0 24 24"><path d="M4 11.5 20 4l-7.5 16-2-6.5z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path d="M9 4h6v3H9zM8 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H16M8.5 12h7M8.5 16h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  go: '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="m5 15 7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4 2.5 20h19z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4.5M12 17v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
};

// Àrea DUM (carga y descarga): hay que validar cada parada en la app SPRO; máximo 30 minutos.
const DUM_MINUTES = 30;
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
function sproUrl() {
  if (isIOS) return 'https://apps.apple.com/app/id1500407078';
  const store = encodeURIComponent('https://play.google.com/store/apps/details?id=cat.bcn.bsm.spro');
  return `intent://open#Intent;scheme=cat.bcn.bsm.spro;package=cat.bcn.bsm.spro;S.browser_fallback_url=${store};end`;
}
function dumChip(r, cur) {
  const park = parkingOf(r, cur.id);
  if (r.dum?.id !== cur.id && !(park && r.dum?.group === groupKey(park.ids))) return '';
  const left = Math.ceil(DUM_MINUTES - (Date.now() - r.dum.at) / 60000);
  if (left <= 0) return '<span class="chip late solid" id="dum-chip">Zona DUM: tiempo agotado</span>';
  return `<span class="chip ${left <= 5 ? 'late solid' : 'wait'}" id="dum-chip">Zona DUM: quedan ${left} min</span>`;
}

const ui = {
  tab: 'route',
  date: null,
  busy: null, // texto del botón ocupado; mientras hay algo calculando no se aceptan otras acciones de la ruta
  clientFilter: '',
  sheet: null, // { kind, initial, ... }
  persisted: null,
  update: null, // service worker nuevo esperando
};

function toast(msg, ms = 2600, action = null) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-btn" data-toast-action>${esc(action.label)}</button>` : ''}`;
  toast._action = action?.fn || null;
  t.classList.toggle('has-action', !!action);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.classList.remove('show'); toast._action = null; }, ms);
}

function windowsChips(windows) {
  if (!windows?.length) return '<span class="chip any">Cualquier hora</span>';
  return windows.map(([a, b]) => `<span class="chip win">${fmt(a)}–${fmt(b)}</span>`).join('');
}

// Qué pasa con el horario del cliente a la hora t: abre más tarde, está abierto hasta…, o ya ha cerrado.
function windowState(windows, t) {
  if (!windows?.length) return { label: 'horario', value: 'Libre' };
  const ws = [...windows].sort((a, b) => a[0] - b[0]);
  for (const [a, b] of ws) {
    if (t < a) return { label: 'abre', value: fmt(a) };
    if (t <= b) return { label: 'cierra', value: fmt(b) };
  }
  return { label: 'cerró', value: fmt(ws[ws.length - 1][1]) };
}

function dayName(iso) {
  const d = new Date(iso + 'T12:00:00');
  const rel = iso === todayIso() ? 'Hoy' : iso === addDays(todayIso(), 1) ? 'Mañana' : iso === addDays(todayIso(), -1) ? 'Ayer' : null;
  let long = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  long = long.charAt(0).toUpperCase() + long.slice(1);
  return { rel: rel || long.split(',')[0], long };
}

// Con el horario: se planifica con margen (media hora si cierra por la mañana, una hora si cierra a mediodía o
// más tarde; ver hours.js). Estricto: sin margen; flexible: media hora más. En la ficha se guarda su horario de verdad.
const TIMING = [['strict', 'Estricto'], ['', 'Normal'], ['flex', 'Flexible']];
// Horario raro: solo de tarde (todo después de las 13:00) y sin confirmar con el cliente. Se planifica desde las 10:00.
const odd = (x) => !x.windowsConfirmed && oddHours(x.windows);
const realWindows = (x) => (odd(x) ? ODD_WINDOWS : x.windows);
function planWindows(x) {
  if (!settings().useWindows) return []; // horarios apagados en Ajustes: solo cercanía y tráfico
  if (odd(x)) return ODD_WINDOWS;
  return marginWindows(x.windows, x.timing);
}
// Minutos que se llega después del horario del cliente (0 si se llega a tiempo o los horarios están apagados).
const pastHours = (x, leg) => (leg && settings().useWindows ? serviceStart(leg.arrive, realWindows(x)).lateBy : 0);
const oddChip = (x) => (odd(x) ? '<span class="chip late">Horario raro · llama al cliente</span>' : '');
const planStop = (x) => ({ id: x.id, lat: x.lat, lon: x.lon, windows: planWindows(x), service: x.service, load: x.load });
// Carga del pedido (cajas y botellas, del portal). Un pedido grande (+70 botellas o +30 cajas) se marca bien visible.
function loadChip(x) {
  const l = x.load;
  if (!l || (!l.boxes && !l.bottles)) return '';
  const what = esc([l.boxes ? plural(l.boxes, 'caja', 'cajas') : '', l.loose ? `${l.loose} sueltas` : ''].filter(Boolean).join(' + '));
  return bigOrder(l) ? `<span class="chip big">Pedido grande · ${what} · ~${esc(l.bottles)} bot.</span>` : `<span class="chip any">${what}</span>`;
}
function timingChip(x) {
  if (x.timing === 'strict') return '<span class="chip strict">Estricto</span>';
  if (x.timing === 'flex') return '<span class="chip any">Flexible</span>';
  return '';
}

// Zonas de carga y descarga de Barcelona (Open Data BCN): se cargan una vez al abrir la app.
let DUM_ZONES = [];
fetch('data/dum-bcn.json').then((res) => res.json()).then((d) => {
  DUM_ZONES = Array.isArray(d?.zones) ? d.zones : [];
  if (ui.tab === 'route' && !ui.sheet) render();
}).catch(() => { /* sin zonas: se propone el punto medio */ });

// Aparcamientos aceptados con al menos dos paradas ubicadas de la ruta.
function parkingFor(r) {
  const here = new Set(r.stops.filter(located).map((x) => x.id));
  return (r.parking || []).map((p) => ({ ...p, ids: p.ids.filter((id) => here.has(id)) })).filter((p) => p.ids.length >= 2);
}
const parkingOf = (r, id) => parkingFor(r).find((p) => p.ids.includes(id)) || null;
const walkUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${Number(p.lat)},${Number(p.lon)}&travelmode=walking`;

// Quita todos los aparcamientos de la ruta (las entregas vuelven a ir en furgoneta) y recalcula.
async function clearParking() {
  const r = currentRoute();
  const n = parkingFor(r).length;
  if (!n) return false;
  if (!(await ask(n === 1 ? '¿Quitar el aparcamiento? Sus entregas vuelven a ir en furgoneta.' : `¿Quitar los ${n} aparcamientos? Sus entregas vuelven a ir en furgoneta.`, { ok: 'Quitar', danger: true }))) return false;
  r.parking = [];
  store.save();
  if (r.status === 'active') await replanActive('Aparcamientos quitados'); else await optimize();
  return true;
}

// Para el mapa: paradas ubicadas en el orden de la ruta (en ruta, primero las hechas), con su tramo del plan.
function mapApi() {
  return {
    data() {
      const r = currentRoute(), s = settings();
      const planned = !isDirty(r) && !!r.plan;
      const legs = planned ? new Map(r.plan.legs.map((l) => [l.id, l])) : new Map();
      const seq = r.status === 'active'
        ? [...r.stops.filter((x) => x.done).sort((a, b) => a.doneAt - b.doneAt),
          ...(r.plan?.order || []).map((id) => r.stops.find((x) => x.id === id)).filter((x) => x && !x.done)]
        : orderedStops(r);
      const park = parkingFor(r);
      return {
        depot: s.depot, returnToDepot: s.returnToDepot, planned, nav: s.nav, zones: DUM_ZONES,
        current: r.status === 'active' ? r.current : null,
        unlocated: r.stops.filter((x) => !located(x)).length,
        stops: seq.filter(located).map((x) => ({
          id: x.id, name: x.name || x.address, label: x.label || x.address, lat: x.lat, lon: x.lon,
          windows: x.windows, planWindows: planWindows(x), service: x.service, load: x.load || null, done: !!x.done, leg: legs.get(x.id) || null,
          nav: navUrl(s.nav, park.find((p) => p.ids.includes(x.id)) || x),
        })),
        parking: park.map((p) => ({ ...p, key: groupKey(p.ids) })),
      };
    },
    // Las entregas elegidas salen de cualquier otro aparcamiento en el que estuvieran.
    async accept(ids, spot) {
      const r = currentRoute();
      const rest = (r.parking || []).map((p) => ({ ...p, ids: p.ids.filter((id) => !ids.includes(id)) })).filter((p) => p.ids.length >= 2);
      r.parking = [...rest, { ids, lat: spot.lat, lon: spot.lon, label: spot.label || '', dum: !!spot.dum }];
      store.save();
      if (r.status === 'active') await replanActive('Aparcamiento añadido'); else await optimize();
    },
    clear: () => clearParking(),
    async remove(key) {
      const r = currentRoute();
      r.parking = (r.parking || []).filter((p) => groupKey(p.ids) !== key);
      store.save();
      if (r.status === 'active') await replanActive('Aparcamiento quitado'); else await optimize();
    },
    closed() { render(); },
  };
}

function settings() { return store.settings(); }
function currentRoute() { return store.route(ui.date); }

function signature(r) {
  return JSON.stringify([
    settings().shiftStart, settings().returnToDepot, !!settings().orsKey, !!settings().tomtomKey, !!settings().useWindows,
    r.stops.map((s) => [s.id, s.lat, s.lon, s.windows, s.service, s.timing || '', !!s.windowsConfirmed]),
    parkingFor(r).map((p) => [p.ids, p.lat, p.lon]),
    r.manual || null,
  ]);
}
const isDirty = (r) => !r.plan || r.planSig !== signature(r);
const located = (s) => typeof s.lat === 'number' && typeof s.lon === 'number';
const lateText = (m) => (m > 60 ? 'Fuera de horario' : `${Math.round(m)} min tarde`);
const minOfDay = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };

function defaultDate() {
  const t = todayIso();
  const today = store.db().routes[t];
  if (today && today.stops.length && today.status !== 'done') return t;
  return addDays(t, 1);
}

// ---------- Render principal ----------

function render() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const eng = $('#engine');
  const { orsKey, tomtomKey } = settings();
  eng.className = `engine ${tomtomKey && orsKey ? 'live' : orsKey ? 'est' : 'off'}`;
  eng.innerHTML = `<span class="dot"></span>${tomtomKey && orsKey ? 'Tráfico real' : orsKey ? 'Tráfico estimado' : 'Falta configurar'}`;

  const view = $('#view');
  let bar = '';
  if (ui.tab === 'route') {
    $('#title').textContent = 'Ruta';
    view.innerHTML = renderRoute();
    bar = renderActionBar();
  } else if (ui.tab === 'clients') {
    $('#title').textContent = 'Clientes';
    view.innerHTML = renderClients();
  } else {
    $('#title').textContent = 'Ajustes';
    view.innerHTML = renderSettings();
  }
  $('#actionbar').innerHTML = bar;
  $('#actionbar').hidden = !bar;
  document.body.classList.toggle('has-actionbar', !!bar);
  renderUpdate();
  renderSheet();
}

function renderRoute() {
  const r = currentRoute();
  if (r.status === 'active') return renderActive(r);
  if (r.status === 'done') return renderDone(r);
  return renderPlanning(r);
}

function dayBar() {
  const { rel, long } = dayName(ui.date);
  return `<div class="daybar">
    <button class="iconbtn" data-action="day" data-d="-1" aria-label="Día anterior">${I.left}</button>
    <div class="day"><b>${esc(rel)}</b><span>${esc(long)}</span></div>
    <button class="iconbtn" data-action="day" data-d="1" aria-label="Día siguiente">${I.right}</button>
  </div>`;
}

function orderedStops(r) {
  if (!r.plan || isDirty(r)) return r.stops.slice();
  const byId = new Map(r.stops.map((s) => [s.id, s]));
  const ordered = r.plan.order.map((id) => byId.get(id)).filter(Boolean);
  const rest = r.stops.filter((s) => !r.plan.order.includes(s.id));
  return [...ordered, ...rest];
}

function stopCard(s, i, leg, extra = '', park = null) {
  const chips = [loadChip(s), windowsChips(s.windows), oddChip(s), timingChip(s)];
  // Lo de llegar tarde se dice respecto a su horario de verdad (el plan usa el margen de estricto/flexible).
  const real = pastHours(s, leg);
  if (s.failed) chips.unshift(`<span class="chip late">No entregado · ${esc(s.failed)}</span>`);
  else if (real > 0.5 && !(leg?.late > 0.5)) chips.push(`<span class="chip wait">${Math.round(real)} min tarde · en el margen</span>`);
  else if (leg?.late > 0.5) chips.push(`<span class="chip late">${real > 0.5 ? lateText(real) : 'Sin margen · estricto'}</span>`);
  else if (leg?.wait > 4) chips.push(`<span class="chip wait">Espera ${Math.round(leg.wait)} min</span>`);
  if (park && !s.done) chips.push(leg?.foot ? `<span class="chip park">A pie desde la furgoneta</span>` : `<span class="chip park">${I.pin}Aparca: ${esc(park.label || 'punto medio')}</span>`);
  if (!located(s)) chips.push('<span class="chip late">Sin ubicar</span>');
  else if (s.needsCheck && !s.done) chips.push('<span class="chip check">Revisar dirección</span>');
  const cls = ['stop', s.done ? 'done' : '', s.failed ? 'failed' : '', !located(s) ? 'unlocated' : ''].join(' ');
  const mark = s.failed ? I.x : I.check;
  return `<li><button class="${cls}" data-action="edit-stop" data-id="${esc(s.id)}">
    <span class="num" aria-hidden="true">${s.done ? mark.replace('<svg', '<svg width="16" height="16"') : i}</span>
    <span class="grow">
      <span class="name">${esc(s.name || s.address)}</span>
      <span class="addr ellipsis">${esc(s.label || s.address || 'Sin dirección')}</span>
      <span class="chips">${chips.join('')}</span>
    </span>
    <span class="eta">${leg ? `<b>${fmt(leg.arrive)}</b><span>llegada</span>` : extra}</span>
  </button></li>`;
}

// Lo que ve quien abre la app por primera vez: tres pasos, y cada uno se marca al hacerlo.
function firstSteps() {
  const s = settings();
  const step = (done, n, title, body) => `<li class="${done ? 'ok' : ''}"><span class="n">${done ? I.check : n}</span><div class="grow"><b>${title}</b>${body}</div></li>`;
  return `<div class="card first">
    <div class="serif">Primeros pasos</div>
    <ol class="steps">
      ${step(!!s.orsKey, 1, 'Configura la app',
        `<div class="small muted">Pon tu clave gratuita en Ajustes: es solo tuya, cada repartidor tiene la suya. Si un compañero te pasa su configuración, impórtala y tendrás el almacén y sus clientes.</div>
         <div class="actions2" style="margin:10px 0 0">
           <label class="btn line" style="cursor:pointer">Importar archivo<input type="file" id="import-file" accept="application/json,.json" hidden></label>
           <button class="btn ghost" data-action="tab" data-tab="settings">Ir a Ajustes</button>
         </div>`)}
      ${step(false, 2, 'Practica una ruta',
        `<div class="small muted">6 paradas de ejemplo para probar optimizar, «Empezar ruta», Waze, SPRO y «Siguiente». Se borra con un toque.</div>
         <button class="btn ghost block" data-action="demo" style="margin-top:10px">Probar con una ruta de ejemplo</button>`)}
      ${step(false, 3, portalApp() ? 'Trae tu ruta de verdad' : 'Pega tu ruta de verdad', portalApp()
        ? `<div class="small muted">Toca «Traer la ruta del portal», entra con tu usuario del portal (solo la primera vez) y pulsa el botón dorado. Ahí mismo puedes pedir que te avise cuando salga la ruta de mañana.</div>`
        : isIOS
          // En iPhone no se puede compartir a una web instalada: siempre copiar y pegar.
          ? `<div class="small muted">Desde el portal o un mensaje: copia la lista y usa «Pegar lista». Con el albarán en papel: haz una foto, mantén el dedo sobre el texto, «Seleccionar todo» → «Copiar», y pégalo en «Pegar lista».</div>`
          : `<div class="small muted">Desde el portal o el albarán: copia la lista y usa «Pegar lista», o compártela desde WhatsApp a Ruta. Con el albarán en papel: Google Lens → Texto → Compartir → Ruta.</div>`)}
    </ol>
  </div>`;
}

// Ruta de práctica: direcciones reales del Baix Llobregat y Barcelona, horarios a partir de ahora.
const DEMO = [
  ['Ejemplo · Bar La Plaça', "Rambla de Just Oliveras 30, L'Hospitalet de Llobregat", 41.36142, 2.10137, 0, 120],
  ['Ejemplo · Celler de Sants', 'Carrer de Sants 200, Barcelona', 41.37559, 2.13161, 60, 240],
  ['Ejemplo · Vinoteca Castellbell', 'Rambla de la Marquesa de Castellbell 20, Sant Feliu de Llobregat', 41.3808, 2.05197, null],
  ['Ejemplo · Restaurant Despí', 'Avinguda de Barcelona 45, Sant Joan Despí', 41.36855, 2.06432, null],
  ['Ejemplo · Bodega Molins', 'Plaça de la Creu 3, Molins de Rei', 41.41078, 2.01929, 30, 180],
  ['Ejemplo · Taverna Esplugues', 'Carrer de Laureà Miró 290, Esplugues de Llobregat', 41.37793, 2.08432, null],
];

function loadDemo() {
  const t = todayIso();
  const r = store.route(t);
  if (r.stops.length) { ui.date = t; render(); return toast('Hoy ya tienes paradas: la ruta de ejemplo es para un día vacío'); }
  const base = Math.ceil(nowMin() / 15) * 15;
  r.stops = DEMO.map(([name, address, lat, lon, from, to], i) => ({
    id: `demo${i}`, demo: true, name, address, label: address, lat, lon, service: 10, done: false,
    windows: from == null ? [] : [[Math.min(base + from, 23 * 60), Math.min(base + to, 23 * 60 + 59)]],
    notes: i === 1 ? 'Parada de práctica: prueba aquí el botón SPRO y «Dejar para luego».' : '',
  }));
  r.status = 'draft'; r.plan = null; r.current = null;
  store.save();
  ui.date = t; ui.tab = 'route';
  render();
  optimize();
}

function clearDemo() {
  const r = currentRoute();
  r.stops = r.stops.filter((x) => !x.demo);
  r.status = 'draft'; r.plan = null; r.current = null; r.lastChange = null; r.dum = null; r.pairs = {};
  store.save(); render(); toast('Ruta de ejemplo borrada');
}

const demoBanner = (r) => (r.stops.some((x) => x.demo)
  ? `<div class="notice gold compact">${I.info}<div class="grow">Ruta de ejemplo para practicar: no se guarda en tus clientes.</div><button class="btn line" data-action="clear-demo" style="min-height:40px;padding:0 12px">Borrar</button></div>`
  : '');

function renderPlanning(r) {
  const s = settings();
  const dirty = isDirty(r);
  const stops = orderedStops(r);
  const legs = !dirty && r.plan ? new Map(r.plan.legs.map((l) => [l.id, l])) : new Map();
  let html = dayBar() + demoBanner(r);

  if (!r.stops.length) {
    html += settings().orsKey && store.clientList().length ? `<div class="empty">
      <div class="serif">Sin paradas todavía</div>
      <div class="small">Pega la lista de repartos (del portal de Escolà o de un mensaje) o añade las paradas a mano. Las direcciones y horarios que ya conozca la app se rellenan solos.</div>
      <button class="linkbtn" data-action="demo" style="margin-top:8px">Practicar con una ruta de ejemplo (hoy)</button>
    </div>` : firstSteps();
  } else if (!dirty) {
    const p = r.plan;
    html += `<div class="card summary">
      <div><b>${r.stops.length}</b><span>${r.stops.length === 1 ? 'parada' : 'paradas'}</span></div>
      <div><b>${fmt(p.end)}</b><span>${s.returnToDepot ? 'vuelta' : 'última entrega'}</span></div>
      <div><b>${Math.round(p.km)}</b><span>km</span></div>
    </div>`;
    if (p.late > 0.5) {
      const lateOnes = p.legs.filter((l) => l.late > 0.5).map((l) => r.stops.find((x) => x.id === l.id)?.name).filter(Boolean);
      html += `<div class="notice warn">${I.warn}<div>Ni con el margen da tiempo a llegar a <b>${esc(lateOnes.join(', '))}</b>. Revisa sus horarios o avisa al cliente.</div></div>`;
    }
    const inMargin = p.legs.filter((l) => !(l.late > 0.5)).map((l) => {
      const x = r.stops.find((y) => y.id === l.id);
      const m = x ? pastHours(x, l) : 0;
      return m > 0.5 ? `${esc(x.name)} (+${Math.round(m)} min)` : '';
    }).filter(Boolean);
    const odds = r.stops.filter((x) => !x.done && odd(x));
    if (odds.length && s.useWindows) html += `<div class="notice warn">${I.warn}<div>Horario de tarde que parece un error en ${odds.map((x) => `<b>${esc(x.name)}</b> (${x.windows.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(', ')})`).join(', ')}. Lo trato como si aceptara desde las 10:00. Llama al cliente y apunta en su ficha el horario de verdad.</div></div>`;
    if (inMargin.length) html += `<div class="notice warn">${I.info}<div>Llegas después de su horario, dentro del margen, a ${inMargin.join(', ')}. Si alguno es estricto, márcalo en su ficha.</div></div>`;
    if (!s.useWindows) html += `<div class="notice gold">${I.info}<div>Horarios de los clientes apagados: el orden sale por cercanía y tráfico. Se encienden en <button class="linkbtn" data-action="tab" data-tab="settings" style="color:inherit">Ajustes</button>.</div></div>`;
    const at = p.computedAt ? ` Calculada ${store.isoDate(new Date(p.computedAt)) === todayIso() ? 'hoy' : 'el ' + new Date(p.computedAt).toLocaleDateString('es-ES')} a las ${fmt(minOfDay(p.computedAt))}.` : '';
    html += `<div class="notice info">${I.info}<div>Con ${p.source === 'tomtom' ? (p.live ? 'el tráfico de ese momento' : 'el tráfico previsto para esa hora') : p.source === 'ors' ? 'tiempos de conducción reales y tráfico estimado por hora' : 'distancias aproximadas: añade la clave gratuita de rutas en Ajustes para tiempos reales'}. Salida ${fmt(p.startMin)} desde el almacén.${at}</div></div>`;
  }

  if (parkingFor(r).length > 1) html += `<div style="text-align:right;margin:-4px 2px 8px"><button class="linkbtn" data-action="park-clear">Quitar todos los aparcamientos</button></div>`;
  for (const p of parkingFor(r)) {
    const names = p.ids.map((id) => r.stops.find((x) => x.id === id)?.name).filter(Boolean);
    html += `<div class="notice gold">${I.pin}<div class="grow">Aparcas una vez ${p.dum ? `en la zona DUM de <b>${esc(p.label)}</b>` : 'en el punto medio'} para ${esc(names.join(', '))}.
      <button class="linkbtn" data-action="park-undo" data-key="${esc(groupKey(p.ids))}" style="color:inherit">Quitar</button></div></div>`;
  }

  const unloc = r.stops.filter((x) => !located(x)).length;
  if (unloc) html += `<div class="notice warn">${I.warn}<div>${unloc === 1 ? 'Hay 1 parada' : `Hay ${unloc} paradas`} sin ubicar. Tócala para buscar la dirección; mientras tanto no entra en la ruta.</div></div>`;

  if (portalApp()) html += `<a class="btn gold big block" href="${esc(portalIntent())}" style="margin:14px 0 10px">Traer la ruta del portal</a>`;
  html += `<div class="actions2">
    <button class="btn ghost" data-action="open-paste">${I.paste}Pegar lista</button>
    <button class="btn ghost" data-action="open-stop">${I.plus}Añadir parada</button>
  </div>`;

  if (stops.length) {
    if (r.manual && !dirty) html += manualNotice();
    html += `<div class="section-head"><h2 class="section-title">${dirty ? 'Paradas' : r.manual ? 'Tu orden' : 'Orden óptimo'}</h2>
      <span class="head-btns">${reorderButton(r)}<button class="btn line small" data-action="open-map">${I.map}Mapa</button></span></div><ol class="stops">`;
    html += stops.map((st, i) => stopCard(st, i + 1, legs.get(st.id), '', parkingOf(r, st.id))).join('');
    html += '</ol>';
  }

  const canPlan = r.stops.some((x) => located(x) && !x.done);
  if (canPlan) {
    html += `<div class="cta-bar${!dirty && !ui.busy && ui.date !== todayIso() ? ' static' : ''}">`;
    if (ui.busy) {
      html += `<button class="btn gold big block" disabled><span class="spin"></span>${esc(ui.busy)}</button>`;
    } else if (dirty) {
      html += `<button class="btn gold big block" data-action="optimize">${I.spark}Optimizar ruta</button>`;
    } else if (ui.date === todayIso()) {
      html += `<div class="actions2" style="margin:0">
        <button class="btn line big" data-action="recalc">${I.spark}Recalcular</button>
        <button class="btn gold big" data-action="start-route">${I.go}Empezar ruta</button>
      </div>`;
    } else {
      html += `<button class="btn line big block" data-action="recalc">${I.spark}Recalcular</button>`;
      // Para mirarla antes: la primera parada en el navegador (o su aparcamiento, si tiene).
      const first = stops.find((x) => !x.done && located(x));
      if (first) html += `<a class="btn line block" style="margin-top:10px" href="${esc(navUrl(s.nav, parkingOf(r, first.id) || first))}" target="_blank" rel="noopener">${I.nav}${s.nav === 'gmaps' ? 'Maps' : 'Waze'} a la primera: ${esc(first.name)}</a>`;
    }
    html += '</div>';
  }
  return html;
}

// ---------- Orden a mano ----------

// Paradas que se pueden ordenar: las pendientes y ubicadas, en el orden actual (en ruta, la actual primero).
function reorderIds(r) {
  const pending = (x) => x && !x.done && located(x);
  if (r.status === 'active') {
    const byId = new Map(r.stops.map((x) => [x.id, x]));
    const ids = [r.current, ...(r.plan?.order || [])].filter((id, i, all) => all.indexOf(id) === i && pending(byId.get(id)));
    return [...ids, ...r.stops.filter((x) => pending(x) && !ids.includes(x.id)).map((x) => x.id)];
  }
  return orderedStops(r).filter(pending).map((x) => x.id);
}
const reorderButton = (r) => (reorderIds(r).length > 1 ? '<button class="btn line small" data-action="open-reorder">Cambiar orden</button>' : '');
const manualNotice = () => `<div class="notice gold compact">${I.info}<div class="grow">Orden puesto por ti: «Recalcular» y «Siguiente» lo mantienen y solo cambian las horas.</div>
  <button class="btn line" data-action="order-auto" style="min-height:40px;padding:0 12px">Orden óptimo</button></div>`;

function sheetReorder(sh) {
  const r = currentRoute();
  const byId = new Map(r.stops.map((x) => [x.id, x]));
  const list = sh.order.map((id) => byId.get(id)).filter(Boolean);
  const last = list.length - 1;
  const first = r.status === 'active' ? r.stops.filter((x) => x.done).length + 1 : 1;
  return `<h2 id="sheet-title">Cambiar el orden</h2>
    <div class="small muted" style="margin:-6px 0 12px">Sube o baja las paradas. Al guardar calculo las horas con tu orden y te aviso si alguien queda fuera de su horario.${r.status === 'active' ? ' La primera de la lista es la siguiente a la que vas.' : ''}</div>
    <ol class="reorder">${list.map((x, i) => `<li>
      <span class="num" aria-hidden="true">${first + i}</span>
      <span class="grow"><b>${esc(x.name || x.address)}</b><span class="tiny faint ellipsis">${esc(x.label || x.address || '')}</span></span>
      <button class="iconbtn" data-action="reorder-move" data-id="${esc(x.id)}" data-d="-1" aria-label="Subir ${esc(x.name || '')}" ${i === 0 ? 'disabled' : ''}>${I.up}</button>
      <button class="iconbtn" data-action="reorder-move" data-id="${esc(x.id)}" data-d="1" aria-label="Bajar ${esc(x.name || '')}" ${i === last ? 'disabled' : ''}>${I.down}</button>
    </li>`).join('')}</ol>
    <div class="foot">
      <button class="btn gold big block" data-action="reorder-save">Guardar este orden</button>
      ${r.manual ? '<button class="btn line block" data-action="order-auto">Volver al orden óptimo</button>' : ''}
      <button class="btn ghost block" data-action="close">Cancelar</button>
    </div>`;
}

function enRouteBar(r) {
  const total = r.stops.length;
  const finished = r.stops.filter((x) => x.done).length;
  const failed = r.stops.filter((x) => x.failed).length;
  return `<div class="enroute">
      <button class="iconbtn" data-action="day" data-d="-1" aria-label="Día anterior">${I.left}</button>
      <div class="grow"><b>${esc(dayName(ui.date).rel)}</b> · ${finished} de ${total} hechas${failed ? ` <span class="late-ink">· ${failed} sin entregar</span>` : ''}
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${finished}"><i style="transform:scaleX(${total ? finished / total : 0})"></i></div>
      </div>
      <button class="iconbtn" data-action="day" data-d="1" aria-label="Día siguiente">${I.right}</button>
    </div>`;
}

function renderActive(r) {
  const finished = r.stops.filter((x) => x.done).length;
  const cur = r.stops.find((x) => x.id === r.current && !x.done);
  const legs = new Map((r.plan?.legs || []).map((l) => [l.id, l]));
  const pendingCount = r.stops.filter((x) => !x.done).length;
  let html = enRouteBar(r) + demoBanner(r);

  if (r.lastChange) {
    html += `<div class="notice compact ${r.lastChange.kind === 'changed' ? 'gold' : 'info'}">${r.lastChange.kind === 'changed' ? I.spark : I.check}<div class="grow">${esc(r.lastChange.text)}</div>
      <button class="iconbtn plain" data-action="dismiss-change" aria-label="Cerrar aviso">${I.x}</button></div>`;
  }

  if (cur) {
    const leg = legs.get(cur.id);
    const ws = windowState(realWindows(cur), leg ? leg.arrive : nowMin());
    const park = parkingOf(r, cur.id);
    const parkLine = !park ? '' : leg?.foot
      ? `<div class="notice compact info" style="margin:12px 0 0">${I.pin}<div>Desde la furgoneta, a pie: ${Math.max(1, Math.round(walkMin(park, cur)))} min.</div></div>`
      : `<div class="notice compact gold" style="margin:12px 0 0">${I.pin}<div>Aparca ${park.dum ? `en la zona DUM de <b>${esc(park.label)}</b>` : 'en el punto medio'} y ve a pie (${Math.max(1, Math.round(walkMin(park, cur)))} min). Desde ahí haces también ${esc(park.ids.filter((id) => id !== cur.id).map((id) => r.stops.find((x) => x.id === id)).filter((x) => x && !x.done).map((x) => x.name).join(', ') || 'las demás')}.</div></div>`;
    html += `<section class="now" aria-labelledby="now-name">
      <div class="label">${finished === 0 ? 'Primera parada' : 'Siguiente parada'}</div>
      <h2 id="now-name" class="clamp2">${esc(cur.name || cur.address)}</h2>
      <div class="addr clamp2">${esc(cur.label || cur.address || '')}</div>
      ${parkLine}
      <div class="chips" style="margin-top:10px">${dumChip(r, cur)}${loadChip(cur)}${windowsChips(cur.windows)}${oddChip(cur)}${timingChip(cur)}${leg?.late > 0.5 ? `<span class="chip late solid">${lateText(pastHours(cur, leg) || leg.late)}</span>` : pastHours(cur, leg) > 0.5 ? `<span class="chip wait">${Math.round(pastHours(cur, leg))} min tarde · en el margen</span>` : ''}${leg?.wait > 4 ? `<span class="chip wait">Abre a las ${fmt(leg.begin)}</span>` : ''}</div>
      <div class="facts">
        <div><b>${leg ? fmt(leg.arrive) : '--:--'}</b><span>llegada</span></div>
        <div><b>${leg ? Math.round(leg.drive) : '–'}</b><span>min de viaje</span></div>
        <div><b>${ws.value}</b><span>${ws.label}</span></div>
      </div>
      ${cur.notes ? `<details class="notes"><summary>${I.info}<span class="clamp2">${esc(cur.notes)}</span></summary><p>${esc(cur.notes)}</p></details>` : ''}
      <div class="minor">
        <a class="pill spro" href="${esc(sproUrl())}" data-action="spro" data-keep-default="1">${I.pin}SPRO · ${dumChip(r, cur) ? 'otra vez' : 'aparcar'}</a>
        ${cur.phone ? `<a class="pill" href="tel:${esc(cur.phone.replace(/[^\d+]/g, ''))}">${I.phone}Llamar</a>` : ''}
        <button class="pill" data-action="recalc">${I.spark}Recalcular</button>
        ${pendingCount > 1 ? '<button class="pill" data-action="postpone">Dejar para luego</button>' : ''}
        <button class="pill" data-action="edit-stop" data-id="${esc(cur.id)}">Editar</button>
      </div>
    </section>`;
  }

  const upcoming = (r.plan?.order || []).filter((id) => id !== r.current).map((id) => r.stops.find((x) => x.id === id)).filter((x) => x && !x.done);
  if (upcoming.length) {
    if (r.manual) html += manualNotice();
    html += `<div class="section-head"><h2 class="section-title">Después</h2>
      <span class="head-btns">${reorderButton(r)}<button class="btn line small" data-action="open-map">${I.map}Mapa</button></span></div><ol class="stops">${upcoming.map((x, i) => stopCard(x, finished + i + 2, legs.get(x.id), '', parkingOf(r, x.id))).join('')}</ol>`;
  }
  html += finishedList(r);
  html += `<div style="text-align:center;margin-top:18px"><button class="linkbtn" data-action="stop-route">Volver a planificar</button></div>`;
  return html;
}

function finishedList(r) {
  const done = r.stops.filter((x) => x.done).sort((a, b) => a.doneAt - b.doneAt);
  if (!done.length) return '';
  return `<h2 class="section-title">Hechas</h2><ol class="stops">${done.map((x, i) => stopCard(x, i + 1, null, `<b>${fmt(minOfDay(x.doneAt))}</b><span>${x.failed ? 'intento' : 'hecha'}</span>`)).join('')}</ol>
    <div style="text-align:center;margin-top:12px"><button class="linkbtn" data-action="undo">Deshacer la última</button></div>`;
}

// Los dos botones del día a día, siempre a mano del pulgar mientras estás en ruta.
// La entrega se registra en la tablet de reparto: aquí solo se pasa a la siguiente parada.
function renderActionBar() {
  const r = currentRoute();
  if (r.status !== 'active') return '';
  const cur = r.stops.find((x) => x.id === r.current && !x.done);
  if (!cur) return '';
  const s = settings();
  const last = r.stops.filter((x) => !x.done).length === 1;
  const leg = (r.plan?.legs || []).find((l) => l.id === cur.id);
  const park = parkingOf(r, cur.id);
  const go = park && leg?.foot
    ? `<a class="btn gold big" href="${esc(walkUrl(cur))}" target="_blank" rel="noopener">${I.nav}A pie</a>`
    : `<a class="btn gold big" href="${esc(navUrl(s.nav, park || cur))}" target="_blank" rel="noopener">${I.nav}${s.nav === 'gmaps' ? 'Maps' : 'Waze'}</a>`;
  return `${go}
    ${ui.busy ? `<button class="btn forest big" disabled><span class="spin"></span>${esc(ui.busy)}</button>`
      : `<button class="btn forest big" data-action="next">${last ? `${I.check}Terminar` : `${I.right}Siguiente`}</button>`}`;
}

function backupAge() {
  const at = settings().lastBackupAt;
  if (!at) return 'Aún no has hecho ninguna.';
  const days = Math.floor((Date.now() - at) / 86400000);
  return days === 0 ? 'Última: hoy.' : days === 1 ? 'Última: ayer.' : `Última: hace ${days} días.`;
}

// Recordatorio suave: con clientes guardados y sin copia en una semana.
function needsBackup() {
  const at = settings().lastBackupAt || 0;
  return store.clientList().length >= 3 && Date.now() - at > 7 * 86400000;
}

function renderDone(r) {
  const s = settings();
  const done = r.stops.filter((x) => x.done).sort((a, b) => a.doneAt - b.doneAt);
  const delivered = done.filter((x) => !x.failed).length;
  const first = done[0], last = done[done.length - 1];
  return `${dayBar()}<div class="card finish">
      <div class="serif">Ruta terminada</div>
      <div class="muted" style="margin:6px 0 18px">${plural(delivered, 'parada', 'paradas')}${done.length > delivered ? ` · ${done.length - delivered} sin entregar` : ''} · de ${first ? fmt(minOfDay(r.startedAt || first.doneAt)) : '--'} a ${last ? fmt(minOfDay(last.doneAt)) : '--'}</div>
      <a class="btn gold big block" href="${esc(navUrl(s.nav, s.depot))}" target="_blank" rel="noopener">${I.nav}Volver al almacén</a>
      <div style="height:10px"></div>
      <button class="btn ghost block" data-action="goto-tomorrow">Preparar la ruta de mañana</button>
    </div>
    ${needsBackup() ? `<div class="notice gold">${I.info}<div class="grow">Hace más de una semana que no guardas una copia de tus clientes. <button class="linkbtn" data-action="backup" style="color:inherit">Hacer copia ahora</button></div></div>` : ''}
    ${finishedList(r)}`;
}

function renderClients() {
  const q = clientKey(ui.clientFilter);
  const all = store.clientList();
  const list = all.filter((c) => !q || c.key.includes(q) || clientKey(c.address || '').includes(q));
  let html = `<div class="search">${I.search}<input class="input" id="client-search" type="search" aria-label="Buscar cliente o dirección" placeholder="Buscar cliente o dirección" value="${esc(ui.clientFilter)}" autocomplete="off"></div>`;
  if (!all.length) {
    html += `<div class="empty"><div class="serif">La memoria está vacía</div><div class="small">Cada cliente que añadas a una ruta se guarda aquí con su dirección y su horario de entrega. Si un compañero te pasa su archivo de clientes, impórtalo en Ajustes.</div>
      <button class="btn line" style="margin-top:14px" data-action="tab" data-tab="settings">Importar clientes</button></div>`;
    return html;
  }
  html += `<div class="muted small" style="margin:0 2px 10px">${list.length === 1 ? '1 cliente recordado' : `${list.length} clientes recordados`}</div>`;
  html += list.map((c) => `<button class="client" data-action="edit-client" data-key="${esc(c.key)}">
      <span class="row between"><span class="name ellipsis">${esc(c.name)}</span>${c.visits ? `<span class="tiny faint">${esc(plural(c.visits, 'visita', 'visitas'))}</span>` : ''}</span>
      <span class="addr ellipsis">${esc(c.label || c.address || 'Sin dirección')}</span>
      <span class="chips">${windowsChips(c.windows)}${timingChip(c)}${c.serviceLearned ? `<span class="chip any">Descarga ~${esc(c.service)} min</span>` : ''}${c.needsCheck ? '<span class="chip check">Revisar dirección</span>' : ''}</span>
    </button>`).join('');
  return html;
}

function renderSettings() {
  const s = settings();
  return `
  <h2 class="section-title" style="margin-top:6px">Rutas y tráfico</h2>
  <div class="card">
    ${s.orsKey ? '' : `<div class="notice warn" style="margin-top:0">${I.warn}<div>Falta la clave de rutas: sin ella la app ordena las paradas por distancia en línea recta.</div></div>`}
    <label class="field"><span>Clave de rutas (openrouteservice) · necesaria</span>
      <span class="input-row"><input class="input" id="set-ors" value="${esc(s.orsKey)}" placeholder="Pega aquí tu clave" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn line" data-action="test-ors">Probar</button></span>
    </label>
    <div class="key-help">Gratis y sin tarjeta (500 rutas al día, de sobra):
      <ol><li>Crea una cuenta en <a href="https://account.heigit.org/" target="_blank" rel="noopener">account.heigit.org</a>.</li>
      <li>En el panel crea una clave (token) y cópiala.</li>
      <li>Pégala arriba y pulsa <b>Probar</b>.</li></ol>
    </div>
    <label class="field" style="margin-top:18px"><span>Clave de TomTom · opcional, tráfico en tiempo real</span>
      <span class="input-row"><input class="input" id="set-key" value="${esc(s.tomtomKey)}" placeholder="Pega aquí tu clave" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn line" data-action="test-key">Probar</button></span>
    </label>
    <div class="key-help">${s.tomtomKey ? 'Activo: la ruta se corrige con el tráfico previsto al planificar y con el de ese momento al salir y en cada parada.' : 'Sin ella el tráfico se estima por franja horaria: no ve accidentes ni cortes.'}
      Gratis y sin tarjeta (20.000 rutas al mes; la app gasta unas 40 al día):
      <ol><li><a href="https://developer.tomtom.com/user/login" target="_blank" rel="noopener">Crea tu cuenta o inicia sesión en TomTom</a>.
        Pulsa el botón rojo <b>Register / sign in</b>; si te pregunta cómo vas a usarlo, elige <b>Build with APIs</b>.</li>
      <li><a href="https://my.tomtom.com/keys" target="_blank" rel="noopener">Abre tus claves</a> y copia la que ya viene creada
        (<b>My first API key</b>). Si no hay ninguna, pulsa <b>Create Key</b>.</li>
      <li>Pégala arriba y pulsa <b>Probar</b>.</li></ol></div>
  </div>

  <h2 class="section-title">Jornada</h2>
  <div class="card">
    <label class="field"><span>Hora de inicio</span><input class="input" type="time" id="set-shift" value="${esc(s.shiftStart)}"></label>
    <label class="field"><span>Minutos de descarga por parada (por defecto)</span><input class="input" type="number" inputmode="numeric" min="1" max="90" id="set-service" value="${esc(s.service)}"></label>
    <label class="toggle"><span>Tener en cuenta los horarios de los clientes<span class="tiny faint" style="display:block">${s.useWindows ? `Con margen: ${LATE_OK_MORNING} min si cierra por la mañana, ${LATE_OK_AFTERNOON} min si cierra a mediodía o más tarde. La app avisa cuando lo usa.` : 'Apagado: el orden sale por cercanía y tráfico. Los horarios se siguen viendo en cada parada.'}</span></span><input type="checkbox" id="set-windows" ${s.useWindows ? 'checked' : ''}></label>
    <label class="toggle"><span>Volver al almacén al acabar<span class="tiny faint" style="display:block">Cuenta el regreso al calcular la ruta</span></span><input type="checkbox" id="set-return" ${s.returnToDepot ? 'checked' : ''}></label>
    <div class="toggle" style="border:0;padding-bottom:0"><span>Navegar con</span>
      <span class="seg"><button data-action="nav-app" data-v="waze" class="${s.nav === 'waze' ? 'on' : ''}" aria-pressed="${s.nav === 'waze'}">Waze</button><button data-action="nav-app" data-v="gmaps" class="${s.nav === 'gmaps' ? 'on' : ''}" aria-pressed="${s.nav === 'gmaps'}">Google Maps</button></span>
    </div>
  </div>

  <h2 class="section-title">Almacén (punto de salida)</h2>
  <div class="card">
    <div class="row"><span style="color:var(--gold);width:20px" aria-hidden="true">${I.pin}</span><div class="grow"><div style="font-weight:600">${esc(s.depot.name)}</div><div class="tiny faint">${esc(Number(s.depot.lat).toFixed(5))}, ${esc(Number(s.depot.lon).toFixed(5))}</div></div>
    <button class="btn line" data-action="change-depot">Cambiar</button></div>
  </div>

  <h2 class="section-title">Copias y compañeros</h2>
  <div class="card">
    <div class="small muted" style="margin-bottom:12px"><b>Copia de seguridad:</b> guarda clientes, horarios y rutas (sin tus claves) en Drive o en un mensaje a ti mismo. ${backupAge()}</div>
    <button class="btn line block" data-action="backup">Hacer copia de seguridad</button>
    <div class="small muted" style="margin:16px 0 12px"><b>Para un compañero nuevo:</b> «Pasar configuración» le pasa el almacén, el horario y tus clientes. Tus claves no se pasan nunca: cada uno pone la suya en Ajustes.
      «Pasar clientes» manda solo direcciones y horarios. Al <b>importar</b> nada se borra: se suma a lo que ya hay.</div>
    <button class="btn line block" data-action="export-config">Pasar configuración</button>
    <div class="actions2" style="margin:10px 0 0">
      <button class="btn ghost" data-action="export">Pasar clientes</button>
      <label class="btn ghost" style="cursor:pointer">Importar<input type="file" id="import-file" accept="application/json,.json" hidden></label>
    </div>
    <div class="tiny ${ui.persisted ? 'faint' : 'warn-ink'}" style="margin-top:12px">${ui.persisted ? 'Datos protegidos: el móvil no los borrará aunque le falte espacio.' : 'El móvil podría borrar los datos si se queda sin espacio o borras los datos de Chrome: haz una copia de vez en cuando.'}</div>
  </div>

  <div class="tiny faint" style="text-align:center;margin:22px 0 4px;line-height:1.6">Ruta Escolà · v${VERSION}<br>
    Clientes y rutas se guardan en este móvil. Para buscar direcciones y calcular tiempos se consultan
    servicios de mapas; tu posición solo se usa para calcular la siguiente parada.<br>
    Direcciones: © <a href="https://www.icgc.cat/" target="_blank" rel="noopener">ICGC</a> (CC BY 4.0) ·
    <a href="https://www.cartociudad.es/" target="_blank" rel="noopener">CartoCiudad</a> © IGN (CC BY 4.0) ·
    © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a><br>
    Rutas: © <a href="https://openrouteservice.org/" target="_blank" rel="noopener">openrouteservice</a> by HeiGIT${s.tomtomKey ? ' · Tráfico: © TomTom' : ''}<br>
    Mapa: © <a href="https://www.icgc.cat/" target="_blank" rel="noopener">ICGC</a> (CC BY 4.0) · <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a><br>
    Zonas de carga y descarga: © <a href="https://opendata-ajuntament.barcelona.cat/data/dataset/zones-carrega-descarrega" target="_blank" rel="noopener">Ajuntament de Barcelona, Open Data BCN</a> (CC BY 4.0)</div>`;
}

// ---------- Hojas (formularios) ----------

const background = () => [$('.top'), $('#view'), $('.tabs'), $('#actionbar')];

function snapshot(sh) {
  return JSON.stringify(sh.draft ?? sh.order ?? sh.text ?? '');
}

function openSheet(sheet) {
  sheet.initial = snapshot(sheet);
  ui.sheet = sheet;
  renderSheet();
  background().forEach((el) => el && (el.inert = true));
  $('.sheet')?.focus();
}

function closeSheet() {
  ui.sheet = null;
  background().forEach((el) => el && (el.inert = false));
  renderSheet();
}

// Pregunta de sí/no con el diseño de la app. El confirm() del navegador a veces no llega a mostrarse
// dentro de la app instalada (Chrome/Edge lo bloquean), y además sale con el dominio como título.
function ask(text, { ok = 'Aceptar', danger = false } = {}) {
  return new Promise((resolve) => {
    const box = $('#ask');
    const prevFocus = document.activeElement;
    box.innerHTML = `<div class="ask" role="alertdialog" aria-modal="true" aria-labelledby="ask-text">
      <p id="ask-text">${esc(text)}</p>
      <div class="actions2" style="margin:0">
        <button class="btn ghost" data-ask="0">Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'gold'}" data-ask="1">${esc(ok)}</button>
      </div></div>`;
    box.hidden = false;
    $('[data-ask="1"]', box).focus();
    const done = (v) => { box.hidden = true; box.innerHTML = ''; box.onclick = null; prevFocus?.focus?.(); resolve(v); };
    box.onclick = (e) => {
      const b = e.target.closest('[data-ask]');
      if (b) done(b.dataset.ask === '1');
      else if (e.target === box) done(false);
    };
  });
}

// Cerrar sin querer (tocar fuera, otra pestaña) no debe tirar lo que estabas escribiendo.
async function requestCloseSheet() {
  const sh = ui.sheet;
  if (!sh) return true;
  if (sh.busy) return false;
  syncDraft();
  if (snapshot(sh) !== sh.initial && !(await ask('¿Salir sin guardar los cambios?', { ok: 'Salir' }))) return false;
  if (ui.sheet === sh) closeSheet();
  return true;
}

function renderSheet() {
  const wrap = $('#sheet');
  const sh = ui.sheet;
  if (!sh) { wrap.hidden = true; wrap.innerHTML = ''; document.body.style.overflow = ''; return; }
  const scroll = $('.sheet', wrap)?.scrollTop || 0;
  wrap.hidden = false;
  document.body.style.overflow = 'hidden';
  let body = '';
  if (sh.kind === 'stop') body = sheetStop(sh);
  else if (sh.kind === 'paste') body = sheetPaste(sh);
  else if (sh.kind === 'depot') body = sheetDepot(sh);
  else if (sh.kind === 'reorder') body = sheetReorder(sh);
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"><div class="grab" aria-hidden="true"></div>${body}</div>`;
  $('.sheet', wrap).scrollTop = scroll;
}

function candidatesHtml(sh) {
  if (sh.searching) return '<div class="muted small" style="margin:-4px 0 14px" role="status"><span class="spin inline"></span> Buscando…</div>';
  if (sh.candidates?.length) {
    return `<div class="candidates">${sh.candidates.map((c, i) => `<button class="cand ${sh.picked === i ? 'on' : ''}" data-action="pick" data-i="${i}" aria-pressed="${sh.picked === i}">${I.pin}<span>${esc(c.label)}${c.doubt ? `<span class="doubt">${c.otherTown ? 'Otra población' : c.otherNumber ? 'Otro número' : 'Otra calle'}: compruébala</span>` : ''}</span></button>`).join('')}</div>`;
  }
  if (sh.candidates && !sh.candidates.length) return '<div class="hint" style="color:var(--warn)">No he encontrado esa dirección. Prueba con calle, número y población, o pega un enlace de Google Maps.</div>';
  return '';
}

function sheetStop(sh) {
  const d = sh.draft;
  const isClient = sh.mode === 'client';
  const remembered = !isClient && d.name && store.findClient(d.name);
  const names = store.clientList().map((c) => `<option value="${esc(c.name)}">`).join('');
  return `<h2 id="sheet-title">${isClient ? 'Cliente' : sh.id ? 'Editar parada' : 'Nueva parada'}</h2>
    <label class="field"><span>Cliente</span>
      <input class="input" id="f-name" list="client-names" value="${esc(d.name)}" placeholder="Ej. Vinos Paco" autocomplete="off">
      <datalist id="client-names">${names}</datalist>
    </label>
    ${remembered && !sh.id ? `<div class="hint"><span class="chip mem">Recordado</span> dirección y horario rellenados de la última vez</div>` : ''}
    <label class="field"><span>Dirección</span>
      <span class="input-row"><input class="input" id="f-address" value="${esc(d.address)}" placeholder="Calle, número, población" autocomplete="off">
      <button class="btn line" data-action="search-address" aria-label="Buscar dirección">${I.search}</button></span>
    </label>
    ${candidatesHtml(sh)}
    ${located(d) && !sh.candidates?.length ? `<div class="located">${I.pin}<span>${esc(d.label || 'Ubicación guardada')}</span></div>` : ''}

    <div class="field" style="margin-bottom:8px"><span class="small muted" style="font-weight:500" id="win-label">Horario en que acepta entregas</span></div>
    <div class="windows-edit" role="group" aria-labelledby="win-label">
      ${d.windows.map(([a, b], i) => `<div class="win-row">
        <input class="input" type="time" data-win="${i}" data-end="0" value="${fmt(a)}" aria-label="Franja ${i + 1}: desde">
        <span class="sep">a</span>
        <input class="input" type="time" data-win="${i}" data-end="1" value="${fmt(b)}" aria-label="Franja ${i + 1}: hasta">
        <button class="iconbtn" data-action="del-window" data-i="${i}" aria-label="Quitar franja ${i + 1}">${I.x}</button>
      </div>`).join('')}
    </div>
    ${d.windows.length ? '' : '<div class="hint">Sin horario: se le puede entregar a cualquier hora.</div>'}
    ${oddHours(d.windows) && !d.windowsConfirmed ? `<div class="notice warn" style="margin:10px 0 0">${I.warn}<div>Este horario de tarde parece un error del portal: de momento lo trato como si aceptara desde las 10:00. Llama al cliente, pon aquí arriba el horario que te diga y marca «Confirmado».</div></div>` : ''}
    <label class="toggle confirm"><span>Confirmado con el cliente<span class="tiny faint" style="display:block">${d.windowsConfirmed ? 'Este horario manda: el del portal ya no lo cambia.' : 'Márcalo cuando lo hayas hablado con él: la próxima vez saldrá este horario, no el del portal.'}</span></span><input type="checkbox" id="f-confirmed" ${d.windowsConfirmed ? 'checked' : ''}></label>
    <div class="presets">
      <button data-action="add-window" data-a="09:00" data-b="13:00">+ 9:00–13:00</button>
      <button data-action="add-window" data-a="10:00" data-b="13:00">+ 10:00–13:00</button>
      <button data-action="add-window" data-a="16:00" data-b="19:00">+ 16:00–19:00</button>
      <button data-action="add-window" data-other="1" data-a="08:00" data-b="12:00">+ Otra franja</button>
    </div>

    <div class="field" style="margin:14px 0 8px"><span class="small muted" style="font-weight:500" id="timing-label">Con el horario</span></div>
    <div class="seg timing" role="group" aria-labelledby="timing-label">
      ${TIMING.map(([v, l]) => `<button data-action="timing" data-v="${v}" class="${(d.timing || '') === v ? 'on' : ''}" aria-pressed="${(d.timing || '') === v}">${l}</button>`).join('')}
    </div>
    <div class="hint">${d.timing === 'strict' ? `Sin margen: planifico para llegar al menos ${STRICT_MARGIN} min antes de que cierre.`
      : d.timing === 'flex' ? `Margen ampliado: hasta ${LATE_OK_MORNING + FLEX_EXTRA} min tarde si cierra por la mañana y ${LATE_OK_AFTERNOON + FLEX_EXTRA} min si cierra a mediodía o más tarde.`
      : `Margen normal: hasta ${LATE_OK_MORNING} min tarde si cierra por la mañana y ${LATE_OK_AFTERNOON} min si cierra a mediodía o más tarde. Siempre te aviso.`}</div>

    <div class="input-row">
      <label class="field" style="flex:1"><span>Descarga (min)</span><input class="input" type="number" inputmode="numeric" id="f-service" value="${esc(d.service ?? settings().service)}" min="1" max="120"></label>
      <label class="field" style="flex:1.4"><span>Teléfono</span><input class="input" type="tel" id="f-phone" value="${esc(d.phone || '')}" placeholder="Opcional"></label>
    </div>
    ${serviceHint(sh)}
    <label class="field"><span>Notas para la entrega</span><textarea class="input notes-field" id="f-notes" rows="3" placeholder="Ej. entrar por la puerta de atrás o plaza DUM 08-123">${esc(d.notes || '')}</textarea></label>

    <div class="foot">
      <button class="btn gold big block" data-action="save-stop">${isClient ? 'Guardar cliente' : sh.id ? 'Guardar' : 'Añadir a la ruta'}</button>
      ${isClient ? `<button class="btn ghost block" data-action="client-to-route">Añadir a la ruta de ${esc(dayName(ui.date).rel.toLowerCase())}</button>` : ''}
      ${sh.id && !isClient ? '<button class="btn danger block" data-action="remove-stop">Quitar de la ruta</button>' : ''}
      ${isClient ? '<button class="btn danger block" data-action="forget-client">Olvidar este cliente</button>' : ''}
      <button class="btn ghost block" data-action="close">Cancelar</button>
    </div>`;
}

function serviceHint(sh) {
  const d = sh.draft;
  const mem = d.name && store.findClient(d.name);
  const parts = [];
  if (mem?.serviceLearned && mem.service === d.service) parts.push(`Aprendido de tus últimas ${mem.serviceLog.length} entregas aquí.`);
  if (d.service > DUM_MINUTES) parts.push(`Si aparcas en zona DUM, el máximo son ${DUM_MINUTES} min (60 con vehículo de cero emisiones).`);
  return parts.length ? `<div class="hint">${esc(parts.join(' '))}</div>` : '';
}

// Lo que llegó por un enlace o compartido (no de la APK con su código): puede mandarlo cualquiera.
const untrustedNotice = (sh) => (sh.untrusted ? `<div class="notice warn">${I.warn}<div>Esto ha llegado por un enlace o compartido, no desde tu app del portal. Añádelo solo si lo has mandado tú. No cambiará la dirección ni el teléfono de los clientes que ya tienes guardados.</div></div>` : '');

function sheetPaste(sh) {
  if (sh.portal) return sheetPortal(sh);
  const items = sh.parsed;
  return `<h2 id="sheet-title">Pegar lista</h2>
    <div class="small muted" style="margin:-6px 0 12px" id="paste-help">Copia las paradas del portal, de un mensaje o escríbelas tú: una por línea, o separadas por una línea en blanco. Si pones horarios (9:00-11:30, de 10 a 13h…) los leo.</div>
    ${untrustedNotice(sh)}
    <label class="field"><textarea class="input" id="f-paste" aria-label="Lista de paradas" aria-describedby="paste-help" placeholder="Vinos Paco - C/ Major 12, Sant Feliu - 9:00-11:30&#10;Bar La Plaça | Plaça de la Vila 3, Cornellà">${esc(sh.text || '')}</textarea></label>
    ${items ? `<h3 class="section-title" style="margin-top:4px">${items.length === 1 ? '1 parada detectada' : `${items.length} paradas detectadas`}</h3>
      <ul class="parsed">${items.map((it) => {
        const mem = store.findClient(it.name);
        return `<li><b>${esc(it.name)}</b>${mem ? ' <span class="chip mem">Recordado</span>' : ''}<div class="muted small">${esc(it.address || mem?.address || 'Sin dirección: la buscaré por el nombre')}</div>
          <div class="chips" style="margin-top:6px">${windowsChips(it.windows.length ? it.windows : mem?.windows)}</div></li>`;
      }).join('')}</ul>` : ''}
    <div class="foot">
      ${sh.busy ? `<button class="btn gold big block" disabled><span class="spin"></span>${esc(sh.busy)}</button>`
        : items ? `<button class="btn gold big block" data-action="paste-add">${items.length === 1 ? 'Añadir 1 parada' : `Añadir ${items.length} paradas`}</button>`
        : '<button class="btn gold big block" data-action="paste-read">Leer lista</button>'}
      <button class="btn ghost block" data-action="close">Cancelar</button>
    </div>`;
}

function sheetPortal(sh) {
  const { date, stops } = sh.portal;
  const have = new Set(store.route(date).stops.map((x) => clientKey(x.name)));
  const fresh = stops.filter((it) => !have.has(clientKey(it.name)));
  // Paradas que ya estaban pero sin la carga o las notas de factura que ahora trae el portal (traídas con una versión anterior).
  const reload = sh.untrusted ? 0 : stops.filter((it) => store.route(date).stops.some((x) => clientKey(x.name) === clientKey(it.name) && portalStale(x, it))).length;
  return `<h2 id="sheet-title">${sh.untrusted ? 'Ruta recibida' : 'Ruta del portal'}</h2>
    <div class="small muted" style="margin:-6px 0 12px">${esc(dayName(date).long)} · ${stops.length === 1 ? '1 parada' : `${stops.length} paradas`}${fresh.length < stops.length ? ` · ${stops.length - fresh.length} ya estaban en la ruta` : ''}</div>
    ${untrustedNotice(sh)}
    <ul class="parsed">${stops.map((it) => {
      const mem = store.findClient(it.name);
      const dup = have.has(clientKey(it.name));
      return `<li${dup ? ' style="opacity:.55"' : ''}><b>${esc(it.name)}</b>${mem ? ' <span class="chip mem">Recordado</span>' : ''}${dup ? ' <span class="chip any">Ya está</span>' : ''}
        <div class="muted small">${esc(it.address)}</div>
        <div class="chips" style="margin-top:6px">${it.closed ? '<span class="chip late">Ese día cierra</span>' : ''}${loadChip(it)}${mem?.windowsConfirmed ? `${windowsChips(mem.windows)}<span class="chip mem">Horario confirmado</span>` : `${windowsChips(it.windows.length ? it.windows : mem?.windows)}${oddHours(it.windows) ? '<span class="chip late">Horario raro</span>' : ''}`}</div></li>`;
    }).join('')}</ul>
    <div class="foot">
      ${sh.busy ? `<button class="btn gold big block" disabled><span class="spin"></span>${esc(sh.busy)}</button>`
        : fresh.length ? `<button class="btn gold big block" data-action="paste-add">${fresh.length === 1 ? 'Añadir 1 parada' : `Añadir ${fresh.length} paradas`} · ${esc(dayName(date).rel)}</button>`
        : reload ? `<button class="btn gold big block" data-action="paste-add">Poner al día ${plural(reload, 'parada', 'paradas')}</button>`
        : '<button class="btn gold big block" data-action="close">Ya las tienes todas</button>'}
      <button class="btn ghost block" data-action="close">Cancelar</button>
    </div>`;
}

function sheetDepot(sh) {
  return `<h2 id="sheet-title">Punto de salida</h2>
    <label class="field"><span>Dirección del almacén</span>
      <span class="input-row"><input class="input" id="f-address" value="${esc(sh.draft.address || '')}" placeholder="Calle, número, población">
      <button class="btn line" data-action="search-address" aria-label="Buscar dirección">${I.search}</button></span>
    </label>
    ${candidatesHtml(sh)}
    <div class="foot">
      <button class="btn gold big block" data-action="save-depot" ${located(sh.draft) ? '' : 'disabled'}>Guardar</button>
      <button class="btn ghost block" data-action="reset-depot">Volver a Comercial Escolà</button>
      <button class="btn ghost block" data-action="close">Cancelar</button>
    </div>`;
}

// Copia lo escrito en el formulario al borrador antes de redibujar.
function syncDraft() {
  const sh = ui.sheet;
  if (!sh) return;
  if (!sh.draft) { if (sh.kind === 'paste') sh.text = $('#f-paste')?.value ?? sh.text; return; }
  const d = sh.draft;
  const v = (id) => $(id)?.value;
  if ($('#f-name')) d.name = v('#f-name').trim();
  if ($('#f-address')) setDraftAddress(sh, v('#f-address').trim());
  if ($('#f-service')) d.service = Math.min(180, Math.max(1, parseInt(v('#f-service'), 10) || settings().service));
  if ($('#f-phone')) d.phone = v('#f-phone').trim();
  if ($('#f-notes')) d.notes = v('#f-notes').trim();
  if ($('#f-confirmed')) d.windowsConfirmed = $('#f-confirmed').checked;
  document.querySelectorAll('[data-win]').forEach((inp) => {
    const i = +inp.dataset.win, end = +inp.dataset.end;
    const m = toMin(inp.value);
    if (m != null && d.windows[i]) d.windows[i][end] = m;
  });
  d.windows = d.windows.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
}

// Si cambia el texto de la dirección, la ubicación anterior ya no vale.
function setDraftAddress(sh, addr) {
  const d = sh.draft;
  if (addr === (d.address || '')) return;
  d.address = addr;
  d.lat = null; d.lon = null; d.label = '';
  sh.candidates = null; sh.picked = null;
}

function stopDraft(src = {}) {
  return {
    name: src.name || '',
    address: src.address || '',
    lat: located(src) ? src.lat : null,
    lon: located(src) ? src.lon : null,
    label: src.label || '',
    windows: (src.windows || []).map((w) => [...w]),
    service: src.service ?? settings().service,
    timing: src.timing || '',
    windowsConfirmed: !!src.windowsConfirmed,
    phone: src.phone || '', notes: src.notes || '',
    needsCheck: !!src.needsCheck,
  };
}

async function searchAddress() {
  const sh = ui.sheet;
  if (!sh || sh.searching) return;
  syncDraft();
  const byName = sh.kind === 'stop' && !sh.draft.address;
  const q = byName ? sh.draft.name : sh.draft.address;
  if (!q) return toast('Escribe una dirección o el nombre del local');
  const direct = coordsFromText(sh.draft.address);
  sh.searching = true; sh.candidates = null; renderSheet();
  let res = null, error = null;
  try {
    res = await geocode(q, { kind: byName ? 'name' : 'address' });
    // Si con la dirección no sale nada, prueba a buscar el local por su nombre.
    if (!res.length && sh.draft.name && sh.draft.address && !direct) res = await geocode(`${sh.draft.name}, ${sh.draft.address}`, { kind: 'name' });
  } catch (e) {
    error = e;
  }
  sh.searching = false;
  if (ui.sheet !== sh) return; // la hoja se cerró mientras buscaba
  syncDraft(); // no perder lo escrito mientras tanto
  if (error) { sh.candidates = null; toast(error.message || 'No se pudo buscar'); }
  else {
    sh.candidates = res.slice(0, 5);
    if (res.length === 1 && !res[0].doubt) pickCandidate(sh, 0);
  }
  renderSheet();
}

function pickCandidate(sh, i) {
  const c = sh.candidates?.[i];
  if (!c) return;
  sh.picked = i;
  Object.assign(sh.draft, { lat: c.lat, lon: c.lon, label: c.label, needsCheck: false });
}

function fillFromMemory() {
  const sh = ui.sheet;
  if (!sh || sh.kind !== 'stop' || sh.id || sh.mode === 'client') return;
  const mem = store.findClient($('#f-name')?.value || '');
  if (!mem) return;
  syncDraft();
  const d = sh.draft;
  if (!d.address) Object.assign(d, { address: mem.address, lat: located(mem) ? mem.lat : null, lon: located(mem) ? mem.lon : null, label: mem.label || '', needsCheck: !!mem.needsCheck });
  if (!d.windows.length && mem.windows?.length) d.windows = mem.windows.map((w) => [...w]);
  d.service = mem.service ?? d.service;
  d.timing = d.timing || mem.timing || '';
  if (mem.windowsConfirmed && mem.windows?.length) { d.windows = mem.windows.map((w) => [...w]); d.windowsConfirmed = true; }
  d.phone = d.phone || mem.phone || '';
  d.notes = d.notes || mem.notes || '';
  d.name = mem.name;
  renderSheet();
}

// Lo que se guarda de una parada / cliente. lat/lon a null = sin ubicar (también borra una ubicación vieja).
function stopFields(d) {
  const loc = located(d);
  return {
    name: d.name, address: d.address,
    lat: loc ? d.lat : null, lon: loc ? d.lon : null, label: loc ? d.label || '' : '',
    windows: d.windows, windowsConfirmed: !!d.windowsConfirmed && d.windows.length > 0, service: d.service, timing: d.timing || '', phone: d.phone, notes: d.notes,
    needsCheck: loc ? !!d.needsCheck : false,
  };
}

async function saveStop() {
  const sh = ui.sheet;
  if (!sh || sh.saving) return false;
  syncDraft();
  const d = sh.draft;
  if (!d.name && !d.address) { toast('Pon al menos el nombre o la dirección'); return false; }
  if (!d.name) d.name = d.address.slice(0, 120);
  // Quien guarda la ficha ha visto la ubicación que se muestra en ella: se da por revisada.
  if (located(d)) d.needsCheck = false;
  else if (d.address) {
    // Guardar sin pasar por "buscar": tomo el primer resultado y lo marco para revisar.
    sh.saving = true;
    try {
      const [hit] = await geocode(d.address);
      // Un resultado dudoso (otra población u otra calle) no se usa: desviaría la ruta sin que te dieras cuenta.
      if (hit && !hit.doubt) Object.assign(d, { lat: hit.lat, lon: hit.lon, label: hit.label, needsCheck: true });
    } catch { /* se queda sin ubicar */ }
    sh.saving = false;
    if (ui.sheet !== sh) return false;
  }
  const fields = stopFields(d);
  const renamedFrom = sh.mode === 'client' ? sh.key : undefined;
  if (JSON.parse(sh.initial).service !== d.service) Object.assign(fields, { serviceLog: [], serviceLearned: false });
  const isDemo = sh.id && currentRoute().stops.find((x) => x.id === sh.id)?.demo;
  if (!isDemo) store.rememberClient(fields, { renamedFrom });

  if (sh.mode !== 'client') {
    const r = currentRoute();
    const { serviceLog, serviceLearned, ...stopData } = fields;
    if (sh.id) {
      const s = r.stops.find((x) => x.id === sh.id);
      if (s) Object.assign(s, stopData);
    } else {
      r.stops.push({ id: uid(), ...stopData, done: false });
      if (r.status === 'done') r.status = 'draft';
    }
    store.save();
    closeSheet();
    if (r.status === 'active') { replanActive('Parada actualizada'); return true; }
    toast(located(fields) ? (sh.id ? 'Parada guardada' : 'Parada añadida') : 'Guardada sin ubicar: búscala para incluirla');
  } else {
    closeSheet();
    toast('Cliente guardado');
  }
  render();
  return true;
}

// ---------- Planificar ----------

function routeStopsForPlan(r) {
  return r.stops.filter((s) => !s.done && located(s)).map(planStop);
}

// recalc: el botón Recalcular. El día de la ruta se calcula saliendo ahora, con el tráfico de ahora.
async function optimize({ recalc = false } = {}) {
  const r = currentRoute();
  const s = settings();
  const stops = routeStopsForPlan(r);
  if (!stops.length) return toast('No hay paradas ubicadas');
  const today = ui.date === todayIso();
  let startMin = toMin(s.shiftStart) ?? 450;
  const departAt = new Date(ui.date + 'T00:00:00');
  if (today && nowMin() > startMin) startMin = Math.ceil(nowMin());
  departAt.setMinutes(startMin);
  const live = recalc && today;
  const before = r.plan && !isDirty(r) ? r.plan.order.join() : null;
  ui.busy = live && s.tomtomKey ? 'Mirando el tráfico ahora mismo…' : s.tomtomKey && s.orsKey ? 'Calculando con el tráfico previsto…' : 'Calculando la mejor ruta…';
  render();
  try {
    const plan = await computePlan({ from: s.depot, depot: s.depot, stops, startMin, departAt, orsKey: s.orsKey, tomtomKey: s.tomtomKey, live, pairs: {}, returnToDepot: s.returnToDepot, parking: parkingFor(r), fixedOrder: r.manual || null });
    r.pairs = plan.pairs; delete plan.pairs;
    r.plan = plan; r.planSig = signature(r); r.status = 'planned';
    store.save();
    const what = r.manual ? `Horas con tu orden · vuelta ${fmt(plan.end)}${plan.late > 0.5 ? ' · alguien queda fuera de horario' : ''}`
      : !recalc ? 'Ruta optimizada'
      : before && before !== plan.order.join() ? `He cambiado el orden · vuelta ${fmt(plan.end)}` : `Mismo orden · vuelta ${fmt(plan.end)}`;
    toast(plan.warning ? `Ruta aproximada (${plan.warning}). Revisa la clave en Ajustes.` : what, plan.warning ? 6000 : 3200);
  } catch (e) {
    toast(friendlyError(e), 4000);
  }
  ui.busy = null;
  render();
}

function friendlyError(e) {
  if (!navigator.onLine || e?.name === 'TimeoutError' || e?.name === 'TypeError') return 'Sin conexión o muy lenta. Prueba de nuevo cuando tengas cobertura.';
  return e?.message || 'Algo ha fallado al calcular la ruta';
}

// Empieza la ruta con el orden que hay. Para mirar el tráfico de ese momento está «Recalcular».
function startRoute() {
  const r = currentRoute();
  if (!r.plan || isDirty(r)) return optimize();
  r.status = 'active'; r.current = r.plan.order[0]; r.startedAt = Date.now(); r.postponed = []; r.lastChange = null;
  markCurrent(r, r.plan.legs[0], Date.now());
  store.save();
  render();
  window.scrollTo({ top: 0, behavior: smooth() });
}

// Recalcula lo que queda desde donde estás (GPS o la última parada) con tráfico en vivo.
async function replanActive(msg) {
  const r = currentRoute();
  const s = settings();
  ui.busy = 'Calculando la siguiente…';
  render();
  const gps = await currentPosition(4000);

  // Se mira qué queda después de esperar al GPS, por si algo cambió mientras tanto.
  const pending = r.stops.filter((x) => !x.done && located(x));
  if (!pending.length) {
    r.status = 'done'; r.current = null; r.pairs = {};
    store.save(); ui.busy = null; render();
    window.scrollTo({ top: 0, behavior: smooth() });
    return toast('¡Ruta terminada!');
  }
  r.postponed = (r.postponed || []).filter((id) => pending.some((p) => p.id === id));
  const postponed = new Set(r.postponed.length < pending.length ? r.postponed : []);
  const active = pending.filter((p) => !postponed.has(p.id));
  const lastDone = r.stops.filter((x) => x.done).sort((a, b) => b.doneAt - a.doneAt)[0];
  const from = gps && gps.accuracy < 1000 ? gps : lastDone && located(lastDone) ? lastDone : s.depot;
  // Si la última entrega era de un aparcamiento que aún tiene entregas, la furgoneta sigue allí: se sale a pie.
  const parking = parkingFor(r);
  const g = lastDone ? parking.findIndex((p) => p.ids.includes(lastDone.id)) : -1;
  const parkedAt = g >= 0 && parking[g].ids.some((id) => active.some((a) => a.id === id)) ? g : null;
  try {
    const plan = await computePlan({
      from, depot: s.depot, startMin: nowMin(), departAt: new Date(), orsKey: s.orsKey, tomtomKey: s.tomtomKey, live: true,
      stops: active.map(planStop), pairs: r.pairs || {}, returnToDepot: s.returnToDepot, parking, parkedAt, fixedOrder: r.manual || null,
    });
    r.pairs = plan.pairs; delete plan.pairs;
    plan.order.push(...r.postponed.filter((id) => postponed.has(id)));
    r.plan = plan; r.planSig = signature(r);
    r.current = plan.order[0];
    markCurrent(r, plan.legs[0], Date.now());
    const next = r.stops.find((x) => x.id === r.current);
    const leg = plan.legs[0];
    if (plan.warning) toast(`Siguiente: ${next.name} · ruta aproximada (${plan.warning})`, 5000);
    else if (msg !== null) toast(msg || `Siguiente: ${next.name}${leg ? ` · llegada ${fmt(leg.arrive)}` : ''}`, 3200);
  } catch {
    // Sin red: siguiente del orden previsto.
    const order = (r.plan?.order || []).filter((id) => active.some((p) => p.id === id));
    r.current = order[0] || active[0].id;
    r.plan = { ...(r.plan || {}), order: [...order, ...active.filter((p) => !order.includes(p.id)).map((p) => p.id), ...[...postponed]] };
    toast('Sin conexión: sigo el orden previsto', 3200);
  }
  r.lastChange = null;
  store.save();
  ui.busy = null;
  render();
  window.scrollTo({ top: 0, behavior: smooth() });
}

// Apunta cuándo sales hacia la parada actual y cuánto se prevé de viaje y de espera: al entregarla,
// lo que sobra es lo que has tardado en descargar.
function markCurrent(r, leg, since) {
  const cur = r.stops.find((x) => x.id === r.current);
  if (!cur || !leg || leg.id !== cur.id) return;
  cur.trip = { since, drive: leg.drive, wait: leg.wait || 0 };
}

function learnFrom(cur) {
  if (!cur.trip) return;
  const minutes = (Date.now() - cur.trip.since) / 60000 - cur.trip.drive - cur.trip.wait;
  delete cur.trip;
  store.learnService(cur.name, minutes);
}

// Marca la parada actual como hecha y pasa a la siguiente, con opción de deshacer.
async function finishCurrent() {
  const r = currentRoute();
  const cur = r.stops.find((x) => x.id === r.current && !x.done);
  if (!cur) return;
  cur.done = true; cur.doneAt = Date.now();
  delete cur.failed;
  const mem = store.findClient(cur.name);
  if (mem) store.rememberClient({ name: mem.name, visits: (mem.visits || 0) + 1, lastVisit: ui.date });
  learnFrom(cur);
  delete cur.trip;
  // Con un aparcamiento, la validación de SPRO sigue valiendo mientras quede alguna entrega suya.
  const park = parkingOf(r, cur.id);
  const staying = park && r.dum?.group === groupKey(park.ids) && park.ids.some((id) => r.stops.find((x) => x.id === id && !x.done));
  if (!staying && (r.dum?.id === cur.id || r.dum?.group)) r.dum = null;
  r.postponed = (r.postponed || []).filter((id) => id !== cur.id);
  store.save();
  await replanActive(null);
  const r2 = currentRoute();
  const next = r2.stops.find((x) => x.id === r2.current);
  const what = `Hecha: ${cur.name}`;
  toast(next && r2.status === 'active' ? `${what} · siguiente: ${next.name}` : what, 6000, { label: 'Deshacer', fn: () => undoLast() });
}

function undoLast() {
  if (ui.busy) return;
  const r = currentRoute();
  const last = r.stops.filter((x) => x.done).sort((a, b) => b.doneAt - a.doneAt)[0];
  if (!last) return;
  last.done = false; delete last.doneAt;
  if (!last.failed) {
    const mem = store.findClient(last.name);
    if (mem?.visits) store.rememberClient({ name: mem.name, visits: mem.visits - 1 });
  }
  delete last.failed;
  r.status = 'active'; r.current = last.id;
  r.plan = { ...(r.plan || { legs: [] }), order: [last.id, ...(r.plan?.order || []).filter((id) => id !== last.id)] };
  store.save(); render(); toast(`${last.name} vuelve a estar pendiente`);
}

// ---------- Eventos ----------

// Mientras se calcula algo de la ruta, estas acciones esperan: evita estados a medias.
const BLOCKED_WHILE_BUSY = new Set(['open-reorder', 'reorder-save', 'order-auto', 'next', 'postpone', 'undo', 'edit-stop', 'recalc', 'start-route', 'park-clear', 'optimize', 'stop-route', 'open-stop', 'open-paste', 'remove-stop', 'day', 'demo', 'clear-demo', 'park-undo', 'open-map']);

const actions = {
  tab: async (el) => { if (!(await requestCloseSheet())) return; ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  day: (el) => { ui.date = addDays(ui.date, +el.dataset.d); render(); },
  'goto-tomorrow': () => { ui.date = addDays(todayIso(), 1); render(); },
  optimize: () => optimize(),
  recalc: () => (currentRoute().status === 'active' ? replanActive('Recalculada con el tráfico de ahora') : optimize({ recalc: true })),
  'start-route': () => startRoute(),
  next: () => finishCurrent(),
  postpone: () => {
    const r = currentRoute();
    if (ui.sheet) closeSheet();
    r.postponed = [...new Set([...(r.postponed || []), r.current])];
    store.save();
    replanActive('Dejada para el final');
  },
  undo: () => undoLast(),
  'open-reorder': () => {
    const ids = reorderIds(currentRoute());
    if (ids.length < 2) return toast('Hace falta más de una parada pendiente');
    openSheet({ kind: 'reorder', order: ids });
  },
  'reorder-move': (el) => {
    const o = ui.sheet?.order;
    if (!o) return;
    const i = o.indexOf(el.dataset.id), j = i + Number(el.dataset.d);
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    renderSheet();
    // El foco sigue en la misma flecha, para mover varias posiciones seguidas (también con lector de pantalla).
    const sel = `[data-action="reorder-move"][data-id="${CSS.escape(el.dataset.id)}"]`;
    const again = $(`${sel}[data-d="${el.dataset.d}"]`);
    (again && !again.disabled ? again : $(`${sel}:not([disabled])`))?.focus({ preventScroll: true });
  },
  'reorder-save': async () => {
    const r = currentRoute();
    r.manual = [...ui.sheet.order];
    closeSheet();
    store.save();
    if (r.status === 'active') await replanActive('Orden cambiado');
    else await optimize();
  },
  'order-auto': async () => {
    const r = currentRoute();
    r.manual = null;
    if (ui.sheet) closeSheet();
    store.save();
    if (r.status === 'active') await replanActive('Vuelta al orden óptimo');
    else await optimize();
  },
  'stop-route': async () => {
    if (!(await ask('¿Volver a planificar? Las paradas hechas se mantienen marcadas.', { ok: 'Volver a planificar' }))) return;
    const r = currentRoute();
    r.status = 'draft'; r.current = null; r.plan = null; r.lastChange = null;
    store.save(); render();
  },
  'dismiss-change': () => { currentRoute().lastChange = null; store.save(); render(); },
  'open-stop': () => openSheet({ kind: 'stop', draft: stopDraft() }),
  'edit-stop': (el) => {
    const s = currentRoute().stops.find((x) => x.id === el.dataset.id);
    if (s) openSheet({ kind: 'stop', id: s.id, draft: stopDraft(s) });
  },
  'edit-client': (el) => {
    const c = store.findClient(store.db().clients[el.dataset.key]?.name || '');
    if (c) openSheet({ kind: 'stop', mode: 'client', key: c.key, draft: stopDraft(c) });
  },
  'open-paste': () => openSheet({ kind: 'paste', text: '' }),
  'paste-read': () => {
    syncDraft();
    const portal = parsePortal(ui.sheet.text);
    if (portal) { ui.sheet.portal = portal; ui.sheet.parsed = portal.stops; return renderSheet(); }
    const parsed = parseList(ui.sheet.text);
    if (!parsed.length) return toast('No veo ninguna parada en el texto');
    ui.sheet.parsed = parsed;
    renderSheet();
  },
  'paste-add': () => pasteAdd(),
  'search-address': () => searchAddress(),
  pick: (el) => { syncDraft(); pickCandidate(ui.sheet, +el.dataset.i); renderSheet(); },
  'add-window': (el) => {
    syncDraft();
    const d = ui.sheet.draft;
    let a = toMin(el.dataset.a), b = toMin(el.dataset.b);
    if (el.dataset.other && d.windows.length) { a = Math.min(d.windows[d.windows.length - 1][1] + 60, 22 * 60); b = Math.min(a + 180, 23 * 60 + 59); }
    d.windows.push([a, b]);
    d.windows.sort((x, y) => x[0] - y[0]);
    renderSheet();
  },
  'del-window': (el) => { syncDraft(); ui.sheet.draft.windows.splice(+el.dataset.i, 1); renderSheet(); },
  'save-stop': () => saveStop(),
  'remove-stop': async () => {
    const r = currentRoute();
    const id = ui.sheet.id;
    const s = r.stops.find((x) => x.id === id);
    if (!(await ask(`¿Quitar ${s?.name || 'esta parada'} de la ruta?`, { ok: 'Quitar', danger: true }))) return;
    const idx = r.stops.indexOf(s);
    r.stops = r.stops.filter((x) => x.id !== id);
    if (r.current === id) r.current = null;
    store.save(); closeSheet();
    const restore = () => { r.stops.splice(idx, 0, s); store.save(); if (r.status === 'active') replanActive('Parada recuperada'); else render(); };
    if (r.status === 'active') replanActive(null).then(() => toast('Parada quitada', 6000, { label: 'Deshacer', fn: restore }));
    else { render(); toast('Parada quitada', 6000, { label: 'Deshacer', fn: restore }); }
  },
  'forget-client': async () => {
    const key = ui.sheet.key;
    if (!(await ask('¿Olvidar este cliente? Se borra su dirección y horario guardados.', { ok: 'Olvidar', danger: true }))) return;
    store.forgetClient(key); closeSheet(); render();
  },
  'client-to-route': async () => {
    syncDraft();
    const name = ui.sheet.draft.name || ui.sheet.draft.address;
    if (!(await saveStop())) return;
    const target = store.findClient(name);
    if (!target) return;
    const r = currentRoute();
    r.stops.push({ id: uid(), ...stopFields(stopDraft(target)), done: false });
    if (r.status === 'done') r.status = 'draft';
    store.save();
    ui.tab = 'route';
    if (r.status === 'active') return replanActive(`${target.name} añadido a la ruta`);
    render();
    toast(`${target.name} añadido a ${dayName(ui.date).rel.toLowerCase()}`);
  },
  close: () => requestCloseSheet(),
  'nav-app': (el) => { store.setSettings({ nav: el.dataset.v === 'gmaps' ? 'gmaps' : 'waze' }); render(); },
  'test-key': () => testKey(),
  'test-ors': () => testOrs(),
  'change-depot': () => openSheet({ kind: 'depot', draft: { address: '', lat: null, lon: null, label: '' } }),
  'save-depot': () => {
    const d = ui.sheet.draft;
    if (!located(d)) return;
    store.setSettings({ depot: { name: (d.label || d.address).slice(0, 120), lat: d.lat, lon: d.lon } });
    closeSheet(); render(); toast('Punto de salida cambiado');
  },
  'reset-depot': () => { store.setSettings({ depot: store.DEFAULT_DEPOT }); closeSheet(); render(); toast('Salida: Comercial Escolà'); },
  export: () => exportClients(),
  'export-config': () => exportConfig(),
  demo: () => loadDemo(),
  'clear-demo': () => clearDemo(),
  backup: () => backup(),
  spro: () => {
    const r = currentRoute();
    // Se redibuja después: si el enlace desaparece antes de abrirse, Android no llega a abrir SPRO.
    if (r.current) {
      const park = parkingOf(r, r.current);
      r.dum = { id: r.current, at: Date.now(), group: park ? groupKey(park.ids) : undefined };
      store.save(); setTimeout(render, 600);
    }
  },
  'apply-update': () => applyUpdate(),
  timing: (el) => { syncDraft(); ui.sheet.draft.timing = el.dataset.v; renderSheet(); },
  'park-undo': (el) => {
    const r = currentRoute();
    r.parking = (r.parking || []).filter((p) => groupKey(p.ids) !== el.dataset.key);
    store.save();
    if (r.status === 'active') replanActive('Aparcamiento quitado'); else optimize();
  },
  'park-clear': () => clearParking(),
  'open-map': () => import('./map.js').then((m) => m.openMap(mapApi())).catch(() => toast('No se ha podido abrir el mapa')),
};

// Lo que el portal trae de nuevo para una parada que ya estaba en la ruta: la carga y las notas de la factura.
const sameLoad = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
const newInvoiceLines = (x, it) => String(it.notes || '').split('\n').filter((l) => l.startsWith('Factura: ') && !String(x.notes || '').includes(l));
const portalStale = (x, it) => (it.load && !sameLoad(x.load, it.load)) || newInvoiceLines(x, it).length > 0;

async function pasteAdd() {
  const sh = ui.sheet;
  if (sh.busy) return;
  const portal = sh.portal;
  if (portal) ui.date = portal.date;
  const r = currentRoute();
  const have = new Set(r.stops.map((x) => clientKey(x.name)));
  const untrusted = !!sh.untrusted;
  if (portal && !untrusted) {
    for (const it of sh.parsed) {
      const old = r.stops.find((x) => clientKey(x.name) === clientKey(it.name));
      if (!old) continue;
      if (it.load) old.load = it.load;
      const add = newInvoiceLines(old, it);
      if (add.length) old.notes = [old.notes, ...add].filter(Boolean).join('\n').slice(0, 500);
    }
  }
  const items = portal ? sh.parsed.filter((it) => !have.has(clientKey(it.name))) : sh.parsed;
  if (portal && !items.length) {
    store.save(); closeSheet(); render();
    return toast('Paradas puestas al día');
  }
  let n = 0, unlocated = 0;
  for (const it of items) {
    n++;
    sh.busy = `Buscando direcciones ${n}/${items.length}…`;
    renderSheet();
    const mem = store.findClient(it.name);
    const stop = stopDraft(mem || {});
    stop.name = (mem?.name || it.name).slice(0, 120);
    if (mem?.windowsConfirmed && mem.windows?.length) stop.windows = mem.windows.map((w) => [...w]);
    else if (it.windows.length) stop.windows = it.windows;
    // Lo recibido por un enlace no cambia a un cliente que ya tienes: se usan su dirección y su teléfono guardados.
    const keepMem = untrusted && !!mem;
    if (it.phone && !(keepMem && mem.phone)) stop.phone = it.phone;
    const addressChanged = !keepMem && it.address && clientKey(it.address) !== clientKey(mem?.address || '');
    if (it.address && !(keepMem && mem.address)) stop.address = it.address;
    if (!mem || addressChanged || !located(stop)) {
      stop.lat = null; stop.lon = null; stop.label = '';
      try {
        const [hit] = await geocode(stop.address || it.name, { kind: stop.address ? 'address' : 'name' });
        if (hit && !hit.doubt) Object.assign(stop, { lat: hit.lat, lon: hit.lon, label: hit.label, needsCheck: true });
      } catch { /* queda sin ubicar */ }
    }
    if (!located(stop)) unlocated++;
    const fields = stopFields(stop);
    if (keepMem) fields.notes = [mem.notes, portal ? it.notes : ''].filter(Boolean).join('\n').slice(0, 500);
    else if (portal) {
      // Del portal se recuerda dónde está y el teléfono; el horario solo si vale para todos los días.
      store.rememberClient({ ...fields, notes: undefined, windowsConfirmed: undefined,
        windows: mem?.windowsConfirmed || !it.clientWindows.length ? undefined : it.clientWindows });
      fields.notes = [mem?.notes, it.notes].filter(Boolean).join('\n').slice(0, 500);
    } else store.rememberClient(fields);
    r.stops.push({ id: uid(), ...fields, ...(portal && it.load ? { load: it.load } : {}), done: false });
  }
  if (r.status === 'done') r.status = 'draft';
  store.save();
  sh.busy = null;
  closeSheet();
  const added = items.length === 1 ? '1 parada añadida' : `${items.length} paradas añadidas`;
  toast(unlocated ? `${added} · ${unlocated} sin ubicar` : added);
  if (r.status === 'active') return replanActive(null);
  if (r.stops.some(located)) await optimize(); else render();
}

const PROBE = [{ lat: 41.372083, lon: 2.077356 }, { lat: 41.3756, lon: 2.1316 }]; // almacén → Carrer de Sants

async function testKey() {
  const key = $('#set-key').value.trim();
  store.setSettings({ tomtomKey: key });
  if (!key) { render(); return toast('Clave de TomTom quitada: tráfico estimado'); }
  try {
    const legs = await trafficLegs(PROBE, { key, live: true });
    if (!legs) throw new Error('TomTom no ha respondido; prueba en un rato');
    toast(`Clave correcta: tráfico real activado ✓ (almacén → Sants ahora: ${Math.round(legs[0])} min)`, 4000);
  } catch (e) {
    toast(e.message || 'La clave no funciona', 4000);
  }
  render();
}

async function testOrs() {
  const key = $('#set-ors').value.trim();
  store.setSettings({ orsKey: key });
  if (!key) { render(); return toast('Clave de rutas quitada'); }
  try {
    const mx = await travelMatrix([PROBE[0]], [PROBE[1]], { orsKey: key, departAt: new Date() });
    toast(`Clave correcta ✓ (almacén → Sants: ${mx.km[0][0].toFixed(1)} km)`, 4000);
  } catch (e) {
    toast(e.message || 'La clave no funciona', 4000);
  }
  render();
}

function shareFile(json, name, title) {
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title }).then(() => true, () => false);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return Promise.resolve(true);
}

function exportClients() {
  shareFile(store.exportClients(), `clientes-ruta-${todayIso()}.json`, 'Clientes · Ruta Escolà');
}

async function exportConfig() {
  // Sin claves, pero con las direcciones y teléfonos de los clientes: por privado y solo a compañeros.
  const ok = await ask('El archivo lleva el almacén y tus clientes (direcciones y teléfonos), sin tus claves. Pásalo solo por privado a compañeros de Escolà.', { ok: 'Pasar' });
  if (ok) shareFile(store.exportConfig(), `configuracion-ruta-${todayIso()}.json`, 'Configuración · Ruta Escolà');
}

async function backup() {
  const ok = await shareFile(store.exportBackup(), `copia-ruta-escola-${todayIso()}.json`, 'Copia de seguridad · Ruta Escolà');
  if (ok) { store.markBackup(); toast('Copia guardada ✓'); render(); }
}

// ---------- Actualizaciones ----------

function renderUpdate() {
  const el = $('#update');
  el.hidden = !ui.update;
  el.innerHTML = ui.update ? `<span>Hay una versión nueva de la app.</span><button class="btn gold" data-action="apply-update">Actualizar</button>` : '';
}

function applyUpdate() {
  if (ui.sheet || ui.busy) return toast('Termina lo que estás haciendo y vuelve a pulsar Actualizar');
  ui.update?.postMessage('SKIP_WAITING');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // Solo se recarga al cambiar de versión, no la primera vez que el service worker toma el control.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => { if (w && navigator.serviceWorker.controller) { ui.update = w; renderUpdate(); } };
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

// ---------- Escuchas ----------

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-toast-action]')) {
    const fn = toast._action;
    $('#toast').classList.remove('show');
    toast._action = null;
    fn?.();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) {
    if (!el.dataset.keepDefault) e.preventDefault();
    if (ui.busy && BLOCKED_WHILE_BUSY.has(el.dataset.action)) return;
    actions[el.dataset.action](el);
    return;
  }
  if (e.target.id === 'sheet') requestCloseSheet(); // tocar fuera de la hoja
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'f-name') fillFromMemory();
  if (t.id === 'f-confirmed' && ui.sheet?.draft) { syncDraft(); renderSheet(); }
  if (t.id === 'f-address' && ui.sheet?.draft) {
    // Sin redibujar, para no perder el toque en "buscar".
    setDraftAddress(ui.sheet, t.value.trim());
    if (!located(ui.sheet.draft)) $('.located')?.remove();
  }
  if (t.dataset.win !== undefined) syncDraft();
  if (t.id === 'set-shift') store.setSettings({ shiftStart: t.value || '07:30' });
  if (t.id === 'set-service') store.setSettings({ service: Math.min(180, Math.max(1, parseInt(t.value, 10) || 10)) });
  if (t.id === 'set-return') store.setSettings({ returnToDepot: t.checked });
  if (t.id === 'set-windows') { store.setSettings({ useWindows: t.checked }); render(); }
  if (t.id === 'set-key') store.setSettings({ tomtomKey: t.value.trim() });
  if (t.id === 'set-ors') store.setSettings({ orsKey: t.value.trim() });
  if (t.id === 'import-file' && t.files[0]) {
    t.files[0].text().then(async (txt) => {
      t.value = '';
      try {
        let applied = [];
        const data = JSON.parse(txt);
        if (data?.kind === 'config') {
          const n = Object.keys(data.clients || {}).length;
          const ok = await ask(`Configuración de un compañero: almacén, horario y ${plural(n, 'cliente', 'clientes')}. Sus claves no: pon las tuyas en Ajustes. ¿Aplicarla? No se borra nada tuyo.`, { ok: 'Aplicar' });
          if (!ok) return;
          applied = store.applyConfig(data.settings);
        }
        const { added, updated, routes } = store.importClients(txt);
        toast([applied.length ? `Listo: ${applied.join(', ')}` : '', `${plural(added, 'cliente nuevo', 'clientes nuevos')} · ${updated} actualizados`,
          routes ? plural(routes, 'ruta recuperada', 'rutas recuperadas') : ''].filter(Boolean).join(' · '), 5000);
        render();
      } catch (err) {
        toast(/grande/.test(err.message) ? 'El archivo es demasiado grande' : 'Ese archivo no es de la app Ruta');
      }
    });
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'client-search') {
    ui.clientFilter = e.target.value;
    const pos = e.target.selectionStart;
    $('#view').innerHTML = renderClients();
    const inp = $('#client-search');
    inp.focus(); inp.setSelectionRange(pos, pos);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#ask').hidden) return; // la pregunta se cierra con sus botones
  if (e.key === 'Escape' && ui.sheet) requestCloseSheet();
  if (e.key === 'Enter' && e.target.id === 'f-address') { e.preventDefault(); searchAddress(); }
});

// Al volver a la app (p. ej. desde Waze), refresca horas y estado.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !ui.sheet && !ui.busy) render(); });

// La cuenta atrás de la zona DUM se actualiza cada 20 s sin redibujar la pantalla.
setInterval(() => {
  const chip = $('#dum-chip');
  if (!chip || ui.tab !== 'route') return;
  const r = currentRoute();
  const cur = r.stops.find((x) => x.id === r.current && !x.done);
  if (cur) chip.outerHTML = dumChip(r, cur);
}, 20000);

// ---------- Recibir una lista compartida (WhatsApp, portal, correo…) ----------

// La APK (desde la 1.2.0) tiene una pantalla con el portal que trae la ruta; se abre con este enlace.
// Lleva un código que solo conoce esta web (en este móvil): la APK 1.5.0 lo devuelve con la ruta y así se sabe
// que la ruta viene de ella y no de un enlace que alguien te ha mandado.
const NONCE_KEY = 'ruta-portal-n';
const storedNonce = () => { try { return localStorage.getItem(NONCE_KEY) || ''; } catch { return ''; } };
function portalIntent() {
  let n = storedNonce();
  if (!/^[0-9a-f-]{36}$/i.test(n)) {
    n = crypto.randomUUID();
    try { localStorage.setItem(NONCE_KEY, n); } catch { /* sin almacenamiento: la ruta llegará sin verificar */ }
  }
  return `intent://portal#Intent;scheme=rutaescola;package=com.flixescola.ruta;S.n=${n};end`;
}

function portalApp() {
  try {
    const [major, minor] = (localStorage.getItem('ruta-apk') || '').split('.').map(Number);
    return major > 1 || (major === 1 && minor >= 2);
  } catch { return false; }
}

// Lo que llega al abrir la app: una lista compartida (?text=), la ruta del portal que manda la APK
// (#portal=, que nunca sale del móvil) y la versión de la APK (?apk=).
// Cualquiera puede mandarte un enlace a esta web con ?text= o #portal=: solo es de fiar (trusted) la ruta
// que trae el código que esta web dio a la APK. Lo demás se enseña con aviso y no cambia los clientes guardados.
function incoming() {
  const q = new URLSearchParams(location.search);
  const apk = q.get('apk');
  if (apk) try { localStorage.setItem('ruta-apk', apk.slice(0, 20)); } catch { /* sin almacenamiento */ }
  let text = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n').trim();
  let trusted = false;
  const hash = readPortalHash(location.hash, storedNonce());
  if (hash) ({ text, verified: trusted } = hash);
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
  return { text: text.slice(0, 100000), trusted };
}

// Lo recibido va a la hoja de "Pegar lista", ya leído, para revisarlo antes de añadir.
function receive({ text, trusted }) {
  if (!text) return;
  const portal = parsePortal(text);
  if (ui.sheet) closeSheet();
  if (ui.tab !== 'route') { ui.tab = 'route'; render(); }
  openSheet({ kind: 'paste', text: portal ? '' : text, portal, untrusted: !trusted });
  ui.sheet.parsed = portal ? portal.stops : parseList(text);
  ui.sheet.initial = '';
  renderSheet();
}

// ---------- Arranque ----------

store.setSaveErrorHandler(() => toast('No queda espacio para guardar. Exporta tus clientes y borra rutas antiguas.', 8000));
store.pruneOldRoutes();
ui.date = defaultDate();
const first = incoming();
render();
receive(first);
// Con la app ya abierta, la APK manda la ruta cambiando solo el #: no se recarga la página.
window.addEventListener('hashchange', () => receive(incoming()));
store.requestPersist().then((p) => { ui.persisted = p; if (ui.tab === 'settings' && !ui.sheet) render(); });
registerServiceWorker();
