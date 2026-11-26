// Mete las claves de rutas en js/config.js de una copia de la app, justo antes de publicarla.
// Las claves viven como secretos de GitHub (TOMTOM_KEY y ORS_KEY), nunca en el repositorio.
//
//   node tools/put-keys.mjs <carpeta>      (la carpeta que se publica: la web o native/www)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Uso: node tools/put-keys.mjs <carpeta>'); process.exit(1); }
const file = join(dir, 'js', 'config.js');
let src = readFileSync(file, 'utf8');
const formats = {
  TOMTOM_KEY: /^[A-Za-z0-9]{20,64}$/,
  ORS_KEY: /^[A-Za-z0-9=_.\-]{20,400}$/,
};
let put = 0;
for (const [name, valid] of Object.entries(formats)) {
  const key = (process.env[name] || '').trim();
  if (!key) continue;
  if (!valid.test(key)) { console.error(`${name} no tiene un formato válido`); process.exit(1); }
  const re = new RegExp(`export const ${name} = '';`);
  if (!re.test(src)) { console.error(`No encuentro ${name} en ${file}`); process.exit(1); }
  src = src.replace(re, `export const ${name} = '${key}';`);
  put++;
}
writeFileSync(file, src);
console.log(put ? `Claves puestas en ${file}: ${put}` : `Sin claves en el entorno: ${file} se queda sin clave (rutas aproximadas)`);
