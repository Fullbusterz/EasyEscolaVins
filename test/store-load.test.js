import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Este archivo arranca con datos ya guardados (cada archivo de test va en su propio proceso).
const mem = new Map([['ruta-escola-v1', JSON.stringify({
  settings: { shiftStart: '08:00', orsKey: 'claveORS', tomtomKey: 'claveTomTom', googleKey: 'claveAntigua' },
  clients: {
    paco: { name: 'Vinos Paco', address: 'C/ Major 12', lat: 41.38, lon: 2.05, windows: [[540, 690]], visits: 4, updatedAt: 1 },
    evil: { name: 'Evil', visits: '<img src=x onerror=alert(1)>', service: '"><img src=x>', windows: 'abc' },
  },
  routes: { '2099-01-01': { date: '2099-01-01', stops: [{ id: 'a', name: 'Vinos Paco' }], status: 'draft', pairs: { 'a>b': { m: 3, src: 'ors' } } } },
})]]);
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import('../js/store.js');

test('al abrir la app conserva los datos guardados y sanea lo raro', () => {
  assert.equal(store.settings().shiftStart, '08:00');
  assert.equal(store.findClient('vinos paco').visits, 4);
  assert.deepEqual(store.findClient('vinos paco').windows, [[540, 690]]);
  assert.equal(store.findClient('evil').visits, 0);
  assert.equal(store.findClient('evil').service, 12);
  assert.equal(store.route('2099-01-01').stops.length, 1);
  assert.equal([...mem.keys()].some((k) => k.includes('dañado')), false);
});

test('conserva las claves guardadas de openrouteservice y TomTom', () => {
  assert.equal(store.settings().orsKey, 'claveORS');
  assert.equal(store.settings().tomtomKey, 'claveTomTom');
  assert.equal(store.settings().googleKey, undefined);
  assert.deepEqual(store.route('2099-01-01').pairs, {});
});

test('put-keys valida los formatos de ambas claves sin imprimirlas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'put-keys-'));
  const config = join(dir, 'js', 'config.js');
  const script = fileURLToPath(new URL('../tools/put-keys.mjs', import.meta.url));
  const tomtom = 'TomTomKeyForTests123456';
  const ors = 'ORS_test-key_for_tests_123456';
  try {
    mkdirSync(join(dir, 'js'));
    writeFileSync(config, "export const TOMTOM_KEY = '';\nexport const ORS_KEY = '';\n");
    const run = (env) => spawnSync(process.execPath, [script, dir], { encoding: 'utf8', env: { ...process.env, ...env } });
    const valid = run({ TOMTOM_KEY: tomtom, ORS_KEY: ors });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(readFileSync(config, 'utf8'), new RegExp(tomtom));
    assert.match(readFileSync(config, 'utf8'), new RegExp(ors));
    writeFileSync(config, "export const TOMTOM_KEY = '';\nexport const ORS_KEY = '';\n");
    const badTomtom = run({ TOMTOM_KEY: 'short', ORS_KEY: '' });
    assert.equal(badTomtom.status, 1);
    assert.ok(!badTomtom.stderr.includes('short'));
    const badOrs = run({ TOMTOM_KEY: '', ORS_KEY: 'bad key with spaces 123456' });
    assert.equal(badOrs.status, 1);
    assert.ok(!badOrs.stderr.includes('bad key'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
