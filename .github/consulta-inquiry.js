/* Prueba de las consultas (inquiries) con dobles: sin Google, sin Hospitable y sin IA (apps-script/consultas.js).
   Pasó el 5-nov: Juan pidió por voz «escríbele a [nombre], la interesada del 725 de Narama» tres veces; Alma no la encontró
   (solo buscaba reservas), le habló a Juan como si fuera la interesada y le inventó «Likin».
   1. «Escríbele a la consulta que acaba de entrar»: la encuentra, devuelve el borrador y NO envía; sale solo con el sí en
      un turno nuevo (el mismo turno no cuenta) y por la plataforma de la consulta (inq:).
   2. Por nombre con un error («Marysol» / «Marisol») y la propiedad: la consulta gana a reservas que solo se parecen.
   3. Nada de Likin: ni en lo que devuelven las herramientas ni en las descripciones de la voz.
   4. Juan nunca es la consulta: la ficha sin identificar, la regla de CONSULTAS y la fuente única lo dicen.
   5. Tarjeta: por WhatsApp, en el chat o con un huésped, nunca; en la app de Alma, la consulta sí (con su borrador).
   6. Nunca prometer pantalla: ni «Te lo pongo en pantalla» en las reglas ni en la herramienta.
   node .github/consulta-inquiry.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const HOY = '2026-11-05';
const INBOX = [
  { conv_id: 'inq:4f6e0d69-0000', huesped: 'Marisol Duarte', propiedad: 'Z13 - Narama - 725', tipo: 'consulta', checkin: '2026-11-07', checkout: '2026-11-29', canal: 'airbnb',
    ultimo_texto: '¿Tienen una tarifa especial para estadía larga?', ultimo_de: 'guest', ultimo_ts: '2026-11-05T22:51:36Z', ultimo_guest_ts: '2026-11-05T22:51:36Z', foto: 'https://fotos.example/a.jpg' },
  { conv_id: 'inq:aaaa-1111', huesped: 'Tomás Ríos', propiedad: 'Z13 - Narama - 725', tipo: 'consulta', checkin: '2026-11-14', checkout: '2026-11-22', canal: 'airbnb',
    ultimo_texto: '¿Sigue disponible?', ultimo_de: 'guest', ultimo_ts: '2026-11-05T02:20:37Z', ultimo_guest_ts: '2026-11-05T02:20:37Z' },
  { conv_id: 'inq:vieja-2222', huesped: 'Bruno', propiedad: 'Z13 - Narama - 623', tipo: 'consulta', checkin: '2026-10-12', checkout: '2026-10-15', ultimo_guest_ts: '2026-10-11T00:05:26Z' },
  { conv_id: 'r-monaco', codigo: 'HMMONACO01', huesped: 'Marisa Durán', propiedad: 'Z7 - Monaco - D4' },
  { conv_id: 'r-likin', codigo: 'HMLIKIN001', huesped: 'Pedro Pérez', propiedad: 'Likin - Casa 3' }
];
const RESERVAS = [
  { code: 'HMMONACO01', guest_first_name: 'Marisa', guest_last_name: 'Durán', property_name: 'Z7 - Monaco - D4', checkin_date: '2026-11-04', checkout_date: '2026-11-09', guest_count: 2 },
  { code: 'HMLIKIN001', guest_first_name: 'Pedro', guest_last_name: 'Pérez', property_name: 'Likin - Casa 3', checkin_date: '2026-11-06', checkout_date: '2026-11-08', guest_count: 4 }
];
function caja() {
  const cache = {}, enviados = [];
  const fmt = (d, tz, f) => { const g = new Date(d.getTime() - 6 * 3600e3), p = (n) => String(n).padStart(2, '0');
    if (f === 'yyyy-MM-dd') return g.getUTCFullYear() + '-' + p(g.getUTCMonth() + 1) + '-' + p(g.getUTCDate());
    if (f === 'H:mm') return g.getUTCHours() + ':' + p(g.getUTCMinutes()); return g.toISOString(); };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Boolean,
    Date: class extends Date { constructor(...a) { if (!a.length) super(HOY + 'T23:00:00Z'); else super(...a); } static now() { return Date.parse(HOY + 'T23:00:00Z'); } },
    CFG: { TZ: 'America/Guatemala', TAB_RESERVAS: 'Reservas', TAB_PROPIEDADES: 'Propiedades' },
    Utilities: { formatDate: fmt, base64EncodeWebSafe: (b) => Buffer.from(String(b)).toString('base64'), computeDigest: (a, t) => String(t), DigestAlgorithm: { MD5: 'md5' } },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; } }) },
    s_: (v) => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    fin8_: (t) => String(t || '').replace(/\D/g, '').slice(-8), normTel_: (t) => String(t || '').replace(/\D/g, ''),
    fecha_: (v) => String(v || '').slice(0, 10), ahora_: () => new Date(HOY + 'T23:00:00Z'),
    sumarDias_: (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    leerTabla_: () => RESERVAS, hubInbox_: () => INBOX, formsOk_: () => [], estadoEs_: (x) => x,
    hosp_: () => { throw new Error('no se llama a Hospitable en la prueba'); },
    hubResponder_: (rid, texto, quien, canal) => { enviados.push({ rid, texto, canal }); return { ok: true }; },
    hubResponderWa_: () => { throw new Error('una consulta nunca sale por WhatsApp'); },
    vozWebTel_: (conv) => (conv === 'conv-app' || conv === 'conv-hub' ? '50255550101' : conv === 'conv-huesped' ? '50255559999' : ''),
    adminPorTel_: (tel) => (String(tel).slice(-8) === '55550101' ? { email: 'juan@spacioam.com', tels: ['50255550101'], principal: true } : null),
    calpPartes_: (n) => { const p = String(n).split(' - '); return { zona: p.length > 2 ? p[0] : 'Otras', edificio: p[1] || n, corto: p.length > 2 ? p[1] + ' ' + p[2] : n }; },
    calpClave_: (n) => String(n).toLowerCase().replace(/[^a-z0-9]/g, '')
  };
  vm.createContext(ctx);
  ['buscar.js', 'tarjeta.js', 'consultas.js', 'agente.js'].forEach((f) => vm.runInContext(leer(f), ctx, { filename: f }));
  return { X: ctx, cache, enviados };
}
const ADM = { email: 'juan@spacioam.com', nombre: 'Juan Ovalle', tels: ['50255550101'], principal: true };
const turno = (X, texto, canal) => { X.AGENTE_TEXTO_ = texto; X.AGENTE_CANAL_ = canal || 'llamada'; X.AGENTE_PERMITIDAS_ = null; };
const ctxH = () => ({ hechas: [] });
const MSG = 'Hola Marisol, te saluda Alma.\n\nLa tarifa especial se aplica sola desde las 28 noches: solo elige tus fechas.';

/* 1 · la secuencia: encuentra, borrador, sí en otro turno */
{ const { X, enviados, cache } = caja();
  turno(X, 'Escríbele a la inquiry que acaba de entrar: la tarifa especial se aplica sola desde las 28 noches');
  const b = X.agEjecutar_(ADM, 'buscar_reservas', { consultas: true }, ctxH());
  ok(b.consultas && b.consultas[0].conv_id === 'inq:4f6e0d69-0000' && b.consultas[0].huesped === 'Marisol Duarte', '1 · «la que acaba de entrar»: la consulta más reciente primero');
  ok(!b.consultas.some((c) => c.conv_id === 'inq:vieja-2222'), '1 · una consulta vieja (salió hace más de 14 días) no sale');
  ok(!/\+?502|tel|wa/.test(Object.keys(b.consultas[0]).join(',')), '1 · la consulta no lleva teléfono ni WhatsApp');
  const r1 = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: b.consultas[0].conv_id, texto: MSG, canal: 'plataforma' }, ctxH());
  ok(r1.falta_confirmar && r1.borrador && r1.borrador.texto === MSG && /NO salió/.test(r1.nota) && enviados.length === 0, '1 · sin confirmado: devuelve el borrador y no envía nada');
  const r2 = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: b.consultas[0].conv_id, texto: MSG, canal: 'plataforma', confirmado: true }, ctxH());
  ok(r2.falta_confirmar && enviados.length === 0, '1 · confirmado en el MISMO turno del borrador: tampoco sale');
  turno(X, 'Sí, envíalo');
  const r3 = X.agEjecutar_(ADM, 'enviar_a_huesped', { confirmado: true, texto: '', canal: 'whatsapp' }, ctxH());
  ok(r3.ok && enviados.length === 1 && enviados[0].rid === 'inq:4f6e0d69-0000' && enviados[0].canal === 'plataforma' && enviados[0].texto === MSG, '1 · con el sí en un turno nuevo sale una vez, por la plataforma, a esa consulta: ' + JSON.stringify(enviados[0] || {}));
  ok(!cache['CONSULTA_BORR_juan@spacioam.com'], '1 · el borrador se usa una sola vez');
  turno(X, 'mándalo otra vez');
  const r4 = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'inq:4f6e0d69-0000', texto: MSG, canal: 'plataforma', confirmado: true }, ctxH());
  ok(r4.falta_confirmar && enviados.length === 1, '1 · un confirmado sin borrador pendiente vuelve a ser borrador');
  turno(X, 'cámbialo'); X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'inq:4f6e0d69-0000', texto: 'Otro texto', canal: 'plataforma' }, ctxH());
  turno(X, 'sí'); const r5 = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'inq:4f6e0d69-0000', texto: 'Un texto distinto', canal: 'plataforma', confirmado: true }, ctxH());
  ok(r5.falta_confirmar && enviados.length === 1, '1 · si el texto cambió después del borrador, es un borrador nuevo (no sale)');
}

