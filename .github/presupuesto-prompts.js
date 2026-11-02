/* Presupuesto de los prompts (issue #396, idea de Atticus): el texto fijo que el código le pone a Alma no puede crecer
   sin control. Carga apps-script/*.js con dobles de Google (sin red ni hojas) y mide:
   · voz: lo que voz.js arma en código para el agente de ElevenLabs (vozQuienBloque_, SEMILLA_VOZ_, FAMILIA_VOZ_CLARA_);
   · chat: lo fijo del chat con Alma (SEMILLA_SECRETARIA_, reglas fijas, «mi sistema», la esfera) y las herramientas.
   Falla si alguno pasa del tope de .github/presupuesto-prompts.json (lo medido + 15 %). Lo que vive en las hojas
   (ALMA_INSTRUCCIONES, playbooks) no cuenta aquí: lo edita Juan.
   node .github/presupuesto-prompts.js [carpeta apps-script]   ·   --medir imprime los tamaños de hoy, sin revisar. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'apps-script');
const nada = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : nada, apply: () => nada });
const props = { getProperty: () => null, setProperty() {}, deleteProperty() {}, getKeys: () => [] };
const ctx = {
  console: { log() {}, error() {}, warn() {} }, Date, JSON, Math, String, Number, Array, Object, RegExp, Error, isNaN, encodeURIComponent, decodeURIComponent,
  PropertiesService: { getScriptProperties: () => props }, CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString() }, SpreadsheetApp: nada, LockService: nada, ScriptApp: nada, Session: nada, UrlFetchApp: nada,
  DriveApp: nada, GmailApp: nada, MailApp: nada, CalendarApp: nada, HtmlService: nada, ContentService: nada, DocumentApp: nada, LanguageApp: nada, XmlService: nada, Logger: nada
};
vm.createContext(ctx);
fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }); } catch (e) { console.error('carga ' + f + ': ' + e.message); } });
const medir = codigo => { try { return String(vm.runInContext(codigo, ctx) || '').length; } catch (e) { console.error('no pude medir: ' + codigo + ' (' + e.message + ')'); process.exit(1); } };
const hoy = {
  voz: medir("vozQuienBloque_() + SEMILLA_VOZ_ + FAMILIA_VOZ_CLARA_"),
  chat: medir("SEMILLA_SECRETARIA_ + REGLA_CODIGOS_SECRETARIA_ + REGLAS_FIJAS_SECRETARIA_ + AGENTE_MI_SISTEMA_ + chatClasificarRegla_() + JSON.stringify(agHerramientas_())")
};
if (process.argv.includes('--medir')) { console.log(JSON.stringify(hoy)); process.exit(0); }
const tope = JSON.parse(fs.readFileSync(path.join(__dirname, 'presupuesto-prompts.json'), 'utf8'));
let fallo = 0;
Object.keys(hoy).forEach(k => {
  const max = Math.round(tope[k] * (1 + tope.margen));
  const linea = k + ': ' + hoy[k] + ' caracteres (base ' + tope[k] + ', tope ' + max + ')';
  if (hoy[k] > max) { console.log('::error::El prompt de ' + k + ' creció de más: ' + linea + '. Recorta antes de agregar, o sube la base en .github/presupuesto-prompts.json con el sí de Juan.'); fallo = 1; }
  else console.log('✓ ' + linea);
});
process.exit(fallo);
