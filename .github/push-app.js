/* Notificación push de la app de Alma (Ticket #28, apps-script/pushapp.js) con dobles: sin hoja, sin OneSignal, sin Google.
   Juan, 16-nov-2026: «sí» a notificaciones push reales, para que lleguen con la app dormida y Siri las anuncie.
   1. Sin las llaves de OneSignal del iPhone, todo como hoy: ni una llamada, nada marcado, la app no recibe con qué registrarse.
   2. Con llaves: la app recibe app_id y su external_id (alma_ + la clave, nunca el correo) y dice si su push está listo.
   3. Con la app dormida y el push listo, el aviso sale por push al external_id, con el id del aviso (collapse_id, data y
      una llave de idempotencia), queda marcado y la app no lo vuelve a mostrar; con la app despierta, no sale.
   4. Ajustes por tipo: el tipo apagado no sale; sin vista previa, «Alma te dejó un mensaje» sin el texto ni los datos;
      el ajuste (Siri) viaja con el push.
   5. Si OneSignal no lo entrega, se quita la marca (la app lo muestra al despertar) y no se insiste hasta que la app diga
      que está lista; sin llave no falla nada.
   6. «Probar con Siri» desde la web sale por push aunque la app esté despierta, sin voz ni historial.
   7. Lo que salió por push no se repite por WhatsApp; el registro no guarda el texto; todo por uf_.
   node .github/push-app.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const JUAN = { email: 'juan@x.com', nombre: 'Juan Ovalle', principal: true, tels: ['50200000000'], wa: '50200000000', alternos: [] };
const LLAVES = { ONESIGNAL_IOS_APP_ID: 'ios-app-1', ONESIGNAL_IOS_KEY: 'os_v2_ios_prueba' };

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, llamadas = [], logs = [], wa = [];
  const lock = { tryLock: () => true, waitLock() {}, releaseLock() {} };
  const resp = (code, j) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(j || {}) });
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date, parseInt,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; }, getAll: () => ({}), putAll() {} }) },
    LockService: { getScriptLock: () => lock, getUserLock: () => lock },
    Utilities: { base64EncodeWebSafe: b => Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64url'),
      computeDigest: (a, t) => Array.from(require('crypto').createHash('md5').update(String(t)).digest()).map(x => (x > 127 ? x - 256 : x)),   // como Apps Script: bytes con signo
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ after: () => ({ create() {} }) }) }) },
    CFG: { HUB_URL: 'https://hub.x', TZ: 'America/Guatemala' },
    uf_: (url, op) => { const b = op && op.payload ? JSON.parse(op.payload) : null; llamadas.push({ url, metodo: op && op.method, auth: op && op.headers && op.headers.Authorization, body: b }); return o.respuesta ? o.respuesta(url, b) : resp(200, { id: 'n' + llamadas.length }); },
    adminsOp_: () => [JUAN], adminPorEmail_: e => (e === JUAN.email ? JUAN : null), chatPrincipal_: () => JUAN,
    esAdminPrincipal_: a => !!(a && a.principal), vozColaLock_: () => lock,
    paraClaudePrincipalSes_: s => (s && s.email === JUAN.email ? JUAN : null),
    retClave_: a => 'VOZ_RET_' + Buffer.from(require('crypto').createHash('md5').update(String(a.email).toLowerCase()).digest()).toString('base64url').slice(0, 16),
    retLeer_: () => [], retMencionado_() {},
    pendFilas_: () => [], normTel_: t => String(t), tituloCorto_: (t, n) => String(t || '').slice(0, n),
    hojaCrear_: () => ({ getLastColumn: () => 15, appendRow() {}, getLastRow: () => 1, getRange: () => ({ setValues() {} }) }),
    sinEmoji_: s => String(s || ''), s_: x => (x == null ? '' : String(x)), logPush_: (...a) => logs.push(a),
    waEnviar_: (n, t) => { wa.push({ n, t }); return { ok: true }; }
  };
  vm.createContext(ctx);
  ['candado.js', 'avisotexto.js', 'calle.js', 'voz.js', 'orbita.js', 'pendientes.js', 'almaabre.js', 'notifajustes.js', 'anillo.js', 'avisowa.js', 'pushapp.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  return { ctx, props, cache, llamadas, logs, wa };
}
const SES = { email: JUAN.email };
const os = c => c.llamadas.filter(x => /api\.onesignal\.com\/notifications$/.test(x.url));
const cola = c => JSON.parse(c.props.VOZ_AVISOS || '{}')[JUAN.email] || [];
/* La app con push listo y dormida: preguntó con listo y después avisó que se dormía. */
function lista(c) { c.ctx.vozAvisos_(SES, { push: { listo: true } }); c.ctx.vozAvisos_(SES, { duerme: true }); }

