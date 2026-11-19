/* Claudio local (apps-script/claudiolocal.js, #629; Juan, 16-nov-2026): Claudio sin ElevenLabs en las sesiones largas.
   Con dobles de Claude, de ElevenLabs y de Google (sin internet). Revisa:
   1. vozClaudio trae la conversación local (conv_local_…), su voz de iPhone y sigue trayendo la URL firmada (apps viejas);
      con CLAUDIO_LOCAL = 0 no hay nada local;
   2. el turno (acción claudioLocal) usa el MISMO prompt de Claudio con su ficha y las reglas de voz local, el modelo rápido
      y sus mismas herramientas (sin conv_id ni sa_web);
   3. solo el principal con su sesión, y la conversación es de él;
   4. corre sus herramientas con la conversación local (para el panel y la vuelta con Alma) y avisa volver_con_alma;
   5. lo que se dice sale limpio y corto (sin etiquetas, markdown ni enlaces);
   6. la voz se afina sin PR (CLAUDIO_VOZ_LOCAL) y con límites; la acción está en el Hub y cuenta como voz en el cupo;
   4b. un pedido hecho («Listo, quedó …») se dice sin otra vuelta de la IA y el turno trae ms_ia / ms_voz (#651);
   7. de fábrica habla la voz del iPhone, sin gastar ElevenLabs (Juan, #649); {"motor":"elevenlabs"} solo ya no basta
      (Juan, 19-nov-2026: «solo voz local»); con CLAUDIO_VOZ_LOCAL {"motor":"elevenlabs"} y CLAUDIO_VOZ_ELEVENLABS = 1,
      LA MISMA voz de Claudio en ElevenLabs (#636): su voz, el modelo y los ajustes de su agente, PCM 16 kHz, en el
      saludo y en cada turno; si ElevenLabs falla, sin audio (la app usa la voz del iPhone).
   node .github/claudio-local.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const { armar } = require('./prompts-armados.js');
const a = armar(DIR), ctx = a._ctx, R = c => vm.runInContext(c, ctx);
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

let mem = {}, cache = {}, salidas = [], claude = [], resp = () => ({ codigo: 404, cuerpo: '' });
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty: k => { delete mem[k]; }, getKeys: () => Object.keys(mem) }) };
ctx.CacheService = { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; }, getAll: () => ({}), putAll() {} }) };
ctx.uf_ = (url, o) => { o = o || {}; const s = { url: String(url), metodo: String(o.method || 'get').toLowerCase(), cuerpo: o.payload ? JSON.parse(o.payload) : null }; salidas.push(s); const r = resp(s);
  return { getResponseCode: () => r.codigo, getContentText: () => (typeof r.cuerpo === 'string' ? r.cuerpo : JSON.stringify(r.cuerpo)), getBlob: () => ({ getBytes: () => r.bytes || [] }) }; };
let n = 0; ctx.Utilities = Object.assign({}, ctx.Utilities, { getUuid: () => 'ab12cd34-ef56-ab78-cd90-ef12ab34cd5' + (n++ % 10), base64Encode: b => Buffer.from(b).toString('base64') });
const JUAN = { email: 'juan@x', nombre: 'Juan Prueba', principal: true, tels: ['50211110000'] };
const ANA = { email: 'ana@x', nombre: 'Ana', principal: false, tels: ['50222220000'] };
Object.assign(ctx, { adminsOp_: () => [JUAN, ANA], adminPorTel_: t => [JUAN, ANA].filter(x => String(t).slice(-8) === x.tels[0].slice(-8))[0] || null,
  vozWebAdmin_: ses => (ses && ses.email === 'juan@x' ? JUAN : ses && ses.email === 'ana@x' ? ANA : null), normTel_: t => String(t || '').replace(/\D/g, ''),
  vozWebToken_: t => 'firma:' + t, microAbiertos_: () => [], prsAbiertos_: () => [], mfBloque_: () => '', personalidadFicha_: () => null, registrarUso_: () => {} });
/* Claude de mentira: devuelve las respuestas de la fila, una por vuelta, y anota lo que se le mandó. */
let fila = [];
ctx.claudeTools_ = (modelo, system, messages, tools, max, opc) => { claude.push({ modelo, system, messages: JSON.parse(JSON.stringify(messages)), tools, opc }); return fila.shift() || null; };
const SES = { email: 'juan@x' };
const ini = () => { salidas = []; ctx.SES_ = SES; return R("claudioWebInicio_(SES_, '')"); };

