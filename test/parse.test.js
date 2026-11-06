import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWindows, parseList, clientKey, fmt } from '../js/parse.js';

test('horarios en formatos habituales', () => {
  assert.deepEqual(parseWindows('9-11:30'), [[540, 690]]);
  assert.deepEqual(parseWindows('de 9 a 11.30h'), [[540, 690]]);
  assert.deepEqual(parseWindows('09:00 - 13:00 / 16:00 - 19:30'), [[540, 780], [960, 1170]]);
  assert.deepEqual(parseWindows('de les 10 a les 13h'), [[600, 780]]);
  assert.deepEqual(parseWindows('Horario: 10-12'), [[600, 720]]);
  assert.deepEqual(parseWindows('Carrer Major 9-11, Cornellà'), []);
});

test('lista de una línea por parada', () => {
  const list = parseList(`1. Vinos Paco - C/ Major 12, Sant Feliu de Llobregat - 9:00-11:30
Bar La Plaça | Plaça de la Vila 3, Cornellà
Carrer de Sants 100, Barcelona`);
  assert.equal(list.length, 3);
  assert.deepEqual(list[0], { name: 'Vinos Paco', address: 'C/ Major 12, Sant Feliu de Llobregat', windows: [[540, 690]], phone: '' });
  assert.equal(list[1].name, 'Bar La Plaça');
  assert.equal(list[1].address, 'Plaça de la Vila 3, Cornellà');
  assert.equal(list[2].address, 'Carrer de Sants 100, Barcelona');
});

test('bloques separados por línea en blanco', () => {
  const list = parseList(`Restaurant Can Pep
Av. de Barcelona 45, Sant Joan Despí
Horario 10:00-13:00

Vinoteca Montse
Rambla Just Oliveras 20, L'Hospitalet`);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { name: 'Restaurant Can Pep', address: 'Av. de Barcelona 45, Sant Joan Despí', windows: [[600, 780]], phone: '' });
  assert.equal(list[1].address, "Rambla Just Oliveras 20, L'Hospitalet");
});

test('memoria por nombre tolera mayúsculas, acentos y S.L.', () => {
  assert.equal(clientKey('Vinos Paco S.L.'), clientKey('vinos  PACO'));
  assert.equal(clientKey('Bodega Lluís'), 'bodega lluis');
  assert.equal(fmt(690), '11:30');
});

// ---- Casos de la auditoría (2026-11-02) y listas reales desordenadas ----

test('número de portal seguido de " - " y horario: no se mezclan', () => {
  assert.deepEqual(parseList('Bar Sol - Rambla Marina 300 - 9:00-11:00')[0], { name: 'Bar Sol', address: 'Rambla Marina 300', windows: [[540, 660]], phone: '' });
  assert.deepEqual(parseList('Vinos Paco - Carrer Major 12 - 9:00-11:30')[0], { name: 'Vinos Paco', address: 'Carrer Major 12', windows: [[540, 690]], phone: '' });
  assert.deepEqual(parseList('Bar Sol - C/ Major 12 - 09:00 - 13:00')[0].windows, [[540, 780]]);
});

test('columnas separadas por tabulador (copiado de una tabla o del portal)', () => {
  const [s] = parseList('Bar Sol\tCarrer Major 7, Cornellà\t10:00-13:00');
  assert.equal(s.name, 'Bar Sol');
  assert.equal(s.address, 'Carrer Major 7, Cornellà');
  assert.deepEqual(s.windows, [[600, 780]]);
});

test('abreviaturas de calle y nombres de negocio que empiezan como una calle', () => {
  assert.equal(parseList('C/ Major 12 - Vinos Paco')[0].address, 'C/ Major 12');
  assert.equal(parseList('C/ Major 12 - Vinos Paco')[0].name, 'Vinos Paco');
  assert.equal(parseList('Bodega Ramos - C. Major 3, Esplugues')[0].address, 'C. Major 3, Esplugues');
  assert.equal(parseList('Distribuciones Pep - Pol. Ind. Famades, C/ Energia 20')[0].address, 'Pol. Ind. Famades, C/ Energia 20');
  const v = parseList('Via Veneto - C/ Ganduxer 10, Barcelona')[0];
  assert.equal(v.name, 'Via Veneto');
  assert.equal(v.address, 'C/ Ganduxer 10, Barcelona');
});

test('más formatos de horario', () => {
  assert.deepEqual(parseWindows('de 4 a 7'), [[960, 1140]]);
  assert.deepEqual(parseWindows('09:00/13:00'), [[540, 780]]);
  assert.deepEqual(parseWindows('desde las 9:00 hasta las 11:00'), [[540, 660]]);
  assert.deepEqual(parseWindows('a partir de las 10'), [[600, 1260]]);
  assert.deepEqual(parseWindows('antes de las 11'), [[360, 660]]);
  assert.deepEqual(parseWindows('9h-13h y 17h-20h'), [[540, 780], [1020, 1200]]);
  assert.deepEqual(parseWindows('de 9 a 13 i de 17 a 20'), [[540, 780], [1020, 1200]]);
  assert.deepEqual(parseWindows('09:00-10:00 y 09:30-10:30'), [[540, 630]]);
  assert.deepEqual(parseWindows('Local 2-4'), []);
  assert.deepEqual(parseWindows('Tel. 933 77 12 34'), []);
  assert.deepEqual(parseWindows('08940 Cornellà de Llobregat'), []);
});

test('teléfono, código postal, viñetas y nombres con cifras', () => {
  const [a] = parseList('• Bar 7 Portes - Passeig d\'Isabel II 14, 08003 Barcelona - Tel. 933 19 30 33 - 12:00-14:00');
  assert.equal(a.name, 'Bar 7 Portes');
  assert.equal(a.address, "Passeig d'Isabel II 14, 08003 Barcelona");
  assert.equal(a.phone, '933 19 30 33');
  assert.deepEqual(a.windows, [[720, 840]]);
  const [b] = parseList('1.- Celler 1898 | Carrer de Sants 200, Barcelona');
  assert.equal(b.name, 'Celler 1898');
  assert.equal(b.address, 'Carrer de Sants 200, Barcelona');
  const [c] = parseList("3) Vinoteca L'Hospitalet ; Rambla de Just Oliveras 30 ; 08901 L'Hospitalet de Llobregat");
  assert.equal(c.name, "Vinoteca L'Hospitalet");
  assert.equal(c.address, "Rambla de Just Oliveras 30, 08901 L'Hospitalet de Llobregat");
  assert.equal(parseList('Bar Centre - Carrer Nou s/n, Cornellà')[0].address, 'Carrer Nou s/n, Cornellà');
});

test('bloque con teléfono y horario en líneas sueltas', () => {
  const [s] = parseList(`Restaurant Can Pep
Av. de Barcelona 45, Sant Joan Despí
Tel 600 11 22 33
Horario: de 10 a 13h

Bar Sol
Rambla Marina 300, L'Hospitalet`);
  assert.deepEqual(s, { name: 'Restaurant Can Pep', address: 'Av. de Barcelona 45, Sant Joan Despí', windows: [[600, 780]], phone: '600 11 22 33' });
});
