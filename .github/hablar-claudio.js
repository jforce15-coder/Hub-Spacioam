/* Hablar con Claudio (apps-script/claudio.js, #550; Juan, 16-nov-2026), con dobles de ElevenLabs, de GitHub y de Google:
   sin internet. Revisa:
   1. el agente de Claudio se crea UNA vez, con la base del de Alma (modelo, idioma, turnos, oído), su voz, el acceso
      cerrado, el permiso de que la app ponga su saludo (sin él ElevenLabs rechaza la llamada) y la protección con la
      marca del principal; si ya existe (por id o por nombre) no se crea otro, y si falla no se reintenta en cada vuelta;
      el que ya existe recibe ese permiso en la sincronización diaria;
   2. la URL firmada de Claudio (acción vozClaudio) solo con la sesión verificada del administrador principal;
   3. la ficha de Alma trae el permiso de pasar a Claudio solo con el principal y solo si la app sabe cambiar de agente;
      la herramienta de Alma (hablar_con_claudio) es de la app y se apoya en ese permiso;
   4. las herramientas de Claudio solo atienden al principal, por la firma del Hub dentro de la conversación de Claudio;
      un pedido sale al instante como con Alma (16-nov-2026), se suma a un trabajo por su nombre, contesta preguntas
      pendientes y «súbelo»; nada se une sin «une» (ni «¿qué falta unir?» ni «no lo unas»); su ficha trae los AVISOS
      (la pregunta pendiente; lo listo lo une Claudio solo);
   5. leer código es solo lectura (GET a GitHub) y corto;
   6. su prompt es JSON con {{quien_llama}} al final, y Claudio no existe con otras audiencias: ni la frase ni el permiso
      están en los prompts del chat, WhatsApp, calle, redactor ni en lo de huéspedes de la voz;
   7. habla como Alma: cómo habla, por voz, confirmaciones, «nunca» y el Modo Weebo salen de su misma fuente, y su ficha
      trae el mismo Weebo y la misma adaptación a Juan.
   node .github/hablar-claudio.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const { armar } = require('./prompts-armados.js');
const a = armar(DIR), ctx = a._ctx, R = c => vm.runInContext(c, ctx);
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

/* Dobles comunes: propiedades en memoria, caché en memoria y un uf_ que anota todo lo que sale. */
let mem = {}, cache = {}, salidas = [], resp = () => ({ codigo: 404, cuerpo: '' });
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty: k => { delete mem[k]; }, getKeys: () => Object.keys(mem) }) };
ctx.CacheService = { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; }, getAll: () => ({}), putAll() {} }) };
ctx.uf_ = (url, o) => { o = o || {}; const s = { url: String(url), metodo: String(o.method || 'get').toLowerCase(), cuerpo: o.payload ? JSON.parse(o.payload) : null, headers: o.headers || {} }; salidas.push(s); const r = resp(s);
  return { getResponseCode: () => r.codigo, getContentText: () => (typeof r.cuerpo === 'string' ? r.cuerpo : JSON.stringify(r.cuerpo)) }; };
ctx.Utilities = Object.assign({}, ctx.Utilities, { computeDigest: (alg, t) => Array.from(Buffer.from(require('crypto').createHash('sha256').update(String(t)).digest())), base64Encode: b => Buffer.from(b).toString('base64'),
  base64Decode: s => Array.from(Buffer.from(s, 'base64')), newBlob: b => ({ getDataAsString: () => Buffer.from(b).toString('utf8') }), getUuid: () => 'ab12cd34ef56ab78cd90ef12ab34cd56' });
const JUAN = { email: 'juan@x', nombre: 'Juan Prueba', principal: true, tels: ['50211110000'] };
const ANA = { email: 'ana@x', nombre: 'Ana', principal: false, tels: ['50222220000'] };
Object.assign(ctx, { adminsOp_: () => [JUAN, ANA], adminPorTel_: t => [JUAN, ANA].filter(x => String(t).slice(-8) === x.tels[0].slice(-8))[0] || null,
  vozWebAdmin_: ses => (ses && ses.email === 'juan@x' ? JUAN : ses && ses.email === 'ana@x' ? ANA : null), normTel_: t => String(t || '').replace(/\D/g, ''),
  vozWebToken_: t => 'firma:' + t, microAbiertos_: () => [], prsAbiertos_: () => [] });
const ALMA = { agent_id: 'agent_alma', name: 'Alma', conversation_config: {
  agent: { language: 'es', first_message: 'Hola', prompt: { prompt: '{"alma":1}', llm: 'gpt-4.1-mini', temperature: 0.3, tool_ids: ['tool_secretaria', 'tool_abrir'],
    built_in_tools: { end_call: { name: 'end_call', description: 'de Alma', params: { system_tool_type: 'end_call' } }, transfer_to_number: { name: 'transfer_to_number' } } } },
  tts: { model_id: 'eleven_v3_conversational', voice_id: 'voz_alma', stability: 0.65, supported_voices: [], suggested_audio_tags: [{ tag: 'warm' }] },
  turn: { turn_eagerness: 'patient', turn_timeout: 7 }, asr: { quality: 'high' }, vad: { background_voice_detection: true }, conversation: { max_duration_seconds: 900 } },
  platform_settings: { auth: { enable_auth: true }, data_collection: { motivo: {} } } };
const VOZ = R('CLAUDIO_VOZ_ID_');

