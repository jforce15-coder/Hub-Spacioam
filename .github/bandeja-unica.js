/* Prueba de la Bandeja unificada (#888; apps-script/bandejaunica.js, redesmeta.js y alma/bandeja.html) con dobles: sin
   Google ni Meta de verdad. Juan, 19-nov-2026: «juntar WhatsApp, Instagram, etcétera, todo debidamente clasificado y
   ordenado para que tengamos un solo hub donde nos comuniquemos con el mundo». Revisa que:
   1. Ficha de la persona: las conversaciones se juntan solas por teléfono, código o hilo de Hospitable; «Unir» y «Separar»
      a mano mandan (y un «unir» viejo no revive lo que se separó después);
   2. carpeta, estado, prioridad y carril: nuevo · esperando · resuelto · pospuesto; urgente → te toca → normal → baja; lo
      personal pendiente siempre entre los 3 primeros; la carpeta movida a mano manda;
   3. solo con sesión de alguien del equipo; lo personal y los correos, solo el principal;
   4. Instagram y Messenger: el webhook guarda, no duplica, apagado sin llave (no va a la cola de Alma), el «echo» del
      equipo cierra la decisión; la salida respeta la ventana (24 h normal, hasta 7 días solo una persona con HUMAN_AGENT,
      Alma nunca) y parte lo largo; canjes y descuentos no los decide Alma;
   5. el Hub los conecta: doPost, hubApi_, hiloConv_ sin Hospitable para ig:/fb:, llaves en Ajustes, cupo y la pantalla.
   node .github/bandeja-unica.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script'), RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const BU = leer('bandejaunica.js'), RM = leer('redesmeta.js'), COD = leer('Código.js');

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), hojas = {}, cache = {}, llamadas = [], vmap = {}, cola = [], inbox = [], dec = [];
  const hoja = (nombre, cab) => hojas[nombre] || (hojas[nombre] = { filas: cab ? [cab] : [], appendRow(r) { this.filas.push(r); }, getLastRow() { return this.filas.length; },
    getRange(f, c, n, m) { const self = this; return { getValues: () => self.filas.slice(f - 1, f - 1 + (n || 1)).map(r => r.slice(c - 1, c - 1 + (m || 1))),
      createTextFinder: (t) => ({ matchEntireCell: () => ({ findNext: () => { const i = self.filas.slice(f - 1, f - 1 + n).findIndex(r => String(r[c - 1]) === t); return i < 0 ? null : { getRow: () => f + i }; },
        findAll: () => self.filas.slice(f - 1, f - 1 + n).map((r, i) => String(r[c - 1]) === t ? { getRow: () => f + i } : null).filter(Boolean) }) }) }; } });
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Object, String, Number, Math, Date, RegExp, Array, isNaN,
    CFG: { TZ: 'America/Guatemala', TAB_COLA: 'ALMA_COLA', TAB_LOG: 'ALMA_LOG' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) },
    ssAlma_: () => ({ getSheetByName: n => hojas[n] || null }), hojaCrear_: (n, cab) => hoja(n, cab), hoja_: n => hoja(n),
    s_: v => (v === null || v === undefined || typeof v === 'object') ? '' : String(v), celdaTexto_: x => String(x), ok_: m => ({ ok: true, msg: m }),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8), normTel_: x => String(x || '').replace(/\D/g, ''),
    vGet_: k => vmap[k] || null, vSet_: (k, v) => { vmap[k] = v; },
    inboxUpsert_: (id, x) => inbox.push([id, x]), pushNuevo_: () => {}, programarPronto_: () => {}, acortarEnTexto_: t => t,
    decisionAlResponder_: (id, q) => dec.push([id, q]),
    uf_: (url, op) => { llamadas.push({ url, op }); const r = o.uf ? o.uf(url, op) : { code: 200, body: { message_id: 'm' + llamadas.length } }; return { getResponseCode: () => r.code, getContentText: () => JSON.stringify(r.body || {}) }; },
    adminsOp_: () => o.admins || [], esAdminPrincipal_: a => !!(a && a.principal), decQuien_: s => (s && s.email) || 'Equipo',
    bandejaEsferaMapas_: () => o.mapas || { conv: {}, pers: {} }, bandejaEsferaDe_: (m, id) => (m.conv[id] || 'proposito')
  };
  vm.createContext(ctx);
  vm.runInContext(leer('salidahuesped.js') + '\n' + RM + '\n' + BU, ctx);
  Object.assign(ctx, { props, hojas, cache, llamadas, vmap, inbox, dec });
  return ctx;
}

/* ── 1 · Ficha de la persona ── */
{
  const c = caja();
  const filas = [
    { conv_id: 'res-1', codigo: 'HMFICT1', wa: '50255550001', hosp_conv: 'h1', huesped: 'Sofía Ficticia' },
    { conv_id: 'wa:50255550001', huesped: 'Sofi' },
    { conv_id: 'ig:900', huesped: 'Sofía (@sofi.ficticia)' },
    { conv_id: 'inq:h1', hosp_conv: 'h1', huesped: 'Sofía' },
    { conv_id: 'wa:50255559999', huesped: 'Otro' }
  ];
  const grupos = (m) => c.bandejaAgrupar_(filas, m).map(g => g.map(x => x.conv_id).sort().join('+')).sort();
  const auto = grupos({});
  ok(auto.indexOf('inq:h1+res-1+wa:50255550001') >= 0, '1 · reserva, su WhatsApp (mismo teléfono) y su consulta (mismo hilo de Hospitable) son una sola persona');
  ok(auto.indexOf('ig:900') >= 0 && auto.indexOf('wa:50255559999') >= 0, '1 · Instagram y otro número quedan aparte mientras nadie los une');
  const m1 = c.personasMarcasDe_([['ig:900', 'unir', 'res-1', 'Juan', '2026-11-19T10:00:00Z']]);
  ok(grupos(m1).some(g => g.indexOf('ig:900') >= 0 && g.indexOf('res-1') >= 0), '1 · «Unir otra conversación» junta el Instagram con la reserva');
  const m2 = c.personasMarcasDe_([['ig:900', 'unir', 'res-1', 'Juan', '2026-11-19T10:00:00Z'], ['wa:50255550001', 'separar', '', 'Juan', '2026-11-19T11:00:00Z']]);
  ok(grupos(m2).indexOf('wa:50255550001') >= 0, '1 · «Separar» saca el WhatsApp aunque comparta teléfono con la reserva');
  const m3 = c.personasMarcasDe_([['ig:900', 'unir', 'res-1', 'Juan', '2026-11-19T10:00:00Z'], ['res-1', 'separar', '', 'Juan', '2026-11-19T11:00:00Z']]);
  ok(grupos(m3).indexOf('ig:900') >= 0, '1 · un «unir» viejo no revive a quien se separó después');
  const m4 = c.personasMarcasDe_([['x', 'carpeta', 'socio', 'J', '2026-11-19T10:00:00Z'], ['x', 'carpeta', 'equipo', 'J', '2026-11-19T12:00:00Z']]);
  ok(m4.x.carpeta.valor === 'equipo', '1 · la última marca de cada conversación y campo manda');
}

