# Ruta Escolà

App para el móvil que ordena la ruta de reparto con el tráfico de Google Maps y los horarios de entrega de cada cliente. En iPhone es una app de verdad (TestFlight, ver [native/LEEME.md](native/LEEME.md)); en Android y en el ordenador, una web que se instala como una app.

## Cómo se usa

1. **El día antes** (la ruta sale en el portal sobre las 17:30): **Traer la ruta del portal** la trae con direcciones, teléfonos y horarios. En la app de iPhone abre el portal dentro y basta con pulsar «Traer mi ruta». En Android lo hace la APK 1.3.0 (y puede avisarte cuando salga). En Safari y en el ordenador, el marcador, que se guarda una vez igual que se instala la APK. Si no, pega la lista o añade las paradas a mano. Luego, **Optimizar ruta**.
   Al traerla, la app te pregunta **cuánto crees que tardarás** en cada parada nueva.
2. **Recalcular**, cuando quieras (antes de salir o en plena ruta): vuelve a calcular el orden con el tráfico de ese momento.
3. **Empezar ruta** el día del reparto y **Waze** te lleva a la primera parada. Al terminar cada parada pulsa **Siguiente** (la entrega se registra en la tablet; si te equivocas, **Deshacer**): recalcula desde donde estás y te da la siguiente.

Cada cliente queda guardado con su dirección, su horario de entrega, sus notas y su teléfono. La próxima vez basta con escribir su nombre.
**Horarios de los clientes, con margen:** la ruta se ordena para llegar dentro del horario de cada cliente, pero con margen, porque los horarios del portal no son exactos: media hora si el local cierra por la mañana y una hora si cierra a mediodía o más tarde (un «hasta las 12» admite llegar a la 13). Antes de la hora de apertura no hay margen. Cuando la ruta usa el margen, la app lo avisa en la parada y en el resumen. Se puede apagar en Ajustes.
**Horarios raros.** Si el portal da a un cliente un horario solo de tarde (todo después de las 13:00, como «16h a 18h»), casi siempre es un error: la app lo avisa («Horario raro · llama al cliente») y planifica como si aceptara desde las 10:00. Tras llamar, en la ficha se pone el horario de verdad y se marca **Confirmado con el cliente**: a partir de ahí manda ese horario y el del portal ya no lo cambia.
**Notas de la factura.** De las observaciones de la factura, que son sobre todo para la oficina, la app guarda en la parada solo lo que sirve al conductor: a quién llamar y su teléfono, dónde entregar, devoluciones que recoger, montacargas, almacén… Salen como «Factura: …». Las referencias de pedido, quién lo pidió y el horario (que ya va a la franja) se quedan fuera.
**Rutas que llegan por un enlace.** La ruta del portal solo se da por buena si trae el código que esta web guarda en el móvil: lo llevan la APK (1.5.0 o posterior) y el marcador en su modo «en Safari». Lo que llegue por un enlace o compartido (de WhatsApp, de un marcador antiguo o de una APK antigua) se enseña con un aviso y, al añadirlo, no cambia la dirección ni el teléfono de los clientes que ya están guardados. Lo que pegas tú en tu propia app (del portapapeles o con «Pegar lista») va sin aviso: lo has traído tú.

**Sin APK: el marcador (iPhone y ordenador).** El botón **Traer la ruta del portal** de la pantalla de la ruta lo lleva todo: abrir el portal, pegar la ruta y, la primera vez, guardar el marcador. El marcador es un favorito `javascript:` que corre en el portal, con la sesión del repartidor —así cada uno saca la suya, y la contraseña no sale del navegador—, lee las mismas dos consultas que la pantalla «Repartos de entrega» y devuelve la ruta a la app. Guardarlo es el equivalente a instalar la APK: una vez y ya está. Safari de iPhone ejecuta los marcadores; Chrome y Edge de Android no, así que en Android sigue haciendo falta la APK.