/* 2 · por nombre con error y propiedad: gana la consulta */
{ const { X } = caja(); turno(X, 'Escríbele a Marysol, la interesada del 725 de Narama');
  const e = X.agElegirReserva_('Marysol Narama 725', HOY);
  ok(e && e.conv_id === 'inq:4f6e0d69-0000' && e.tipo === 'consulta', '2 · «Marysol Narama 725» es la consulta de Marisol Duarte, no una reserva: ' + JSON.stringify(e));
  const b = X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Marisol Duarte' }, ctxH());
  ok(b.consultas && b.consultas.length === 1 && b.consultas[0].huesped === 'Marisol Duarte', '2 · buscar_reservas también trae la consulta por nombre');
  const n = X.agElegirReserva_('Narama 725', HOY);
  ok(n && n.ambiguo && n.opciones.length === 2, '2 · dos consultas en el mismo apartamento: no adivina, pregunta cuál');
}

/* 2b · aprobar la propuesta de un agente ya es el sí de Juan */
{ const { X, enviados } = caja(); turno(X, 'apruébalas');
  X.CONSULTA_APROBADA_ = true;
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'inq:aaaa-1111', texto: 'Hola Tomás, sí está disponible.', canal: 'plataforma' }, ctxH());
  X.CONSULTA_APROBADA_ = false;
  ok(r.ok && enviados.length === 1 && enviados[0].rid === 'inq:aaaa-1111', '2b · propuesta aprobada (agDecidir_): sale sin otro borrador');
  ok(/CONSULTA_APROBADA_ = true;[\s\S]{0,200}finally \{ CONSULTA_APROBADA_ = false; \}/.test(leer('agentes.js')) && /!r\.falta_confirmar/.test(leer('agentes.js')), '2b · agDecidir_ lo marca solo mientras ejecuta y un borrador no cuenta como hecho');
}

