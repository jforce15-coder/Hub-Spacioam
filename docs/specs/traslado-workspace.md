# Traslado a Workspace (issue #546)

Decidido por Juan el 16-nov-2026: pasar los Apps Script a una cuenta de Google Workspace para tener más cupo de Google.

## Problema
El cupo de Google (llamadas a internet, UrlFetch) es de **20 000 al día** en una cuenta Gmail y lo comparten los 7 Apps
Script de la cuenta: Hub/ALMA, el login, Hola, Epi, Grow, Docs y Mi (`apps-script/cupo.js`). Cuando se acaba, Alma pausa lo
de fondo y, en el peor caso, el día se corta. Google no vende más cupo para Gmail; una cuenta Workspace tiene **100 000**.

## Solución
Crear una cuenta Workspace del dominio spacioam.com (por ejemplo `alma@spacioam.com`, plan Business Starter, unos 7–8 USD
al mes) y que **esa cuenta sea la dueña de los Apps Script**. Lo demás se queda donde está:

- **Las hojas y carpetas no se mueven.** Los scripts las abren por su id (`openById`), así que basta con compartirlas
  (editor) con la cuenta nueva. Nada de copiar datos.
- **Un script a la vez**, empezando por uno chico (piloto) y siguiendo por el Hub, que es el que más gasta. Mientras dura,
  cada cuenta tiene su propio cupo: lo que ya se pasó deja de gastar el de Gmail.
- **Cada script nuevo tiene otra dirección /exec.** Hay que cambiarla en las páginas, en el login de cada app, en las
  herramientas de ElevenLabs y en los avisos que mandan otros servicios (webhooks). El script viejo se deja vivo 7 días
  por si algo quedó apuntando a él, y luego se apaga.

## Lo que hay hoy (revisado en el código)
| Script | Repo | Activadores en el código | Usa Gmail | Dirección /exec en |
|---|---|---|---|---|
| Hub / ALMA | hub-spacioam (`apps-script/`) | 9 | sí (leer correos, viajes, conferencias) | páginas del Hub, ElevenLabs, webhooks, las otras apps |
| Login | hub-spacioam (`login/`, `login-apps-script.yml`) | — | — | `sa-auth-client.js` de cada app |
| Hola | hola-spacioam | 8 | sí | `config.js`, `app/data.jsx` |
| Epi | epi-spacioam | 0 | sí | `app.jsx` |
| Grow | grow-spacioam | 0 | sí | `index.html` |
| Docs | docs-spacioam | 1 | sí | `sheets-sync.js`, `esign.jsx`, `admin.jsx` |
| Mi | mi-spacioam | 1 | sí | `sheets.js`, `04-cliente-frontend.js` |

Cada repo publica su script al unir con `clasp` (`.clasp.json` → `scriptId`; `apps-script.yml` → `DEPLOYMENT_ID`; secreto
`CLASPRC_JSON`). Al cambiar de cuenta cambian los tres.

## Historias de usuario
1. Como administrador, tengo una cuenta Workspace dueña de los scripts, con 100 000 llamadas al día de cupo.
2. Como administrador, no pierdo ningún dato: las hojas siguen siendo las mismas.
3. Como administrador, los huéspedes, el equipo y los asociados no notan el cambio: misma app, misma entrada, mismo WhatsApp.
4. Como administrador, veo en «Uso» el nuevo límite (100 000) y cuánto gasta cada app.
5. Como administrador, si un traslado sale mal, se vuelve al script viejo cambiando una sola dirección.

## Tickets (rebanadas que se prueban solas)
**T0 · Juan, a mano (15 min).** Crear la cuenta Workspace en admin.google.com con el dominio spacioam.com y comprobar el
dominio. Abrir script.google.com con la cuenta nueva una vez y activar «API de Google Apps Script» en
script.google.com/home/usersettings.

**T1 · Inventario sin tocar nada.** Una acción del robot del Hub («inventario_ws», solo lectura) que lista, por script: nombres de
las Propiedades del script (sin valores), activadores vivos y hojas/carpetas que abre. Sale la lista exacta de qué compartir
y qué copiar (`docs/specs/traslado-workspace-inventario.md`). Prueba: el inventario tiene las 7 filas.

**T2 · Compartir.** Compartir como editor con la cuenta nueva cada hoja y carpeta del inventario (Juan con un clic por
carpeta, o un script que lo haga). Prueba: con la cuenta nueva se abren todas.

**T3 · Piloto: Docs.** Con el **Mudador** (abajo), sin clasp ni computadora: crear el script en la cuenta nueva, traer sus
Propiedades, crear el activador (`instalar`) y, ya probado, cambiar las direcciones /exec del front. Prueba: firmar un
documento de prueba en docs.spacioam.com.

