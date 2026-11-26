# La app de iPhone

Es la misma Ruta de siempre, pero instalada como una app de verdad (desde TestFlight o la App Store), no como una web añadida a la pantalla de inicio. Para el repartidor cambia esto:

- **Traer la ruta del portal es un botón.** El portal se abre dentro de la app y abajo hay un botón grande **«Traer mi ruta»**. El usuario y la contraseña del portal se ponen una vez y la app los recuerda, como Safari. Ya no hay marcador, ni «Pegar la ruta», ni que elegir entre Safari y el icono.
- **No se borra nada.** Safari puede borrar los datos de una web que no se abre en unos días. Los de una app no.
- **Letra grande.** Igual que la web: sigue el «Tamaño del texto» del iPhone (Ajustes → Pantalla y brillo) y tiene su propio tamaño en Ajustes de la app. La pantalla del portal también sigue el tamaño del iPhone.
- **Como una app:** se instala desde TestFlight con dos toques, abre sin barra de Safari, vibra al pulsar «Siguiente», el GPS pide permiso una vez y las copias se guardan con la hoja de compartir del iPhone (Archivos, Drive, WhatsApp…).
- **Waze y Google Maps** se abren en su app, como ahora.

La web sigue funcionando igual para quien no instale la app (Android, ordenador, o iPhone sin la app).

## Lo que hay que hacer una vez (el encargado)

Hace falta una cuenta de **Apple Developer** (99 € al año). No hace falta Mac: la app la compila un Mac de GitHub.

1. **Cuenta de Apple Developer.** Date de alta en <https://developer.apple.com/programs/>. Mejor como empresa (pide el número D-U-N-S, que es gratis pero tarda unos días). Como particular es inmediato.
2. **El identificador de la app.** En <https://developer.apple.com/account/resources/identifiers/list>, pulsa **+** → *App IDs* → *App*. Descripción «Ruta Escolà», *Bundle ID* explícito **`com.flixescola.ruta`**. Continuar y Registrar.
3. **La app en App Store Connect.** En <https://appstoreconnect.apple.com/apps>, pulsa **+** → *Nueva app*. Plataforma iOS, nombre «Ruta Escolà», idioma Español, el *Bundle ID* del paso 2 y SKU `ruta-escola`.
4. **Una clave para que GitHub suba la app.** En App Store Connect → *Usuarios y acceso* → *Integraciones* → *App Store Connect API* → **+**. Nombre «GitHub», acceso **Administrador**, porque hace falta para firmar la app desde GitHub. Descarga el archivo `.p8`, que solo se puede descargar una vez, y apunta el **ID de la clave** y el **ID del emisor** (*Issuer ID*), que sale arriba.
5. **El Team ID.** En <https://developer.apple.com/account> → *Membership details* → *Team ID* (10 letras y números).
6. **Los cuatro secretos en GitHub.** En el repositorio → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:

   | Nombre | Qué va |
   |---|---|
   | `ASC_KEY_ID` | El ID de la clave (paso 4) |
   | `ASC_ISSUER_ID` | El ID del emisor (paso 4) |
   | `ASC_KEY_P8` | Todo el contenido del archivo `.p8`, de `-----BEGIN PRIVATE KEY-----` a `-----END PRIVATE KEY-----` |
   | `APPLE_TEAM_ID` | El Team ID (paso 5) |

7. **La clave de Google para la app.** Es una clave restringida a *Apps de iOS* con el identificador `com.flixescola.ruta`. Va como quinto secreto, `GOOGLE_MAPS_KEY_IOS`, no en el código. Ver «Google Maps» en el [LEEME principal](../LEEME.md).
8. **Compilar.** En GitHub → *Actions* → **App de iPhone (TestFlight)** → *Run workflow*. Tarda unos 15-20 minutos. Al acabar, la compilación aparece en App Store Connect → *TestFlight* (Apple la procesa unos minutos más).

## Dar la app a los repartidores (TestFlight)

1. En App Store Connect → la app → *TestFlight* → *Pruebas externas* → **+** → grupo «Repartidores». Añade la compilación. La primera vez Apple la revisa, normalmente en menos de un día.
2. Activa el **enlace público** del grupo y mándaselo a los repartidores por WhatsApp.
3. Cada repartidor: instala **TestFlight** desde la App Store, abre el enlace, pulsa **Aceptar** y luego **Instalar**. Desde entonces se actualiza sola.

**Cada compilación de TestFlight dura 90 días.** Antes de que caduque hay que volver a pulsar *Run workflow*. TestFlight avisa unos días antes. Más adelante se puede publicar en la App Store como app «no listada» (solo la encuentra quien tiene el enlace) y entonces no caduca.

## Pasar los datos de la web a la app

Los clientes y las rutas de la web no pasan solos a la app (son sitios distintos del móvil):

1. En la web (Safari o el icono): **Ajustes → Hacer copia de seguridad** → *Guardar en Archivos*.
2. En la app: **Ajustes → Importar** → elegir ese archivo.

## Actualizar la app

Cuando cambie la web, para que la app lleve lo nuevo hay que volver a compilar: *Actions* → *App de iPhone* → *Run workflow*, o subir una etiqueta `ios-v1.20.0`. La versión que ve el repartidor es la de `sw.js` (`VERSION`), y el número de compilación lo pone GitHub.

## Para desarrollo

- `native/` es un proyecto de [Capacitor](https://capacitorjs.com) 8 con Swift Package Manager (sin CocoaPods).
- `npm run sync` (dentro de `native/`) copia la web a `native/www` y la mete en el proyecto de Xcode (`ios/App`). Con un Mac: `npm run open` abre Xcode para probar en el simulador o en un iPhone con cable.
- `portal-plugin/` es el plugin propio que abre el portal dentro de la app (Swift, `ios/Sources/PortalPlugin`). Lo que lee del portal lo manda la web: `readPortal` en `js/portal.js`, probado en `test/portal-native.test.js`.
- `js/native.js` es lo que cambia en la web cuando corre dentro de la app (vibrar, compartir archivos, GPS, abrir Waze fuera de la app). En el navegador no hace nada.
- **Esto no se ha podido compilar aquí** (hace falta macOS). La primera compilación de GitHub es la prueba de verdad. Si falla, el registro de *Actions* dice dónde.
