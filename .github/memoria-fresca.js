/* Memoria fresca (apps-script/memoriafresca.js; Juan, 16-nov-2026: «Alma debería recordar las últimas 5 llamadas… si le
   hablo de un huésped del que le hablé hace muy poco, debería entender que hablamos de ese Amílcar, no de otro»), con
   dobles: sin internet ni Google. Revisa:
   1. se guardan solo las últimas 5 llamadas del principal (de cualquier canal y de Claudio, con lo que hizo); el bloque va
      de la más reciente a la más vieja, no pasa de ~1 200 caracteres, el tema va «sin verificar» y sin nombres dictados, y
      las personas de cada llamada son las verificadas por una herramienta en su ventana; otro administrador no tiene;
   2. dos «Amílcar»: el que hablaron hace 10 min se elige y su fuente lo dice; sin memoria, se pregunta como siempre; los
      dos igual de recientes, se pregunta; sin nada en las llamadas, una conversación reciente de la bandeja desempata;
   3. dos reservas de «Amílcar»: la de la llamada reciente se elige (agElegirReserva_) y la respuesta dice por qué;
   4. está conectado: la ficha de la voz (vozInicio_), el chat (opAgente_), Claudio, el cierre de cada llamada
      (vozPostCall_) y el Modo calle.
   node .github/memoria-fresca.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const sacarVar = (src, nombre) => { const m = new RegExp('\\nvar ' + nombre + ' = [^\\n]*').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const VOZ = leer('voz.js'), AGE = leer('agente.js'), COD = leer('Código.js'), CLA = leer('claudio.js');

/* Nombres y números de prueba: no son reales. */
const JUAN = { email: 'juan@prueba', nombre: 'Juan Prueba', principal: true, tels: ['50255550100'] };
const ANA = { email: 'ana@prueba', nombre: 'Ana', principal: false, tels: ['50255550101'] };
const AMI1 = '50255550301', AMI2 = '50255550302', MIN = 60000;

function caja(o) {
  o = o || {};
  const mem = {}, cache = {};
  const ctx = {
    console: { log() {}, warn() {}, error(e) { if (o.verErrores) console.log('  (error) ' + e); } }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date, Set,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null, getSheets: () => [] }) },
    CFG: { TZ: 'America/Guatemala' }, ahora_: () => new Date(),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8), normTel_: t => String(t || '').replace(/\D/g, ''),
    adminsOp_: () => [JUAN, ANA], esAdminPrincipal_: a => !!(a && a.principal),
    contactosTodos_: () => [{ tel: AMI1, nombre: 'Amílcar Pérez', tipo: 'proveedor', rol: 'Proveedor', propiedades: '' }, { tel: AMI2, nombre: 'Amílcar Soto', tipo: 'proveedor', rol: 'Técnico', propiedades: '' }],
    contactoFicha_: () => null, CONTACTO_TIPOS_: {}, epiSnap_: () => ({ vendors: [] }), vendNombre_: v => '', contactoRolEpi_: c => '',
    escalamiento_: () => [], recepcionNumeros_: () => ({}), accesosPorRol_: () => ({ socios: [] }), contactoRecientes_: () => [], bqMejor_: () => '',
    socioMiSetup_: () => [], socioMiUsuarios_: () => ({}), SOCIO_MI_PALABRAS_: /\b(socio|socia|socios|socias|due[ñn]o|propietari[oa])\b/i, socioClaveProp_: p => String(p || '').toLowerCase().split(/\W+/).filter(Boolean),
    agElegirReserva_: () => ({ error: 'sin reserva' }),
    temaFilas_: () => o.temas || [], temaAbiertos_: () => [], TEMA_ACTIVO_H_: 6, temaCorto_: t => t.titulo, temaTitulo_: x => String(x).split(/\s+/).slice(0, 6).join(' '),
    hubInbox_: () => o.bandeja || [], actividadInbox_: x => new Date(x.ultimo_ts).getTime() || 0,
    vozEsConferencia_: () => false
  };
  vm.createContext(ctx);
  vm.runInContext([sacarVar(VOZ, 'CTX_ROL_NOMBRE_'), sacar(VOZ, 'ctxSinNombres_'), sacar(CLA, 'claudioHace_'), sacar(CLA, 'claudioHizo_')].join('\n'), ctx, { filename: 'extractos' });
  ['memoriafresca.js', 'destino.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  return { ctx, mem, cache, R: c => vm.runInContext(c, ctx) };
}
const ahora = Date.now();
const mencion = (C, n, tel, hace, extra) => { C.ctx.MEN_ = [Object.assign({ nombre: n, rol: 'técnico', tel: tel, fuente: 'ficha de contacto' }, extra || {})]; C.R('mfAnotar_(JUAN_, MEN_)');
  const k = 'MF_juan@prueba', o = JSON.parse(C.mem[k]); o.me[o.me.length - 1].ts = ahora - hace; C.mem[k] = JSON.stringify(o); };

