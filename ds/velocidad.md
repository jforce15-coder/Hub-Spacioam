# Rápido de sentir · la espera se diseña

Principio del design system de Spacio AM (ver `readme.md` → Principios). Viene del video «How apps fake being fast» (@motion_ui_interface) que Juan pasó el 31-oct-2026. Vale para todas las apps (Hub, Alma, Hola, Epi, Grow, Mi, Docs), y sobre todo para la app de Alma.

**La idea:** la persona no mide milisegundos, mide cómo se siente la espera. Una espera bien diseñada se siente instantánea, aunque el servidor tarde lo mismo. Nunca dejamos una pantalla en blanco, un «Cargando…» suelto ni una ruedita sin contexto.

## Las 6 reglas

| # | Regla | Qué es | En Spacio AM |
|---|---|---|---|
| 1 | **El resultado primero** (optimistic UI) | Mostrar el resultado en 0 ms y confirmar con el servidor después. Si falla, se deshace con un aviso claro. | «Ya está», «Ya lo hice» y «Unir» en Pendientes. «Responder» muestra «Listo, se lo pasé» al instante. Un mensaje del chat aparece enviado de una vez. |
| 2 | **La forma antes que el contenido** (skeleton) | Las cajas grises con la forma de lo que viene, en vez de una ruedita. Misma espera, se siente más corta. | Pendientes, Notificaciones y el reporte de llamadas abren con sus tarjetas en gris, no con «Todo al día» antes de tiempo. |
| 3 | **Algo ahí desde el principio** (vista previa) | Una versión mínima (una miniatura borrosa, la foto local) mientras llega la completa. | Las fotos que mandas en el chat se ven de inmediato desde el teléfono. Las fotos de las propiedades cargan primero en baja resolución. |
| 4 | **La barra que termina rápido** (pico-final) | En esperas largas, una barra que arranca lento y termina rápido. Recordamos cómo terminó una espera. | «Armarlo ahora» en el reporte de llamadas y las publicaciones largas (unir, publicar). |
| 5 | **Hecho antes de que lo pidas** (trabajo adelantado) | Empezar el trabajo mientras la persona todavía está llenando o decidiendo. | Alma deja lista la ficha y la conexión de voz cada 9 min, para que al tocar suene el beep enseguida. Hola puede subir el DPI mientras el huésped llena el resto. |
| 6 | **Que se vea el trabajo** (ilusión de trabajo) | Mostrar lo que se está haciendo, con un conteo real, para que la espera valga la pena. | «Leyendo 30 llamadas…», «Revisando 11 conversaciones…», «Buscando en 3 fuentes…». Nunca con números inventados. |

## Cómo aplicarlas
- **Por nivel de espera** (los 3 niveles del reporte de llamadas):
  - Nivel 1 (≤10 s): reglas 1 y 2.
  - Nivel 2 (10–60 s): reglas 2, 3 y 6.
  - Nivel 3 (>60 s): reglas 4 y 6, y la tarea se manda a segundo plano con aviso al terminar.
- **Honestidad:** la regla 1 solo vale donde casi nunca falla y se puede deshacer, y si falla se dice. La regla 6 muestra trabajo real, no números de adorno.
- **Esqueleto listo para usar:** `ds/esqueleto.css` (clase `sa-esq` con líneas, títulos, tarjetas y burbujas). Las otras apps lo cargan desde `https://hub.spacioam.com/ds/esqueleto.css`.
- **Movimiento:** `--ease`, `--d-med` y `--d-slow` (`tokens/motion.css`). El brillo del esqueleto se apaga con `prefers-reduced-motion`.
- **Prohibido:** pantallas en blanco, «Cargando…» sin forma, rueditas sin contexto y estados vacíos («Todo al día», «Sin notificaciones») antes de que lleguen los datos.

## Revisión (para cada app, en la ronda de su subdepartamento)
Para cada pantalla, pregúntate:
- ¿Qué ve la persona en el primer momento?
- ¿Qué ve a los 2 s?
- ¿Cómo termina la espera?

Anota qué regla aplica en cada pantalla y arregla primero las de nivel 2 y 3.
