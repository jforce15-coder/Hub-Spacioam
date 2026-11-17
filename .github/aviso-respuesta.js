/* Prueba de «¿le contestó el aviso?» (apps-script/avisorespuesta.js; Juan, 17-nov-2026) con dobles: sin hoja ni Claude.
   Juan: después de una notificación en llamada o modo continuo, Alma no toma cualquier voz como respuesta; si no es para
   ella (otra plática, otra persona, ruido) se queda callada y sale sin decir nada.
   1. Sin IA: «Alma», lo corto y lo que empieza como respuesta cuentan; nada no cuenta.
   2. Lo largo lo decide el clasificador (SI / NO); si no contesta, cuenta (como antes) y se puede apagar.
   3. «calle» con aviso_id y puede_callar: silencio y nada que decir; sin puede_callar (la app de antes), como siempre.
   4. Los ganchos: la acción avisoRespuesta en Código.js y la regla en ALMA ABRE (la ficha que solo va tras un aviso; el
      prompt de voz no crece: la app pone la misma regla en su ficha con «[Alma te avisó]»).
   node .github/aviso-respuesta.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const props = {}, ia = { resp: 'NO', veces: 0, ultimo: '' };
const ctx = {
  console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  CFG: { MODELO_CLASIFICADOR: 'haiku' },
  claude_: (m, n, sys, user) => { ia.veces++; ia.ultimo = user; return ia.resp; },
  chatSesAdm_: s => (s === 'ok' ? { email: 'juan@x.com', principal: true } : null),
  calleAvisoHist_: (adm, id) => (id === 'a1' ? { id: 'a1', texto: 'Ya quedó listo el cambio de facturas; falta que lo unas.' } : null)
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'avisorespuesta.js'), 'utf8'), ctx);
const juez = (t, a) => ctx.avisoEsRespuesta_(t, a || 'Ya quedó listo el cambio de facturas.');

// 1. Sin IA
ia.veces = 0;
ok(juez('Sí').es && juez('dime').es && juez('¿Qué pasó?').es && juez('no, luego').es, 'lo corto justo después del aviso es su respuesta');
ok(juez('Alma, ¿cuál cambio era ese que dices de las facturas?').por === 'nombro_a_alma', 'si nombran a Alma, es para ella');
ok(juez('Sí, léemelo completo por favor').por === 'empieza_como_respuesta' && juez('Dale, únelo ya y avísame').es, 'lo que empieza como respuesta y es corto, cuenta');
ok(!juez('').es && !juez('   ').es && juez('').por === 'nada', 'sin palabras no es respuesta');
ok(ia.veces === 0, 'nada de eso gasta IA');

// 2. Lo largo, el clasificador
ia.resp = 'NO'; ia.veces = 0;
const otra = juez('entonces le dije al proveedor que el martes no podemos recibir el pedido en la bodega');
ok(!otra.es && otra.por === 'ia_no' && ia.veces === 1, 'otra plática larga: el clasificador dice NO y Alma calla');
ok(/AVISO QUE DIJO ALMA/.test(ia.ultimo) && /facturas/.test(ia.ultimo) && /proveedor/.test(ia.ultimo), 'el clasificador ve el aviso y lo que se oyó');
ok(!juez('bueno pues yo creo que mejor lo vemos en la junta del jueves con todos').es, '«bueno…» largo no cuenta solo por empezar así');
ia.resp = 'SI';
ok(juez('espérame que estoy en una reunión, cuéntame más tarde qué cambió en las facturas').por === 'ia_si', 'si el clasificador dice SI, contesta');
ia.resp = '';
ok(juez('una frase larga que nadie sabe si es para ella o para la otra persona aquí').por === 'sin_juez', 'si la IA no contesta, cuenta como antes');
props.AVISO_JUEZ_APAGADO = '1'; ia.resp = 'NO';
ok(juez('entonces le dije al proveedor que el martes no podemos recibir el pedido').por === 'apagado', 'AVISO_JUEZ_APAGADO = 1 lo apaga');
delete props.AVISO_JUEZ_APAGADO;

// La acción
ia.resp = 'NO';
const r = ctx.avisoRespuesta_('ok', { texto: 'entonces le dije al proveedor que el martes no podemos recibir el pedido', aviso_id: 'a1' });
ok(r.ok && r.es === false && /facturas/.test(ia.ultimo), 'avisoRespuesta busca el aviso por su id y dice que no');
ok(ctx.avisoRespuesta_('x', { texto: 'sí' }).error === 'session', 'sin sesión no responde');

// 3 y 4. Los ganchos en el código
const calle = fs.readFileSync(path.join(DIR, 'calle.js'), 'utf8'), cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
const abre = fs.readFileSync(path.join(DIR, 'almaabre.js'), 'utf8');
ok(/b\.aviso_id && b\.puede_callar[\s\S]{0,300}avisoEsRespuesta_[\s\S]{0,300}silencio: true/.test(calle), '«calle» con aviso_id y puede_callar: silencio sin decir nada (la app de antes, como siempre)');
ok(/case 'avisoRespuesta': return json_\(avisoRespuesta_\(ses, body\)\)/.test(cod), 'la acción avisoRespuesta está en el Hub');
ok(/no responde a tu aviso ni te habla a ti[\s\S]{0,120}skip_turn y no digas nada/.test(abre), 'ALMA ABRE: lo mismo en lo que sigue de la conversación que abre');
process.exit(fallo);
