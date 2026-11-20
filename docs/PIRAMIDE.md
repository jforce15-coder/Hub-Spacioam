# La pirámide: cada corrección de Juan, al escalón más barato que la detenga

Juan, 20-nov-2026 («implementa esto», charla de Lauren Tan «All code is slop except mine»). Una regla escrita en CLAUDE.md
pierde contra el código que ya existe: el agente ve una frase que dice «no» y varios ejemplos que dicen «sí», y repite el
error. Por eso, ante cada corrección, se baja por esta pirámide y se queda en el primer escalón que alcance:

1. **Diseño** (lo más barato): que el error no se pueda escribir. Una sola función para algo (`uf_`, `almaPrompt_`,
   `normTel_`), una herramienta que se niega sola, un dato que solo sale de su fuente.
2. **Revisión automática**: una regla que falla en segundos, sin navegador (`.github/correcciones.js`, un paso de
   `.github/workflows/estandares.yml`, una prueba con dobles). Su mensaje le dice al agente **qué hacer en su lugar**.
   Al crearla se borran las copias viejas del mal patrón; si son riesgosas, se anotan abajo.
3. **Verificación corriendo la app**: la función va al mapa (`docs/mapa-funciones.json`) y los bots la comprueban en la
   página después de unir.
4. **Prosa**: ESTANDARES.md, CLAUDE.md, el prompt de Alma. Solo lo que una máquina no puede ver.
5. **Revisión de Juan** (lo más caro): solo decisiones.

Ningún comentario justifica un parche («hack», «por ahora», «TODO:», «la solución real sería…»): el siguiente agente lo lee
como permiso. Se arregla la causa; una razón real se escribe como hecho; lo pendiente va a un issue.

## Inventario (20-nov-2026)

Fuentes: CLAUDE.md del Hub (16 reglas), ESTANDARES.md (126), las reglas de sesión de Claude (17) y las correcciones
repetidas de los PR de noviembre. ✅ = revisión automática · 🤖 = verificación con los bots · ◇ = diseño · ✎ = solo prosa.

| Regla | Escalón | Dónde |
|---|---|---|
| Commits sin backticks ni identificadores de modelo; pie Co-Authored-By y Claude-Session | ✅ nuevo (pie: aviso) | `correcciones.js` |
| El PR no nombra modelos | ✅ nuevo | `correcciones.js --pr` |
| Llaves y tokens fuera del repo (ElevenLabs, OpenAI, AWS, Google OAuth, Slack, Stripe, Telegram, llave privada, token asignado) | ✅ ampliado | `correcciones.js` + «Ninguna llave en el código» |
| Nada de teléfonos, correos personales ni DPI reales en el repo público | ✅ nuevo | `correcciones.js` |
| Comentarios que justifican un parche | ✅ nuevo | `correcciones.js` |
| Un parpadeo no se tapa con `setTimeout` | ✅ nuevo | `correcciones.js` |
| Textos de la app con la columna «Evitar» del glosario (lo medible) | ✅ nuevo | `correcciones.js` |
| Nadie escribe «Eres Alma, …» a mano | ✅ nuevo | `correcciones.js` |
| Alma no dice «dale» ni «ahorita» («va» ya estaba) | ✅ nuevo | `correcciones.js` |
| Fechas del render del Hub con `fechaFmt` | ✅ nuevo | `correcciones.js` |
| `?v=` de sa-nav.js y alma-client.js; nombres repetidos en Apps Script; `uf_`; «va»; «se lo paso a Claudio»; presupuesto y JSON del prompt; una roca; 80 reglas más con su prueba de dobles | ✅ ya estaban | `estandares.yml`, `revisar-apps-script.yml` |
| Cada función que Juan usa se ve en su página | 🤖 nuevo | `docs/mapa-funciones.json` + bots |
| Nada se sale en 375 px, botones tapados o chicos, errores de JavaScript, XSS | 🤖 ya estaba | `pruebas/bots.mjs` |
| Correr `revisar-local.js` antes de subir | ◇ | hook de `git push` |
| Herramientas de la voz publicadas solas tras un cambio (antes «voz_sync a mano») | ◇ | `vozHerramientasSiCambiaron_` |
| Unir = publicar en alma@ | ◇ ✅ | «Traslado a Workspace» + `unir-orden.js` |
| Pedidos a Alma desde una sesión de Claude | ◇ ✅ | issue `para-alma` + `paraalma.js` |
| Prompts entre agentes en JSON | ✅ (Alma) · ✎ (Claude a subagentes) | `prompts-json.js` |
| Español en commits y PR; respuestas a Juan con «Acciones»; volver a mostrar las opciones al pedir una decisión | ✎ | idioma y tono: una máquina no lo mide sin falsos rojos |
| Preguntar antes lo que es niebla; prototipos A · B · C; spec antes de lo grande | ✎ | decisiones de Juan |
| Squash con expectedHeadSha de 40 | ✎ | uso de la herramienta al unir |
| No tocar end_call, protecciones, LLM ni voz de ElevenLabs sin una llamada real | ✅ en parte + ✎ | `voz-proteccion.js`, `despedida-unica.js` |
| Llamada nunca espera `LockService` · números por `normTel_` · celdas por `celdaTexto_` · elemento por id y no por clase · colores del `ds/` · movimiento con sentido | ✎ hoy · candidatas a ✅ | siguiente ronda: cada una necesita su regla sin falsos rojos |
| Lo que dice Alma (no anunciar, una confirmación, frase de espera, volumen parejo) | ✎ en el prompt · ver la propuesta de abajo | `playbooks/alma.json` |