/* 1. Crear el agente una vez */
{ mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma' }; salidas = [];
  resp = s => /\/agents\?/.test(s.url) ? { codigo: 200, cuerpo: { agents: [{ agent_id: 'agent_otro', name: 'Otro' }] } }
    : /\/agents\/create$/.test(s.url) ? { codigo: 200, cuerpo: { agent_id: 'agent_claudio' } } : /\/agents\/agent_alma$/.test(s.url) ? { codigo: 200, cuerpo: ALMA } : { codigo: 404, cuerpo: '' };
  const r = R('claudioCrearSiFalta_(false)'), posts = salidas.filter(s => s.metodo === 'post');
  ok(r.ok && r.creado && mem.CLAUDIO_AGENT_ID === 'agent_claudio' && posts.length === 1, 'sin CLAUDIO_AGENT_ID: busca, no encuentra otro con su nombre, lo crea una vez y guarda el id');
  const b = posts[0].cuerpo, cc = b.conversation_config, pr = cc.agent.prompt;
  ok(cc.tts.voice_id === VOZ && VOZ === 'wRoroUVFu5pwV8ummDdd' && cc.tts.model_id === 'eleven_v3_conversational', 'con la voz de Claudio (wRoroUVFu5pwV8ummDdd) y el mismo modelo de voz que Alma');
  ok(pr.llm === 'gpt-4.1-mini' && pr.temperature === 0.3 && cc.agent.language === 'es' && cc.turn.turn_eagerness === 'patient' && cc.asr.quality === 'high', 'la misma base que Alma: modelo, temperatura, idioma es, turnos y oído');
  ok(!pr.tool_ids && !pr.built_in_tools.transfer_to_number && pr.built_in_tools.end_call && pr.built_in_tools.end_call.description !== 'de Alma' && !b.platform_settings.data_collection, 'no se copian herramientas ni datos de Alma (solo colgar, con su propia descripción)');
  ok(b.platform_settings.auth.enable_auth === true, 'acceso cerrado: solo con URL firmada');
  const ovc = ((b.platform_settings.overrides || {}).conversation_config_override || {}).agent || {};
  ok(ovc.first_message === true && ovc.language === true, 'nace permitiendo lo que la app manda al abrir (su saludo y el idioma): sin eso ElevenLabs rechaza la llamada y Claudio nunca contesta (16-nov)');
  const g = b.platform_settings.guardrails, mia = g.custom.config.configs.filter(c => c.name === R('CLAUDIO_PROTECCION_NOMBRE_'))[0];
  ok(g.prompt_injection.is_enabled === false && mia && mia.trigger_action.type === 'end_call' && mia.prompt.indexOf('{{marca_principal}}') > 0 && mia.prompt.indexOf(R('vozMarcaPrincipal_()')) > 0, 'protección con la marca del principal, que cuelga a quien no lo es');
  ok(cc.agent.dynamic_variables.dynamic_variable_placeholders.marca_principal === 'ninguna' && /no es el administrador principal/.test(cc.agent.dynamic_variables.dynamic_variable_placeholders.quien_llama), 'sin ficha del Hub: «ninguna» y no es el principal');
  ok(pr.prompt === R('claudioPromptCompleto_()'), 'nace con su prompt');
  salidas = []; R('claudioCrearSiFalta_(true)');
  ok(!salidas.length, 'con el id guardado no vuelve a crear (ni a preguntar)'); }
{ mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma' }; salidas = [];
  resp = s => /\/agents\?/.test(s.url) ? { codigo: 200, cuerpo: { agents: [{ agent_id: 'agent_ya', name: R('CLAUDIO_NOMBRE_') }] } } : { codigo: 200, cuerpo: ALMA };
  R('claudioCrearSiFalta_(false)');
  ok(mem.CLAUDIO_AGENT_ID === 'agent_ya' && !salidas.some(s => s.metodo === 'post'), 'si ya hay uno con su nombre (se creó y no se guardó), lo adopta sin crear otro'); }
{ mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma' }; salidas = [];
  resp = s => /\/agents\?/.test(s.url) ? { codigo: 200, cuerpo: { agents: [] } } : /create/.test(s.url) ? { codigo: 500, cuerpo: 'mal' } : { codigo: 200, cuerpo: ALMA };
  const r = R('claudioCrearSiFalta_(false)');
  ok(!r.ok && !mem.CLAUDIO_AGENT_ID, 'si ElevenLabs no lo crea: no guarda nada y lo dice');
  salidas = []; R('claudioCrearSiFalta_(false)');
  ok(!salidas.length, 'y no lo reintenta en cada vuelta (espera 6 h)');
  R('claudioCrearSiFalta_(true)'); ok(salidas.some(s => /create/.test(s.url)), 'el robot voz_sync sí lo reintenta'); }
{ mem = {}; salidas = []; ok(R('claudioCrearSiFalta_(false)').ok === false && !salidas.length, 'sin la llave de ElevenLabs no llama a nadie'); }

