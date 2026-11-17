/* Prueba de apps-script/maricarmen.js (Juan, 17-nov-2026, #706): «comunícame con Maricarmen» desde cualquier canal.
   Revisa que:
   1. reconoce pedirla («pásame / comunícame / quiero hablar con Maricarmen») y volver («pásame con Alma»), y que
      «escríbele a Maricarmen» (una persona) no la pide;
   2. en el chat (hub, app = Chat con Alma y Pendientes), WhatsApp y la llamada: pedirla la deja activa y contesta al
      instante sin la IA si el mensaje es solo el cambio; si trae otro pedido, la IA contesta como Maricarmen;
   3. queda activa en los mensajes siguientes hasta «pásame con Alma»; con otro administrador nunca;
   4. la calle no cambia (manda la app), pero su «pásame con Alma» apaga la del chat;
   5. está conectada: opAgente_ la decide antes del turno, y un turno nuevo no hereda la del anterior.
   node .github/maricarmen-canales.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const memo = {};
const caja = {
  console, esAdminPrincipal_: a => !!(a && a.principal), IDENTIDAD_VOZ_: '',
  CacheService: { getScriptCache: () => ({ get: k => memo[k] || null, put: (k, v) => { memo[k] = v; }, remove: k => { delete memo[k]; } }) }
};
vm.createContext(caja);
vm.runInContext(fs.readFileSync(path.join(DIR, 'maricarmen.js'), 'utf8'), caja);
const P = caja.maricarmenPedido_;
['Pásame con Maricarmen', 'Alma, comunícame con Maricarmen', 'quiero hablar con Mari Carmen', 'Alma, quiero hablar con Maricarmen', 'me comunicas con Maricarmen por favor', 'Quiero comunicarme con Maricarmen']
  .forEach(t => ok(P(t) === 'maricarmen', '1. «' + t + '» la pide'));
['Pásame con Alma', 'vuelve Alma', 'quiero hablar con Alma'].forEach(t => ok(P(t) === 'alma', '1. «' + t + '» vuelve con Alma'));
['Escríbele a Maricarmen que mañana llego', 'Hola Maricarmen', 'dime las llegadas de hoy'].forEach(t => ok(P(t) === '', '1. «' + t + '» no cambia nada'));

const juan = { email: 'principal@x', principal: true }, otro = { email: 'otro@x', principal: false };
const turno = (adm, t, canal) => { caja.IDENTIDAD_VOZ_ = ''; caja.WEEBO_ALTER_ = ''; const r = caja.maricarmenTurno_(adm, t, canal); return Object.assign({ voz: caja.IDENTIDAD_VOZ_, weebo: caja.WEEBO_ALTER_ }, r); };
for (const canal of ['hub', 'app', 'whatsapp', 'llamada']) {
  for (const k in memo) delete memo[k];
  let r = turno(juan, 'Alma, comunícame con Maricarmen', canal);
  ok(r.alter === 'maricarmen' && r.salida && /Maricarmen/.test(r.salida.respuesta) && r.voz === 'Maricarmen' && r.weebo === 'maricarmen', '2. ' + canal + ': pedirla contesta al instante como Maricarmen');
  r = turno(juan, 'dime las llegadas de hoy', canal);
  ok(r.alter === 'maricarmen' && !r.salida && r.voz === 'Maricarmen', '3. ' + canal + ': el mensaje siguiente lo contesta Maricarmen (con la IA)');
  r = turno(juan, 'Pásame con Alma', canal);
  ok(r.alter === '' && r.salida && /Alma/.test(r.salida.respuesta) && r.voz === '', '3. ' + canal + ': «pásame con Alma» vuelve con Alma');
  r = turno(juan, 'dime las llegadas de hoy', canal);
  ok(r.alter === '' && r.voz === '', '3. ' + canal + ': después contesta Alma');
}
for (const k in memo) delete memo[k];
let r = turno(juan, 'pásame con Maricarmen y dime las llegadas de hoy', 'app');
ok(r.alter === 'maricarmen' && !r.salida && r.voz === 'Maricarmen', '2. con otro pedido: cambia y la IA contesta como Maricarmen');
r = turno(juan, 'Pásame con Alma', 'calle');
ok(r.alter === '' && !r.salida && !caja.maricarmenActiva_(juan), '4. calle: no contesta ella, pero su «pásame con Alma» apaga la del chat');
r = turno(juan, 'Pásame con Maricarmen', 'calle');
ok(r.alter === '' && !r.salida && !caja.maricarmenActiva_(juan) && r.voz === '', '4. calle: pedirla lo maneja la app (no cambia el chat)');
r = turno(otro, 'Pásame con Maricarmen', 'hub');
ok(r.alter === '' && !r.salida && r.voz === '' && !caja.maricarmenActiva_(otro), '3. con otro administrador, Maricarmen no existe');
r = turno(juan, 'Pásame con Alma', 'hub');
ok(r.alter === '' && !r.salida, '3. «pásame con Alma» sin Maricarmen activa sigue con la IA de siempre');

const ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8');
const i = ag.indexOf('function opAgente_('), cuerpo = ag.slice(i, ag.indexOf('\n}', i));
ok(i >= 0 && /maricarmenTurno_\(adm, texto, canal\)/.test(cuerpo) && /if \(mc && mc\.salida\) return mc\.salida;/.test(cuerpo) && cuerpo.indexOf('maricarmenTurno_') < cuerpo.indexOf('weeboBloque_'), '5. opAgente_ decide quién contesta antes del Weebo y del prompt del turno');
caja.IDENTIDAD_VOZ_ = 'Maricarmen'; caja.WEEBO_ALTER_ = 'maricarmen'; caja.maricarmenTurno_(otro, 'hola', 'whatsapp');
ok(caja.IDENTIDAD_VOZ_ === '' && caja.WEEBO_ALTER_ === '', '5. un turno de otro canal escrito no hereda a Maricarmen del turno anterior');
caja.IDENTIDAD_VOZ_ = 'Maricarmen'; caja.WEEBO_ALTER_ = 'maricarmen'; caja.maricarmenTurno_(juan, 'dime las llegadas', 'calle');
ok(caja.IDENTIDAD_VOZ_ === 'Maricarmen' && caja.WEEBO_ALTER_ === 'maricarmen', '5. en la calle no la toca (la pone calle_ con lo que manda la app)');
/* Con #705 (identidad.js): si Maricarmen ya contestó este turno, chatTurnoCerrar_ no lo cambia por «abre la llamada». */
const caja2 = { console, esAdminPrincipal_: a => !!(a && a.principal), CacheService: caja.CacheService }; vm.createContext(caja2);
vm.runInContext(fs.readFileSync(path.join(DIR, 'identidad.js'), 'utf8') + '\n' + fs.readFileSync(path.join(DIR, 'maricarmen.js'), 'utf8'), caja2);
for (const k in memo) delete memo[k];
const r2 = caja2.maricarmenTurno_(juan, 'Alma, comunícame con Maricarmen', 'app');
ok(r2.salida && caja2.identidadPideAlter_(juan, 'Alma, comunícame con Maricarmen') === false, '6. con Maricarmen ya activa, la respuesta de #705 («abre la llamada») no la pisa');
process.exit(fallo);