**T4 · Hub / ALMA + login.** Igual que T3, más: herramientas de ElevenLabs, webhooks (WhatsApp, Hospitable y los que salgan
en T1), `CUPO_DIA = 100000` y cambiar la dirección del Hub en las otras apps. Se hace de noche, con poco movimiento.
Prueba: llamada de voz, chat, un WhatsApp de prueba y entrar a cada app.

**T5 · Hola, Epi, Grow y Mi.** Uno por uno, igual que T3. Prueba: la acción principal de cada app.

**T6 · Cerrar.** A los 7 días, apagar activadores y publicaciones de los scripts viejos y quitar el aviso de «Gmail» del
glosario y de `cupo.js`.

## Niebla (lo que falta decidir)
- **El correo (tinta, Juan 16-nov-2026).** El correo de spacioam.com se queda en cPanel: la cuenta nueva no usa Gmail de
  Google y no se reenvía nada. Los scripts siguen leyendo el **Gmail personal de Juan** (correos de reservas, vuelos,
  conferencias) con un **permiso aparte** (opción b): una llave de acceso a ese Gmail guardada en las Propiedades del script,
  nunca en el código ni en el chat. Se arma en T4, antes de mover el Hub; mientras tanto el Hub sigue en la cuenta Gmail.
- **Desde qué dirección salen los correos** que mandan las apps (códigos de entrada, avisos): pasarían a salir de la cuenta
  nueva (`…@spacioam.com`). Se ve más profesional; solo hay que avisarle a quien filtre por remitente.

## El Mudador (17-nov-2026): mudar sin computadora
Juan solo usa iPad, así que `clasp` (que necesita una computadora para iniciar sesión) no sirve para la cuenta nueva. En su
lugar hay un Apps Script chico, el **Mudador** (`traslado/Mudador.js` + `traslado/appsscript.json`), que Juan crea una sola vez
en alma@ pegando dos textos. Corre como alma@ y usa la **API de Apps Script** con su propio permiso
(`ScriptApp.getOAuthToken()`): `projects.create`, `projects.updateContent`, `projects.versions.create`,
`projects.deployments.create/update`.

**Cómo se usa (Claude):** el workflow **Traslado a Workspace** (`.github/workflows/traslado.yml`, a mano) toma el código de la
app (`traslado/proyectos.json` dice repo, carpeta y script viejo), lo manda al Mudador con la llave (secretos `MUDADOR_URL`
y `MUDADOR_LLAVE`) y el Mudador crea el proyecto si falta (`crear`, la primera vez), sube el código, crea versión y crea o
actualiza su app web. Es idempotente: guarda el `scriptId` y la implementación de cada app; el mismo commit dos veces no gasta
versiones. `proyecto = estado` muestra qué hay; `proyecto = mudador` sube un Mudador nuevo sin que Juan vuelva a pegar.

**Las Propiedades del script** (llaves) nunca pasan por el chat, GitHub ni un registro:
1. El proyecto VIEJO tiene `apps-script/traslado.js` (copia de `traslado/entregar.js`): entrega sus Propiedades solo a quien
   pruebe ser **alma@spacioam.com** con un token de identidad de Google, que Google mismo revisa (correo verificado, sin
   vencer). La primera app que las pide (el Mudador) queda fijada; tope de 6 entregas al día.
2. Mientras no se hayan traído, el Mudador agrega al proyecto nuevo el archivo `traslado_traer` con una llave de **un solo
   uso** (vence en 48 h).
3. Juan corre `trasladoTraer` en el proyecto nuevo: da los permisos de todo el proyecto (una vez), el Mudador pide las
   Propiedades al viejo y se las pasa por HTTPS, y el nuevo guarda las que le faltan (nunca pisa una que ya tiene) y corre
   lo de instalar (`al_traer`, p. ej. el activador de Docs). La siguiente publicación quita `traslado_traer`.

**Pasos de Juan en el iPad (una sola vez):**
1. En Safari entra a **script.google.com** con alma@spacioam.com → **Proyecto nuevo**. Toca «Proyecto sin título» y ponle **Mudador**.
2. ⚙️ **Configuración del proyecto** → activa **«Mostrar el archivo de manifiesto appsscript.json en el editor»**.
3. Abre en otra pestaña <https://raw.githubusercontent.com/jforce15-coder/Hub-Spacioam/main/traslado/appsscript.json>,
   selecciona todo y copia. En el editor abre **appsscript.json**, borra todo, pega y guarda (💾).
4. Abre <https://raw.githubusercontent.com/jforce15-coder/Hub-Spacioam/main/traslado/Mudador.js>, copia todo. En **Código.gs**
   borra todo, pega y guarda.
