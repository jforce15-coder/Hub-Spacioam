/* Modo calle rápido y Hablar con Claudio desde la calle (apps-script/calle.js, Código.js, agente.js, claudio.js), con dobles:
   sin Google, sin Anthropic, sin ElevenLabs. Juan, 16-nov-2026: «Estoy probando el modo» tardó 28 s (la app se rinde a
   los 25 s) y «quiero hablar con Claudio» en Modo calle no lo pasó a Claudio. Revisa:
   1. el chat con Alma ya no le pide a Epi su configuración en cada mensaje cuando trabaja el agente (solo el flujo viejo);
   2. una frase de prueba («Estoy probando el modo», «¿me escuchas?») se contesta sin la IA y queda en el chat; un pedido
      de verdad no;
   3. «quiero hablar con Claudio» (o «con el equipo de desarrollo») contesta { claudio: true } sin la IA, solo con el
      administrador principal; con otra persona, «dile a Claudio que…» o «no quiero hablar con Claudio», sigue como pedido;
   4. un pedido normal va con el camino rápido de la voz y con el plazo también antes de la primera vuelta, y los dos se
      apagan al terminar; la esfera se marca después (diferir); la respuesta trae el cronómetro `ms`;
   5. el plazo antes de la primera vuelta: si lo de antes ya se comió el tiempo, sigue en segundo plano sin llamar al modelo
      (y fuera del Modo calle, igual que antes);
   6. la voz: lo que se sabe que falla (sin permiso, sin llave) va con vozPausa y calleVoz con pausa; un error suelto no;
      el otro modelo no se intenta si ya pasó el plazo;
   7. vozClaudio dice por qué no hay conversación en una palabra (no_principal · sin_agente · sin_url);
   8. guardia 20-nov-2026 (Maricarmen, 18-20 s para oír «toma un rato»): el plazo se cuenta desde que el pedido llegó a
      doPost (PETICION_T0_) y el agente se corta con reserva para pasar a segundo plano; con un corte lento de verdad
      (opProcesar_ y el bucle reales, cola y hojas que tardan), Juan oye la respuesta antes de los 15 s.
   node .github/calle-rapida.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

/* Todo el Apps Script en una caja, con Google de mentira; después cada prueba pone sus dobles encima. */
function caja() {
  const nada = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : nada, apply: () => nada });
  const mem = {}, cache = {};
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, Date, JSON, Math, String, Number, Array, Object, RegExp, Error, isNaN, encodeURIComponent, decodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty: k => { delete mem[k]; }, getKeys: () => Object.keys(mem) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    Utilities: { formatDate: d => new Date(d).toISOString(), getUuid: () => 'u', computeDigest: (a, s) => Array.from(Buffer.from(String(s))), base64Encode: b => Buffer.from(b).toString('base64'),
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64'), DigestAlgorithm: {}, Charset: {}, sleep() {} },
    SpreadsheetApp: nada, LockService: nada, ScriptApp: nada, Session: nada, UrlFetchApp: nada, DriveApp: nada, GmailApp: nada, MailApp: nada,
    CalendarApp: nada, HtmlService: nada, ContentService: nada, DocumentApp: nada, LanguageApp: nada, XmlService: nada, Logger: nada
  };
  vm.createContext(ctx);
  fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }); } catch (e) { console.error('carga ' + f + ': ' + e.message); } });
  return { X: ctx, mem, cache, R: c => vm.runInContext(c, ctx) };
}
const JUAN = { email: 'juan@x', nombre: 'Juan Prueba', principal: true, tels: ['50211110000'] };
const ANA = { email: 'ana@x', nombre: 'Ana', principal: false, tels: ['50222220000'] };

