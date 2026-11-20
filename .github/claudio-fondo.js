/* Prueba de apps-script/claudiofondo.js (guardia 20-nov-2026, pc1795168039754): un pedido para Claudio dicho en una
   llamada se guarda y la llamada sigue; lo pesado (microproyecto, unificar, issue, lanzar) sale en segundo plano.
   Revisa que:
   1. vozParaClaude_ guarda el pedido y dice «quedó pedido» sin llamar a claudeMandarYa_ (ya existe: está guardado);
   2. si no se pudo guardar, o es una orden de unir, se hace todo en la llamada como antes;
   3. el disparador los manda en orden (el más viejo primero), cada uno se saca antes de mandarlo y con las palabras de
      Juan de esa llamada (conv, copia, hasta);
   4. un error se reintenta 2 veces y luego avisa a Juan en Pendientes; si no arrancó a Claudio, también avisa;
   5. la traza (voz_traza) dice dónde se va el tiempo: d.pc en la llamada y «claudio_fondo» con sus partes.
   node .github/claudio-fondo.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

function caja(o) {
  o = o || {};
  const props = {}, cache = {}, triggers = [], log = { mandados: [], avisos: [], chat: [], traza: [], lit: [] };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => {
      if (o.sinGuardar) throw new Error('sin cupo'); props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getKeys: () => Object.keys(props) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: h => ({ timeBased: () => ({ after: () => ({ create: () => { triggers.push({ getHandlerFunction: () => h }); } }) }) }) },
    cupoCanal_() {}, LITERAL_LLAMADA_: null, VOZ_T0_: 0, VOZ_MS_: null, CHAT_DESARROLLO_: 'Desarrollo',
    adminPorEmail_: e => ({ email: e, nombre: 'Juan', principal: true }),
    literalLlamadaPoner_(conv, copia, hasta) { ctx.LITERAL_LLAMADA_ = { conv, copia, hasta }; log.lit.push({ conv, copia, hasta }); },
    opGuardar_: (adm, quien, canal, texto) => { log.chat.push(quien + ': ' + texto); },
    pendAvisar_: (adm, texto) => { log.avisos.push(texto); return true; },
    vozTraza_: (h, b, out) => { log.traza.push({ h, ms: Date.now() - ctx.VOZ_T0_, d: JSON.parse(JSON.stringify(ctx.VOZ_MS_ || {})), out }); },
    unirOrden_: t => /^une\b/i.test(t) ? { cuales: ['todos'] } : null,
    claudeMandarYa_(adm, texto, op) {
      if (o.mandar) return o.mandar(texto, ctx);
      ctx.pcMs_('unificar', Date.now() - 5); ctx.pcMs_('lanzar', Date.now() - 7);
      log.mandados.push({ texto, nivel: op.nivel, lit: ctx.LITERAL_LLAMADA_ && ctx.LITERAL_LLAMADA_.conv, props: Object.keys(props).length });
      return { texto: 'Listo, quedó pedido.', voz: 'HECHO. Dile solo: «Listo, quedó pedido.».', claude: { ok: true, directo: true } };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(leer('claudiofondo.js'), ctx, { filename: 'claudiofondo.js' });
  /* vozParaClaude_ tal cual está en voz.js (con su VOZ_MEJORA_RE_). */
  const voz = leer('voz.js');
  const re = voz.match(/var VOZ_MEJORA_RE_ = [^\n]+\n/)[0];
  const ini = voz.indexOf('function vozParaClaude_('), fin = voz.indexOf('\n}\n', ini) + 3;
  vm.runInContext(re + voz.slice(ini, fin), ctx, { filename: 'voz.js' });
  return { ctx, props, triggers, log };
}
const juan = { email: 'juan@x', nombre: 'Juan', principal: true };