5. Arriba elige la función **empezar** → **Ejecutar** → **Revisar permisos** → alma@ → (si sale «Google no verificó esta app»:
   **Configuración avanzada → Ir a Mudador**) → **Permitir**.
6. Abajo, en el **Registro de ejecución**, salen la URL y la llave. En GitHub: Hub-Spacioam → **Settings → Secrets and
   variables → Actions → New repository secret**: `MUDADOR_URL` con la URL, y otro `MUDADOR_LLAVE` con la llave.
7. Escríbele a Claude «Mudador listo». Claude crea Docs en alma@ y te manda un enlace.
8. Abre ese enlace, elige la función **trasladoTraer** → **Ejecutar** → **Permitir**. Cuando el registro diga «Listo», avísale a Claude.

Cada app siguiente (Hub, login, Hola, Epi, Grow, Mi) repite solo el paso 8, cuando Claude manda su enlace.

**Límites y riesgos conocidos**
- Google permite 200 versiones por proyecto (el Mudador avisa desde 180) y la API de Apps Script tiene cuotas diarias por
  cuenta para crear proyectos y subir código: de sobra para 7 apps y unas decenas de publicaciones al día.
- La app web del Mudador queda «cualquiera» con la llave: quien tenga la llave puede subir código que corre como alma@. Si
  se filtra: correr `nuevaLlave` y cambiar el secreto.
- El paso 6 es el único donde Juan ve la llave (en su propio registro de ejecución, solo visible para alma@).
- Si Workspace bloquea las apps web para «cualquiera», se activa en admin.google.com → Apps → Google Workspace → Drive y
  Documentos → Compartir fuera de la organización.

## Docs: cortado (17-nov-2026)
Docs corre en alma@ (`/exec` `AKfycbxcz_zj…`). `sheets-sync.js` y `404.html` apuntan ahí; si un navegador guardó la dirección
vieja a mano, se ignora. Los programados los manda solo el de alma@ (el viejo sale al instante: compara su id de proyecto).
Ya no se publica con clasp: el workflow **Traslado a Workspace** publica cada 10 min desde `main` lo que tenga
`"sincronizar": true` en `proyectos.json` (los otros repos no necesitan secretos). El viejo queda vivo 7 días de respaldo.
Volver atrás: revertir el PR de Docs (las dos direcciones) y el de los programados.

## Plan de corte del Hub (T4)
**Antes (ya en `main`):** el Hub viejo y el login tienen `traslado.js` (entregan sus Propiedades solo a alma@) y el Hub tiene
`trasladocorte.js`: tres acciones del robot (`traslado_activadores`, `traslado_apagar`, `traslado_encender`) para que el
corte no dependa del editor. El Hub nuevo se crea con el workflow (`proyecto = hub`, `crear = true`) **sin activadores**
(`al_traer` vacío): hasta el corte no atiende la cola. Copia **todas** las Propiedades salvo `CUPO_*` (la lista fija de antes
dejaba fuera llaves como `GITHUB_PRS`).

**Qué apunta al `/exec` del Hub y quién lo cambia**
| Qué | Dónde | Quién |
|---|---|---|
| Páginas de hub.spacioam.com: `js/alma-client.js` (sube `?v=`), `alma/*.html` (gasto, claudio, uso, biblioteca, avisos, aprendio, conexiones), `health/`, `anillo/`, `claude.html`, `404.html`, `design-system.html`, `js/sa-tutoriales.js` | este repo | código (un PR) |
| App de iPhone | carga las páginas de hub.spacioam.com | nada (sale con el PR de arriba) |
| `vigia-alma.yml`, `para-alma-aviso.yml`, el robot de Claude | este repo / las sesiones | código |
| `paraclaude.js` (`HUB_EXEC_DEF_`) | este repo | código |
| Hola (`HUB_ALMA_URL_`, `ALMA_URL`), Epi (`ALMA_URL`), The Gentle Stoic Parent (`HUB_URL_`) | sus repos | código: la constante nueva y, si la Propiedad guarda la dirección vieja, se ignora |
| ElevenLabs: 10 herramientas, el aviso de inicio y el webhook de fin de llamada | pasan por el Worker `alma-puente` | **Juan**: Cloudflare → Workers → alma-puente → la dirección del Hub (la del webhook directo viejo está apagada) |
| WhatsApp (Meta) | developers.facebook.com → la app → WhatsApp → Configuración → Webhook (URL de devolución, mismo token de verificación) | **Juan** |
| Hospitable | my.hospitable.com → Apps/Integraciones → Webhooks: la URL `…/exec?k=<WEBHOOK_KEY>` | **Juan** (la `k` sale del registro de la acción, nunca del chat) |
| `correo-puente` en el Gmail de Juan | script.google.com con jforce15 → proyecto del puente → `var HUB` | **Juan** (o regenerarlo en Conexiones) |
| `CUPO_DIA = 100000` | Propiedad del Hub nuevo | robot (`traslado_encender`) |

