import test from 'node:test';
import assert from 'node:assert/strict';
import { portalReaderBody, parsePortal } from '../js/portal.js';

// El lector de la app de iPhone corre dentro del portal. Aquí se ejecuta con un portal simulado.
const run = async ({ host = 'portal.escoladist.com', routes, points, loginFails = false }) => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push([url, opts.body]);
    if (loginFails) return { ok: false, status: 302, json: async () => { throw new Error('html'); } };
    if (url === '/Repartos/RepartosDatos') return { ok: true, json: async () => ({ data: routes }) };
    const id = /id_entrega=(\w+)/.exec(opts.body)[1];
    return { ok: true, json: async () => ({ data: points[id] || [] }) };
  };
  // Como callAsyncJavaScript de iOS: el texto es el cuerpo de una función asíncrona.
  const AsyncFunction = (async () => {}).constructor;
  const fn = new AsyncFunction('location', 'fetch', portalReaderBody());
  return { out: JSON.parse(await fn({ hostname: host }, fakeFetch)), calls };
};

const point = (id, name) => ({ id_cliente: id, razon_social: name, direccion: 'C/ Major 1', poblacion: 'Sant Feliu de Llobregat', telefono: '600000000', horario: 'DE 9 A 13', texto_libre_pedido: '', observaciones: '', orden: 1, botellas: 0, cajas_2: 0, cajas_3a5: 2, cajas_6a11: 0, cajas_12mas: 0 });

test('trae las rutas pendientes, la más nueva primero, y el texto es una ruta del portal', async () => {
  const { out } = await run({
    routes: [{ id_entrega: 'A1', fecha: '25/11/2026', status: 'R' }, { id_entrega: 'B2', fecha: '26/11/2026', status: 'P' }, { id_entrega: 'C3', fecha: '27/11/2026', status: 'F' }],
    points: { A1: [point(1, 'Bar Uno')], B2: [point(1, 'Bar Uno'), point(2, 'Celler Dos'), point(2, 'Celler Dos')] },
  });
  assert.equal(out.routes.length, 2);
  assert.equal(out.routes[0].fecha, '26/11/2026');
  assert.equal(out.routes[0].paradas, 2);
  const parsed = parsePortal(out.routes[0].text);
  assert.equal(parsed.date, '2026-11-26');
  assert.deepEqual(parsed.stops.map((x) => x.name), ['Bar Uno', 'Celler Dos']);
  assert.equal(parsed.stops[0].load.boxes, 2);
});

test('sin sesión en el portal dice que hay que entrar con el usuario', async () => {
  const { out } = await run({ loginFails: true });
  assert.match(out.error, /entra con tu usuario/);
});

test('fuera del portal no hace ninguna consulta', async () => {
  const { out, calls } = await run({ host: 'evil.example.com' });
  assert.match(out.error, /portal de Escolà/);
  assert.equal(calls.length, 0);
});