/* 1. vozClaudio trae lo local */
mem = { ELEVENLABS_KEY: 'k', CLAUDIO_AGENT_ID: 'agent_claudio' };
resp = s => /get-signed-url/.test(s.url) ? { codigo: 200, cuerpo: { signed_url: 'wss://c' } } : { codigo: 404, cuerpo: '' };
const j = ini();
ok(j.ok && j.local === true && /^conv_local_[a-f0-9]{8,40}$/.test(j.conv_id), '1 · vozClaudio trae la conversación local (' + j.conv_id + ')');
ok(j.signed_url === 'wss://c' && j.first_message && j.dynamic_variables.quien_llama, '1 · y sigue trayendo la URL firmada, el saludo y la ficha (la app vieja sigue igual)');
ok(j.voz_local && j.voz_local.genero === 'hombre' && j.voz_local.idiomas[0] === 'es-MX' && j.voz_local.velocidad > 0 && j.voz_local.tono === 1, '1 · su voz del iPhone: de hombre, español de México primero, con su tono natural (#687)');
ok(cache['claudio_' + j.conv_id] === '50211110000' && cache['claudiolocal_' + j.conv_id] === j.dynamic_variables.quien_llama, '1 · la conversación queda ligada a su teléfono y con su ficha guardada');
mem.CLAUDIO_LOCAL = '0'; const j0 = ini();
ok(j0.ok && !j0.local && !j0.conv_id && j0.signed_url, '1 · CLAUDIO_LOCAL = 0: vuelve al agente de ElevenLabs sin un PR');
delete mem.CLAUDIO_LOCAL;

/* 2. El turno: el mismo prompt, el modelo rápido y sus herramientas */
const turno = (b, ses) => { claude = []; ctx.B_ = b; ctx.S2_ = ses === undefined ? SES : ses; return R('claudioLocalApi_(S2_, B_)'); };
fila = [{ content: [{ type: 'text', text: 'Sí, el botón de pagos ya manda el aviso.' }] }];
const t1 = turno({ conv_id: j.conv_id, texto: '¿Cómo va lo del botón de pagos?', historial: [{ de: 'claudio', texto: j.first_message }] });
const c1 = claude[0], sys = JSON.parse(c1.system);
ok(t1.ok && t1.hablar === 'Sí, el botón de pagos ya manda el aviso.' && t1.volver === false, '2 · contesta con lo que dijo Claude');
ok(c1.modelo === R('rapidoModelo_()') && c1.opc.sinTemperatura && c1.opc.esfuerzo === 'low' && /Claudio/.test(c1.opc.funcion), '2 · con el modelo rápido de la voz (sin temperatura, esfuerzo bajo) y queda en el uso como «Claudio · voz local»');
const base = JSON.parse(R('claudioPromptCompleto_()'));
ok(JSON.stringify(sys.claudio.como_hablas) === JSON.stringify(base.claudio.como_hablas) && JSON.stringify(sys.claudio.lo_que_haces) === JSON.stringify(base.claudio.lo_que_haces) && JSON.stringify(sys.claudio.weebo) === JSON.stringify(base.claudio.weebo), '2 · el MISMO prompt de su agente de ElevenLabs (cómo habla, lo que hace, Weebo)');
ok(sys.ficha_de_quien_llama[0] === j.dynamic_variables.quien_llama && !/\{\{quien_llama\}\}/.test(c1.system), '2 · con su ficha en lugar de {{quien_llama}}');
ok(sys.claudio.voz_local.some(x => /texto plano/.test(x)) && sys.claudio.voz_local.some(x => /\[warm\]/.test(x)), '2 · y las reglas de la voz local (texto plano, sin etiquetas)');
const nombres = c1.tools.map(x => x.name).sort().join(',');
ok(nombres === 'claudio_acciones,claudio_codigo,claudio_creator,claudio_estado,claudio_pedido,claudio_responder,claudio_unir,claudio_voces,poner_voz,ver_video,volver_con_alma', '2 · sus mismas herramientas: ' + nombres);
ok(c1.tools.every(x => x.input_schema && !x.input_schema.properties.conv_id && !x.input_schema.properties.sa_web && !(x.input_schema.required || []).includes('conv_id')), '2 · sin conv_id ni sa_web (los pone el Hub)');
ok(c1.messages[0].role === 'user' && c1.messages[1].role === 'assistant' && c1.messages[2].role === 'user' && /botón de pagos/.test(c1.messages[2].content), '2 · la conversación llega alternada, empezando por Juan');

