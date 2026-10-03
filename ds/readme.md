# Spacio AM — Design System v2

Marca boutique de hospitalidad de estancia corta y diseño de interiores editorial, de Guatemala.
Este design system es el **punto de partida único** de los tres productos digitales que habían divergido:
el **Dashboard de Propietarios**, la **EPI App** (operación en campo) y la **Guest App** (huésped).

> “Hay espacios donde despertar se siente como un sueño.”

**El nombre es siempre “Spacio AM”. Nunca “Espacio AM”.**

---

## Los productos

| Producto | Quién lo usa | Qué hace | Repo fuente |
|---|---|---|---|
| **Dashboard de Propietarios** ("mi spacioam") | Socios propietarios | Reportes financieros y de ocupación por propiedad y por mes: ingreso bruto/neto, comisión, ADR, estadías, facturación. | https://github.com/jforce15-coder/mi-spacioam |
| **EPI App** | Equipo de operación y supervisión | Agenda de trabajos (limpiezas, mantenimiento, supervisión, daños), calendario, adelantos de pago, reportes, correos transaccionales. | https://github.com/jforce15-coder/Epi-spacioam |
| **Guest App** ("hola spacioam") | Huéspedes | Bento de inicio, check-in con captura de documento, guía de la casa, Wi-Fi, recomendaciones, facturación. | https://github.com/jforce15-coder/Hola-spacioam |

**El cuarto repo, `Spacio-am`, no es un producto: es el design system v1** — la base sobre la que se construyó este v2.
Aporta la fuente única de tokens (`tokens.json`), el inventario de 13 componentes (`componentes.md`), los 8 patrones
ganadores (`patrones.md`), la auditoría de divergencias (`migracion.md`), las fuentes Valky y los assets de marca:
https://github.com/jforce15-coder/Spacio-am

---

## Cómo se decidió este sistema

Este v2 no se diseñó de cero: es el cierre de un proceso de tres fases documentado en `decisiones/`, hecho para
unificar tres apps que habían divergido. **Si vas a cambiar un valor de este sistema, lee primero esos documentos** —
casi todo lo que parece arbitrario tiene un cálculo de contraste detrás.

| Documento | Qué resuelve |
|---|---|
| `decisiones/fase1-tokens.md` | Las 10 decisiones de fundamentos: nomenclatura semántica por rol, fuente única, escala de estados, AA, píldora 999, inputs de caja, stack serif, íconos 1.5, breakpoints, capa de dominio. |
| `decisiones/fase2-blueprint.md` | Qué pieza ganadora aporta cada app y la resolución de los 5 choques (cards vs tabla, formularios, navegación, brushstroke, faroles). |
| `decisiones/fase3-construccion.md` | **Los valores nuevos derivados y verificados**: graphite `#6F6867`, la escala de faroles, la escala de radios y los 9 badges de dominio — cada uno con su ratio de contraste. *(Dos cosas de este documento cambiaron después por decisión de marca: se descartó `--peach-deep` y la paleta de dataviz pasó de categórica a jerárquica — ver "Color" abajo.)* |

**La métrica de "correcto" del proyecto:** ningún color de texto se eligió a ojo. Cada gris, estado y badge se calculó
con la fórmula WCAG 2.1 y se ajustó su luminosidad hasta pasar AA (≥4.5). Los 6 hex de marca del Dashboard se conservan
intactos como swatches; la accesibilidad se resolvió **agregando** tokens, nunca alterando la marca.

### Fuentes que se usaron para construir este sistema
- **https://github.com/jforce15-coder/Spacio-am** — **el design system v1, la base de este v2**: `tokens.json` (fuente única), `tokens.css`, `colors_and_type.css`, `componentes.md` (inventario de 13 componentes), `patrones.md` (8 patrones), `migracion.md` (auditoría de divergencias), `fonts/`, `assets/`.
- **https://github.com/jforce15-coder/mi-spacioam** — `ui.jsx`, `dashboard.jsx`, `login.jsx`, `spacio-tokens.css`, `charts.jsx`.
- **https://github.com/jforce15-coder/Hola-spacioam** — `app/primitives.jsx` (Brush3D, WeaveHero, Btn, Field, Steps, DocUploader), `assets/brand`, `assets/photos`.
- **https://github.com/jforce15-coder/Epi-spacioam** — `index.html`, `emails/email-system.js`, `email-assets/`.

