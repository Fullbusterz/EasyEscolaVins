// Margen sobre el horario de entrega de los clientes.
// Los horarios del portal no son exactos: a un local que «acepta hasta las 12» no le pasa nada si llegas a la 13.
// De tarde (franjas que cierran a mediodía o más tarde) se da 1 hora; de mañana, media hora.
// Llegar antes de que abra no tiene margen: se espera a la hora de apertura.

export const MIDDAY = 12 * 60;
export const LATE_OK_MORNING = 30;
export const LATE_OK_AFTERNOON = 60;
export const STRICT_MARGIN = 10; // estricto: llegar al menos 10 min antes de que cierre, sin margen
export const FLEX_EXTRA = 30; // flexible: media hora más sobre el margen normal
const LAST = 23 * 60 + 59;

export const lateOk = (close) => (close < MIDDAY ? LATE_OK_MORNING : LATE_OK_AFTERNOON);

/** Franjas con las que se planifica, según cómo es el cliente con el horario ('strict', '' o 'flex'). */
export function planWindows(windows, timing = '') {
  const ws = windows || [];
  if (timing === 'strict') return ws.map(([a, b]) => [a, Math.max(a + 10, b - STRICT_MARGIN)]);
  const extra = timing === 'flex' ? FLEX_EXTRA : 0;
  return ws.map(([a, b]) => [a, Math.min(b + lateOk(b) + extra, LAST)]);
}

// Horario «de tarde» del portal (todas las franjas empiezan después de las 13:00, p. ej. «16h a 18h»): casi siempre
// es un error de la ficha. Se avisa y se planifica como si aceptara desde las 10:00, hasta que el conductor llame al
// cliente y apunte su horario confirmado.
export const ODD_AFTER = 13 * 60;
export const ODD_FROM = 10 * 60;
export const oddHours = (windows) => !!windows?.length && windows.every(([a]) => a > ODD_AFTER);
export const ODD_WINDOWS = [[ODD_FROM, LAST]];
