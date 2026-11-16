/* «Nunca un dato sin fuente» (#583 T5; Juan, 16-nov-2026: «Alma nunca dice un dato que no esté verificado»). Revisa, sobre
   lo que arma .github/prompts-armados.js (dobles de Google, sin red, hoja vacía):
   1. la regla está en el prompt de cada canal (chat, WhatsApp, calle y voz): un nombre, apartamento o número solo se dice
      si salió de una herramienta en este turno o del tema, y un borrador nunca empieza con «Listo»;
   2. la voz dice nombres, apartamentos y números solo como se los da su sistema (decir), nunca de memoria;
   3. las herramientas que le escriben a alguien describen al destinatario con la misma frase (se resuelve con su fuente);
   4. la llamada: un resumen de ElevenLabs con «la huésped Jimena» (un nombre como se dictó) ya no entra tal cual a
      quien_llama (CONTEXTO RECIENTE): el nombre se quita, lo dicho por Juan y lo de la llamada va «sin verificar», y lo
      que Alma escribió en el Hub con sus herramientas queda igual.
   node .github/dato-con-fuente.js [carpeta apps-script] */
const path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const { armar } = require('./prompts-armados.js');
const a = armar(DIR), ctx = a._ctx;

/* 1 y 2 · La regla en el prompt de cada canal. */
const REGLA = 'que no salió de una herramienta en este turno o del tema: sin fuente, es pregunta', BORRADOR = 'Un borrador nunca empieza con «Listo»';
['chat_texto', 'whatsapp_texto', 'calle_texto', 'voz'].forEach(k => {
  const t = a[k].join('\n');
  ok(t.indexOf(REGLA) >= 0 && t.indexOf(BORRADOR) >= 0, k + ': un nombre, apartamento o número sin fuente es pregunta, y un borrador nunca empieza con «Listo»');
});
ok(a.voz[0].indexOf('Nombres, apartamentos y números: solo los que te da (decir), tal cual; nunca de memoria') >= 0, 'voz: nombres, apartamentos y números solo los que da su sistema (decir), tal cual');

/* 3 · El destinatario, con la misma frase en cada herramienta que escribe a alguien. */
const tools = JSON.parse(a.chat_herramientas[0]), por = {}; tools.forEach(t => { por[t.name] = t; });
['escribir_a_equipo', 'encargar_conversacion', 'programar_mensaje', 'mensaje_personal'].forEach(n => {
  const d = (((por[n] || {}).input_schema || {}).properties || {}).persona || {};
  ok(/se resuelve solo, con su fuente/.test(d.description || ''), n + ': persona se resuelve solo, con su fuente');
});

/* 4 · CONTEXTO RECIENTE de la llamada, con nombres de prueba (no son reales). */
const JUAN = { email: 'juan@prueba', nombre: 'Juan Prueba', principal: true, tels: ['50211110000'] };
const hace = m => new Date(Date.now() - m * 60000).toISOString();
const FILAS = [
  { id: 'op1', ts: hace(9), de: 'yo', canal: 'hub', texto: 'Escríbele a la huésped Jimena que su llegada es a las 3' },
  { id: 'op2', ts: hace(8), de: 'alma', canal: 'hub', texto: 'Le llegó a Ana Prueba, la socia de Edificio Alto 633.' },
  { id: 'oplcortada99_1', ts: hace(7), de: 'yo', canal: 'llamada', texto: 'mándale a la huésped Jimena el código' },   // una llamada que se cortó: sin resumen, sus turnos sí entran
  { id: 'oplabcdef12_0', ts: hace(5), de: 'alma', canal: 'llamada', texto: '📞 Llamada por teléfono · 1:10 · Código para la huésped Jimena\nJuan asked Alma to send the guest Jimena the door code for Edificio Alto 623.' }
];
Object.assign(ctx, {
  opFilas_: () => FILAS.slice(), claude_: () => 'el código de la huésped Jimena', vozLookup_: () => ({ caller_type: 'juan', caller_name: 'Juan' }),
  adminsOp_: () => [JUAN], adminPorTel_: () => JUAN, encargoAbierto_: () => null, vozMarcaPara_: () => 'ninguna'
});
ctx.Utilities.base64EncodeWebSafe = s => Buffer.from(String(s)).toString('base64');
const ini = vm.runInContext('vozInicio_({ caller_id: "50211110000" })', ctx), quien = ini.dynamic_variables.quien_llama;
const saludo = (((ini.conversation_config_override || {}).agent) || {}).first_message || '';
ok(/^¡Hola, Juan! ¿Retomamos lo del código de la huésped, o/.test(saludo), 'el saludo ofrece retomar sin el nombre dictado: «' + saludo + '»');
const ctxR = quien.slice(quien.indexOf('CONTEXTO RECIENTE'));
ok(quien.indexOf('CONTEXTO RECIENTE') >= 0, 'la llamada de Juan trae su CONTEXTO RECIENTE');
ok(!/huésped Jimena|guest Jimena/.test(ctxR.split('\n').filter(l => /\[llamada/.test(l)).join('\n')), 'un resumen o un turno de llamada con «la huésped Jimena» ya no entra tal cual a quien_llama');
ok(/the guest \(nombre sin verificar\)/.test(ctxR) && /huésped \(nombre sin verificar\)/.test(ctxR), 'en lo de la llamada el nombre dictado se cambia por «(nombre sin verificar)»');
ok(/\] Juan \(sin verificar\): Escríbele a la huésped Jimena/.test(ctxR) && /\] Juan \(sin verificar\): mándale/.test(ctxR), 'lo que dijo Juan va marcado «sin verificar»');
ok(/\] Alma \(resumen, sin verificar\): 📞/.test(ctxR), 'el resumen de la llamada va marcado «sin verificar»');
ok(ctxR.indexOf('] Alma: Le llegó a Ana Prueba, la socia de Edificio Alto 633.') >= 0, 'lo que Alma escribió en el Hub con sus herramientas queda igual');
let aviso = '\u0000'; try { aviso = vm.runInContext('CTX_SIN_VERIFICAR_', ctx); } catch (e) {}
ok(ctxR.indexOf(aviso) >= 0, 'el contexto dice que lo «sin verificar» solo se dice si lo confirma su sistema');
let sinNombre = ''; try { sinNombre = vm.runInContext('ctxSinNombres_("el socio Juan y la señora Martínez López llamaron. La huésped Jimena\\nJuan pidió")', ctx); } catch (e) {}
ok(sinNombre === 'el socio Juan y la señora (nombre sin verificar) llamaron. La huésped (nombre sin verificar)\nJuan pidió', 'Juan, Alma y Claudio no se quitan (tampoco pegados a otro nombre); un nombre de dos palabras sí');

process.exit(fallo);