/* ── 1. Sin llaves, como hoy ── */
{
  const c = caja();
  const r = c.ctx.vozAvisos_(SES, { push: { listo: true } });
  ok(r.ok && !('push' in r), '1 · sin llaves la app no recibe con qué registrarse (push)');
  c.ctx.vozAvisos_(SES, { duerme: true });
  c.ctx.avisoPoner_(JUAN, 'huesped_espera', { propiedad: 'Brunelo 1808' }, 'a1', { nivel: 1 });
  ok(!c.llamadas.length && cola(c).length === 1 && !cola(c)[0].push, '1 · el aviso queda solo en la cola de la app, sin push ni llamadas');
  const v = c.ctx.vozAvisos_(SES, {});
  ok(v.avisos.length === 1 && !v.avisos[0].push, '1 · y la app lo recibe como siempre (sin marca de push)');
}

/* ── 2. Con llaves: con qué registrarse ── */
{
  const c = caja({ props: LLAVES });
  const r = c.ctx.vozAvisos_(SES, {});
  const ext = r.push && r.push.externo;
  ok(r.push && r.push.app_id === 'ios-app-1' && /^alma_[A-Za-z0-9_-]{16}$/.test(ext), '2 · la app recibe el App ID y su external_id (alma_ + la clave)');
  ok(ext.indexOf('@') < 0 && ext.indexOf('juan') < 0, '2 · el external_id no es el correo');
  ok(!c.props.PUSH_APP, '2 · sin que la app diga nada, nadie tiene push listo');
  c.ctx.vozAvisos_(SES, { push: { listo: true } });
  const l1 = c.props.PUSH_APP;
  c.ctx.vozAvisos_(SES, { push: { listo: true } });
  ok(l1 && Object.keys(JSON.parse(l1)).length === 1 && c.props.PUSH_APP === l1, '2 · la app dice que su push está listo y se guarda una vez (no en cada pregunta)');
  ok(c.props.PUSH_APP.indexOf('@') < 0, '2 · se guarda por clave, nunca por correo');
}