/* 3. Solo el principal y su conversación */
fila = [];
ok(!turno({ conv_id: j.conv_id, texto: 'hola' }, { email: 'ana@x' }).ok && !claude.length, '3 · otro administrador: no (y no llama a la IA)');
ok(!turno({ conv_id: j.conv_id, texto: 'hola' }, null).ok && turno({ conv_id: j.conv_id, texto: 'hola' }, null).error !== 'session', '3 · sin sesión: no (sin el error «session»)');
ok(!turno({ conv_id: 'conv_otra', texto: 'hola' }).ok && !claude.length, '3 · sin una conversación local válida: no');
cache['claudio_conv_local_ffffffffff'] = '50299990000';
ok(!turno({ conv_id: 'conv_local_ffffffffff', texto: 'hola' }).ok && !claude.length, '3 · la conversación de otro teléfono: no');

/* 4. Herramientas con la conversación local y volver con Alma */
let pedido = null; ctx.claudeMandarYa_ = (adm, texto) => { pedido = { adm: adm.email, texto }; return { texto: 'Listo, quedó pedido.', claude: { ok: true, micro: 'mp1' } }; };
ctx.opGuardar_ = () => ({}); ctx.temaTitulo_ = t => 'Cambiar el botón';
fila = [{ content: [{ type: 'tool_use', id: 'tu1', name: 'claudio_pedido', input: { pedido: 'cambiar el botón de pagos', nivel: 'sencillo' } }] },
        { content: [{ type: 'text', text: 'Quedó pedido; lo hago en segundo plano y te aviso cuando esté.' }] }];
