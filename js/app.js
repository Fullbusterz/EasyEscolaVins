import { parseList, fmt, toMin, clientKey } from './parse.js';
import { geocode, navUrl, currentPosition, coordsFromText, trafficLegs, haversineKm, onGoogleUsage } from './geo.js';
import { GOOGLE_MAPS_KEY, GOOGLE_MAPS_KEY_IOS, GOOGLE_MATRIX } from './config.js';
import { isNative, plugin, tap, shareFileNative, setupNativeShell } from './native.js';
import { computePlan } from './planner.js';
import { groupKey, walkMin, TROLLEY_BOXES, LOOSE_PER_BOX } from './parking.js';
import { bigOrder } from './portal.js';
import { oddHours, ODD_WINDOWS } from './hours.js';
import { serviceFor, stopParts, measure, unloadFrom, extraTrips, toldOf, toldWhy, TRIP_MIN, MOVED_M, TOLD_MIN, TOLD_MAX, TOLD_CHOICES } from './service.js';
import { planWindows as marginWindows, STRICT_MARGIN, FLEX_EXTRA, LATE_OK_MORNING, LATE_OK_AFTERNOON } from './hours.js';
import { serviceStart } from './solver.js';
import { cleanEntry, goTo, entryDistanceM } from './entry.js';
import { parsePortal, readPortalHash, bridgeUrl, portalReaderBody } from './portal.js';
import * as store from './store.js';
import { watchTextSize, watchBars } from './textsize.js';

export const VERSION = '1.20.0';

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
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3.5 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

// Àrea DUM (carga y descarga): hay que validar cada parada en la app SPRO; máximo 30 minutos.
const DUM_MINUTES = 30;
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);
let measureBars = () => {};
// Instalada en la pantalla de inicio. En iPhone eso aísla sus datos de Safari y nada de fuera puede
// entrarle: el marcador no puede devolverle la ruta, así que ahí toca copiar y pegar.
const isStandalone = (() => {
  try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; }
})();
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
  waitingPaste: null, // se ha abierto el portal: al volver, la ruta está copiada y se pega de un toque
  bridgeOpen: false, // enseñar otra vez cómo guardar el marcador
  picking: false, // selector de archivos abierto: al volver de él no se redibuja (ver 'visibilitychange')
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
// El tiempo de la parada no es fijo: lo fijo del cliente, más aparcar, más los viajes que salgan por las cajas.
const stopMinutes = (x) => serviceFor(x, settings());
const planStop = (x) => {
  const { unload, park, tripsMin } = stopParts(x, settings());
  return { id: x.id, ...goTo(x), windows: planWindows(x), service: unload + tripsMin, park, load: x.load };
};
// Por dónde se entra, si no es por la dirección: se enseña con lo que haya apuntado el repartidor.
const entryOf = (x) => cleanEntry(x?.entry, x);
// En la parada actual: aviso de que no se entra por la dirección y adónde lleva el botón de navegar.
function entryLine(x, park) {
  const e = entryOf(x);
  if (!e) return '';
  const how = park ? 'Desde la furgoneta, ve a pie al punto marcado' : `${settings().nav === 'gmaps' ? 'Maps' : 'Waze'} te lleva al punto marcado`;
  return `<div class="notice compact gold" style="margin:12px 0 0">${I.pin}<div>No se entra por la dirección. ${how}${e.note ? `: <b>${esc(e.note)}</b>` : ''}.</div></div>`;
}
function entryChip(x) {
  const e = entryOf(x);
  return e ? `<span class="chip entry">${I.pin}Entrada: ${esc(e.note || 'punto marcado')}</span>` : '';
}
// Carga del pedido, del portal: cajas, cuántas de ellas son grandes y botellas sueltas. El total de botellas
// no se enseña (es una estimación y no dice nada que no digan las cajas), pero sigue contando para marcar un
// pedido grande (+70 botellas o +30 cajas). Si no cabe en un viaje de carretilla también se dice, que es de
// donde salen los minutos de más.
function loadChip(x) {
  const l = x.load;
  if (!l || (!l.boxes && !l.bottles)) return '';
  const extra = extraTrips(x);
  const cajas = !l.boxes ? ''
    : l.big >= l.boxes ? `${plural(l.boxes, 'caja grande', 'cajas grandes')}`
    : l.big ? `${plural(l.boxes, 'caja', 'cajas')} (${l.big} ${l.big === 1 ? 'grande' : 'grandes'})`
    : plural(l.boxes, 'caja', 'cajas');
  const what = esc([cajas, l.loose ? `${l.loose} sueltas` : ''].filter(Boolean).join(' + '));
  const viajes = extra ? ` · ${extra + 1} viajes` : '';
  return bigOrder(l) ? `<span class="chip big">Pedido grande · ${what}${viajes}</span>` : `<span class="chip any">${what}${viajes}</span>`;
}
// El tiempo que ha dicho el repartidor para esta parada: manda sobre lo que calcularía la app.
function toldChip(x) {
  const told = toldOf(x);
  return told == null ? '' : `<span class="chip told">${I.clock}Tú: ${told} min</span>`;
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
const walkUrl = (x) => { const p = goTo(x); return `https://www.google.com/maps/dir/?api=1&destination=${Number(p.lat)},${Number(p.lon)}&travelmode=walking`; };
// Navegar a una parada (a su punto de entrada si lo tiene) o a su aparcamiento.
const driveUrl = (app, x, park) => navUrl(app, park || goTo(x));

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
          // En el mapa (y para buscar dónde aparcar) la parada está donde se entra, no en el portal de la dirección.
          id: x.id, name: x.name || x.address, label: x.label || x.address, ...goTo(x), entry: entryOf(x)?.note ?? null,
          windows: x.windows, planWindows: planWindows(x), service: stopMinutes(x), load: x.load || null, done: !!x.done, leg: legs.get(x.id) || null,
          nav: driveUrl(s.nav, x, park.find((p) => p.ids.includes(x.id))),
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
// La clave de Google: la de este móvil si alguien ha puesto una, si no la de la empresa (js/config.js).
// En la app de iPhone, la suya (restringida a la app); si no hay, la de la web.
const COMPANY_KEY = ((isNative && GOOGLE_MAPS_KEY_IOS) || GOOGLE_MAPS_KEY || '').trim();
const googleKey = () => (settings().googleKey || COMPANY_KEY).trim();
const companyKey = () => !!COMPANY_KEY;

// Los tiempos entre paradas de Google se reutilizan en cada «Siguiente», pero solo en memoria: sus
// condiciones no dejan guardarlos en el móvil. Si iOS cierra la app, se vuelven a pedir los que hagan falta.
const PAIRS = new Map(); // fecha -> pares
const pairsOf = (date) => PAIRS.get(date) || {};
const keepPairs = (date, pairs) => { PAIRS.set(date, pairs || {}); };

// Lo que se ha consultado a Google este mes en este móvil, para saber lo que se gasta (Ajustes).
const monthIso = () => store.isoDate().slice(0, 7);
onGoogleUsage(({ elements = 0, routes = 0 }) => {
  const u = settings().usage?.month === monthIso() ? settings().usage : { month: monthIso(), elements: 0, routes: 0 };
  store.setSettings({ usage: { month: u.month, elements: u.elements + elements, routes: u.routes + routes } });
});

function signature(r) {
  return JSON.stringify([
    settings().shiftStart, settings().returnToDepot, !!googleKey(), !!settings().useWindows,
    r.stops.map((s) => [s.id, s.lat, s.lon, goTo(s), s.windows, stopMinutes(s), s.timing || '', !!s.windowsConfirmed]),
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
  const live = !!googleKey();
  eng.className = `engine ${live ? 'live' : 'off'}`;
  eng.innerHTML = `<span class="dot"></span>${live ? 'Tráfico de Google' : 'Sin tráfico'}`;
  eng.setAttribute('aria-label', live ? 'Tiempos y tráfico de Google Maps. Abrir ajustes' : 'Sin tiempos de Google: la ruta es aproximada. Abrir ajustes');

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
  measureBars();
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
  const chips = [loadChip(s), toldChip(s), windowsChips(s.windows), oddChip(s), timingChip(s), s.done ? '' : entryChip(s)];
  // Lo de llegar tarde se dice respecto a su horario de verdad (el plan usa el margen de estricto/flexible y,
  // además, descuenta lo que dura la descarga: se puede llegar a tiempo y aun así no acabar antes de cerrar).
  const real = pastHours(s, leg);
  if (s.failed) chips.unshift(`<span class="chip late">No entregado · ${esc(s.failed)}</span>`);
  else if (real > 0.5 && !(leg?.late > 0.5)) chips.push(`<span class="chip wait">${Math.round(real)} min tarde · en el margen</span>`);
  else if (leg?.late > 0.5) chips.push(`<span class="chip late">${real > 0.5 ? lateText(real) : s.timing === 'strict' ? 'Sin margen · estricto' : 'No acabas de descargar antes de que cierre'}</span>`);
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

// Lo que ve quien abre la app por primera vez: pocos pasos, y cada uno se marca al hacerlo.
function firstSteps() {
  const step = (done, n, title, body) => `<li class="${done ? 'ok' : ''}"><span class="n">${done ? I.check : n}</span><div class="grow"><b>${title}</b>${body}</div></li>`;
  const bring = portalNative() || portalApp() || !isAndroid;
  let n = 0;
  const steps = [];
  // Con la clave de la empresa no hay nada que configurar: se salta el paso.
  if (!googleKey()) {
    steps.push(step(false, ++n, 'Pide la clave de Google al encargado',
      `<div class="small muted">Sin ella la ruta sale aproximada, sin tráfico. Se pone en Ajustes → Más ajustes.</div>`));
  }
  steps.push(step(store.clientList().length > 0, ++n, '¿Te pasa un compañero sus clientes?',
    `<div class="small muted">Si te ha mandado su archivo, impórtalo y tendrás sus clientes y el almacén.</div>
     <label class="btn line block" style="cursor:pointer;margin-top:10px">Importar archivo<input type="file" id="import-file" accept="application/json,.json" hidden></label>`));
  steps.push(step(false, ++n, 'Practica una ruta',
    `<div class="small muted">6 paradas de ejemplo. Se borra con un toque.</div>
     <button class="btn ghost block" data-action="demo" style="margin-top:10px">Probar una ruta de ejemplo</button>`));
  steps.push(step(false, ++n, bring ? 'Trae tu ruta del portal' : 'Pega tu ruta',
    bring ? '<div class="small muted">Con el botón dorado de abajo, con tu usuario del portal.</div>'
      : '<div class="small muted">Copia la lista en el portal y usa «Pegar lista».</div>'));
  return `<div class="card first">
    <div class="serif">Primeros pasos</div>
    <ol class="steps">${steps.join('')}</ol>
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
    id: `demo${i}`, demo: true, name, address, label: address, lat, lon, service: 12, done: false,
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
  r.status = 'draft'; r.plan = null; r.current = null; r.lastChange = null; r.dum = null; r.vanAt = null; r.pairs = {};
  store.save(); render(); toast('Ruta de ejemplo borrada');
}

const demoBanner = (r) => (r.stops.some((x) => x.demo)
  ? `<div class="notice gold compact">${I.info}<div class="grow">Ruta de ejemplo, para practicar.</div><button class="btn line" data-action="clear-demo">Borrarla</button></div>`
  : '');

function renderPlanning(r) {
  const s = settings();
  const dirty = isDirty(r);
  const stops = orderedStops(r);
  const legs = !dirty && r.plan ? new Map(r.plan.legs.map((l) => [l.id, l])) : new Map();
  let html = dayBar() + demoBanner(r);

  if (!r.stops.length) {
    html += store.clientList().length ? `<div class="empty">
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
      html += `<div class="notice warn">${I.warn}<div>No llegas a tiempo a <b>${esc(lateOnes.join(', '))}</b>. Revisa su horario o avisa al cliente.</div></div>`;
    }
    const inMargin = p.legs.filter((l) => !(l.late > 0.5)).map((l) => {
      const x = r.stops.find((y) => y.id === l.id);
      const m = x ? pastHours(x, l) : 0;
      return m > 0.5 ? `${esc(x.name)} (+${Math.round(m)} min)` : '';
    }).filter(Boolean);
    const odds = r.stops.filter((x) => !x.done && odd(x));
    if (odds.length && s.useWindows) html += `<div class="notice warn">${I.warn}<div>Horario raro en ${odds.map((x) => `<b>${esc(x.name)}</b>`).join(', ')}: lo trato como si abrieran a las 10:00. Llama y apunta el horario en su ficha.</div></div>`;
    if (inMargin.length) html += `<div class="notice warn">${I.info}<div>Llegas un poco tarde, dentro del margen, a ${inMargin.join(', ')}.</div></div>`;
    if (!s.useWindows) html += `<div class="notice gold">${I.info}<div>Horarios de los clientes apagados (Ajustes).</div></div>`;
    const at = p.computedAt ? ` Calculada ${store.isoDate(new Date(p.computedAt)) === todayIso() ? 'hoy' : 'el ' + new Date(p.computedAt).toLocaleDateString('es-ES')}, ${fmt(minOfDay(p.computedAt))}.` : '';
    html += `<div class="source-line">${p.source === 'estimate' ? I.warn : I.check}<div>${sourceText(p)}. Salida ${fmt(p.startMin)}.${at}</div></div>`;
  }

  html += pasteBanner() + toldBanner(r);

  if (parkingFor(r).length > 1) html += `<div style="text-align:right;margin:-4px 2px 8px"><button class="linkbtn" data-action="park-clear">Quitar todos los aparcamientos</button></div>`;
  for (const p of parkingFor(r)) {
    const names = p.ids.map((id) => r.stops.find((x) => x.id === id)?.name).filter(Boolean);
    html += `<div class="notice gold">${I.pin}<div class="grow">Aparcas una vez ${p.dum ? `en la zona DUM de <b>${esc(p.label)}</b>` : 'en el punto medio'} para ${esc(names.join(', '))}.
      <button class="linkbtn" data-action="park-undo" data-key="${esc(groupKey(p.ids))}" style="color:inherit">Quitar</button></div></div>`;
  }

  const unloc = r.stops.filter((x) => !located(x)).length;
  if (unloc) html += `<div class="notice warn">${I.warn}<div>${unloc === 1 ? '1 parada sin ubicar: tócala' : `${unloc} paradas sin ubicar: tócalas`} para buscar la dirección.</div></div>`;

  // Con paradas ya puestas, el botón dorado es el de la ruta (Optimizar / Empezar): este pasa a segundo plano.
  const bringCls = r.stops.length ? 'line' : 'gold big';
  if (portalNative()) html += `<button class="btn ${bringCls} block" data-action="native-portal" style="margin:14px 0 10px">${I.go}Traer la ruta del portal</button>`;
  else if (portalApp()) html += `<a class="btn ${bringCls} block" href="${esc(portalIntent())}" style="margin:14px 0 10px">Traer la ruta del portal</a>`;
  // Sin APK el marcador hace lo mismo (en Android no: Chrome y Edge no ejecutan marcadores).
  else if (!isAndroid) html += `<button class="btn ${bringCls} block" data-action="open-bring" style="margin:14px 0 10px">Traer la ruta del portal</button>`;
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
      if (first) html += `<a class="btn line block" style="margin-top:10px" href="${esc(driveUrl(s.nav, first, parkingOf(r, first.id)))}" target="_blank" rel="noopener">${I.nav}${s.nav === 'gmaps' ? 'Maps' : 'Waze'} a la primera: ${esc(first.name)}</a>`;
    }
    html += '</div>';
  }
  return html;
}

