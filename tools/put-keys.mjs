// Mete las claves de Google en js/config.js de una copia de la app, justo antes de publicarla.
// Las claves viven como secretos de GitHub (GOOGLE_MAPS_KEY, GOOGLE_MAPS_KEY_IOS), nunca en el repositorio:
// es público y hay robots que buscan claves en GitHub.
//
//   node tools/put-keys.mjs <carpeta>      (la carpeta que se publica: la web o native/www)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Uso: node tools/put-keys.mjs <carpeta>'); process.exit(1); }
const file = join(dir, 'js', 'config.js');
let src = readFileSync(file, 'utf8');
// Una clave de Google: «AIza» y 35 letras, números, guiones o guiones bajos. Nada más entra en el archivo.
const valid = (k) => /^AIza[0-9A-Za-z_-]{35}$/.test(k);
let put = 0;
for (const name of ['GOOGLE_MAPS_KEY', 'GOOGLE_MAPS_KEY_IOS']) {
  const key = (process.env[name] || '').trim();
  if (!key) continue;
  if (!valid(key)) { console.error(`${name} no parece una clave de Google (empieza por AIza y tiene 39 caracteres)`); process.exit(1); }
  const re = new RegExp(`export const ${name} = '[^']*';`);
  if (!re.test(src)) { console.error(`No encuentro ${name} en ${file}`); process.exit(1); }
  src = src.replace(re, `export const ${name} = '${key}';`);
  put++;
}
writeFileSync(file, src);
console.log(put ? `Claves puestas en ${file}: ${put}` : `Sin claves en el entorno: ${file} se queda sin clave (rutas aproximadas)`);
