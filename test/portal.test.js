import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHorario, parsePortal, cleanOrderText, BRIDGE_URL, readPortalHash } from '../js/portal.js';

test('la ruta del #portal solo vale si trae el código que la web dio a la APK', () => {
  const n = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const json = '{"ruta":"escola-portal","paradas":[]}';
  const hash = `#portal=${encodeURIComponent(json)}`;
  assert.deepEqual(readPortalHash(`${hash}&n=${n}`, n), { text: json, verified: true });
  assert.equal(readPortalHash(hash, n).verified, false); // APK antigua o enlace: sin código
  assert.equal(readPortalHash(`${hash}&n=${n.replace('0f', 'aa')}`, n).verified, false); // otro código
  assert.equal(readPortalHash(`${hash}&n=${n}`, null).verified, false); // esta web nunca dio un código
  assert.equal(readPortalHash(`${hash}&n=`, '').verified, false);
  assert.equal(readPortalHash('#otra-cosa', n), null);
  assert.equal(readPortalHash('#portal=%E0%A4%A&n=' + n, n).verified, false); // mal codificada
});
import { HORARIOS } from './fixtures/horarios-portal.mjs';

const hm = (s) => { const [h, m = 0] = s.split(':').map(Number); return h * 60 + m; };
const W = (...pairs) => pairs.map(([a, b]) => [hm(a), hm(b)]);
const LUN = 1, MAR = 2, MIE = 3, JUE = 4, SAB = 6;

test('horarios sencillos del portal', () => {
  assert.deepEqual(parseHorario('DE 09:00 A 13:00 HS.', MAR).windows, W(['9', '13']));
  assert.deepEqual(parseHorario('9-11 hs.', MAR).windows, W(['9', '11']));
  assert.deepEqual(parseHorario('10 - 14 / 18 - 21 H', MAR).windows, W(['10', '14'], ['18', '21']));
  assert.deepEqual(parseHorario('DE 8 A 13,00 HORAS', MAR).windows, W(['8', '13']));
  assert.deepEqual(parseHorario('DE 12H A 13HS', MAR).windows, W(['12', '13']));
  assert.deepEqual(parseHorario('*** DE10:30 a 14:00 *** SOLO MAÑANAS', MAR).windows, W(['10:30', '14']));
  assert.deepEqual(parseHorario('ANTES DE LAS 8:30 H', MAR).windows, W(['6', '8:30']));
  assert.deepEqual(parseHorario('A PARTIR 11 HS.', MAR).windows, W(['11', '21']));
  assert.deepEqual(parseHorario('14:00 HS. EN ADELANTE', MAR).windows, W(['14', '21']));
  assert.deepEqual(parseHorario('MAÑANAS A PARTIR 11 HS.', MAR).windows, W(['11', '14']));
  assert.deepEqual(parseHorario('DE 17 A 24 HS.', MAR).windows, [[hm('17'), 23 * 60 + 59]]);
  assert.deepEqual(parseHorario('A CONVENIR', MAR).windows, []);
});

test('horario distinto según el día de la semana', () => {
  const h = 'LU: 9:30 -12 / RESTO : 9:30-12 y 17-19';
  assert.deepEqual(parseHorario(h, LUN).windows, W(['9:30', '12']));
  assert.deepEqual(parseHorario(h, MAR).windows, W(['9:30', '12'], ['17', '19']));
  const h2 = 'L-V DE 17 A 20 J-V-S DE 10 A 12 HS.';
  assert.deepEqual(parseHorario(h2, MAR).windows, W(['17', '20']));
  assert.deepEqual(parseHorario(h2, JUE).windows, W(['10', '12'], ['17', '20']));
  assert.deepEqual(parseHorario(h2, SAB).windows, W(['10', '12']));
  const h3 = 'LU-MI 10-13/16-17:30 JUE-SAB 10-13/16-19:30';
  assert.deepEqual(parseHorario(h3, MIE).windows, W(['10', '13'], ['16', '17:30']));
  assert.deepEqual(parseHorario(h3, SAB).windows, W(['10', '13'], ['16', '19:30']));
  // Los días detrás del horario.
  assert.equal(parseHorario('DE 8 A 12:30 DE LU A VI', MAR).otherDay, false);
  assert.equal(parseHorario('DE 8 A 12:30 DE LU A VI', SAB).otherDay, true);
  // Un horario solo de jueves en otro día: se usa igual, pero avisando.
  const j = parseHorario('JUEVES DE 12:00 -14:00', MAR);
  assert.deepEqual(j.windows, W(['12', '14']));
  assert.equal(j.otherDay, true);
  assert.equal(parseHorario('MAÑANAS(PREFERENTE MIERCOLES)', MAR).otherDay, false);
});