**En iPhone, dos maneras según dónde abras Ruta** (se elige al guardar el marcador, y la app propone la que toca):
- *En Safari*: el marcador lleva dentro la dirección de la app y el código de ese móvil, y al tocar tu ruta la app se abre con las paradas dentro y verificada, sin pegar nada. Al cambiar de móvil o borrar los datos hay que copiar el marcador otra vez, porque el código cambia.
- *Desde el icono de la pantalla de inicio*: iOS aísla los datos de una app instalada y no deja que le entre nada de fuera, así que el marcador deja la ruta **copiada** y en la app se mete con **Pegar la ruta** (iOS pide confirmar el pegado: un toque). La app se acuerda de que has ido al portal y te ofrece el botón al volver, aunque iOS la haya cerrado mientras tanto. Son dos toques más que en Android y nada que copiar a mano.

El marcador copia la ruta siempre, aunque además salte a la app: así, si el marcador no es el que tocaba, la ruta no se pierde y se puede pegar.
En su ficha se marca también cómo es **con el horario**: *Estricto* (sin margen: se planifica para llegar al menos 10 min antes de que cierre) o *Flexible* (media hora más de margen).

**«¿Cuánto crees que tardarás?»** Cada local es un mundo: en uno aparcas delante y en 10 minutos has salido, y en otro das tres vueltas para aparcar, subes en montacargas y se te va media hora. Y además depende de lo que lleves ese día. Así que el tiempo de cada parada lo pones tú: al traer una ruta la app pregunta y, en ruta, la pastilla **«¿Cuánto tardo?»** de la parada actual lo cambia cuando quieras (y vuelve a calcular las horas). No pregunta por las 25 paradas del día, que sería una hoja interminable: solo por aquellas donde su cuenta es floja —el local donde nunca ha medido nada y el día en que el pedido se sale de lo normal—, y te dice por qué pregunta por cada una. Las demás están a un toque, en **«Preguntar también por las otras N paradas»**. Lo que digas es la parada entera —aparcar, entrar, entregar y los viajes con la carretilla— y manda sobre lo que calcularía la app; se guarda en el cliente, así que la próxima vez ya sale puesto. Mientras no digas nada, la app lo calcula como siempre (descarga + aparcar + viajes) y al terminar la entrega te dice en qué ha quedado tu previsión («dijiste 15 min y han sido 22»), para afinar la próxima vez. En Ajustes se puede apagar la pregunta.

**Pedidos grandes.** Con la APK 1.4.0 la ruta del portal trae la carga de cada pedido. Cada parada enseña **cajas, cuántas de ellas son grandes y botellas sueltas**: «10 cajas (4 grandes) + 24 sueltas». Grandes son las de los dos tramos de arriba del portal (de 6 a 11 y de 12 o más); el portal no dice cuántas botellas lleva cada caja, solo en qué tramo cae. El total de botellas no se enseña, porque es una estimación y no dice nada que no digan ya las cajas, pero se sigue usando para marcar un **pedido grande** (más de 70 botellas o más de 30 cajas), que sale destacado en la lista y en el mapa. Al buscar dónde aparcar un grupo, cada pedido pesa por los viajes de carretilla que supone (12 cajas por viaje, 12 botellas sueltas ocupan una caja), así que la furgoneta queda más cerca del pedido grande.

**Por dónde se entra.** A veces la dirección del portal es la puerta del local, pero la mercancía entra por otro sitio: una rampa al otro lado de la manzana, el muelle de un polígono, el parking de un centro comercial. En la ficha de la parada o del cliente, **Se entra por otro sitio** abre un mapa: tocas donde paras para descargar (o arrastras la **E**, o pulsas **Estoy aquí** si estás allí mismo) y, si quieres, apuntas qué es («rampa c/ Girona»). Desde entonces la ruta, Waze/Maps, el mapa y la búsqueda de aparcamiento van a ese punto; la dirección se queda como está. El punto tiene que estar a menos de 600 m de la dirección: más lejos no es otra puerta del mismo local, y si la dirección del cliente cambia y el punto queda lejos de la nueva, se quita solo (la app lo avisa). Se guarda en el cliente, así que vale para todas las rutas siguientes y viaja con «Pasar configuración» a los compañeros.

