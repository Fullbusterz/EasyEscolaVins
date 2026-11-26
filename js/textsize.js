// El tamaño de la letra de la app.
//
// En el iPhone, Safari no aplica a las webs el «Tamaño del texto» de Ajustes (Pantalla y brillo): una web con
// la letra en píxeles se ve igual de pequeña aunque el repartidor tenga la letra del móvil enorme porque no ve
// bien. iOS sí deja leerlo con la fuente del sistema «-apple-system-body» (17 px con el tamaño normal, hasta
// 53 px con los de accesibilidad), así que aquí se lee ese tamaño y se pone a toda la app: como todo el CSS
// va en rem, todo crece a la vez, como en una app de verdad.
//
// El repartidor no tiene que tocar nada en la app: vale lo que tenga puesto en el iPhone.
//
// Con la letra grande no caben tres columnas en un móvil: según cuántas letras caben a lo ancho se pone
// <html class="big"> o "huge", y el CSS pasa a poner las cosas una debajo de otra.

const BASE = 16; // tamaño normal en Android y en el ordenador
const MAX = 34; // por encima, en un móvil no cabe ni un botón por pantalla
// Con cuántos «rem» de ancho se pasa a letra grande y a letra muy grande (un iPhone de 390 pt con la letra
// normal tiene 23 rem; con letra grande del sistema, unos 17).
const BIG_BELOW = 21;
const HUGE_BELOW = 16;

let probe = null;
const iosDynamicType = () => {
  try { return CSS.supports('-webkit-touch-callout', 'none') && CSS.supports('font', '-apple-system-body'); } catch { return false; }
};

/** Tamaño del texto del sistema, en px (solo iPhone/iPad; en el resto, el normal). */
export function systemTextPx() {
  if (!iosDynamicType()) return BASE;
  if (!probe) {
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body;';
    probe.textContent = 'A';
    document.body.appendChild(probe);
  }
  const px = parseFloat(getComputedStyle(probe).fontSize);
  return Number.isFinite(px) && px >= 10 ? px : BASE;
}

/** Pone el tamaño de la letra (sistema × lo elegido en la app) y la clase de diseño. Devuelve los px. */
export function applyTextSize(scale = 1) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const px = Math.min(MAX, Math.round(systemTextPx() * s * 10) / 10);
  const root = document.documentElement;
  root.style.fontSize = `${px}px`;
  const rems = (window.innerWidth || 390) / px;
  root.classList.toggle('big', rems < BIG_BELOW && rems >= HUGE_BELOW);
  root.classList.toggle('huge', rems < HUGE_BELOW);
  return px;
}

/** Vuelve a mirarlo al volver a la app (se puede haber cambiado la letra en Ajustes del iPhone) y al girar. */
export function watchTextSize(getScale) {
  const again = () => applyTextSize(getScale());
  addEventListener('resize', again);
  addEventListener('orientationchange', again);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) again(); });
  return again();
}

/**
 * Las barras de abajo (pestañas y botones de la ruta) crecen con la letra: se miden y se pasan al CSS para
 * que el contenido y los avisos no queden tapados.
 */
export function watchBars() {
  const root = document.documentElement;
  const tabs = document.querySelector('.tabs');
  const bar = document.querySelector('#actionbar');
  const measure = () => {
    if (tabs) root.style.setProperty('--tabs-h', `${tabs.offsetHeight}px`);
    root.style.setProperty('--bar-h', bar && !bar.hidden ? `${bar.offsetHeight}px` : '0px');
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(measure);
    if (tabs) ro.observe(tabs);
    if (bar) ro.observe(bar);
  }
  measure();
  return measure;
}
