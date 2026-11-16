/* Prueba con dobles de «une se hace, no se pide» (apps-script/unirorden.js, unir.js, chat.js), sin GitHub ni Claude.
   16-nov-2026, Juan: «en lugar de resolver, Alma dice que resolvió y no está resolviendo nada». Ese día dijo «une todo»,
   «unir», «unámoslo ahora» o «une el cambio de …» más de diez veces y recibió «Listo, quedó pedido»: la orden se volvía
   un pedido nuevo a Desarrollo y nada se unía. Y una nota de voz sobre un huésped que terminaba en «Unir en los demás»
   unió dos cambios, uno con «(unir solo con Juan presente)» en el título. Revisa que:
   1. las frases reales de ese día se cumplen ahí mismo (se une de verdad) y NO sale ningún pedido a Desarrollo;
   2. la respuesta es el resultado real: qué se unió; si no se pudo, por qué, y nunca «Listo» sin haber unido;
   3. «¿hay algo pendiente para unir?» se contesta con la lista, sin pedir nada;
   4. un pedido de verdad que empieza con «une» («une las dos pantallas en una») sigue saliendo a Desarrollo;
   5. otra persona que no es el administrador principal no une nada por este camino;
   6. la herramienta unir_cambio no une si el mensaje habla de otra cosa (la nota de voz del huésped), y «todos» no toca
      el cambio que pide unirse aparte;
   7. si la herramienta ya unió en el turno, no sale además un pedido ni se pisa lo que dijo Alma.
   node .github/unir-orden.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const JUAN = { email: 'juan@x.com', nombre: 'Juan', principal: true }, GABY = { email: 'gaby@x.com', nombre: 'Gabriel', principal: false };
const U = n => 'https://github.com/jforce15-coder/Hub-Spacioam/pull/' + n;
const PRS = () => [
  { repo: 'jforce15-coder/Hub-Spacioam', app: 'Hub', numero: 562, titulo: 'Alma · Modo chat de la llamada: Alma también se oye', url: U(562), estado: 'listo' },
  { repo: 'jforce15-coder/alma-app', app: 'App de Alma', numero: 76, titulo: 'Alma · Modo chat de la llamada: Alma también se oye', url: 'https://github.com/jforce15-coder/alma-app/pull/76', estado: 'listo' },
  { repo: 'jforce15-coder/Hub-Spacioam', app: 'Hub', numero: 541, titulo: 'Alma · Pedidos en órbita: al tocarlos, Alma explica', url: U(541), estado: 'choque' },
  { repo: 'jforce15-coder/Hub-Spacioam', app: 'Hub', numero: 581, titulo: 'Fotos de contactos desde Google: activar People (unir solo con Juan presente)', url: U(581), estado: 'listo' }];

function caja(o) {
  o = o || {};
  const mem = {}, cache = {}, log = { claude: [], unidos: [], borrados: 0 };
  let abiertos = o.prs ? o.prs() : PRS();
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty: k => { delete mem[k]; log.borrados++; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) }
  };
  vm.createContext(ctx);
  ['unir.js', 'unirorden.js', 'chat.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  Object.assign(ctx, {
    esAdminPrincipal_: a => !!(a && a.principal),
    /* GitHub de mentira: la lista de abiertos y el «merge» (403 si o.sinPermiso lo dice). */
    prsAbiertos_: () => o.sinGithub ? null : abiertos.map(x => Object.assign({}, x)),
    unirGh_: (metodo, ruta) => {
      const m = /\/repos\/(.+)\/pulls\/(\d+)\/merge$/.exec(ruta); if (metodo !== 'put' || !m) return { codigo: 404, j: null };
      if (o.sinPermiso && o.sinPermiso(+m[2])) return { codigo: 403, j: null };
      log.unidos.push(+m[2]); abiertos = abiertos.filter(x => !(x.numero === +m[2] && x.repo === m[1])); return { codigo: 200, j: { merged: true } };
    },
    microUnido_: () => {},
    microAbiertos_: () => [{ id: 'mp1', nombre: 'Cuando estemos en el chat', pr: U(562) + '\nhttps://github.com/jforce15-coder/alma-app/pull/76' }, { id: 'mp2', nombre: 'Tanto en la app de', pr: '' }],
    /* El camino del pedido a Desarrollo, con dobles: si se llega aquí, salió un pedido. */
    claudeBorradorLeer_: () => null, microElegir_: () => ({ nuevo: true }), chatUltimaDeClaude_: () => '', claudeNivelPedido_: () => '', claudeNivel_: n => n || 'complejo', microLeer_: () => null,
    escalarJson_: (adm, x) => x, claudeBorradorTitulo_: b => b.partes[0].slice(0, 40), pendCerrar_: () => {},
    paraClaudeCrear_: (adm, inp) => { log.claude.push(inp.resumen); return { ok: true, id: 'pc1', claude: true, micro: { id: 'mpN', nombre: 'x' } }; }
  });
  return { ctx, log, mandar: (t, adm, op) => ctx.claudeMandarYa_(adm || JUAN, t, op || {}) };
}