/* 3 · nada de Likin */
{ const { X } = caja(); turno(X, 'la interesada del 725 de Narama');
  const b = X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Marysol Narama 725' }, ctxH()), e = X.agElegirReserva_('Marysol Narama 725', HOY);
  ok(!/likin/i.test(JSON.stringify(b) + JSON.stringify(e)), '3 · lo que devuelven las herramientas no trae Likin');
  const voz = leer('voz.js'), def = voz.slice(voz.indexOf('var VOZ_AJUSTES_AJENAS_'), voz.indexOf('var VOZ_SISTEMA_DESC_'));
  ok(!/likin/i.test(def) && /nunca uno que no dijo/.test(def), '3 · la herramienta de disponibilidad no siembra «Likin» (la propiedad es la que dijo la persona)');
  ok(!/likin/i.test(leer('almafuente.js')), '3 · la fuente única no nombra propiedades');
}

/* 4 · Juan nunca es la consulta */
{ const voz = leer('voz.js'), fuente = leer('almafuente.js');
  const desc = /var VOZ_DESCONOCIDO_ = '([^']+)'/.exec(voz);
  ok(desc && /no le hables como si fuera esa persona/.test(desc[1]) && /lookup_reservation/.test(desc[1]), '4 · sin ficha: primero identificar y nunca hablarle como a la persona de la que habla');
  ok(/dynamic_variable_placeholders: Object\.assign\(\{\}, phP, \{ quien_llama: VOZ_DESCONOCIDO_ \}\)/.test(voz), '4 · ese texto se sube solo a ElevenLabs con el prompt');
  ok(/CONSULTAS: .*Quien te habla sigue siendo el administrador: nunca le hables como a esa persona/.test(voz), '4 · la regla de CONSULTAS con el administrador');
  ok(/"p_terceros"/.test(fuente) && /nunca le respondas como a esa persona/.test(fuente), '4 · la fuente única (principal): sigue hablando con él');
}

