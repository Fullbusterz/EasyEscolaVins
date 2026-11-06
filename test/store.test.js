import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import('../js/store.js');

test('importar un archivo manipulado no cuela HTML ni tipos raros', () => {
  const evil = JSON.stringify({ clients: {
    a: { name: 'Bar <b>X</b>', visits: '<img src=x onerror=alert(1)>', service: '"><img src=x>', windows: 'abc', phone: 600123123, lat: '41', lon: 2, updatedAt: 9e15 },
    b: { name: 'constructor', address: 'C/ Major 1' },
    c: { name: '__proto__', address: 'x' },
    d: { name: 'Bodega', windows: [[540, 690], ['a', 3], [700, 600], [0, 99999]], lat: 41.3, lon: 2.07, updatedAt: 1 },
  } });
  const { added } = store.importClients(evil);
  assert.equal(added, 4);
  const x = store.findClient('Bar <b>X</b>');
  assert.equal(x.visits, 0);
  assert.equal(x.service, 10);
  assert.deepEqual(x.windows, []);
  assert.equal(x.phone, '600123123');
  assert.equal(x.lat, null); // "41" no es un número: sin ubicar
  assert.ok(x.updatedAt <= Date.now());
  assert.equal(store.findClient('constructor').address, 'C/ Major 1');
  assert.equal(Object.prototype.polluted, undefined);
  const d = store.findClient('bodega');
  assert.deepEqual(d.windows, [[540, 690]]);
  assert.equal(d.needsCheck, true); // ubicación que viene de otro móvil: a revisar
  assert.equal(store.findClient('toString'), null);
});

test('importar no machaca un cliente más reciente y conserva las visitas', () => {
  store.rememberClient({ name: 'Vinos Paco', address: 'C/ Nueva 1', visits: 7 });
  store.importClients(JSON.stringify({ clients: { v: { name: 'Vinos Paco', address: 'C/ Vieja 9', visits: 2, updatedAt: 5 } } }));
  assert.equal(store.findClient('vinos paco').address, 'C/ Nueva 1');
  assert.throws(() => store.importClients('x'.repeat(3_000_001)), /grande/);
  assert.throws(() => store.importClients('{"clients": []}'), /válido/);
});

test('renombrar un cliente conserva sus visitas; null borra una ubicación vieja', () => {
  store.rememberClient({ name: 'Celler Vell', visits: 3, lat: 41.3, lon: 2.1 });
  store.rememberClient({ name: 'Celler Nou', lat: null, lon: null }, { renamedFrom: 'celler vell' });
  assert.equal(store.findClient('celler vell'), null);
  const c = store.findClient('celler nou');
  assert.equal(c.visits, 3);
  assert.equal(c.lat, null);
});

test('si no cabe, libera los tiempos guardados de otros días y avisa si aun así falla', () => {
  let errors = 0;
  store.setSaveErrorHandler(() => errors++);
  const r = store.route('2020-01-01');
  r.pairs = { big: 'x'.repeat(1000) };
  const real = globalThis.localStorage.setItem;
  let calls = 0;
  globalThis.localStorage.setItem = (k, v) => { calls++; if (calls === 1) throw new Error('QuotaExceededError'); real(k, v); };
  assert.equal(store.save(), true);
  assert.deepEqual(store.route('2020-01-01').pairs, {});
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(store.save(), false);
  assert.equal(errors, 1);
  globalThis.localStorage.setItem = real;
});

test('aprende el tiempo de descarga: con 3 entregas usa la mediana', () => {
  store.rememberClient({ name: 'Bar Lento', service: 10 });
  store.learnService('Bar Lento', 22);
  store.learnService('Bar Lento', 18.4);
  assert.equal(store.findClient('bar lento').service, 10); // aún 2 datos
  store.learnService('Bar Lento', 95); // fuera de rango: se ignora
  store.learnService('Bar Lento', 25);
  const c = store.findClient('bar lento');
  assert.deepEqual(c.serviceLog, [22, 18, 25]);
  assert.equal(c.service, 22);
  assert.equal(c.serviceLearned, true);
});

test('copia de seguridad: sin claves, y al restaurar recupera clientes y días que faltan', () => {
  store.setSettings({ tomtomKey: 'secreto', orsKey: 'secreto2' });
  store.rememberClient({ name: 'Celler Copia', address: 'C/ Major 1', windows: [[540, 600]] });
  const r = store.route('2099-12-24');
  r.stops.push({ id: 'x1', name: 'Celler Copia', address: 'C/ Major 1', lat: 41.3, lon: 2.1, windows: [[540, 600]], service: 10, done: true, doneAt: 5 });
  const json = store.exportBackup();
  assert.ok(!json.includes('secreto'));
  delete store.db().routes['2099-12-24'];
  store.forgetClient('celler copia');
  const res = store.importClients(json);
  assert.equal(store.findClient('celler copia').address, 'C/ Major 1');
  assert.ok(res.routes >= 1);
  assert.equal(store.route('2099-12-24').status, 'done');
  assert.equal(store.route('2099-12-24').stops[0].name, 'Celler Copia');
});

test('pasar configuración: almacén y horario, nunca las claves; al importar solo se aceptan valores válidos', () => {
  store.setSettings({ orsKey: 'eyJvcnMiOiJjbGF2ZSJ9abc', tomtomKey: 'TomTomKey12345678', shiftStart: '07:00' });
  const text = store.exportConfig();
  const cfg = JSON.parse(text);
  assert.equal(cfg.kind, 'config');
  assert.ok(!text.includes('eyJvcnMiOiJjbGF2ZSJ9abc') && !text.includes('TomTomKey12345678'), 'el archivo no lleva las claves');
  store.setSettings({ orsKey: 'MiClaveDeRutas123', tomtomKey: '', shiftStart: '07:30' });
  const applied = store.applyConfig(cfg.settings);
  assert.deepEqual(applied, ['almacén', 'hora de inicio']);
  assert.equal(store.settings().orsKey, 'MiClaveDeRutas123');
  assert.equal(store.settings().shiftStart, '07:00');
  // Un archivo antiguo con las claves de otro: se ignoran, no pisan ni rellenan las tuyas.
  assert.deepEqual(store.applyConfig({ orsKey: 'ClaveDeOtroRepartidor1', tomtomKey: 'TomTomDeOtro12345' }), []);
  assert.equal(store.settings().orsKey, 'MiClaveDeRutas123');
  assert.equal(store.settings().tomtomKey, '');
  store.setSettings({ orsKey: 'eyJvcnMiOiJjbGF2ZSJ9abc' });
  // Archivo manipulado: nada raro entra en los ajustes
  const evil = store.applyConfig({ orsKey: '<script>alert(1)</script>', depot: { name: '<b>x</b>', lat: 'a', lon: 2 }, shiftStart: '99', nav: 'javascript:', service: 9999 });
  assert.deepEqual(evil, []);
  assert.equal(store.settings().orsKey, 'eyJvcnMiOiJjbGF2ZSJ9abc');
  assert.equal(store.settings().shiftStart, '07:00');
  assert.notEqual(store.settings().nav, 'javascript:');
  assert.ok(store.settings().service <= 180);
});
