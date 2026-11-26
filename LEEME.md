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

### Cómo usa la app Google (sin pagar)

Para que toda la empresa (unos 15 repartidores) quepa en lo que Google regala cada mes, la app solo hace una consulta: **la ruta elegida, con tráfico** (*Compute Routes*), con todas las paradas en orden. Y la hace pocas veces:

- **Al planificar:** primero se ordena por distancia y luego se pregunta a Google por esa ruta con el tráfico previsto. Con lo que contesta se corrigen los tramos con atasco y se ajustan los demás tiempos a la velocidad real de ese día. Si el orden cambia, se pregunta otra vez. Como mucho son 2 consultas.
- **En «Siguiente»:** se reutiliza lo que dijo Google la última vez. Solo se vuelve a preguntar si han pasado más de **75 minutos**.
- **«Recalcular»:** pregunta siempre, porque lo ha pedido el repartidor.
- **Cada móvil, como mucho 10 consultas automáticas al día**, y 16 contando los «Recalcular». Pasado eso sigue con lo último que dijo Google y la velocidad de ese día. Así nadie gasta la parte de los demás.

Hay un modo más fino que además pide la tabla de tiempos entre paradas (`GOOGLE_MATRIX` en `js/config.js`). Está **apagado**, porque con varios repartidores se pasa de lo gratuito.

Los tiempos de Google **no se guardan en el móvil**: sus condiciones no lo permiten. Se quedan en memoria mientras la app está abierta. En Ajustes → Más ajustes se ve cuánto ha consultado ese móvil este mes.

### Poner la clave de Google (el encargado, una vez para todos)

Los repartidores no tienen que hacer nada: la clave de la empresa va dentro de la app.

**La clave no está en el código.** El repositorio es público y hay robots que buscan claves de Google en GitHub. Por eso `js/config.js` la tiene vacía y la clave vive en los **secretos del repositorio**. Al publicar, los workflows la meten en la copia que se publica (`tools/put-keys.mjs`):

- `GOOGLE_MAPS_KEY`: la web. La publica `.github/workflows/web.yml` en GitHub Pages (Pages → *Source: GitHub Actions* y la variable `PUBLICAR_CON_ACTIONS = si`).
- `GOOGLE_MAPS_KEY_IOS`: la app de iPhone. La mete `.github/workflows/ios.yml` al compilar.

Además, cada clave va protegida en la consola de Google:

1. Restringida a quien la usa. La de la web, a *Sitios web* con la dirección de la web (`https://…/*`). La del iPhone, a *Apps de iOS* con `com.flixescola.ruta`. Una clave no puede estar restringida a las dos cosas a la vez.
2. Restringida a una sola API: **Routes API**.
3. Con **tope diario** en *Cuotas*: 160 rutas al día, y 0 a la matriz.
4. Con un **presupuesto de 1 €** con aviso por correo, en *Facturación*.

Quien abra la web publicada todavía puede ver la clave (pasa con cualquier web que use Google Maps). Con las restricciones y el tope, lo peor que puede hacer es gastar el tope de un día: no puede costar dinero.

Los pasos uno por uno están en `PASOS-EN-EL-PC.md`. Si un repartidor necesitara otra clave, se pone en su móvil en Ajustes → Más ajustes. Esa no viaja con «Pasar configuración» ni con las copias.

### Cuánto cuesta: nada, si se pone el tope

Google regala cada mes **5.000 rutas con tráfico** para toda la cuenta de la empresa, no por repartidor. Es el dato de 2025; compruébalo en <https://developers.google.com/maps/billing-and-pricing/pricing>. Pide una tarjeta para dar de alta la cuenta, pero no cobra mientras no se pase de ahí.

Un repartidor gasta unas **9 rutas al día**: 2 al planificar, unas 5 a lo largo de la ruta (una cada 75 minutos) y algún «Recalcular». Con **15 repartidores** son unas 3.000 al mes, por debajo de las 5.000.

Para que **nunca** se pueda cobrar nada, en la consola de Google se pone un **tope de 160 rutas al día** (5.000 entre 31 días). Si un día se llega al tope, la app sigue funcionando con distancias aproximadas hasta el día siguiente.

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
