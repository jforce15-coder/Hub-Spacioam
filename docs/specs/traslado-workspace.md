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

**T1 · Inventario sin tocar nada.** Una acción del Hub (solo el administrador principal) que lista, por script: nombres de
las Propiedades del script (sin valores), activadores vivos y hojas/carpetas que abre. Sale la lista exacta de qué compartir
y qué copiar. Prueba: Juan la abre y ve las 7 filas.

**T2 · Compartir.** Compartir como editor con la cuenta nueva cada hoja y carpeta del inventario (Juan con un clic por
carpeta, o un script que lo haga). Prueba: con la cuenta nueva se abren todas.

**T3 · Piloto: Docs.** Crear el script en la cuenta nueva (`clasp create`), cambiar `scriptId` y `DEPLOYMENT_ID` en el repo,
nuevo `CLASPRC_JSON` (Juan lo pone en los secretos de GitHub), copiar Propiedades (Juan las pega; nunca por chat), crear el
activador, cambiar las direcciones /exec del front. Prueba: firmar un documento de prueba en docs.spacioam.com.

**T4 · Hub / ALMA + login.** Igual que T3, más: herramientas de ElevenLabs, webhooks (WhatsApp, Hospitable y los que salgan
en T1), `CUPO_DIA = 100000` y cambiar la dirección del Hub en las otras apps. Se hace de noche, con poco movimiento.
Prueba: llamada de voz, chat, un WhatsApp de prueba y entrar a cada app.

**T5 · Hola, Epi, Grow y Mi.** Uno por uno, igual que T3. Prueba: la acción principal de cada app.

**T6 · Cerrar.** A los 7 días, apagar activadores y publicaciones de los scripts viejos y quitar el aviso de «Gmail» del
glosario y de `cupo.js`.

## Niebla (lo que falta decidir)
- **El correo.** Hoy los scripts leen el Gmail de Juan (correos de reservas, vuelos, conferencias). Ya dueños de la cuenta
  nueva, leerían el buzón nuevo. Recomendado: reenviar automáticamente el Gmail a la cuenta nueva (filtro de Gmail), así
  Alma sigue viendo lo mismo. Alternativa: que Alma lea el Gmail con un permiso aparte (más trabajo y otra llave).
- **Desde qué dirección salen los correos** que mandan las apps (códigos de entrada, avisos): pasarían a salir de la cuenta
  nueva (`…@spacioam.com`). Se ve más profesional; solo hay que avisarle a quien filtre por remitente.