// 1. Guarda y contesta enseguida
{
  const c = caja(); c.ctx.VOZ_MS_ = { antes: 0 };
  c.ctx.LITERAL_LLAMADA_ = { conv: 'conv_abc', copia: 'que el botón sea verde', hasta: 123 };
  const r = c.ctx.vozParaClaude_(juan, 'Mejora para Claude (sencillo): que el botón sea verde');
  ok(r.ok && /quedó pedido/.test(r.resultado), '1. dice «quedó pedido»');
  ok(c.log.mandados.length === 0, '1. no manda a Claudio mientras la llamada espera');
  ok(Object.keys(c.props).filter(k => k.indexOf('PCVOZ_') === 0).length === 1, '1. el pedido ya existe (guardado) cuando lo dice');
  ok(c.triggers.length === 1 && c.triggers[0].getHandlerFunction() === 'paraClaudeVozPronto', '1. deja el disparador de segundo plano');
  ok(c.log.chat.length === 1 && /^yo: /.test(c.log.chat[0]), '1. su pedido queda en su chat');
  ok(c.ctx.VOZ_MS_.via === 'claudio' && c.ctx.VOZ_MS_.pc && 'cola' in c.ctx.VOZ_MS_.pc && 'chat' in c.ctx.VOZ_MS_.pc, '1. la traza dice el camino y sus partes (d.pc)');
  c.ctx.vozParaClaude_(juan, 'Mejora para Claude: y que parpadee');
  ok(c.triggers.length === 1, '1. un solo disparador aunque pida varias cosas');

  // 3. En orden, sacado antes, con sus palabras
  c.ctx.paraClaudeVozPronto();
  ok(c.log.mandados.length === 2 && c.log.mandados[0].texto === 'que el botón sea verde' && c.log.mandados[1].texto === 'y que parpadee', '3. los manda en orden, el más viejo primero');
  ok(c.log.mandados[0].nivel === 'sencillo', '3. con el nivel que dijo Alma');
  ok(c.log.mandados[0].props === 1 && c.log.mandados[1].props === 0, '3. cada pedido se saca antes de mandarlo (nunca se repite)');
  ok(c.log.lit[0] && c.log.lit[0].conv === 'conv_abc' && c.log.lit[0].copia === 'que el botón sea verde' && c.log.lit[0].hasta === 123, '3. con las palabras de Juan de esa llamada');
  ok(c.log.chat.filter(x => /^alma: /.test(x)).length === 2, '3. el resultado real queda en su chat');
  ok(c.log.avisos.length === 0, '3. si salió bien, no molesta a Juan');
  // 5. Traza del segundo plano
  const tf = c.log.traza.filter(t => t.h === 'claudio_fondo');
  ok(tf.length === 2 && tf[0].out.ok && tf[0].d.unificar >= 0 && tf[0].d.lanzar >= 0 && 'total' in tf[0].d && 'espera' in tf[0].d, '5. «claudio_fondo» en la traza, con sus partes (unificar, lanzar, total, espera)');
  ok(c.ctx.PC_MS_ === null && c.ctx.LITERAL_LLAMADA_ === null, '5. limpia el cronómetro y las palabras al terminar');
  ok(c.triggers.length === 0, '3. sin pendientes, no deja otro disparador');
}

// 2. No se pudo guardar / orden de unir: como antes
{
  const c = caja({ sinGuardar: true }); c.ctx.VOZ_MS_ = {};
  const r = c.ctx.vozParaClaude_(juan, 'Mejora para Claude: que el botón sea verde');
  ok(r.ok && c.log.mandados.length === 1, '2. si no se pudo guardar, se manda en la llamada (nunca «quedó pedido» sin pedido)');
  const c2 = caja(); c2.ctx.VOZ_MS_ = {};
  c2.ctx.vozParaClaude_(juan, 'Mejora para Claude: une todo');
  ok(c2.log.mandados.length === 1 && !Object.keys(c2.props).length, '2. una orden de unir se cumple en la llamada');
}

// 4. Errores
{
  let n = 0;
  const c = caja({ mandar: () => { n++; throw new Error('GitHub caído'); } }); c.ctx.VOZ_MS_ = {};
  c.ctx.vozParaClaude_(juan, 'Mejora para Claude: que el botón sea verde');
  c.ctx.paraClaudeVozProcesar_();
  ok(n === 3 && c.log.avisos.length === 1 && /No pude mandarle a Claudio/.test(c.log.avisos[0]), '4. un error se intenta 3 veces y luego le avisa a Juan');
  ok(!Object.keys(c.props).filter(k => k.indexOf('PCVOZ_') === 0).length, '4. no queda en la fila para siempre');
  const c2 = caja({ mandar: () => ({ texto: 'Quedó guardado, pero Google se quedó sin cupo.', claude: { ok: true, directo: false } }) }); c2.ctx.VOZ_MS_ = {};
  c2.ctx.vozParaClaude_(juan, 'Mejora para Claude: que el botón sea verde');
  c2.ctx.paraClaudeVozProcesar_();
  ok(c2.log.avisos.length === 1 && /no arrancó/.test(c2.log.avisos[0]), '4. si no arrancó a Claudio, Juan lo sabe en Pendientes');
}

// Conexión: procesarCola es el respaldo; chat.js y paraclaude.js usan el cronómetro
ok(/paraClaudeVozProcesar_\(\)/.test(leer('Código.js')), 'procesarCola manda lo que quedó si el disparador no corrió');
ok(/pcMs_\('unir'/.test(leer('chat.js')) && /pcMs_\('borrador'/.test(leer('chat.js')), 'claudeMandarYa_ mide unir y borrador');
['unificar', 'issue', 'lanzar', 'hoja'].forEach(k => ok(new RegExp("pcMs_\\('" + k + "'").test(leer('paraclaude.js')), 'paraClaudeCrear_ mide ' + k));
process.exit(fallo);
