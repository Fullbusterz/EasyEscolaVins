// Comprueba que las claves de empresa (secretos TOMTOM_KEY y ORS_KEY) funcionan, con una consulta a cada
// servicio. Solo dice «bien» o el motivo del fallo: nunca escribe la clave.
// Uso: ORS_KEY=… TOMTOM_KEY=… node tools/probar-claves.mjs
import { orsMatrix, trafficLegs, netWarning } from '../js/geo.js';

const almacen = { lat: 41.372083, lon: 2.077356 };
const sants = { lat: 41.3755, lon: 2.1366 };
const ors = process.env.ORS_KEY || '';
const tomtom = process.env.TOMTOM_KEY || '';

const probar = async (nombre, clave, consulta) => {
  if (!clave) return console.log(`${nombre}: falta el secreto`), false;
  try {
    const r = await consulta(clave);
    console.log(`${nombre}: ${r ? `bien (${r})` : 'no responde'}`);
    return Boolean(r);
  } catch (e) {
    console.log(`${nombre}: ${netWarning(e)}`);
    return false;
  }
};

const okOrs = await probar('openrouteservice', ors, async (key) => {
  const [c] = await orsMatrix([almacen], [sants], { key });
  return c && `${c.min.toFixed(1)} min, ${c.km.toFixed(1)} km sin tráfico`;
});
const okTomtom = await probar('TomTom', tomtom, async (key) => {
  const legs = await trafficLegs([almacen, sants], { key, live: true });
  return legs && `${legs[0].toFixed(1)} min con el tráfico de ahora`;
});
process.exitCode = okOrs && okTomtom ? 0 : 1;
