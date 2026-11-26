# Lo que queda por hacer en el PC

El código ya está hecho (PR #9). Esto es lo que solo se puede hacer con las cuentas de la empresa, en el ordenador. Los repartidores no tienen que hacer nada de esto.

## 1. Clave de Google (unos 15 minutos) — imprescindible

Sin ella, la app ordena las rutas por distancia aproximada, sin tráfico.

1. Entra en <https://console.cloud.google.com/> con la cuenta de Google de la empresa.
2. Crea un proyecto «Ruta Escolà» y activa la **facturación**. Google pide una tarjeta, pero no cobra: la app está hecha para que los 15 repartidores quepan en lo gratuito (unas 3.000 consultas al mes de 5.000 gratis).
3. Busca **Routes API** y pulsa *Habilitar*.
4. *Credenciales* → *Crear credenciales* → *Clave de API*.
5. Pon el **tope de 160 rutas al día** (te digo dónde). Con eso es imposible que cobre nada.
6. **Pásame la clave por el chat** y yo la pongo en la app. Los repartidores no tienen que hacer nada.

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