/* ── 1 · Las últimas 5 llamadas y el bloque ── */
let C = caja(); C.ctx.JUAN_ = JUAN; C.ctx.ANA_ = ANA;
for (let i = 0; i < 7; i++) {
  C.ctx.D_ = { conversation_id: 'conv_' + i, analysis: { call_summary_title: 'Llamada número ' + i + ' con la huésped Jimena sobre la limpieza del apartamento y otras cosas largas que se dijeron' } };
  C.R('mfLlamadaDeVoz_(JUAN_, D_, ' + (ahora - (8 - i) * 20 * MIN) + ', 120, "WhatsApp")');
}
mencion(C, 'Amílcar Soto', AMI2, 60 * MIN - 30000);   // salió en la llamada conv_5 (hace ~1 h)
C.ctx.D_ = { conversation_id: 'conv_5', analysis: {} }; C.R('mfLlamadaDeVoz_(JUAN_, D_, 0, 1, "WhatsApp")');   // repetida: no entra dos veces
let st = JSON.parse(C.mem['MF_juan@prueba']);
ok(st.ll.length === 5 && st.ll.map(x => x.id).join() === 'conv_2,conv_3,conv_4,conv_5,conv_6', 'se guardan solo las últimas 5 llamadas, sin repetir una');
let b = C.R('mfBloque_(JUAN_)');
ok(b.length <= 1250 && /^\n\nÚLTIMAS LLAMADAS CON ALMA/.test(b) && b.indexOf('número 6') < b.indexOf('número 2'), 'el bloque es corto (' + b.length + ' caracteres) y va de la más reciente a la más vieja');
ok(/\(sin verificar\)/.test(b) && !/Jimena/.test(b), 'el tema va «sin verificar» y sin el nombre dictado («la huésped Jimena» no se repite)');
ok(/hace 58 min · WhatsApp · [^\n]*personas: Amílcar Soto \(técnico\)/.test(b), 'las personas verificadas salen en la llamada donde se hablaron');
ok(C.R('mfBloque_(ANA_)') === '' && !C.mem['MF_ana@prueba'], 'otro administrador: sin memoria fresca (es del principal)');
/* Claudio: lo que hizo, según sus herramientas */
C.cache['claudiohizo_conv_c1'] = JSON.stringify({ email: 'juan@prueba', pedidos: [{ ok: true, titulo: 'botón de pagos naranja' }], unidos: 1 });
C.R('mfClaudio_(JUAN_, "conv_c1", ' + (ahora - 2 * MIN) + ', 60, "Cambio del botón")');
b = C.R('mfBloque_(JUAN_)');
ok(/^· hace 1 min · Claudio · «Cambio del botón» \(sin verificar\) · pedido creado: botón de pagos naranja; unió un cambio/m.test(b), 'la llamada con Claudio entra con lo que hizo (pedido creado, unido)');
/* Modo calle: turnos seguidos son una sola llamada */
C.R('mfCalle_(JUAN_, "revisa la ruta de mañana")'); C.R('mfCalle_(JUAN_, "y la limpieza de 1104")');
st = JSON.parse(C.mem['MF_juan@prueba']);
ok(st.ll.filter(x => x.c === 'calle').length === 1 && /ruta de mañana · y la limpieza/.test(st.ll[st.ll.length - 1].tm), 'Modo calle: los pedidos seguidos cuentan como una llamada');

/* ── 2 · Dos «Amílcar» ── */
C = caja(); C.ctx.JUAN_ = JUAN;
let r = C.R("destinoResolver_({ persona: 'Amílcar', adm: JUAN_ })");
ok(r.candidatos.length === 2 && !r.unico, 'sin memoria: dos «Amílcar», no elige (pregunta como siempre)');
mencion(C, 'Amílcar Soto', AMI2, 10 * MIN);
r = C.R("destinoResolver_({ persona: 'Amílcar', adm: JUAN_ })");
ok(r.unico && r.candidatos[0].tel === AMI2 && /lo hablaron hace 10 min/.test(r.candidatos[0].fuente) && r.reciente, 'dos «Amílcar», uno hablado hace 10 min: se elige ese y la fuente lo dice («' + (r.candidatos[0] || {}).fuente + '»)');
C.ctx.CTXD_ = { hechas: [], adm: JUAN };
const e = C.R("destinoElegir_({ persona: 'Amílcar' }, CTXD_, '')");
ok(e.destinos && e.destinos[0].tel === AMI2 && /lo hablaron hace 10 min/.test(C.ctx.CTXD_.destinos[0]), 'la herramienta de envío también (adm en ctx) y lo que dice Alma trae la fuente: «' + (C.ctx.CTXD_.destinos || [])[0] + '»');
C = caja(); C.ctx.JUAN_ = JUAN; mencion(C, 'Amílcar Soto', AMI2, 10 * MIN); mencion(C, 'Amílcar Pérez', AMI1, 10 * MIN + 20000);
r = C.R("destinoResolver_({ persona: 'Amílcar', adm: JUAN_ })");
ok(!r.unico && r.candidatos.length === 2, 'los dos hablados casi al mismo tiempo: no adivina, pregunta');
C = caja({ bandeja: [{ conv_id: 'wa:' + AMI1, huesped: 'Amílcar Pérez', propiedad: '', codigo: '', ultimo_ts: new Date(ahora - 3 * 3600000).toISOString() }] }); C.ctx.JUAN_ = JUAN;
r = C.R("destinoResolver_({ persona: 'Amílcar', adm: JUAN_ })");
ok(r.unico && r.candidatos[0].tel === AMI1 && /bandeja/.test(r.candidatos[0].fuente), 'sin nada en las llamadas: la conversación reciente de la bandeja desempata («' + (r.candidatos[0] || {}).fuente + '»)');
mencion(C, 'Amílcar Soto', AMI2, 20 * 3600000);
r = C.R("destinoResolver_({ persona: 'Amílcar', adm: JUAN_ })");
ok(r.unico && r.candidatos[0].tel === AMI2, 'lo hablado con Alma (nivel 1) gana sobre la bandeja (nivel 2), aunque sea de antes');

