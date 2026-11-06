// Mapa de la ruta: las paradas en su orden, el camino y los aparcamientos.
// Desde aquí el conductor agrupa entregas para hacerlas a pie desde un mismo sitio: cuáles juntar lo decide él
// (sabe dónde suele haber sitio y qué cabe en la carretilla); la app propone dónde dejar la furgoneta.
// Mapa base: © ICGC (CC BY 4.0) y © OpenStreetMap. Leaflet 1.9.4 (BSD-2-Clause) en vendor/leaflet.

import { spotsFor, spotAt, parkedTime, walkMin, trips, DUM_MINUTES } from './parking.js';
import { bigOrder } from './portal.js';
import { fmt } from './parse.js';

const TILES = 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/estandard-gris/MON3857NW/{z}/{x}/{y}.png';
const ATTR = '© <a href="https://www.icgc.cat/" target="_blank" rel="noopener">ICGC</a> (CC BY 4.0) · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const GOLD = '#c9a54c', WALK = '#9fd1b2', ZONE = '#6f9fd8';
const ZONES_FROM_ZOOM = 16; // las zonas de carga y descarga solo se pintan de cerca
const X = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ll = (p) => [p.lat, p.lon];

let leaflet = null;
function loadLeaflet() {
  if (!leaflet) {
    leaflet = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css';
      document.head.append(css);
      const js = document.createElement('script');
      js.src = 'vendor/leaflet/leaflet.js';
      js.onload = () => resolve(window.L);
      js.onerror = () => { leaflet = null; reject(new Error('No se ha podido cargar el mapa')); };
      document.head.append(js);
    });
  }
  return leaflet;
}

// mode: 'view' (mirar), 'select' (elegir entregas), 'spot' (decidir dónde aparcar)
const st = { api: null, data: null, map: null, layers: null, zones: null, mode: 'view', selected: [], spot: null, rejected: [], busy: false };

/**
 * api.data(): { depot, returnToDepot, planned, current, unlocated, nav, zones,
 *   stops: [{id, name, label, lat, lon, windows, planWindows, service, done, leg, nav}] en orden,
 *   parking: [{key, ids, lat, lon, label, dum}] }
 * api.accept(ids, spot), api.remove(key): cambian la ruta y la recalculan (async). api.closed(): al cerrar.
 */
export async function openMap(api) {
  st.api = api; st.mode = 'view'; st.selected = []; st.spot = null; st.rejected = [];
  let root = document.getElementById('mapview');
  if (!root) {
    root = document.createElement('div');
    root.id = 'mapview';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'map-title');
    root.innerHTML = `<div class="map-top"><h2 id="map-title">Ruta en el mapa</h2>
        <button class="iconbtn" data-map="close" aria-label="Cerrar el mapa">${X}</button></div>
      <div id="map"></div><div class="map-panel" id="map-panel" aria-live="polite"></div>`;
    document.body.append(root);
    root.addEventListener('click', onClick);
  }
  root.hidden = false;
  document.body.classList.add('map-open');
  panel('<div class="small muted">Cargando el mapa…</div>');
  let L;
  try { L = await loadLeaflet(); } catch (e) { return panel(`<div class="notice warn">${esc(e.message)}. Comprueba la conexión.</div>`); }
  if (!st.map) {
    st.map = L.map('map', { zoomControl: false, preferCanvas: true });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(st.map);
    L.control.zoom({ position: 'topright' }).addTo(st.map);
    st.map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    st.zones = L.layerGroup().addTo(st.map);
    st.layers = L.layerGroup().addTo(st.map);
    st.map.on('moveend', drawZones);
  }
  // Se encuadra cuando el mapa ya tiene su tamaño (recién abierto o tras recargar puede no tenerlo aún).
  setTimeout(() => { st.map.invalidateSize(); draw(true); }, 0);
  setTimeout(() => { st.map.invalidateSize(); if (st.mode === 'view') fitRoute(); }, 400);
}

function close() {
  const root = document.getElementById('mapview');
  if (root) root.hidden = true;
  document.body.classList.remove('map-open');
  st.api?.closed?.();
}

