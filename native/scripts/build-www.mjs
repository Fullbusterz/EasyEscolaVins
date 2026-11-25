// Copia la web (la misma que se publica) a native/www, que es lo que va dentro de la app de iPhone.
// Lo que solo tiene sentido en la web (service worker, enlaces de Android) se queda fuera.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(here, '..', 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'manifest.webmanifest', 'css', 'js', 'data', 'icons', 'vendor']) {
  const from = join(root, item);
  if (existsSync(from)) cpSync(from, join(out, item), { recursive: true });
}
console.log(`Web copiada a ${out}`);
