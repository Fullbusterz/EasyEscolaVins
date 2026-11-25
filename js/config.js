// Configuración de la empresa: lo que vale igual para todos los repartidores y no tiene que tocar nadie.
//
// GOOGLE_MAPS_KEY: la clave de Google Maps Platform de Escolà para los tiempos de conducción y el tráfico
// (Routes API). Se pone aquí UNA vez y la tienen todos los móviles al actualizar la app: los repartidores no
// tienen que crear cuentas ni pegar claves. Cómo sacarla y protegerla: LEEME.md, «Google Maps».
//
// Va a la vista de cualquiera que abra la web (es una clave de navegador, como las de cualquier mapa de
// Google en una página), así que en la consola de Google tiene que estar:
//   - restringida a la dirección de esta web (Sitios web: https://<tu-dominio>/*),
//   - restringida a la API «Routes API», y
//   - con un tope de consultas al día (Cuotas), para que nunca pueda costar más de lo previsto.
// Si se deja vacía, cada móvil puede poner la suya en Ajustes → Más ajustes.
export const GOOGLE_MAPS_KEY = '';