/* 1 · opProcesar_ sin la configuración de Epi cuando trabaja el agente */
{ const { X } = caja(); let epi = 0, agente = 0, diferir = null;
  Object.assign(X, { opGuardar_: (a, de, canal, t) => ({ id: 'op' + de, ts: new Date().toISOString(), de, canal, texto: t, acciones: [] }), chatBorradorTurno_: () => null,
    socioDatosEnMensaje_: () => '', opNotaNumeros_: () => '', adminsOp_: () => [JUAN], opFilas_: () => [], epiCfg_: () => { epi++; return { tareas: [], schedules: [], vendors: [], props: [] }; },
    opAgente_: () => { agente++; return { respuesta: 'Te escucho bien.', hechas: [], esfera: 'Trabajo', subcategoria: '' }; },
    chatTurnoCerrar_: (a, ids, t, ag, o) => { diferir = o.diferir; return { texto: ag.respuesta, clas: { esfera: ag.esfera, subcategoria: '' } }; },
    decisionDesdeChat_: () => null, formatearMensaje_: t => t, variarFrase_: t => t, variarRecientes_: () => [], calleSacarConversar_: t => ({ texto: t, conversar: false }), ahora_: () => new Date(),
    CFG: { TZ: 'America/Guatemala', MODELO_REDACTOR: 'm' } });
  X.opAgenteActivo_ = () => true;
  const r = X.opProcesar_(JUAN, 'Revisa quién llega hoy', 'calle', []);
  ok(r.ok && agente === 1 && epi === 0, '1 · con el agente, el chat con Alma ya no le pide a Epi su configuración (eran segundos en cada mensaje)');
  ok(diferir === true, '1 · en Modo calle la esfera del turno se marca después (Juan no la espera)');
  X.opProcesar_(JUAN, 'Revisa quién llega hoy', 'hub', []);
  ok(diferir === false, '1 · en el Hub la esfera se marca como siempre');
  X.opAgenteActivo_ = () => false; X.claude_ = () => '{"respuesta":"ok","acciones":[]}'; X.prompt_ = () => ''; X.opEjecutar_ = () => []; X.chatEsfera_ = () => '';
  X.opProcesar_(JUAN, 'hola', 'hub', []);
  ok(epi === 1, '1 · el flujo viejo (sin agente, OP_AGENTE = 0) sí la sigue leyendo'); }

/* Una caja para calle_: el chat de verdad (opProcesar_) de mentira, que anota cómo lo llamaron. */
function calleCaja(o) {
  o = o || {};
  const c = caja(), X = c.X, guardadas = [], procesados = [];
  Object.assign(X, {
    chatSesAdm_: ses => (ses && ses.email === 'ana@x' ? ANA : ses ? JUAN : null), esAdminPrincipal_: a => !!(a && a.principal),
    opGuardar_: (a, de, canal, t) => { guardadas.push({ de, canal, t }); return { id: 'x' }; }, vozSinNotas_: t => String(t || ''), vozVozId_: () => 'vozAlma',
    vozCaidaAnotar_: () => {}, chatOpciones_: () => null,
    opProcesar_: (adm, texto, canal) => {
      procesados.push({ texto, canal, rapido: X.AGENTE_RAPIDO_, primera: X.AGENTE_PLAZO_PRIMERA_, plazo: X.AGENTE_PLAZO_, ms: !!X.AG_MS_ });
      if (X.AG_MS_) { X.AG_MS_.ia += 1200; X.AG_MS_.n = 1; X.AG_MS_.via = 'rapido'; }
      return o.respuesta || { ok: true, alma: { texto: 'Hoy llega Mariana a las 3.', acciones: [] } };
    },
    uf_: (url, op) => { (c.tts = c.tts || []).push(JSON.parse(op.payload).model_id); const [code, cuerpo] = (o.tts || []).length ? o.tts.shift() : [200, '']; return { getResponseCode: () => code, getContentText: () => cuerpo, getBlob: () => ({ getBytes: () => [1, 2, 3] }) }; }
  });
  c.mem.ELEVENLABS_KEY = o.sinLlave ? undefined : 'k'; if (o.sinLlave) delete c.mem.ELEVENLABS_KEY;
  return Object.assign(c, { guardadas, procesados });
}

/* 2 · frases de prueba sin la IA */
{ const c = calleCaja();
  ['Estoy probando el modo', 'Alma, estoy probando el modo calle.', 'Probando, uno, dos, tres', '¿Me escuchas?', 'Hola Alma, ¿me oyes?', 'Es una prueba'].forEach(t => {
    ok(!!c.X.calleCharla_(t), '2 · «' + t + '» se contesta sin la IA («' + c.X.calleCharla_(t) + '»)'); });
  ['Estoy probando el modo de enviar mensajes a Flor', 'Prueba a escribirle a Flor', 'Revisa quién llega hoy', 'Probando la cerradura de la 1102, ¿está bien el código?'].forEach(t => {
    ok(!c.X.calleCharla_(t), '2 · «' + t + '» es un pedido: va a Alma'); });
  const r = c.X.calle_({ email: 'juan@x' }, { texto: 'Estoy probando el modo' });
  ok(r.ok && r.hablar === 'Te escucho bien.' && !c.procesados.length && r.ms && r.ms.via === 'sin IA', '2 · «Estoy probando el modo» contesta «Te escucho bien.» sin pasar por el chat con la IA');
  ok(c.guardadas.length === 2 && c.guardadas[0].de === 'yo' && c.guardadas[1].de === 'alma' && c.guardadas.every(g => g.canal === 'calle'), '2 · y queda en el Chat con Alma (canal calle)'); }

