# Estándares del código (Hub de Spacio AM)

Las reglas que se repiten. ✅ = una máquina la revisa en cada PR (`.github/workflows/estandares.yml` o
`revisar-apps-script.yml`); lo demás lo revisa el segundo escritorio (ver CLAUDE.md §6). Cuando algo se corrige dos
veces, se agrega aquí; si se puede detectar solo, se vuelve ✅.

## Apps Script
- ✅ Ningún nombre (función, var, let, const) declarado dos veces entre archivos.
- ✅ Todo `.js` es JavaScript válido.
- Las llaves y tokens viven en las Propiedades del script, nunca en el código. ✅ (patrones de llaves conocidas)
- Lo que cambia algo afuera (mensajes, cobros, datos de huéspedes) pasa por una propuesta o una confirmación.
- No se guarda el cuerpo de correos ni datos de identidad completos; solo lo necesario.
- Sin prueba no hay respuesta: lo que Alma afirma sale de una fuente que puede citar (el cerebro, una herramienta). Si no hay prueba lo dice («No lo encontré en nuestros documentos») y deja la pregunta al responsable (Pendientes) o, con un huésped, «lo confirmo con el equipo».
- La audiencia se filtra en el código: quién puede ver qué sale de quién habla (`audienciaDe_`, `vozQuien_`) y se filtra dentro de la consulta (y otra vez al devolver), nunca de lo que diga el modelo. El modelo solo puede angostar una búsqueda, no ampliarla. Ante la duda, interno.

## Web (GitHub Pages)
- ✅ Si cambia `js/sa-nav.js` o `js/alma-client.js`, sube su `?v=` en todas las páginas que lo cargan.
- ✅ Los bots de prueba no encuentran nada grave (error de JavaScript, pantalla en blanco, código del usuario ejecutándose). Corren después de unir; lo que encuentren se arregla en un PR corto.
- Un elemento se busca por su nombre propio (`data-a`, `id`), nunca por una clase de estilo que otro elemento puede compartir (pasó dos veces el 30 oct: el botón y la lista de Pendientes tomaban los de Notificaciones).
- Nada se sale de la pantalla en un iPhone SE (375 px); los botones miden al menos 44 px; respeta las áreas seguras.
- Colores, letras y radios del sistema de diseño (`ds/`): alabastro, arena, durazno #E9826A, Valky y Montserrat.

## Movimiento con sentido
- Cada movimiento dice algo (ds/movimiento.md). Si no dice nada, sobra. Piezas: `ds/movimiento.css` y `ds/movimiento.js` (`SAMov.sacudir`, `pop`, `quitar`, `pildora`, `desde`).
- Error de un campo: se sacude, queda en rojo y lleva el texto. Nunca la sacudida sola.
- Quitar una fila o tarjeta: el hueco se cierra suave (`SAMov.quitar`), nunca un repintado que salta.
- Resorte solo en lo que la persona mueve o toca, y se pasa como mucho un 4 %. Lo que entra solo usa `--ease`.
- Todo respeta `prefers-reduced-motion`.

## Velocidad percibida
- Rápido de sentir ([ds/velocidad.md](ds/velocidad.md)). Ninguna pantalla en blanco ni «Cargando…» sin forma: esqueleto con la forma de lo que viene. Lo que casi nunca falla se muestra hecho al instante (y se deshace si falla). Las esperas largas llevan una barra que termina rápido y el trabajo real a la vista. Un estado vacío solo se muestra cuando ya llegaron los datos.

- Cargar rápido de verdad (ds/velocidad.md, reglas 7–9): nada en fila al abrir (mejor una llamada que muchas); la «foto» de la pantalla se guarda por persona y versión, sin datos sensibles, vence a las 24 h, se borra al cerrar sesión y se dice «actualizando…» mientras llega la fresca; la sesión se cierra solo con un «no autorizado» claro, nunca por falta de red.

## Escritura
- Las palabras del glosario (`docs/GLOSARIO.md`), en español, simples.
- Nombres para quien lee: `correoNoResponder_`, no `cnr_`. Módulos chicos antes que listos.
- Los comentarios explican el porqué, con la densidad del archivo que tocas.
- Al copiar código de otra función, revisa que cada variable exista en la nueva (p. ej. `o.forzarPlantilla` copiado sin el parámetro `o` tumbó todos los mensajes personales del 29 al 30-oct). Pruébala una vez con datos de ejemplo antes del PR.

## PRs
- La plantilla completa: Resumen, Evidencia antes/después, Peligros al unir, Cómo probarlo. ✅ (aviso si falta Evidencia)
- Ningún identificador de modelo en commits ni PRs.
