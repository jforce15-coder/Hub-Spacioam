/* Prueba de los WhatsApp a socios (apps-script/sociosmi.js, contacto.js, entrega.js, socios.js y partes de agente.js y
   Código.js) con dobles: sin internet ni Google. 13-nov-2026: Juan pidió escribirle al socio de un apartamento y al de
   otro; Alma no encontró sus números (y le preguntó por el de un apartamento vecino), dijo que ya estaba sin poder
   confirmar nada (no salió ningún mensaje) y, cuando un socio escribe, a veces nadie le contesta. Revisa las 4 fallas:
   1. «¿salió?»: el estado de Meta del mensaje (enviado, entregado, leído, fallido) decide si Alma puede decir «listo» (y
      se guarda aunque la cola tenga el candado);
      sin estado a tiempo queda vigilado y va a Pendientes; «¿le llegó?» dice lo que de verdad pasó (o que no salió nada);
      un 131049 a un +502 no habla de Estados Unidos;
   2. el número del socio: SETUP de Mi (apartamento → correo) + Control de usuarios (correo → teléfono), la ficha de
      contacto, o lo que Juan ya escribió en su chat (y queda guardado); nunca el del apartamento vecino;
   3. fuera de 24 h siempre sale una plantilla: la de socios si se puede y, si no (sin apartamento, sin aprobar, Meta la
      rechaza), la de primer contacto; a un +1 sin la de socios, no (Meta no se la entrega);
      un número que Juan manda por WhatsApp junto al apartamento queda en la ficha al llegar;
   4. si la persona escribe algo de verdad, Alma le contesta: el mensaje guardado queda antes del suyo, el encargo nunca
      la deja sin respuesta, un socio con ficha entra como socio y una llamada del mismo administrador no cierra su encargo.
   node .github/socios-whatsapp.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js'), AGE = leer('agente.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };

/* Números y nombres de prueba: no son los reales. */
const JUAN = '50255550100', SOC_A = '50255550201', SOC_B = '50255550202', VECINO = '50255550203', USA = '17865550204';
const PROPS = ['Z13 - Edificio Alto - 633', 'Z13 - Edificio Alto - 623', 'Z4 - Calle Rue - 301', 'Z10 - Torre Sol - 1508'];