// De dónde salen las horas de la ruta, en palabras. 'tomtom' y 'ors' son de rutas calculadas antes de Google.
function sourceText(p) {
  if (p.source === 'traffic' || p.source === 'tomtom') return `Con el tráfico de Google ${p.live ? 'de ese momento' : 'previsto para esa hora'}`;
  if (p.source === 'google' || p.source === 'ors') return 'Con tiempos de Google y tráfico estimado por hora';
  if (p.source === 'estimate' && googleKey() && !p.warning) return 'Con distancias aproximadas';
  return googleKey() ? 'Con distancias aproximadas: Google no ha respondido' : 'Con distancias aproximadas: falta la clave de Google';
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
const manualNotice = () => `<div class="notice gold compact">${I.info}<div class="grow">Orden puesto por ti: se mantiene.</div>
  <button class="btn line" data-action="order-auto">Volver al óptimo</button></div>`;

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
      ? `<div class="notice compact info" style="margin:12px 0 0">${I.pin}<div>Desde la furgoneta, a pie: ${Math.max(1, Math.round(walkMin(park, goTo(cur))))} min.</div></div>`
      : `<div class="notice compact gold" style="margin:12px 0 0">${I.pin}<div>Aparca ${park.dum ? `en la zona DUM de <b>${esc(park.label)}</b>` : 'en el punto medio'} y ve a pie (${Math.max(1, Math.round(walkMin(park, goTo(cur))))} min). Desde ahí haces también ${esc(park.ids.filter((id) => id !== cur.id).map((id) => r.stops.find((x) => x.id === id)).filter((x) => x && !x.done).map((x) => x.name).join(', ') || 'las demás')}.</div></div>`;
    html += `<section class="now" aria-labelledby="now-name">
      <div class="label">${finished === 0 ? 'Primera parada' : 'Siguiente parada'}</div>
      <h2 id="now-name" class="clamp2">${esc(cur.name || cur.address)}</h2>
      <div class="addr clamp2">${esc(cur.label || cur.address || '')}</div>
      ${entryLine(cur, park)}
      ${parkLine}
      <div class="chips" style="margin-top:10px">${dumChip(r, cur)}${loadChip(cur)}${toldChip(cur)}${windowsChips(cur.windows)}${oddChip(cur)}${timingChip(cur)}${leg?.late > 0.5 ? `<span class="chip late solid">${lateText(pastHours(cur, leg) || leg.late)}</span>` : pastHours(cur, leg) > 0.5 ? `<span class="chip wait">${Math.round(pastHours(cur, leg))} min tarde · en el margen</span>` : ''}${leg?.wait > 4 ? `<span class="chip wait">Abre a las ${fmt(leg.begin)}</span>` : ''}</div>
      <div class="facts">
        <div><b>${leg ? fmt(leg.arrive) : '--:--'}</b><span>llegada</span></div>
        <div><b>${leg ? Math.round(leg.drive) : '–'}</b><span>min de viaje</span></div>
        <div><b>${ws.value}</b><span>${ws.label}</span></div>
      </div>
      ${cur.notes ? `<details class="notes"><summary>${I.info}<span class="clamp2">${esc(cur.notes)}</span></summary><p>${esc(cur.notes)}</p></details>` : ''}
      <div class="minor">
        <a class="pill spro" href="${esc(sproUrl())}" data-action="spro" data-keep-default="1">${I.pin}SPRO · ${dumChip(r, cur) ? 'otra vez' : 'aparcar'}</a>
        ${cur.phone ? `<a class="pill" href="tel:${esc(cur.phone.replace(/[^\d+]/g, ''))}">${I.phone}Llamar</a>` : ''}
        <button class="pill" data-action="open-told" data-id="${esc(cur.id)}">${I.clock}${toldOf(cur) != null ? `Tardaré ${toldOf(cur)} min` : '¿Cuánto tardo?'}</button>
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
    : `<a class="btn gold big" href="${esc(driveUrl(s.nav, cur, park))}" target="_blank" rel="noopener">${I.nav}${s.nav === 'gmaps' ? 'Maps' : 'Waze'}</a>`;
  if (ui.busy) return `${go}<button class="btn forest big" disabled><span class="spin"></span>${esc(ui.busy)}</button>`;
  // Mientras no esté aparcada, el botón grande es «He aparcado»: con esa hora se separa lo que cuesta
  // llegar y aparcar de lo que cuesta la entrega, y así la app aprende las dos cosas por separado.
  if (!parked(cur)) return `${go}<button class="btn forest big" data-action="parked">${I.pin}He aparcado</button>`;
  return `${go}<button class="btn forest big" data-action="next">${last ? `${I.check}Terminar` : `${I.right}Siguiente`}</button>`;
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
      <span class="chips">${windowsChips(c.windows)}${timingChip(c)}${toldChip(c)}${toldOf(c) == null && c.serviceLearned ? `<span class="chip any">Descarga ~${esc(c.service)} min</span>` : ''}${entryChip(c)}${c.needsCheck ? '<span class="chip check">Revisar dirección</span>' : ''}</span>
    </button>`).join('');
  return html;
}

