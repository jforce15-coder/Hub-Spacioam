/* Presupuesto de los prompts (issue #396, idea de Atticus; T9 del 3-nov-2026): mide el texto REAL que recibe Alma en
   cada canal, ya armado, no solo unas constantes. Carga apps-script/*.js con dobles de Google (sin red), con la hoja
   vacía (así cuenta solo lo que pone el código y la fuente única playbooks/alma.json) y arma:
   · voz: vozPromptCompleto_() (lo que se copia al agente de ElevenLabs, sin la ficha de quien llama);
   · chat_texto / whatsapp_texto / calle_texto: el system de opAgente_ con Juan en el Hub, WhatsApp y modo calle;
   · chat_herramientas: las herramientas del chat (JSON, se mandan en cada turno);
   · redactor: lo que recibe el redactor de huéspedes (base + reglas fijas + reglas consolidadas + estilo).
   Falla si alguno pasa su tope de .github/presupuesto-prompts.json. Las mejoras y avisos de la hoja no cuentan aquí.
   node .github/presupuesto-prompts.js [carpeta apps-script]   ·   --medir imprime los tamaños de hoy, sin revisar. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'apps-script');
const nada = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : nada, apply: () => nada });
const mem = { VOZ_INICIO_OK: '1' }, cache = {};
const props = { getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty() {}, getKeys: () => Object.keys(mem) };
const ctx = {
  console: { log() {}, error() {}, warn() {} }, Date, JSON, Math, String, Number, Array, Object, RegExp, Error, isNaN, encodeURIComponent, decodeURIComponent,
  PropertiesService: { getScriptProperties: () => props }, CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString(), getUuid: () => 'u', computeDigest: () => [0], base64Encode: () => 'h', DigestAlgorithm: {}, Charset: {} },
  SpreadsheetApp: nada, LockService: nada, ScriptApp: nada, Session: nada, UrlFetchApp: nada,
  DriveApp: nada, GmailApp: nada, MailApp: nada, CalendarApp: nada, HtmlService: nada, ContentService: nada, DocumentApp: nada, LanguageApp: nada, XmlService: nada, Logger: nada
};
vm.createContext(ctx);
fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }); } catch (e) { console.error('carga ' + f + ': ' + e.message); } });
/* Dobles: hoja vacía (cada prompt usa su base del código), playbooks del repo (negocio), sin mejoras ni encargos. */
const PB = path.join(DIR, '..', 'playbooks');
Object.assign(ctx, {
  leerTabla_: () => [], sembrarInstrucciones_: () => {}, mejorasFilas_: () => [], adaptBloque_: () => '', encargosTexto_: () => '', encargosPedidosTexto_: () => '',
  microBloque_: () => '', esAdminPrincipal_: a => !!(a && a.principal), recetaIntentar_: () => null, instAgente_: () => null, recetaAprender_: () => {},
  uf_: url => { const f = path.join(PB, String(url).split('/').pop()); const ok = fs.existsSync(f); return { getResponseCode: () => ok ? 200 : 404, getContentText: () => ok ? fs.readFileSync(f, 'utf8') : '' }; }
});
const R = c => { try { return vm.runInContext(c, ctx); } catch (e) { console.error('no pude medir: ' + c + ' (' + e.message + ')'); process.exit(1); } };
let capt = null; ctx.opAgenteBucle_ = (adm, system, msgs, tools) => { capt = { system, tools }; return {}; };
const chat = canal => { R("opAgente_({ email: 'juan@x.com', nombre: 'Juan', principal: true }, 'hola', '" + canal + "', [], [])"); return capt; };
const hoy = {
  voz: String(R('vozPromptCompleto_().texto')).replace(/FICHA DE QUIEN LLAMA \(el Hub[\s\S]*$/, '').length,
  chat_texto: chat('hub').system.length,
  chat_herramientas: JSON.stringify(capt.tools).length,
  whatsapp_texto: chat('whatsapp').system.length,
  calle_texto: chat('calle').system.length,
  redactor: String(R("prompt_('REDACTOR') + reglas_('REGLAS_REDACTOR') + reglasHuespedes_('texto') + estilo_()")).length
};
if (process.argv.includes('--medir')) { console.log(JSON.stringify(hoy)); process.exit(0); }
const tope = JSON.parse(fs.readFileSync(path.join(__dirname, 'presupuesto-prompts.json'), 'utf8')).topes;
let fallo = 0;
Object.keys(hoy).forEach(k => {
  const linea = k + ': ' + hoy[k] + ' caracteres (tope ' + tope[k] + ')';
  if (!tope[k]) { console.log('::error::Falta el tope de ' + k + ' en .github/presupuesto-prompts.json'); fallo = 1; }
  else if (hoy[k] > tope[k]) { console.log('::error::El prompt de ' + k + ' creció de más: ' + linea + '. Recorta antes de agregar (cada carácter se paga en cada llamada), o sube el tope en .github/presupuesto-prompts.json con el sí de Juan.'); fallo = 1; }
  else console.log('✓ ' + linea);
});
process.exit(fallo);