test('días de cierre', () => {
  assert.equal(parseHorario('08:00 a 12:00 y 18:00 a 20:00 LU-MA CERRADO', MAR).closed, true);
  assert.equal(parseHorario('08:00 a 12:00 y 18:00 a 20:00 LU-MA CERRADO', MIE).closed, false);
  assert.equal(parseHorario('10-12 y a partir 17.30h cierra lun y mar', LUN).closed, true);
  assert.equal(parseHorario('10:30-12:00, FESTIVOS LUNES Y MARTES', MAR).closed, true);
  assert.equal(parseHorario('11:30 a 13:30 hs.(MAR. Y MIE. CERRADO)', MIE).closed, true);
  assert.equal(parseHorario('10 - 14 / 18 - 21 H (lunes cerrado)', LUN).closed, true);
  assert.deepEqual(parseHorario('10 - 14 / 18 - 21 H (lunes cerrado)', LUN).windows, W(['10', '14'], ['18', '21']));
});

test('casi todos los horarios reales del portal dan franja', () => {
  const empty = HORARIOS.filter((h) => !parseHorario(h, MAR).windows.length);
  assert.ok(empty.length <= 3, `sin franja: ${empty.join(' | ')}`);
  for (const h of HORARIOS) for (const [a, b] of parseHorario(h, MAR).windows) assert.ok(a >= 0 && b > a && b < 24 * 60, h);
});

test('texto libre del pedido sin fechas', () => {
  assert.equal(cleanOrderText('00:00 2 DE NOVIEMBRE'), '');
  assert.equal(cleanOrderText('01/09/2026    10:00 a 12:30'), '10:00 a 12:30');
  assert.equal(cleanOrderText('JUEVES 10/09'), 'JUEVES');
  assert.deepEqual(parseHorario(cleanOrderText('08:00 - 15 DE OCTUBRE'), MAR).windows, []);
});

const ruta = (paradas, fecha = '04/11/2026') => `Ruta Escolà\n${JSON.stringify({ ruta: 'escola-portal', v: 1, fecha, id: 999, paradas })}`;

test('ruta del portal: agrupa albaranes y usa el horario del día', () => {
  const r = parsePortal(ruta([
    [10, 'BAR UNO', 'CARRER MAJOR, 1', 'BARCELONA', '93-000-00-01', 'DE 9 A 13 HS.', '', 'Obs. pedido: MIERCOLES MAÑANA\rObs. factura: PEDIDO 123', 2],
    [10, 'BAR UNO', 'CARRER MAJOR, 1', 'BARCELONA', '93-000-00-01', 'DE 9 A 13 HS.', '', '', 3],
    [20, 'HOTEL DOS', 'GRAN VIA, 2', "L'HOSPITALET DE LLOBREGAT", '', 'LU: 9:30 -12 / RESTO : 9:30-12 y 17-19', '00:00 MIERCOLES TARDE', '', 1],
    [30, 'RESTAURANT TRES', 'AV. DIAGONAL, 3 (ENTRADA POR PARKING)', 'BARCELONA', null, 'LU-MA CERRADO 10-12', '', 'Obs. pedido: LLAMAR AL LLEGAR', 4],
  ]));
  assert.equal(r.date, '2026-11-04'); // miércoles
  assert.equal(r.stops.length, 3);
  const [hotel, bar, rest] = r.stops; // en el orden del portal
  assert.equal(hotel.name, 'HOTEL DOS');
  assert.equal(hotel.address, "GRAN VIA, 2, L'HOSPITALET DE LLOBREGAT");
  // "MIERCOLES TARDE" del pedido se cruza con el horario del cliente: solo la tarde.
  assert.deepEqual(hotel.windows, W(['17', '19']));
  assert.deepEqual(hotel.clientWindows, []); // depende del día
  assert.equal(bar.phone, '93-000-00-01');
  assert.deepEqual(bar.windows, W(['9', '13']));
  assert.match(bar.notes, /2 albaranes/);
  assert.doesNotMatch(bar.notes, /MIERCOLES/); // la ruta ya es del miércoles y la mañana va a la franja
  assert.doesNotMatch(bar.notes, /factura|PEDIDO 123/);
  assert.deepEqual(bar.clientWindows, W(['9', '13']));
  assert.equal(rest.closed, false);
  assert.match(rest.address, /^AV\. DIAGONAL, 3, BARCELONA$/);
  assert.deepEqual(rest.windows, W(['10', '12']));
  assert.match(rest.notes, /Acceso: ENTRADA POR PARKING/);
  assert.match(rest.notes, /Obs\.: LLAMAR AL LLEGAR/);
});

