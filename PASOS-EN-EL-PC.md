# Lo que queda por hacer en el PC

El código ya está hecho (PR #9). Esto es lo que solo se puede hacer con las cuentas de la empresa, en el ordenador. Los repartidores no tienen que hacer nada de esto.

## 1. Activar las rutas (unos 10 minutos)

Se necesitan dos claves gratuitas; ninguna cuenta pide tarjeta.

1. Entra en <https://developer.tomtom.com>, crea una cuenta gratuita y copia la clave del panel.
2. Entra en <https://account.heigit.org>, crea una cuenta con el plan Standard gratuito y copia la clave.
3. En GitHub → *Settings* → *Secrets and variables* → *Actions*, guarda las claves como secretos `TOMTOM_KEY` y `ORS_KEY`.
4. Deja la variable `PUBLICAR_CON_ACTIONS` = `si` y en GitHub → *Settings* → *Pages* → *Source* elige **GitHub Actions**.

Las claves no se pegan en el código ni en el chat. Ambas cuentas son gratuitas y sin tarjeta, así que no es posible que cobren. Límites: TomTom 20.000 rutas al mes; openrouteservice 500 matrices al día y 40 por minuto. La app reparte esos límites entre los móviles y usa rutas aproximadas si se agota una cuota.

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