## Copias viejas que se anotaron en vez de limpiarlas

Las reglas nuevas miran solo lo que agrega cada PR. Lo que ya existía se limpió (19 comentarios, un correo personal y tres
números de ejemplo) salvo esto, que cambia cómo funciona algo y va en su propio PR:

- **Números reales del negocio en el código** (`apps-script/Código.js`: `WHATSAPP_NOCTURNO`, `WHATSAPP_RESPALDO`, el
  contacto del pie de los correos y `ESC_DEF_`; `index.html`, los valores por defecto del escalamiento). Moverlos a las
  Propiedades del script sin cargarlas antes deja sin aviso las emergencias de la noche. Camino: Juan las carga en
  Ajustes → Llaves y un PR corto las lee de ahí.
- **«Eres Alma» escrito a mano** en 5 prompts (`PROMPT_REDACTOR` de Código.js, `contacto.js`, `decisiones.js`,
  `familia.js`, `rutinahora.js`; `voz.js` solo lo quita con un replace). Cambiarlos cambia lo que oyen huéspedes y
  familia: va con la compuerta de calidad (mismos casos antes y después).
- **27 fechas con `toLocale…String` y opciones en `index.html`**. `fechaFmt` da el mismo texto con fecha y hora, pero
  `toLocaleString` sin horas en las opciones no: se cambian en un PR con capturas antes y después.

## Propuesta para el prompt de voz de Alma (no se cambió nada)

Hoy: 42 798 de 42 800 caracteres. Reglas del prompt que pueden vivir en código, medidas sobre el prompt armado:

| # | Regla del prompt | Pasa a | Caracteres hoy | Se liberan |
|---|---|---|---|---|
| A1 | «NUNCA lookup_reservation NI hospitable_router con el equipo» y «el equipo no son huéspedes» | guarda en las dos herramientas: con quien llama del equipo responden «ya identificado, usa secretaria» | 544 | ~480 |
| A2 | Identificar por la ficha antes de lookup_reservation | el Hub resuelve quién llama antes de la llamada (la ficha ya lo trae) y lookup_reservation responde igual si se llama de más | 576 | ~450 |
| A3 | «Si secretaria devuelve ok:false … NO se hizo» | secretaria responde con `decir` («No pude: …»), como `prometer.js` | 220 | 220 |
| A4–A6 | No mandar en primer y segundo plano · si falla, a segundo plano · un pedido una sola vez | guarda en secretaria: el pedido repetido ya se une solo (un pedido, un microproyecto); falta que al fallar pase sola a segundo plano | 235 | 235 |
| A7 | Fechas y montos dichos como persona | las herramientas devuelven `decir` con números para voz | 237 | ~200 |
| A8 | Etiquetas de voz solo [warm] | `suggested_audio_tags` del agente solo con [warm] (cambio de ElevenLabs: necesita una llamada real antes) | 315 | ~250 |
| A9 | Códigos de acceso (repetido en 3 bloques) | property_info entrega el código solo si la reserva está validada y ya salió, con su frase lista | 1 643 | ~1 490 |
| A10 | Comparar hoy con check-in y check-out | lookup_reservation devuelve `momento` (antes de llegar, en estadía, ya salió) con su frase | 465 | ~385 |
| A11 | Sin reserva validada no hay apartamento, WiFi ni códigos | property_info ya lo exige (solo responde con el código de una reserva vigente): la línea sobra | 124 | 124 |
| A12 | Nombres y números solo los que da secretaria | secretaria ya los manda en `decir` | 460 | ~310 |
| B1 | Música, mostrar en el chat, manos de Alma, atajos de iOS (solo en la app) | van en la ficha de quien llama solo cuando la llamada es desde la app o el navegador | 1 692 | ~1 690 |
| B2 | Mejoras del sistema, derivar a Claudio, avísame cuando (solo el principal) | van en la ficha solo cuando llama Juan | 1 724 | ~1 720 |
| C | La lista de herramientas repite la descripción que cada herramienta ya tiene en ElevenLabs | dejar solo la cabecera «en silencio, nunca se dicen sus nombres» | 2 308 | ~2 000 |

Total: **~9 500 caracteres** (A: ~4 150 con guardas en el Hub y las herramientas; B: ~3 400 llevando a la ficha lo que solo
aplica a una audiencia o un dispositivo; C: ~2 000 quitando lo duplicado). Orden sugerido: A11 y A3 (ya están en el código, solo se
borra la línea), luego A4–A6, luego A9 y A1, luego B. A8 toca ElevenLabs: solo con una llamada real de prueba.
