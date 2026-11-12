/* Lo que recibe Alma en cada canal, ya armado como le llega al modelo (sin red y con la hoja vacía: así cuenta solo lo
   que pone el código y la fuente única playbooks/alma.json). Lo usan .github/presupuesto-prompts.js (el tamaño) y
   .github/prompts-json.js (que cada uno sea JSON válido; #498 T2). Carga apps-script/*.js con dobles de Google y arma:
   · voz: vozPromptCompleto_().texto (lo que el Hub sube al agente de ElevenLabs, con {{quien_llama}} al final);
   · chat_texto / whatsapp_texto / calle_texto: los bloques de system de opAgente_ (claudeSystem_) con Juan en el Hub,
     WhatsApp y modo calle;
   · chat_herramientas: las herramientas del chat (JSON, se mandan en cada turno);
   · redactor: redactorPrompt_('') (base + reglas fijas + reglas consolidadas + estilo), lo que recibe el redactor.
   armar(DIR) → { voz: [texto], chat_texto: [bloque, bloque], …, chat_herramientas: [json] }: cada canal, sus bloques
   (más _crudo y _ctx, que no son canales: los usa prompts-json.js). */
const fs = require('fs'), path = require('path'), vm = require('vm');
function armar(DIR) {
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
  const R = c => { try { return vm.runInContext(c, ctx); } catch (e) { throw new Error('no pude armar: ' + c + ' (' + e.message + ')'); } };
  let capt = null; ctx.opAgenteBucle_ = (adm, system, msgs, tools) => { capt = { system, tools }; return {}; };
  const chat = canal => { R("opAgente_({ email: 'juan@x.com', nombre: 'Juan', principal: true }, 'hola', '" + canal + "', [], [])"); ctx.S_ = capt.system; return { system: capt.system, bloques: R('claudeSystem_(S_)').map(b => b.text), tools: capt.tools }; };
  const hub = chat('hub');
  return {
    voz: [String(R('vozPromptCompleto_().texto'))],
    chat_texto: hub.bloques,
    chat_herramientas: [JSON.stringify(hub.tools)],
    whatsapp_texto: chat('whatsapp').bloques,
    calle_texto: chat('calle').bloques,
    redactor: [String(R("redactorPrompt_('')"))],
    /* No es un canal: el texto de antes de pasar a JSON y el contexto, para revisar que la conversión no pierda nada. */
    _crudo: { chat_texto: hub.system, redactor: String(R("prompt_('REDACTOR') + reglas_('REGLAS_REDACTOR') + reglasHuespedes_('texto') + estilo_()")) },
    _ctx: ctx
  };
}
module.exports = { armar };