/* 1b. El agente que ya existe (creado el 16-nov sin el permiso del saludo): la sincronización diaria se lo pone sin
   tocar lo demás, y si ya lo tiene no manda nada. */
{ const cfgP = R('claudioProteccionConfig_(vozMarcaPrincipal_())'); ctx.CFG_ = cfgP;
  const g0 = R('vozProteccionAplicar_({}, CFG_)');
  const agente = ov => ({ agent_id: 'agent_claudio', conversation_config: { tts: { voice_id: VOZ } },
    platform_settings: { auth: { enable_auth: true }, guardrails: g0, overrides: ov } });
  let ag = agente({ conversation_config_override: { agent: { first_message: false, language: false }, conversation: { text_only: true } }, custom_llm_extra_body: false });
  mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma', CLAUDIO_AGENT_ID: 'agent_claudio' }; salidas = [];
  resp = s => /\/agents\/agent_claudio$/.test(s.url) && s.metodo === 'get' ? { codigo: 200, cuerpo: ag } : { codigo: 200, cuerpo: {} };
  const r = R('claudioConfigSiCambio_(false)'), pa = salidas.filter(s => s.metodo === 'patch')[0];
  const ovp = pa && pa.cuerpo.platform_settings.overrides, aa = ((ovp || {}).conversation_config_override || {}).agent || {};
  ok(r.ok && pa && aa.first_message === true && aa.language === true, 'el agente sin el permiso del saludo: la sincronización se lo pone');
  ok(ovp && ovp.conversation_config_override.conversation.text_only === true && ovp.custom_llm_extra_body === false, 'y deja igual los demás permisos que ya tenía');
  ag = agente(R('claudioOverrides_({})')); mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma', CLAUDIO_AGENT_ID: 'agent_claudio' }; salidas = [];
  const r2 = R('claudioConfigSiCambio_(false)');
  ok(r2.ok && r2.al_dia && !salidas.some(s => s.metodo === 'patch'), 'con el permiso puesto, el acceso, la protección y la voz al día: no manda nada'); }

/* 2. La URL firmada de Claudio, solo el principal */
{ mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma', CLAUDIO_AGENT_ID: 'agent_claudio' };
  resp = s => /get-signed-url/.test(s.url) ? { codigo: 200, cuerpo: { signed_url: 'wss://firmada?' + s.url.split('agent_id=')[1] } } : { codigo: 404, cuerpo: '' };
  const ini = (ses, motivo) => { salidas = []; ctx.SES_ = ses; ctx.MOT_ = motivo || ''; return R('claudioWebInicio_(SES_, MOT_)'); };
  const j = ini({ email: 'juan@x' }, 'quiero cambiar el botón');
  ok(j.ok && j.signed_url === 'wss://firmada?agent_claudio' && j.agent_id === 'agent_claudio', 'el principal recibe la URL firmada del agente de Claudio (no la de Alma)');
  ok(j.dynamic_variables.marca_principal === R('vozMarcaPrincipal_()') && /firma:/.test(j.dynamic_variables.sa_web) && /administrador principal/.test(j.dynamic_variables.quien_llama), 'su ficha lleva la marca del principal y la firma del Hub');
  ok(/quiero cambiar el botón/.test(j.dynamic_variables.quien_llama) && /^¡?Hola, Juan/.test(j.first_message) && /Alma me (dijo|contó)|Me dijo Alma/.test(j.first_message), 'lo que le dijo a Alma llega a Claudio y Claudio saluda como alguien a quien fueron a llamar');
  const na = ini({ email: 'ana@x' });
  ok(!na.ok && !salidas.length, 'otro administrador: no hay Claudio ni URL firmada');
  ok(!ini(null).ok && !salidas.length && ini(null).error !== 'session', 'sin sesión: no (y sin el error «session» que cierra la sesión)');
  ok(!ini({ email: 'nadie@x' }).ok && !salidas.length, 'una sesión que no es de administrador: no');
  delete mem.CLAUDIO_AGENT_ID; ok(!ini({ email: 'juan@x' }).ok && !salidas.length, 'si el Hub todavía no lo creó, lo dice y no abre nada');
  const cod = leer('Código.js'), cupo = leer('cupo.js');
  ok(/case 'vozClaudio': return json_\(claudioWebInicio_\(ses, body\.motivo\)\)/.test(cod), 'la acción vozClaudio usa la sesión verificada');
  ok(/CUPO_ACC_ALMA_ = \[[^\]]*'vozClaudio'/.test(cupo) && /voz: '[^']*\bvozClaudio\b/.test(cupo), 'vozClaudio cuenta como voz de Alma en el cupo (no se pausa)'); }