/* ── 2 · Estado, prioridad, carril, orden ── */
{
  const c = caja();
  const ahora = Date.parse('2026-11-19T18:00:00Z'), hoy = '2026-11-19', hace = (min) => new Date(ahora - min * 60000).toISOString();
  const P = (g, x) => c.bandejaPersonaDe_(g, Object.assign({ ahora, hoy, marcas: {}, resueltas: {}, alma: {}, decisiones: {}, auto: {} }, x || {}));
  const g1 = [{ conv_id: 'wa:50255550002', ultimo_de: 'guest', ultimo_ts: hace(5), ultimo_guest_ts: hace(5), ultimo_texto: '¿Tienen parqueo?', huesped: 'Ana' }];
  let p = P(g1);
  ok(p.estado === 'nuevo' && p.prioridad === 3 && p.carril === 'alma', '2 · recién llegó (5 min): nuevo, normal, «Alma lo lleva»');
  p = P([Object.assign({}, g1[0], { ultimo_ts: hace(40), ultimo_guest_ts: hace(40) })]);
  ok(p.prioridad === 2 && p.carril === 'toca', '2 · 40 min sin respuesta: te toca');
  p = P(g1, { decisiones: { 'wa:50255550002': { id: 'd1', origen: 'rojo', motivo: 'escalado', opciones: [] } } });
  ok(p.prioridad === 1 && p.carril === 'toca' && p.decision && p.decision.id === 'd1', '2 · decisión del equipo de un rojo: urgente y te toca, con su A · B · C');
  p = P(g1, { resueltas: { 'wa:50255550002': ahora } });
  ok(p.estado === 'resuelto' && p.carril === 'listo', '2 · marcada resuelta después del mensaje: resuelto y «Listo hoy»');
  const g2 = [{ conv_id: 'res-2', codigo: 'HMF2', canal: 'airbnb', ultimo_de: 'host', ultimo_ts: hace(30), ultimo_host_ts: hace(30), ultimo_guest_ts: hace(40), huesped: 'Tom', tipo: 'reserva' }];
  p = P(g2, { alma: { 'res-2': ahora - 30 * 60000 + 2000 } });
  ok(p.estado === 'esperando' && p.carril === 'alma' && p.por_alma && p.carpeta === 'huesped', '2 · respondió Alma: esperando, «Alma lo lleva», carpeta Huéspedes');
  p = P(g2);
  ok(p.carril === 'espera', '2 · respondió el equipo: «Esperando a otros»');
  p = P(g2, { marcas: { 'res-2': { carpeta: { valor: 'socio', ts: 1 } } } });
  ok(p.carpeta === 'socio' && p.carpeta_mano && p.carpeta_auto === 'huesped', '2 · la carpeta movida a mano manda (y se recuerda la de Alma)');
  p = P(g1, { marcas: { 'wa:50255550002': { posponer: { valor: new Date(ahora + 3600000).toISOString(), ts: 1 } } } });
  ok(p.estado === 'pospuesto' && p.carril === 'espera', '2 · pospuesta: vuelve sola a su hora');
  p = P([{ conv_id: 'ig:77', ultimo_de: 'guest', ultimo_ts: hace(2), ultimo_guest_ts: hace(2), huesped: 'Dani', tipo: 'redes' }]);
  ok(p.carpeta === 'prospecto' && p.canales[0] === 'instagram', '2 · un DM de Instagram cae en Prospectos con su logo');
  const pers = Object.assign(P([{ conv_id: 'wa:50255550003', ultimo_de: 'guest', ultimo_ts: hace(300), ultimo_guest_ts: hace(300), huesped: 'Mamá', esfera: 'relaciones' }]), {});
  ok(pers.personal && pers.prioridad === 2, '2 · lo personal pendiente: te toca');
  const urg = [1, 2, 3, 4, 5].map(i => Object.assign({}, pers, { id: 'u' + i, personal: false, prioridad: 1, ultimo_ts: hace(i) }));
  const orden = c.bandejaOrdenar_(urg.concat([pers]));
  ok(orden.slice(0, 3).indexOf(pers) >= 0, '2 · lo personal pendiente queda entre los 3 primeros aunque haya 5 urgentes');
  ok(c.bandejaManana_('2026-11-30') === '2026-12-01' && c.bandejaHoyGt_(Date.parse('2026-11-20T05:00:00Z'), '2026-11-19'), '2 · fechas de Guatemala (mañana y hoy a medianoche UTC)');
}

