# Ruta Escolà

App web para el móvil (se instala como una app normal) que ordena la ruta de reparto teniendo en cuenta el tráfico y los horarios de entrega de cada cliente.

## Cómo se usa

1. **El día antes** (la ruta sale en el portal sobre las 17:30): **Traer la ruta del portal** la trae con direcciones, teléfonos y horarios. En Android lo hace la APK 1.3.0 (y puede avisarte cuando salga); en iPhone y en el ordenador, el marcador, que se guarda una vez igual que se instala la APK. Si no, pega la lista o añade las paradas a mano. Luego, **Optimizar ruta**.
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

**Mapa y aparcar una vez para varias entregas.** El botón **Mapa** enseña las paradas numeradas en el orden de la ruta, el camino en furgoneta y los tramos a pie. Con **Agrupar entregas para aparcar** tocas en el mapa las entregas que harás desde un mismo sitio (eso lo decides tú, que sabes dónde suele haber hueco) y la app propone dónde dejar la furgoneta: la zona de carga y descarga con la que menos se anda (datos abiertos del Ayuntamiento de Barcelona) o el punto medio si no hay ninguna. Dice cuántos minutos a pie hay a cada una, cuánto rato estarás aparcado frente a los 30 min de SPRO y si alguien llegaría tarde. **Otro sitio** propone la siguiente zona; también puedes arrastrar la P o tocar un punto azul (zona de carga y descarga). **Aceptar** lo mete en la ruta: Waze te lleva al aparcamiento y las demás entregas del grupo se hacen a pie. **Quitar los aparcamientos** (en el mapa) los deshace todos de una vez.

## Servicios de mapas (todos permiten uso de empresa)

- **Direcciones:** geocodificador oficial del ICGC y, si no encuentra la dirección, CartoCiudad (IGN). Los dos son CC BY 4.0, así que se pueden guardar y compartir entre repartidores. Antes de buscar, la app traduce "Calle Mayor, Esplugas" a "Carrer Major, Esplugues". Si el resultado cae en otra población o en otra calle, la parada queda "Sin ubicar" hasta que la confirmes.
- **Locales por su nombre:** OpenStreetMap (Nominatim), como mucho una petición por segundo.
- **Tiempos de conducción:** openrouteservice, con una clave gratuita de account.heigit.org (500 consultas al día, la app gasta unas 20). Sin clave, la app ordena las paradas por distancia aproximada.
- **Las claves son de cada repartidor.** Cada uno pone las suyas en Ajustes y se quedan en su móvil: ni «Pasar configuración» ni la copia de seguridad las llevan, y si un archivo antiguo las trae, al importarlo se ignoran.
- **Mapa:** cartografía del ICGC (CC BY 4.0, con datos de OpenStreetMap fuera de Cataluña), dibujada con Leaflet (incluido en `vendor/`).
- **Tráfico en tiempo real (opcional):** clave gratuita de TomTom (20.000 rutas al mes). Por cada cálculo, la app pide a TomTom la ruta elegida (de 1 a 3 consultas), corrige los tramos con atasco y vuelve a optimizar. Esos tiempos no se guardan, porque las condiciones de TomTom no lo permiten.

## Instalar en el móvil

Tiene que estar publicada en una dirección https, por ejemplo con Netlify Drop o GitHub Pages: se sube la carpeta `app` tal cual. Luego, desde el móvil:
- **Android (Chrome)**: menú ⋮, "Añadir a pantalla de inicio".
- **iPhone (Safari)**: botón Compartir, "Añadir a pantalla de inicio".

**En iPhone, icono o Safari.** Desde el icono la ruta entra con **Pegar la ruta** (iOS no deja que nada entre solo en una app instalada); en Safari entra sola al tocarla en el portal, pero Safari puede borrar los datos tras unos días sin abrir la app, así que conviene hacer copia de seguridad. La app detecta en cuál de los dos está y prepara el marcador para esa manera; se cambia a mano al guardarlo.

## Para desarrollo

- `npm test`: tests del optimizador, del lector de listas y de los aparcamientos.
- `node tools/dum-bcn.mjs <csv>`: regenera `data/dum-bcn.json` con el CSV de zonas de carga y descarga de Open Data BCN.
- `node test/real-route.mjs`: ruta de prueba con direcciones reales del Baix Llobregat.
- Al publicar cambios, sube `VERSION` en `sw.js` y en `js/app.js`: los móviles verán "Hay una versión nueva · Actualizar".
