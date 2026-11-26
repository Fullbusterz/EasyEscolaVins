import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Si un servicio al que llama la app no está en connect-src, el navegador bloquea la consulta sin avisar
// y la ruta sale siempre aproximada. Esto comprueba que cada dirección de js/geo.js está permitida.
test('la CSP de index.html deja conectar con todos los servicios de geo.js', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const connect = /connect-src ([^;"]+)/.exec(html)?.[1].split(/\s+/) || [];
  const geo = readFileSync(new URL('../js/geo.js', import.meta.url), 'utf8');
  const hosts = [...new Set([...geo.matchAll(/https:\/\/([a-z0-9.-]+)\//g)].map((m) => `https://${m[1]}`))]
    // Enlaces que se abren en otra app (navegación), no consultas.
    .filter((h) => !/maps\.google|google\.com|waze\.com|maps\.apple/.test(h));
  assert.ok(hosts.includes('https://api.heigit.org') && hosts.includes('https://api.tomtom.com'));
  for (const h of hosts) assert.ok(connect.includes(h), `${h} falta en connect-src`);
});
