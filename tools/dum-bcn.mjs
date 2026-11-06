// Genera data/dum-bcn.json con las zonas de carga y descarga (Àrea DUM) de Barcelona.
// Fuente: Open Data BCN, «Zones de càrrega i descàrrega» (CC BY 4.0):
// https://opendata-ajuntament.barcelona.cat/data/dataset/zones-carrega-descarrega
// Uso: node tools/dum-bcn.mjs <ruta al CSV descargado>
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Uso: node tools/dum-bcn.mjs opendatabcn_zones-carrega-i-descarrega-csv.csv'); process.exit(1); }

// El CSV del portal viene en UTF-16 con BOM.
const buf = readFileSync(file);
const text = (buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8')).replace(/﻿/g, '');

function parseCsv(s) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const [head, ...rows] = parseCsv(text);
const col = (name) => head.indexOf(name);
const iLat = col('geo_epgs_4326_lat'), iLon = col('geo_epgs_4326_lon');
const iRoad = col('addresses_road_name'), iNum = col('addresses_start_street_number'), iMod = col('modified');
const seen = new Set();
let updated = '';
const zones = [];
for (const r of rows) {
  const lat = +r[iLat], lon = +r[iLon];
  if (!(lat > 41.3 && lat < 41.5 && lon > 2.0 && lon < 2.3)) continue;
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (r[iMod] > updated) updated = r[iMod];
  const label = [r[iRoad].trim(), r[iNum].trim()].filter(Boolean).join(', ');
  zones.push([+lat.toFixed(5), +lon.toFixed(5), label]);
}
zones.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const out = {
  source: 'Ajuntament de Barcelona, Open Data BCN: Zones de càrrega i descàrrega (CC BY 4.0)',
  updated: updated.slice(0, 10),
  zones,
};
writeFileSync(new URL('../data/dum-bcn.json', import.meta.url), JSON.stringify(out));
console.log(`${zones.length} zonas, actualizado ${out.updated}`);