test('ruta del portal: avisa si ese día cierra y descarta lo que no es una ruta', () => {
  const r = parsePortal(ruta([[1, 'BAR', 'C/ X, 1', 'GAVA', '', 'LU-MA CERRADO 10-12', '', '', 1]], '03/11/2026'));
  assert.equal(r.stops[0].closed, true);
  assert.match(r.stops[0].notes, /cierra/);
  assert.equal(parsePortal('Bar Paco - C/ Major 1 - 9-11'), null);
  assert.equal(parsePortal('{"ruta":"escola-portal","fecha":"ayer","paradas":[]}'), null);
  assert.equal(parsePortal('{"ruta":"escola-portal","fecha":"04/11/2026","paradas":[["x"]'), null);
});

test('el marcador es un enlace javascript: que solo lee del portal', () => {
  assert.ok(BRIDGE_URL.startsWith('javascript:'));
  const code = decodeURIComponent(BRIDGE_URL.slice('javascript:'.length));
  assert.match(code, /^\(function bridge\(\)/);
  assert.doesNotThrow(() => new Function(code));
  const urls = [...code.matchAll(/'(\/[A-Za-z]+\/[A-Za-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(urls)].sort(), ['/Repartos/PuntosEntregaDatos', '/Repartos/RepartosDatos']);
  // Edge para Android corta la dirección de un favorito hacia los 5.000 caracteres (y los espacios
  // pueden acabar como %20): hay que dejar margen.
  assert.ok(BRIDGE_URL.length + (BRIDGE_URL.match(/ /g) || []).length * 2 < 4200, `marcador de ${BRIDGE_URL.length} caracteres`);
  assert.doesNotMatch(BRIDGE_URL, /[\n#]/);
});

test('el horario del pedido no se ensancha con un «MAÑANA» de las observaciones', () => {
  const r = parsePortal(ruta([
    [1, 'BAR', 'C/ ARAGO, 1', 'BARCELONA', '', 'DE 10:00 A 12:00 HS.', '07:00H A 11:30H', 'Obs. pedido: MARTES-MAÑANA', 1],
    [2, 'HOTEL', 'C/ ARAGO, 2', 'BARCELONA', '', 'DE 9 A 19 HS.', '', 'Obs. pedido: MARTES - MAÑANA', 2],
    [3, 'CAFE', 'C/ ARAGO, 3', 'BARCELONA', '', '16-20', '', 'Obs. pedido: MAÑANA', 3],
  ], '03/11/2026'));
  assert.deepEqual(r.stops[0].windows, W(['10', '11:30']));
  assert.deepEqual(r.stops[1].windows, W(['9', '14'])); // la mañana afina el horario del cliente
  assert.deepEqual(r.stops[2].windows, W(['16', '20'])); // si choca, manda el horario del cliente
});

test('«EN ADELANTE» en el pedido manda si la ficha del cliente abre más tarde', () => {
  const r = parsePortal(ruta([
    [1, 'BAR', 'C/ ARAGO, 1', 'BARCELONA', '', 'A PARTIR 18:00 HS', '09:30 EN ADELANTE', 'Obs. pedido: MIERCOLES', 1],
    [2, 'CAFE', 'C/ ARAGO, 2', 'BARCELONA', '', '10 - 14 / 18 - 21 H', 'A PARTIR 11 HS', '', 2],
  ]));
  assert.deepEqual(r.stops[0].windows, W(['9:30', '21'])); // no «18-21»: el pedido es lo último que se ha dicho
  assert.deepEqual(r.stops[1].windows, W(['11', '14'], ['18', '21'])); // si cabe en la ficha, solo afina
});

test('carga del pedido: cajas exactas, botellas estimadas por tamaño de caja, y pedido grande', async () => {
  const { bigOrder } = await import('../js/portal.js');
  // [.., orden, botellas sueltas, cajas de 2, de 3 a 5, de 6 a 11, de 12 o más]
  const r = parsePortal(ruta([
    [1, 'BAR', 'C/ X, 1', 'BARCELONA', '', '', '', '', 1, 38, 0, 0, 11, 0],
    [1, 'BAR', 'C/ X, 1', 'BARCELONA', '', '', '', '', 2, 11, 0, 2, 5, 0],
    [2, 'CAFE', 'C/ X, 2', 'BARCELONA', '', '', '', '', 3, 6, 0, 0, 1, 0],
    [3, 'HOTEL', 'C/ X, 3', 'BARCELONA', '', '', '', '', 4, 0, 0, 0, 31, 0],
    [4, 'VIEJA', 'C/ X, 4', 'BARCELONA', '', '', '', '', 5], // APK anterior a la 1.4.0: sin carga
  ]));
  const [bar, cafe, hotel, vieja] = r.stops;
  assert.deepEqual(bar.load, { boxes: 18, loose: 49, bottles: 49 + 6 * 16 + 4 * 2 });
  assert.equal(bigOrder(bar.load), true); // 153 botellas
  assert.deepEqual(cafe.load, { boxes: 1, loose: 6, bottles: 12 });
  assert.equal(bigOrder(cafe.load), false);
  assert.equal(bigOrder(hotel.load), true); // 31 cajas
  assert.equal(vieja.load, null);
  assert.equal(bigOrder(null), false);
});

test('ruta del portal: de las observaciones de la factura se queda solo lo que es para el conductor', () => {
  const r = parsePortal(ruta([
    [40, 'TIENDA CUATRO', 'CARRER NOU, 4', 'BARCELONA', '', '11-13', '',
      'Obs. pedido: MIERCOLES\rObs. factura: DE 11 A 13HS - Siempre llamar al: 600 000 000 Ana - ENTREGAR EN CARRER VELL 6', 1],
    [50, 'BAR CINCO', 'CARRER NOU, 5', 'BARCELONA', '', '9-13', '',
      'Obs. pedido: \r\n\rObs. factura: REF.: 2311022 - PAGO POR TRANSFERENCIA - 11:00 A 13:00', 2],
    [60, 'BAR SEIS', 'CARRER NOU, 6', 'BARCELONA', '', '9-13', '', 'Obs. factura: COBRAR AL CONTADO. TIMBRE DE LA IZQUIERDA', 3],
  ]));
  const [tienda, bar, seis] = r.stops;
  assert.match(tienda.notes, /Factura: Siempre llamar al: 600 000 000 Ana · ENTREGAR EN CARRER VELL 6/);
  assert.doesNotMatch(tienda.notes, /13HS/); // el horario ya va en la franja
  assert.doesNotMatch(bar.notes, /Factura|REF|TRANSFERENCIA/); // cosas de la oficina
  assert.match(seis.notes, /Factura: COBRAR AL CONTADO. TIMBRE DE LA IZQUIERDA/);
});

test('factura: devoluciones, contactos con teléfono y dónde entregar se quedan; referencias y quién pidió, no', () => {
  const r = parsePortal(ruta([
    [1, 'A', 'C/ A, 1', 'BARCELONA', '', '', '', 'Obs. factura: DE 11:30 A 15:00 RECOGER Y ABONAR 1 BOT TRIPLE SEC', 1],
    [2, 'B', 'C/ B, 1', 'BARCELONA', '', '', '', 'Obs. factura: CONTACTO PERE - TE 600 11 22 33 - PEDIDO CLIENTE 12345678 - ALMACEN GENERAL', 2],
    [3, 'C', 'C/ C, 1', 'BARCELONA', '', '', '', 'Obs. factura: DE 13 A 15HS - PEDIDO CLIENTE O2611ABC Joan (+34600112233)', 3],
    [4, 'D', 'C/ D, 1', 'BARCELONA', '', '', '', 'Obs. factura: Pedido por Pere Pi ( Marca X )', 4],
    [5, 'E', 'C/ E, 1', 'BARCELONA', '', '', '', 'Obs. factura: PED CTE: PC2600001', 5],
    [6, 'F', 'C/ F, 1', 'BARCELONA', '', '', '', 'Obs. factura: 11:00 A 13:00H PEDIDO CLIENTE: CDP00001 RECIBE MARTA', 6],
    [7, 'G', 'C/ G, 1', 'BARCELONA', '', '', '', 'Obs. factura: TEL. 93 000 00 00', 7],
    [8, 'H', 'C/ H, 1', 'BARCELONA', '', '', '', 'Obs. factura: PEDIDO CLIENTE O26ABC\r\nHotel Uno - Pau Director\r\n(+34600112233)', 8],
  ]));
  const f = (s) => (s.notes.match(/Factura: (.*)/) || [])[1];
  const [a, b, c, d, e, g, h, i] = r.stops;
  assert.match(f(a), /RECOGER Y ABONAR 1 BOT TRIPLE SEC/);
  assert.equal(f(b), 'CONTACTO PERE · TE 600 11 22 33 · ALMACEN GENERAL');
  assert.equal(f(c), 'Joan (+34600112233)');
  assert.equal(f(d), undefined);
  assert.equal(f(e), undefined);
  assert.equal(f(g), 'RECIBE MARTA');
  assert.equal(f(h), 'TEL. 93 000 00 00');
  assert.equal(f(i), 'Pau Director (+34600112233)'); // el teléfono va en la línea de debajo del nombre
});