// ---------- ¿Cuánto crees que tardarás? ----------

// Cada local es un mundo: en Ikebana (Sarrià) aparcar y subir es un infierno y en otros aparcas delante y en
// 10 minutos has terminado; y además depende de lo que lleves ese día. Eso no hay cuenta que lo adivine, así
// que la app lo pregunta: lo que digas es el tiempo de la parada entera (aparcar, entrar, entregar y los
// viajes con la carretilla) y manda sobre lo que calcularía ella (ver service.js). Se guarda en el cliente,
// así que la próxima vez ya sale puesto y solo hay que cambiarlo si ese día es distinto.

// Paradas pendientes de las que no se sabe cuánto se tarda.
const pendingTold = (r) => r.stops.filter((x) => !x.done && located(x) && toldOf(x) == null);

// Por qué preguntar por esta parada (ver toldWhy en service.js): vacío = la app ya tiene un número decente.
const toldWhyOf = (x) => toldWhy(x, x.name ? store.findClient(x.name) : null);
const worthTold = (x) => toldWhyOf(x).length > 0;

function toldBanner(r) {
  if (!settings().askTold || !r.stops.length) return '';
  // Solo las que de verdad bailan: si de las pendientes ya sé lo que cuestan, no hay nada que decir.
  const n = pendingTold(r).filter(worthTold).length;
  if (!n) return '';
  return `<div class="notice info">${I.clock}<div class="grow">¿Cuánto tardarás en ${n === 1 ? 'una parada nueva' : `${n} paradas nuevas`}?</div>
    <button class="btn line" data-action="open-told">Decirlo</button></div>`;
}

// Lo que la app sabe de esa parada aparte de lo que digas tú: su cálculo, lo medido y los viajes de hoy.
function toldAside(x) {
  const mem = x.name ? store.findClient(x.name) : null;
  const calc = Math.round(serviceFor({ ...x, told: null }, settings()));
  const extra = extraTrips(x);
  const out = [`La app calcularía ${calc} min`];
  if (mem?.serviceLearned || mem?.parkLearned) {
    const real = Math.round(serviceFor({ service: mem.service, park: mem.park, load: x.load }, settings()));
    out.push(`medido aquí: ~${real} min`);
  }
  if (extra) out.push(`${extra + 1} viajes con la carretilla (${extra * TRIP_MIN} min de más)`);
  return out.join(' · ');
}

function toldRow(x) {
  const told = toldOf(x), why = toldWhyOf(x);
  const btn = (v, label) => `<button data-action="told-set" data-id="${esc(x.id)}" data-v="${v}" class="${(told == null ? '' : String(told)) === String(v) ? 'on' : ''}" aria-pressed="${(told == null ? '' : String(told)) === String(v)}">${label}</button>`;
  return `<li>
    <b>${esc(x.name || x.address)}</b>
    <div class="muted small ellipsis">${esc(x.label || x.address || '')}</div>
    <div class="chips" style="margin:6px 0 0">${loadChip(x)}${windowsChips(x.windows)}</div>
    <div class="presets" style="margin:8px 0 2px" role="group" aria-label="Minutos en ${esc(x.name || 'la parada')}">
      ${TOLD_CHOICES.map((m) => btn(m, `${m} min`)).join('')}${btn('', 'Lo calculas tú')}
    </div>
    <div class="tiny faint">${esc(toldAside(x))}</div>
    ${why.length ? `<div class="tiny faint">Te lo pregunto porque ${esc(why.join(' y '))}.</div>` : ''}
  </li>`;
}

// Un día de 25 paradas no cabe en una hoja que se pueda contestar de pie en la furgoneta, así que de
// entrada salen solo las que bailan y las demás quedan a un toque («Preguntar también por…»).
function toldSplit(sh) {
  const r = currentRoute();
  const all = sh.ids.map((id) => r.stops.find((x) => x.id === id)).filter((x) => x && !x.done);
  if (sh.all || all.length < 2) return { list: all, rest: [] };
  const list = all.filter(worthTold);
  // Si no destaca ninguna, se pregunta por todas: mejor eso que abrir una hoja vacía.
  return list.length ? { list, rest: all.filter((x) => !worthTold(x)) } : { list: all, rest: [] };
}

function sheetTold(sh) {
  const { list, rest } = toldSplit(sh);
  if (!list.length) {
    return `<h2 id="sheet-title">Tiempos de las paradas</h2>
      <div class="small muted">No queda ninguna parada pendiente.</div>
      <div class="foot"><button class="btn gold big block" data-action="close">Cerrar</button></div>`;
  }
  const one = list.length === 1 && !rest.length;
  return `<h2 id="sheet-title">${one ? `¿Cuánto tardarás en ${esc(list[0].name || list[0].address)}?` : '¿Cuánto crees que tardarás?'}</h2>
    <div class="small muted" style="margin:-6px 0 12px">Cuenta la parada entera: aparcar, entrar, entregar y los viajes con la carretilla. Con tu tiempo calculo las horas de llegada y el orden; lo que no digas lo calculo yo.</div>
    ${rest.length ? `<div class="notice info" style="margin:0 0 12px">${I.clock}<div class="grow">Te pregunto por ${list.length === 1 ? 'la parada' : `las ${list.length} paradas`} donde mi cuenta es más floja. De ${rest.length === 1 ? 'la otra' : `las otras ${rest.length}`} ya sé lo que suele costar, así que no te las pongo.</div></div>` : ''}
    <ul class="parsed">${list.map(toldRow).join('')}</ul>
    ${rest.length ? `<button class="btn line block" data-action="told-all" style="margin-top:10px">Preguntar también por ${rest.length === 1 ? 'la otra parada' : `las otras ${rest.length} paradas`}</button>` : ''}
    <div class="foot">
      <button class="btn gold big block" data-action="close">${sh.changed ? 'Listo · recalcular' : 'Listo'}</button>
      ${one ? '' : '<button class="btn ghost block" data-action="told-never">No volver a preguntarme</button>'}
    </div>`;
}

// Al traer una ruta nueva se pregunta por las paradas de las que no se sabe nada. Se puede apagar en Ajustes.
function maybeAskTold() {
  if (!settings().askTold || ui.sheet || ui.busy) return false;
  const pend = pendingTold(currentRoute());
  // Si de ninguna de las pendientes hay duda, no se abre la hoja: cada una se puede decir desde su ficha.
  if (!pend.some(worthTold)) return false;
  openSheet({ kind: 'told', ids: pend.map((x) => x.id) });
  return true;
}

