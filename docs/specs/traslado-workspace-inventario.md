# Traslado a Workspace · Inventario (T1)

Hecho el 16-nov-2026 sin tocar nada: lectura del código de los 7 repos (`origin/main`) y la acción de solo lectura del
robot del Hub `inventario_ws` (`apps-script/inventariows.js`). Plan completo en [traslado-workspace.md](traslado-workspace.md).
Repo público: de cada hoja o carpeta va el **nombre como se ve en Drive** y los **últimos 6 caracteres** de su id; nunca el
id completo, ni valores de llaves, ni correos.

## Resultado en una línea
Las 7 apps usan **8 hojas y 5 carpetas**, todas de la cuenta Gmail de Juan, y casi todas viven dentro de una sola carpeta
de Drive, **«Spacio AM»**. Para T2 bastan **3 clics** (ver «Qué compartir»).

## Por script

| Script | Hojas (nombre · …fin del id) | Carpetas | Activadores | Dirección /exec (…inicio) y quién la usa |
|---|---|---|---|---|
| **Hub / ALMA** (`apps-script/`) | ALMA - Mensajes y control · …quZ7kk (propia) · Guest app DB · …3F3KeQ (lee) · Spacio AM DB · …B8cYZg (lee códigos) · Control de usuarios · …P_wX2U · Spacio AM 2025 · …25cLF4 (reporte del mes y socios) · ALMA · Archivo (memoria larga) · …sdrZgw (en «Mi unidad») | Las que el Hub crea solo al usarse (WA_CARPETA, CONF_CARPETA, ADJ_CARPETA_ID, ALMA_ARCH_CARPETA_ID, FOTOS_CT_CARPETA_ID, VIAJES_CARPETA): **ninguna existe hoy**. Carpetas del cerebro: ninguna. | Vivos: `procesarCola` (cada min), `procesarColaPronto`, `aprender` (cada hora), `cerebroSincronizar` (30 min). El código también crea al vuelo `opWaPronto`, `avisoVozPronto`, `decisionSalirPronto`, `vozSeguirPronto`, `vozSecretariaPronto`. | `AKfycbzTdkEp…`: páginas del Hub (`js/alma-client.js`, `alma/*.html`, `health/`, `anillo/`, `claude.html`, `404.html`, `design-system.html`, `js/sa-tutoriales.js`), `vigia-alma.yml`, `para-alma-aviso.yml`, Epi y Hola (`apps-script/Código.js` → `ALMA_URL`/`HUB_ALMA_URL`), Worker `alma-puente` (ElevenLabs), herramientas de ElevenLabs, webhooks de WhatsApp (Meta) y Hospitable, `correo-puente` instalado en el Gmail de Juan (`HUB`). |
| **Login** (`login/apps-script/`) | Control de usuarios · …P_wX2U; lee además (lector de hojas e importador) Guest app DB, ALMA - Mensajes y control, Spacio AM 2025, Spacio AM DB, Contratos APP · …aGRDVU, Spacio AM · Gestión · …73tNzI y la de The Gentle Stoic Parent · …Nr71iM | — | — | `AKfycbxfdwLz…`: `sa-auth-client.js` y `apps-script/sesion.js` de cada app, `usuarios.html`, `Código.js` del Hub, `accesos-duenos.js` de Grow, `04-cliente-frontend.js` de Mi. |
| **Hola** | Guest app DB · …3F3KeQ (`SHEET_ID`) | Documentos · …Q6d0GS (`DRIVE_FOLDER`, dentro de «Guest App»; crea subcarpetas `_borradores`, `LongTerm`) | En el código: `quickSync` (10 min), `scheduledSync` (5:00 y 15:00), `purgeExpiredDocuments` (3:00), `earlyAdminPrompt`, `earlyAdminReminder`, `earlyFinalNotify`, `checkoutMorningEmails` (7:30), `ltDailyReminders` (8:00) | `AKfycbwnaUyS…`: `config.js`, `404.html`, `index.html` y `holaacceso.js` del Hub. |
| **Epi** | Spacio AM DB · …B8cYZg; Spacio AM 2025 · …25cLF4 (enlaces de anuncios); Control de usuarios · …P_wX2U (contraseñas del login) | Spacio AM Media · …7yFL1j (`FOLDER_ID`, dentro de «EPI APP») | En el código: `cronSyncReviews` (4:00), `cronProgramar18`, `cronRevisar06`, `cronSyncReservas` (3 h), `cronAlertaLimpiezas13`, `cronRecordatorio19`, `cronVerificarCheckouts` (7:00) | `AKfycbxzYpBa…`: `app.jsx`/`app.build.js`, `index.html` y `Código.js` del Hub. |
| **Grow** | Spacio AM · Gestión · …73tNzI (`SPREADSHEET_ID` en Propiedades); importa presupuestos de cualquier hoja que se le comparta | `FOLDER_ID` en Propiedades (no está en el código; probablemente dentro de «Grow App») | Ninguno en el código | `AKfycbxPYwdz…`: `index.html`, `404.html`, `Spacio AM Gestión.dc.html`, `github.md`; `agente.js` y `Código.js` del Hub; `esign.jsx` de Docs. |
| **Docs** | Contratos APP · …aGRDVU (`SHEET_ID`); Spacio AM DB · …B8cYZg (`EPI_SHEET_ID`, lista de propiedades) | Contratos · …ZxyqSa (`FOLDER_ID`, dentro de «Contratos App») | En el código: `enviarProgramados` (5 min) | `AKfycbz2_KDt…`: `sheets-sync.js`, `404.html`; `Código.js` del Hub. |
| **Mi** | Spacio AM 2025 · …25cLF4 (privada; `SA_SHEET_ID`); «Mi · Fichas de socios (privado)» (`MI_FICHAS_ID`, la crea sola: **todavía no existe**) | «Spacio AM - Archivos de socios» · …jM1UNa (la busca por nombre en «Mi unidad»; si no la ve, crea otra vacía) | En el código: `hospitableAutomatico` (6:00), `aplicarRecurrentesAutomatico` (6:00), `sa_hspRun` (al vuelo) | `AKfycbzqUTv_…`: `sheets.js`, `404.html`, `Actualizacion.js`; `Código.js` del Hub. |