/* 3 · Hablar con Claudio */
{ const c = calleCaja(), X = c.X;
  ['quiero hablar con Claudio', 'Quiero hablar con el equipo de desarrollo', 'pásame con Claudio', 'Alma, pásame a Claudio', 'comunícame con los de desarrollo',
    'quiero hablar un momento con Claudio sobre el botón de pagos', 'Ponme con Claudio', '¿Me pones con Claudio?'].forEach(t => ok(X.calleClaudio_(t), '3 · «' + t + '» pide hablar con Claudio'));
  ['dile a Claudio que cambie el botón', 'no quiero hablar con Claudio', 'Claudio ya terminó lo del botón?', 'habla con Flor sobre la limpieza', 'pide a desarrollo que arregle el botón'].forEach(t => ok(!X.calleClaudio_(t), '3 · «' + t + '» no abre a Claudio'));
  const r = X.calle_({ email: 'juan@x' }, { texto: 'Quiero hablar con Claudio' });
  ok(r.ok && r.claudio === true && r.conversar === true && !c.procesados.length, '3 · con el principal: { claudio: true } sin la IA ni un pedido de desarrollo');
  const c2 = calleCaja(); const r2 = c2.X.calle_({ email: 'ana@x' }, { texto: 'Quiero hablar con Claudio' });
  ok(r2.ok && !r2.claudio && c2.procesados.length === 1, '3 · con otra persona Claudio no existe: va como pedido normal');
  const c3 = calleCaja(); const r3 = c3.X.calle_({ email: 'juan@x' }, { texto: 'Quiero hablar con Claudio', aviso_id: 'av1' });
  ok(!r3.claudio, '3 · respondiendo a un aviso, la frase va al aviso (como siempre)'); }

/* 4 · un pedido normal: camino rápido, plazo antes de la primera vuelta, se apagan y trae ms */
{ const c = calleCaja(), X = c.X;
  const r = X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién llega hoy' });
  const p = c.procesados[0] || {};
  ok(p.rapido === true && p.primera === true && p.plazo > 0 && p.ms, '4 · el pedido va con el camino rápido de la voz y con el plazo también antes de la primera vuelta');
  ok(X.AGENTE_RAPIDO_ === false && X.AGENTE_PLAZO_PRIMERA_ === false && X.AGENTE_PLAZO_ === 0 && X.AG_MS_ === null, '4 · y se apagan al terminar (no se cuelan en otro turno)');
  ok(r.ok && r.hablar === 'Hoy llega Mariana a las 3.' && r.audio, '4 · contesta con su frase y la voz de Alma');
  ok(r.ms && typeof r.ms.total === 'number' && r.ms.ia === 1200 && r.ms.vueltas === 1 && r.ms.via === 'rapido' && 'voz' in r.ms && 'resto' in r.ms, '4 · la respuesta trae el cronómetro (total, ia, vueltas, voz, resto, via)');
  const c2 = calleCaja({ respuesta: { ok: false, error: 'x' } }); c2.X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién llega hoy' });
  ok(c2.X.AGENTE_RAPIDO_ === false && c2.X.AGENTE_PLAZO_PRIMERA_ === false, '4 · también se apagan si falla'); }

