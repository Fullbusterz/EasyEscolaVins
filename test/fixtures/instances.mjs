// Instancias realistas del área de Barcelona (de la auditoría de rendimiento, 2026-11-02).
export function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const C = { lat: 41.372, lon: 2.077 };
function hav(a, b) { const R = 6371, r = Math.PI / 180; const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
function offset(p, dxKm, dyKm) { return { lat: p.lat + dyKm / 111.32, lon: p.lon + dxKm / (111.32 * Math.cos(p.lat * Math.PI / 180)) }; }
// windows (minutes): HORECA mix
const W = [[[540, 780]], [[600, 780]], [[960, 1140]], [[540, 780], [960, 1140]], []];
const WP = [0.35, 0.25, 0.12, 0.10, 0.18];
export function makeInstance(n, seed, { start = 480, service = 10, sigma = 2.2 } = {}) {
  const r = prng(seed * 7919 + n);
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  // 3 zones (e.g. BCN centre, L'Hospitalet/Cornellà, Baix Llobregat) within 15 km; 10% scattered up to 25 km
  const zones = Array.from({ length: 3 }, () => { const ang = r() * 2 * Math.PI, d = 2 + r() * 13; return offset(C, d * Math.cos(ang), d * Math.sin(ang)); });
  const pts = [];
  while (pts.length < n) {
    let p;
    if (r() < 0.1) { const ang = r() * 2 * Math.PI, d = 25 * Math.sqrt(r()); p = offset(C, d * Math.cos(ang), d * Math.sin(ang)); }
    else { const z = zones[Math.floor(r() * 3)]; p = offset(z, sigma * gauss(), sigma * gauss()); }
    if (hav(C, p) <= 25) pts.push(p);
  }
  const all = [C, ...pts];
  const tt = (a, b, i, j) => (i === j ? 0 : (1.35 * hav(a, b) / 30) * 60 + 3);
  const matrix = all.map((a, i) => all.map((b, j) => (j === 0 ? 0 : tt(a, b, i, j))));
  const back = all.map((a, i) => tt(a, C, i, 0));
  const stops = pts.map(() => { let x = r(), k = 0; while (x > WP[k]) { x -= WP[k]; k++; } return { windows: W[k], service }; });
  return { ctx: { matrix, back, start, returnTo: true, stops }, pts };
}