**Explora esos repositorios** si tienes acceso: contienen el código real de las tres apps y son la mejor forma de
afinar cualquier diseño nuevo contra el producto que ya existe. Nada de lo que hay aquí sustituye leer la fuente.

> ⚠️ **Límite conocido:** el código de pantallas de la EPI App vive en un único `app.js` de ~720 KB que excede el
> límite de lectura del importador. El UI kit de EPI se construyó desde su `index.html` real + la documentación de
> auditoría (`componentes.md`, `patrones.md`, `domainBadges` de `tokens.json`), no desde una lectura línea por línea.

---

## Principios

**Calidez editorial, no dashboard frío.** Tonos tierra neutros, mucho espacio en blanco, jerarquía clara. Estética mediterránea/nórdica: serena, cálida, con aire.

**Mobile-first, siempre.** Las tres apps se usan mucho desde el teléfono. Cards por defecto; la tabla-resumen es un lujo de escritorio que colapsa a cards bajo `--bp-md`.

**Accesible de fábrica.** Todo el texto pasa WCAG AA. El gris de captions se oscureció a graphite y el peach dejó de usarse como texto. La calidez vive en fondos y swatches; la legibilidad manda en el texto.

**Una imagen, un gesto.** Toda imagen destacada lleva el brushstroke. Es la firma visual de la marca.

**Nadie escribe un color, radio o tamaño a mano.** Todo sale de un token, y el token se llama por lo que **hace** (`--fg-muted`), no por lo que **es** (`--color-earth`).

---

## VISUAL FOUNDATIONS

### Color
Nueve colores de marca, y la regla no es *qué* color sino *dónde* se permite.

| Rol | Token | Valor | Sí | No |
|---|---|---|---|---|
| Texto primario | `--fg` (ink) | `#3E3F3F` | titulares, cuerpo (10.1:1) | — |
| Texto secundario | `--fg-muted` (graphite) | `#6F6867` | captions, meta, helpers, eyebrows (5.2:1) | — |
| Swatch de marca | `--fg-subtle` (earth) | `#938B8A` | texto ≥18px, decorativo | texto pequeño (3.19:1) |
| Fondo primario | `--bg` (alabaster) | `#FAFAFA` | toda pantalla | — |
| Fondo secundario | `--bg-alt` (beige) | `#F5F3F0` | bloques, brushstroke, segmented | — |
| Superficie | `--surface` (white) | `#FFFFFF` | cards, modales | — |
| Divisores | `--divider` (warm-grey) | `#D8D4CE` | líneas, bordes | como texto |
| Acento gráfico | `--accent` (peach) | `#E9826A` | puntos, filetes, bordes, tintes, rellenos de gráfica, el FAB, "hoy" del calendario | **texto de cualquier tamaño, y cualquier relleno que lleve texto encima** |
| Acento vivo | `--accent-neon` (peach-neon) | `#F2755A` | serie protagonista de una gráfica, glow, highlight | igual que el peach: nunca texto |
| CTA cálido | `--accent-tint` + borde `--accent` | peach 12% | botón de acento con texto ink | — |

**Sobre el peach y el texto — la regla que más se rompe.** El peach es un color de marca precioso y **no sirve para texto**:
blanco encima da 2.56:1 e ink encima 3.96:1; los dos fallan AA. La solución del sistema no es oscurecer el peach hasta que
deje de parecer peach — es **no ponerle texto**. El peach vive en puntos, filetes, tintes, áreas de gráfica y el FAB
(con ícono, no etiqueta). Cuando necesitas un CTA cálido, usa tinte peach con borde peach y texto ink. Cuando necesitas
una acción sólida, usa ink. *(Esto reemplaza el `--peach-deep #C83E1E` de la Fase 3: se descartó por decisión de marca —
el tono oscurecido perdía la calidez del peach.)*

