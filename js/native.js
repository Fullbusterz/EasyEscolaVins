// Lo que cambia dentro de la app de iPhone (la de verdad, hecha con Capacitor: ver native/ y el LEEME).
// La web es la misma; aquí solo se cambia lo que en una app se hace de otra manera. En el navegador nada de
// esto hace nada y todo sigue como siempre.

const cap = () => { try { return globalThis.Capacitor || null; } catch { return null; } };

export const isNative = (() => { try { return !!cap()?.isNativePlatform?.(); } catch { return false; } })();

// Identificador de la app de iPhone, igual que en native/capacitor.config.json.
export const IOS_BUNDLE_ID = 'com.flixescola.ruta';

/** Un plugin nativo por su nombre (Portal, Haptics, Share…), o null si no está (en la web, siempre). */
export function plugin(name) {
  if (!isNative) return null;
  try { return cap()?.Plugins?.[name] || null; } catch { return null; }
}

/** Un toque en la mano al pulsar los botones importantes (Siguiente, He aparcado). */
export function tap() {
  const h = plugin('Haptics');
  if (h) { h.impact({ style: 'MEDIUM' }).catch(() => {}); return; }
  try { navigator.vibrate?.(15); } catch { /* sin vibración */ }
}

/**
 * Compartir un archivo (copias de seguridad, configuración) con la hoja de compartir del iPhone.
 * Devuelve true si se ha compartido, false si se ha cancelado y null si no se puede así (en la web).
 */
export async function shareFileNative(text, name, title) {
  const fs = plugin('Filesystem'), share = plugin('Share');
  if (!fs || !share) return null;
  const { uri } = await fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
  try {
    await share.share({ title, files: [uri] });
    return true;
  } catch {
    return false; // cancelado
  }
}

/** Dónde estás, con el GPS del iPhone (pide permiso a la app una vez, no a la web cada vez). */
export async function nativePosition(timeout = 8000) {
  const geo = plugin('Geolocation');
  if (!geo) return undefined; // no hay plugin: que lo haga el navegador
  try {
    const p = await geo.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: 60000 });
    return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
  } catch {
    return null;
  }
}

/** Arreglos de la app al arrancar: barra de estado clara sobre fondo oscuro, sin pantalla de carga. */
export function setupNativeShell() {
  if (!isNative) return;
  document.documentElement.classList.add('native');
  plugin('StatusBar')?.setStyle?.({ style: 'DARK' }).catch(() => {});
  plugin('SplashScreen')?.hide?.().catch(() => {});
  // Waze, Google Maps, SPRO, el teléfono: en la app se abren fuera de ella, en su propia app. Se navega a
  // ellos desde la página principal, que es lo que la app manda fuera (al abrir una pestaña nueva no siempre).
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (a.target === '_blank' && /^https?:/i.test(href)) {
      e.preventDefault();
      location.assign(href);
    }
  }, true);
}
