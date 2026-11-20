/* CORRECCIONES QUE SE VUELVEN REVISIÓN (Juan, 20-nov-2026, charla «All code is slop except mine»): cuando Juan corrige
   algo, una frase en CLAUDE.md pesa menos que el código que ya existe; el agente repite el error. Por eso cada corrección
   que una máquina puede ver vive aquí como una regla que falla, y su mensaje le dice al agente QUÉ HACER EN SU LUGAR.
   Orden para cada corrección (docs/PIRAMIDE.md): diseño → revisión automática (aquí) → verificación corriendo la app
   (docs/mapa-funciones.json y los bots) → prosa (ESTANDARES.md, CLAUDE.md) → revisión de Juan.

   Mira solo lo que AGREGA este cambio (git diff origin/$BASE...HEAD), así lo viejo no frena a nadie; las copias viejas de
   cada mal patrón se limpiaron en el PR que creó la regla o quedaron anotadas en docs/PIRAMIDE.md.
     node .github/correcciones.js            las líneas agregadas y los mensajes de commit del cambio
     node .github/correcciones.js --pr       el título y el cuerpo del PR (TITULO y CUERPO; solo en GitHub)
     node .github/correcciones.js --todo     cuenta las copias que ya existen en todo el repo (inventario, no falla)
     node .github/correcciones.js --prueba   sus propios casos (dobles), sin git */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const RAIZ = path.join(__dirname, '..');
const YO = '.github/correcciones.js';

