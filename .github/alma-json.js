/* Checks de la fuente única de Alma (playbooks/alma.json y huespedes.json; T7, 3-nov-2026). Revisa:
   1. que los dos JSON sean válidos y apps-script/almafuente.js esté al día (tools/alma-fuente.js);
   2. que ningún id se repita (una regla vive una sola vez);
   3. que ningún texto use lo prohibido: el modismo «va», anunciar o nombrar a Claudio al pasarle algo, «secretaria»
      (fuera de la lista de prohibiciones, que justo los nombra), ni «prevalece» / «gana la mejora» (hay un solo orden);
   4. que cada herramienta del agente de voz tenga su línea en alma.json, y que no haya líneas de herramientas que ya
      no existen.
   El presupuesto (tamaño del texto ya armado por canal) lo mide .github/presupuesto-prompts.js.
   node .github/alma-json.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const raiz = path.join(__dirname, '..'), DIR = process.argv[2] || path.join(raiz, 'apps-script');
let fallo = 0; const error = m => { console.log('::error::' + m); fallo = 1; };
const leer = n => { try { return JSON.parse(fs.readFileSync(path.join(raiz, 'playbooks', n), 'utf8')); } catch (e) { error('playbooks/' + n + ' no es JSON válido: ' + e.message); return null; } };
const A = leer('alma.json'), H = leer('huespedes.json');
if (!A || !H) process.exit(1);
try { console.log(cp.execFileSync('node', [path.join(raiz, 'tools', 'alma-fuente.js'), '--revisar']).toString().trim()); } catch (e) { console.log(String(e.stdout || '')); fallo = 1; }

/* 2 · ids únicos y 3 · palabras prohibidas, recorriendo cada texto con su ruta. */
const ids = {}, textos = [];
const recorrer = (o, ruta) => {
  if (Array.isArray(o)) return o.forEach((x, i) => recorrer(x, ruta + '[' + i + ']'));
  if (o && typeof o === 'object') {
    if (typeof o.id === 'string') { if (ids[o.id]) error('id repetido «' + o.id + '»: ' + ids[o.id] + ' y ' + ruta); else ids[o.id] = ruta; }
    return Object.keys(o).forEach(k => recorrer(o[k], ruta + '.' + k));
  }
  if (typeof o === 'string') textos.push({ ruta, t: o });
};
recorrer(A, 'alma.json'); recorrer(H, 'huespedes.json');
const PROHIBIDO = [
  [/(^|[«"'¡\s])va([,.!»]|\s+como\b)/i, 'el modismo «va» (usa «listo», «claro», «perfecto»)'],
  [/se lo (digo|paso|pasé|mando|mandé|envío|voy a (pasar|mandar|reportar)) a claudio|ya se lo (mandé|pasé)|lo consulto con mi sistema|voy a consultar con mi sistema|lo reviso en mi sistema/i, 'anunciar o nombrar a Claudio al pasarle algo'],
  [/\bsecretaria\b/i, '«secretaria» (para la persona es «mi sistema»)'],
  [/prevalece|gana la mejora|por encima de todo/i, 'otro «esto manda sobre todo» (el único orden es alma.json → prioridad)']
];
textos.forEach(({ ruta, t }) => {
  if (/^alma\.json\.(prohibiciones|nota)/.test(ruta) || /^huespedes\.json\.nota/.test(ruta)) return;   // la lista de prohibiciones los nombra a propósito
  if (/^alma\.json\.ejemplos\.lista\[\d+\]\.mal$/.test(ruta)) return;   // el ejemplo «mal» muestra justo lo que no se dice
  PROHIBIDO.forEach(([re, que]) => { if (re.test(t)) error(ruta + ' usa ' + que + ': «' + t.slice(0, 120) + '»'); });
});

/* 4 · cada herramienta de la voz tiene su línea. */
const nada = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : nada, apply: () => nada });
const props = { getProperty: () => null, setProperty() {}, deleteProperty() {}, getKeys: () => [] };
const ctx = { console: { log() {}, error() {}, warn() {} }, Date, JSON, Math, String, Number, Array, Object, RegExp, Error, isNaN, encodeURIComponent, decodeURIComponent,
  PropertiesService: { getScriptProperties: () => props }, CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: nada, SpreadsheetApp: nada, LockService: nada, ScriptApp: nada, Session: nada, UrlFetchApp: nada, DriveApp: nada, GmailApp: nada, MailApp: nada, CalendarApp: nada,
  HtmlService: nada, ContentService: nada, DocumentApp: nada, LanguageApp: nada, XmlService: nada, Logger: nada };
vm.createContext(ctx);
fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }); } catch (e) {} });
let voz = [];
try { voz = vm.runInContext("vozDefHerramientas_('B').map(function (t) { return t.name; }).concat(Object.keys(VOZ_AJUSTES_AJENAS_), Object.keys(VOZ_SISTEMA_DESC_), ['skip_turn'])", ctx); }
catch (e) { error('no pude leer las herramientas de la voz: ' + e.message); }
const lineas = (A.herramientas && A.herramientas.lista) || {};
voz.forEach(n => { if (!lineas[n] || !String(lineas[n].linea || '').trim()) error('La herramienta de voz «' + n + '» no tiene su línea en playbooks/alma.json → herramientas.lista.'); });
Object.keys(lineas).forEach(n => { if (voz.length && voz.indexOf(n) < 0) error('playbooks/alma.json tiene la línea de «' + n + '», que ya no es una herramienta de la voz: quítala.'); });

if (!fallo) console.log('✓ alma.json y huespedes.json: ' + Object.keys(ids).length + ' ids únicos, sin palabras prohibidas, ' + voz.length + ' herramientas de voz con su línea.');
process.exit(fallo);
