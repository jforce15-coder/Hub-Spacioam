/* Prueba de los códigos de acceso de huéspedes (apps-script/codigoextension.js, codigoaviso.js y extractos de Código.js)
   con dobles: sin Google, sin Hospitable, sin WhatsApp de verdad y sin IA. Juan, 12-nov-2026:
   · Extensión (pedido 1): «cuando hay una extensión el código no se renueva»: entre 2 h y 1 h antes de que venza el código
     de la reserva original, Alma le pide UNA vez el código nuevo al administrador principal y al secundario; el que
     responde, su código le llega al huésped por su conversación; sin respuesta, un recordatorio 30 min antes; sin
     extensión, nada. Las dos formas: la misma reserva con la salida movida (Estrella, Ignacio 1206) y una reserva nueva
     del mismo huésped que empieza el día que termina la otra (Luis, Ignacio 904).
   · Código ya enviado (pedido 11): si el huésped lo pide y ya se le mandó uno vigente (el PIN de igloohome, 9 dígitos en
     su línea, o el que el equipo manda suelto con 🔒), se le reenvía ESE con «ya se había enviado en un mensaje anterior,
     pero con gusto te lo enviamos de nuevo», sin código de emergencia; el de emergencia solo si no hay uno vigente.
   node .github/codigos-acceso.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js');
const sacar = (nombre) => { const m = new RegExp('\\n(?:function ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}|const ' + nombre + ' = [^\\n]*)').exec(COD); if (!m) throw new Error('no encontré ' + nombre + ' en Código.js'); return m[0]; };

const gt = (s) => Date.parse(s.replace(' ', 'T') + ':00-06:00');   // hora de Guatemala → ms
let AHORA = gt('2026-11-07 08:30');
const PIN = '111222333', PIN_B = '444555666', NUEVO = '987654321';   // códigos de mentira
const igloo = (nombre, prop, desde, hasta, pin) => '[Automated Message for your Self Check-In]\n\nHi ' + nombre + ',\n\nHere is your igloohome self check-in details at ' + prop +
  ' · Apartamento en zona 10 from ' + desde + ', 3PM, UTC-06:00 to ' + hasta + ', 11AM, UTC-06:00.\n\nPlace your palm over the lock keypad and enter below PIN to unlock:\n\nCasa ' + prop.split(' - ').slice(1).join(' ') + ':\n ' + pin + '🔓\n\nYour PIN is valid only from check-in to check-out time.\n\nThe igloohome Team';
const fmt = (d, tz, f) => { const g = new Date(new Date(d).getTime() - 6 * 3600e3), p = (n) => String(n).padStart(2, '0');
  if (f === 'yyyy-MM-dd') return g.getUTCFullYear() + '-' + p(g.getUTCMonth() + 1) + '-' + p(g.getUTCDate());
  if (f === 'HH:mm') return p(g.getUTCHours()) + ':' + p(g.getUTCMinutes());
  if (f === 'd') return String(g.getUTCDate()); if (f === 'M') return String(g.getUTCMonth() + 1); return g.toISOString(); };

function caja(o) {
  o = o || {};
  const cache = {}, props = {}, wa = [], guest = [], avisos = [], estados = [], logs = [];
  let nId = 0;
  const X = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Boolean, encodeURIComponent, decodeURIComponent,
    Date: class extends Date { constructor(...a) { if (!a.length) super(AHORA); else super(...a); } static now() { return AHORA; } },
    CFG: { TZ: 'America/Guatemala', TAB_RESERVAS: 'Reservas', HUB_URL: 'https://hub.example', WHATSAPP_NOCTURNO: '+50255550001', WHATSAPP_RESPALDO: o.sinSecundario ? '' : '+50255550002' },
    Utilities: { formatDate: fmt, sleep() {} },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    s_: (v) => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    fin8_: (t) => String(t || '').replace(/\D/g, '').slice(-8), normTel_: (t) => String(t || '').replace(/\D/g, ''),
    fecha_: (v) => String(v || '').slice(0, 10), ahora_: () => new Date(AHORA),
    sumarDias_: (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    leerTabla_: () => o.reservas || [], agResId_: (c) => 'uuid-' + c, idiomaDe_: (t) => (/\b(the|hi|please|can|i|my|would)\b/i.test(t) ? 'en' : 'es'),
    hiloConv_: (id) => ({ code: 200, hilo: (o.hilos || {})[id] || [] }),
    adminPorTel_: (t) => ({ '55550001': { nombre: 'Juan Ovalle' }, '55550002': { nombre: 'Gabriel' } })[String(t).replace(/\D/g, '').slice(-8)] || null,
    waEnviar_: (to, texto) => { const id = 'wamid.' + (++nId); wa.push({ to: String(to).replace(/\D/g, ''), texto, id }); return { ok: true, id }; },
    enviarCanal_: (d, texto) => { guest.push({ resId: d.resId, texto }); return { code: o.falla ? 500 : 201, error: o.falla ? 'Hospitable 500' : '' }; },
    pushA_() {}, log_: (d, t, a) => logs.push(a), set_: (sh, f, c) => { estados.push(c); Object.assign(f.est = f.est || {}, c); },
    avisarAdmins_: (asunto, texto) => avisos.push({ asunto, texto }), escalar_: (asunto, texto) => avisos.push({ asunto, texto }),
    cfg_: (k) => ({ EMERGENCIA_MIN: 15, ESPERA_ROJO_SEG: 1800, CODIGO_REVISION_MIN: 6 })[k] || 0,
    codigoEmergencia_: () => (o.sinEmergencia ? null : { codigo: '5050', origen: 'quincena' }), mensajeEmergencia_: (i, c) => 'Código temporal de acceso: ' + c,
    codigoEquipo_: () => (o.epi ? { codigo: o.epi, tipo: 'quincena' } : null),
    reintentar_() { throw new Error('no debía reintentar'); }
  };
  vm.createContext(X);
  ['codigoaviso.js', 'codigoextension.js'].forEach((f) => vm.runInContext(leer(f), X, { filename: f }));
  vm.runInContext(['RX_PIDE_CODIGO_', 'codigoEnviadoEnHilo_', 'codigoPendiente_', 'verificarRojo_', 'codigosEnHilo_', 'textoCodigos_'].map(sacar).join('\n'), X, { filename: 'Código.js (extracto)' });
  X.PropertiesService.getScriptProperties().getProperty = (k) => (k in props ? props[k] : null);
  return { X, wa, guest, avisos, estados, logs, props, cache };
}

/* ═════════ Pedido 11 · código ya enviado ═════════ */
const ESTRELLA = { resId: 'uuid-HM5TWHD8KK', codigo: 'HM5TWHD8KK', huesped: 'Estrella Hernandez', propiedad: 'Z10 - Ignacio - 1206', checkin: '2026-10-31', checkout: '2026-11-08', idioma: 'es', modo: 'AUTO', reservaConfirmada: true, canal: 'hospitable' };
const PIN_E = igloo('Estrella Hernandez', 'Z10 - Ignacio - 1206', '31 Oct 2026', '08 Nov 2026', PIN);
const hiloCon = (texto) => [{ tipo: 'host', auto: true, texto, created: '2026-10-31T20:04:40Z', fuente: 'platform' }];
const ctxPide = (texto, extra) => Object.assign({}, ESTRELLA, { texto, hoy: '2026-11-07' }, extra || {});
{ AHORA = gt('2026-11-07 17:44');
  const { X } = caja();
  const v = X.pinVigencia_(hiloCon(PIN_E));
  ok(v && v.codigo === PIN && v.hastaMs === gt('2026-11-08 11:00') && v.desdeMs === gt('2026-10-31 15:00'), '11 · lee del mensaje de igloohome el PIN (9 dígitos en su línea, no el «1206» del apartamento) y su hora de fin: ' + JSON.stringify(v));
  ok(X.codigoEnviadoEnHilo_(hiloCon(PIN_E), ESTRELLA), '11 · el PIN de igloohome cuenta como código ya enviado (antes no: salía el de emergencia)');
  const c = X.codigosEnHilo_(hiloCon(PIN_E));
  ok(c.apto.length === 1 && c.apto[0].codigo === PIN && /igloohome, vale hasta 08 Nov 2026, 11AM/.test(X.textoCodigos_(c)), '11 · el redactor ve el PIN en «CÓDIGOS YA ENVIADOS»: ' + X.textoCodigos_(c));
}
/* Pide el código y ya tiene uno vigente: se reenvía ESE, con la frase, sin alerta ni emergencia. */
{ AHORA = gt('2026-11-07 17:44');
  const { X, guest, avisos, estados, logs } = caja();
  const hilo = hiloCon(PIN_E), ctx = ctxPide('Hola, me pueden enviar el código de la puerta? no lo encuentro');
  const vig = X.codigoReenvioAplica_(ctx, hilo);
  ok(vig && vig.codigo === PIN, '11 · pide el código y el PIN sigue vigente: se reenvía ese');
  X.codigoReenviar_({}, { fila: 2 }, [], ctx, vig);
  ok(guest.length === 1 && /ya se había enviado en un mensaje anterior, pero con gusto te lo enviamos de nuevo: 111222333/.test(guest[0].texto), '11 · el mensaje dice la frase de Juan y lleva el mismo código: ' + (guest[0] || {}).texto);
  ok(avisos.length === 0 && !logs.some((l) => /EMERGENCIA/.test(l)) && estados.some((e) => e.estado === 'respondido'), '11 · sin alerta a los administradores y sin código de emergencia');
  ok(!X.codigoPendiente_(Object.assign({}, ctx, { texto: 'estamos en la puerta, cuál es el código?' }), hilo), '11 · con el PIN vigente, «estamos en la puerta» ya no abre la revisión que termina en emergencia');
  const en = X.codigoReenvioTexto_('en', PIN);
  ok(/already sent in a previous message, but we are happy to send it again: 111222333/.test(en), '11 · en inglés también');
}
/* El que el equipo mandó suelto («Please try this one ⏎ 444555666🔒») también cuenta, y es el último. */
{ AHORA = gt('2026-11-07 18:10');
  const { X } = caja();
  const hilo = hiloCon(PIN_E).concat([{ tipo: 'host', auto: false, texto: 'Please try this one\r\n\r\n' + PIN_B + '🔒', created: '2026-11-07T23:58:16Z', fuente: 'hospitable' }]);
  const vig = X.codigoReenvioAplica_(ctxPide('Me puedes pasar otra vez el código?'), hilo);
  ok(vig && vig.codigo === PIN_B, '11 · el código que el equipo mandó solo en su línea con 🔒 cuenta y es el que se reenvía');
}
/* El PIN ya venció (Estrella, 7-nov: «to 07 Nov 2026, 11AM»): nada de reenviarlo; sigue la revisión que avisa y, si nadie
   responde, el de emergencia. */
{ AHORA = gt('2026-11-07 17:44');
  const { X } = caja();
  const hilo = hiloCon(igloo('Estrella Hernandez', 'Z10 - Ignacio - 1206', '31 Oct 2026', '07 Nov 2026', PIN));
  ok(!X.codigoReenvioAplica_(ctxPide('Me pueden enviar el código?'), hilo), '11 · PIN vencido: no se reenvía');
  ok(X.codigoPendiente_(ctxPide('estoy afuera, cuál es el código?'), hilo), '11 · PIN vencido: sigue la revisión del código pendiente (alerta y, sin respuesta, emergencia)');
  const sin = X.codigoReenvioAplica_(ctxPide('Me pueden enviar el código?'), []);
  ok(!sin && X.codigoPendiente_(ctxPide('ya estoy aquí, cuál es el código?'), []), '11 · sin ningún código en la conversación: revisión y emergencia como antes');
}
/* Un código de emergencia (de Epi) que ya cambió de quincena no está vigente; el de Epi de hoy sí. */
{ AHORA = gt('2026-11-07 17:44');
  const hilo = [{ tipo: 'host', auto: false, texto: 'Código temporal de acceso: 7070', created: '2026-11-03T20:00:00Z' }];
  ok(!caja({ epi: '8080' }).X.codigoVigenteEnHilo_(hilo, ESTRELLA), '11 · un código de Epi de otra quincena ya no vale');
  ok(caja({ epi: '7070' }).X.codigoVigenteEnHilo_(hilo, ESTRELLA), '11 · el de Epi de esta quincena sí');
}
/* ROJO sin respuesta del equipo (verificarRojo_): con un código vigente se reenvía ese; si dice que no funciona, o no hay
   ninguno vigente, sale el de emergencia. */
{ AHORA = gt('2026-11-07 18:00');
  const fila = (texto) => ({ fila: 9, v: ['esperando_rojo', JSON.stringify(Object.assign({}, ESTRELLA, { texto, acceso: true, contencionAt: '2026-11-07T23:40:00Z', razon: 'no puede entrar' }))] });
  const corre = (o, texto) => { const k = caja(o); Object.assign(k.X, { C: { estado: 0, datos: 1 } }); k.X.verificarRojo_({}, fila(texto)); return k; };
  let k = corre({ hilos: { 'uuid-HM5TWHD8KK': hiloCon(PIN_E) } }, 'Ya llegamos, no podemos entrar, cuál es el código?');
  ok(k.guest.length === 1 && /con gusto te lo enviamos de nuevo: 111222333/.test(k.guest[0].texto) && !k.logs.some((l) => /EMERGENCIA/.test(l)), '11 · ROJO sin respuesta y con PIN vigente: reenvía el PIN, sin código de emergencia');
  k = corre({ hilos: { 'uuid-HM5TWHD8KK': hiloCon(PIN_E) } }, 'El código no funciona, sigue marcando en rojo');
  ok(k.guest.length === 1 && /5050/.test(k.guest[0].texto) && k.logs.some((l) => /EMERGENCIA/.test(l)), '11 · si dice que el código no funciona, sale el de emergencia (repetir el mismo no ayuda)');
  k = corre({ hilos: {} }, 'Ya llegamos, no podemos entrar');
  ok(k.guest.length === 1 && /5050/.test(k.guest[0].texto), '11 · sin ningún código vigente: sale el de emergencia, como antes');
}

