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

## Web (GitHub Pages)
- ✅ Si cambia `js/sa-nav.js` o `js/alma-client.js`, sube su `?v=` en todas las páginas que lo cargan.
- ✅ Los bots de prueba no encuentran nada grave (error de JavaScript, pantalla en blanco, código del usuario ejecutándose). Corren después de unir; lo que encuentren se arregla en un PR corto.
- Un elemento se busca por su nombre propio (`data-a`, `id`), nunca por una clase de estilo que otro elemento puede compartir (pasó dos veces el 30 oct: el botón y la lista de Pendientes tomaban los de Notificaciones).
- Nada se sale de la pantalla en un iPhone SE (375 px); los botones miden al menos 44 px; respeta las áreas seguras.
- Colores, letras y radios del sistema de diseño (`ds/`): alabastro, arena, durazno #E9826A, Valky y Montserrat.

## Escritura
- Las palabras del glosario (`docs/GLOSARIO.md`), en español, simples.
- Nombres para quien lee: `correoNoResponder_`, no `cnr_`. Módulos chicos antes que listos.
- Los comentarios explican el porqué, con la densidad del archivo que tocas.
- Al copiar código de otra función, revisa que cada variable exista en la nueva (p. ej. `o.forzarPlantilla` copiado sin el parámetro `o` tumbó todos los mensajes personales del 29 al 30-oct). Pruébala una vez con datos de ejemplo antes del PR.

## PRs
- La plantilla completa: Resumen, Evidencia antes/después, Peligros al unir, Cómo probarlo. ✅ (aviso si falta Evidencia)
- Ningún identificador de modelo en commits ni PRs.