/* ── 3 · Dos reservas de «Amílcar» ── */
C = caja(); C.ctx.JUAN_ = JUAN;
const RES = [{ code: 'HMAAA111', guest_first_name: 'Amílcar', guest_last_name: 'Pérez', property_name: 'Z13 - Torre Prueba - 633', checkin_date: '2026-11-20', checkout_date: '2026-11-25', status: 'accepted' },
  { code: 'HMBBB222', guest_first_name: 'Amílcar', guest_last_name: 'Pérez', property_name: 'Z10 - Calle Prueba - 301', checkin_date: '2026-11-21', checkout_date: '2026-11-24', status: 'accepted' }];
Object.assign(C.ctx, { hubInbox_: () => [], agBuscarReservas_: () => RES.map(x => ({ item: x, coincidencia: 'exacta' })), s_: x => (x == null ? '' : String(x)), fecha_: x => String(x).slice(0, 10),
  consultaElegir_: () => null, reservaConv_: c => ({ conv_id: 'res:' + c }), sumarDias_: (d, n) => d });
C.R(sacar(AGE, 'agElegirReserva_'));
let el = C.R("agElegirReserva_('Amílcar', '2026-11-16', JUAN_)");
ok(el.error && el.opciones && el.opciones.length === 2, 'sin memoria: dos reservas de «Amílcar», pregunta cuál');
mencion(C, 'Amílcar Pérez', '', 10 * MIN, { rol: 'huésped', propiedad: 'Z10 - Calle Prueba - 301', codigo: 'HMBBB222', fuente: 'reserva HMBBB222' });
el = C.R("agElegirReserva_('Amílcar', '2026-11-16', JUAN_)");
ok(!el.error && el.codigo === 'HMBBB222' && /hace 10 min/.test(el.elegida_por) && /Dile a Juan/.test(el.elegida_por), 'la reserva del Amílcar de la llamada de hace 10 min se elige y la respuesta dice por qué');
ok(/porRec && inp\.confirmado !== true[^\n]*inp\.borrador = true/.test(AGE), 'un huésped elegido por lo reciente no recibe nada sin que Juan vea el borrador');

/* ── 4 · Conectado ── */
ok(/ficha \+= mfBloque_\(admI\)/.test(sacar(VOZ, 'vozInicio_')), 'la ficha de toda llamada del principal (app, WhatsApp, teléfono, conferencia) trae la memoria fresca');
const opa = sacar(AGE, 'opAgente_');
ok(/turno \+= mfBloque_\(adm\)/.test(opa) && /mfCalle_\(adm, textoPedido\)/.test(opa) && /ctx = \{ adm:/.test(opa) && /MF_ADM_ = /.test(opa), 'el chat (Hub, WhatsApp, app, calle) la trae, el Modo calle se anota y las herramientas saben quién pide');
const pc = sacar(VOZ, 'vozPostCall_');
ok(/mfLlamadaDeVoz_\(admC/.test(pc) && /mfClaudio_\(admCl/.test(pc), 'se actualiza al cerrar cada llamada de Alma y de Claudio');
ok(/ficha \+= mfBloque_\(adm\)/.test(sacar(CLA, 'claudioFicha_')) && /claudioFicha_\(adm,/.test(sacar(CLA, 'claudioWebInicio_')), 'Claudio también la tiene al empezar (su ficha, la misma en ElevenLabs y en Claudio local)');
ok(/mfAnotar_\(ctx\.adm, cs\)/.test(leer('destino.js')) && /mfDesempate_\(o\.adm \|\| \(o\.ctx && o\.ctx\.adm\)/.test(leer('destino.js')), 'destino.js anota a quién eligió y desempata por lo reciente');

if (!fallo) console.log('Todo bien: Alma recuerda las últimas 5 llamadas y desempata por lo reciente.');
process.exit(fallo);