/* ── 3. Dormida: sale por push; despierta: no ── */
{
  const c = caja({ props: LLAVES });
  c.ctx.vozAvisos_(SES, { push: { listo: true } });   // despierta: acaba de preguntar
  c.ctx.avisoPoner_(JUAN, 'claude_listo', { titulo: 'Botón de facturas' }, 'a1', { nivel: 2 });
  ok(!os(c).length && !cola(c)[0].push, '3 · con la app despierta (preguntó hace poco), no sale push: la app lo muestra ella');
  c.ctx.vozAvisos_(SES, { duerme: true });
  c.ctx.avisoPoner_(JUAN, 'huesped_espera', { propiedad: 'Brunelo 1808' }, 'a2', { nivel: 1 });
  const n = os(c), b = (n[0] || {}).body || {}, ext = c.ctx.pushAppExterno_(JUAN);
  ok(n.length === 1 && n[0].metodo === 'post' && n[0].auth === 'Key os_v2_ios_prueba' && b.app_id === 'ios-app-1', '3 · dormida: un push a la app de OneSignal del iPhone, con su llave');
  ok(b.target_channel === 'push' && JSON.stringify(b.include_aliases) === JSON.stringify({ external_id: [ext] }), '3 · solo a su external_id');
  ok(b.collapse_id === 'a2' && b.data && b.data.alma && b.data.alma.id === 'a2' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(b.idempotency_key), '3 · con el id del aviso (collapse_id y data) y una llave de idempotencia con forma de UUID');
  ok(b.mutable_content === true && b.data.alma.tipo === 'urgentes' && b.ios_interruption_level === 'time_sensitive', '3 · pasa por la extensión (mutable_content) con su tipo; lo urgente, time-sensitive');
  ok(b.headings.es === 'Alma' && /Brunelo 1808/.test(b.contents.es), '3 · de Alma, con el texto humano del aviso');
  ok(JSON.stringify(b).indexOf(JUAN.email) < 0, '3 · en el push no va el correo');
  const q = cola(c).filter(a => a.id === 'a2')[0] || {};
  ok(q.push === true, '3 · el aviso queda marcado en la cola (push)');
  const v = c.ctx.vozAvisos_(SES, {}), a2 = v.avisos.filter(a => a.id === 'a2')[0] || {}, a1 = v.avisos.filter(a => a.id === 'a1')[0] || {};
  ok(a2.push === true && !a1.push, '3 · al despertar la app lo recibe con push: true (no arma otra notificación); el otro, sin marca');
  const antes = os(c).length;
  c.ctx.vozAvisoPoner_(JUAN, 'Otra cosa', 'a2', {});
  ok(os(c).length === antes, '3 · el mismo id no entra dos veces ni sale otro push');
  /* Dos disparos con el mismo aviso: misma llave de idempotencia */
  ok(c.ctx.pushAppUuid_('x|a2') === c.ctx.pushAppUuid_('x|a2') && c.ctx.pushAppUuid_('x|a2') !== c.ctx.pushAppUuid_('x|a3'), '3 · la llave de idempotencia sale siempre igual del mismo aviso');
  /* Pasados 100 s sin preguntar, se da por dormida aunque no lo haya avisado */
  c.ctx.vozAvisos_(SES, {});
  c.cache[c.ctx.pushAppVivaK_(JUAN)] = String(Date.now() - 101000);
  c.ctx.vozAvisoPoner_(JUAN, 'El equipo cumplió el encargo.', 'a3', { origen: 'encargo', nivel: 3 });
  ok(os(c).length === antes + 1, '3 · si no pregunta en 100 s (cerrada sin avisar), también sale por push');
}

/* ── 4. Ajustes por tipo ── */
{
  const c = caja({ props: LLAVES });
  c.ctx.notifAjustesGuardarApi_(SES, { tipo: 'equipo', ajuste: { bloqueada: false, centro: false, banner: false } });
  c.ctx.notifAjustesGuardarApi_(SES, { tipo: 'socios', ajuste: { vista: 'nunca', siri: true } });
  c.ctx.notifAjustesGuardarApi_(SES, { tipo: 'pendientes', ajuste: { vista: 'desbloqueado' } });
  lista(c); c.llamadas.length = 0;
  c.ctx.vozAvisoPoner_(JUAN, 'El equipo cumplió el encargo de la limpieza.', 'e1', { origen: 'encargo', nivel: 3 });
  ok(!os(c).length && c.logs.some(l => /apagado en sus ajustes \(equipo\)/.test(l[5])), '4 · el tipo apagado (Equipo) no sale por push y queda en el registro por qué');
  c.ctx.vozAvisoPoner_(JUAN, 'Un socio pide revisar su estado de cuenta de octubre.', 's1', { origen: 'socio', titulo: 'Estado de cuenta', datos: ['Socio: Brunelo 1808'] });
  const b = (os(c)[0] || {}).body || {};
  ok(b.contents && b.contents.es === 'Alma te dejó un mensaje' && JSON.stringify(b).indexOf('octubre') < 0 && JSON.stringify(b).indexOf('Brunelo') < 0 && !b.data.alma.titulo && !b.data.alma.lineas,
    '4 · vista previa «nunca»: «Alma te dejó un mensaje», sin el texto ni los datos');
  ok(b.data.alma.tipo === 'socios' && b.data.alma.aj && b.data.alma.aj.siri === true && b.data.alma.aj.vista === 'nunca', '4 · el ajuste del tipo viaja con el push (Siri encendido para Socios)');
  c.ctx.vozAvisoPoner_(JUAN, 'Ya está el cambio del botón de facturas.', 'p1', { origen: 'segundo_plano' });
  const b2 = (os(c)[1] || {}).body || {};
  ok(b2.contents && b2.contents.es === 'Alma te dejó un mensaje', '4 · «solo desbloqueado» sale genérico (la extensión no sabe si está bloqueado)');
  c.ctx.notifAjustesGuardarApi_(SES, { tipo: 'pendientes', ajuste: { vista: 'siempre' } });
  c.ctx.vozAvisoPoner_(JUAN, 'Ya está el cambio.', 'p2', { origen: 'segundo_plano', titulo: 'Facturas', datos: ['Pedido: botón', 'Qué falta: unir'] });
  const b3 = (os(c)[2] || {}).body || {};
  ok(b3.data && b3.data.alma.titulo === 'Facturas' && JSON.stringify(b3.data.alma.lineas) === '["Pedido: botón","Qué falta: unir"]' && b3.ios_interruption_level === 'active',
    '4 · con vista previa, el título y los datos ordenados del aviso, como en vozAvisos');
  ok(Buffer.byteLength(JSON.stringify(b3.data)) < 2048, '4 · los datos caben en lo que OneSignal deja (2 KB)');
}