**Mapa y aparcar una vez para varias entregas.** El botón **Mapa** enseña las paradas numeradas en el orden de la ruta, el camino en furgoneta y los tramos a pie. Con **Agrupar entregas para aparcar** tocas en el mapa las entregas que harás desde un mismo sitio (eso lo decides tú, que sabes dónde suele haber hueco) y la app propone dónde dejar la furgoneta: la zona de carga y descarga con la que menos se anda (datos abiertos del Ayuntamiento de Barcelona) o el punto medio si no hay ninguna. Dice cuántos minutos a pie hay a cada una, cuánto rato estarás aparcado frente a los 30 min de SPRO y si alguien llegaría tarde. **Otro sitio** propone la siguiente zona; también puedes arrastrar la P o tocar un punto azul (zona de carga y descarga). **Aceptar** lo mete en la ruta: Waze te lleva al aparcamiento y las demás entregas del grupo se hacen a pie. **Quitar los aparcamientos** (en el mapa) los deshace todos de una vez.

## Servicios de mapas

- **Tiempos de conducción y tráfico: Google Maps** (Routes API), el mismo tráfico que ven Google Maps y Waze. Waze no deja que otras apps le pidan rutas, pero es de Google y comparte sus datos de tráfico. Para ir a la parada se sigue abriendo **Waze o Google Maps**, el que se elija en Ajustes.
- **Direcciones:** geocodificador oficial del ICGC y, si no encuentra la dirección, CartoCiudad (IGN). Los dos son CC BY 4.0, así que se pueden guardar y compartir entre repartidores. Antes de buscar, la app traduce "Calle Mayor, Esplugas" a "Carrer Major, Esplugues". Si el resultado cae en otra población o en otra calle, la parada queda "Sin ubicar" hasta que la confirmes.
- **Locales por su nombre:** OpenStreetMap (Nominatim), como mucho una petición por segundo.
- **Mapa:** cartografía del ICGC (CC BY 4.0, con datos de OpenStreetMap fuera de Cataluña), dibujada con Leaflet (incluido en `vendor/`).

### Cómo usa la app Google

Se piden dos cosas, de precio muy distinto, y cada una para lo suyo:

1. **Tiempos entre paradas, sin tráfico** (*Compute Route Matrix*, la tarifa más barata). No se piden todos con todos, que con 25 paradas son 676 tiempos: cada parada con sus 5 vecinas más cercanas y el almacén con todas, unos 150. Los que no se piden se estiman con la línea recta y los minutos por kilómetro que Google acaba de dar para esa zona. A esos tiempos se les pone un factor según la hora (la hora punta va más lenta).
2. **La ruta elegida, con tráfico** (*Compute Routes*): una consulta con todas las paradas en orden. Con el tráfico previsto si se planifica para otra hora, y con el de ahora mismo al salir y en cada «Siguiente». Corrige los tramos con atasco y se vuelve a optimizar, con un máximo de 3 consultas.

Los tiempos de Google **no se guardan en el móvil** porque sus condiciones no lo permiten. Se quedan en memoria mientras la app está abierta y se reutilizan en cada «Siguiente»: al añadir una parada solo se piden los suyos. En Ajustes → Más ajustes se ve cuánto ha consultado este mes ese móvil.

### Poner la clave de Google (el encargado, una vez para todos)

Los repartidores no tienen que hacer nada: la clave de la empresa va en `js/config.js` y todos los móviles la tienen al actualizar la app.

1. En <https://console.cloud.google.com/> crea un proyecto («Ruta Escolà») y activa la **facturación** con la tarjeta de la empresa.
2. *APIs y servicios* → *Biblioteca* → **Routes API** → *Habilitar*.
3. *APIs y servicios* → *Credenciales* → *Crear credenciales* → *Clave de API*. En la clave:
   - *Restricciones de aplicaciones*: **Sitios web**, con la dirección de la web acabada en `/*` (por ejemplo `https://fullbusterz.github.io/*`).
   - *Restricciones de API*: solo **Routes API**.