/* 5 · el plazo antes de la primera vuelta (opAgenteBucle_ de verdad) */
{ const { X } = caja(); let modelo = 0;
  X.claudeTools_ = () => { modelo++; return { content: [{ type: 'text', text: 'Hola.' }], stop_reason: 'end_turn' }; };
  X.vozSeguirGuardar_ = () => 'seg-1';
  Object.assign(X, { microSacarEtiqueta_: t => ({ texto: t, micro: '' }), claudeNivelSacarEtiqueta_: t => ({ texto: t, nivel: '' }), chatSacarEtiqueta_: t => ({ texto: t, esfera: '', subcategoria: '' }),
    temaSacarEtiqueta_: t => ({ texto: t, tag: null }), tvCandidataTema_: () => {} });
  const ctx = () => ({ hechas: [], llamadas: [] }), msgs = () => [{ role: 'user', content: 'hola' }];
  X.AGENTE_PLAZO_ = Date.now() + 2000; X.AGENTE_PLAZO_PRIMERA_ = true;
  const r = X.opAgenteBucle_(JUAN, 'sys', msgs(), [], ctx(), 0, false, false);
  ok(r.seguira === true && modelo === 0, '5 · Modo calle: si lo de antes se comió el plazo, sigue en segundo plano sin llamar al modelo');
  X.AGENTE_PLAZO_PRIMERA_ = false;
  const r2 = X.opAgenteBucle_(JUAN, 'sys', msgs(), [], ctx(), 0, false, false);
  ok(!r2.seguira && modelo === 1, '5 · fuera del Modo calle (la llamada), la primera vuelta corre como antes');
  X.AGENTE_PLAZO_ = Date.now() + 30000; X.AGENTE_PLAZO_PRIMERA_ = true;
  const r3 = X.opAgenteBucle_(JUAN, 'sys', msgs(), [], ctx(), 0, false, false);
  ok(!r3.seguira && modelo === 2, '5 · con tiempo de sobra, la primera vuelta corre');
  X.AGENTE_PLAZO_ = 0; X.AGENTE_PLAZO_PRIMERA_ = false; }