/* ── 3 · Quién ve qué ── */
{
  const admins = [{ email: 'juan@x', nombre: 'Juan', principal: true }, { email: 'ana@x', nombre: 'Ana', principal: false }];
  const c = caja({ admins, mapas: { conv: { 'wa:50255550003': 'relaciones' }, pers: {} } });
  ok(c.bandejaApi_(null, { op: 'lista' }).ok === false, '3 · sin sesión no hay bandeja');
  ok(c.bandejaApi_({ email: 'otro@x' }, { op: 'lista' }).ok === false, '3 · alguien que no es del equipo, tampoco');
  const ana = c.bandejaQuien_({ email: 'ana@x' }), juan = c.bandejaQuien_({ email: 'juan@x' });
  ok(!c.bandejaPuede_(ana, 'wa:50255550003') && c.bandejaPuede_(juan, 'wa:50255550003'), '3 · lo personal solo lo toca el principal');
  ok(!c.bandejaPuede_(ana, 'mail:a@b.com') && c.bandejaPuede_(juan, 'mail:a@b.com'), '3 · los correos, solo el principal');
  ok(c.bandejaPuede_(ana, 'ig:1') && !c.bandejaPuede_(juan, 'op:juan@x'), '3 · el equipo ve Instagram; el chat con Alma nunca entra a la bandeja');
  ok(/BANDEJA_CARPETAS_\.indexOf\(String\(b\.carpeta\)\) < 0/.test(BU), '3 · solo las 6 carpetas del glosario');
}