// Lo que dijiste frente a lo que ha sido: así la próxima vez lo dices mejor (y puedes cambiarlo en su ficha).
function toldGap(cur, doneAt) {
  const told = toldOf(cur), t = cur.trip;
  if (told == null || !t) return '';
  const real = (doneAt - t.since) / 60000 - (t.drive || 0) - (t.wait || 0);
  if (!(real > 0) || Math.abs(real - told) < 5) return '';
  return ` · dijiste ${told} min y han sido ${Math.round(real)}`;
}

// ---------- Traer la ruta del portal sin la APK (iPhone y ordenador) ----------

// La APK de Android lo hace de un toque. Sin ella lo hace el marcador: corre dentro del portal, con la
// sesión del repartidor (así cada uno saca la suya y la contraseña no sale del navegador) y devuelve la ruta
// a la app. Guardarlo es el equivalente a instalar la APK: una vez y ya está.
//
// En el iPhone hay dos sitios donde vive la app y se tratan distinto, porque iOS aísla los datos de una web
// instalada y no deja que le entre nada de fuera:
//   'app'    en Safari: el marcador salta a la app con la ruta dentro, sin pegar nada (como la APK).
//   'paste'  desde el icono de la pantalla de inicio: el marcador deja la ruta copiada y «Pegar la ruta»
//            la mete de un toque. Es lo más cerca que se puede estar de la APK con la app instalada.
const PORTAL_URL = 'https://portal.escoladist.com/Repartos/Index'; // sin /Index el portal da 404
const portalBack = () => {
  const v = settings().portalBack;
  return v === 'paste' || v === 'app' ? v : isStandalone ? 'paste' : 'app';
};
const bridgeReady = () => !!settings().bridgeReady;

// Que has ido al portal se apunta en el móvil, no solo en memoria: la app instalada del iPhone se cierra
// sola mientras estás en Safari, y al volver tiene que seguir ofreciéndote pegar la ruta.
const PASTE_KEY = 'ruta-pegar-pendiente';
const PASTE_MAX_MIN = 45;
function waitingPaste(on) {
  ui.waitingPaste = on ? Date.now() : null;
  try {
    if (on) localStorage.setItem(PASTE_KEY, String(ui.waitingPaste));
    else localStorage.removeItem(PASTE_KEY);
  } catch { /* sin almacenamiento: solo en memoria */ }
}
function restoreWaitingPaste() {
  try {
    const at = Number(localStorage.getItem(PASTE_KEY)) || 0;
    if (at && Date.now() - at < PASTE_MAX_MIN * 60000) ui.waitingPaste = at;
    else if (at) localStorage.removeItem(PASTE_KEY);
  } catch { /* sin almacenamiento */ }
}

// Vuelves del portal y la ruta está copiada: un toque y dentro. Se enseña un rato, no para siempre.
function pasteBanner() {
  if (!ui.waitingPaste || Date.now() - ui.waitingPaste > PASTE_MAX_MIN * 60000) return '';
  return `<div class="notice gold">${I.paste}<div class="grow">¿Ya has tocado tu ruta en el portal? La tienes copiada.</div>
    <button class="btn line" data-action="paste-route">Pegar la ruta</button></div>`;
}

function bringSteps() {
  const paste = portalBack() === 'paste';
  return `<ol><li>Pulsa <b>Abrir el portal</b> y entra con tu usuario (solo la primera vez).</li>
    <li>${isIOS ? 'Abre los marcadores (el icono del libro) y toca <b>Pasar a Ruta</b>.' : 'Pulsa el marcador <b>Pasar a Ruta</b>.'}</li>
    <li>Toca tu ruta: ${paste ? 'se copia y, al volver aquí, <b>Pegar la ruta</b> la mete dentro.' : 'Ruta se abre con las paradas dentro.'}</li></ol>`;
}

// Cómo guardar el marcador, una sola vez. Se esconde cuando ya está guardado.
function bridgeSetup() {
  const paste = portalBack() === 'paste';
  if (!ui.bridgeOpen && bridgeReady()) {
    return `<button class="btn ghost block" data-action="bridge-open" style="margin-top:12px">Volver a copiar el marcador</button>`;
  }
  const pasos = isIOS
    ? `<ol><li>Pulsa <b>Copiar el marcador</b> (aquí arriba).</li>
         <li>En <b>Safari</b>, con cualquier página abierta: Compartir → <b>Añadir marcador</b> → Guardar. Llámalo <b>Pasar a Ruta</b>.</li>
         <li>Abre los marcadores (el icono del libro) → <b>Editar</b> → toca <b>Pasar a Ruta</b>, borra la dirección que tiene y pega ahí el marcador (empieza por <code>javascript:</code>).</li></ol>`
    : `<ol><li>Pulsa <b>Copiar el marcador</b> (aquí arriba).</li>
         <li>Enseña la barra de marcadores y crea uno nuevo llamado <b>Pasar a Ruta</b>.</li>
         <li>Pega el marcador en su dirección (empieza por <code>javascript:</code>).</li></ol>`;
  const modo = isIOS
    ? `<div class="field" style="margin:14px 0 8px"><span class="small muted" style="font-weight:500" id="back-label">¿Cómo abres Ruta cada día?</span></div>
       <div class="seg timing" role="group" aria-labelledby="back-label">
         <button data-action="portal-back" data-v="paste" class="${paste ? 'on' : ''}" aria-pressed="${paste}">Desde el icono</button>
         <button data-action="portal-back" data-v="app" class="${paste ? '' : 'on'}" aria-pressed="${!paste}">En Safari</button>
       </div>
       <div class="hint">${paste
         ? 'Desde el icono de la pantalla de inicio iOS no deja que le entre nada de fuera, así que el marcador deja la ruta copiada y la metes con «Pegar la ruta»: dos toques.'
         : 'En Safari, al tocar tu ruta en el portal se abre Ruta con las paradas dentro, sin pegar nada.'} Si lo cambias, copia el marcador otra vez.</div>`
    : '';
  return `<button class="btn gold block" style="margin-top:12px" data-action="copy-bridge">Copiar el marcador</button>
    <textarea class="input bridge-field" id="bridge-text" readonly spellcheck="false" aria-label="Marcador para el portal">${esc(bridgeLink())}</textarea>
    ${modo}
    <div class="key-help">${pasos}</div>
    <button class="btn line block" data-action="bridge-ready">Ya lo tengo guardado</button>
    <div class="tiny faint" style="margin-top:10px">${paste
      ? 'Este marcador solo lee tu ruta y la deja copiada: no lleva nada tuyo dentro.'
      : 'Este marcador lleva un código propio de este móvil, para que la app sepa que la ruta la traes tú y no te la ha mandado alguien por un enlace. Si cambias de móvil o borras los datos, vuelve aquí y cópialo otra vez.'}</div>`;
}

// La hoja que lo junta todo: abrir el portal, pegar la ruta y (la primera vez) guardar el marcador.
function sheetBring() {
  const esperando = !!ui.waitingPaste;
  const paste = portalBack() === 'paste';
  return `<h2 id="sheet-title">Traer la ruta del portal</h2>
    <div class="small muted" style="margin:-6px 0 14px">Entras en el portal con <b>tu usuario</b> y tocas tu ruta: llega aquí con direcciones, teléfonos, horarios y las cajas de cada pedido. Tu contraseña no sale del navegador.</div>
    ${bridgeReady() ? '' : `<div class="notice gold">${I.info}<div>La primera vez hay que guardar el marcador ${isIOS ? 'en Safari' : 'en el navegador'}: es lo que en Android hace la APK. Lo tienes abajo y se hace una vez.</div></div>`}
    <a class="btn ${esperando ? 'line' : 'gold'} big block" href="${esc(PORTAL_URL)}" target="_blank" rel="noopener" data-action="portal-open" data-keep-default="1">${I.go}Abrir el portal</a>
    <div style="height:10px"></div>
    <button class="btn ${esperando || paste ? 'gold' : 'line'} big block" data-action="paste-route">${I.paste}Pegar la ruta</button>
    <div class="key-help" style="margin-top:14px"><b>Cada día:</b>${bringSteps()}</div>
    <h3 class="section-title" style="margin-top:18px">El marcador</h3>
    ${bridgeSetup()}
    <div class="foot">
      <button class="btn ghost block" data-action="close">Cerrar</button>
    </div>`;
}

// En Ajustes solo queda el acceso: lo demás vive en la hoja de arriba.
function renderBridge() {
  if (portalApp() || portalNative()) return ''; // con la APK o la app de iPhone ya se trae de un toque
  if (isAndroid) {
    return `
  <h2 class="section-title">Traer la ruta del portal</h2>
  <div class="card">
    <div class="small muted">Para traerla de un toque hace falta la APK: Chrome y Edge de Android no ejecutan los marcadores.
      Mientras tanto, copia la lista en el portal y usa <b>«Pegar lista»</b>, o compártela a Ruta.</div>
  </div>`;
  }
  return `
  <h2 class="section-title">Traer la ruta del portal</h2>
  <div class="card">
    <div class="small muted">La ruta del portal entra en la app de un toque, con tu usuario: direcciones, teléfonos, horarios y las cajas de cada pedido.
      ${bridgeReady() ? '' : `La primera vez hay que guardar el marcador ${isIOS ? 'en Safari' : 'en el navegador'}.`}</div>
    <button class="btn gold block" style="margin-top:12px" data-action="open-bring">Traer la ruta del portal</button>
    ${isIOS ? `<div class="tiny faint" style="margin-top:10px">Estás ${isStandalone ? 'en la app instalada en la pantalla de inicio' : 'en Safari'}: ${portalBack() === 'paste' ? 'la ruta llega copiada y se mete con «Pegar la ruta»' : 'la ruta entra sola al tocarla en el portal'}.</div>` : ''}
  </div>`;
}

