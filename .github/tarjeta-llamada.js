/* Prueba de la tarjeta de la llamada (apps-script/tarjeta.js, #446 T2) con dobles: sin Google, sin Hospitable y sin IA.
   1. Una candidata se vuelve tarjeta: se guarda en voztarjeta_<conv_id> 10 min y la voz recibe «EN PANTALLA».
   2. Una lista no es tarjeta (y borra la candidata de antes).
   3. Lo mismo no vuelve a salir en la misma llamada.
   4. La familia nunca la ve (herramientas personales) y la acción vozTarjeta es solo del administrador de esa llamada.
   5. voztarjeta_ solo para las llamadas de la app (vozapp_); con la pantalla bloqueada o en conferencia queda solo en
      el chat (columna tarjeta), sin «EN PANTALLA».
   6. Las tres tarjetas: reserva, conversación y apartamento (sin códigos, con la semana del calendario y sus colores).
   7. agEjecutar_ deja la candidata en buscar_reservas (un resultado), ver_conversacion y ver_propiedad.
   node .github/tarjeta-llamada.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const HOY = '2026-11-04';
function caja(o) {
  o = o || {};
  const cache = {}, puestos = [];
  const fmt = (d, tz, f) => {   // Guatemala: UTC−6, sin horario de verano
    const g = new Date(d.getTime() - 6 * 3600e3), p = (n) => String(n).padStart(2, '0');
    if (f === 'yyyy-MM-dd') return g.getUTCFullYear() + '-' + p(g.getUTCMonth() + 1) + '-' + p(g.getUTCDate());
    if (f === 'H:mm') return g.getUTCHours() + ':' + p(g.getUTCMinutes());
    return g.toISOString();
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN,
    Date: class extends Date { constructor(...a) { if (!a.length) super(HOY + 'T16:00:00Z'); else super(...a); } static now() { return Date.parse(HOY + 'T16:00:00Z'); } },
    CFG: { TZ: 'America/Guatemala', TAB_RESERVAS: 'Reservas' },
    Utilities: { formatDate: fmt },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v, s) => { cache[k] = String(v); puestos.push({ k, s }); }, remove: (k) => { delete cache[k]; }, getAll: (ks) => { const r = {}; ks.forEach((k) => { if (k in cache) r[k] = cache[k]; }); return r; } }) },
    s_: (v) => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    norm_: (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(),
    fin8_: (t) => String(t || '').replace(/\D/g, '').slice(-8),
    leerTabla_: () => o.reservas || [],
    hubInbox_: () => o.inbox || [],
    vozWebAdmin_: (ses) => (ses && ses.email === 'juan@spacioam.com' ? { email: ses.email, tels: ['50255550101'], principal: true } : null),
    vozWebTel_: (conv) => (conv === 'conv-app' ? '50255550101' : conv === 'conv-otro' ? '50255559999' : ''),
    hosp_: () => { throw new Error('la tarjeta no llama a Hospitable'); },
    fecha_: (v) => String(v || '').slice(0, 10), sumarDias_: (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'calprops.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'tarjeta.js'), 'utf8'), ctx);
  return { X: ctx, cache, puestos };
}

const FILA = { code: 'HM4K2Q9XAB', guest_first_name: 'Mariana', guest_last_name: 'López', property_name: 'Z10 - Brunelo - 1203', checkin_date: '2026-11-06', checkout_date: '2026-11-09', guest_count: 2, platform: 'airbnb', total: 312 };
const ITEM = { codigo: 'HM4K2Q9XAB', estado: 'confirmada', huesped: 'Mariana López', propiedad: 'Z10 - Brunelo - 1203', entrada: '2026-11-06', salida: '2026-11-09', huespedes: '2', registro: 'completo', conv_id: 'r-1' };
const INBOX = [{ conv_id: 'r-1', codigo: 'HM4K2Q9XAB', huesped: 'Mariana López', foto: 'https://fotos.example/m.jpg', propiedad: 'Z10 - Brunelo - 1203', canal: 'airbnb' }];

/* 1 · candidata → tarjeta */
{ const { X, cache, puestos } = caja({ inbox: INBOX });
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, INBOX));
  const r = X.tvCerrar_('conv-app', true, false), t = JSON.parse(cache['voztarjeta_conv-app'] || 'null');
  ok(r && r.visible && t && t.tipo === 'reserva' && t.titulo === 'Mariana López', '1 · un resultado: la tarjeta de la reserva queda en voztarjeta_<conv_id>');
  ok(puestos.some((p) => p.k === 'voztarjeta_conv-app' && p.s === 600), '1 · voztarjeta_ dura 10 minutos');
  ok(/^EN PANTALLA: /.test(r.voz), '1 · la voz recibe «EN PANTALLA» (no lee los datos): ' + r.voz);
  ok(JSON.parse(r.celda).tipo === 'reserva' && JSON.parse(r.celda).id === 'HM4K2Q9XAB', '1 · la columna tarjeta lleva el tipo y el id');
  ok(t.sub === 'Z10 · Brunelo 1203 · Airbnb' && t.chip === 'Confirmada' && t.foto === 'https://fotos.example/m.jpg', '1 · zona, edificio, canal, estado y foto: ' + t.sub);
  ok(t.fechas[0].v === 'vie 6 nov' && t.fechas[1].v === 'lun 9 nov' && t.fechas[2].v === '3' && t.fechas[2].d === '2 huésp.', '1 · llega, sale, noches y huéspedes: ' + JSON.stringify(t.fechas));
  ok(t.datos.indexOf('Registro completo') >= 0 && t.datos.indexOf('Total US$ 312') >= 0 && t.conv === 'HM4K2Q9XAB', '1 · registro, pago y «Abrir conversación» con el código');
  ok(X.TV_CANDIDATA_ === null, '1 · la candidata se usa una vez');
  const api = X.vozTarjetaApi_({ email: 'juan@spacioam.com' }, { conv_id: 'conv-app' });
  ok(api.ok && api.tarjeta && api.tarjeta.clave === 'reserva:HM4K2Q9XAB', '1 · la acción vozTarjeta la devuelve a la app');
  const sin = X.tvCerrar_('conv-app', true, false);
  ok(sin === null && !cache['voztarjeta_conv-app'], '1 · un turno sin candidata borra la tarjeta anterior (la app no la vuelve a pedir)');
}