/* ── 4 · Instagram y Messenger ── */
const evIG = (mid, txt, extra) => ({ object: 'instagram', entry: [{ id: 'CUENTA', messaging: [Object.assign({ sender: { id: '555' }, recipient: { id: 'CUENTA' }, timestamp: Date.now(), message: { mid: mid, text: txt } }, extra || {})] }] });
{
  const c = caja();
  c.redesWebhook_(evIG('m1', 'Hola, ¿precio para 4 del 20 al 23?'));
  const R = c.hojas.ALMA_REDES;
  ok(R && R.filas.length === 2 && R.filas[1][7] === 'ig:555' && R.filas[1][4] === 'in', '4 · el DM se guarda en ALMA_REDES como ig:<id>');
  ok(c.inbox.some(x => x[0] === 'ig:555' && x[1].canal === 'instagram' && x[1].ultimo_de === 'guest'), '4 · y entra a la bandeja con su canal');
  ok(!c.hojas.ALMA_COLA, '4 · sin llave (apagado): Alma no lo contesta (no va a la cola)');
  ok(!c.llamadas.length, '4 · y sin llave no se pide el perfil a Meta');
  c.redesWebhook_(evIG('m1', 'Hola, ¿precio para 4 del 20 al 23?'));
  ok(R.filas.length === 2, '4 · Meta reintenta: el mismo mid no se guarda dos veces');
  c.redesWebhook_({ object: 'instagram', entry: [{ id: 'CUENTA', messaging: [{ sender: { id: 'CUENTA' }, recipient: { id: '555' }, timestamp: Date.now(), message: { mid: 'e1', text: 'Te respondo desde la app', is_echo: true } }] }] });
  ok(R.filas.length === 3 && R.filas[2][4] === 'out' && c.dec.some(x => x[0] === 'ig:555'), '4 · lo que el equipo responde desde la app de Instagram queda como nuestro y cierra la decisión');
}
{
  const c = caja({ props: { META_PAGE_TOKEN: 'tok-pagina-ficticio' }, uf: (url) => /fields=/.test(url) ? { code: 200, body: { first_name: 'Ana', last_name: 'Ficticia', profile_pic: 'https://x/p.jpg' } } : { code: 200, body: { message_id: 'mm' } } });
  c.redesWebhook_({ object: 'page', entry: [{ id: 'PAG', messaging: [{ sender: { id: '777' }, recipient: { id: 'PAG' }, timestamp: Date.now(), message: { mid: 'f1', text: '¿Cómo llego?' } }] }] });
  ok(c.hojas.ALMA_COLA && c.hojas.ALMA_COLA.filas.some(r => r[2] === 'fb:777'), '4 · con la llave de la Página, Messenger va a la cola de Alma');
  ok(c.inbox.some(x => x[0] === 'fb:777' && x[1].huesped === 'Ana Ficticia' && x[1].foto === 'https://x/p.jpg'), '4 · nombre y foto de perfil de Meta');
  const antes = c.llamadas.length;
  c.redesWebhook_({ object: 'page', entry: [{ id: 'PAG', messaging: [{ sender: { id: '777' }, recipient: { id: 'PAG' }, timestamp: Date.now(), message: { mid: 'f2', text: 'Gracias' } }] }] });
  ok(c.llamadas.length === antes, '4 · el perfil se pide una sola vez por persona');
  /* la ventana */
  const R = c.hojas.ALMA_REDES, fila = R.filas[1];
  let env = c.redesEnviar_('fb:777', 'Con gusto', 'alma'), ult = c.llamadas[c.llamadas.length - 1];
  ok(env.ok && JSON.parse(ult.op.payload).messaging_type === 'RESPONSE' && /\/me\/messages$/.test(ult.url), '4 · dentro de 24 h sale normal (RESPONSE)');
  R.filas.filter(r => r[4] === 'in').forEach(r => { r[0] = new Date(Date.now() - 3 * 86400000).toISOString(); });
  env = c.redesEnviar_('fb:777', 'Hola de nuevo', 'alma');
  ok(!env.ok, '4 · después de 24 h Alma no responde sola');
  env = c.redesEnviar_('fb:777', 'Hola, soy Ana del equipo', 'Ana'); ult = c.llamadas[c.llamadas.length - 1];
  ok(env.ok && env.humano && JSON.parse(ult.op.payload).tag === 'HUMAN_AGENT', '4 · hasta 7 días, una persona del equipo con la etiqueta HUMAN_AGENT');
  R.filas.filter(r => r[4] === 'in').forEach(r => { r[0] = new Date(Date.now() - 8 * 86400000).toISOString(); });
  ok(!c.redesEnviar_('fb:777', 'Hola', 'Ana').ok, '4 · más de 7 días: Meta ya no deja, y se dice por qué');
  ok(!c.redesEnviar_('fb:999', 'Hola', 'Ana').ok, '4 · Meta no deja escribir primero');
  const partes = c.redesPartir_('palabra '.repeat(300), 900);
  ok(partes.length > 1 && partes.every(x => x.length <= 900) && partes.join(' ').split(/\s+/).length === 300, '4 · lo largo se parte sin cortar palabras');
  ok(fila[3] === 'Ana Ficticia', '4 · la fila guarda el nombre');
}
{
  const c = caja();
  ok(!c.redesEnviar_('ig:555', 'Hola', 'Ana').ok, '4 · sin llave no sale nada (apagado)');
  const D = (t) => c.redesDelicado_({ resId: 'ig:1', texto: t });
  ok(D('Hola! Hago contenido de viajes. ¿Les interesa un canje?') && D('¿Me hacen un descuento?') && D('Quiero una colaboración'), '4 · canje, descuento o colaboración: decide el equipo con A · B · C');
  ok(!D('¿Cuánto sale para 4 personas del 20 al 23 de diciembre?') && !D('¿Cómo llego al edificio?'), '4 · precio, disponibilidad y cómo llegar los contesta Alma');
  ok(!c.redesDelicado_({ resId: 'wa:1', texto: 'canje' }), '4 · la regla es solo para Instagram y Messenger');
  ok(c.redesTexto_({ text: '', attachments: [{ type: 'story_mention' }] }) === '[te mencionó en su historia]', '4 · lo que no es texto se dice con palabras');
}