**Estados** (escala única en las 3 apps): success `#3d6b52`, **attention `#F2755A` / texto `#B54D36`**, warning `#9a5020`, error `#C0392B`, info `#3B6691`, pending `#6F6867`, cada uno con su tinte. Sin azul frío en ninguna parte: el "info" es azul pizarra apagado.

### Peach o rojo — la decisión que más importa

El peach **no es error, pero sí es atención**. Es la distinción que gobierna toda la escala:

| | **Atención — peach** | **Excepción — rojo** |
|---|---|---|
| Qué dice | "Esto merece tu mirada" | "Esto exige que hagas algo" |
| Ejemplos | Falta el depósito · falta la constancia · el mes bajó 19% · cancelación administrativa · descuento de adelanto · el dato que destaca | Vencido · daño reportado · adelanto rechazado · validación fallida · acción destructiva |
| Tokens | `--attention` (gráfico) · `--attention-text` (texto, 4.93:1) · `--attention-tint` | `--color-error` · `--color-error-tint` |

**Un mes a la baja no es una falla.** Por eso `Trend` pinta el deterioro en peach y no en rojo — y solo sube a rojo
con `critical`, cuando la caída sí exige acción. Lo mismo aplica a faroles, alertas y montos negativos.
**En duda: peach.** El rojo pierde fuerza si se usa para todo; reservarlo es lo que lo hace funcionar.

*(Revisión posterior a la Fase 3: el error pasó de `#8a3030` a `#C0392B`. El corinto original medía 7.90:1 — mucho más oscuro que el resto de la escala (5.1–5.9), y se leía como marrón vinoso al lado de los demás estados. El ladrillo cálido queda en 5.20:1, alineado con la escala y coherente con la temperatura de la marca. En la misma revisión se agregó el rol **atención**, tomado del uso real del Dashboard de Propietarios, donde las variaciones negativas ya se mostraban en peach.)*

*(Sobre el peach en texto: `#F2755A` mide 2.69:1 y no puede cargar texto. Por eso el rol de atención tiene dos tokens — el neón para lo gráfico (flecha, punto, área, filete) y `#B54D36` (4.93:1) para el numeral o la etiqueta. El chip de variación combina ambos: flecha en neón, número en el tono legible. Se lee peach de un vistazo sin romper AA.)*

**Dataviz — el peach es jerarquía, no categoría.** Una gráfica lleva **una sola** serie en peach: la que importa.
La serie de referencia va en ink y el resto en neutros cálidos (graphite, earth, taupe, warm-grey). Líneas de **curva suave**
con área degradada, tooltip al pasar el cursor, y la barra del mes en curso en peach. Si todo es peach, el peach no dice nada.

**Capa de dominio (solo EPI):** 9 categorías de trabajo con su par bg/fg, todas AA ≥4.5. Viven en `tokens/domain.css`, no en el core.

### Tipografía
**Valky** (serif, self-hosted, 4 caras) para titulares y prosa editorial — **nunca para números**.
**Montserrat** para cuerpo, UI y **siempre** números, con tracking `0.14em` (esto es lo que le da el aire editorial).
**Cormorant Garamond** es el fallback visible de Valky, cargado en todas las apps. Playfair quedó fuera.

Escala con `clamp()`: display `clamp(56,9vw,144)` → h1 → h2 → h3 → h4 18 → body 15 → small 12 → eyebrow 11.
Tracking: display `−0.01em`, cuerpo `0.14em`, eyebrow `0.32em` en mayúsculas. Line-height 1.02 / 1.12 / 1.7.
Los números en `.t-num` (tabular). Única excepción documentada: el número hero display puede ir en serif por impacto.

