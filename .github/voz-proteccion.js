/* Protección de las instrucciones de Alma en la voz (#498 T3; apps-script/vozproteccion.js), con dobles de ElevenLabs y
   de Google: sin internet. 12-nov: la protección integrada «Prompt Injection» de ElevenLabs colgó una llamada de Juan
   mientras le pedía a Alma mejorar su prompt. Revisa lo que el Hub sincroniza y quién recibe la marca del principal:
   1. la marca: 16 caracteres al azar, guardada en las Propiedades del script, estable; solo el principal la recibe;
   2. la protección: integrada apagada, la personalizada con retry (no cuelga), en streaming, con la marca y la variable
      {{marca_principal}} en su texto, y un aviso de reintento sin {{trigger_reason}} ni el código;
   3. la sincronización: un solo PATCH que deja las demás protecciones y placeholders como estaban, agrega «ninguna» como
      valor por defecto, no repite si nada cambió y no guarda la huella si ElevenLabs falla;
   4. la llamada: por teléfono (vozInicio_) y desde la app (vozWebInicio_) solo el principal lleva el código; el equipo,
      un huésped, un número desconocido y quien solo dice ser Juan llevan «ninguna»;
   5. el prompt de Alma (el modelo que habla) nunca menciona la marca.
   node .github/voz-proteccion.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

/* Lo que tiene hoy el agente en ElevenLabs (12-nov), más otra personalizada que el Hub no debe tocar. */
const ACTUAL = () => ({
  version: '1', focus: { is_enabled: true }, prompt_injection: { is_enabled: true }, synthetic_voice: { is_enabled: false },
  content: { execution_mode: 'streaming', config: { sexual: { is_enabled: true, threshold: 0.3 } }, trigger_action: { type: 'end_call' } },
  moderation: { execution_mode: 'streaming', config: { harassment: { is_enabled: true, threshold: 0.8 } } },
  custom: { config: { configs: [{ name: 'Otra', prompt: 'no hables de política', is_enabled: true }] } }
});
const PH = () => ({ quien_llama: 'Número no identificado' });

function caja(props, agente) {
  const llamadas = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), base64Encode: b => Buffer.from(b).toString('base64'),
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(String(s)).digest()], DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
    },
    esAdminPrincipal_: a => !!(a && a.principal),
    uf_: (url, o) => {
      o = o || {}; llamadas.push({ url, metodo: o.method || 'get', cuerpo: o.payload ? JSON.parse(o.payload) : null, llave: (o.headers || {})['xi-api-key'] });
      if ((o.method || 'get') === 'get') return { getResponseCode: () => agente.get || 200, getContentText: () => JSON.stringify({ platform_settings: { guardrails: agente.guardrails }, conversation_config: { agent: { dynamic_variables: { dynamic_variable_placeholders: agente.ph } } } }) };
      const code = agente.patch || 200;
      if (code < 300) { const b = JSON.parse(o.payload); agente.guardrails = b.platform_settings.guardrails; agente.ph = b.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders; }
      return { getResponseCode: () => code, getContentText: () => (code < 300 ? '{}' : '{"detail":"mal"}') };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'vozproteccion.js'), 'utf8'), ctx);
  return { ctx, llamadas };
}

/* 1. La marca */
{ const props = {}, c = caja(props, {});
  const m = c.ctx.vozMarcaPrincipal_();
  ok(/^[a-f0-9]{16}$/.test(m) && props.VOZ_MARCA_PRINCIPAL === m, 'la marca del principal: 16 caracteres al azar, guardada en VOZ_MARCA_PRINCIPAL');
  ok(c.ctx.vozMarcaPrincipal_() === m, 'la marca es estable (no cambia en cada llamada)');
  ok(c.ctx.vozMarcaPara_({ principal: true }) === m, 'el administrador principal recibe el código');
  ok(c.ctx.vozMarcaPara_({ principal: false, rol: 'admin' }) === 'ninguna' && c.ctx.vozMarcaPara_(null) === 'ninguna', 'un administrador del equipo o nadie: «ninguna»');
  c.ctx.esAdminPrincipal_ = () => { throw new Error('hoja caída'); };
  ok(c.ctx.vozMarcaPara_({ principal: true }) === 'ninguna', 'si no se puede saber quién es: «ninguna» (falla del lado seguro)');
  const props2 = { VOZ_MARCA_PRINCIPAL: 'soy juan' }; const c2 = caja(props2, {});
  ok(/^[a-f0-9]{16}$/.test(c2.ctx.vozMarcaPrincipal_()), 'una marca rara en la propiedad se cambia por una buena'); }

