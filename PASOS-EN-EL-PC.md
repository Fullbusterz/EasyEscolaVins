# Lo que queda por hacer en el PC

El código ya está hecho (PR #9). Esto es lo que solo se puede hacer con las cuentas de la empresa, en el ordenador. Los repartidores no tienen que hacer nada de esto.

## 1. Clave de Google (unos 20 minutos), imprescindible

Sin ella, la app ordena las rutas por distancia aproximada, sin tráfico. La clave **no se pega en el código ni en el chat**: va como secreto de GitHub, y la app la recibe al publicarse.

1. Entra en <https://console.cloud.google.com/> con la cuenta de Google de la empresa.
2. Crea un proyecto «Ruta Escolà» y activa la **facturación**. Google pide una tarjeta, pero no cobra: la app está hecha para que los 15 repartidores quepan en lo gratuito (unas 3.000 consultas al mes de 5.000 gratis).
3. Busca **Routes API** y pulsa *Habilitar*.
4. *Credenciales* → *Crear credenciales* → *Clave de API*. Crea **dos claves**:
   - **«Ruta web»**: en *Restricciones de aplicaciones* elige *Sitios web* y pon la dirección de la web (te la digo). En *Restricciones de API*, solo **Routes API**.
   - **«Ruta iPhone»**: en *Restricciones de aplicaciones* elige *Apps de iOS* y pon `com.flixescola.ruta`. En *Restricciones de API*, solo **Routes API**.
5. *Routes API* → *Cuotas*: **160 rutas al día** («Compute Routes») y **0** a la matriz («Compute Route Matrix»). Con eso no puede cobrar nada.
6. *Facturación* → *Presupuestos y alertas*: un presupuesto de **1 €** con aviso por correo. Si algún día se pasara de lo gratis, te enteras al momento.
7. En GitHub → *Settings* → *Secrets and variables* → *Actions*:
   - Secretos: `GOOGLE_MAPS_KEY` (la «Ruta web») y `GOOGLE_MAPS_KEY_IOS` (la «Ruta iPhone»).
   - Variable: `PUBLICAR_CON_ACTIONS` = `si`.
8. GitHub → *Settings* → *Pages* → *Source*: **GitHub Actions**. Desde ese momento, cada vez que se aprueban cambios, la web se publica sola con la clave dentro.

## 2. Revisar y publicar (10 minutos)

1. Abre la app desde el móvil con la versión nueva y prueba una ruta de ejemplo.
2. Si va bien, se aprueba el PR #9 y se publica.

## 3. App de iPhone de verdad — opcional, pero es lo que quita el marcador y el «pegar la ruta»

Cuesta **99 € al año** (cuenta de Apple Developer). No hace falta Mac.

1. Alta en <https://developer.apple.com/programs/> (como empresa pide un número D-U-N-S, que es gratis pero tarda unos días; como particular es inmediato).
2. Con la cuenta ya activa, lo hacemos juntos en unos 20 minutos: crear la app en App Store Connect, poner 4 datos en GitHub y pulsar un botón. El detalle está en `native/LEEME.md`.
3. Al final sale un enlace. Cada repartidor lo abre, instala la app y ya está. Para traer la ruta pulsa **«Traer mi ruta»** y entra con su usuario del portal una sola vez.

## Lo que ya no tendrán que hacer los repartidores

- Crear cuentas ni pegar claves (TomTom, HEIGIT): la clave es una de la empresa y va dentro de la app.
- Con la app de iPhone: nada de marcador, nada de copiar y pegar la ruta, y Safari ya no les borra los datos.