4. Para la app de iPhone, crea **otra clave** igual pero con *Restricciones de aplicaciones*: **Apps de iOS**, identificador `com.flixescola.ruta`. Una clave no puede estar restringida a la vez a webs y a apps.
5. *APIs y servicios* → *Routes API* → *Cuotas*: pon un **tope diario**. Por ejemplo, 3.000 elementos de matriz al día y 1.500 rutas al día. Si un día se llega al tope, la app sigue con rutas aproximadas y lo avisa. Así nunca puede costar más de lo previsto.
6. Pon la clave de la web en `GOOGLE_MAPS_KEY` y la del iPhone en `GOOGLE_MAPS_KEY_IOS`, en `js/config.js`. Sube `VERSION` y publica.
7. En un móvil: Ajustes → Más ajustes → **Probar Google** debe decir «Funciona ✓» con los minutos del almacén a Sants.

La clave de la web se ve en el código de la página, como la de cualquier mapa de Google en una web. Por eso tiene que estar restringida a la web, a Routes API y con tope. Si un repartidor tiene que usar otra clave, la pone en su móvil, en Ajustes → Más ajustes. Esa no viaja con «Pasar configuración» ni con las copias.

### Cuánto cuesta

Precios de Google de 2025, en dólares. Pueden cambiar, así que míralos en <https://developers.google.com/maps/billing-and-pricing/pricing> antes de decidir. Cada mes Google regala un número de consultas de cada tipo para toda la cuenta:

| Lo que pide la app | Tarifa de Google | Gratis al mes | Después |
|---|---|---|---|
| Tiempos entre paradas (sin tráfico) | Compute Route Matrix *Essentials* | 10.000 elementos | ~5 $ cada 1.000 |
| Ruta con tráfico | Compute Routes *Pro* | 5.000 rutas | ~10 $ cada 1.000 |

Un repartidor con 20 paradas gasta más o menos **450 elementos y 35 rutas al día**: unos 10.000 elementos y 800 rutas al mes. Para toda la empresa, contando 22 días al mes:

| Repartidores | Al mes (aprox.) |
|---|---|
| 1 | gratis |
| 3 | ~100 $ |
| 5 | ~200 $ |
| 10 | ~500 $ |

Lo que más gasta es volver a pedir los tiempos cuando el móvil cierra la app (sobre todo la web en iPhone; la app de iPhone se cierra mucho menos). El tope diario del paso 5 es la garantía de que no se pasa.

## Instalar en el móvil

Tiene que estar publicada en una dirección https, por ejemplo con GitHub Pages: se sube la carpeta tal cual. Luego, desde el móvil:
- **Android (Chrome)**: menú ⋮, "Añadir a pantalla de inicio", o la APK.
- **iPhone: la app de verdad**, desde TestFlight. Es lo recomendable: trae la ruta del portal con un botón, no borra los datos y no hay marcador. Cómo publicarla: [native/LEEME.md](native/LEEME.md).
- **iPhone sin la app (Safari)**: botón Compartir, "Añadir a pantalla de inicio".

**En iPhone, icono o Safari** (solo sin la app). Desde el icono la ruta entra con **Pegar la ruta**, porque iOS no deja que nada entre solo en una web instalada. En Safari entra sola al tocarla en el portal, pero Safari puede borrar los datos tras unos días sin abrir la app, así que conviene hacer copia de seguridad. La app detecta en cuál de los dos está y prepara el marcador para esa manera; se cambia a mano al guardarlo.

## Letra del móvil

La app usa la letra del propio móvil y, en iPhone, sigue el **«Tamaño del texto»** que cada uno tenga puesto (Ajustes → Pantalla y brillo). Safari no lo aplica a las webs, así que la app lo lee del sistema. No hay nada que configurar en la app: si alguien tiene la letra grande en el iPhone, la ve grande, y nada se sale de la pantalla.

## Para desarrollo

- `npm test`: tests del optimizador, del lector de listas y de los aparcamientos.
- `node tools/dum-bcn.mjs <csv>`: regenera `data/dum-bcn.json` con el CSV de zonas de carga y descarga de Open Data BCN.
- `GOOGLE_KEY=… node test/real-route.mjs`: ruta de prueba con direcciones reales del Baix Llobregat (con clave de Google, tiempos de verdad; sin ella, estimados).
- `native/`: la app de iPhone (Capacitor). Ver [native/LEEME.md](native/LEEME.md).
- Al publicar cambios, sube `VERSION` en `sw.js` y en `js/app.js`: los móviles verán "Hay una versión nueva · Actualizar".