/* ── 5. Si no se entrega ── */
{
  const c = caja({ props: LLAVES, respuesta: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ id: '', errors: { invalid_aliases: { external_id: ['alma_x'] } } }) }) });
  lista(c);
  c.ctx.vozAvisoPoner_(JUAN, 'Ya está el cambio.', 'f1', { origen: 'segundo_plano', nivel: 2 });
  ok(os(c).length === 1 && !cola(c)[0].push, '5 · OneSignal no lo entregó: se quita la marca (la app lo muestra al despertar)');
  ok(!Object.keys(JSON.parse(c.props.PUSH_APP || '{}')).length, '5 · y no se insiste hasta que la app vuelva a decir que está lista');
  c.ctx.vozAvisoPoner_(JUAN, 'Otra cosa.', 'f2', { nivel: 2 });
  ok(os(c).length === 1, '5 · el siguiente aviso ya no intenta');
  const c2 = caja({ props: LLAVES, respuesta: () => { throw new Error('red'); } });
  lista(c2);
  let roto = null; try { c2.ctx.vozAvisoPoner_(JUAN, 'Algo.', 'g1', { nivel: 2 }); } catch (e) { roto = e; }
  ok(!roto && cola(c2).length === 1 && !cola(c2)[0].push, '5 · si la red falla, el aviso queda para la app sin marca (la muestra al despertar) y nada se cae');
  const c3 = caja({ props: { ONESIGNAL_IOS_APP_ID: 'ios-app-1' } });
  c3.ctx.vozAvisos_(SES, { push: { listo: true } }); c3.ctx.vozAvisos_(SES, { duerme: true });
  let roto3 = null; try { c3.ctx.vozAvisoPoner_(JUAN, 'Algo.', 'h1', { nivel: 2 }); } catch (e) { roto3 = e; }
  ok(!roto3 && !c3.llamadas.length && !cola(c3)[0].push, '5 · con solo una de las dos llaves no se intenta nada y no falla');
}

/* ── 6. «Probar con Siri» por push ── */
{
  const c = caja({ props: LLAVES });
  c.ctx.vozAvisos_(SES, { push: { listo: true } });   // despierta
  const r = c.ctx.notifPruebaApi_(SES), b = (os(c)[0] || {}).body || {};
  ok(r.ok && r.push === true && os(c).length === 1 && b.data.alma.prueba === true && /Siri te lee esto/.test(b.contents.es) && b.ios_interruption_level === 'time_sensitive',
    '6 · la prueba sale por push al instante aunque la app esté despierta, como mensaje urgente de Alma');
  ok(!Object.keys(c.props).some(k => /^VOZ_AVISOS_H_/.test(k)) && !c.props.AVISO_VOZ_COLA, '6 · sin historial ni voz de ElevenLabs');
  const v = c.ctx.vozAvisos_(SES, {}), a = v.avisos[0] || {};
  ok(a.prueba === true && a.push === true, '6 · la app la recibe marcada: no la vuelve a programar');
  const c2 = caja();
  const r2 = c2.ctx.notifPruebaApi_(SES);
  ok(r2.ok && !r2.push && r2.en === 45 && !c2.llamadas.length, '6 · sin push, como hoy (la app la recoge con vozAvisos)');
}

