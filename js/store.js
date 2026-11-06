// Todo se guarda en el propio móvil (localStorage): ajustes, clientes recordados y rutas por día.

import { clientKey } from './parse.js';

const KEY = 'ruta-escola-v1';
const MAX_IMPORT_BYTES = 3_000_000; // una copia completa con 3 semanas de rutas cabe de sobra

export const DEFAULT_DEPOT = {
  name: 'Comercial Escolà · Sant Joan Despí',
  lat: 41.372083,
  lon: 2.077356,
};

const empty = () => ({
  settings: {
    orsKey: '',
    tomtomKey: '',
    depot: DEFAULT_DEPOT,
    shiftStart: '07:30',
    service: 10,
    returnToDepot: true,
    // Horarios de entrega de los clientes al ordenar la ruta (con margen, ver hours.js). Se apagan en Ajustes.
    useWindows: true,
    hoursV: 2,
    nav: 'waze',
    leaveIn: 10,
  },
  clients: {}, // clave normalizada -> { key, name, address, lat, lon, label, windows, service, phone, notes, visits, updatedAt }
  routes: {}, // 'YYYY-MM-DD' -> { date, stops: [...], plan, status, pairs, history }
});

let onSaveError = () => {};
export function setSaveErrorHandler(fn) { onSaveError = fn; }

let state; // se carga al final del módulo, cuando ya existen las funciones de validación

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    const base = empty();
    const clients = {};
    for (const c of Object.values(data.clients || {})) {
      const clean = sanitizeClient(c);
      if (clean) clients[clean.key] = clean;
    }
    const settings = { ...base.settings, ...(data.settings || {}) };
    // 04/11/2026: los horarios, que estaban apagados (1.9.0), vuelven encendidos y con margen.
    if (data.settings?.hoursV !== 2) Object.assign(settings, { useWindows: true, hoursV: 2 });
    return { ...base, ...data, clients, settings };
  } catch {
    // Antes de empezar de cero, se aparta lo que había para poder recuperarlo a mano.
    try { if (raw) localStorage.setItem(`${KEY}-dañado-${Date.now()}`, raw); } catch { /* sin espacio */ }
    return empty();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    // Sin espacio: lo prescindible son los tiempos guardados de días que no son hoy.
    const today = isoDate();
    for (const r of Object.values(state.routes)) if (r.date !== today) r.pairs = {};
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      onSaveError(e);
      return false;
    }
  }
}

// Pide al navegador que no borre los datos aunque falte espacio en el móvil.
export async function requestPersist() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export const db = () => state;
export const settings = () => state.settings;

export function setSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  save();
}

// ---------- Validación ----------

const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const int = (v, min, max, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : dflt; };

export function cleanWindows(w) {
  if (!Array.isArray(w)) return [];
  return w
    .filter((p) => Array.isArray(p) && p.length === 2)
    .map(([a, b]) => [int(a, 0, 1440, -1), int(b, 0, 1440, -1)])
    .filter(([a, b]) => a >= 0 && b > a)
    .sort((x, y) => x[0] - y[0])
    .slice(0, 6);
}

