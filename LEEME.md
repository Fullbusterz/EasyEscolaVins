# Ruta Escolà

App web para el móvil (se instala como una app normal) que ordena la ruta de reparto teniendo en cuenta el tráfico y los horarios de entrega de cada cliente.

## Cómo se usa

1. **El día antes** (la ruta sale en el portal sobre las 17:30): con la APK 1.3.0, **Traer la ruta del portal** la trae con direcciones, teléfonos y horarios (y puede avisarte cuando salga). Si no, pega la lista o añade las paradas a mano. Luego, **Optimizar ruta**.
2. **Recalcular**, cuando quieras (antes de salir o en plena ruta): vuelve a calcular el orden con el tráfico de ese momento.
3. **Empezar ruta** el día del reparto y **Waze** te lleva a la primera parada. Al terminar cada parada pulsa **Siguiente** (la entrega se registra en la tablet; si te equivocas, **Deshacer**): recalcula desde donde estás y te da la siguiente.

Cada cliente queda guardado con su dirección, su horario de entrega, sus notas y su teléfono. La próxima vez basta con escribir su nombre.
**Horarios de los clientes, con margen:** la ruta se ordena para llegar dentro del horario de cada cliente, pero con margen, porque los horarios del portal no son exactos: media hora si el local cierra por la mañana y una hora si cierra a mediodía o más tarde (un «hasta las 12» admite llegar a la 13). Antes de la hora de apertura no hay margen. Cuando la ruta usa el margen, la app lo avisa en la parada y en el resumen. Se puede apagar en Ajustes.
**Horarios raros.** Si el portal da a un cliente un horario solo de tarde (todo después de las 13:00, como «16h a 18h»), casi siempre es un error: la app lo avisa («Horario raro · llama al cliente») y planifica como si aceptara desde las 10:00. Tras llamar, en la ficha se pone el horario de verdad y se marca **Confirmado con el cliente**: a partir de ahí manda ese horario y el del portal ya no lo cambia.
**Notas de la factura.** De las observaciones de la factura, que son sobre todo para la oficina, la app guarda en la parada solo lo que sirve al conductor: a quién llamar y su teléfono, dónde entregar, devoluciones que recoger, montacargas, almacén… Salen como «Factura: …». Las referencias de pedido, quién lo pidió y el horario (que ya va a la franja) se quedan fuera.
**Rutas que llegan por un enlace.** La ruta del portal solo se da por buena si llega desde la APK (1.5.0 o posterior): la web le pasa un código al abrir el portal y la APK lo devuelve con la ruta. Lo que llegue por un enlace o compartido (de WhatsApp, del marcador del ordenador o de una APK antigua) se enseña con un aviso y, al añadirlo, no cambia la dirección ni el teléfono de los clientes que ya están guardados.
En su ficha se marca también cómo es **con el horario**: *Estricto* (sin margen: se planifica para llegar al menos 10 min antes de que cierre) o *Flexible* (media hora más de margen).

**Pedidos grandes.** Con la APK 1.4.0 la ruta del portal trae la carga de cada pedido: cajas (exactas) y botellas (las sueltas, más las de dentro de las cajas estimadas por su tamaño). Cada parada la enseña, y un **pedido grande** (más de 70 botellas o más de 30 cajas) sale destacado en la lista y en el mapa. Al buscar dónde aparcar un grupo, cada pedido pesa por los viajes de carretilla que supone (8 cajas por viaje), así que la furgoneta queda más cerca del pedido grande.

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

## Para desarrollo

- `npm test`: tests del optimizador, del lector de listas y de los aparcamientos.
- `node tools/dum-bcn.mjs <csv>`: regenera `data/dum-bcn.json` con el CSV de zonas de carga y descarga de Open Data BCN.
- `node test/real-route.mjs`: ruta de prueba con direcciones reales del Baix Llobregat.
- Al publicar cambios, sube `VERSION` en `sw.js` y en `js/app.js`: los móviles verán "Hay una versión nueva · Actualizar".