/* 2 · una lista no es tarjeta */
{ const { X, cache } = caja();
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
  X.tvCandidata_(null);
  ok(X.tvCerrar_('conv-app', true, false) === null && !cache['voztarjeta_conv-app'], '2 · una lista después de un resultado: no hay tarjeta');
  const src = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8');
  ok(/hits\.length === 1 && outR\.reservas\.length === 1\) tvCandidata_\('reserva'/.test(src) && /else if \(hits\.length > 1\) tvCandidata_\(null\)/.test(src), '2 · buscar_reservas: solo con un resultado; con varios, borra la candidata');
}

/* 3 · nunca lo mismo dos veces */
{ const { X, cache } = caja();
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, [])); X.tvCerrar_('conv-app', true, false);
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, [])); const otra = X.tvCerrar_('conv-app', true, false);
  ok(otra === null && !cache['voztarjeta_conv-app'], '3 · la misma reserva en la misma llamada no vuelve a salir');
  X.tvCandidata_('apartamento', () => X.tvApartamento_('Z10 - Brunelo - 1203', {}, {}));
  ok(!!X.tvCerrar_('conv-app', true, false), '3 · otra cosa sí sale (y reemplaza a la anterior)');
}

/* 4 · la familia nunca; la acción es solo del administrador de esa llamada */
{ const { X, cache } = caja();
  X.AGENTE_PERMITIDAS_ = ['proyectos_personales', 'ver_conversacion_personal'];
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
  ok(X.tvCerrar_('conv-app', true, false) === null && !cache['voztarjeta_conv-app'], '4 · con las herramientas de la familia no hay tarjeta');
  X.AGENTE_PERMITIDAS_ = null;
  cache['voztarjeta_conv-app'] = JSON.stringify({ clave: 'x' });
  ok(!X.vozTarjetaApi_(null, { conv_id: 'conv-app' }).ok && !X.vozTarjetaApi_({ email: 'mama@ejemplo.com' }, { conv_id: 'conv-app' }).ok, '4 · vozTarjeta sin sesión de administrador: nada');
  ok(!X.vozTarjetaApi_({ email: 'juan@spacioam.com' }, { conv_id: 'conv-otro' }).ok, '4 · vozTarjeta de una llamada de otra persona: nada');
  const src = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8'), fam = src.slice(src.indexOf('function vozFamilia_'), src.indexOf('function vozFamilia_') + 2500);
  ok(fam.indexOf('tvCerrar_') < 0 && src.indexOf('if (qf.tipo === \'familia\') return vozFamilia_') > 0, '4 · vozFamilia_ no cierra tarjetas');
}