function googleCard() {
  const s = settings();
  const key = googleKey();
  const u = s.usage?.month === monthIso() ? s.usage : null;
  const status = key
    ? `<div class="notice info" style="margin-top:0">${I.check}<div>Tiempos y tráfico de <b>Google Maps</b>${companyKey() && !s.googleKey ? ', con la clave de la empresa' : ''}.</div></div>`
    : `<div class="notice warn" style="margin-top:0">${I.warn}<div>Falta la clave de Google: la ruta se ordena por distancia aproximada, sin tráfico. La pone el encargado una vez para todos; si te ha dado una, pégala aquí.</div></div>`;
  return `<div class="card">
    ${status}
    <label class="field"><span>Clave de Google de este móvil${companyKey() ? ' (normalmente vacía)' : ''}</span>
      <input class="input" id="set-google" value="${esc(s.googleKey || '')}" placeholder="${companyKey() ? 'Se usa la de la empresa' : 'Pega aquí la clave'}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <button class="btn line block" data-action="test-google" ${ui.testing ? 'disabled' : ''}>${ui.testing ? '<span class="spin"></span>Probando…' : 'Probar Google'}</button>
    <div class="hint" style="margin-top:10px">${u ? `Este mes, desde este móvil: ${u.elements.toLocaleString('es-ES')} tiempos entre paradas y ${u.routes.toLocaleString('es-ES')} rutas con tráfico.` : 'Este mes aún no se ha consultado a Google desde este móvil.'}</div>
  </div>`;
}