/* ═════════ Pedido 1 · extensión ═════════ */
const R = (code, nombre, ape, prop, ci, co) => ({ code, guest_first_name: nombre, guest_last_name: ape, property_name: prop, checkin_date: ci, checkout_date: co, reservation_status: 'accepted' });
const PIN_ORIG = igloo('Estrella Hernandez', 'Z10 - Ignacio - 1206', '31 Oct 2026', '07 Nov 2026', PIN);
const forma1 = (extra) => ({ reservas: [R('HM5TWHD8KK', 'Estrella', 'Hernandez', 'Z10 - Ignacio - 1206', '2026-10-31', '2026-11-08'), R('HMOTRA0001', 'Ana', 'López', 'Z10 - Ignacio - 1206', '2026-11-08', '2026-11-10')],
  hilos: { 'uuid-HM5TWHD8KK': hiloCon(PIN_ORIG).concat(extra || []) } });
const pasada = (k, cuando) => { AHORA = gt(cuando); delete k.cache.ext_rev; k.X.extensionRevisar_(); };
const pedidos = (k) => k.wa.filter((w) => /Código para una extensión/.test(w.texto) && !/Recordatorio/.test(w.texto));
{ const k = caja(forma1());
  pasada(k, '2026-11-07 08:30');
  ok(k.wa.length === 0, '1 · 2 h 30 min antes de que venza el código: todavía nada');
  pasada(k, '2026-11-07 09:05');
  const p = pedidos(k);
  ok(p.length === 2 && p.map((w) => w.to).sort().join() === '50255550001,50255550002', '1 · entre 2 h y 1 h antes: una solicitud al principal y otra al secundario');
  ok(/Estrella Hernandez/.test(p[0].texto) && /Z10 - Ignacio - 1206/.test(p[0].texto) && /HM5TWHD8KK/.test(p[0].texto) && /vence hoy a las 11:00 \(fin de su reserva original\)/.test(p[0].texto) && /hasta el 8 nov a las 11:00/.test(p[0].texto) && /código nuevo/.test(p[0].texto),
    '1 · dice huésped, propiedad, reserva, a qué hora vence el código actual y hasta cuándo se queda: ' + p[0].texto.replace(/\n/g, ' | '));
  pasada(k, '2026-11-07 09:30'); pasada(k, '2026-11-07 09:55');
  ok(pedidos(k).length === 2, '1 · una sola vez (las pasadas siguientes no repiten)');
  /* El secundario responde citando la solicitud. */
  const r1 = k.X.extensionWaEntrante_({ type: 'text', text: { body: NUEVO }, context: { id: p[1].id } }, p[1].to);
  ok(r1 && k.guest.length === 1 && k.guest[0].resId === 'uuid-HM5TWHD8KK' && k.guest[0].texto.indexOf(NUEVO) >= 0 && /extendiste tu estadía/.test(k.guest[0].texto) && /8 nov a las 11:00/.test(k.guest[0].texto), '1 · su respuesta le llega al huésped por su conversación: ' + (k.guest[0] || {}).texto);
  ok(k.wa.some((w) => w.to === p[1].to && /^Listo, le mandé el código nuevo a Estrella Hernandez/.test(w.texto)) && k.wa.some((w) => w.to !== p[1].to && /ya mandó el código nuevo de Estrella/.test(w.texto)), '1 · le confirma a quien respondió y le avisa al otro');
  ok(k.props.EXT_CODIGOS.indexOf(NUEVO) < 0, '1 · el estado no guarda el código');
  const r2 = k.X.extensionWaEntrante_({ type: 'text', text: { body: '555666777' }, context: { id: p[0].id } }, p[0].to);
  ok(r2 && k.guest.length === 1 && k.wa.some((w) => /Ese código ya se lo mandó Gabriel/.test(w.texto)), '1 · un solo envío: si el otro también responde, no sale otro');
  pasada(k, '2026-11-07 10:35');
  ok(!k.wa.some((w) => /Recordatorio/.test(w.texto)), '1 · ya resuelto: sin recordatorio');
}
{ const k = caja(forma1());
  pasada(k, '2026-11-07 09:10'); pasada(k, '2026-11-07 10:20');
  ok(!k.wa.some((w) => /Recordatorio/.test(w.texto)), '1 · sin respuesta, a 40 min del vencimiento todavía no hay recordatorio');
  pasada(k, '2026-11-07 10:31');
  const rec = k.wa.filter((w) => /Recordatorio/.test(w.texto));
  ok(rec.length === 2 && /vence en 30 min/.test(rec[0].texto), '1 · a 30 min del vencimiento, un recordatorio a cada uno');
  pasada(k, '2026-11-07 10:45'); pasada(k, '2026-11-07 10:55');
  ok(k.wa.filter((w) => /Recordatorio/.test(w.texto)).length === 2, '1 · el recordatorio sale una sola vez');
  /* Sin citar, con solo el código y una sola solicitud abierta: es la respuesta. Un teléfono de 8 dígitos no. */
  ok(!k.X.extensionWaEntrante_({ type: 'text', text: { body: '55550303' } }, '50255550001') && k.guest.length === 0, '1 · un número de 8 dígitos sin citar no se toma como código (parece un teléfono)');
  ok(!k.X.extensionWaEntrante_({ type: 'text', text: { body: 'llámale a Gabriel' } }, '50255550001'), '1 · un texto cualquiera sigue su camino normal (Alma)');
  ok(!k.X.extensionWaEntrante_({ type: 'text', text: { body: NUEVO } }, '50255559999'), '1 · alguien que no es administrador no puede mandar el código');
  ok(k.X.extensionWaEntrante_({ type: 'text', text: { body: NUEVO + '🔒' } }, '50255550001') && k.guest.length === 1 && k.guest[0].texto.indexOf(NUEVO) >= 0, '1 · sin citar, con solo el código y una solicitud abierta: va al huésped');
}
{ /* El equipo ya le mandó un código a mano después del PIN: no se pide nada. */
  const k = caja(forma1([{ tipo: 'host', auto: false, texto: 'Te comparto tu nuevo código: ' + PIN_B + '#', created: '2026-11-06T20:00:00Z' }]));
  pasada(k, '2026-11-07 09:05');
  ok(k.wa.length === 0, '1 · si el equipo ya le mandó otro código en la conversación, no se pide nada');
}
{ /* Sin extensión: el PIN vale hasta su salida. */
  const k = caja({ reservas: [R('HMSINEXT01', 'Pedro', 'Ruiz', 'Z10 - Ignacio - 1206', '2026-11-03', '2026-11-07')], hilos: { 'uuid-HMSINEXT01': hiloCon(igloo('Pedro Ruiz', 'Z10 - Ignacio - 1206', '03 Nov 2026', '07 Nov 2026', PIN)) } });
  pasada(k, '2026-11-07 09:05'); pasada(k, '2026-11-07 10:31');
  ok(k.wa.length === 0, '1 · sin extensión (el código vence con su salida): nada');
  const k2 = caja({ reservas: [R('HMLARGA001', 'Pedro', 'Ruiz', 'Z10 - Ignacio - 1206', '2026-11-03', '2026-11-12')], hilos: { 'uuid-HMLARGA001': hiloCon(igloo('Pedro Ruiz', 'Z10 - Ignacio - 1206', '03 Nov 2026', '12 Nov 2026', PIN)) } });
  pasada(k2, '2026-11-07 09:05');
  ok(k2.wa.length === 0, '1 · estadía larga con el PIN hasta su salida: nada');
}
{ /* Forma 2: reserva nueva del mismo huésped que empieza el día que termina la otra (Luis, Ignacio 904). */
  const reservas = [R('HMLUISA001', 'Luis', 'Ramírez', 'Z10 - Ignacio - 904', '2026-10-20', '2026-10-27'), R('HMLUISB002', 'Luis', 'Ramírez', 'Z10 - Ignacio - 904', '2026-10-27', '2026-10-29')];
  const pinA = igloo('Luis R', 'Z10 - Ignacio - 904', '20 Oct 2026', '27 Oct 2026', PIN), pinB = igloo('Luis R', 'Z10 - Ignacio - 904', '27 Oct 2026', '29 Oct 2026', PIN_B);
  const k = caja({ reservas, hilos: { 'uuid-HMLUISA001': [{ tipo: 'guest', texto: 'Hello! I am staying in this apartment and would like to extend my stay', created: '2026-10-26T01:14:45Z' }].concat(hiloCon(pinA)), 'uuid-HMLUISB002': hiloCon(pinB) } });
  pasada(k, '2026-10-27 09:05');
  const p = pedidos(k);
  ok(p.length === 2 && /HMLUISA001 \(sigue con HMLUISB002\)/.test(p[0].texto) && /hasta el 29 oct a las 11:00/.test(p[0].texto), '1 · reserva nueva que sigue: el PIN de la nueva vale desde las 3 PM y el de la primera vence a las 11:00 → se pide el código');
  k.X.extensionWaEntrante_({ type: 'text', text: { body: NUEVO }, context: { id: p[0].id } }, p[0].to);
  ok(k.guest.length === 1 && k.guest[0].resId === 'uuid-HMLUISB002' && /^Hi Luis! Since you extended your stay/.test(k.guest[0].texto), '1 · el código va a la conversación de la reserva que sigue, en su idioma');
  const k2 = caja({ reservas, hilos: { 'uuid-HMLUISA001': hiloCon(pinA), 'uuid-HMLUISB002': hiloCon(pinB.replace('27 Oct 2026, 3PM', '27 Oct 2026, 11AM')) } });
  pasada(k2, '2026-10-27 09:05');
  ok(k2.wa.length === 0, '1 · si el PIN de la nueva ya vale desde las 11:00, no hay hueco: nada');
}
{ /* Sin secundario: solo al principal. */
  const k = caja(Object.assign(forma1(), { sinSecundario: true }));
  pasada(k, '2026-11-07 09:05');
  ok(pedidos(k).length === 1 && pedidos(k)[0].to === '50255550001', '1 · si no hay secundario definido, solo al principal');
}
{ /* Si Hospitable falla al mandarle el código, el administrador lo sabe y la solicitud sigue abierta. */
  const k = caja(Object.assign(forma1(), { falla: true }));
  pasada(k, '2026-11-07 09:05');
  const p = pedidos(k);
  k.X.extensionWaEntrante_({ type: 'text', text: { body: NUEVO }, context: { id: p[0].id } }, p[0].to);
  ok(k.wa.some((w) => /^No le salió el código a Estrella/.test(w.texto)) && /"estado":"pedido"/.test(k.props.EXT_CODIGOS), '1 · si no sale, se lo dice con el enlace al Hub y la solicitud sigue abierta');
}

/* ═════════ Conexiones ═════════ */
ok(/try \{ extensionRevisar_\(\); \}/.test(COD) && COD.indexOf('extensionRevisar_();') < COD.indexOf("if (cupoPermite_('fondo'))"), 'procesarCola revisa las extensiones fuera de lo que se pausa por cupo');
ok(COD.indexOf('extensionWaEntrante_(m, wa)') > 0 && COD.indexOf('extensionWaEntrante_(m, wa)') < COD.indexOf('decisionWaEntrante_(m, wa,'), 'el webhook de WhatsApp atiende el código de una extensión antes que los casos');
ok(COD.indexOf('codigoReenvioAplica_(ctx, hilo)') > 0 && COD.indexOf('codigoReenvioAplica_(ctx, hilo)') < COD.indexOf('if (codigoPendiente_(ctx, hilo))'), 'procesar revisa el código ya enviado antes de abrir la revisión del código pendiente');
ok(/primero dile que ya se le había enviado en un mensaje anterior, pero que con gusto se lo envías de nuevo/.test(fs.readFileSync(path.join(DIR, '..', 'playbooks', 'huespedes.json'), 'utf8')), 'la regla de códigos del redactor dice la frase de Juan');
process.exit(fallo);