function hoja(filas) {
  return { getDataRange: () => ({ getDisplayValues: () => filas.map(r => r.map(String)), getValues: () => filas }), getLastRow: () => filas.length,
    appendRow: r => filas.push(r.slice()), filas };
}
function caja(o) {
  o = o || {};
  const props = Object.assign({ WA_WABA_ID: 'waba', WA_TOKEN: 't', WA_PHONE_ID: 'p' }, o.props || {}), cache = {};
  const posts = [], wa = [], datos = [], fichas = (o.fichas || []).slice(), guardadas = [], pend = [];
  const SETUP = [['property_id', 'property_name', 'Usuario ID', 'User email', 'secondary user email'],
    ['a', PROPS[0], 'Socio_010', 'socio.a@prueba.test', ''], ['b', PROPS[1], 'Socio_006', 'vecino@prueba.test', ''], ['c', PROPS[2], 'Socio_032', 'socio.b@prueba.test', ''], ['d', PROPS[3], 'Socio_020', 'socio.c@prueba.test', '']];
  const USR = [['user_id', 'primer_nombre', 'primer_apellido', 'nombre', 'email', 'email_alterno', 'es_socio', 'telefono'],
    ['u1', '', '', 'Socio_010', 'socio.a@prueba.test', '', 'sí', o.telA || ''], ['u2', 'Vecino', 'Prueba', 'Vecino Prueba', 'vecino@prueba.test', '', 'sí', VECINO],
    ['u3', '', '', 'Socio_032', 'socio.b@prueba.test', '', 'sí', ''], ['u4', 'Sol', 'Prueba', '', 'socio.c@prueba.test', '', 'sí', USA]];
  let reloj = Date.parse('2026-11-13T19:30:00Z');
  const ctx = {
    console: { log() {}, warn() {}, error(e) { if (o.verErrores) console.log('  (error) ' + e); } }, JSON, Math, String, Number, Object, Array, RegExp, isNaN,
    Date: Object.assign(function (...a) { return a.length ? new Date(...a) : new Date(reloj); }, { now: () => reloj, parse: Date.parse, UTC: Date.UTC }),
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !o.colaOcupada, waitLock() {}, releaseLock() {} }), getUserLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: { sleep: ms => { reloj += ms; if (o.alDormir) o.alDormir(ctx, props); }, formatDate: d => new Date(d).toISOString().slice(0, 16) },
    SpreadsheetApp: { openById: id => ({ getSheetByName: n => (n === 'SETUP' ? hoja(SETUP) : null), getSheets: () => [hoja(USR)] }) },
    RMES_HOJA_: 'hoja-mi', SHEET_ACCESOS_ID: 'hoja-usuarios', CFG: { TZ: 'America/Guatemala', WHATSAPP_JUAN: JUAN },
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8),
    s_: v => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    celdaTexto_: x => String(x), acortarEnTexto_: t => t, idiomaDe_: t => (/\b(the|thanks|you|is)\b/i.test(t) ? 'en' : 'es'),
    adminsOp_: () => [{ nombre: 'Juan Prueba', email: 'juan@prueba', tels: [JUAN], principal: true }],
    adminPorTel_: w => (ctx.fin8_(w) === ctx.fin8_(JUAN) ? ctx.adminsOp_()[0] : null), adminPorEmail_: () => ctx.adminsOp_()[0],
    opFilas_: () => (o.chat || []).map(t => ({ de: 'yo', ts: '2026-11-13T19:14:08.000Z', texto: t })),
    contactosTodos_: () => fichas, contactoFicha_: w => fichas.filter(f => ctx.fin8_(f.tel) === ctx.fin8_(w))[0] || null,
    contactoGuardar_: (w, x) => { guardadas.push(Object.assign({ tel: w }, x)); const f = ctx.contactoFicha_(w); if (f) Object.assign(f, x); else fichas.push(Object.assign({ tel: w }, x)); },
    hojaCrear_: () => ({ appendRow: r => datos.push(r) }), DATO_HECHO_CAB_: [],
    hojaWA_: () => ({ appendRow: r => wa.push(r) }),
    waCfg_: () => ({ token: 't', phoneId: 'p' }),
    waVentana_: () => !!o.ventana,
    waEnviar_: (n, t) => { posts.push({ tipo: 'texto', a: n, t }); return { ok: true, modo: 'texto', id: 'wamid.t' + posts.length }; },
    uf_: (url, op) => {
      if (/message_templates/.test(url)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ data: [{ name: 'contacto_alma', status: 'APPROVED' }] }) };
      const b = JSON.parse(op.payload); posts.push({ tipo: 'plantilla', a: b.to, nombre: b.template && b.template.name, params: b.template && b.template.components[0].parameters.map(x => x.text) });
      const rechaza = o.rechazaSocios && b.template && b.template.name === 'estado_cuenta_socio';
      return { getResponseCode: () => (rechaza ? 400 : 200), getContentText: () => JSON.stringify(rechaza ? { error: { code: 132000, message: 'parámetros' } } : { messages: [{ id: 'wamid.p' + posts.length }] }) };
    },
    accesosPorRol_: () => ({ socios: o.accSocios || [] }), waPropietarios_: () => [], waHilo_: () => [],
    personalNotar_() {}, personalDe_: () => null, pendAvisar_: (adm, t) => { pend.push(t); return true; },
    esAdminOp_: a => !!(a && a.email === 'juan@prueba'), hubInbox_: () => [], esRespuestaAutomatica_: t => /gracias por contactar/i.test(t)
  };
  vm.createContext(ctx);
  vm.runInContext(['telsEnTexto_', 'normTel_', 'telsDe_'].map(n => sacar(COD, n)).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  ['sociosmi.js', 'socios.js', 'contacto.js', 'entrega.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  vm.runInContext(['encargoRespuestaFalta_', 'agSocio_'].map(n => sacar(AGE, n)).join('\n'), ctx, { filename: 'agente.js (extracto)' });
  return { ctx, props, posts, wa, datos, fichas, guardadas, pend, avanzar: ms => { reloj += ms; } };
}

/* ── 2 · El número del socio ── */
let C = caja({ telA: '5555 0201' });
let r = C.ctx.socioParaEscribir_('socio de Edificio Alto 633');
ok(r && r.tel === SOC_A && r.propiedad === PROPS[0] && r.fuente === 'Control de usuarios', '«socio de Edificio Alto 633»: el número sale de Mi (SETUP) y del Control de usuarios');
ok(C.ctx.socioParaEscribir_('los socios del Edificio Alto 633').tel !== VECINO && C.ctx.socioPropsEnTexto_('Edificio Alto 633', PROPS).join() === PROPS[0], 'nunca el del apartamento vecino (633 no es 623)');
ok(C.ctx.socioParaEscribir_('Recepción Edificio Alto', 'Edificio Alto 633') === null, 'sin pedir al socio («Recepción …» con su apartamento) no se cambia de persona');
ok(C.ctx.socioPropDeTel_(SOC_A) === PROPS[0], 'el apartamento de un socio por su número (para la plantilla para socios)');

C = caja({ fichas: [{ tel: SOC_B, nombre: 'Socio B Prueba', tipo: 'socio', propiedades: 'Z4 - Calle Rue - 301' }] });
r = C.ctx.socioParaEscribir_('socio de Calle Rue 301');
ok(r && r.tel === SOC_B && r.fuente === 'ficha de contacto', 'sin teléfono en el Control de usuarios: la ficha de contacto del socio');

C = caja({ chat: ['*Z4 Calle Rue 301*\n\nTeléfono de socio: +502 5555 0202\nNombre: Socio B Prueba\n\n*Z13 Edificio Alto 633*\n\nTeléfono de socio: +502 5555 0201\nNombre: Socio A Prueba'] });
r = C.ctx.socioParaEscribir_('socio de Calle Rue 301');
const r2 = C.ctx.socioParaEscribir_('socio de Edificio Alto 633');
ok(r && r.tel === SOC_B && /chat/.test(r.fuente) && r2 && r2.tel === SOC_A, 'lo que Juan ya escribió en su chat: cada número con su apartamento (no el del siguiente)');
ok(C.guardadas.some(g => g.tel === SOC_B && g.tipo === 'socio' && /Rue - 301/.test(g.propiedades)) && C.datos.length >= 1, 'y queda guardado en la ficha como socio de ese apartamento (dato de hecho)');

C = caja();
const MSG = '*Z4 Calle Rue 301*\n\nTeléfono de socio: +502 5555 0202\nNombre: Socio B Prueba\n\n*Z13 Edificio Alto 633*\n\nTeléfono de socio: +502 5555 0201\nNombre: Socio A Prueba\n\nPromesa para el apartamento: …';
let nota = C.ctx.socioDatosEnMensaje_(C.ctx.adminsOp_()[0], MSG);
ok(C.guardadas.length === 2 && C.guardadas.some(g => g.tel === SOC_B && /Rue - 301/.test(g.propiedades)) && C.guardadas.some(g => g.tel === SOC_A && /Alto - 633/.test(g.propiedades)) && /ya guardados/.test(nota),
  'Juan manda por WhatsApp los números de dos socios con su apartamento: quedan en la ficha de cada uno al llegar y Alma recibe la nota (13-nov)');
ok(C.ctx.socioDatosEnMensaje_({ email: 'otro@prueba' }, MSG) === '' && C.ctx.socioDatosEnMensaje_(C.ctx.adminsOp_()[0], 'Hola, ¿cómo va Calle Rue 301?') === '', 'solo de un administrador y solo si trae números de socios');
C = caja();
r = C.ctx.socioParaEscribir_('socio de Edificio Alto 633');
ok(r && r.error && r.sin_numero && /socio\.a@prueba\.test/.test(r.error) && /UNA vez/.test(r.error), 'sin número en ningún lado: dice quién es según Mi y pide el número una sola vez');
ok(C.ctx.agSocio_('Juan Prueba') === null, 'un nombre sin «socio» sigue el camino de siempre');

/* ── 3 · Fuera de 24 h siempre sale una plantilla ── */
C = caja({ fichas: [{ tel: SOC_B, nombre: 'Socio B Prueba', tipo: 'socio', propiedades: '' }], props: { WA_PLANTILLA_SOCIO: 'estado_cuenta_socio', WA_PLANTILLA_SOCIO_IDIOMA: 'es' } });
r = C.ctx.waEnviarAlguien_(SOC_B, 'Hola, te escribo para darte seguimiento.', { nombre: 'Socio B Prueba', de: 'Juan' });
ok(r.ok && r.modo === 'plantilla' && C.posts[0].nombre === 'contacto_alma' && r.id, 'socio sin apartamento conocido: sale la plantilla de primer contacto (antes no salía nada) y trae su id');
ok(JSON.parse(C.props.WA_PEND)[C.ctx.fin8_(SOC_B)][0].texto === 'Hola, te escribo para darte seguimiento.', 'y el mensaje completo queda guardado para cuando responda');
C = caja({ telA: '5555 0201', props: { WA_PLANTILLA_SOCIO: 'estado_cuenta_socio', WA_PLANTILLA_SOCIO_IDIOMA: 'es' }, accSocios: [{ tel: SOC_A, nombre: 'Socio A Prueba', propiedad: '' }] });
r = C.ctx.waEnviarAlguien_(SOC_A, 'Hola, tenemos novedades del apartamento.', { nombre: 'Socio A Prueba' });
ok(r.ok && C.posts[0].nombre === 'estado_cuenta_socio' && C.posts[0].params[1] === PROPS[0], 'con el apartamento de Mi, va la plantilla para socios con su apartamento');
C = caja({ telA: '5555 0201', rechazaSocios: true, props: { WA_PLANTILLA_SOCIO: 'estado_cuenta_socio', WA_PLANTILLA_SOCIO_IDIOMA: 'es' }, accSocios: [{ tel: SOC_A, nombre: 'Socio A Prueba', propiedad: PROPS[0] }] });
r = C.ctx.waEnviarAlguien_(SOC_A, 'Hola, tenemos novedades.', { nombre: 'Socio A Prueba' });
ok(r.ok && C.posts.map(p => p.nombre).join() === 'estado_cuenta_socio,contacto_alma' && /primer contacto/.test(r.aviso), 'Meta rechaza la de socios: sale la de primer contacto y lo dice');
C = caja({ accSocios: [{ tel: USA, nombre: 'Sol Prueba', propiedad: PROPS[3] }] });
r = C.ctx.waEnviarAlguien_(USA, 'Hola.', { nombre: 'Sol Prueba' });
ok(!r.ok && !C.posts.length, 'a un +1 sin la plantilla para socios aprobada no sale la de primer contacto (Meta no la entrega) y lo dice');
C = caja({ ventana: true });
r = C.ctx.waEnviarAlguien_(SOC_B, 'Hola.', {});
ok(r.ok && r.modo === 'texto' && r.id && C.wa[0][5] === r.id, 'dentro de las 24 h: texto libre, con su id para confirmar y anotado con ese id (si lo citan, se sabe a qué responde)');

/* ── 1 · Confirmación real antes de «listo» ── */
C = caja({ alDormir: (ctx, props) => { props.WA_ENTREGA = JSON.stringify({ [ctx.fin8_(SOC_A)]: { wa: SOC_A, id: 'wamid.x', estado: 'sent', ts: Date.now() } }); } });
let est = C.ctx.waEntregaEsperar_(SOC_A, 'wamid.x', 6000), cf = C.ctx.waConfirmacion_({ ok: true, modo: 'texto' }, est, 'Socio A');
ok(est && est.estado === 'sent' && cf.ok && cf.entrega === 'enviado', 'Meta dice «sent»: entrega enviado y ya puede decir que salió');
C = caja({ alDormir: (ctx, props) => { props.WA_ENTREGA = JSON.stringify({ [ctx.fin8_(SOC_A)]: { wa: SOC_A, id: 'wamid.x', estado: 'failed', motivo: 'el número no tiene WhatsApp', ts: Date.now() } }); } });
cf = C.ctx.waConfirmacion_({ ok: true }, C.ctx.waEntregaEsperar_(SOC_A, 'wamid.x'), 'Socio A');
ok(!cf.ok && /NO SALIÓ/.test(cf.error) && /Pendientes/.test(cf.error), 'Meta dice «failed»: no salió, con el motivo y en Pendientes');
C = caja();
est = C.ctx.waEntregaEsperar_(SOC_A, 'wamid.y', 6000); cf = C.ctx.waConfirmacion_({ ok: true, modo: 'plantilla' }, est, 'Socio A');
ok(est === null && cf.entrega === 'sin confirmación' && /NO digas «listo»/.test(cf.nota), 'sin estado a tiempo: nunca «listo»');
C.ctx.waVigilarAnotar_(SOC_A, 'wamid.y', 'Socio A', C.ctx.adminsOp_()[0]);
C.ctx.waVigilarRevisar_(); ok(!C.pend.length, 'vigilado: antes de 10 min no avisa');
C.avanzar(11 * 60000); C.ctx.waVigilarRevisar_();
ok(C.pend.length === 1 && /No tengo confirmación de Meta/.test(C.pend[0]) && JSON.parse(C.props.WA_VIGILA)['wamid.y'] === undefined, 'a los 10 min sin estado de Meta: va a Pendientes una vez');
C.ctx.waVigilarRevisar_(); ok(C.pend.length === 1, 'y no se repite');
C = caja(); C.ctx.waVigilarAnotar_(SOC_A, 'wamid.z', 'Socio A', null);
C.props.WA_ENTREGA = JSON.stringify({ [C.ctx.fin8_(SOC_A)]: { wa: SOC_A, id: 'wamid.z', estado: 'delivered', ts: Date.now() } }); C.avanzar(11 * 60000); C.ctx.waVigilarRevisar_();
ok(!C.pend.length, 'si Meta confirmó, no avisa nada');

C = caja({ colaOcupada: true });
C.ctx.waEntregaGuardar_({ recipient_id: SOC_A, id: 'wamid.c', status: 'sent', timestamp: String(Math.floor(Date.now() / 1000)) });
ok(C.ctx.waEntrega_(SOC_A) && C.ctx.waEntrega_(SOC_A).estado === 'sent', 'el estado de Meta se guarda aunque la cola de huéspedes tenga el candado del script (antes se perdía)');
r = C.ctx.waEstadoResumen_([], null, []);
ok(!r.enviado && /NO se le ha enviado nada/.test(r.resumen), '«¿le mandamos el mensaje?» sin nada en la hoja: dice que no salió nada');
r = C.ctx.waEstadoResumen_([{ ts: '2026-11-13T19:30:00Z', propio: true, de: 'Alma', texto: '[plantilla para socios] · pendiente: Hola' }], { estado: 'delivered', ts: 1 }, [{ texto: 'Hola' }]);
ok(r.enviado && /ENTREGADO/.test(r.estado_meta) && /AÚN NO RESPONDE/.test(r.esperando), 'plantilla entregada y sin respuesta: lo dice tal cual');
r = C.ctx.waEstadoResumen_([{ ts: '2026-11-13T19:30:00Z', propio: true, de: 'Alma', texto: 'Hola' }, { ts: '2026-11-13T19:31:00Z', propio: false, de: 'Sistema', texto: '⚠ No se entregó: el número no tiene WhatsApp' }], null, []);
ok(/NO ENTREGADO: el número no tiene WhatsApp/.test(r.estado_meta), 'un fallo anotado manda sobre «sin confirmación»');
ok(!/Estados Unidos/.test(C.ctx.waEntregaMotivo_([{ code: 131049 }], SOC_A)) && /Estados Unidos/.test(C.ctx.waEntregaMotivo_([{ code: 131049 }], USA)), '131049 a un +502 no habla de Estados Unidos (a un +1 sí)');

/* ── 4 · Si escribe algo de verdad, Alma le contesta ── */
['Hola', 'Sí, dime', 'ok', 'Buenas tardes', 'Hola Alma, dime'].forEach(t => ok(C.ctx.esAcuseCorto_(t), '«' + t + '» es solo un acuse'));
['Si, me queda bien a las 11:30am', '¿Cuándo empiezan con las fotos?', '[audio]', 'Solo quiero que me puedan contestar los correos'].forEach(t => ok(!C.ctx.esAcuseCorto_(t), '«' + t + '» pide respuesta'));
C = caja({ props: { WA_PEND: JSON.stringify({ [String(SOC_A).slice(-8)]: [{ texto: 'Mensaje guardado', ts: 1, nombre: 'Socio A' }] }) } });
C.ctx.waPendienteSoltar_(SOC_A, { texto: 'Gracias, ¿y cuándo empiezan las fotos?', ts: '2026-11-13T19:29:50.000Z' });
ok(C.posts.length === 1 && C.wa.length === 1 && C.wa[0][0] < '2026-11-13T19:29:50.000Z', 'escribió algo de verdad: el mensaje guardado sale y queda antes del suyo (su mensaje sigue pendiente de respuesta)');
C = caja({ props: { WA_PEND: JSON.stringify({ [String(SOC_A).slice(-8)]: [{ texto: 'Mensaje guardado', ts: 1, nombre: 'Socio A' }] }) } });
C.ctx.waPendienteSoltar_(SOC_A, { texto: 'Hola, dime', ts: '2026-11-13T19:29:50.000Z' });
ok(C.wa[0][0] > '2026-11-13T19:29:50.000Z', 'solo saludó: el mensaje guardado queda después (ya le respondió)');
ok(/Lo consulto con Juan/.test(C.ctx.encargoRespuestaFalta_('Si, me queda bien a las 11:30am', { respuesta: '', para_admin: 'confirmar la hora con el equipo' }, 'Socio A Prueba', 'Juan')), 'encargo: confirmó algo que decide Juan y el modelo no contestó → «Gracias, lo consulto con Juan y te confirmo»');
ok(/Con esto tengo/.test(C.ctx.encargoRespuestaFalta_('El código es 1234', { completo: true }, 'Socio A', 'Juan')) && C.ctx.encargoRespuestaFalta_('Hola', {}, 'Socio A', 'Juan') === '', 'encargo completo sin respuesta → gracias; un «Hola» no necesita respuesta');
ok(/Thank you/.test(C.ctx.encargoRespuestaFalta_('Thanks, the photos are fine for me', {}, 'Owner', 'Juan')), 'en inglés si escribe en inglés');
const ent = sacar(COD, 'waEntrante_');
ok(/esSocio = [^\n]*socioSeguro_\(wa\)/.test(ent), 'un socio con ficha o en Mi entra como socio (reglas de asociado), no como huésped');
ok(/waPendienteSoltar_\(wa, \{ texto: textoSoltar/.test(ent), 'waEntrante_ le pasa a waPendienteSoltar_ lo que escribió');
ok(/encargoRespuestaFalta_\(texto, out, quien, de\)/.test(sacar(AGE, 'encargoEntrante_')), 'encargoEntrante_ usa la respuesta mínima');
ok(/solicitante_tel\) === fin8_\(tel\)\) return/.test(sacar(AGE, 'encargoCerrarConLlamada_')), 'una llamada del mismo administrador no cierra su propio encargo («pídeme el número por WhatsApp»)');
const esc = (/case 'escribir_a_equipo': \{[\s\S]*?\n    \}/.exec(AGE) || [''])[0];
ok(esc.indexOf('destinoElegir_(') >= 0 && esc.indexOf('agPersona_(') < 0, 'escribir_a_equipo busca al socio del apartamento y por nombre con el resolvedor único (destino.js, #583; los dobles en .github/destino.js)');
ok(/waEntregaEsperar_\(p\.tel, rw\.id\)/.test(esc) && /waVigilarAnotar_/.test(esc) && /socioGuardarFicha_\(inp\.numero/.test(esc), 'escribir_a_equipo espera el estado de Meta, vigila si no llega y guarda el número de socio que da Juan');
ok(/socioDatosEnMensaje_\(adm, texto\)/.test(sacar(COD, 'opProcesar_')), 'opProcesar_ anota los números de socios del mensaje antes de que Alma conteste');
ok(/function contactosProcesar_\(\) \{\s*\/\*[^*]*\*\/\s*try \{ waVigilarRevisar_\(\)/.test(leer('contactos.js')), 'la vigilancia corre en la pasada de contactos (sin tocar el ritmo de procesarCola)');

process.exit(fallo);
