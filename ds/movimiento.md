# Movimiento con sentido · cada movimiento dice algo

Principio del design system de Spacio AM (ver `readme.md` → Principios). Viene del video «Which feels better?» (@motion_ui_interface) que Juan pasó el 31-oct-2026. Vale para todas las apps.

**La idea:** el movimiento no es adorno. Cada uno le contesta algo a la persona: «sí, lo tocaste», «no, eso no», «salió de aquí», «se fue y nada se movió de lugar». Si un movimiento no dice nada, sobra.

## Las 6 reglas

| # | Regla | Qué dice | En Spacio AM | Pieza (`ds/movimiento.css` · `ds/movimiento.js`) |
|---|---|---|---|---|
| 1 | **Un resorte, no un deslizar** | Lo que mueves con el dedo (un interruptor, la roca, una esfera) llega, se pasa un poquito y se asienta, como algo real. | Interruptores de Ajustes, la roca y las esferas. | `--resorte` y `.sa-interruptor` |
| 2 | **El toque se siente** | Al tocar algo que importa, un «pop» corto confirma que llegó. | «Ya está», «Ya lo hice», Unir y «Me gusta». | `.sa-pop` |
| 3 | **Sale de donde tocaste** | Un menú o una hoja crece desde el botón que lo abrió, no aparece del centro. | El abanico de la roca, los menús «Más» y las tarjetas que se abren. | `--origen` y `.sa-desde` |
| 4 | **El no se ve antes de leerlo** | Un error sacude el campo y lo pinta de rojo; la sacudida dice «no» antes del texto. | Contraseña mala, código vencido y un campo obligatorio vacío. | `.sa-sacude` y `SAMov.sacudir(el)` |
| 5 | **La píldora viaja** | Al cambiar de pestaña o de filtro, el marcador se desliza de una a otra, y el ojo lo sigue. | Pestañas de Hoy (Programa · Registros) y los filtros por esfera. | `.sa-pildora` y `SAMov.pildora(barra, activo)` |
| 6 | **Nada salta** | Al quitar una fila, el hueco se cierra suave; lo de abajo sube sin brincar y no pierdes tu lugar. | Pendientes al marcar «Ya está», correos y listas de reservas. | `SAMov.quitar(el, listo)` |

## El cuidado (lo que el video no dice)
- **Calma antes que juego.** Spacio AM es sereno: el resorte se pasa como mucho un 4 %, nunca rebota dos veces y nunca se usa en contenido que entra solo (textos, tarjetas que cargan). Ahí van `--ease` y un fade corto.
- **Corto.** Toques y errores, ≤ 300 ms. Hojas y menús, ≤ 400 ms. Nada hace esperar a la persona.
- **El estallido es raro.** El «pop» va solo en acciones que resuelven algo; en cada toque cansa.
- **El movimiento nunca va solo.** La sacudida siempre lleva el texto del error y el color (lectores de pantalla y quien no la vio). El hueco que se cierra solo se cierra después de que el servidor aceptó, o se deshace con aviso (regla 1 de `velocidad.md`).
- **Movimiento reducido.** Con `prefers-reduced-motion` todo pasa sin animar: la sacudida se vuelve solo el borde rojo y el hueco se cierra de una vez.
- **Solo `transform` y `opacity`** para que vaya fluido en el teléfono. La única excepción es el alto al cerrar un hueco, y dura 240 ms.

## Revisión
En cada pantalla, pregúntate qué dice cada movimiento. Si no dice nada, quítalo. Si algo cambia sin moverse (un error, una fila que se va, un menú), elige su regla.