/* ── 5 · El Hub los conecta ── */
ok(/body\.object === 'instagram' \|\| body\.object === 'page'\) \{[^\n]*redesWebhook_\(body\)/.test(COD), '5 · doPost manda Instagram y Messenger a redesWebhook_ (el mismo /exec del WhatsApp)');
ok(/case 'bandeja': return json_\(bandejaApi_\(ses, body\)\)/.test(COD), '5 · el Hub atiende la acción «bandeja» con la sesión');
ok((COD.match(/if \(!\/\^\(wa\|llamada\|ig\|fb\|mail\):\/\.test\(id\)\) \{/g) || []).length === 2 && /if \(\/\^\(ig\|fb\):\/\.test\(id\)\) \{ try \{ hilo = hilo\.concat\(redesHilo_\(id\)\)/.test(COD), '5 · hiloConv_ nunca pide a Hospitable un ig:/fb: y suma su hilo');
ok(/if \(\/\^\(ig\|fb\):\/\.test\(String\(resId\)\)\) return \{ propiedad: 'Sin reserva', tipo: 'redes'/.test(COD), '5 · preContexto_ tampoco');
ok(/if \(\/\^\(ig\|fb\):\/\.test\(String\(d\.resId\)\)\) \{ const rr = redesEnviar_\(d\.resId, texto, autor \|\| 'alma'\)/.test(COD), '5 · Alma responde por la misma red (enviarCanal_)');
ok(/if \(\/\^\(ig\|fb\):\/\.test\(String\(resId\)\) && redesDelicado_\(ctx\)\) \{[\s\S]{0,400}decisionCrear_\(/.test(COD), '5 · lo delicado por redes queda como decisión del equipo antes de clasificar');
const LL = leer('llaves.js');
ok(/nombre: 'META_PAGE_TOKEN'/.test(LL) && /nombre: 'IG_TOKEN'/.test(LL), '5 · las llaves de Meta se guardan en Ajustes → Llaves (nunca en el repo)');
ok(/huespedes: '[^']*\bbandeja\b/.test(leer('cupo.js').replace(/' \+\s*'/g, ' ')), '5 · la bandeja cuenta como Huéspedes en el cupo (nunca se pausa)');
ok(/if \(f\.origen === 'bandeja'\) return;/.test(leer('decisiones.js')), '5 · A · B · C pedido desde la Bandeja no manda avisos aparte');
const CLI = fs.readFileSync(path.join(RAIZ, 'js', 'alma-client.js'), 'utf8'), PAG = fs.readFileSync(path.join(RAIZ, 'alma', 'bandeja.html'), 'utf8');
ok(/bandeja: function \(b\) \{ return call\('bandeja', b \|\| \{\}\); \}/.test(CLI), '5 · alma-client.js tiene ALMA.bandeja');
ok(/ALMA\.bandeja\(b\)/.test(PAG) && /@media \(max-width: 700px\)/.test(PAG) && /Te toca decidir/.test(PAG) && /Alma lo lleva/.test(PAG) && /Responder por/.test(PAG), '5 · la pantalla: A en iPad y computadora, C en el iPhone, con «Responder por»');
const INI = fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8');
const esf = (src, k) => { const m = new RegExp('\\.esf\\.' + k + ' \\{ --c: (#[0-9A-F]{6}); --c2: (#[0-9A-F]{6})', 'i').exec(src); return m ? [m[1].toUpperCase(), m[2].toUpperCase()] : null; };
ok(['proposito', 'relaciones', 'finanzas', 'health', 'comunidad', 'espiritualidad'].every(k => { const a = esf(INI, k), m = new RegExp(k + ': \\["(#[0-9A-F]{6})", "(#[0-9A-F]{6})"\\]', 'i').exec(PAG); return a && m && a[0] === m[1].toUpperCase() && a[1] === m[2].toUpperCase(); }), '5 · la pantalla usa los MISMOS colores de las esferas del inicio');
ok(!/\b(inbox|buz[oó]n)\b/i.test(PAG.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')), '5 · la pantalla dice «Bandeja» (glosario), nunca inbox ni buzón');

process.exit(fallo);