/* 5 · la tarjeta: nunca por WhatsApp ni con huéspedes; la consulta sí en la app */
{ const { X, cache } = caja();
  turno(X, 'escríbele a la consulta', 'whatsapp');
  X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Marisol Duarte' }, ctxH());
  ok(X.TV_CANDIDATA_ === null && X.tvCerrar_('conv-app', true, false) === null, '5 · por WhatsApp: no nace ninguna tarjeta');
  turno(X, 'escríbele a la consulta', 'hub');
  X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Marisol Duarte' }, ctxH());
  ok(X.TV_CANDIDATA_ === null, '5 · en el chat escrito: tampoco');
  turno(X, 'la consulta de Marisol');
  X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Marisol Duarte' }, ctxH());
  ok(X.tvCerrar_('conv-huesped', true, false) === null && !cache['voztarjeta_conv-huesped'], '5 · una llamada que no es de un administrador (huésped): nunca');
  X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Marisol Duarte' }, ctxH());
  ok(X.tvCerrar_('conv-hub', false, false) === null, '5 · el Hub con la voz minimizada (sin vozexp_): nunca');
  cache['vozexp_conv-hub'] = '1'; X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Marisol Duarte' }, ctxH());
  ok(!!(X.tvCerrar_('conv-hub', false, false) || {}).visible, '5 · el Hub con la voz expandida: sí');
  X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Tomás Ríos' }, ctxH());
  const r = X.tvCerrar_('conv-app', true, false), t = JSON.parse(cache['voztarjeta_conv-app'] || 'null');
  ok(r && r.visible && t && t.tipo === 'consulta' && t.titulo === 'Tomás Ríos' && t.conv === 'inq:aaaa-1111', '5 · en la app de Alma: la tarjeta de la consulta');
  ok(t.sub === 'Z13 · Narama 725 · Airbnb' && t.fechas[0].v === 'sáb 14 nov' && t.fechas[2].v === '8' && t.mensajes[0].texto === '¿Sigue disponible?' && t.datos.indexOf('Sin reserva todavía') >= 0, '5 · consulta: propiedad, fechas, noches y su mensaje: ' + t.sub);
  ok(/^EN PANTALLA: la consulta de Tomás Ríos/.test(r.voz), '5 · la voz recibe «EN PANTALLA» solo porque la tarjeta existe: ' + r.voz);
  ok(X.tvLineaChat_(r.celda) === 'Tarjeta de la llamada · consulta de Tomás Ríos', '5 · la línea del Chat con Alma junto a la llamada');
  turno(X, 'escríbele a Tomás que sí está disponible');
  X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'inq:aaaa-1111', texto: 'Hola Tomás, sí está disponible.', canal: 'plataforma' }, ctxH());
  const r2 = X.tvCerrar_('conv-app', true, false), t2 = JSON.parse(cache['voztarjeta_conv-app'] || 'null');
  ok(r2 && t2 && t2.chip === 'Borrador' && t2.mensajes.some((m) => /sale con tu sí/.test(m.quien) && m.texto === 'Hola Tomás, sí está disponible.'), '5 · el borrador también se ve en la tarjeta (dice que sale con tu sí)');
  const conPrecio = X.tvConsulta_(Object.assign({}, INBOX[1], { precio: 640 }));
  ok(conPrecio.datos[0] === 'Precio US$ 640', '5 · el precio, solo si algo ya lo trae');
  const inicio = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/consulta: "Consulta"/.test(inicio), '5 · la app la nombra «Consulta»');
}

/* 6 · nunca prometer pantalla */
{ const voz = leer('voz.js'), fuente = leer('almafuente.js');
  ok(!/Te lo pongo en pantalla/i.test(voz + fuente), '6 · nadie le enseña «Te lo pongo en pantalla» antes de que se vea');
  ok(/solo si responde que se mostró/.test(voz) && /"n_antes"/.test(fuente), '6 · la pantalla se dice solo cuando la herramienta confirma');
}
process.exit(fallo);