const t4 = turno({ conv_id: j.conv_id, texto: 'cambia el botón de pagos' });
ok(t4.ok && pedido && pedido.adm === 'juan@x' && /botón de pagos/.test(pedido.texto) && t4.herramientas.join() === 'claudio_pedido', '4 · claudio_pedido sale con el principal verificado por su sesión');
ok(claude.length === 1 && /^Listo, quedó pedido\. Lo hago en segundo plano/.test(t4.hablar) && /órbita/.test(t4.hablar), '4 · pedido hecho: la frase sale sin otra vuelta de la IA (#651, más rápido): «' + t4.hablar + '»');
fila = [{ content: [{ type: 'tool_use', id: 'tu3', name: 'claudio_pedido', input: { pedido: 'y que sea verde' } }] }];
const t4b = turno({ conv_id: j.conv_id, texto: 'y que sea verde' });
ok(t4b.ok && claude.length === 1 && t4b.hablar === 'También quedó.', '4 · el segundo pedido de la llamada: corto, sin «quedó pedido» ni lo del segundo plano otra vez (17-nov: «con una sola vez basta»): «' + t4b.hablar + '»');
ok(typeof t4.ms_ia === 'number' && typeof t4.ms === 'number', '4 · el turno dice cuánto tardó la IA (ms_ia) para ver dónde se va el tiempo');
const hizo = R("claudioHizo_('" + j.conv_id + "', adminsOp_()[0])");
ok(hizo.pedidos.length === 2 && hizo.pedidos[0].ok, '4 · queda anotado en la conversación local (Alma cierra con lo que hizo Claudio)');
ok(JSON.parse(cache['claudiopanel_' + j.conv_id] || '{}').vista === 'trabajo', '4 · y el Panel de Claudio de esa conversación muestra el trabajo nuevo');
/* Si el resultado no es «Listo, quedó …» (una orden de unir, un error), la IA sí da otra vuelta y lo dice ella. */
{ const antes = ctx.claudeMandarYa_; ctx.claudeMandarYa_ = () => ({ texto: 'Uní el cambio del botón.', claude: { ok: true } }); claude = [];
  fila = [{ content: [{ type: 'tool_use', id: 'tu1', name: 'claudio_pedido', input: { pedido: 'une el del botón' } }] }, { content: [{ type: 'text', text: 'Ya quedó unido.' }] }];
  const tu = turno({ conv_id: j.conv_id, texto: 'une el del botón' }), res = claude[1] && claude[1].messages[claude[1].messages.length - 1].content[0];
  ok(claude.length === 2 && res && res.type === 'tool_result' && res.tool_use_id === 'tu1' && /"ok":true/.test(res.content) && tu.hablar === 'Ya quedó unido.', '4 · con otro resultado, vuelve a Claude y él lo dice');
  ctx.claudeMandarYa_ = antes; claude = []; }
fila = [{ content: [{ type: 'text', text: 'Listo, te paso con Alma.' }, { type: 'tool_use', id: 'tu2', name: 'volver_con_alma', input: {} }] }];
const t5 = turno({ conv_id: j.conv_id, texto: 'eso es todo, gracias' });
ok(t5.ok && t5.volver === true && t5.hablar === 'Listo, te paso con Alma.' && claude.length === 1, '4 · volver_con_alma: dice su frase, avisa volver y no da otra vuelta');
/* poner_voz (#779): el Hub no la corre; la devuelve para que la app la suene después de «Te la pongo.», sin otra vuelta. */
claude = [];
fila = [{ content: [{ type: 'tool_use', id: 'tu3', name: 'poner_voz', input: { voz: '  Dora ', frase: 'Hola', otra: 'x' } }] }];
const tp = turno({ conv_id: j.conv_id, texto: 'ponme la voz de Dora' });
ok(tp.ok && tp.hablar === 'Te la pongo.' && tp.poner && tp.poner.voz === 'Dora' && tp.poner.frase === 'Hola' && !('otra' in tp.poner) && !tp.volver && claude.length === 1, '4 · poner_voz: «Te la pongo.», la app recibe qué poner (solo voz, enlace y frase) y no hay otra vuelta');
fila = [{ content: [{ type: 'tool_use', id: 'tu4', name: 'poner_voz', input: {} }] }];
const tl = turno({ conv_id: j.conv_id, texto: '¿qué voces hay?' });
ok(tl.poner && !Object.keys(tl.poner).length, '4 · poner_voz sin voz: la app dice cuáles hay');
ok(/h\.name !== CLAUDIO_PONER_VOZ_/.test(leer('claudiolocal.js')), '4 · el hilo por escrito no la tiene (ahí no suena nada)');
fila = [];
const t6 = turno({ conv_id: j.conv_id, texto: 'hola' });
ok(!t6.ok && t6.hablar && !/undefined/.test(t6.hablar), '4 · si la IA no responde, igual hay una frase para decir (nunca en silencio)');