// Solo campos conocidos y con el tipo correcto: protege de archivos manipulados o rotos.
export function sanitizeClient(c) {
  if (!c || typeof c !== 'object') return null;
  const name = str(c.name, 120).trim();
  const key = clientKey(name);
  if (!key) return null;
  const lat = num(c.lat, -90, 90), lon = num(c.lon, -180, 180);
  const located = lat !== null && lon !== null;
  return {
    key,
    name,
    address: str(c.address),
    lat: located ? lat : null,
    lon: located ? lon : null,
    label: str(c.label),
    windows: cleanWindows(c.windows),
    service: int(c.service, 1, 180, 10),
    phone: str(c.phone, 40),
    notes: str(c.notes, 500),
    // Con el horario: 'strict' (no se le puede llegar tarde), 'flex' (no pasa nada por pasarse un poco) o normal.
    timing: c.timing === 'strict' || c.timing === 'flex' ? c.timing : '',
    visits: int(c.visits, 0, 100000, 0),
    lastVisit: /^\d{4}-\d{2}-\d{2}$/.test(c.lastVisit) ? c.lastVisit : undefined,
    needsCheck: !!c.needsCheck,
    // El conductor ha confirmado el horario llamando al cliente: el del portal ya no lo cambia.
    windowsConfirmed: !!c.windowsConfirmed,
    serviceLog: Array.isArray(c.serviceLog) ? c.serviceLog.map((m) => int(m, 1, 120, 0)).filter(Boolean).slice(-8) : [],
    serviceLearned: !!c.serviceLearned,
    updatedAt: Math.min(int(c.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0), Date.now()),
  };
}

state = load();

// ---------- Clientes (memoria) ----------

const own = (key) => (Object.hasOwn(state.clients, key) ? state.clients[key] : null);

export function findClient(name) {
  return own(clientKey(name));
}

// Campos a null borran el dato (p. ej. una ubicación que ya no vale); undefined lo deja como estaba.
export function rememberClient(data, { renamedFrom } = {}) {
  const key = clientKey(data.name);
  if (!key) return null;
  const prev = own(key) || (renamedFrom && own(renamedFrom)) || { visits: 0 };
  if (renamedFrom && renamedFrom !== key) delete state.clients[renamedFrom];
  const merged = { ...prev, ...stripUndefined(data), key, updatedAt: Date.now() };
  state.clients[key] = merged;
  save();
  return merged;
}

// Tiempo real de descarga en un cliente: con 3 o más entregas, la mediana pasa a ser su tiempo de descarga.
export function learnService(name, minutes) {
  const c = findClient(name);
  if (!c || !(minutes >= 1 && minutes <= 90)) return null;
  const log = [...(c.serviceLog || []), Math.round(minutes)].slice(-8);
  const patch = { name: c.name, serviceLog: log };
  if (log.length >= 3) {
    const sorted = [...log].sort((a, b) => a - b);
    patch.service = sorted[Math.floor(sorted.length / 2)];
    patch.serviceLearned = true;
  }
  return rememberClient(patch);
}

export function forgetClient(key) {
  if (Object.hasOwn(state.clients, key)) delete state.clients[key];
  save();
}

export function clientList() {
  return Object.values(state.clients).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

// ---------- Rutas ----------

export function route(date) {
  if (!state.routes[date]) state.routes[date] = { date, stops: [], plan: null, status: 'draft', pairs: {}, history: [] };
  return state.routes[date];
}

export function hasRoute(date) {
  return !!state.routes[date]?.stops?.length;
}

export function pruneOldRoutes(keepDays = 21) {
  const limit = new Date();
  limit.setDate(limit.getDate() - keepDays);
  const iso = isoDate(limit), today = isoDate();
  for (const [d, r] of Object.entries(state.routes)) {
    if (d < iso) delete state.routes[d];
    else if (d < today || r.status === 'done') r.pairs = {}; // los tiempos solo sirven el mismo día
  }
  save();
}

export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- Compartir memoria con compañeros ----------

// Configuración para un compañero: almacén, jornada y clientes. Nunca las claves: cada uno pone la suya.
export function exportConfig() {
  const { depot, shiftStart, service, returnToDepot, nav } = state.settings;
  return JSON.stringify({
    app: 'ruta-escola', kind: 'config', version: 4, exportedAt: new Date().toISOString(),
    settings: { depot, shiftStart, service, returnToDepot, nav }, clients: state.clients,
  });
}

// Solo valores con forma válida: un archivo manipulado no puede meter otra cosa en los ajustes.
export function applyConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return [];
  const patch = {}, applied = [];
  // Las claves de un archivo (las configuraciones antiguas las llevaban) no se usan nunca: son de quien lo mandó.
  const d = cfg.depot;
  const lat = num(d?.lat, -90, 90), lon = num(d?.lon, -180, 180);
  if (lat !== null && lon !== null) { patch.depot = { name: str(d.name, 120) || 'Almacén', lat, lon }; applied.push('almacén'); }
  if (typeof cfg.shiftStart === 'string' && /^\d{2}:\d{2}$/.test(cfg.shiftStart)) { patch.shiftStart = cfg.shiftStart; applied.push('hora de inicio'); }
  if (cfg.service != null) patch.service = int(cfg.service, 1, 180, state.settings.service);
  if (typeof cfg.returnToDepot === 'boolean') patch.returnToDepot = cfg.returnToDepot;
  if (cfg.nav === 'waze' || cfg.nav === 'gmaps') patch.nav = cfg.nav;
  setSettings(patch);
  return applied;
}