**Orden de la noche (con poco movimiento)**
1. Juan corre `trasladoTraer` en el Hub nuevo **justo antes** del corte (así el estado copiado está fresco).
2. Prueba de humo del nuevo, sin activadores: `{salud:1}` responde viva; robot `voz_estado` y `traslado_activadores`
   (`proyecto` = el id nuevo, sin activadores); una lectura del Hub con sesión desde hub.spacioam.com con la dirección nueva
   guardada a mano (`localStorage` de alma-client si existe) o con `curl`.
3. Corte en un solo paso: robot `traslado_apagar` en el **viejo** → `traslado_encender` con `cupo_dia: 100000` en el
   **nuevo** → se une el PR de direcciones (páginas, workflows, Hola, Epi, GSP) → Juan cambia el Worker, Meta y Hospitable.
4. Prueba: una llamada de voz corta, un chat, un WhatsApp de prueba y entrar a cada app.
5. Ese mismo PR pone `"sincronizar": true` al Hub y deja su `apps-script.yml` sin clasp.

**Volver atrás (un paso):** `traslado_apagar` en el nuevo, `traslado_encender` en el viejo, revertir el PR de direcciones y
Juan vuelve a poner la dirección vieja en el Worker, Meta y Hospitable. Lo que el nuevo guardó en Propiedades se pierde
(las hojas son las mismas).

## Hola primero (Juan, 18-nov-2026)
«Hola no tiene backup; si el Hub y todo se cae por el cupo, Hola no tenemos cómo resolverlo. Ese tiene que ser el primero.»
- **Lo de fondo** (sync con Hospitable, recordatorios, despedidas, avisos de early check-in, borrado de documentos): lo
  atiende un solo proyecto, el que diga la pestaña **TRASLADO** de la hoja de Hola (B1 = id del proyecto). Al correr
  `trasladoTraer` en el nuevo, `holaTomarActivadores` instala sus activadores y lo anota como dueño: desde ese momento lo de
  fondo corre en alma@ (con cupo) y el viejo sale sin hacer nada. Volver atrás: poner en B1 el id del viejo.
- **Sesión:** Hola ya comprueba la firma localmente con `LOGIN_SECRETO` (se copia al traer); sin cupo deja de insistir al login.
- **La dirección /exec** está en `config.js` y `404.html` de Hola, y en el Hub: `index.html` (`HOLA_URL`) y
  `apps-script/holaacceso.js` (`HOLA_URL_DEF_`, o la Propiedad `HOLA_URL` si existe). Se cambian en un PR por repo después
  de la prueba de humo; volver atrás = revertir esos PR.

## Epi (18-nov-2026)
Epi asigna las rutas de limpieza: **nunca** puede quedar un día sin rutas ni con rutas dobles.
- **Lo de fondo** (rutas de las 18:00, revisión 6:00, salidas contra Hospitable 7:00, sync cada 3 h, alerta 13:00,
  recordatorio 19:00, reseñas 4:00, lista de propiedades y datos del anuncio 3:00) lo corre un solo proyecto: el que diga la pestaña **TRASLADO** de Spacio AM DB (B1 = id).
  Solo se saltan las corridas de activador; lo que piden la app o el Hub por /exec corre siempre. Se lee en cada activador
  (sin caché) y, si la hoja no responde, corre. Epi `apps-script/trasladocorte.js`.
- Al correr `trasladoTraer` en el nuevo, `epiTomarActivadores` instala los 9 activadores (los vivos del viejo; los tres `cronCodigos*` ya no tienen función y no se pasan) y **solo si quedaron todos** se
  anota como dueño (si falta uno, borra los suyos y el viejo sigue).
- Robot de Epi `{action:"__traslado", token}`: id, dueño y activadores. Con `dueno:"yo"` ese proyecto vuelve a ser el dueño
  (solo si tiene sus activadores). **Volver atrás** = `__traslado` con `dueno:"yo"` al /exec viejo y revertir los PR de
  direcciones.
- La dirección /exec de Epi está en `app.jsx`/`app.build.js` de Epi y, en el Hub, en `apps-script/Código.js`
  (`EPI_API_URL`, `EPI_URL_DEF_` o la Propiedad `EPI_URL` si no guarda la vieja) e `index.html` (`EPI_URL`). Si Hospitable
  tiene un webhook al /exec de Epi (reseñas, reservas), **Juan** lo cambia en my.hospitable.com → Webhooks. Se cambian en PRs [NO UNIR] que se unen después de la prueba de humo.