function renderSettings() {
  const s = settings();
  return `
  <h2 class="section-title" style="margin-top:6px">Navegar con</h2>
  <div class="nav-pick" role="group" aria-label="App para navegar">
    <button class="btn ${s.nav === 'gmaps' ? 'ghost' : 'gold'} big" data-action="nav-app" data-v="waze" aria-pressed="${s.nav !== 'gmaps'}">${s.nav !== 'gmaps' ? I.check : ''}Waze</button>
    <button class="btn ${s.nav === 'gmaps' ? 'gold' : 'ghost'} big" data-action="nav-app" data-v="gmaps" aria-pressed="${s.nav === 'gmaps'}">${s.nav === 'gmaps' ? I.check : ''}Google Maps</button>
  </div>

  <h2 class="section-title">Jornada</h2>
  <div class="card">
    <label class="field"><span>Hora de salida del almacén</span><input class="input" type="time" id="set-shift" value="${esc(s.shiftStart)}"></label>
    <label class="toggle"><span>Volver al almacén al acabar</span><input type="checkbox" id="set-return" ${s.returnToDepot ? 'checked' : ''}></label>
    <label class="toggle"><span>Respetar el horario de cada cliente<span class="sub">${s.useWindows ? `Con margen: ${LATE_OK_MORNING} min si cierra por la mañana, ${LATE_OK_AFTERNOON} si cierra más tarde.` : 'Apagado: el orden sale solo por cercanía y tráfico.'}</span></span><input type="checkbox" id="set-windows" ${s.useWindows ? 'checked' : ''}></label>
    <label class="toggle" style="border:0"><span>Preguntarme cuánto tardaré en cada parada<span class="sub">${s.askTold ? 'Al traer una ruta, solo por las paradas que no conozco.' : 'Apagado: lo calculo yo.'}</span></span><input type="checkbox" id="set-asktold" ${s.askTold ? 'checked' : ''}></label>
  </div>

  ${renderBridge()}

  <h2 class="section-title">Copias y compañeros</h2>
  <div class="card">
    <button class="btn line block" data-action="backup">Hacer copia de seguridad</button>
    <div class="hint" style="margin:8px 0 16px">Guarda clientes, horarios y rutas en Drive o en un mensaje a ti mismo. ${backupAge()}</div>
    <button class="btn line block" data-action="export-config">Pasar configuración a un compañero</button>
    <div class="actions2" style="margin:10px 0 0">
      <button class="btn ghost" data-action="export">Pasar clientes</button>
      <label class="btn ghost" style="cursor:pointer">Importar<input type="file" id="import-file" accept="application/json,.json" hidden></label>
    </div>
    <div class="hint" style="margin:10px 0 0">Al importar no se borra nada: se suma a lo que ya hay.</div>
    <div class="tiny ${ui.persisted || isNative ? 'faint' : 'warn-ink'}" style="margin-top:12px">${ui.persisted || isNative ? 'Datos protegidos: el móvil no los borrará aunque le falte espacio.' : 'El móvil podría borrar los datos si se queda sin espacio: haz una copia de vez en cuando.'}</div>
  </div>

  <details class="more" ${ui.moreOpen ? 'open' : ''}>
    <summary data-action="toggle-more">Más ajustes</summary>

    <h2 class="section-title">Google Maps (tiempos y tráfico)</h2>
    ${googleCard()}

    <h2 class="section-title">Minutos por parada</h2>
    <div class="card">
      <label class="field"><span>Descarga, una vez aparcado</span><input class="input" type="number" inputmode="numeric" min="1" max="90" id="set-service" value="${esc(s.service)}"></label>
      <label class="field"><span>Buscar aparcamiento</span><input class="input" type="number" inputmode="numeric" min="0" max="90" id="set-park" value="${esc(s.park)}"></label>
      <div class="hint" style="margin:0">Lo que calculo cuando no me dices tú cuánto tardas. Las cajas van aparte: en la carretilla caben ${TROLLEY_BOXES} (${LOOSE_PER_BOX} botellas sueltas ocupan una caja) y cada viaje de más son ${TRIP_MIN} min.</div>
    </div>

    <h2 class="section-title">Almacén (punto de salida)</h2>
    <div class="card">
      <div style="font-weight:600">${esc(s.depot.name)}</div>
      <button class="btn line block" style="margin-top:12px" data-action="change-depot">Cambiar el almacén</button>
    </div>
  </details>

  <div class="tiny faint" style="text-align:center;margin:22px 0 4px;line-height:1.6">Ruta Escolà · v${VERSION}${isNative ? ' · app de iPhone' : ''}<br>
    Clientes y rutas se guardan en este móvil. Para buscar direcciones y calcular tiempos se consultan
    servicios de mapas; tu posición solo se usa para calcular la siguiente parada.<br>
    Tiempos y tráfico: Google Maps<br>
    Direcciones: © <a href="https://www.icgc.cat/" target="_blank" rel="noopener">ICGC</a> (CC BY 4.0) ·
    <a href="https://www.cartociudad.es/" target="_blank" rel="noopener">CartoCiudad</a> © IGN (CC BY 4.0) ·
    © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a><br>
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
  // Los tiempos que has dicho se guardan al tocarlos, así que al cerrar solo queda rehacer las horas.
  if (sh.kind === 'told' && sh.changed && !ui.busy) {
    const r = currentRoute();
    if (r.status === 'active') replanActive('Horas con tus tiempos');
    else if (r.plan) optimize();
  }
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
  else if (sh.kind === 'told') body = sheetTold(sh);
  else if (sh.kind === 'bring') body = sheetBring();
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"><div class="grab" aria-hidden="true"></div><button class="iconbtn sheet-x" data-action="close" aria-label="Cerrar">${I.x}</button>${body}</div>`;
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
    ${entryBlock(d)}

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

    <div class="field" style="margin:14px 0 8px"><span class="small muted" style="font-weight:500" id="told-label">¿Cuánto tardas en esta parada?</span></div>
    <div class="presets" role="group" aria-labelledby="told-label">
      ${TOLD_CHOICES.map((m) => `<button data-action="told-draft" data-v="${m}" class="${toldOf(d) === m ? 'on' : ''}" aria-pressed="${toldOf(d) === m}">${m} min</button>`).join('')}
      <button data-action="told-draft" data-v="" class="${toldOf(d) == null ? 'on' : ''}" aria-pressed="${toldOf(d) == null}">Lo calculas tú</button>
    </div>

    <div class="input-row">
      <label class="field" style="flex:1"><span>Descarga (min)</span><input class="input" type="number" inputmode="numeric" id="f-service" value="${esc(d.service ?? settings().service)}" min="1" max="120"></label>
      <label class="field" style="flex:1"><span>Aparcar (min)</span><input class="input" type="number" inputmode="numeric" id="f-park" value="${esc(d.park ?? settings().park)}" min="0" max="120"></label>
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

// Por dónde se entra: solo con la dirección ubicada, que es con lo que se compara el punto.
function entryBlock(d) {
  if (!located(d)) return d.entry ? '<div class="hint">Busca la dirección para ver el punto de entrada: si queda lejos de la nueva, se quitará.</div>' : '';
  const e = entryOf(d);
  if (!e) {
    return `<button class="btn line block entry-add" data-action="pick-entry">${I.pin}Se entra por otro sitio (rampa, muelle…)</button>`;
  }
  return `<div class="entry-box">
      <div class="entry-head">${I.pin}<span><b>Se entra por otro sitio</b>, a ${Math.round(entryDistanceM(d, e))} m de la dirección. La ruta y ${settings().nav === 'gmaps' ? 'Maps' : 'Waze'} van ahí.</span></div>
      <label class="field"><span>Qué es (opcional)</span><input class="input" id="f-entry-note" maxlength="80" value="${esc(e.note)}" placeholder="Ej. rampa de mercancías por c/ Girona" autocomplete="off"></label>
      <div class="actions2" style="margin-bottom:8px"><button class="btn line" data-action="pick-entry">Moverlo en el mapa</button><button class="btn ghost" data-action="clear-entry">Quitar</button></div>
    </div>`;
}

async function pickEntry() {
  const sh = ui.sheet;
  if (!sh?.draft) return;
  syncDraft();
  const d = sh.draft;
  if (!located(d)) return toast('Primero busca la dirección');
  const { pickPoint } = await import('./map.js');
  const base = { lat: d.lat, lon: d.lon };
  const p = await pickPoint({
    base, start: entryOf(d), name: d.name || d.address,
    locate: () => currentPosition(8000),
    check: (q) => {
      const m = entryDistanceM(base, q);
      if (cleanEntry(q, base)) return { ok: true, text: `A ${Math.round(m)} m de la dirección.` };
      return m < 50 ? { ok: false, text: 'Está encima de la dirección: marca la otra entrada.' }
        : { ok: false, text: `Está a ${m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`} de la dirección: demasiado lejos para ser otra puerta del mismo local. Si se ha mudado, cambia la dirección.` };
    },
  });
  if (ui.sheet !== sh || !p) return;
  d.entry = { lat: p.lat, lon: p.lon, note: d.entry?.note || '' };
  renderSheet();
  $('#f-entry-note')?.focus();
}

function serviceHint(sh) {
  const d = sh.draft;
  const mem = d.name && store.findClient(d.name);
  const parts = [];
  // Lo que de verdad dura la parada. El pedido del día está en la parada de la ruta, no en el borrador de la ficha.
  const load = (sh.id && currentRoute().stops.find((x) => x.id === sh.id)?.load) || null;
  const total = serviceFor({ ...d, load }, settings());
  const extra = extraTrips({ load });
  const told = toldOf(d);
  if (told != null) {
    parts.push(`Cuento ${told} min en esta parada: lo que has dicho tú.`);
    parts.push(extra ? `Los ${extra + 1} viajes con la carretilla de hoy van dentro de esos minutos.` : 'Mientras esté puesto, la descarga y lo de aparcar no se usan.');
    if (mem?.serviceLearned || mem?.parkLearned) parts.push(`Medido aquí: ~${Math.round(serviceFor({ service: mem.service, park: mem.park, load }, settings()))} min.`);
  } else {
    if (mem?.serviceLearned && mem.service === d.service) parts.push(`La descarga está aprendida de tus últimas ${mem.serviceLog.length} entregas aquí.`);
    if (mem?.parkLearned && mem.park === d.park) parts.push(`Lo de aparcar también: ${mem.park} min de mediana en ${mem.parkLog.length} veces.`);
    if (extra) parts.push(`Hoy son ${extra + 1} viajes con la carretilla: ${total} min en total.`);
  }
  if (total > DUM_MINUTES) parts.push(`Si aparcas en zona DUM, el máximo son ${DUM_MINUTES} min (60 con vehículo de cero emisiones).`);
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
    <div class="actions2" style="margin:-4px 0 12px"><button class="btn line" data-action="paste-clip">${I.paste}Pegar lo copiado</button></div>
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
  // Paradas que ya estaban pero sin la carga o las notas de factura que ahora trae el portal (traídas con una versión
  // anterior), o sin ubicar (se vuelven a buscar al ponerlas al día).
  const lostStop = (x) => !x.done && !located(x) && !!x.address;
  const reload = sh.untrusted ? 0 : stops.filter((it) => store.route(date).stops.some((x) => clientKey(x.name) === clientKey(it.name) && (portalStale(x, it) || lostStop(x)))).length;
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
  if ($('#f-park')) d.park = Math.min(120, Math.max(0, parseInt(v('#f-park'), 10) || 0));
  if ($('#f-phone')) d.phone = v('#f-phone').trim();
  if ($('#f-notes')) d.notes = v('#f-notes').trim();
  if ($('#f-confirmed')) d.windowsConfirmed = $('#f-confirmed').checked;
  if ($('#f-entry-note') && d.entry) d.entry.note = v('#f-entry-note').trim().slice(0, 80);
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
    entry: entryOf(src) ? { ...entryOf(src) } : null,
    windows: (src.windows || []).map((w) => [...w]),
    told: toldOf(src),
    service: src.service ?? settings().service,
    park: src.park ?? settings().park,
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
  if (!d.address) Object.assign(d, { address: mem.address, lat: located(mem) ? mem.lat : null, lon: located(mem) ? mem.lon : null, label: mem.label || '', entry: entryOf(mem) ? { ...entryOf(mem) } : null, needsCheck: !!mem.needsCheck });
  if (!d.windows.length && mem.windows?.length) d.windows = mem.windows.map((w) => [...w]);
  d.told = d.told ?? toldOf(mem); // lo que dijiste la última vez en este cliente
  d.service = mem.service ?? d.service;
  d.park = mem.park ?? d.park;
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
    // Si la dirección ha cambiado y el punto de entrada queda lejos de la nueva, ya no vale y se borra.
    entry: loc ? cleanEntry(d.entry, d) : null,
    windows: d.windows, windowsConfirmed: !!d.windowsConfirmed && d.windows.length > 0,
    told: toldOf(d), service: d.service, park: d.park ?? 0, timing: d.timing || '', phone: d.phone, notes: d.notes,
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
  const lostEntry = !!d.entry && !fields.entry;
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
    if (r.status === 'active') { replanActive(lostEntry ? 'Parada actualizada · punto de entrada quitado, quedaba lejos de la nueva dirección' : 'Parada actualizada'); return true; }
    toast(lostEntry ? 'Guardada · el punto de entrada quedaba lejos de la nueva dirección y se ha quitado'
      : located(fields) ? (sh.id ? 'Parada guardada' : 'Parada añadida') : 'Guardada sin ubicar: búscala para incluirla', lostEntry ? 4500 : 2600);
  } else {
    closeSheet();
    toast(lostEntry ? 'Cliente guardado · el punto de entrada quedaba lejos de la nueva dirección y se ha quitado' : 'Cliente guardado', lostEntry ? 4500 : 2600);
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
  ui.busy = live && googleKey() ? 'Mirando el tráfico…' : 'Calculando la ruta…';
  render();
  try {
    // Para que toda la empresa quepa en lo gratuito de Google: como mucho 2 consultas al planificar.
    const plan = await computePlan({ from: s.depot, depot: s.depot, stops, startMin, departAt, key: googleKey(), live, matrix: GOOGLE_MATRIX, trafficRounds: GOOGLE_MATRIX ? 3 : 2, pairs: pairsOf(ui.date), returnToDepot: s.returnToDepot, parking: parkingFor(r), fixedOrder: r.manual || null });
    keepPairs(ui.date, plan.pairs); delete plan.pairs;
    r.plan = plan; r.planSig = signature(r); r.status = 'planned';
    store.save();
    const what = r.manual ? `Horas con tu orden · vuelta ${fmt(plan.end)}${plan.late > 0.5 ? ' · alguien queda fuera de horario' : ''}`
      : !recalc ? 'Ruta optimizada'
      : before && before !== plan.order.join() ? `He cambiado el orden · vuelta ${fmt(plan.end)}` : `Mismo orden · vuelta ${fmt(plan.end)}`;
    toast(plan.warning ? `Ruta aproximada: ${plan.warning}` : what, plan.warning ? 6000 : 3200);
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
      // En ruta, una sola consulta por «Siguiente».
      from, depot: s.depot, startMin: nowMin(), departAt: new Date(), key: googleKey(), live: true, matrix: GOOGLE_MATRIX, trafficRounds: GOOGLE_MATRIX ? 3 : 1,
      stops: active.map(planStop), pairs: pairsOf(ui.date), returnToDepot: s.returnToDepot, parking, parkedAt, fixedOrder: r.manual || null,
    });
    keepPairs(ui.date, plan.pairs); delete plan.pairs;
    plan.order.push(...r.postponed.filter((id) => postponed.has(id)));
    r.plan = plan; r.planSig = signature(r);
    r.current = plan.order[0];
    markCurrent(r, plan.legs[0], Date.now());
    const next = r.stops.find((x) => x.id === r.current);
    const leg = plan.legs[0];
    if (plan.warning) toast(`Siguiente: ${next.name} · ruta aproximada: ${plan.warning}`, 5000);
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

// Arranca el cronómetro de una parada. `since` es cuando saliste de la anterior; lo previsto se guarda para
// poder restarlo al aprender. Si la furgoneta ya está aparcada de la entrega anterior (mismo sitio, aún
// quedan entregas allí), no hay que volver a aparcar: la parada empieza ya en «entregando».
function markCurrent(r, leg, since) {
  const cur = r.stops.find((x) => x.id === r.current);
  if (!cur || !leg || leg.id !== cur.id) return;
  cur.trip = { since, drive: leg.drive, wait: leg.wait || 0, walk: leg.walk || 0 };
  if (leg.foot) cur.trip.parkedAt = since; // se llega andando: la furgoneta no se ha movido
}

// ¿Está ya aparcada la furgoneta para la parada actual?
const parked = (cur) => !!cur?.trip?.parkedAt;

// De lo que ha pasado de verdad en una parada, lo que merece la pena aprender.
// Con el toque de «he aparcado» se sabe dónde se corta: antes es llegar y aparcar, después es la entrega.
// Sin él (una parada cerrada a mano, o la ruta de antes de esta versión) solo se puede estimar el total.
function learnFrom(cur, doneAt) {
  const t = cur.trip;
  if (!t || !cur.name) return;
  if (t.parkedAt) {
    // t.drive es el tramo entero y ya lleva dentro el paseo de la furgoneta al local, que pasa DESPUÉS de
    // aparcar: para lo que cuesta llegar y aparcar hay que quitárselo, o se restaría dos veces.
    const { unload, park } = measure({
      leftAt: t.since, parkedAt: t.parkedAt, doneAt,
      driveEst: Math.max(0, t.drive - t.walk), waitEst: t.wait, walkEst: t.walk, moved: !!t.moved, stop: cur,
    });
    if (unload != null) store.learnService(cur.name, unload);
    if (park != null) store.learnPark(cur.name, park);
    return;
  }
  const minutes = (doneAt - t.since) / 60000 - t.drive - t.wait;
  store.learnService(cur.name, unloadFrom(minutes, cur, settings()));
}

// «He aparcado»: se apunta la hora y se mira con el GPS si la furgoneta se ha movido desde la entrega
// anterior. Si no se ha movido, no has aparcado (vas andando desde el mismo sitio) y no se aprende nada de
// aparcar por esta parada. El GPS no bloquea: si no llega a tiempo, se da por hecho que sí te has movido.
async function parkHere() {
  const r = currentRoute();
  const cur = r.stops.find((x) => x.id === r.current && !x.done);
  if (!cur?.trip || cur.trip.parkedAt) return;
  cur.trip.parkedAt = Date.now();
  cur.trip.moved = true;
  store.save();
  render();
  const gps = await currentPosition(4000);
  if (!gps || gps.accuracy > 100) return;
  const r2 = currentRoute();
  const c2 = r2.stops.find((x) => x.id === cur.id);
  if (c2?.trip && r2.vanAt) c2.trip.moved = haversineKm(gps, r2.vanAt) * 1000 > MOVED_M;
  r2.vanAt = { lat: gps.lat, lon: gps.lon }; // aquí se queda la furgoneta hasta el próximo aparcamiento
  store.save();
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
  learnFrom(cur, cur.doneAt);
  const gap = toldGap(cur, cur.doneAt);
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
  const what = `Hecha: ${cur.name}${gap}`;
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
const BLOCKED_WHILE_BUSY = new Set(['open-reorder', 'reorder-save', 'order-auto', 'next', 'parked', 'postpone', 'undo', 'edit-stop', 'recalc', 'start-route', 'park-clear', 'optimize', 'stop-route', 'open-stop', 'open-paste', 'remove-stop', 'day', 'demo', 'clear-demo', 'park-undo', 'open-map', 'open-told', 'told-set', 'open-bring', 'paste-route']);

const actions = {
  tab: async (el) => { if (!(await requestCloseSheet())) return; ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  day: (el) => { ui.date = addDays(ui.date, +el.dataset.d); render(); },
  'goto-tomorrow': () => { ui.date = addDays(todayIso(), 1); render(); },
  optimize: () => optimize(),
  recalc: () => (currentRoute().status === 'active' ? replanActive('Recalculada con el tráfico de ahora') : optimize({ recalc: true })),
  'start-route': () => startRoute(),
  next: () => { tap(); finishCurrent(); },
  parked: () => { tap(); parkHere(); },
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
  'pick-entry': () => pickEntry(),
  'clear-entry': () => { if (!ui.sheet?.draft) return; syncDraft(); ui.sheet.draft.entry = null; renderSheet(); },
  'edit-stop': (el) => {
    const s = currentRoute().stops.find((x) => x.id === el.dataset.id);
    if (s) openSheet({ kind: 'stop', id: s.id, draft: stopDraft(s) });
  },
  'edit-client': (el) => {
    const c = store.findClient(store.db().clients[el.dataset.key]?.name || '');
    if (c) openSheet({ kind: 'stop', mode: 'client', key: c.key, draft: stopDraft(c) });
  },
  'open-paste': () => openSheet({ kind: 'paste', text: '' }),
  // Traer la ruta del portal sin APK: abrir el portal, pegar lo que ha dejado el marcador y guardarlo.
  'open-bring': () => (portalNative() ? openNativePortal() : openSheet({ kind: 'bring' })),
  'native-portal': () => openNativePortal(),
  'portal-open': () => { waitingPaste(true); setTimeout(renderSheet, 600); },
  'paste-route': () => pasteFromClipboard(),
  'bridge-open': () => { ui.bridgeOpen = true; render(); },
  'bridge-ready': () => { ui.bridgeOpen = false; store.setSettings({ bridgeReady: true }); render(); toast('Marcador guardado. Ya puedes traer la ruta del portal'); },
  'portal-back': (el) => { store.setSettings({ portalBack: el.dataset.v === 'paste' ? 'paste' : 'app' }); ui.bridgeOpen = true; render(); },
  'paste-clip': async () => {
    const sh = ui.sheet;
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { return toast('Mantén el dedo en el cuadro y elige «Pegar»', 4000); }
    if (!String(text).trim()) return toast('No hay nada copiado');
    if (ui.sheet !== sh) return;
    sh.text = String(text).slice(0, 100000);
    renderSheet();
    actions['paste-read']();
  },
  // ¿Cuánto crees que tardarás? Lo que digas se guarda en la parada y en el cliente, para la próxima vez.
  'open-told': (el) => {
    const r = currentRoute();
    const ids = el.dataset.id ? [el.dataset.id] : r.stops.filter((x) => !x.done && located(x)).map((x) => x.id);
    if (!ids.length) return toast('No hay paradas pendientes');
    if (ui.sheet) closeSheet();
    openSheet({ kind: 'told', ids });
  },
  'told-set': (el) => {
    const r = currentRoute();
    const x = r.stops.find((st) => st.id === el.dataset.id);
    if (!x) return;
    const v = el.dataset.v ? Math.min(TOLD_MAX, Math.max(TOLD_MIN, parseInt(el.dataset.v, 10) || 0)) : null;
    x.told = v;
    // El cliente se lo queda: la próxima vez ya sale puesto (las paradas de práctica no cuentan).
    if (!x.demo && x.name) store.rememberClient({ name: x.name, told: v });
    store.save();
    if (ui.sheet?.kind === 'told') { ui.sheet.changed = true; renderSheet(); } else render();
  },
  'told-draft': (el) => {
    syncDraft();
    ui.sheet.draft.told = el.dataset.v ? Math.min(TOLD_MAX, Math.max(TOLD_MIN, parseInt(el.dataset.v, 10) || 0)) : null;
    renderSheet();
  },
  // «Preguntar también por las otras»: la hoja corta no esconde nada, solo lo deja a un toque.
  'told-all': () => { if (ui.sheet?.kind === 'told') { ui.sheet.all = true; renderSheet(); } },
  'told-never': () => { store.setSettings({ askTold: false }); if (ui.sheet) closeSheet(); render(); toast('No preguntaré más. Se vuelve a encender en Ajustes'); },
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
  'toggle-more': () => { ui.moreOpen = !ui.moreOpen; render(); },
  'nav-app': (el) => { store.setSettings({ nav: el.dataset.v === 'gmaps' ? 'gmaps' : 'waze' }); render(); },
  'test-google': () => testGoogle(),
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
  'copy-bridge': async () => {
    const el = $('#sheet #bridge-text') || $('#bridge-text');
    if (el) { el.focus(); el.setSelectionRange(0, el.value.length); }
    try { await navigator.clipboard.writeText(bridgeLink()); toast('Marcador copiado ✓'); }
    catch { toast('Mantén el dedo sobre el texto y elige «Copiar»', 5000); }
  },
  demo: () => loadDemo(),
  'clear-demo': () => clearDemo(),
  backup: () => backup(),
  spro: () => {
    const r = currentRoute();
    // Se redibuja después: si el enlace desaparece antes de abrirse, Android no llega a abrir SPRO.
    if (r.current) {
      const park = parkingOf(r, r.current);
      r.dum = { id: r.current, at: Date.now(), group: park ? groupKey(park.ids) : undefined };
      // Validar en SPRO es haber aparcado: vale como el toque de «he aparcado», sin pedirlo dos veces.
      if (!parked(r.stops.find((x) => x.id === r.current))) parkHere();
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
  // Las que ya estaban pero se quedaron sin ubicar (antes solo se buscaba en el área de Barcelona) se vuelven
  // a buscar: así traer la ruta otra vez las arregla sin tener que borrarlas.
  let relocated = 0;
  if (portal && !untrusted) {
    const lost = r.stops.filter((x) => !x.done && !located(x) && x.address && sh.parsed.some((it) => clientKey(it.name) === clientKey(x.name)));
    for (const [i, old] of lost.entries()) {
      sh.busy = `Buscando direcciones ${i + 1}/${lost.length}…`;
      renderSheet();
      try {
        const [hit] = await geocode(old.address);
        if (hit && !hit.doubt) {
          Object.assign(old, { lat: hit.lat, lon: hit.lon, label: hit.label, needsCheck: true });
          store.rememberClient({ name: old.name, address: old.address, lat: hit.lat, lon: hit.lon, label: hit.label, needsCheck: true });
          relocated++;
        }
      } catch { /* sigue sin ubicar */ }
    }
  }
  const items = portal ? sh.parsed.filter((it) => !have.has(clientKey(it.name))) : sh.parsed;
  if (portal && !items.length) {
    store.save(); sh.busy = null; closeSheet();
    toast(relocated ? `Paradas puestas al día · ${relocated === 1 ? '1 ubicada' : `${relocated} ubicadas`}` : 'Paradas puestas al día');
    if (!relocated) return render();
    if (r.status === 'active') return replanActive(null);
    return r.stops.some(located) ? optimize() : render();
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
  if (r.status === 'active') { await replanActive(null); maybeAskTold(); return; }
  if (r.stops.some(located)) await optimize(); else render();
  maybeAskTold();
}

const PROBE = [{ lat: 41.372083, lon: 2.077356 }, { lat: 41.3756, lon: 2.1316 }]; // almacén → Carrer de Sants

// Prueba la clave de Google con una ruta de verdad (una consulta): almacén → Carrer de Sants, ahora.
async function testGoogle() {
  const input = $('#set-google');
  if (input) store.setSettings({ googleKey: input.value.trim() });
  const key = googleKey();
  if (!key) { render(); return toast('Falta la clave de Google: la ruta será aproximada', 4000); }
  ui.testing = true; render();
  try {
    const legs = await trafficLegs(PROBE, { key, live: true });
    if (!legs) throw new Error('Google no ha respondido; prueba en un rato');
    toast(`Funciona ✓ Del almacén a Sants ahora: ${Math.round(legs[0])} min`, 4500);
  } catch (e) {
    toast(e.message || 'La clave no funciona', 6000);
  }
  ui.testing = false;
  render();
}

async function shareFile(json, name, title) {
  // En la app de iPhone, con la hoja de compartir del sistema (Drive, WhatsApp, Archivos…).
  const native = await shareFileNative(json, name, title).catch(() => false);
  if (native !== null) return native;
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
  // La app de iPhone lleva la web dentro y se actualiza con la App Store / TestFlight.
  if (isNative || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
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

// Como en las apps: la hoja se cierra arrastrándola hacia abajo (desde arriba del todo).
(() => {
  let y0 = null, dy = 0, sheet = null;
  document.addEventListener('touchstart', (e) => {
    sheet = e.target.closest?.('.sheet');
    if (!sheet || sheet.scrollTop > 0 || e.target.closest('input, textarea, select')) { sheet = null; return; }
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!sheet || y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (sheet.scrollTop > 0) { dy = 0; return; }
    sheet.style.transform = dy ? `translateY(${dy}px)` : '';
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!sheet) return;
    const s = sheet; sheet = null; y0 = null;
    if (dy > 110) { s.style.transition = 'transform .15s'; s.style.transform = 'translateY(100%)'; requestCloseSheet().then((closed) => { if (!closed) { s.style.transform = ''; } }); }
    else { s.style.transition = 'transform .15s'; s.style.transform = ''; setTimeout(() => { s.style.transition = ''; }, 160); }
  });
})();

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
  if (t.id === 'set-service') store.setSettings({ service: Math.min(180, Math.max(1, parseInt(t.value, 10) || 12)) });
  if (t.id === 'set-park') store.setSettings({ park: Math.min(120, Math.max(0, parseInt(t.value, 10) || 0)) });
  if (t.id === 'set-asktold') { store.setSettings({ askTold: t.checked }); render(); }
  if (t.id === 'set-return') store.setSettings({ returnToDepot: t.checked });
  if (t.id === 'set-windows') { store.setSettings({ useWindows: t.checked }); render(); }
  if (t.id === 'set-google') { store.setSettings({ googleKey: t.value.trim() }); render(); }
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
    }).catch(() => { t.value = ''; toast('No se ha podido leer el archivo'); });
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

// En Android el selector de archivos tapa la página. Al volver, 'visibilitychange' llega ANTES que el
// 'change' del <input>; si en ese momento se redibuja, el <input> sale del DOM, su 'change' ya no sube a
// document y la importación no hace nada, sin aviso (visto en un Xiaomi el 19/11/2026). Así que la vuelta
// del selector no redibuja.
document.addEventListener('click', (e) => { if (e.target.id === 'import-file') ui.picking = true; }, true);

// Al volver a la app (p. ej. desde Waze), refresca horas y estado.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (ui.picking) { ui.picking = false; return; }
  if (!ui.sheet && !ui.busy) render();
});

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
// El código de este móvil, creándolo la primera vez. Lo llevan tanto la APK como el marcador de Safari:
// así se distingue la ruta que trae el repartidor de la que alguien le manda por un enlace.
function portalNonce() {
  let n = storedNonce();
  if (!/^[0-9a-f-]{36}$/i.test(n)) {
    n = crypto.randomUUID();
    try { localStorage.setItem(NONCE_KEY, n); } catch { /* sin almacenamiento: la ruta llegará sin verificar */ }
  }
  return n;
}

function portalIntent() {
  return `intent://portal#Intent;scheme=rutaescola;package=com.flixescola.ruta;S.n=${portalNonce()};end`;
}

// El marcador para Safari (iPhone) y para el navegador del ordenador. En modo 'app' lleva la dirección de
// esta web y el código, así que al elegir la ruta vuelve aquí sola y verificada; en modo 'paste' (la app
// instalada en el iPhone, que no puede recibir nada) la deja copiada y se mete con «Pegar la ruta».
function bridgeLink() {
  return bridgeUrl({
    app: location.origin + location.pathname.replace(/[^/]*$/, ''),
    nonce: portalNonce(),
    paste: portalBack() === 'paste',
  });
}

// Pegar de un toque la ruta que el marcador ha dejado copiada. readText() tiene que salir del mismo toque
// del dedo (en el iPhone sale un botón «Pegar» que lo confirma), así que no se espera nada antes.
async function pasteFromClipboard() {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch {
    toast('Este navegador no me deja leer lo copiado: usa «Pegar lista» y pega ahí con el dedo', 6000);
    return;
  }
  text = String(text || '').trim();
  if (!text) return toast('No hay nada copiado. Vuelve al portal y toca tu ruta.', 5000);
  if (!parsePortal(text) && !parseList(text).length) return toast('Lo copiado no es una ruta ni una lista de paradas', 5000);
  waitingPaste(false);
  // La has pegado tú en tu propia app: va sin el aviso de «esto ha llegado por un enlace».
  receive({ text: text.slice(0, 100000), trusted: true });
}

// La app de iPhone trae la ruta ella misma: abre el portal dentro y la lee (ver native/). Sin marcador.
function portalNative() {
  return !!plugin('Portal');
}

// El portal dentro de la app: entras (una vez), «Traer mi ruta» y la ruta llega aquí, sin marcador.
async function openNativePortal() {
  const portal = plugin('Portal');
  if (!portal) return;
  try {
    const res = await portal.open({ url: PORTAL_URL, reader: portalReaderBody() });
    // Viene del portal con la sesión del repartidor, por la propia app: es de fiar.
    if (res?.text) receive({ text: String(res.text).slice(0, 100000), trusted: true });
  } catch (e) {
    toast(e?.message || 'No se ha podido abrir el portal', 5000);
  }
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

setupNativeShell();
store.setSaveErrorHandler(() => toast('No queda espacio para guardar. Exporta tus clientes y borra rutas antiguas.', 8000));
store.pruneOldRoutes();
ui.date = defaultDate();
// La letra sigue sola el tamaño del iPhone: el repartidor no tiene que tocar nada.
watchTextSize(() => 1);
measureBars = watchBars();
restoreWaitingPaste();
const first = incoming();
render();
receive(first);
// Con la app ya abierta, la APK manda la ruta cambiando solo el #: no se recarga la página.
window.addEventListener('hashchange', () => receive(incoming()));
store.requestPersist().then((p) => { ui.persisted = p; if (ui.tab === 'settings' && !ui.sheet) render(); });
// Si el iPhone cambia de tamaño de letra (o se gira), se recoloca todo.
addEventListener('resize', () => measureBars());
registerServiceWorker();