/* 2. La protección */
{ const c = caja({}, {}), m = c.ctx.vozMarcaPrincipal_(), cfg = c.ctx.vozProteccionConfig_(m);
  ok(cfg.is_enabled === true && cfg.trigger_action.type === 'retry', 'la personalizada está prendida y reintenta (no cuelga)');
  ok(cfg.execution_mode === 'streaming', 'en streaming: no suma espera a cada respuesta');
  ok(['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'claude-haiku-4-5', 'claude-sonnet-4-6', 'gpt-5.4-nano', 'gpt-5.4-mini'].indexOf(cfg.model) >= 0, 'un modelo que ElevenLabs acepta: ' + cfg.model);
  ok(cfg.history_message_count >= 1 && cfg.history_message_count <= 100, 've lo último que dijo la persona (history_message_count ' + cfg.history_message_count + ')');
  ok(cfg.prompt.split('{{marca_principal}}').length === 2 && cfg.prompt.indexOf(m) >= 0, 'el texto compara {{marca_principal}} con el código');
  ok(cfg.prompt.length <= 10000 && cfg.name.length <= 500, 'dentro de los límites de ElevenLabs (' + cfg.prompt.length + ' caracteres)');
  ok(/soy Juan/.test(cfg.prompt) && /nunca la conversación/.test(cfg.prompt), 'decir «soy Juan» en la conversación no cuenta');
  ok(/reglas de la casa/.test(cfg.prompt), 'no bloquea lo normal con huéspedes (reglas de la casa, horarios, reservas)');
  ok(cfg.trigger_action.feedback.indexOf('{{trigger_reason}}') < 0 && cfg.trigger_action.feedback.indexOf(m) < 0, 'el aviso de reintento no cita el motivo ni el código');
  const g = c.ctx.vozProteccionAplicar_(ACTUAL(), cfg);
  ok(g.prompt_injection.is_enabled === false, 'la integrada «Prompt Injection» (cuelga) queda apagada');
  ok(JSON.stringify(g.content) === JSON.stringify(ACTUAL().content) && JSON.stringify(g.moderation) === JSON.stringify(ACTUAL().moderation) && g.focus.is_enabled === true,
    'contenido, moderación y enfoque quedan como estaban');
  const otra = c.ctx.vozProteccionAplicar_(g, cfg).custom.config.configs;
  ok(otra.length === 2 && otra[0].name === 'Otra' && otra.filter(x => x.name === cfg.name).length === 1, 'la otra personalizada sigue y la nuestra no se duplica');
  ok(c.ctx.vozProteccionAlDia_(g, cfg) && !c.ctx.vozProteccionAlDia_(ACTUAL(), cfg), 'sabe si ElevenLabs ya está como dice el código'); }

/* 3. La sincronización */
{ const props = {}, ag = { guardrails: ACTUAL(), ph: PH() }, c = caja(props, ag);
  ok(c.ctx.vozProteccionSiCambio_(false).ok === false && !c.llamadas.length, 'sin ELEVENLABS_KEY: no llama a ElevenLabs'); }
{ const props = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agente' }, ag = { guardrails: ACTUAL(), ph: PH() }, c = caja(props, ag);
  const r = c.ctx.vozProteccionSiCambio_(false), patch = c.llamadas.filter(l => l.metodo === 'patch');
  ok(r.ok && r.accion === 'retry' && patch.length === 1, 'la primera vez: un solo PATCH al agente');
  const b = patch[0].cuerpo;
  ok(Object.keys(b).sort().join() === 'conversation_config,platform_settings' && Object.keys(b.platform_settings).join() === 'guardrails', 'el PATCH solo toca las protecciones y las variables');
  ok(b.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders.marca_principal === 'ninguna' && b.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders.quien_llama === 'Número no identificado',
    'agrega «ninguna» como valor por defecto de {{marca_principal}} y deja {{quien_llama}}');
  ok(b.platform_settings.guardrails.prompt_injection.is_enabled === false && b.platform_settings.guardrails.custom.config.configs.some(x => (x.trigger_action || {}).type === 'retry' && x.prompt.indexOf(props.VOZ_MARCA_PRINCIPAL) >= 0),
    'sube la integrada apagada y la personalizada con la marca de las Propiedades');
  const antes = c.llamadas.length; c.ctx.vozProteccionSiCambio_(false);
  ok(c.llamadas.length === antes, 'si nada cambió: no vuelve a llamar (huella)');
  props.VOZ_PROTECCION_T = String(Date.now() - 25 * 3600000); c.ctx.vozProteccionSiCambio_(false);
  ok(c.llamadas.length === antes + 1 && c.llamadas[antes].metodo === 'get', 'una vez al día la lee y, si sigue igual, no la cambia');
  ag.guardrails.prompt_injection.is_enabled = true; c.ctx.vozProteccionSiCambio_(true);
  ok(c.llamadas.filter(l => l.metodo === 'patch').length === 2 && ag.guardrails.prompt_injection.is_enabled === false, 'si alguien la prendió a mano, la vuelve a dejar como dice el código');
  ok(JSON.stringify(c.llamadas).indexOf(props.VOZ_MARCA_PRINCIPAL) >= 0 && String(props.VOZ_PROTECCION).indexOf(props.VOZ_MARCA_PRINCIPAL) < 0, 'el estado guardado (VOZ_PROTECCION) no lleva el código'); }
{ const props = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agente' }, ag = { guardrails: ACTUAL(), ph: PH(), patch: 422 }, c = caja(props, ag);
  const r = c.ctx.vozProteccionSiCambio_(false);
  ok(!r.ok && /422/.test(r.error) && !props.VOZ_PROTECCION_HUELLA, 'si ElevenLabs rechaza el cambio: lo dice y lo reintenta en la siguiente vuelta (sin huella)'); }

/* 4 y 5. La llamada y el prompt, con el Hub completo cargado (los mismos dobles que el presupuesto de los prompts). */
{ const { armar } = require('./prompts-armados.js');
  const a = armar(DIR), ctx = a._ctx;
  ok(a.voz[0].indexOf('marca_principal') < 0 && a.voz[0].indexOf('VOZ_MARCA') < 0, 'el prompt de Alma (el modelo que habla) no menciona la marca');
  const fuera = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== 'vozproteccion.js' && /\{\{marca_principal\}\}/.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
  ok(!fuera.length, '{{marca_principal}} solo está en el texto de la protección' + (fuera.length ? ': también en ' + fuera.join(', ') : ''));
  const mem = {}; ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty() {} }) };
  ctx.Utilities.getUuid = () => crypto.randomUUID();
  const JUAN = { email: 'juan@x', nombre: 'Juan', principal: true, tels: ['50211110000'] }, ANA = { email: 'ana@x', nombre: 'Ana', principal: false, rol: 'admin', tels: ['50222220000'] };
  const por = { '50211110000': { caller_type: 'juan', caller_name: 'Juan' }, '50222220000': { caller_type: 'equipo', caller_name: 'Ana' }, '50233330000': { caller_type: 'externo', verified: true, code: 'HM1', guest_name: 'Huésped Prueba' } };
  Object.assign(ctx, {
    vozLookup_: b => por[b.caller_id] || {}, adminsOp_: () => [JUAN, ANA], adminPorTel_: t => [JUAN, ANA].filter(x => x.tels[0] === t)[0] || null,
    esAdminPrincipal_: x => !!(x && x.principal), contextoReciente_: () => null, encargoAbierto_: () => null,
    vozWebAdmin_: ses => (ses && ses.email === 'juan@x' ? JUAN : ses && ses.email === 'ana@x' ? ANA : null), vozWebFicha_: () => 'ficha', saludosVoz_: () => [],
    calleSueno_: () => ({}), personalidadFicha_: () => null, retFicha_: () => null, vozWebToken_: () => 'tok', vozWebTiempos_: () => {}
  });
  mem.ELEVENLABS_KEY = 'k'; mem.ELEVENLABS_AGENT_ID = 'agente';
  const marca = vm.runInContext('vozMarcaPrincipal_()', ctx);
  const tel = t => vm.runInContext('vozInicio_(' + JSON.stringify({ caller_id: t }) + ')', ctx).dynamic_variables.marca_principal;
  ok(tel('50211110000') === marca, 'por teléfono: el número del principal lleva el código');
  ok(tel('50222220000') === 'ninguna', 'por teléfono: un administrador del equipo lleva «ninguna»');
  ok(tel('50233330000') === 'ninguna' && tel('50299990000') === 'ninguna', 'por teléfono: un huésped o un número desconocido lleva «ninguna»');
  const web = e => { ctx.SES_ = { email: e }; return (vm.runInContext('vozWebInicio_(SES_, true, true)', ctx).dynamic_variables || {}).marca_principal; };
  ok(web('juan@x') === marca, 'desde la app: la sesión del principal lleva el código');
  ok(web('ana@x') === 'ninguna', 'desde la app: la sesión de alguien del equipo lleva «ninguna»');
  ok(vm.runInContext('vozWebInicio_({ email: "nadie@x" }, true, true)', ctx).ok === false, 'sin sesión de administrador no hay ficha ni marca');
  const sal = vm.runInContext('vozInicio_({ caller_id: "50211110000", saliente: true })', ctx).dynamic_variables.marca_principal;
  ok(sal === marca, 'si Alma llama al principal (saliente), también lleva el código'); }

process.exit(fallo);
