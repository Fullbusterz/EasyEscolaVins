// Por dónde se entra en un cliente. La dirección del portal es la del local, pero a veces la mercancía entra
// por otro sitio: una rampa al otro lado de la manzana, el muelle de un polígono, el parking de un centro
// comercial. El repartidor lo marca una vez en el mapa y, desde entonces, la ruta, Waze/Maps, el mapa y los
// aparcamientos van a ese punto. La dirección se queda como está: es la que trae el portal y la que se busca.

import { haversineKm } from './geo.js';

// Más lejos que esto ya no es «otra puerta del mismo local»: o el cliente se ha mudado o el punto está mal.
// Una manzana del Eixample son 113 m; un polígono, unos cientos.
export const ENTRY_MAX_M = 600;
// Más cerca que esto es la misma puerta: no aporta nada y solo confunde.
export const ENTRY_MIN_M = 15;

const coord = (v, lim) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? v : null);
const located = (p) => coord(p?.lat, 90) !== null && coord(p?.lon, 180) !== null;

export const entryDistanceM = (a, b) => haversineKm(a, b) * 1000;

// Solo un punto con forma válida y cerca de la dirección (base). Si no, null: sin punto de entrada.
export function cleanEntry(e, base) {
  if (!e || typeof e !== 'object' || !located(e) || !located(base)) return null;
  const m = entryDistanceM(base, e);
  if (m < ENTRY_MIN_M || m > ENTRY_MAX_M) return null;
  const note = typeof e.note === 'string' ? e.note : e.note == null ? '' : String(e.note);
  return { lat: e.lat, lon: e.lon, note: note.trim().slice(0, 80) };
}

// Adónde va la furgoneta para esta parada: su punto de entrada si tiene uno válido, si no, la dirección.
export function goTo(x) {
  const e = cleanEntry(x?.entry, x);
  return e ? { lat: e.lat, lon: e.lon } : { lat: x.lat, lon: x.lon };
}