/* 5. Lo que se dice: limpio y corto */
const h = R("claudioLocalHablar_('[warm] **Listo**, quedó pedido. Mira https://github.com/x/y/pull/1 \\n- uno\\n- dos')");
ok(!/\[warm\]|\*\*|https?:|^-/.test(h) && /Listo, quedó pedido\./.test(h), '5 · sin etiquetas, markdown ni enlaces: «' + h + '»');
const largo = R("claudioLocalHablar_('" + Array(30).fill('Esta es una frase de prueba bastante larga.').join(' ') + "')");
ok(largo.split(/\s+/).length <= R('CLAUDIO_LOCAL_PALABRAS_'), '5 · corto: ' + largo.split(/\s+/).length + ' palabras como mucho');

/* 6. La voz sin PR y el Hub */
mem.CLAUDIO_VOZ_LOCAL = JSON.stringify({ velocidad: 3, tono: 0.85, idiomas: ['es-ES', 'xx'], genero: 'mujer' });
const v = R('claudioVozLocal_()');
ok(v.velocidad === 0.65 && v.tono === 0.85 && v.idiomas.join() === 'es-ES' && v.genero === 'mujer', '6 · CLAUDIO_VOZ_LOCAL la cambia sin PR, con límites (velocidad ' + v.velocidad + ')');
mem.CLAUDIO_VOZ_LOCAL = 'no es json'; ok(R('claudioVozLocal_()').velocidad === 0.5, '6 · un CLAUDIO_VOZ_LOCAL roto no rompe nada');
const cod = leer('Código.js'), cupo = leer('cupo.js');
ok(/case 'claudioLocal': return json_\(claudioLocalApi_\(ses, body\)\)/.test(cod), '6 · la acción claudioLocal usa la sesión verificada');
ok(/CUPO_ACC_ALMA_ = \[[^\]]*'claudioLocal'/.test(cupo) && /voz: '[^']*\bclaudioLocal\b/.test(cupo), '6 · claudioLocal cuenta como voz de Alma en el cupo (no se pausa)');