/* ── Patrones ── */
const MODELO = /\b(claude-(?:opus|sonnet|haiku|instant|\d)[\w.-]*|gpt-(?:\d|4o)[\w.-]*|gemini-\d[\w.-]*|o[134]-(?:mini|preview|pro)\b)/i;
const LLAVES = [
  /\bsk_[0-9a-f]{48}\b/,                                  // ElevenLabs
  /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/,                       // OpenAI
  /\bAKIA[0-9A-Z]{16}\b/,                                  // AWS
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bya29\.[0-9A-Za-z_-]{20,}/, /\bGOCSPX-[A-Za-z0-9_-]{20,}/,   // Google OAuth
  /hooks\.slack\.com\/services\/T[0-9A-Z]+\/B[0-9A-Z]+\/[0-9A-Za-z]+/,
  /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}/,                     // Stripe
  /\b\d{9,10}:AA[0-9A-Za-z_-]{33}\b/,                      // Telegram
  /\b(?:token|secret|secreto|api_?key|apikey|password|contrase(?:ñ|n)a|llave|clave)["']?\s*[:=]\s*["'](?![^"']*(?:prueba|test|fake|falsa|falso|ejemplo|dummy|xxxx|0000|\.\.\.|<|\$\{))(?=[^"']*\d)(?=[^"']*[A-Za-z])[A-Za-z0-9+/_=.-]{28,}["']/i
];
const EXCUSA = /\b(hack|hacky|workaround|kludge|chapuza)\b|\bpor ahora\b|\bde momento\b|\bsoluci[oó]n real\b|\bquitar (cuando|despu[eé]s|luego|m[aá]s adelante)\b|\bparche (temporal|r[aá]pido)\b/i;
const PENDIENTE = /\bTODO\b\s*[:(]|\bTODO\s*(\*\/)?\s*$|\bFIXME\b|\bXXX\b/;   // en mayúsculas: «TODO el ancho» no cuenta
const PARPADEO = /parpade|flicker|brinc|\bsalt(o|a|aba)\b|para que (no )?se vea|dar(le)? tiempo|esperar a que (pinte|cargue|se dibuje|exista|aparezca)|por si acaso|a veces no/i;
/* Columna «Evitar» de docs/GLOSARIO.md: solo los términos que nunca son correctos en un texto de la app (la prueba exige
   que sigan en el glosario). Lo genérico («sistema», «menú») no se puede revisar sin falsos rojos: queda en prosa. */
const GLOSARIO_EVITAR = ['popup', 'sidebar', 'screensaver', 'salvapantallas', 'fallback', 'attachment', 'snippet', 'widgets',
  'glassmorphism', 'spinner', 'inbox', 'staff', 'auto-merge', 'mergear', 'staging', 'sandbox', 'to-do', 'webhook', 'polling',
  'crash log', 'throttling', 'deep link', 'Alma offline', 'Claudio offline', 'voz offline', 'TTS local', 'Alma 2', 'burbuja',
  'modo debug', 'pull-to-refresh', 'scroll infinito', 'inbox unificado', 'check azul', 'URL corta', 'guardrail', 'gadgets',
  'modo sleep', 'botones rápidos', 'caja de chat', 'drill-down', 'huddle', 'companion'];
const CODIGO = /\.(js|mjs|html|css|yml|yaml|gs|swift|sh)$/;

/* La parte de comentario de una línea de código (lo que sigue a //, /*, *, # o <!--). URLs («https://») no cuentan. */
function comentario(linea, archivo) {
  const t = linea.trim();
  if (/^(\*|\/\*|\/\/|<!--)/.test(t)) return t;
  if (/\.(ya?ml|sh)$/.test(archivo) && /^#/.test(t)) return t;
  const m = linea.match(/(?:^|[^:\\"'])\/\/(.*)$|\/\*(.*)$|<!--(.*)$/);
  return m ? (m[1] || m[2] || m[3] || '') : '';
}
const ficticio = (ocho) => /(\d)\1{3}/.test(ocho);   // 5555 0101, 2222 0000: números de mentira de las pruebas
const NUMEROS_PUBLICOS = ['31280966'];   // la línea de Alma (WhatsApp y llamadas): es del negocio y sale en los anuncios
const CORREO_FALSO = /^(tu|dueno|due[nñ]o|otra|otro|juan|ana|ejemplo|prueba|test|nadie|alguien|correo|usuario|x|a)$/i;

/* ── Las reglas sobre líneas agregadas: { id, aplica(archivo), mira(linea, previa, archivo) → true si falla, mensaje } ── */
const REGLAS = [
  { id: 'llave', regla: 'Ninguna llave ni token en el repo (es público)',
    aplica: (f) => f !== YO,
    mira: (l) => LLAVES.some((r) => r.test(l)),
    mensaje: 'Esto parece una llave o un token. Bórralo del cambio y guárdalo en Ajustes → Llaves, en las Propiedades del script o en los secretos de GitHub; en el código léelo de ahí (PropertiesService, secrets). Si ya se subió a GitHub, cámbialo: el repo es público. En las pruebas usa un valor que diga «prueba».' },
  { id: 'dato-personal', regla: 'Nada de teléfonos, correos personales ni DPI reales en el repo público',
    aplica: (f) => f !== YO,
    mira: (l) => {
      for (const m of l.matchAll(/(?<![\w])\+?\(?502\)?[\s.-]?([2-7]\d{3})[\s.-]?(\d{4})(?!\d)/g)) if (!ficticio(m[1] + m[2]) && NUMEROS_PUBLICOS.indexOf(m[1] + m[2]) < 0) return true;
      for (const m of l.matchAll(/\b([A-Za-z0-9._%+-]+)@(gmail|hotmail|yahoo|outlook|icloud|live)\.[a-z.]+/gi)) if (!CORREO_FALSO.test(m[1])) return true;
      for (const m of l.matchAll(/\b(\d{4})\s(\d{5})\s(\d{4})\b/g)) if (!ficticio(m[1] + m[2] + m[3])) return true;   // DPI
      return false;
    },
    mensaje: 'El repo es público: aquí no van teléfonos, correos personales ni DPI de personas reales. En pruebas y ejemplos usa datos de mentira (+502 5555 01xx, ana@prueba.test); los reales viven en las hojas, en Mi o en las Propiedades del script y el código los lee de ahí.' },
  { id: 'comentario-excusa', regla: 'Ningún comentario que justifique un parche («hack», «por ahora», «TODO», «la solución real sería…»)',
    aplica: (f) => CODIGO.test(f) && f !== YO,
    mira: (l, p, f) => { const c = comentario(l, f); return EXCUSA.test(c) || PENDIENTE.test(c); },
    mensaje: 'Este comentario justifica un parche y el siguiente agente lo lee como permiso para repetirlo. Arregla la causa. Si de verdad hay una razón, escríbela como un hecho (qué pasa y por qué se hace así), sin «hack», «por ahora», «de momento» ni «TODO»; lo que falta por hacer va a un issue, no a un comentario.' },
  { id: 'settimeout-parpadeo', regla: 'Un parpadeo o una carrera no se tapa con setTimeout',
    aplica: (f) => /\.(js|mjs|html)$/.test(f) && !/^(apps-script|\.github)\//.test(f) && !/vendor\//.test(f),
    mira: (l, p, f) => /\bsetTimeout\s*\(/.test(l) && (PARPADEO.test(comentario(l, f)) || PARPADEO.test(comentario(p || '', f))),
    mensaje: 'No escondas un parpadeo, un salto o una carrera esperando unos milisegundos con setTimeout: falla en el teléfono lento. Pinta cuando los datos ya están (esqueleto con la forma de lo que viene, ds/velocidad.md), espera el evento real (load, transitionend, la promesa) o mide dentro de requestAnimationFrame.' },
  { id: 'glosario', regla: 'Los textos de la app usan las palabras del glosario, nunca su columna «Evitar»',
    aplica: (f) => /\.html$/.test(f) && !/^(ds|pruebas|tools)\//.test(f) && f !== 'privacidad.html',
    mira: (l) => {
      const visible = [...l.matchAll(/>([^<>{}]{2,})</g)].map((m) => m[1])
        .concat([...l.matchAll(/\b(?:placeholder|aria-label|title|alt)="([^"]+)"/g)].map((m) => m[1])).join(' | ');
      return !!visible && GLOSARIO_EVITAR.some((t) => new RegExp('(^|[^\\wáéíóúñ-])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\wáéíóúñ-])', 'i').test(visible));
    },
    mensaje: 'Este texto usa una palabra de la columna «Evitar» de docs/GLOSARIO.md. Cámbiala por la palabra del glosario (p. ej. «la roca», no «burbuja»; «Pendientes», no «inbox»); si el concepto es nuevo, agrégalo al glosario en este mismo PR.' },
  { id: 'eres-alma-a-mano', regla: 'Nadie escribe a mano «Eres Alma, …»: la identidad sale de la fuente única',
    aplica: (f) => /^apps-script\/.*\.js$/.test(f) && f !== 'apps-script/almafuente.js',
    mira: (l) => /Eres Alma\b/.test(l),
    mensaje: 'No escribas la identidad de Alma a mano: usa almaPrompt_(canal, audiencia) o almaIdentidad_() (fuente única: playbooks/alma.json). Así un cambio de cómo es Alma llega a todos los canales.' },
  { id: 'modismo', regla: 'Alma no dice «dale» ni «ahorita» (Juan lo corrigió; «va» ya tiene su revisión)',
    aplica: (f) => /^(apps-script\/.*\.js|playbooks\/.*\.(md|json))$/.test(f) && f !== 'apps-script/almafuente.js',
    mira: (l) => /(['"«]\s*(Dale|Ahorita)\b)/.test(l),
    mensaje: 'Alma no dice «dale» ni «ahorita»: usa «Listo», «Claro» o «Perfecto» (ESTANDARES.md, «Alma habla como persona»).' },
  { id: 'fecha-render', regla: 'En el render del Hub las fechas salen de this.fechaFmt, no de toLocale…String con opciones',
    aplica: (f) => f === 'index.html',
    mira: (l) => /\.toLocale(Date|Time)?String\(\s*["'][a-z]{2}-[A-Z]{2}["']\s*,\s*\{/.test(l),
    mensaje: 'En index.html usa this.fechaFmt(idioma, opciones)(fecha) (o self.fechaFmt): reutiliza el formateador. Cada toLocaleDateString/TimeString con opciones arma uno nuevo y con 150 conversaciones el iPhone se traba segundos.' }
];

/* ── Mensajes de commit ── */
function revisarCommit(cuerpo) {
  const malos = [], avisos = [];
  const sinFirma = cuerpo.split('\n').filter((l) => !/^(Co-Authored-By|Claude-Session):/i.test(l.trim())).join('\n');
  if (/`/.test(sinFirma)) malos.push('tiene acentos graves (`): escribe los nombres tal cual, sin backticks');
  const mm = sinFirma.match(MODELO); if (mm) malos.push('nombra un identificador de modelo («' + mm[0] + '»): di «el modelo rápido» o «el modelo de siempre»');
  if (!/^Co-Authored-By:/im.test(cuerpo) || !/^Claude-Session:/im.test(cuerpo)) avisos.push('no termina con las líneas Co-Authored-By y Claude-Session que da la sesión');
  return { malos, avisos };
}

/* ── git ── */
function git(args) { return cp.execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
function agregadas(base) {
  const diff = git(['-c', 'core.quotepath=off', 'diff', '--unified=0', '--no-color', '--no-ext-diff', base + '...HEAD']);
  const out = []; let f = null, n = 0, previa = '';
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { f = l.slice(4).replace(/^b\//, ''); if (f === '/dev/null') f = null; continue; }
    const h = l.match(/^@@ -\S+ \+(\d+)/); if (h) { n = +h[1]; previa = ''; continue; }
    if (f && l.startsWith('+')) { out.push({ f, n, l: l.slice(1), previa }); previa = l.slice(1); n++; }
  }
  return out;
}
function revisarLineas(lineas) {
  const fallos = [];
  for (const x of lineas) for (const r of REGLAS) if (r.aplica(x.f) && r.mira(x.l, x.previa, x.f)) fallos.push({ r, x });
  return fallos;
}
function imprimir(fallos) {
  const porRegla = {};
  fallos.forEach(({ r, x }) => (porRegla[r.id] = porRegla[r.id] || { r, xs: [] }).xs.push(x));
  Object.values(porRegla).forEach(({ r, xs }) => {
    xs.slice(0, 12).forEach((x) => console.log('::error file=' + x.f + ',line=' + x.n + '::[' + r.id + '] ' + x.f + ':' + x.n + ' · ' + x.l.trim().slice(0, 140)));
    console.log('::error::[' + r.id + '] ' + r.regla + '. Qué hacer: ' + r.mensaje);
  });
}

/* ── Modos ── */
function principal() {
  const BASE = 'origin/' + (process.env.BASE || 'main');
  try { git(['rev-parse', '--verify', BASE]); } catch (e) { console.log('Sin ' + BASE + ': no hay con qué comparar.'); return 0; }
  let fallo = 0;
  const f = revisarLineas(agregadas(BASE));
  if (f.length) { imprimir(f); fallo = 1; }
  const log = git(['log', '--no-merges', '--format=%h%x1f%B%x1e', BASE + '..HEAD']);
  for (const c of log.split('\x1e').map((s) => s.trim()).filter(Boolean)) {
    const [h, cuerpo] = c.split('\x1f'); const { malos, avisos } = revisarCommit(cuerpo || '');
    malos.forEach((m) => { console.log('::error::[commit] ' + h + ' ' + m + '. Qué hacer: corrige el mensaje con git commit --amend (o git rebase) antes de subir.'); fallo = 1; });
    avisos.forEach((m) => console.log('::warning::[commit] ' + h + ' ' + m + '.'));
  }
  if (!fallo) console.log('Bien: ' + REGLAS.length + ' reglas sobre lo agregado y los mensajes de commit.');
  return fallo;
}
function pr() {
  const texto = (process.env.TITULO || '') + '\n' + (process.env.CUERPO || '');
  const m = texto.match(MODELO);
  if (m) { console.log('::error::[pr] El título o el cuerpo del PR nombra un identificador de modelo («' + m[0] + '»). Qué hacer: edítalo y di «el modelo rápido» o «el modelo de siempre».'); return 1; }
  console.log('Bien: el PR no nombra modelos.'); return 0;
}
function todo() {
  const archivos = git(['ls-files', '-z']).split('\0').filter((f) => f && !/\.(png|jpe?g|gif|webp|wav|mp3|mp4|woff2?|ttf|otf|ico|pdf|zip)$/i.test(f) && !/(^|\/)vendor\/|\.min\.js$|^ds\/bundle\.js$/.test(f));
  const lineas = [];
  for (const f of archivos) { let t; try { t = fs.readFileSync(path.join(RAIZ, f), 'utf8'); } catch (e) { continue; } let previa = ''; t.split('\n').forEach((l, i) => { lineas.push({ f, n: i + 1, l, previa }); previa = l; }); }
  const fallos = revisarLineas(lineas), cuenta = {};
  fallos.forEach(({ r, x }) => (cuenta[r.id] = cuenta[r.id] || []).push(x.f + ':' + x.n));
  REGLAS.forEach((r) => console.log(r.id + ': ' + (cuenta[r.id] || []).length + (cuenta[r.id] ? '  ' + cuenta[r.id].slice(0, 8).join(' · ') : '')));
  return 0;
}
function prueba() {
  let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
  const cae = (id, f, l, previa) => revisarLineas([{ f, n: 1, l, previa: previa || '' }]).some((x) => x.r.id === id);
  ok(cae('llave', 'apps-script/x.js', "const k = 'sk_" + 'a1'.repeat(24) + "';"), 'llave · una llave de ElevenLabs cae');
  ok(cae('llave', 'apps-script/x.js', "token: '" + 'Ab9'.repeat(12) + "'"), 'llave · un token largo asignado cae');
  ok(!cae('llave', '.github/x.js', "token: 'firma-de-prueba-" + 'a'.repeat(30) + "'"), 'llave · un token que dice «prueba» pasa');
  ok(cae('dato-personal', 'index.html', "telefono: '+50241234567'"), 'dato-personal · un móvil real cae');
  ok(!cae('dato-personal', '.github/x.js', "tel: '50255550101', otro: '+502 2222 0000'"), 'dato-personal · los números de mentira (5555, 2222) pasan');
  ok(cae('dato-personal', 'docs/x.md', 'escríbele a maria.lopez@gmail.com'), 'dato-personal · un correo personal cae');
  ok(!cae('dato-personal', 'apps-script/correo.js', "'tu@gmail.com'"), 'dato-personal · tu@gmail.com (ejemplo) pasa');
  ok(cae('comentario-excusa', 'js/a.js', 'x(); // hack: así no truena'), 'excusa · «hack» en un comentario cae');
  ok(cae('comentario-excusa', 'index.html', '  /* TODO: GET /hola/checkins */'), 'excusa · «TODO:» cae');
  ok(cae('comentario-excusa', 'js/a.js', '/* solo el administrador, por ahora */'), 'excusa · «por ahora» cae');
  ok(!cae('comentario-excusa', 'js/a.js', '/* Ver todo: el último mensaje */'), 'excusa · «todo:» en minúsculas pasa');
  ok(!cae('comentario-excusa', 'js/a.js', '/* Primero se mira TODO lo que pidió */'), 'excusa · «TODO» como «todo» en mayúsculas pasa');
  ok(!cae('comentario-excusa', 'js/a.js', 'var u = "https://x.com/hack"; // la ruta del proveedor'), 'excusa · una URL con «hack» no es comentario');
  ok(cae('settimeout-parpadeo', 'js/a.js', 'setTimeout(pintar, 50); // para que no parpadee'), 'parpadeo · setTimeout con «parpadee» cae');
  ok(cae('settimeout-parpadeo', 'alma/inicio.html', 'setTimeout(mostrar, 30);', '/* esperar a que pinte el panel */'), 'parpadeo · el comentario de la línea anterior cuenta');
  ok(!cae('settimeout-parpadeo', 'js/a.js', 'setTimeout(cerrar, 8000);   // tope de espera del servidor'), 'parpadeo · un tope de espera pasa');
  ok(!cae('settimeout-parpadeo', 'alma/inicio.html', 'b.classList.add("salto"); setTimeout(quitar, 400);'), 'parpadeo · una clase que se llama «salto» no es comentario');
  ok(!cae('llave', '.github/x.js', "const SECRETO = 'valor-secreto-que-no-debe-salir';"), 'llave · un texto sin números no es llave');
  ok(!cae('dato-personal', 'playbooks/x.md', 'línea de Alma: +502 3128 0966'), 'dato-personal · la línea pública de Alma pasa');
  ok(cae('glosario', 'alma/x.html', '<button>Abrir el sidebar</button>'), 'glosario · «sidebar» en un botón cae');
  ok(cae('glosario', 'alma/x.html', '<input placeholder="Busca en tu inbox">'), 'glosario · en un placeholder cae');
  ok(!cae('glosario', 'alma/x.html', '<div class="sidebar">Pendientes</div>'), 'glosario · una clase de estilo no es texto');
  ok(cae('eres-alma-a-mano', 'apps-script/nuevo.js', "var sys = 'Eres Alma, de Spacio AM.';"), 'eres-alma · a mano cae');
  ok(!cae('eres-alma-a-mano', 'apps-script/almafuente.js', '"quien": "Eres Alma, la asistente"'), 'eres-alma · la fuente única pasa');
  ok(cae('modismo', 'apps-script/x.js', "return 'Dale, ya quedó';"), 'modismo · «Dale,» cae');
  ok(!cae('modismo', 'apps-script/avisorespuesta.js', 'var RE = /^(sí|dale|claro)/;'), 'modismo · reconocer «dale» de Juan pasa');
  ok(cae('fecha-render', 'index.html', 'var f = d.toLocaleDateString("es-GT", { day: "numeric" });'), 'fecha · toLocaleDateString con opciones en index.html cae');
  ok(!cae('fecha-render', 'index.html', 'var f = self.fechaFmt("es-GT", { day: "numeric" })(d);'), 'fecha · fechaFmt pasa');
  const c1 = revisarCommit('Alma · algo con `voz.js`\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://x');
  ok(c1.malos.length === 1 && /graves/.test(c1.malos[0]), 'commit · backticks caen');
  const c2 = revisarCommit('Usa claude-sonnet-4-5 para leer\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://x');
  ok(c2.malos.length === 1 && /modelo/.test(c2.malos[0]), 'commit · un id de modelo cae');
  const c3 = revisarCommit('Alma · todo bien\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://x');
  ok(!c3.malos.length && !c3.avisos.length, 'commit · el pie de atribución (con «Opus 5.5») no cuenta como modelo');
  ok(revisarCommit('Arreglo sin pie').avisos.length === 1, 'commit · sin pie de atribución es aviso, no error');
  const glos = fs.readFileSync(path.join(RAIZ, 'docs/GLOSARIO.md'), 'utf8').toLowerCase();
  const fuera = GLOSARIO_EVITAR.filter((t) => glos.indexOf(t.toLowerCase()) < 0);
  ok(!fuera.length, 'glosario · cada término revisado sigue en docs/GLOSARIO.md' + (fuera.length ? ' (faltan: ' + fuera.join(', ') + ')' : ''));
  return fallo;
}

const a = process.argv.slice(2);
process.exitCode = a.includes('--prueba') ? prueba() : a.includes('--pr') ? pr() : a.includes('--todo') ? todo() : principal();