/* 3. La ficha de Alma y su herramienta */
{ mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma' };
  resp = s => /get-signed-url/.test(s.url) ? { codigo: 200, cuerpo: { signed_url: 'wss://alma' } } : { codigo: 404, cuerpo: '' };
  Object.assign(ctx, { vozLookup_: () => ({}), contextoReciente_: () => null, encargoAbierto_: () => null, vozWebFicha_: () => 'ficha', saludosVoz_: () => [],
    calleSueno_: () => ({}), personalidadFicha_: () => null, retFicha_: () => null, vozWebTiempos_: () => {}, vozInicio_: () => ({ dynamic_variables: {} }) });
  const ficha = (email, claudio) => { ctx.SES_ = { email }; return R('vozWebInicio_(SES_, true, true, ' + claudio + ')').dynamic_variables.quien_llama; };
  const P = R('CLAUDIO_PERMISO_');
  ok(ficha('juan@x', true).indexOf(P) >= 0, 'el principal, en una app que sabe cambiar de agente: Alma puede pasarlo con Claudio');
  ok(ficha('ana@x', true).indexOf(P) < 0, 'otro administrador: Alma no tiene permiso (Claudio no existe)');
  ok(ficha('juan@x', false).indexOf(P) < 0, 'una app vieja que no sabe cambiar de agente: sin permiso (Alma no promete lo que la app no hace)');
  const voz = leer('voz.js');
  ok((voz.match(/claudioPermiso_\(/g) || []).length === 1 && /if \(claudio\) \{ var pc = claudioPermiso_\(adm\)/.test(voz), 'el permiso solo lo pone vozWebInicio_ (la app con sesión), nunca la llamada por teléfono');
  ok(/case 'vozWeb': return json_\(vozWebInicio_\(ses, !!body\.ligero, body\.app === 'alma', !!body\.claudio, String\(body\.vuelta_claudio \|\| ''\)\.slice\(0, 80\), !!body\.maricarmen\)\)/.test(leer('Código.js')), 'la app pide el permiso con «claudio» en vozWeb (y al volver, la conversación de Claudio)');
  const h = R("vozDefHerramientas_('B')").filter(t => t.name === 'hablar_con_claudio')[0];
  ok(h && h.type === 'client' && h.pre_tool_speech === 'off' && h.expects_response === false, 'hablar_con_claudio es de la app (cliente), sin frase que agregue ElevenLabs y sin esperar respuesta');
  ok(h && h.description.indexOf('PUEDES PASARLO CON CLAUDIO') >= 0 && h.description.indexOf(R('CLAUDIO_FRASE_')) >= 0 && R('CLAUDIO_FRASE_') === 'Te lo paso.' && /no confirmes ni anuncies/.test(h.description) && /o nada/.test(h.description), 'se usa solo con el permiso de la ficha y sin ceremonia: como mucho «Te lo paso.» (Juan, 16-nov-2026)');
  /* Pasar con Maricarmen (#707): el mismo camino, dentro de la llamada de la app; nunca WhatsApp ni una llamada aparte. */
  const fm = (email, m) => { ctx.SES_ = { email }; return R('vozWebInicio_(SES_, true, true, false, "", ' + m + ')').dynamic_variables.quien_llama; };
  const PM = R('MARICARMEN_PERMISO_');
  ok(fm('juan@x', true).indexOf(PM) >= 0 && fm('ana@x', true).indexOf(PM) < 0 && fm('juan@x', false).indexOf(PM) < 0, 'Maricarmen: solo el principal y solo en una app que sabe pasarla (la pide con «maricarmen»)');
  const hm = R("vozDefHerramientas_('B')").filter(t => t.name === 'pasar_a_maricarmen')[0];
  ok(hm && hm.type === 'client' && hm.pre_tool_speech === 'off' && hm.expects_response === false && hm.description.indexOf('PUEDES PASARLO CON MARICARMEN') >= 0 && /nunca le ofrezcas WhatsApp/.test(hm.description) && /nunca le ofrezcas WhatsApp/.test(PM), 'pasar_a_maricarmen: de la app, sin anunciar y sin ofrecer WhatsApp ni llamada aparte (Juan, 17-nov-2026)'); }

/* 4. Las herramientas de Claudio: solo el principal, por la firma de la conversación de Claudio */
{ mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma', CLAUDIO_AGENT_ID: 'agent_claudio' }; cache = {};
  let conv = { tel: '50211110000', otro: true, agente: 'agent_claudio' }; ctx.vozWebConvInfo_ = () => conv;
  const H = (herr, b) => { ctx.B_ = b; return R("claudioHerramienta_('" + herr + "', B_)"); };
  ok(H('claudio_estado', { conv_id: 'conv_1' }).ok === true, 'el principal, en una conversación de Claudio firmada por el Hub: sí');
  cache = {}; conv = { tel: '50211110000', otro: false, agente: 'agent_alma' };
  ok(H('claudio_estado', { conv_id: 'conv_2' }).ok === false, 'la firma en una conversación de Alma no sirve para las herramientas de Claudio');
  cache = {}; conv = { tel: '50222220000', otro: true, agente: 'agent_claudio' };
  ok(H('claudio_estado', { conv_id: 'conv_3' }).ok === false, 'otro administrador: no');
  cache = {}; conv = { tel: '', otro: true, agente: 'agent_claudio' };
  ok(H('claudio_estado', { conv_id: 'conv_4', caller_id: '50211110000' }).ok === false, 'sin firma del Hub no vale un caller_id (aunque sea el número de Juan)');
  /* 16-nov-2026: con la conversación en curso, leerla no traía la firma (Juan oyó tres veces «solo para el administrador
     principal»). La firma llega en el pedido (sa_web, variable de la ficha que el Hub firmó) y se verifica con su HMAC. */
  const telDe = ctx.vozWebTokenTel_; ctx.vozWebTokenTel_ = t => (t === 'firma-juan' ? '50211110000' : t === 'firma-ana' ? '50222220000' : '');
  cache = {}; conv = { tel: '', otro: true, agente: 'agent_claudio' };
  ok(H('claudio_estado', { conv_id: 'conv_6', sa_web: 'firma-juan' }).ok === true, 'la firma del principal en el pedido: sí, aunque leer la conversación no la traiga');
  cache = {}; ok(H('claudio_estado', { conv_id: 'conv_7', sa_web: 'firma-ana' }).ok === false, 'la firma de otro administrador en el pedido: no');
  cache = {}; ok(H('claudio_estado', { conv_id: 'conv_8', sa_web: 'firma-falsa' }).ok === false, 'una firma que no verifica: no');
  ctx.vozWebTokenTel_ = telDe;
  const defs = R("claudioDefHerramientas_('B')").filter(d => d.type === 'webhook');
  ok(defs.length === 8 && defs.every(d => (d.api_schema.request_body_schema.properties.sa_web || {}).dynamic_variable === 'sa_web'), 'cada herramienta de Claudio manda la firma de su ficha (sa_web)');
  cache = {}; conv = { tel: '50211110000', otro: true, agente: 'agent_claudio' };
  let unir = [], pedidos = [];
  ctx.unirCambio_ = c => { unir.push(c); return { ok: true, unidos: [] }; };
  ctx.claudeMandarYa_ = (adm, t) => { pedidos.push(t); return { texto: 'Listo, quedó pedido.', claude: { ok: true } }; };
  ctx.opGuardar_ = () => ({});
  [['¿Qué falta unir?', 'una pregunta'], ['No lo unas todavía', '«no lo unas»'], ['espera, no une nada', '«espera, no une»'], ['', 'sin palabras']].forEach(([d, q]) => {
    unir = []; const r = H('claudio_unir', { conv_id: 'conv_5', dijo: d, cual: 'todos' });
    ok(r.ok === false && !unir.length, 'no une con ' + q);
  });
  [['une', ''], ['Únelo, por favor', 'Hub #12'], ['une todo', 'todos']].forEach(([d, c]) => {
    unir = []; H('claudio_unir', { conv_id: 'conv_5', dijo: d, cual: c });
    ok(unir.length === 1 && unir[0] === c, 'une con «' + d + '»' + (c ? ' (' + c + ')' : ' (sin cual: devuelve la lista para preguntar)'));
  });
  pedidos = []; let opts = [];
  ctx.claudeMandarYa_ = (adm, t, o) => { pedidos.push(t); opts.push(o || {}); return { texto: 'Listo, quedó pedido.', claude: { ok: true } }; };
  const rp = H('claudio_pedido', { conv_id: 'conv_5', pedido: 'que el botón sea naranja' });
  ok(rp.ok && pedidos.length === 1 && pedidos[0] === 'que el botón sea naranja' && /segundo plano/.test(rp.resultado) && /órbita/.test(rp.resultado), 'como con Alma: sale al instante, una vez, por el camino de siempre (sin esperar el sí) y Claudio dice que es en segundo plano y se ve en la órbita');
  ok(!R("claudioDefHerramientas_('B')").filter(d => d.name === 'claudio_pedido')[0].api_schema.request_body_schema.required.includes('confirmado'), 'claudio_pedido ya no pide «confirmado»');
  /* Sumar a un trabajo abierto, contestar su pregunta y «súbelo» (lo mismo que Alma y la tarjeta de Pendientes). */
  const MICROS = [{ id: 'mpbotonpagos1', nombre: 'Botón de pagos naranja', estado: 'en trabajo', actualizado: Date.now() },
    { id: 'mporbitaviaje', nombre: 'Avión de la órbita', estado: 'Claude pregunta', ultima_pregunta: '¿Cinco o tres días?', actualizado: Date.now() }];
  const microsDe = ctx.microAbiertos_; ctx.microAbiertos_ = () => MICROS;
  pedidos = []; opts = []; H('claudio_pedido', { conv_id: 'conv_5', pedido: 'agrégale un borde', trabajo: 'botón de pagos' });
  ok(pedidos.length === 1 && opts[0].micro === 'mpbotonpagos1', 'con trabajo: se suma a ese microproyecto (' + opts[0].micro + ')');
  pedidos = []; opts = []; H('claudio_pedido', { conv_id: 'conv_5', pedido: 'otra cosa', trabajo: 'nuevo' });
  ok(pedidos.length === 1 && opts[0].micro === 'nuevo', '«nuevo»: va a un microproyecto nuevo');
  pedidos = []; const rx = H('claudio_pedido', { conv_id: 'conv_5', pedido: 'algo', trabajo: 'calendario de limpieza' });
  ok(rx.ok === false && !pedidos.length && /^NO SE HIZO NADA/.test(rx.error) && /Botón de pagos/.test(rx.error), 'un trabajo que no existe: no sale nada y dice cuáles hay');
  let resp_ = [], sub_ = [];
  ctx.microResponder_ = (adm, id, t, o) => { resp_.push([id, t, o]); return { ok: true, micro: id, respuesta: 'Listo, quedó tu respuesta en «Avión de la órbita».' }; };
  ctx.microSubir_ = (adm, m) => { sub_.push(m && m.id); return { ok: true, micro: m ? m.id : 'mpbotonpagos1', nombre: m ? m.nombre : 'Botón de pagos naranja', respuesta: 'Listo, quedó con Opus.' }; };
  const rr = H('claudio_responder', { conv_id: 'conv_5', respuesta: 'cinco días' });
  ok(rr.ok && resp_.length === 1 && resp_[0][0] === 'mporbitaviaje' && resp_[0][1] === 'cinco días' && resp_[0][2].sinChat, 'sin trabajo y con una sola pregunta pendiente: la respuesta va a ese trabajo');
  H('claudio_responder', { conv_id: 'conv_5', respuesta: 'súbelo', trabajo: 'botón de pagos' });
  ok(sub_.length === 1 && sub_[0] === 'mpbotonpagos1' && resp_.length === 1, '«súbelo» con trabajo: ese microproyecto, con Opus');
  sub_ = []; H('claudio_responder', { conv_id: 'conv_5', respuesta: 'súbelo' });
  ok(sub_.length === 1 && sub_[0] == null, '«súbelo» a secas: el más reciente (microSubir_ lo elige)');
  MICROS[0].estado = 'Claude pregunta'; resp_ = [];
  const r2p = H('claudio_responder', { conv_id: 'conv_5', respuesta: 'sí' });
  ok(r2p.ok === false && !resp_.length && /2 preguntas/.test(r2p.error), 'dos preguntas pendientes y sin trabajo: no adivina, pregunta cuál');
  MICROS[0].estado = 'listo para unir';
  const fr = R('claudioResumen_({ email: "juan@x" })');
  ok(/AVISOS/.test(fr) && !/listo para unir \(/.test(fr) && !/AVISOS[^\n]*Botón de pagos naranja/.test(fr) && /«Avión de la órbita» tiene una pregunta: ¿Cinco o tres días\?/.test(fr), 'su ficha trae los AVISOS: solo la pregunta pendiente (lo listo lo une Claudio, 17-nov-2026)');
  MICROS.forEach(m => { m.estado = 'en trabajo'; });
  ok(!/AVISOS/.test(R('claudioResumen_({ email: "juan@x" })')), 'sin nada listo ni preguntas: sin AVISOS');
  ctx.microAbiertos_ = microsDe;
  const api = leer('voz.js');
  ok(/CLAUDIO_HERR_\.indexOf\(herr\) >= 0\) out = claudioHerramienta_\(herr, body\)/.test(api), 'vozApi_ manda las herramientas de Claudio a claudioHerramienta_ (con la llave de voz)');

  /* 5. Leer código: solo GET a GitHub y corto */
  mem.GITHUB_TOKEN = 'tok'; salidas = [];
  resp = s => /search\/code/.test(s.url) ? { codigo: 200, cuerpo: { items: Array.from({ length: 9 }, (_, i) => ({ path: 'apps-script/a' + i + '.js', text_matches: [{ fragment: 'x'.repeat(900) }, { fragment: 'y' }, { fragment: 'z' }] })) } }
    : /contents/.test(s.url) ? { codigo: 200, cuerpo: { content: Buffer.from(Array.from({ length: 400 }, (_, i) => 'linea ' + i + (i === 200 ? ' orbitaLista_' : '')).join('\n')).toString('base64') } } : { codigo: 404, cuerpo: '' };
  const b1 = H('claudio_codigo', { conv_id: 'conv_5', buscar: 'órbita pedidos' });
  const b2 = H('claudio_codigo', { conv_id: 'conv_5', buscar: 'orbitaLista_', archivo: 'apps-script/orbita.js' });
  ok(salidas.length >= 2 && salidas.every(s => s.metodo === 'get' && /^https:\/\/api\.github\.com\//.test(s.url)), 'leer código: solo GET a la API de GitHub (nada se escribe)');
  ok(b1.ok && b1.hallados.length <= 5 && b1.hallados.every(h => h.fragmentos.length <= 2 && h.fragmentos.every(f => f.length <= 300)), 'la búsqueda devuelve poco: 5 archivos, 2 fragmentos cortos cada uno');
  ok(b2.ok && /orbitaLista_/.test(b2.parte) && b2.parte.length <= R('CLAUDIO_CODIGO_MAX_'), 'con el archivo: la parte que coincide, corta');
  ok(/Hub-Spacioam/.test(salidas[0].url) && H('claudio_codigo', { conv_id: 'conv_5', buscar: 'VozNativa', repo: 'app' }) && /alma-app/.test(salidas[salidas.length - 1].url), 'el Hub por defecto y la app de iPhone si lo pide');
}

/* 6. Su prompt, y Claudio no existe con otras audiencias */
{ const t = R('claudioPromptCompleto_()'); let o = null; try { o = JSON.parse(t); } catch (e) {}
  ok(o && o.claudio && o.claudio.quien_eres && Object.keys(o).pop() === 'ficha_de_quien_llama', 'el prompt de Claudio es JSON por secciones con la ficha al final');
  ok((t.match(/\{\{[^}]*\}\}/g) || []).join() === '{{quien_llama}}' && t.indexOf('marca_principal') < 0, 'solo {{quien_llama}} (la marca nunca va en el prompt)');
  ok(/como explicándole a un niño/.test(t) && /«une»/.test(t) && /segundo plano/.test(t) && /volver_con_alma/.test(t) && /en ese mismo turno con claudio_pedido/.test(t) && /AVISOS/.test(t), 'habla simple, pide sin repetir (como Alma), une solo con «une», dice lo de segundo plano, da los avisos y sabe volver con Alma');
  const FR = /te (paso|comunico|transfiero) con claudio/i, P = 'PUEDES PASARLO CON CLAUDIO';
  ['chat_texto', 'whatsapp_texto', 'calle_texto', 'redactor', 'chat_herramientas'].forEach(k => {
    const x = a[k].join('\n'); ok(!FR.test(x) && x.indexOf(P) < 0 && x.indexOf('hablar_con_claudio') < 0, k + ': sin «te paso con Claudio» ni su permiso');
  });
  const voz = JSON.parse(a.voz[0]);
  ok(!FR.test(a.voz[0]) && JSON.stringify(voz.con_huespedes || '').indexOf('Claudio') < 0, 'la voz de Alma: la frase no va en su prompt y lo de huéspedes no nombra a Claudio');
  ok(/claudioSyncSiToca_\(false\)/.test((leer('voz.js').match(/function vozSyncSiToca_\(\) \{[\s\S]*?\n\}/) || [''])[0]), 'Claudio se crea y se sincroniza solo, cada 30 min con el prompt de Alma');
  ok(/claudio: claudioSyncSiToca_\(true\)/.test(leer('Código.js')), 'el robot voz_sync también lo sincroniza');
  /* 7. Habla como Alma (Juan, 16-nov-2026): sus secciones salen de la misma fuente (playbooks/alma.json y el Modo Weebo). */
  const C = o.claudio, F = R('ALMA_FUENTE_'), txt = (l, id) => l.filter(x => x.id === id)[0].texto;
  ok(JSON.stringify(C.como_hablas) === JSON.stringify(F.identidad.como_habla.map(x => R('almaRellenar_(' + JSON.stringify(x.texto) + ', {})'))), '7 · cómo habla: lo mismo que Alma, tomado de la fuente única (si cambia allá, cambia aquí)');
  ok(C.por_voz.indexOf(txt(F.canales.voz.reglas, 'v_turno')) >= 0 && C.por_voz.indexOf(txt(F.canales.voz.reglas, 'v_silencio')) >= 0 && C.por_voz.indexOf(txt(F.canales.voz.reglas, 'v_interrumpen')) >= 0, '7 · por voz: respuesta primero, 2–3 frases, se detiene si lo interrumpen, skip_turn en pausas');
  ok(C.una_sola_confirmacion_por_cosa.indexOf(txt(F.confirmaciones.reglas, 'c_no_anuncia')) >= 0 && C.una_sola_confirmacion_por_cosa.indexOf(txt(F.confirmaciones.reglas, 'c_entendi')) >= 0, '7 · confirmaciones de Alma que aplican, también la de no repetir el pedido (16-nov-2026: pide como Alma)');
  ok(C.nunca.length === 5 && C.nunca.every(x => !/secretaria|mi sistema/.test(x)), '7 · «nunca» de Alma, sin lo de sus herramientas');
  ok(/MODO WEEBO/.test(C.weebo.join('\n')) && /MODO WEEBO FIJO/.test(C.weebo.join('\n')) && /ADAPTACIÓN A JUAN/.test(C.weebo.join('\n')) && !/de Alma/.test(C.weebo.join('\n')), '7 · Modo Weebo con su nivel y la adaptación a Juan');
  ok(!/huésped|reserva|lookup_reservation|property_info|secretaria|caller_type/i.test(JSON.stringify(C).replace(/un mensaje a un huésped, una reserva/, '')), '7 · nada de huéspedes, reservas ni herramientas de Alma');
  ok(/Solo cuando claudio_pedido devolvió ok/.test(t) && /NO SE HIZO NADA», no digas que quedó/.test(t), '7 · «quedó pedido» solo con la herramienta en ok (16-nov: lo dijo con un error)');
  ok(C.una_sola_confirmacion_por_cosa.indexOf(txt(F.confirmaciones.reglas, 'c_nunca_memoria')) >= 0, '7 · la regla de Alma: nunca «listo» ni «quedó» sin que la herramienta lo confirme');
  ok(/nunca «vos», «querés»/.test(t), '7 · de tú, sin voseo («¿Querés?» salió con el prompt viejo)');
  ctx.B_ = { conv_id: 'conv_x' }; mem.CLAUDIO_AGENT_ID = 'agent_claudio'; ctx.vozWebConvInfo_ = () => ({ tel: '', agente: 'agent_claudio' });
  ok(/^NO SE HIZO NADA/.test(R("claudioHerramienta_('claudio_pedido', B_)").error), '7 · sin la firma: el error empieza con «NO SE HIZO NADA» (no es un «listo»)');
  ok(t.length <= 10000, '7 · corto: ' + t.length + ' caracteres (cada turno lo manda entero)');
  ctx.personalidadFicha_ = () => ({ bloque: '\nMODO WEEBO FIJO: nivel 3 (lo fijó Juan).\nADAPTACIÓN A JUAN: 50 %' });
  mem = { ELEVENLABS_KEY: 'k', CLAUDIO_AGENT_ID: 'agent_claudio' }; resp = s => /get-signed-url/.test(s.url) ? { codigo: 200, cuerpo: { signed_url: 'wss://c' } } : { codigo: 404, cuerpo: '' };
  ctx.SES_ = { email: 'juan@x' }; ctx.MOT_ = '';
  const fj = R('claudioWebInicio_(SES_, MOT_)');
  ok(fj.ok && /MODO WEEBO FIJO: nivel 3/.test(fj.dynamic_variables.quien_llama) && /ADAPTACIÓN A JUAN/.test(fj.dynamic_variables.quien_llama), '7 · su ficha trae el mismo Weebo y la misma adaptación que la de Alma'); }

/* 8. Pase sin ceremonia y vuelta con Alma que cierra (Juan, 16-nov-2026: «Claudio aparece y se va; cuando se va vuelve Alma y
   cierra esa interacción»). */
{ const sal = [0, 1, 2].map(i => R("claudioSaludo_('Juan', '', " + i + ")"));
  ok(sal.every(x => /^¡?Hola, Juan/.test(x) && /Alma/.test(x) && /¿/.test(x) && !/aquí Claudio/.test(x)) && new Set(sal).size === 3, '8 · Claudio saluda como persona que llegó («Hola, Juan, ¿cómo estás? Alma me dijo que me necesitabas»), variado');
  const sm = R("claudioSaludo_('Juan', 'quiero hablar con Claudio sobre el botón de pagos', 0)");
  ok(/por lo del botón de pagos\. Cuéntame\.$/.test(sm), '8 · con motivo, lo nombra: «… por lo del botón de pagos. Cuéntame.» (' + sm + ')');
  ok(/Cuéntame\.$/.test(R("claudioSaludo_('Juan', 'ayúdame con algo raro que vi ayer en la app cuando abrí', 1)")), '8 · un motivo largo no se lee: «Cuéntame.»');
  const t = R('claudioPromptCompleto_()');
  ok(/terminaron lo de desarrollo o dice que eso era todo/.test(t) && /usa volver_con_alma, nunca end_call/.test(t), '8 · al terminar, Claudio vuelve con Alma (volver_con_alma), no cuelga');
  const pv = R("claudioDefHerramientas_('B')").filter(d => d.name === 'poner_voz')[0];
  ok(pv && pv.type === 'client' && pv.expects_response === true && pv.response_timeout_secs >= 60 && ['voz', 'enlace', 'frase'].every(k => pv.parameters.properties[k]), '8 · poner_voz (#779): de la app, espera a que suene, con voz, enlace y frase');
  ok(pv && /en ese mismo turno/.test(pv.description) && /Te la pongo/.test(pv.description) , '8 · poner_voz se usa en ese mismo turno, con «Te la pongo.» (sin agrandar su prompt: lo dice la herramienta)');
  const vv = R("claudioDefHerramientas_('B')").filter(d => d.name === 'volver_con_alma')[0];
  ok(vv && /cuando ya terminaron/.test(vv.description) && /en vez de colgar/.test(vv.description), '8 · la herramienta volver_con_alma lo dice también');
  /* Lo que hizo Claudio sale de sus herramientas, por conversación y solo para el mismo administrador. */
  cache = {}; let conv = { tel: '50211110000', otro: true, agente: 'agent_claudio' }; ctx.vozWebConvInfo_ = () => conv;
  ctx.claudeMandarYa_ = () => ({ texto: 'Listo, quedó pedido.', claude: { ok: true } }); ctx.opGuardar_ = () => ({});
  const H = (herr, b) => { ctx.B_ = b; return R("claudioHerramienta_('" + herr + "', B_)"); };
  const V = (email, c) => { ctx.ADM_ = email === 'juan@x' ? JUAN : ANA; return R("claudioVuelta_(ADM_, '" + c + "')"); };
  ok(V('juan@x', 'conv_9').frase === 'Listo. Si necesitas algo más, aquí estoy.', '8 · sin pedido: «Listo. Si necesitas algo más, aquí estoy.»');
  H('claudio_pedido', { conv_id: 'conv_9', pedido: 'cambiar el color del botón de pagos' });
  const v1 = V('juan@x', 'conv_9');
  ok(v1.frase === 'Ya volví. Si necesitas algo más, aquí estoy.' && /pedido creado «/.test(v1.linea) && /no saludes/.test(v1.linea), '8 · con el pedido confirmado: Claudio ya lo dijo, Alma no repite «quedó pedido» (17-nov: «con una sola vez basta») (' + v1.frase + ')');
  const p2 = H('claudio_pedido', { conv_id: 'conv_9', pedido: 'y que el botón sea más grande' });
  ok(p2.ok && p2.corta && !/quedó pedido/.test(p2.hecho + p2.resultado.replace(/No repitas «quedó pedido»/, '')) && /^También quedó\.$/.test(p2.hecho), '8 · el segundo pedido de la llamada se confirma corto: «' + p2.hecho + '»');
  ok(V('ana@x', 'conv_9').frase === 'Listo. Si necesitas algo más, aquí estoy.', '8 · lo de la conversación de Juan no se le cuenta a otro administrador');
  ctx.claudeMandarYa_ = () => ({ texto: 'falló GitHub', claude: { ok: false } });
  H('claudio_pedido', { conv_id: 'conv_10', pedido: 'otra cosa' });
  const v2 = V('juan@x', 'conv_10');
  ok(!/quedó pedido/.test(v2.frase) && /no salió/.test(v2.frase) && /NO salió/.test(v2.linea), '8 · si el pedido falló, Alma dice la verdad («el pedido no salió»), nunca «quedó pedido»');
  /* vozWebInicio_ con la conversación de Claudio: la frase de cierre para la app y la línea en la ficha. */
  mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agent_alma' };
  resp = s => /get-signed-url/.test(s.url) ? { codigo: 200, cuerpo: { signed_url: 'wss://alma' } } : { codigo: 404, cuerpo: '' };
  ctx.SES_ = { email: 'juan@x' };
  const w = R("vozWebInicio_(SES_, false, true, true, 'conv_9')");
  ok(w.ok && w.vuelta === v1.frase && w.cerrar_tras_vuelta === true && /VUELVES DE CLAUDIO/.test(w.dynamic_variables.quien_llama), '8 · al volver, el Hub da la frase de cierre (vuelta) y la app cuelga si Juan no sigue');
  const w0 = R("vozWebInicio_(SES_, false, true, true, '')");
  ok(w0.ok && !w0.vuelta && !w0.cerrar_tras_vuelta, '8 · una llamada normal no trae cierre'); }

if (!fallo) console.log('Todo bien: Claudio solo con el principal, una vez, sin unir sin «une».');
process.exit(fallo);