### Espaciado y layout
Base 8: 4 · 8 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192. Nada de px sueltos.
Contenedores: `--container-narrow` 640, `--container-standard` 1080. Breakpoints 480 / 780 / 1080.
El chrome superior es lo único fijo (sticky con blur); todo lo demás fluye. Mucho aire vertical entre secciones (`--s-8`).

### Forma
Botones y badges = **píldora** (999). Inputs y cards = **14** (el radio de facto). Cards grandes y modales = **28**.
Celdas y chips = 10. Contenedores hero = 40. Media superior de card = `28px 28px 0 0`.

### Sombras y bordes
Cuatro niveles, todos con tinte ink y muy suaves: `xs` 0 1px 2px/.04 · `sm` 0 4px 16px/.05 (card en reposo) ·
`md` 0 12px 40px/.07 (hover, paneles flotantes) · `lg` 0 28px 80px/.10 (modal).
Bordes: `1px solid warm-grey` para separar, `1px solid ink-08` cuando el borde solo insinúa.
**Nunca sombra en tipografía. Nunca degradados decorativos** — el único degradado permitido es el de protección
sobre foto (`transparent 45% → rgba(62,63,63,.55)`), para que el texto blanco pase contraste.

### Transparencia y blur
Solo en chrome: la barra superior (`rgba(250,250,250,.88)` + `blur(20px) saturate(120%)`), la nav píldora
editorial (`.72` + mismo blur) y el overlay de modal (`rgba(62,63,63,.55)` + `blur(4px)`). En ningún otro lugar.

### Movimiento
Un solo easing: `cubic-bezier(0.22, 0.61, 0.36, 1)`. Tres duraciones: 180ms (hover, focus, toggles),
360ms (colapsables, modales, cards), 720ms (transiciones de pantalla).
Fades y desplazamientos cortos (`sa-fade` −4px, `sa-rise` +12px). **Nunca bounce, nunca spring** — con una excepción:
el **loader canónico**, donde el logo rebota (`sa-bounce`) sobre una sombra elíptica que se encoge (`sa-shadow`).
**Sin anillo giratorio**: un spinner es vocabulario de dashboard genérico y no pertenece a esta marca.
Todo respeta `prefers-reduced-motion`.

### Estados de interacción
- **Hover:** cards suben 3px y pasan a `--shadow-md`; botones se oscurecen un pelo (brightness .94) y ganan `--shadow-sm`; links bajan a opacidad .6; filas de tabla se tiñen de `--bg-alt`.
- **Press:** `scale(0.98)`. Sin cambio de color.
- **Focus:** siempre visible — `--focus-ring` (halo peach 35%) + borde `--fg`.
- **Disabled:** fondo `--divider`, texto `--fg-subtle`, sin sombra, `cursor: not-allowed`.
- **Loading:** spinner que reemplaza la etiqueta (ancho fijo) o skeleton en `--bg-alt`. Nunca un control vacío sin feedback.
- **Empty:** mensaje centrado en `--fg-muted` + acción opcional.

### Imagen
Luz natural cálida, interiores habitados, materiales (madera, barro, textil), cero saturación fría, sin grano artificial fuerte
(la Guest App usa un grano SVG al 3.5% como textura ambiental, nada más). Encuadres con aire.
**Toda imagen destacada de ~160px o más lleva brushstroke**: el ribbon pasa por detrás y reemerge por delante con sombra.
Miniaturas, avatares e íconos de foto quedan exentos.

---

## CONTENT FUNDAMENTALS

**Idioma:** español de Guatemala primero, inglés como segundo idioma real (las apps traen selector ES/EN). Nunca spanglish.

**Persona:** hablamos de **tú**, no de usted. La marca dice **nosotros** ("te avisamos", "cerramos agosto con…").
Al huésped se le habla por su nombre; al propietario también.