/* 6 · la voz */
{ const perm = [401, JSON.stringify({ detail: { status: 'missing_permissions', message: 'The API key you used is missing the permission text_to_speech' } })];
  const c = calleCaja({ tts: [perm] }), X = c.X;
  const r = X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién llega hoy' });
  ok(!r.audio && /Text to Speech/.test(r.vozMotivo) && r.vozPausa === true, '6 · sin permiso «Text to Speech»: sin audio, con el porqué y vozPausa (la app no la vuelve a pedir)');
  const r2 = X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién sale hoy' });
  ok(r2.vozPausa === true && c.tts.length === 1, '6 · la siguiente ni le pregunta a ElevenLabs y también va con vozPausa');
  const v = X.calleVoz_({ email: 'juan@x' }, { texto: 'Listo.' });
  ok(!v.ok && v.pausa === true, '6 · calleVoz también dice pausa');
  const c2 = calleCaja({ tts: [[500, '{"detail":{"message":"Internal"}}']] });
  const r3 = c2.X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién llega hoy' });
  ok(!r3.audio && /500/.test(r3.vozMotivo) && !r3.vozPausa, '6 · un error suelto de ElevenLabs no pausa: la próxima se vuelve a pedir');
  const c3 = calleCaja({ sinLlave: true });
  ok(c3.X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién llega hoy' }).vozPausa === true, '6 · sin ELEVENLABS_KEY: vozPausa');
  const c4 = calleCaja({ tts: [[400, JSON.stringify({ detail: { status: 'model_not_supported' } })], [200, '']] });
  const t0 = Date.now() - 19900; let n = 0; const uf = c4.X.uf_; c4.X.uf_ = (u, op) => { n++; const res = uf(u, op); if (n === 1) { const D = Date.now(); c4.X.Date = { now: () => D + 500 }; } return res; };
  const a = c4.X.calleAudio_('Una frase nueva.', t0, { donde: 'calle' });
  ok(!a && n === 1 && /ya no había tiempo/.test(c4.X.CALLE_VOZ_MOTIVO_), '6 · el otro modelo no se intenta si ya pasó el plazo de la app'); }

/* 7 · vozClaudio dice por qué en una palabra */
{ const { X, mem } = caja();
  Object.assign(X, { vozWebAdmin_: ses => (ses && ses.email === 'juan@x' ? JUAN : ses && ses.email === 'ana@x' ? ANA : null), esAdminPrincipal_: a => !!(a && a.principal) });
  ok(X.claudioWebInicio_({ email: 'ana@x' }, '').codigo === 'no_principal', '7 · otra persona: codigo no_principal');
  ok(X.claudioWebInicio_({ email: 'juan@x' }, '').codigo === 'sin_agente', '7 · sin el agente de Claudio: codigo sin_agente (la app lo dice en una frase)');
  mem.CLAUDIO_AGENT_ID = 'agent_claudio'; X.vozUrlFirmada_ = () => ({ ok: false, error: 'ElevenLabs 401' });
  const r = X.claudioWebInicio_({ email: 'juan@x' }, '');
  ok(!r.ok && r.codigo === 'sin_url' && /401/.test(r.error), '7 · ElevenLabs no da la URL firmada: codigo sin_url'); }

/* 8 · los 15 s son de Juan: desde que llegó el pedido, y con reserva para pasar a segundo plano */
{ const c = calleCaja(), X = c.X;
  ok(X.CALLE_PLAZO_ - X.CALLE_RESERVA_CORTE_ <= 12000 && X.CALLE_RESERVA_CORTE_ >= 3000, '8 · el agente se corta con al menos 3 s de reserva (pasar a segundo plano también tarda)');
  ok(/function doPost\(e\) \{\s*PETICION_T0_ = Date\.now\(\)/.test(fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8')), '8 · doPost anota cuándo llegó el pedido en su primera línea');
  const llego = Date.now() - 2500; X.PETICION_T0_ = llego;
  X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién llega hoy' });
  const p = c.procesados[0] || {};
  ok(p.plazo === llego + X.CALLE_PLAZO_ - X.CALLE_RESERVA_CORTE_, '8 · el plazo cuenta desde que llegó el pedido a doPost, no desde calle_');
  const c2 = calleCaja(); c2.X.PETICION_T0_ = Date.now() - 120000; c2.X.calle_({ email: 'juan@x' }, { texto: 'Revisa quién llega hoy' });
  ok((c2.procesados[0] || {}).plazo > Date.now() + 5000, '8 · un PETICION_T0_ viejo (otra ejecución) no cuenta'); }

/* 8 · con un reloj de mentira: lo de antes, el modelo y el corte lento (cola, tema, chat) no pasan de 15 s */
{ const { X } = caja(); let ahora = 1e12; const avanza = ms => { ahora += ms; };
  const RD = function () {}; RD.now = () => ahora; X.Date = RD;
  X.PETICION_T0_ = ahora; avanza(1500);   // doPost y la sesión
  Object.assign(X, {
    chatSesAdm_: () => JUAN, esAdminPrincipal_: () => true, calleClaudio_: () => false, guiaPideCamino_: () => false, calleCharla_: () => '',
    identidadVozDe_: () => '', maricarmenAlter_: () => 'maricarmen', maricarmenVozPedida_: () => false,
    decisionDesdeChat_: () => null, chatBorradorTurno_: () => null, socioDatosEnMensaje_: () => '', orbitaEstadoPregunta_: () => null, ppNota_: () => '', opNotaNumeros_: () => '',
    opAgenteActivo_: () => true, adminsOp_: () => [JUAN], opFilas_: () => { avanza(800); return []; }, ahora_: () => new Date(), CFG: { TZ: 'America/Guatemala', MODELO_REDACTOR: 'm' },
    opGuardar_: (a, de) => { avanza(700); return { id: 'op' + de, ts: new Date(0).toISOString(), de, acciones: [] }; },
    temaCerrarTurno_: () => { avanza(1200); return ''; }, vozTrabajando_: () => {},
    vozSeguirGuardar_: () => { avanza(1500); return 'sg1'; },
    microSacarEtiqueta_: t => ({ texto: t, micro: '' }), claudeNivelSacarEtiqueta_: t => ({ texto: t, nivel: '' }), chatSacarEtiqueta_: t => ({ texto: t, esfera: '', subcategoria: '' }), temaSacarEtiqueta_: t => ({ texto: t, tag: null }), tvCandidataTema_: () => {},
    rapidoIntentar_: () => null, recetaAprender_: () => {},
    opAgente_: (adm, pedido, canal, f, previos) => X.opAgenteBucle_(adm, 'sys', [{ role: 'user', content: pedido }], [], { hechas: [], llamadas: [] }, 0, false, false),
    claudeTools_: () => { avanza(4000); return { content: [{ type: 'tool_use', id: 't' + ahora, name: 'leer', input: {} }], stop_reason: 'tool_use' }; },
    agEjecutar_: () => { avanza(1000); return { ok: true }; }, agMsHerr_: () => {}
  });
  const r = X.calle_({ email: 'juan@x' }, { texto: 'Mándale el reporte de la semana a Flor', sin_audio: true, alter: 'maricarmen' });
  const total = ahora - X.PETICION_T0_;
  ok(r.ok && r.seguira === true, '8 · un pedido largo de Maricarmen (voz de respaldo) pasa a segundo plano');
  ok(total <= 15000, '8 · y Juan oye «sigo en eso» a los ' + (total / 1000).toFixed(1) + ' s de que llegó el pedido (15 s como mucho; el 20-nov eran 18-20)');
  ok(r.ms && r.ms.tras_corte > 0, '8 · la respuesta dice cuánto tardó pasar a segundo plano (ms.tras_corte: ' + (r.ms && r.ms.tras_corte) + ' ms)'); }

process.exit(fallo);