Fuera de los 7: la app The Gentle Stoic Parent tiene su propio Apps Script (`AKfycbzlD8c0…`, lo llama `familia.js` del
Hub) y su hoja vive en «Parent Software». No entra en este traslado salvo que Juan lo pida.

### Servicios y cosas atadas a la cuenta (cambian al cambiar de dueño)
- **Hub**: servicios avanzados Gmail y People (`appsscript.json`). Lee y manda correo (`GmailApp`, alias `CFG.EMAIL_DESDE`),
  usa el calendario predeterminado de la cuenta (`calendario.js`; `CALENDARIO_JUAN` **no** está puesto) y los contactos de
  Google de la cuenta (`fotoscontacto.js`, People). En la cuenta nueva los tres serían los de `alma@spacioam.com`:
  - Correo: decidido (spec, «El correo»). La pieza para leer el Gmail de Juan ya existe: `correo-puente/Codigo.gs`, que
    corre en la cuenta de Juan y manda lo nuevo al Hub; en T4 solo cambia su `HUB`.
  - Calendario: en T4, Juan comparte su calendario con `alma@spacioam.com` y se pone `CALENDARIO_JUAN`.
  - Contactos (fotos de contactos): quedan vacíos en la cuenta nueva; se decide en T4.
- **Todos**: `MailApp`/`GmailApp` para mandar correos; al cambiar de dueño salen desde la cuenta nueva (spec, niebla 2).
- **Hub, cerebro**: BigQuery por cuenta de servicio (`BQ_CUENTA`): no depende del dueño del script.