**Tono:** cálido y preciso, nunca corporativo ni cursi. Frases cortas. El dato va primero y el contexto susurra después.
Ejemplos reales del sistema:
- *"Tu agosto, en una página."*
- *"Tus propiedades, tu mes y tus números — en una sola página."*
- *"Bienvenida, Sofía. Todo está listo para que solo llegues."*
- *"Se descuenta del cierre del mes. Te avisamos por correo cuando quede autorizado."*
- *"Un espacio que se cuida se disfruta más."*
- *"Menos noches, mejor pagadas."*

**Casing:** títulos en *sentence case* (no Title Case). Solo los eyebrow, los H4 y las etiquetas de botón van en
MAYÚSCULAS, siempre con tracking ancho. Los labels de campo van en eyebrow.

**Errores:** decimos qué pasó y qué hacer, sin culpar. *"Datos incorrectos. Revisa e intenta de nuevo."*
*"Cuéntanos para qué es el adelanto."* Nunca "Error 401" ni un signo de admiración.

**Números:** siempre con su unidad y su moneda visible (`Q 48,320`, `87%`, `+12.4%`). Moneda en GTQ y USD según el
selector global. Fechas en español corto (`14 ago 2026`).

**Sin emoji. Nunca.** Los acentos visuales son el sparkle, el punto peach y el brushstroke.

---

## ICONOGRAPHY

- **Set de UI:** Lucide curado, **inline** (sin CDN en runtime), grosor único **1.5** y tamaños **20 / 24**. En `components/brand/Icon.jsx` viven ~48 glifos copiados del set inline real de las apps (v1 mezclaba 1 / 1.25 / 1.4 / 1.6 / 2.5; v2 unifica en 1.5). Usa `<Icon name="…" />` — **nunca dibujes un SVG nuevo a mano**.
- **Glifos de marca:** `assets/glyphs/` trae los glifos ilustrados propios de Spacio AM (`Spacioam-check`, `-heart`, `-doc`, `-art`, `-exp`, `-Cart`, `-mas`, `SPARKLE.png`) más `assets/star.svg`. Son ilustrativos, para tiles y piezas editoriales; no sustituyen al set de UI.
- **Sparkle:** el sigilo de 4 puntas es el único "icono" que puede ir en peach. Máximo uno por bloque.
- **Logo:** PNG/SVG oficiales en `assets/` y `assets/brand/` (wordmark, sello, monograma; versión transparente y blanca). El logo nunca se recompone con tipografía ni se tiñe de peach.
- **Emoji:** no se usan. **Unicode como ícono:** tampoco, salvo el · como separador y las flechas tipográficas en enlaces (`Instagram →`).

---

## Índice del repositorio

### Raíz
| Archivo | Qué es |
|---|---|
| `styles.css` | **Punto de entrada único.** Solo `@import`s. Enlázalo y tienes todo. |
| `readme.md` | Este documento: contexto, fundamentos visuales, contenido, iconografía, índice. |
| `decisiones/` | Las tres fases de decisiones que produjeron este sistema (fundamentos, blueprint, valores derivados con sus contrastes). |
| `SKILL.md` | Envoltura de Agent Skill para usar este sistema desde Claude Code. |
| `github.md` | Asociación con los repos fuente y registro de sincronización. |
| `thumbnail.html` | Tile de marca del sistema. |
| `tokens/` | `fonts` · `colors` · `typography` · `spacing` · `radius-shadow` · `motion` · `domain` · `base` |
| `fonts/` | Valky Light / Regular / Semibold / Bold (OTF, self-hosted). |
| `assets/` | Logos (SVG/JPEG/PNG), `brushstroke.svg`, `star.svg`, `glyphs/`, `photos/`, `brand/`, fotografía lifestyle y merch. |
| `guidelines/` | 21 tarjetas specimen de fundamentos (Colors, Type, Spacing, Brand). |

### Components
Agrupados por concern. Cada carpeta trae `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md` y una tarjeta `@dsCard`.

