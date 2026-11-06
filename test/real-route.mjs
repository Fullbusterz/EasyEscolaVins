// Prueba de extremo a extremo con direcciones reales (ICGC/CartoCiudad) y tiempos de openrouteservice si hay ORS_KEY y direcciones reales del área de reparto.
const _f = globalThis.fetch; globalThis.fetch = (u, o = {}) => _f(u, { ...o, headers: { ...(o.headers || {}), 'User-Agent': 'RutaEscola-test/0.1 (dev test)' } });
import { geocode } from '../js/geo.js';
import { computePlan } from '../js/planner.js';
import { fmt, parseList } from '../js/parse.js';

const depot = { lat: 41.372083, lon: 2.077356 };
const list = parseList(`Mercat de Sant Feliu - Rambla Marquesa de Castellbell, Sant Feliu de Llobregat - 10:00-13:00
Bar Centre - Plaça de la Vila, Cornellà de Llobregat
Restaurant Port - Moll de la Fusta, Barcelona - 12:00-14:00
Bodega Esplugues - Carrer de Laureà Miró 300, Esplugues de Llobregat
Vinoteca Hospitalet - Rambla de Just Oliveras 30, L'Hospitalet de Llobregat - 8:00-9:30
Celler El Prat - Plaça de Catalunya, El Prat de Llobregat
Bar Molins - Plaça de la Creu, Molins de Rei - 9:00-11:00
Can Viladecans - Rambla de Modolell, Viladecans
Taverna Sants - Carrer de Sants 200, Barcelona - de 11 a 13h
Restaurant Sant Boi - Plaça de Catalunya, Sant Boi de Llobregat`);

const stops = [];
for (const [i, s] of list.entries()) {
  const [hit] = await geocode(s.address);
  if (!hit) { console.log('SIN RESULTADO:', s.address); continue; }
  stops.push({ id: 's' + i, name: s.name, lat: hit.lat, lon: hit.lon, windows: s.windows, service: 10, label: hit.label });
}
for (const s of stops) console.log(s.name.padEnd(24), s.windows.map(w => w.map(fmt).join('-')).join(' ').padEnd(12), s.label);

const plan = await computePlan({ from: depot, depot, stops, startMin: 450, departAt: new Date(), orsKey: process.env.ORS_KEY, tomtomKey: process.env.TOMTOM_KEY });
console.log(`\nSalida 07:30 · ${plan.source} · ${plan.km.toFixed(1)} km · vuelta ${fmt(plan.end)} · retraso ${plan.late} min · espera ${Math.round(plan.wait)} min`);
for (const l of plan.legs) {
  const s = stops.find(x => x.id === l.id);
  console.log(`${fmt(l.arrive)} ${l.wait > 0.5 ? '(espera ' + Math.round(l.wait) + ')' : ''} ${s.name} ${s.windows.length ? '[' + s.windows.map(w => w.map(fmt).join('-')).join(' ') + ']' : ''} ${l.late ? 'TARDE ' + Math.round(l.late) : ''}`);
}

// "Siguiente": tras la primera entrega, recalcula desde allí reutilizando los tiempos entre paradas.
const first = stops.find(s => s.id === plan.order[0]);
const rest = stops.filter(s => s.id !== first.id);
const t0 = Date.now();
const p2 = await computePlan({ from: first, depot, stops: rest, startMin: plan.legs[0].begin + 10, departAt: new Date(), pairs: plan.pairs, orsKey: process.env.ORS_KEY });
console.log(`\nSiguiente desde ${first.name}: ${stops.find(s => s.id === p2.order[0]).name} a las ${fmt(p2.legs[0].arrive)} (${Date.now() - t0} ms, reutiliza pares: ${Object.keys(p2.pairs).length === Object.keys(plan.pairs).length})`);