const parkOf = (id) => st.data.parking.find((p) => p.ids.includes(id));
const members = () => st.data.stops.filter((s) => st.selected.includes(s.id)); // en el orden de la ruta
// De cerca, el grupo y la P: así se ven también las zonas de carga y descarga de alrededor.
const focus = () => { if (st.spot) st.map.fitBounds([...members().map(ll), ll(st.spot)], { padding: [60, 60], maxZoom: 17 }); };

function icon(cls, html, size = 30) {
  return window.L.divIcon({ className: `pin ${cls}`, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function draw(fit) {
  const L = window.L;
  const d = st.data = st.api.data();
  st.layers.clearLayers();
  const depot = ll(d.depot);
  const bounds = []; // se encuadran las paradas: con el almacén lejos quedarían amontonadas

  // El camino en furgoneta (rectas en el orden de la ruta) y los tramos a pie desde cada aparcamiento.
  const car = [depot];
  for (const s of d.stops) {
    if (s.done && d.current) continue;
    const p = parkOf(s.id);
    if (s.leg?.foot) continue;
    car.push(p ? ll(p) : ll(s));
  }
  if (d.returnToDepot && d.stops.length) car.push(depot);
  if (car.length > 1) L.polyline(car, { color: GOLD, weight: 3, opacity: 0.8, interactive: false }).addTo(st.layers);
  for (const p of d.parking) {
    for (const id of p.ids) {
      const s = d.stops.find((x) => x.id === id);
      if (s) L.polyline([ll(p), ll(s)], { color: WALK, weight: 2, dashArray: '4 6', interactive: false }).addTo(st.layers);
    }
    const names = p.ids.map((id) => d.stops.find((x) => x.id === id)?.name).filter(Boolean);
    L.marker(ll(p), { icon: icon('park', 'P', 28), keyboard: false, title: 'Aparcamiento' }).addTo(st.layers)
      .bindPopup(`<b>${p.dum ? `Zona DUM · ${esc(p.label)}` : 'Aparcamiento'}</b><br>A pie: ${esc(names.join(', '))}
        <div class="pop-actions"><button class="linkbtn" data-map="unpark" data-key="${esc(p.key)}">Quitar este aparcamiento</button></div>`);
    bounds.push(ll(p));
  }

  L.marker(depot, { icon: icon('depot', 'A', 28), keyboard: false, title: 'Almacén' }).addTo(st.layers).bindPopup('<b>Almacén</b>');
  d.stops.forEach((s, i) => {
    const cls = [s.done ? 'done' : '', s.id === d.current ? 'current' : '', st.selected.includes(s.id) ? 'sel' : '', parkOf(s.id) ? 'grouped' : '', bigOrder(s.load) ? 'big' : ''].join(' ');
    const m = L.marker(ll(s), { icon: icon(cls, String(i + 1)), title: s.name, zIndexOffset: st.selected.includes(s.id) ? 500 : 0 }).addTo(st.layers);
    m.on('click', () => onStop(s, m));
    bounds.push(ll(s));
  });

  if (st.mode === 'spot' && st.spot) {
    for (const s of members()) L.polyline([ll(st.spot), ll(s)], { color: GOLD, weight: 2, dashArray: '4 6', interactive: false }).addTo(st.layers);
    const pm = L.marker(ll(st.spot), { icon: icon('park new', 'P', 34), draggable: true, zIndexOffset: 1000, title: 'Aparcar aquí' }).addTo(st.layers);
    pm.on('dragend', () => { const p = pm.getLatLng(); st.spot = { ...spotAt({ lat: p.lat, lon: p.lng }, d.zones), manual: true }; draw(false); });
  }
  st.bounds = bounds.length ? bounds : [depot];
  if (fit) fitRoute();
  drawZones();
  renderPanel();
}

function fitRoute() {
  if (st.bounds.length > 1) st.map.fitBounds(st.bounds, { padding: [36, 36], maxZoom: 17 });
  else st.map.setView(st.bounds[0], 15);
}

// Zonas de carga y descarga a la vista, solo al agrupar y de cerca. En modo «dónde aparcar», tocar una la elige.
function drawZones() {
  const L = window.L;
  if (!st.zones || !st.data) return;
  st.zones.clearLayers();
  if (st.mode === 'view' || st.map.getZoom() < ZONES_FROM_ZOOM) return;
  const b = st.map.getBounds();
  let n = 0;
  for (const [lat, lon, label] of st.data.zones) {
    if (!b.contains([lat, lon]) || ++n > 400) continue;
    const c = L.circleMarker([lat, lon], { radius: 6, color: ZONE, weight: 2, fillColor: ZONE, fillOpacity: 0.35 }).addTo(st.zones);
    c.bindTooltip(`Carga y descarga · ${esc(label)}`, { direction: 'top' });
    c.on('click', () => {
      if (st.mode !== 'spot') return;
      st.spot = { lat, lon, label, dum: true, manual: true };
      draw(false);
    });
  }
}

function onStop(s, marker) {
  if (st.mode === 'select') {
    if (s.done) return;
    st.selected = st.selected.includes(s.id) ? st.selected.filter((id) => id !== s.id) : [...st.selected, s.id];
    draw(false);
    return;
  }
  if (st.mode === 'spot') return;
  const leg = s.leg;
  const win = s.windows?.length ? s.windows.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(', ') : 'cualquier hora';
  marker.bindPopup(`<b>${esc(s.name)}</b><br><span class="muted">${esc(s.label || '')}</span><br>
    ${leg ? `Llegada ${fmt(leg.arrive)} · ` : ''}Horario ${esc(win)}${parkOf(s.id) ? '<br>A pie desde el aparcamiento' : ''}
    ${s.done ? '' : `<div class="pop-actions"><a href="${esc(s.nav)}" target="_blank" rel="noopener">Abrir en ${st.data.nav === 'gmaps' ? 'Maps' : 'Waze'}</a></div>`}`).openPopup();
}

function panel(html) { const p = document.getElementById('map-panel'); if (p) p.innerHTML = html; }

function renderPanel() {
  const d = st.data;
  if (st.busy) return panel(`<button class="btn gold big block" disabled><span class="spin"></span>${esc(st.busy)}</button>`);
  if (st.mode === 'view') {
    const pending = d.stops.filter((s) => !s.done).length;
    return panel(`<div class="small muted">${pending === 1 ? '1 parada' : `${pending} paradas`} ${d.planned ? 'en el orden de la ruta' : 'sin optimizar todavía'}${d.unlocated ? ` · ${d.unlocated} sin ubicar no ${d.unlocated === 1 ? 'sale' : 'salen'}` : ''}.
      La línea dorada es el camino en furgoneta; la verde discontinua, a pie desde un aparcamiento.</div>
      <button class="btn gold big block" data-map="group" style="margin-top:12px"${pending < 2 ? ' disabled' : ''}>Agrupar entregas para aparcar</button>
      ${d.parking.length ? `<button class="btn danger block" data-map="clear" style="margin-top:8px">Quitar ${d.parking.length === 1 ? 'el aparcamiento' : `los ${d.parking.length} aparcamientos`}</button>` : ''}`);
  }
  if (st.mode === 'select') {
    const sel = members();
    return panel(`<div class="small">Toca en el mapa las entregas que harás a pie desde un mismo sitio.</div>
      <div class="small muted" style="margin-top:4px">${sel.length ? sel.map((s) => esc(s.name) + (bigOrder(s.load) ? ' <b class="big-ink">(grande)</b>' : '')).join(', ') : 'Ninguna elegida todavía.'}</div>
      <div class="map-actions"><button class="btn gold" data-map="find"${sel.length < 2 ? ' disabled' : ''}>Buscar dónde aparcar${sel.length >= 2 ? ` (${sel.length})` : ''}</button>
      <button class="btn ghost" data-map="cancel">Cancelar</button></div>`);
  }
  // spot
  const sel = members(), sp = st.spot;
  if (!sp) {
    return panel(`<div class="small">No encuentro ninguna zona de carga y descarga a mano. Arrastra el mapa y toca un punto azul, o vuelve atrás.</div>
      <div class="map-actions"><button class="btn ghost" data-map="back">Atrás</button></div>`);
  }
  const t = parkedTime(sel.map((s) => ({ ...s, windows: s.planWindows })), sp, d.planned ? new Map(d.stops.filter((s) => s.leg).map((s) => [s.id, s.leg])) : null);
  const where = sp.dum ? `Zona de carga y descarga · <b>${esc(sp.label)}</b>` : sp.manual ? '<b>El punto que has elegido</b>' : '<b>Punto medio</b> (no hay zona de carga y descarga cerca)';
  const lateNames = t ? sel.filter((s) => t.late.includes(s.id)).map((s) => s.name) : [];
  const over = t && sp.dum && t.minutes > DUM_MINUTES;
  panel(`<div class="small">${where}</div>
    <div class="small muted" style="margin-top:4px">A pie: ${sel.map((s) => `${esc(s.name)} ${Math.max(1, Math.round(walkMin(sp, s)))} min${trips(s) > 1 ? ` × ${trips(s)} viajes` : ''}`).join(' · ')}</div>
    ${sel.some((s) => bigOrder(s.load)) ? '<div class="tiny faint" style="margin-top:4px">Los pedidos grandes pesan más: el sitio queda más cerca de ellos.</div>' : ''}
    ${t ? `<div class="small ${over ? 'late-ink' : 'muted'}" style="margin-top:4px">Aparcado unos ${Math.round(t.minutes)} min${sp.dum ? ` de los ${DUM_MINUTES} que deja SPRO` : ''}${over ? ': no cabe en una validación' : ''}.</div>` : ''}
    ${lateNames.length ? `<div class="small late-ink" style="margin-top:4px">Llegarías tarde a ${esc(lateNames.join(', '))}.</div>` : ''}
    <div class="map-actions three"><button class="btn gold" data-map="accept">Aceptar</button>
      <button class="btn ghost" data-map="other">Otro sitio</button>
      <button class="btn ghost" data-map="back">Atrás</button></div>
    <div class="tiny faint" style="margin-top:8px">También puedes arrastrar la P o, de cerca, tocar un punto azul (zona de carga y descarga).</div>`);
}

async function run(text, fn) {
  st.busy = text; renderPanel();
  try { await fn(); } finally { st.busy = false; }
  draw(false);
}

function onClick(e) {
  const el = e.target.closest('[data-map]');
  if (!el || el.disabled) return;
  e.preventDefault();
  const what = el.dataset.map;
  if (what === 'close') return close();
  if (what === 'group') { st.mode = 'select'; st.selected = []; st.map.closePopup(); return draw(false); }
  if (what === 'cancel') { st.mode = 'view'; st.selected = []; return draw(false); }
  if (what === 'find') {
    st.mode = 'spot'; st.rejected = [];
    st.spot = spotsFor(members(), st.data.zones)[0] || null;
    focus();
    return draw(false);
  }
  if (what === 'other') {
    if (st.spot) st.rejected.push(st.spot);
    const next = spotsFor(members(), st.data.zones, st.rejected)[0];
    if (next) { st.spot = next; focus(); } else { st.spot = st.spot && { ...st.spot }; panelNote('No hay más zonas a mano: arrastra la P donde puedas aparcar.'); return; }
    return draw(false);
  }
  if (what === 'back') { st.mode = 'select'; st.spot = null; return draw(false); }
  if (what === 'accept') {
    const ids = members().map((s) => s.id), spot = st.spot;
    st.mode = 'view'; st.selected = []; st.spot = null;
    return run('Recalculando la ruta…', () => st.api.accept(ids, spot));
  }
  if (what === 'clear') { st.map.closePopup(); return run('Recalculando la ruta…', () => st.api.clear()); }
  if (what === 'unpark') { st.map.closePopup(); return run('Recalculando la ruta…', () => st.api.remove(el.dataset.key)); }
}

function panelNote(text) {
  const p = document.getElementById('map-panel');
  if (!p) return;
  p.querySelector('.map-note')?.remove();
  p.insertAdjacentHTML('afterbegin', `<div class="notice warn map-note" style="margin:0 0 10px">${esc(text)}</div>`);
}