## Propiedades del script del Hub (144, solo nombres)
**Se copian** (configuración y llaves; Juan las pega en la cuenta nueva, nunca por chat): `AIRLABS_KEY`, `ALMA_ACTIVO`,
`ALMA_ADAPTACION_TOPE`, `ALMA_ARCHIVO_ID`, `ANTHROPIC_KEY`, `BQ_CUENTA`, `BQ_PROYECTO`, `CER_TABLA`, `CLAUDE_RUTINA_TOKEN`,
`CLAUDIO_AGENT_ID`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_KEY`, `ELEVENLABS_PHONE_ID`, `GOOGLE_MAPS_KEY`, `GROW_TOKEN`,
`HOSPITABLE_TOKEN`, `HUB_SOLO_SESION`, `HUB_TOKEN`, `JEV_KEY`, `LLAVES_GUARDADAS`, `LOGIN_SECRETO`, `ONESIGNAL_APP_ID`,
`ONESIGNAL_KEY`, `PARA_ALMA_AVISO_KEY`, `ROBOT_TOKEN`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH`,
`USO_KEY`, `VOZ_VOICE_ID`, `VOZ_WEB_SECRETO`, `WA_APP_ID`, `WA_EQUIPO`, `WA_PHONE_ID`, `WA_PLANTILLA_SOCIO`,
`WA_PLANTILLA_SOCIO_IDIOMA`, `WA_PLANTILLA_SOCIO_IDIOMA_EN`, `WA_RELAY`, `WA_TOKEN`, `WA_VERIFY_TOKEN`, `WA_WABA_ID`,
`WEBHOOK_KEY`, `WEEBO_MODO`, `WEEBO_NIVEL_FIJO`.

**No hace falta copiarlas** (estado que el Hub rehace solo): `ALMA_ABRE`, `ANILLO_APP_*`, `ARCHIVO_AUTO`, `ARCHIVO_DIA`,
`ARCHIVO_ULT`, `AVISO_VOZ_COLA`, `BANDEJA_CODIGOS_V1`, `BOTS_PRUEBA_ENVIADOS`, `CER_GASTO`, `CER_PAUSA_HASTA`,
`CER_PRUEBA_DIA`, `CER_PRUEBA_ULTIMA`, `CER_ULTIMA`, `CER_UMBRAL_SUGERIDO`, `CHAT_PREGUNTAS`, `CHAT_UNICO_MIGRADO`,
`CLAUDIO_CONFIG_HUELLA`, `CLAUDIO_CONFIG_T`, `CLAUDIO_CREAR_T`, `CLAUDIO_PROMPT_HUELLA`, `CLAUDIO_SYNC`,
`CLAUDIO_TOOLS_HUELLA`, `CONF_TEMP_ULT`, `CONTACTOS_COLA`, `CUPO_ESTADO`, `DEC_WA`, `ESCALAR_ENTREGAS`,
`FAMILIA_PROMPT_HUELLA`, `FAMILIA_SYNC`, `FOTO_ACTUAL`, `FOTO_CAMBIADA`, `FOTO_COLA`, `FOTO_INTENTO`, `GITHUB_PRS`,
`HUB_DESPUES`, `HUB_ULTIMA_LLAVE`, `HUB_ULTIMA_SESION`, `INBOX_SYNC`, `INQ_FIX`, `MEJ_SEED`, `MEM_HECHOS2`,
`PARA_ALMA_ESTADO`, `PB_*` (9), `PEND_LIMPIEZA_REGISTRO`, `PEND_LIMPIEZA_ULT`, `PEND_LIMPIEZA_V1`, `PEND_REPREGUNTA_HIST`,
`PEND_REPREG_MICRO`, `PROG_PROX`, `PROM_ULT_AVISO`, `PULSO`, `RECEP_COLA`, `RECEP_EST`, `RECEP_HECHO`, `RECEP_NUMS`,
`REV_SR_TS`, `SOCIO_TPL_AVISO`, `SOCIO_TPL_EST`, `SOCIO_TPL_REV`, `TEMAS_V1`, `TEMAS_V2`, `ULTIMA_LIMPIEZA`, `ULTIMO_POST`,
`USOM_ENVIADO`, `VIAJES_REPARADO_*`, `VIG_ACTIVAS`, `VOZWEB_TIEMPOS`, `VOZ_ACCESO`, `VOZ_ACCESO_HUELLA`, `VOZ_ACCESO_T`,
`VOZ_AVISOS`, `VOZ_AVISOS_H_*`, `VOZ_CAIDAS`, `VOZ_HECHAS`, `VOZ_INICIO_OK`, `VOZ_INTERNOS`, `VOZ_MARCA_PRINCIPAL`,
`VOZ_PROMPT_HUELLA`, `VOZ_PROTECCION`, `VOZ_PROTECCION_HUELLA`, `VOZ_PROTECCION_T`, `VOZ_RET_*`, `VOZ_SEC_COLA`,
`VOZ_SEGUIR`, `VOZ_SYNC`, `VOZ_TOOLS_HUELLA`, `VOZ_TOOLS_SYNC`, `VUELO_VIVO`, `VUELO_VIVO_USO`, `WA_ENTREGA`, `WA_PEND`,
`WA_ULTIMO`. Ojo: `PEND_*`, `RECEP_*`, `WA_PEND` y `TEMAS_V*` guardan trabajo a medias; se copian si al pasar hay algo
pendiente.