**`components/brand/`** — `Icon` (+`ICON_PATHS`), `Wordmark`, `Sparkle`, `Brushstroke`
**`components/core/`** — `Button`, `Card`, `CardMedia`, `PropertyCard`, `JobCard`, `Farol`, `DomainBadge` (+`DOMAIN_CATEGORIES`), `Amount`, `Eyebrow`, `SectionHead`
**`components/forms/`** — `Input`, `Select`, `Toggle`, `Checkbox`
**`components/feedback/`** — `Modal`, `LoadingScreen`, `Skeleton`
**`components/navigation/`** — `TopBar`, `PillNav`, `TabNav`, `PillTabs`, `BottomNav`, `Segmented`, `Collapsible`, `Bento`, `BentoTile`
**`components/data/`** — `KpiCard`, `Trend`, `SummaryTable`, `LineChart`, `Gauge`, `BarChart`, `Donut`, `Calendar`
**`components/email/`** — `EmailLayout` (+`EMAIL_HEX`)

Los 13 componentes del inventario original (`componentes.md`) están todos cubiertos: botón, card, tabla-resumen,
input/formularios, modal, calendario, colapsable, farol, badge de dominio, navegación + bento, gráficas,
pantalla de carga y email.

**Añadidos desde las apps en producción** (capturas de `epi.spacioam.com`, `mi.spacioam.com` y `hola.spacioam.com` revisadas con el equipo): `TabNav` (tabs con subrayado peach del Dashboard), `PillTabs` (los 5 tabs de EPI), `BottomNav` (barra móvil con FAB peach en EPI; píldora flotante con blur en el Dashboard), `JobCard` (fila de trabajo con filete de estado, que es la forma obligatoria en teléfono), `Amount` (montos con decimales atenuados, presentes en las tres apps) y `Donut` ("¿A dónde fue el dinero?").

> **Nota de responsive:** `mi.spacioam.com` está desbordando en teléfono. La causa que se ve en las capturas es grid de KPIs y tablas que no colapsan bajo `--bp-md`. Los kits de este sistema traen la regla ya aplicada — `grid-template-columns: 1fr` bajo 780px, `overflow-x: hidden` en el contenedor, `max-width: 100%` en `img/svg/table`, y navegación inferior en lugar de tabs horizontales. Esa es la referencia para el arreglo.

**Adiciones intencionales** (no estaban como "componente" en el inventario, pero sí como patrón o pieza real del código):
`Icon` (envoltorio del set de glifos, para que nadie dibuje SVGs), `Wordmark`/`Sparkle`/`Brushstroke` (marca y firma visual
que vivían en `primitives.jsx`), `Eyebrow`/`SectionHead` (ritmo editorial repetido en las 3 apps), `KpiCard`/`Trend`
(patrón 8, "resúmenes numéricos"), `Segmented` (el "display de filtros" del patrón 5), `PropertyCard` (card de imagen
del catálogo), `Skeleton` (el estado `loading` que el inventario exige en casi todos los componentes).

### UI kits
| Carpeta | Producto |
|---|---|
| `ui_kits/owner-dashboard/` | Dashboard de Propietarios — login, hero, KPIs, financiero, ocupación, tabla-resumen |
| `ui_kits/epi-app/` | EPI App — agenda con faroles y badges de dominio, modal de trabajo, adelantos |
| `ui_kits/guest-app/` | Guest App — bento de inicio, check-in por pasos con OCR, guía de la casa |

### Templates
| Carpeta | Template |
|---|---|
| \`templates/owner-report/\` | **Reporte de propietario** — página editorial de cierre de mes (hero con brushstroke, KPIs, gráfica, tabla-resumen). Punto de partida para proyectos que consumen este sistema; edita la línea \`base\` de \`ds-base.js\` y funciona en cualquier carpeta. |

### Patrones de layout
Los 8 patrones ganadores viven en la documentación de origen y se aplican en los UI kits:
bento de inicio · cards vs tabla (regla de densidad) · faroles · áreas colapsables · filtros globales ·
brushstroke · sincronización automática con opción manual · KPIs editoriales.