/* ── 1 y 2 ── Las frases reales del 16-nov: se une de verdad y no sale ningún pedido. */
for (const frase of ['Unir todo', 'Unir', 'Sí, unir.', 'Unemos todo.', 'Eh, unámoslo ahora.', 'Une todo lo que tengamos pendiente', 'Unir todos los cambios y PRs pendientes listos (en segundo plano)',
  'Unir todos los cambios y PRs pendientes listos (rutina de cada hora, revisión de merge, historial de Hospitable, etc.) y revisar qué pendientes quedan bloqueados o necesitando respuesta para limpiarlos.', 'Unirlo ahora.', 'Unir ambos.']) {
  const c = caja(), r = c.mandar(frase);
  ok(r.accion === 'unir' && c.log.claude.length === 0 && c.log.unidos.join() === '562,76', '«' + frase.slice(0, 60) + '» → une los dos listos, sin pedido a Desarrollo');
  if (frase === 'Unir todo') {
    ok(/^Listo, uní 2 cambios: Hub #562 · .*; App de Alma #76/.test(r.texto) && /Se publica solo/.test(r.texto), 'dice qué unió: ' + r.texto.slice(0, 110));
    ok(/Hub #581 quedó sin unir porque su título pide unirlo aparte/.test(r.texto) && c.log.unidos.indexOf(581) < 0, '«todo» no toca el que pide unirse aparte, y lo dice');
    ok(!r.claude && /^RESULTADO REAL/.test(r.voz) && !/quedó pedido/i.test(r.texto + r.voz), 'no dice «quedó pedido» y en la llamada se dice el resultado real');
  }
}
{ const c = caja(), r = c.mandar('Une el cambio de «Cuando estemos en el chat» para que se publique.');
  ok(r.accion === 'unir' && c.log.unidos.join() === '562,76' && c.log.claude.length === 0, 'por el nombre del pedido («Cuando estemos en el chat») une sus cambios, el del Hub y el de la app'); }
{ const c = caja(), r = c.mandar('Unir ambos cambios: «Tanto en la app de» y «Cuando estemos en el chat».');
  ok(c.log.unidos.join() === '562,76' && /No encontré «Tanto en la app de» entre los cambios abiertos/.test(r.texto) && c.log.claude.length === 0, 'un nombre sin cambio abierto: une lo que sí hay y dice cuál no encontró'); }
{ const c = caja(), r = c.mandar('Une el #581');
  ok(c.log.unidos.join() === '581' && /^Listo, uní un cambio: Hub #581/.test(r.texto), 'por su número se une también el que pide unirse aparte'); }
{ const c = caja(), r = c.mandar('Une el de la app');
  ok(c.log.unidos.join() === '76' && c.log.claude.length === 0, '«une el de la app» une solo el de la app'); }
{ const c = caja(), r = c.mandar('Une el del Hub');
  ok(c.log.unidos.join() === '562,581' && /No pude unir Hub #541: Choca con lo último de main/.test(r.texto), '«une el del Hub» une los del Hub y dice cuál no se pudo y por qué'); }
{ const c = caja({ sinPermiso: n => n === 562 }), r = c.mandar('Unir todo');
  ok(c.log.unidos.join() === '76' && /^Listo, uní un cambio: App de Alma #76/.test(r.texto) && /No pude unir Hub #562: La llave de GitHub no tiene permiso/.test(r.texto), 'si GitHub no deja unir uno, dice cuál y por qué: ' + r.texto.slice(0, 200)); }
{ const c = caja({ sinPermiso: () => true }), r = c.mandar('Unir todo');
  ok(c.log.unidos.length === 0 && /^No uní nada\./.test(r.texto) && !/^\W*Listo/.test(r.texto) && c.log.claude.length === 0, 'si no se unió nada, nunca dice «Listo»: ' + r.texto.slice(0, 90)); }
{ const c = caja({ prs: () => [PRS()[2]] }), r = c.mandar('Unir todo');
  ok(c.log.unidos.length === 0 && /^No uní nada\./.test(r.texto) && /Hub #541/.test(r.texto) && /choca con lo último de main/.test(r.texto), 'ninguno listo: dice cuál espera y por qué (choca con main)'); }
{ const c = caja({ prs: () => [] }), r = c.mandar('Unir todo');
  ok(/No hay cambios pendientes de unir/.test(r.texto) && c.log.claude.length === 0, 'sin cambios abiertos: lo dice, sin pedido'); }
{ const c = caja({ sinGithub: true }), r = c.mandar('Unir todo');
  ok(/No pude ver los cambios/.test(r.texto) && /No uní nada/.test(r.texto) && c.log.claude.length === 0, 'sin la llave o sin GitHub: lo dice y no inventa'); }

/* ── 3 ── La pregunta se contesta con la lista. */
for (const frase of ['¿Qué cambios están pendientes de unir?', 'Revisar si hay pendientes para unir o dar merge', '¿Hay algo pendiente para unir, Alma?', '¿Tenemos algo pendiente para unir?']) {
  const c = caja(), r = c.mandar(frase);
  ok(r.accion === 'unir' && c.log.unidos.length === 0 && c.log.claude.length === 0 && /Hay 4 cambios abiertos \(3 listos para unir\)/.test(r.texto) && /Hub #541 · .*\(choca con lo último de main\)/.test(r.texto), '«' + frase + '» → la lista de cambios, sin unir y sin pedido');
}

/* ── 4 ── Un pedido de verdad sigue saliendo a Desarrollo. */
for (const frase of ['Une las pantallas de Pendientes y Notificaciones en una sola', 'Une todo en una sola pantalla para que no haya que cambiar de pestaña', 'El ícono del avión solo debe aparecer cuando hay un viaje cercano',
  'Cuando Alma se desconecte o cierre la llamada, agregar una señal sonora de salida', 'Unir en los demás', 'Quiero que el botón de unir de Pendientes sea más grande']) {
  const c = caja(), r = c.mandar(frase);
  ok(r.accion === 'mandar' && c.log.claude.length === 1 && c.log.unidos.length === 0, '«' + frase.slice(0, 60) + '» → es un pedido: sale a Desarrollo y no une nada');
}

/* ── 5 ── Solo el administrador principal. */
{ const c = caja();
  ok(c.ctx.unirOrdenHacer_(GABY, 'Unir todo') === null && c.log.unidos.length === 0, 'otra persona: «unir todo» no une nada por este camino'); }

/* ── 6 ── La herramienta unir_cambio y el mensaje que habla de otra cosa. */
{ const c = caja(), g = c.ctx.unirGuardia_;
  const NOTA = '[nota de voz] Almas sí podemos porqueee el huésped ingresa hasta las tres de la tarde y el huésped del D6 solo necesita algunas horas. Unir en los demás';
  ok(g('todos', NOTA) && g('todos', NOTA).ok === false && /NO UNÍ NADA/.test(g('todos', NOTA).error), 'la nota de voz del huésped (16-nov) ya no une nada');
  ok(g('todos', 'Mándale el código de emergencia al huésped del D6 y avísame cuando responda') !== null, 'un mensaje sin «une»: no se une');
  for (const t of ['Une todo', 'unir', 'Sí', 'sí, los dos', 'dale', 'Une el de la app', 'Unir todos los cambios y PRs pendientes listos (en segundo plano)', 'Antes de seguir con lo del huésped, une el PR #588 por favor que ya está listo', 'publícalo'])
    ok(g('todos', t) === null, '«' + t.slice(0, 50) + '» sí deja unir');
  ok(g('', NOTA) === null, 'sin «cual» (solo ver la lista) no hay nada que frenar');
  ok(g('todos', '') === null, 'sin texto del turno (el botón Unir de la app) no se frena');
  ok(c.ctx.unirCambio_('todos').unidos.map(x => x.pr).join() === 'Hub #562,App de Alma #76' && c.log.unidos.indexOf(581) < 0, 'unir_cambio «todos» no toca el que pide unirse aparte');
  const c2 = caja({ prs: () => [PRS()[3]] }), r2 = c2.ctx.unirCambio_('todos');
  ok(r2.ok === false && /pide unirse aparte/.test(r2.error) && c2.log.unidos.length === 0, 'si el único listo pide unirse aparte, «todos» lo dice y no lo une');
  ok(/case 'unir_cambio':[\s\S]{0,260}unirGuardia_\(inp\.cual, AGENTE_TEXTO_\)[\s\S]{0,120}unirCambio_\(inp\.cual\)/.test(leer('agente.js')), 'agente.js: unir_cambio pasa por la guardia antes de unir'); }

/* ── 7 ── Al cerrar el turno (chatDesarrollo_). */
{ const c = caja(), hechas = [{ tipo: 'cambio', resumen: 'Unido Hub #562 · …' }];
  const d = c.ctx.chatDesarrollo_(JUAN, 'Unir todo', 'Listo, uní Hub #562.', hechas, {});
  ok(d.texto === 'Listo, uní Hub #562.' && c.log.claude.length === 0 && c.log.unidos.length === 0, 'si la herramienta ya unió en el turno: queda lo que dijo Alma, sin «quedó pedido» ni pedido de más'); }
{ const c = caja(), hechas = [];
  const d = c.ctx.chatDesarrollo_(JUAN, 'Unir todo', '', hechas, {});
  ok(/^Listo, uní 2 cambios/.test(d.texto) && hechas.length === 2 && hechas.every(h => h.tipo === 'cambio' && /^Unido /.test(h.resumen)) && !d.claude, 'si nadie había unido: se une al cerrar el turno y queda en lo hecho'); }
{ const c = caja(), hechas = [{ tipo: 'borrador_claude', resumen: 'Borrador' }];
  const d = c.ctx.chatDesarrollo_(JUAN, 'Unir todo', '', hechas, {});
  ok(/^Listo, uní 2 cambios/.test(d.texto) && c.log.claude.length === 0 && c.log.borrados >= 1, 'si Alma había armado un pedido por «unir todo», no sale y su borrador se borra'); }
{ const cs = leer('chat.js'), i = cs.indexOf('function claudeMandarYa_');
  ok(i > 0 && /unirOrdenHacer_\(adm, texto\)/.test(cs.slice(i, i + 700)) && cs.slice(i, i + 900).indexOf('unirOrdenHacer_') < cs.slice(i, i + 900).indexOf('claudeBorradorPoner_'), 'chat.js: la orden de unir se revisa antes de armar cualquier pedido (vale para chat, app, WhatsApp y llamada)'); }
process.exit(fallo);