/* 7. De fábrica, la voz del iPhone (#649); con el motor «elevenlabs», la misma voz de ElevenLabs (#636) */
delete mem.CLAUDIO_VOZ_LOCAL;
const tts = () => salidas.filter(s => /text-to-speech/.test(s.url));
resp = s => /text-to-speech/.test(s.url) ? { codigo: 200, bytes: [1, 2, 3, 4] } : /get-signed-url/.test(s.url) ? { codigo: 200, cuerpo: { signed_url: 'wss://c' } } : { codigo: 404, cuerpo: '' };
const jFab = ini();
ok(jFab.voz_local.motor === 'iphone' && !jFab.voz_local.audio && !tts().length, '7 · de fábrica el saludo va con la voz del iPhone (sin ElevenLabs, #649)');
salidas = []; fila = [{ content: [{ type: 'text', text: 'Listo.' }] }];
const tFab = turno({ conv_id: jFab.conv_id, texto: 'ok' });
ok(tFab.ok && tFab.hablar === 'Listo.' && !tFab.audio && !tts().length, '7 · de fábrica cada turno va con la voz del iPhone (sin ElevenLabs, #649)');
mem.CLAUDIO_VOZ_LOCAL = JSON.stringify({ motor: 'elevenlabs' }); salidas = [];
const jSolo = ini();
ok(jSolo.voz_local.motor === 'iphone' && !jSolo.voz_local.audio && !tts().length, '7 · {"motor":"elevenlabs"} sin CLAUDIO_VOZ_ELEVENLABS = 1: voz local, sin gastar ElevenLabs (Juan, 19-nov-2026)');
mem.CLAUDIO_VOZ_ELEVENLABS = '1'; salidas = [];
R("claudioTtsGuardar_({ voice_id: 'x', model_id: 'eleven_turbo_v2_5', stability: 0.42, similarity_boost: 0.77, speed: 1.08, otra: 1 })");
const j7 = ini(), s7 = tts()[0];
ok(j7.voz_local.motor === 'elevenlabs' && j7.voz_local.audio === Buffer.from([1, 2, 3, 4]).toString('base64') && j7.voz_local.hz === 16000, '7 · el saludo llega con su voz de ElevenLabs (PCM 16 kHz)');
ok(s7 && s7.url.indexOf('/text-to-speech/' + R('CLAUDIO_VOZ_ID_') + '?output_format=pcm_16000') > 0 && s7.cuerpo.text === j7.first_message, '7 · con LA voz de Claudio y el formato de su llamada');
ok(s7.cuerpo.model_id === 'eleven_turbo_v2_5' && s7.cuerpo.voice_settings.stability === 0.42 && s7.cuerpo.voice_settings.similarity_boost === 0.77 && s7.cuerpo.voice_settings.speed === 1.08, '7 · con el modelo y los ajustes de su agente');
salidas = []; fila = [{ content: [{ type: 'text', text: 'Ya quedó el cambio del botón.' }] }];
const t7 = turno({ conv_id: j7.conv_id, texto: '¿y el botón?' });
ok(t7.ok && t7.audio && t7.hz === 16000 && tts().length === 1 && tts()[0].cuerpo.text === t7.hablar, '7 · cada turno trae lo que dice con su voz (solo lo que dice, una vez)');
let primero = true; salidas = [];
resp = s => /text-to-speech/.test(s.url) ? (primero ? (primero = false, { codigo: 400, cuerpo: 'modelo' }) : { codigo: 200, bytes: [9] }) : { codigo: 404, cuerpo: '' };
fila = [{ content: [{ type: 'text', text: 'Listo.' }] }];
const t8 = turno({ conv_id: j7.conv_id, texto: 'ok' });
ok(t8.audio === Buffer.from([9]).toString('base64') && tts().map(x => x.cuerpo.model_id).join() === 'eleven_turbo_v2_5,eleven_flash_v2_5', '7 · si el modelo del agente falla, otra vez con el rápido');
resp = () => ({ codigo: 500, cuerpo: 'caído' }); fila = [{ content: [{ type: 'text', text: 'Listo.' }] }];
const t9 = turno({ conv_id: j7.conv_id, texto: 'ok' });
ok(t9.ok && t9.hablar === 'Listo.' && !t9.audio, '7 · si ElevenLabs falla, igual contesta (sin audio: la voz del iPhone)');
mem.CLAUDIO_VOZ_LOCAL = JSON.stringify({ motor: 'iphone' }); salidas = [];
resp = s => /text-to-speech/.test(s.url) ? { codigo: 200, bytes: [1] } : { codigo: 404, cuerpo: '' }; fila = [{ content: [{ type: 'text', text: 'Listo.' }] }];
const t10 = turno({ conv_id: j7.conv_id, texto: 'ok' });
ok(!t10.audio && !tts().length && R('claudioVozLocal_()').motor === 'iphone', '7 · CLAUDIO_VOZ_LOCAL {"motor":"iphone"}: la voz del iPhone, sin gastar ElevenLabs');
mem.CLAUDIO_LOCAL_TTS_MODELO = 'inventado'; mem.CLAUDIO_VOZ_LOCAL = JSON.stringify({ motor: 'elevenlabs' });
ok(R('claudioTts_()').model_id === 'eleven_flash_v2_5', '7 · un modelo que no existe vuelve al rápido');
ok(/claudioTtsGuardar_\(tts\)/.test(leer('claudio.js')), '7 · el Hub guarda el modelo y los ajustes de la voz de su agente al revisarlo');

if (!fallo) console.log('Todo bien: Claudio local habla con su mismo prompt y sus herramientas, con la voz del iPhone (y la de ElevenLabs si se enciende), sin el agente.');
process.exit(fallo);