/* 5 · solo la app; bloqueada o en conferencia, solo el chat */
{ const { X, cache } = caja();
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
  ok(X.tvCerrar_('conv-tel', false, false) === null && !Object.keys(cache).some((k) => /^voztarjeta_/.test(k)), '5 · una llamada por teléfono (sin vozapp_): ni voztarjeta_ ni columna');
  cache['vozpant_conv-app'] = '0';
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
  const b = X.tvCerrar_('conv-app', true, false);
  ok(b && !b.visible && !b.voz && !cache['voztarjeta_conv-app'] && JSON.parse(b.celda).id === 'HM4K2Q9XAB', '5 · pantalla bloqueada: queda en el chat (columna), sin mostrarla ni «EN PANTALLA»');
  delete cache['vozpant_conv-app'];
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
  const c = X.tvCerrar_('conv-app', true, true);
  ok(c && !c.visible && !c.voz && !cache['voztarjeta_conv-app'], '5 · modo conferencia: tampoco se muestra');
  X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
  ok(!!X.tvCerrar_('conv-app', true, false).visible, '5 · lo que no se vio bloqueado sí sale al volver a la pantalla');
  ok(X.tvLineaChat_(b.celda) === 'Tarjeta de la llamada · reserva de Mariana López (HM4K2Q9XAB)', '5 · la línea del chat junto a la llamada (el código se vuelve «Ver reserva ›»)');
  const m = X.tvConLinea_({ texto: 'Mariana llega el viernes.', tarjeta: b.celda });
  ok(/\n\nTarjeta de la llamada · reserva de Mariana López \(HM4K2Q9XAB\)$/.test(m.texto), '5 · tvConLinea_ la agrega al mensaje de esa llamada');
  X.vozPantallaApi_({ email: 'juan@spacioam.com' }, { conv_id: 'conv-app', visible: false });
  ok(cache['vozpant_conv-app'] === '0', '5 · vozPantalla guarda que la pantalla no se ve');
}