## Propiedades que el código de las otras apps lee (por nombre)
La acción del Hub no puede ver las Propiedades de otros scripts; esto sale del código. Juan las ve en
⚙️ Configuración del proyecto → Propiedades del script de cada uno.
- **Login**: `AUTH_TOKEN`, `GOOGLE_CLIENT_IDS`, `SESSION_SECRET`.
- **Hola**: `ACCESOS`, `ADMIN_NOTIFY_EMAIL`, `AI_MODEL_FALLBACK`, `AI_MODEL_PRIMARY`, `ALMA_URL`, `ANTHROPIC_API_KEY`,
  `APP_URL`, `BALDONE_RECEPCION_V1`, `DRIVE_FOLDER`, `FROM_EMAIL`, `FROM_NAME`, `FX_RATE_MANUAL`, `HOSPITABLE_TOKEN`,
  `HUB_ALMA_URL`, `LINK_SECRET`, `LOGIN_SECRETO`, `LOGIN_TOKEN`, `LT_*` (8), `RETENTION_MONTHS`, `SESION_EXIGIR`,
  `SES_FALLA`, `SHEET_ID`, `USO_APP`, `USO_KEY`, `WA_VIA_ALMA`, `WEB_APP_URL`, `WHATSAPP_*` (8).
- **Epi**: `ACCESOS`, `ALMA_URL`, `ANTHROPIC_API_KEY`, `CACHE_VER`, `EPI_ADMIN_PIN`, `HOSPITABLE_TOKEN`, `LOGIN_TOKEN`,
  `SESION_EXIGIR`, `USO_APP`, `USO_KEY` (más marcas de arreglos de una vez: `ADELANTOS_*`, `ADV_*`, `EPI_REVERTIR_*`).
- **Grow**: `ACCESOS`, `DOCS_CERRADOS`, `FOLDER_ID`, `LOGIN_ADMIN_EMAIL`, `LOGIN_DUENOS`, `LOGIN_TOKEN`, `SESION_EXIGIR`,
  `SPREADSHEET_ID`.
- **Docs**: `ACCESOS`, `LOGIN_TOKEN`, `SESION_EXIGIR` y, si se pusieron, `SHEET_ID`, `FOLDER_ID`, `EPI_SHEET_ID`,
  `FROM_EMAIL`, `FROM_NAME`, `OWNER`, `TOKEN` (`P_()`; sin la propiedad usa el valor del código).
- **Mi**: `ACCESOS`, `ANTHROPIC_API_KEY`, `HOSPITABLE_TOKEN`, `LOGIN_TOKEN`, `MI_ADMIN_TOKEN`, `MI_FICHAS_ID`,
  `SESION_EXIGIR` (más estado: `EM_CIERRE_*`, `SA_*`, `SETUP_CLAVE_*`).

## Qué compartir con `alma@spacioam.com` (T2, como editor)
Todas las hojas y carpetas son de la cuenta Gmail de Juan y casi todas cuelgan de «Spacio AM»:

| # | Qué | Tipo | Dónde | Cubre |
|---|---|---|---|---|
| 1 | **Spacio AM** · …rI-WjW | carpeta | Mi unidad | ALMA, Guest App, EPI APP (en «EP - Equipo de primera impresión»), Web apps → Control de usuarios, Grow App, Contratos App, Reportes financieros → Spacio AM 2025 (privada; misma organización) |
| 2 | **ALMA · Archivo (memoria larga)** · …sdrZgw | hoja | Mi unidad (suelta) | memoria larga del Hub |
| 3 | **Spacio AM - Archivos de socios** · …jM1UNa | carpeta | Mi unidad (suelta) | archivos que Mi guarda por socio |

Si Juan prefiere no dar acceso a toda «Spacio AM», la opción fina son 9 clics: las carpetas ALMA, Guest App, EPI APP,
Control de usuarios, Grow App, Contratos App y las hojas Spacio AM 2025, ALMA · Archivo y la carpeta de Archivos de socios.

Prueba de T2: con la cuenta nueva, `inventario_ws` (o abrir cada una) da `abre: true` en todas.