/* ── 7. WhatsApp, registro y uf_ ── */
{
  const c = caja({ props: LLAVES });
  lista(c);
  c.ctx.vozAvisoPoner_(JUAN, 'Ya está el cambio del botón.', 'w1', { resultado: true, nivel: 2 });
  c.ctx.vozAvisoPoner_(JUAN, 'Necesito que revises la factura.', 'w2', { nivel: 2, historial: false });
  /* w2 sin push: se quita la marca a mano, como si OneSignal hubiera fallado */
  c.ctx.pushAppDesmarcar_(JUAN, 'w2');
  const t = JSON.parse(c.props.VOZ_AVISOS); t[JUAN.email].forEach(a => { a.ts -= 11 * 60000; }); c.props.VOZ_AVISOS = JSON.stringify(t);
  c.ctx.avisoWaRespaldo_();
  ok(c.wa.length === 1 && /revises la factura/.test(c.wa[0].t) && !/botón/.test(c.wa[0].t), '7 · lo que salió por push no se repite por WhatsApp; lo que no salió, sí');
  ok(c.logs.length >= 2 && c.logs.every(l => JSON.stringify(l).indexOf('botón') < 0 && JSON.stringify(l).indexOf('factura') < 0 && JSON.stringify(l).indexOf('@') < 0), '7 · el registro (ALMA_PUSH) no guarda el texto ni el correo');
  const P = leer('pushapp.js');
  ok(!/UrlFetchApp/.test(P) && /uf_\('https:\/\/api\.onesignal\.com\/notifications'/.test(P), '7 · la llamada a OneSignal pasa por uf_ (cuenta en el cupo)');
  const L = (leer('llaves.js').match(/var LLAVES_PERMITIDAS_ = \[([\s\S]*?)\n\];/) || [])[1] || '';
  ok(/'ONESIGNAL_IOS_APP_ID'/.test(L) && /'ONESIGNAL_IOS_KEY'/.test(L), '7 · las dos llaves se guardan desde Ajustes → Llaves');
  const VOZ = leer('voz.js');
  ok(/pushAppToca_\(adm, nuevo\)/.test(VOZ) && /pushAppMandar_\(adm, nuevo\)/.test(VOZ) && /pushAppAlPreguntar_\(adm, b, resp\)/.test(VOZ), '7 · los ganchos: al nacer el aviso (vozAvisoPoner_) y cuando la app pregunta (vozAvisos_)');
}

/* ── 8. Avisos de unir: nunca por WhatsApp (Juan, 17-nov-2026: «desactivar el envío de mensajes de unir por WhatsApp») ── */
{
  const c = caja();
  c.ctx.vozAvisoPoner_(JUAN, 'Ya quedó listo el cambio para «X»; solo falta que lo unas.', 'u1', { nivel: 2, tipo: 'claude_listo' });
  c.ctx.vozAvisoPoner_(JUAN, 'No pude unir sola el cambio de «Y».', 'u2', { nivel: 2, tipo: 'escalar_no_unido' });
  c.ctx.vozAvisoPoner_(JUAN, 'Ya quedó unido el cambio de «Z».', 'u3', { resultado: true, nivel: 3, tipo: 'claude_unido' });
  c.ctx.vozAvisoPoner_(JUAN, 'Necesito tu respuesta sobre «W».', 'u4', { nivel: 2, tipo: 'claude_pregunta' });
  const t = JSON.parse(c.props.VOZ_AVISOS); t[JUAN.email].forEach(a => { a.ts -= 11 * 60000; }); c.props.VOZ_AVISOS = JSON.stringify(t);
  c.ctx.avisoWaRespaldo_();
  ok(c.wa.length === 1 && /«W»/.test(c.wa[0].t) && !/unid|unas|unir/.test(c.wa[0].t), '8 · listo para unir, unido y no se pudo unir no salen por WhatsApp; una pregunta sí');
  const E = leer('escalar.js');
  ok(!/escalarWhatsApp_\(e, conDatos\)/.test(E) && /escalarWhatsApp_\(e, resp\)/.test(E), '8 · escalar sola: por WhatsApp solo el resultado, sin la línea de lo que se unió ni los avisos de unir');
}

if (fallo) process.exit(1);
console.log('Todo bien.');