export function exportClients() {
  return JSON.stringify({ app: 'ruta-escola', version: 1, exportedAt: new Date().toISOString(), clients: state.clients }, null, 2);
}

// Copia de seguridad completa: clientes, rutas y ajustes, sin las claves (son personales).
export function exportBackup() {
  const { tomtomKey, orsKey, ...rest } = state.settings;
  const routes = Object.fromEntries(Object.entries(state.routes).map(([d, r]) => [d, { ...r, pairs: {} }]));
  return JSON.stringify({ app: 'ruta-escola', kind: 'backup', version: 2, exportedAt: new Date().toISOString(), settings: rest, clients: state.clients, routes });
}

export function markBackup() {
  setSettings({ lastBackupAt: Date.now() });
}

// Rutas de una copia: solo se añaden los días que no hay en este móvil, y solo con datos que cuadran.
function importRoutes(routes) {
  let n = 0;
  if (!routes || typeof routes !== 'object') return 0;
  for (const [date, r] of Object.entries(routes)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Object.hasOwn(state.routes, date) || !Array.isArray(r?.stops)) continue;
    const stops = r.stops.slice(0, 200).map((x) => {
      const c = sanitizeClient(x);
      if (!c || typeof x.id !== 'string') return null;
      return {
        id: x.id.slice(0, 40), name: c.name, address: c.address, lat: c.lat, lon: c.lon, label: c.label, windows: c.windows,
        service: c.service, phone: c.phone, notes: c.notes, needsCheck: c.needsCheck,
        done: !!x.done, doneAt: x.done ? int(x.doneAt, 0, Number.MAX_SAFE_INTEGER, 0) : undefined,
        failed: x.failed ? str(x.failed, 60) : undefined,
      };
    }).filter(Boolean);
    const allDone = stops.length && stops.every((x) => x.done);
    state.routes[date] = { date, stops, plan: null, status: allDone ? 'done' : 'draft', pairs: {}, history: [] };
    n++;
  }
  return n;
}

export function importClients(json) {
  if (json.length > MAX_IMPORT_BYTES) throw new Error('Archivo demasiado grande');
  const data = JSON.parse(json);
  if (!data || typeof data.clients !== 'object' || Array.isArray(data.clients)) throw new Error('Archivo no válido');
  let added = 0, updated = 0;
  for (const raw of Object.values(data.clients)) {
    const c = sanitizeClient(raw);
    if (!c) continue;
    // Una ubicación que viene de otro móvil se marca para revisar la primera vez.
    if (c.lat !== null) c.needsCheck = true;
    const mine = own(c.key);
    if (!mine) { state.clients[c.key] = c; added++; }
    else if (c.updatedAt > (mine.updatedAt || 0)) {
      state.clients[c.key] = { ...mine, ...c, visits: Math.max(mine.visits || 0, c.visits), lastVisit: mine.lastVisit || c.lastVisit };
      updated++;
    }
  }
  const routes = data.kind === 'backup' ? importRoutes(data.routes) : 0;
  save();
  return { added, updated, routes };
}