/* 6 · conversación y apartamento */
{ const hilo = [
    { tipo: 'host', texto: 'Bienvenida', created: '2026-11-03T15:00:00Z' },
    { tipo: 'guest', texto: '¿Podemos llegar a las 11 de la mañana?', created: '2026-11-04T15:42:00Z' },
    { tipo: 'host', auto: true, texto: 'Mensaje automático', created: '2026-11-04T15:43:00Z' },
    { tipo: 'host', texto: 'Déjame confirmarlo con el equipo.', created: '2026-11-04T15:44:00Z' }];
  const { X } = caja();
  const cv = X.tvConversacion_('r-1', hilo, [{ que: 'Confirmar early check-in', vence: 'hoy 18:00' }], INBOX);
  ok(cv.mensajes.length === 3 && cv.mensajes[0].de === 'huesped' && cv.mensajes[0].quien === 'Mariana' && cv.mensajes[0].hora === 'hoy 9:42', '6 · conversación: los últimos 3 mensajes, con quién y la hora');
  ok(cv.promesas[0] === 'Confirmar early check-in · vence hoy 18:00' && cv.conv === 'HM4K2Q9XAB', '6 · conversación: promesas abiertas y «Abrir conversación»');
  const est = [{ propiedad: 'Z10 - Brunelo - 1203', checkin: '2026-11-06', checkout: '2026-11-09', tipo: 'reserva' }, { propiedad: 'Z10 - Brunelo - 1203', checkin: '2026-11-04', checkout: '2026-11-05', tipo: 'consulta' }];
  const c2 = caja(); c2.cache['calp_base_' + HOY] = JSON.stringify({ estadias: est });
  c2.cache['calpb_z10brunelo1203'] = JSON.stringify({ d: [['2026-11-10', 0, 'B', 0, 0]] });
  c2.cache['calp_catalogo'] = JSON.stringify([{ id: '1', nombre: 'Z10 - Brunelo - 1203', canales: ['airbnb'], foto: 'https://fotos.example/b.jpg' }]);
  const j = { wifiPass: 'Brunelo2026', doorCode: '4821', std: { es: { parking: 'Parqueo 2, sótano 1', arrivalIntro: 'Edificio Brunelo, 5a avenida. El código de la puerta es 4821.' } } };
  const plano = { wifiPass: 'Brunelo2026', doorCode: '4821', bedrooms: '2', 'std.es.parking': 'Parqueo 2, sótano 1', porteria: 'Portería 24 h', lockNote: 'Cerradura: clave 4821' };
  const ap = c2.X.tvApartamento_('Z10 - Brunelo - 1203', j, plano), todo = [ap.etiqueta, ap.titulo, ap.sub, ap.foto].concat(ap.datos, ap.detalle).join(' | ');
  ok(ap.titulo === 'Brunelo 1203' && ap.sub === 'Z10 · Brunelo' && ap.foto === 'https://fotos.example/b.jpg', '6 · apartamento: zona, edificio y la foto del anuncio (del catálogo guardado)');
  ok(ap.datos.join(' | ') === '2 habitaciones | Parqueo: Parqueo 2, sótano 1 | Portería: Portería 24 h', '6 · apartamento: cuartos, parqueo y portería: ' + ap.datos.join(' | '));
  ok(!/4821|Brunelo2026|c[oó]digo|clave|wifi/i.test(todo), '6 · apartamento: nunca códigos, claves ni wifi');
  ok(ap.semana.map((d) => d.e).join(',') === 'con,libre,res,res,res,libre,bloq' && ap.semana[0].hoy && ap.semana[0].letra === 'M' && ap.semana[0].n === 4,
    '6 · la semana: consulta, libre, reservado, bloqueado (colores del glosario): ' + ap.semana.map((d) => d.letra + d.n + ':' + d.e).join(' '));
}

/* 7 · las candidatas salen de agEjecutar_ */
{ const src = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8'), f = src.slice(src.indexOf('function agEjecutar_'));
  ok(/tvCandidata_\('conversacion'/.test(f) && /tvCandidata_\('apartamento'/.test(f) && /tvCandidata_\('reserva'/.test(f), '7 · agEjecutar_ deja las tres candidatas');
  const voz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8');
  ok(/tvCerrar_\(b\.conv_id, esApp, conf\)/.test(voz) && /opGuardar_\(adm, 'alma', 'llamada', r\.respuesta, r\.hechas, turno\.clas, tv \? tv\.celda : ''\)/.test(voz), '7 · vozSecretaria_ cierra la tarjeta y la guarda en la fila de la llamada');
}

process.exit(fallo);
