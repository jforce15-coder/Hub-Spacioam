/* Prueba de la tarjeta de la llamada (apps-script/tarjeta.js, #446 T2) con dobles: sin Google, sin Hospitable y sin IA.
   1. Una candidata se vuelve tarjeta: se guarda en voztarjeta_<conv_id> 10 min y la voz recibe «EN PANTALLA».
   2. Una lista no es tarjeta (y borra la candidata de antes).
   3. Lo mismo no vuelve a salir en la misma llamada.
   4. La familia nunca la ve (herramientas personales) y la acción vozTarjeta es solo del administrador de esa llamada.
   5. voztarjeta_ solo para las llamadas de la app (vozapp_); con la pantalla bloqueada o en conferencia queda solo en
      el chat (columna tarjeta), sin «EN PANTALLA».
   6. Las tres tarjetas: reserva, conversación y apartamento (sin códigos, con la semana del calendario y sus colores).
   7. agEjecutar_ deja la candidata en buscar_reservas (un resultado), ver_conversacion y ver_propiedad.
   8. Tablero bento de la reserva (#508 T1): los cuadros esperados con la reserva completa; sin pago, sin mensaje por
      responder, sin foto o sin mapa, ese cuadro no va y los demás crecen (el acomodo de alma/inicio.html); nunca códigos
      ni claves; la app vieja sigue con los campos de siempre y la nueva, sin cuadros, pinta la tarjeta de siempre.
   9. Tablero bento del apartamento y del edificio (#508 T2): el apartamento completo (foto real con la del huésped de hoy,
      quién está, próxima llegada y salida con sus fotos, semana, galería, pendientes, mapa, recepción y ficha); sin foto ni
      coordenadas; el edificio («Brunelo» o varias opciones del mismo edificio): foto, apartamentos, llegadas y salidas de hoy
      y mapa; nunca códigos, claves, wifi ni teléfonos; la app vieja sigue con sus campos y pinta la foto del edificio.
  10. Por estado, conferencia y fotos (#508 T3): con la app nueva (tablero «estado») el tablero no se va por tiempo, se
      reemplaza con otra cosa, vuelve a algo ya visto y lo mismo que ya está no se rearma; al terminar la llamada espera
      ~3 s y se va (la página, con un DOM de mentira); en conferencia sale solo con la pantalla encendida; la galería y la
      foto principal salen de las fotos del anuncio guardadas (sin llamar a Hospitable) y nada nuevo filtra códigos ni
      teléfonos.
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
    hubPromesas_: o.promesas ? () => ({ ok: true, promesas: o.promesas }) : undefined,
    vozWebAdmin_: (ses) => (ses && ses.email === 'juan@spacioam.com' ? { email: ses.email, tels: ['50255550101'], principal: true } : null),
    vozWebTel_: (conv) => (conv === 'conv-app' || conv === 'conv-hub' ? '50255550101' : conv === 'conv-otro' ? '50255559999' : ''),
    adminPorTel_: (tel) => (String(tel).slice(-8) === '55550101' ? { email: 'juan@spacioam.com', tels: ['50255550101'], principal: true } : null),
    AGENTE_CANAL_: o.canal === undefined ? 'llamada' : o.canal,
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
  ok(/hits\.length === 1 && outR\.reservas\.length === 1 && !cons\.length\) tvCandidata_\('reserva'/.test(src) && /else if \(hits\.length \+ cons\.length > 1\) tvCandidata_\(null\)/.test(src), '2 · buscar_reservas: solo con un resultado; con varios (reservas o consultas), borra la candidata');
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
  ok(c && !c.visible && !c.voz && !cache['voztarjeta_conv-app'], '5 · modo conferencia sin el aviso de pantalla encendida (la app de antes): tampoco se muestra');
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

/* 8 · tablero bento de la reserva */
{ const CAT = JSON.stringify([{ id: '1', nombre: 'Z10 - Brunelo - 1203', canales: ['airbnb'], foto: 'https://fotos.example/b.jpg', lat: 14.596123, lng: -90.510234 }]);
  const IB = { conv_id: 'r-1', codigo: 'HM4K2Q9XAB', huesped: 'Mariana López', foto: 'https://fotos.example/m.jpg', ultimo_de: 'guest', ultimo_texto: '¿Podemos llegar a las 11?',
    ultimo_ts: '2026-11-04T15:42:00Z', ultimo_guest_ts: '2026-11-04T15:42:00Z', promesa: 'Confirmar early check-in', promesa_estado: 'abierta', promesa_vence: 'hoy 18:00' };
  const arma = (cache, fila, item, ib) => { const c = caja(); Object.assign(c.cache, cache || {}); return c.X.tvReserva_(fila || FILA, item || ITEM, ib ? [ib] : []); };
  const ids = (t) => t.cuadros.map((c) => c.id).join(',');
  const de = (t, id) => t.cuadros.filter((c) => c.id === id)[0];
  const t = arma({ calp_catalogo: CAT }, null, null, IB);
  ok(ids(t) === 'foto,fechas,huespedes,pago,responder,mapa,resumen', '8 · reserva completa: foto, fechas, huéspedes, total, necesita respuesta, mapa y resumen: ' + ids(t));
  ok(t.cabeza === 'Reserva de Mariana López' && t.cuadros.every((c) => c.tipo && c.tam && c.prioridad), '8 · cada cuadro trae tipo, tamaño y prioridad; arriba «Reserva de …»');
  const f = de(t, 'foto');
  ok(f.tam === 'alto' && f.fondo === 'https://fotos.example/b.jpg' && f.avatar === 'https://fotos.example/m.jpg' && f.iniciales === 'ML' && f.chip === 'Confirmada', '8 · foto alta del apartamento con la foto del huésped encima');
  ok(de(t, 'fechas').v === '6 → 9 nov' && de(t, 'huespedes').v === '2 · 3' && de(t, 'pago').v === 'US$ 312', '8 · fechas, huéspedes · noches y total: ' + de(t, 'fechas').v);
  ok(de(t, 'responder').texto === '«¿Podemos llegar a las 11?»' && de(t, 'responder').chip === 'hoy 9:42' && de(t, 'responder').tam === 'ancho', '8 · necesita respuesta: el último mensaje del huésped, a lo ancho');
  ok(de(t, 'mapa').lat === 14.59612 && de(t, 'mapa').lng === -90.51023, '8 · mapa con las coordenadas que ya estaban guardadas (redondeadas)');
  ok(/^Llega en 2 días\. Registro completo\. Promesa abierta: Confirmar early check-in \(vence hoy 18:00\)\.$/.test(de(t, 'resumen').texto), '8 · resumen breve: ' + de(t, 'resumen').texto);
  ok(t.titulo === 'Mariana López' && t.fechas.length === 3 && t.datos.indexOf('Registro completo') >= 0 && t.foto === 'https://fotos.example/m.jpg' && t.iniciales === 'ML' && t.conv === 'HM4K2Q9XAB',
    '8 · app vieja: los campos de siempre siguen iguales (titulo, fechas, datos, foto, conv)');
  const filaSin = Object.assign({}, FILA); delete filaSin.total;
  const s1 = arma({ calp_catalogo: CAT }, filaSin, null, IB);
  ok(!de(s1, 'pago') && ids(s1) === 'foto,fechas,huespedes,responder,mapa,resumen', '8 · sin pago: no hay cuadro de total');
  const s2 = arma({ calp_catalogo: CAT }, null, null, Object.assign({}, IB, { ultimo_de: 'host', ultimo_host_ts: '2026-11-04T15:50:00Z', ultimo_ts: '2026-11-04T15:50:00Z' }));
  ok(!de(s2, 'responder') && / Le respondimos hoy 9:50\.$/.test(de(s2, 'resumen').texto), '8 · ya le respondimos: sin «necesita respuesta» (el resumen lo dice)');
  const s3 = arma({ calp_catalogo: CAT }, null, null, Object.assign({}, IB, { no_requiere: '2026-11-04T15:42:00.000Z' }));
  ok(!de(s3, 'responder'), '8 · Alma revisó que no necesita respuesta: sin ese cuadro');
  const s4 = arma({}, null, null, { conv_id: 'r-1', codigo: 'HM4K2Q9XAB' });
  ok(de(s4, 'foto').tam === 'm' && !de(s4, 'foto').fondo && de(s4, 'foto').iniciales === 'ML' && !de(s4, 'mapa') && !de(s4, 'responder'), '8 · sin foto: degradado con las iniciales (cuadro más angosto); sin coordenadas, sin mapa');
  const s5 = arma({}, null, null, IB);
  ok(de(s5, 'foto').tam === 'alto' && de(s5, 'foto').fondo === 'https://fotos.example/m.jpg' && de(s5, 'foto').de === 'huesped' && !de(s5, 'foto').avatar, '8 · sin la del apartamento: la foto del huésped ocupa el cuadro');
  const s6 = arma({ dist_props: JSON.stringify([{ n: 'Z10 - Brunelo - 1203', lat: 14.6, lng: -90.5, dir: 'x' }]) });
  ok(de(s6, 'mapa') && de(s6, 'mapa').lat === 14.6, '8 · coordenadas de distancias si el catálogo no las trae (sin llamar a Hospitable)');
  const sc = arma({ calp_catalogo: CAT }, null, null, Object.assign({}, IB, { ultimo_texto: 'El código 4821 de la puerta no funciona', promesa: 'Mandar la clave del wifi Brunelo2026' }));
  const todo = JSON.stringify(sc.cuadros);
  ok(!/4821|Brunelo2026|wifi/i.test(todo) && /••••/.test(de(sc, 'responder').texto), '8 · nunca códigos ni claves: el número se tapa y la promesa con la clave no sale');
  const sx = arma({ calp_catalogo: CAT }, null, Object.assign({}, ITEM, { estado: 'cancelada', cancelada_el: '2026-11-02' }), IB);
  ok(!de(sx, 'responder') && de(sx, 'foto').chip === 'Cancelada' && de(sx, 'foto').tono === 'alerta' && /^Cancelada el lun 2 nov\./.test(de(sx, 'resumen').texto), '8 · cancelada: el chip lo dice y no pide respuesta');
  /* El acomodo de la app (alma/inicio.html): se corre el mismo código con los cuadros de arriba. */
  const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
  const i0 = html.indexOf('  function acomodar('), i1 = html.indexOf('    return filas;\n  }', i0);
  const acomodar = i0 > 0 && i1 > 0 ? vm.runInNewContext('(' + html.slice(i0, i1 + '    return filas;\n  }'.length).trim() + ')') : null;
  const forma = (fs) => fs.map((x) => x.hero ? 'hero[' + x.hero.id + ':' + x.cols + ':' + x.alto + '|' + x.pila.map((c) => c.id).join('+') + ']' : x.celdas.map((c) => c.id + ':' + x.span + 'x' + x.alto).join('+')).join(' / ');
  ok(!!acomodar, '8 · el acomodo vive en alma/inicio.html (function acomodar)');
  if (acomodar) {
    ok(forma(acomodar(t.cuadros)) === 'hero[foto:1fr 1fr:3|fechas+huespedes+pago] / responder:6x2 / mapa:3x2+resumen:3x2', '8 · completa: foto alta con 3 datos, respuesta a lo ancho, mapa y resumen: ' + forma(acomodar(t.cuadros)));
    ok(forma(acomodar(s1.cuadros)) === 'hero[foto:1fr 1fr:3|fechas+huespedes] / responder:6x2 / mapa:3x2+resumen:3x2', '8 · sin pago: los dos datos crecen junto a la foto');
    ok(forma(acomodar(s2.cuadros)) === 'hero[foto:1fr 1fr:3|fechas+huespedes+pago] / mapa:3x2+resumen:3x2', '8 · sin mensaje: mapa y resumen suben');
    ok(forma(acomodar(s4.cuadros)) === 'hero[foto:2fr 4fr:3|fechas+huespedes+pago] / resumen:6x1', '8 · sin foto ni mapa: la foto se angosta, los datos crecen y el resumen va a lo ancho: ' + forma(acomodar(s4.cuadros)));
    ok(forma(acomodar([{ id: 'foto', tipo: 'foto', tam: 'alto', prioridad: 1 }, { id: 'r', tipo: 'resumen', tam: 'm', prioridad: 6 }])) === 'hero[foto:1fr:3|] / r:6x1', '8 · solo foto: ocupa todo el ancho (como el prototipo con poca información)');
  }
  ok(/function esBento\(t\) \{ return !!\(t && Array\.isArray\(t\.cuadros\)/.test(html) && /else if \(abierta && !tapada\(\)\) \{\s*var u = ui\(\)/.test(html), '8 · app nueva con un Hub viejo (sin cuadros): pinta la tarjeta de siempre');
  const nav = fs.readFileSync(path.join(DIR, '..', 'js', 'sa-nav.js'), 'utf8');
  ok(/x: VW\(\) \* \(eo && eo\.x \|\| \.5\)/.test(nav) && /AL\.escO && typeof AL\.escO\.tocar === "function"/.test(nav), '8 · sa-nav: la roca va a la esquina (x) y tocarla en plena llamada avisa al tablero (tocar)');
}

/* 9 · tablero bento del apartamento y del edificio */
{ const AP = 'Z10 - Brunelo - 1203', AP2 = 'Z10 - Brunelo - 705', AP3 = 'Z10 - Brunelo - 902', OTRA = 'Z14 - Torre Demo - 804';
  const EST = [
    { propiedad: AP, checkin: '2026-11-02', checkout: '2026-11-06', huesped: 'Ana Prueba', tipo: 'reserva', codigo: 'HMPRUEBA01' },
    { propiedad: AP, checkin: '2026-11-08', checkout: '2026-11-10', huesped: 'Luis Ejemplo', tipo: 'reserva', codigo: 'HMPRUEBA02' },
    { propiedad: AP, checkin: '2026-11-11', checkout: '2026-11-12', huesped: 'Consulta X', tipo: 'consulta', conv: 'inq:1' },
    { propiedad: AP2, checkin: '2026-11-04', checkout: '2026-11-07', huesped: 'Eva Demo', tipo: 'reserva', codigo: 'HMPRUEBA03' },
    { propiedad: AP3, checkin: '2026-11-01', checkout: '2026-11-04', huesped: 'Tom Test', tipo: 'reserva', codigo: 'HMPRUEBA04' }];
  const INB = [{ codigo: 'HMPRUEBA01', foto: 'https://a0.muscache.example/ana.jpg' }, { codigo: 'HMPRUEBA02', foto: 'https://a0.muscache.example/luis.jpg' }, { codigo: 'HMPRUEBA03', foto: 'https://a0.muscache.example/eva.jpg' }];
  const CAT = [{ id: '1', nombre: AP, foto: 'https://fotos.example/b.jpg', lat: 14.596123, lng: -90.510234 }, { id: '2', nombre: AP2, foto: '', lat: 0, lng: 0 }];
  const PROM = [{ propiedad: AP, que: 'Confirmar parqueo extra', vence: 'hoy 18:00', estado: 'abierta' }, { propiedad: AP, que: 'Mandar la clave 4821 de la puerta', vence: '', estado: 'abierta' }, { propiedad: AP2, que: 'Otra cosa', estado: 'abierta' }];
  const SNAP = { tareas: [{ id: 't1', texto: 'Cambiar foco del baño', prop: 'Brunelo 1203', quien: 'Epi' }, { id: 't2', texto: 'Cambiar el código del wifi', prop: 'Brunelo 1203' }, { id: 't3', texto: 'Hecha', prop: 'Brunelo 1203', hecha: true }] };
  const RECEP = { '00000000': { n: '50200000000', prop: AP } };
  const J = { pictures: ['https://fotos.example/1.jpg', 'https://fotos.example/2.jpg', 'https://fotos.example/3.jpg', 'https://fotos.example/4.jpg'], wifiPass: 'Brunelo2026', doorCode: '4821', std: { es: { parking: 'Parqueo 2, sótano 1' } } };
  const PLANO = { bedrooms: '2', porteria: 'Portería 24 h, tel 5555-1234', wifiPass: 'Brunelo2026', doorCode: '4821', 'std.es.parking': 'Parqueo 2, sótano 1' };
  const llena = () => { const c = caja({ inbox: INB, promesas: PROM }); Object.assign(c.cache, { ['calp_base_' + HOY]: JSON.stringify({ estadias: EST }), calp_catalogo: JSON.stringify(CAT), episnap: JSON.stringify(SNAP), recep_nums: JSON.stringify(RECEP) }); return c; };
  const ids = (t) => t.cuadros.map((c) => c.id).join(',');
  const de = (t, id) => t.cuadros.filter((c) => c.id === id)[0];
  const sinClave = (t) => { const o = Object.assign({}, t); delete o.clave; return JSON.stringify(o); };   // «clave» es el nombre del campo, no una clave
  const SECRETO = /4821|Brunelo2026|5555|wifi|clave|c[oó]digo|contrase/i;
  const a = llena().X.tvApartamento_(AP, J, PLANO);
  ok(ids(a) === 'foto,hoy,llegada,salida,semana,galeria,pendientes,mapa,recepcion,ficha', '9 · apartamento completo: foto, hoy, llegada, salida, semana, galería, pendientes, mapa, recepción y ficha: ' + ids(a));
  ok(a.cabeza === 'Brunelo 1203' && a.sub === 'Z10 · Brunelo' && a.cuadros.every((c) => c.tipo && c.tam && c.prioridad), '9 · arriba el apartamento, abajo zona · edificio; cada cuadro con tipo, tamaño y prioridad');
  const f = de(a, 'foto');
  ok(f.tam === 'alto' && f.fondo === 'https://fotos.example/b.jpg' && !f.avatar && f.chip === 'Ocupado' && f.tono === 'info', '9 · la foto real del anuncio, entera (la del huésped va en su cuadro), y «Ocupado»');
  ok(de(a, 'hoy').v === 'Ana Prueba' && de(a, 'hoy').foto === 'https://a0.muscache.example/ana.jpg' && de(a, 'hoy').d === 'sale vie 6 nov · 4 noches', '9 · quién está hoy, con su foto: ' + de(a, 'hoy').d);
  ok(de(a, 'llegada').v === 'dom 8 nov' && de(a, 'llegada').foto === 'https://a0.muscache.example/luis.jpg' && de(a, 'llegada').d === 'Luis Ejemplo · 2 noches', '9 · próxima llegada con la foto del huésped (las consultas no cuentan)');
  ok(de(a, 'salida').k === 'Sale' && de(a, 'salida').v === 'vie 6 nov' && de(a, 'salida').d === 'Ana Prueba', '9 · próxima salida');
  ok(de(a, 'semana').dias.length === 7 && de(a, 'semana').dias[0].hoy && de(a, 'semana').d === '4 de 7 noches reservadas' && de(a, 'semana').dias.map((d) => d.e).join() === 'res,res,libre,libre,res,res,libre', '9 · la semana como mini calendario: ' + de(a, 'semana').dias.map((d) => d.e).join(','));
  ok(JSON.stringify(de(a, 'galeria').fotos) === JSON.stringify(['https://fotos.example/1.jpg', 'https://fotos.example/2.jpg', 'https://fotos.example/3.jpg']), '9 · galería: 3 fotos más que ya traía la herramienta');
  ok(de(a, 'pendientes').items.map((x) => x.t + ':' + x.v).join(' | ') === 'Promesa:Confirmar parqueo extra | Tarea:Cambiar foco del baño', '9 · pendientes: promesas y tareas abiertas de ese apartamento (sin las que hablan de claves): ' + de(a, 'pendientes').items.map((x) => x.v).join(' | '));
  ok(de(a, 'mapa').lat === 14.59612 && de(a, 'recepcion').v === 'Brunelo' && de(a, 'recepcion').d === 'Portería 24 h', '9 · mapa y recepción del edificio (solo el nombre): ' + de(a, 'recepcion').d);
  ok(de(a, 'ficha').texto === '2 habitaciones. Parqueo: Parqueo 2, sótano 1.', '9 · ficha: ' + de(a, 'ficha').texto);
  ok(!SECRETO.test(sinClave(a)), '9 · apartamento: nunca códigos, claves, wifi ni teléfonos (ni en los cuadros ni en los campos de siempre)');
  ok(a.titulo === 'Brunelo 1203' && a.foto === 'https://fotos.example/b.jpg' && a.semana.length === 7 && a.datos[0] === '2 habitaciones' && a.datos.indexOf('Portería: Portería 24 h') >= 0, '9 · app vieja: los campos de siempre siguen (titulo, foto, semana, datos)');
  /* sin foto ni coordenadas, y nadie en la semana */
  const c0 = caja(); c0.cache['calp_base_' + HOY] = JSON.stringify({ estadias: [] });
  const s = c0.X.tvApartamento_(OTRA, {}, { bedrooms: '1' });
  ok(ids(s) === 'foto,semana,ficha' && de(s, 'foto').tam === 'm' && !de(s, 'foto').fondo && de(s, 'foto').iniciales === '804' && de(s, 'foto').chip === 'Libre hoy' && de(s, 'foto').tono === 'libre',
    '9 · sin foto ni coordenadas: el número del apartamento sobre el degradado, «Libre hoy» en verde, sin mapa: ' + ids(s));
  ok(de(s, 'semana').d === 'Libre toda la semana', '9 · semana libre');
  const c1 = caja(); c1.cache['calp_base_' + HOY] = JSON.stringify({ estadias: [] });
  const s2 = c1.X.tvApartamento_(OTRA, { photos: [{ url: 'https://fotos.example/x1.jpg' }, { url: 'https://fotos.example/x2.jpg' }] }, {});
  ok(de(s2, 'foto').fondo === 'https://fotos.example/x1.jpg' && !de(s2, 'galeria') && s2.foto === 'https://fotos.example/x1.jpg', '9 · sin foto en el catálogo: la primera que trajo la herramienta; con una sola más, sin galería');
  /* edificio */
  const TODOS = [AP, AP2, AP3, OTRA];
  const X = llena().X;
  ok(X.tvEdificioDe_('Brunelo', [], TODOS) && X.tvEdificioDe_('edificio Brunelo', [], TODOS).props.length === 3 && X.tvEdificioDe_('Z10 Brunelo', [], TODOS), '9 · «Brunelo», «edificio Brunelo» y «Z10 Brunelo» son el edificio');
  ok(!X.tvEdificioDe_('Brunelo 1203', [], TODOS) && !X.tvEdificioDe_('Torre Demo', [], TODOS) && !X.tvEdificioDe_('', [AP, OTRA], TODOS), '9 · un apartamento, un edificio con uno solo u opciones de edificios distintos: no es edificio');
  ok(X.tvEdificioDe_('brunelo sin match', [AP2, AP3], TODOS).props.length === 3, '9 · varias opciones del mismo edificio: el edificio');
  const e = X.tvEdificio_(X.tvEdificioDe_('Brunelo', [], TODOS));
  ok(ids(e) === 'foto,apartamentos,llegadas,salidas,hoy,mapa,recepcion,resumen', '9 · edificio: foto, apartamentos, llegadas y salidas de hoy, quién, mapa, recepción y mañana: ' + ids(e));
  ok(e.tipo === 'edificio' && e.cabeza === 'Edificio Brunelo' && e.sub === 'Z10 · 3 apartamentos' && e.clave === 'edificio:z10brunelo', '9 · cabeza «Edificio Brunelo» y su clave');
  ok(de(e, 'foto').fondo === 'https://fotos.example/b.jpg' && de(e, 'foto').tam === 'alto', '9 · la foto del edificio es la primera propiedad con foto');
  ok(de(e, 'apartamentos').v === '3' && de(e, 'apartamentos').d === '2 ocupados esta noche' && de(e, 'llegadas').v === '1' && de(e, 'llegadas').d === '705' && de(e, 'salidas').v === '1' && de(e, 'salidas').d === '902',
    '9 · cuántos apartamentos, ocupados, llegadas y salidas de hoy');
  ok(de(e, 'hoy').items.map((x) => x.t + ' ' + x.v + (x.foto ? ' [foto]' : '')).join(' | ') === 'Llega 705 · Eva Demo [foto] | Sale 902 · Tom Test', '9 · hoy en el edificio, con la foto de quien la tiene');
  ok(de(e, 'mapa').lugar === 'Z10 · Brunelo' && de(e, 'resumen').texto === 'Sin llegadas ni salidas.', '9 · mapa del edificio y mañana');
  ok(!SECRETO.test(sinClave(e)), '9 · edificio: nunca códigos, claves, wifi ni teléfonos');
  ok(e.titulo === 'Edificio Brunelo' && e.datos.join(' | ') === '3 apartamentos | 2 ocupados esta noche | 1 llegada hoy | 1 salida hoy', '9 · app vieja: el edificio trae los campos de siempre: ' + e.datos.join(' | '));
  ok(X.tvLineaChat_(JSON.stringify({ tipo: 'edificio', id: 'Brunelo', titulo: 'Edificio Brunelo' })) === 'Tarjeta de la llamada · edificio Edificio Brunelo', '9 · la línea del chat junto a la llamada');
  const es = caja(); es.cache['calp_base_' + HOY] = JSON.stringify({ estadias: [] });
  const e0 = es.X.tvEdificio_(es.X.tvEdificioDe_('Brunelo', [], TODOS));
  ok(ids(e0) === 'foto,apartamentos,llegadas,salidas,resumen' && de(e0, 'foto').tam === 'm' && de(e0, 'llegadas').v === 'Ninguna', '9 · edificio sin fotos, sin coordenadas y sin movimiento: ' + ids(e0));
  ok(X.tvSinTel_('Lobby (+502 5555 1234) 24h') === 'Lobby 24h' && X.tvSinTel_('Recepción WhatsApp: 55551234') === 'Recepción' && X.tvSinTel_('Nivel 3, apto 1203') === 'Nivel 3, apto 1203', '9 · los teléfonos se quitan y los números cortos quedan');
  /* agEjecutar_ deja la candidata del edificio sin cambiar lo que devuelve ver_propiedad */
  const src = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8'), vp = src.slice(src.indexOf("case 'ver_propiedad'"), src.indexOf("case 'codigo_acceso'"));
  ok(/edifP = exactaP \? null : tvEdificioDe_\(inp\.propiedad, \[\], todasP\)/.test(vp) && /if \(edifP\) tvCandidata_\('edificio'/.test(vp) && /return \{ propiedad: hitP\.property_name, campos: plano \};/.test(vp) && /return \{ error: 'No encontré esa propiedad exacta\.', opciones: opP \};/.test(vp),
    '9 · ver_propiedad deja la candidata del edificio y devuelve lo mismo de antes');
  /* el acomodo de la app */
  const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
  const i0 = html.indexOf('  function acomodar('), i1 = html.indexOf('    return filas;\n  }', i0);
  const acomodar = vm.runInNewContext('(' + html.slice(i0, i1 + '    return filas;\n  }'.length).trim() + ')');
  const forma = (fs) => fs.map((x) => x.hero ? 'hero[' + x.hero.id + ':' + x.cols + ':' + x.alto + '|' + x.pila.map((c) => c.id).join('+') + ']' : x.celdas.map((c) => c.id + ':' + x.span + 'x' + x.alto).join('+')).join(' / ');
  ok(forma(acomodar(a.cuadros)) === 'hero[foto:1fr 1fr:3|hoy+llegada+salida] / semana:6x1 / galeria:6x2 / pendientes:6x1 / mapa:3x2+recepcion:3x2 / ficha:6x1', '9 · apartamento: ' + forma(acomodar(a.cuadros)));
  ok(forma(acomodar(s.cuadros)) === 'hero[foto:1fr:2|] / semana:6x1 / ficha:6x1', '9 · apartamento con poco: la foto a lo ancho: ' + forma(acomodar(s.cuadros)));
  ok(forma(acomodar(e.cuadros)) === 'hero[foto:1fr 1fr:3|apartamentos+llegadas+salidas] / hoy:6x1 / mapa:3x2+recepcion:3x2 / resumen:6x1', '9 · edificio: ' + forma(acomodar(e.cuadros)));
  ok(/c\.tipo === "semana"/.test(html) && /c\.tipo === "lista"/.test(html) && /c\.tipo === "galeria"/.test(html), '9 · la app pinta semana, lista y galería');
  ok(/\(t\.tipo === "apartamento" \|\| t\.tipo === "edificio"\) && t\.foto/.test(html), '9 · la tarjeta de siempre pinta la foto del edificio como la del apartamento');
}

/* 10 · por estado, conferencia y fotos (#508 T3) */
{ const AP = 'Z10 - Brunelo - 1203', AP2 = 'Z10 - Brunelo - 705', AP3 = 'Z10 - Brunelo - 902';
  const voz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8'), vin = voz.slice(voz.indexOf('function vozWebVincular_'), voz.indexOf('function vozWebVincular_') + 2600);
  ok(/b\.pantalla === true[^\n]*put\('vozpant_' \+ convId, '1'/.test(vin) && /b\.tablero === 'estado'\) CacheService\.getScriptCache\(\)\.put\('voztvest_' \+ convId, '1'/.test(vin),
    '10 · vozWebVincular_ guarda la pantalla encendida («1») y que la app maneja el tablero por estado');
  ok(/AGENTE_CANAL_ !== 'llamada'/.test(fs.readFileSync(path.join(DIR, 'tarjeta.js'), 'utf8')) && /opAgente_\(adm, pedido, 'llamada'/.test(voz) && /return vozSecEncolar_\(tel, pedido, conf\)/.test(voz),
    '10 · la conferencia pasa por la misma secretaria (canal «llamada»); en segundo plano nunca hay tarjeta');
  /* estado: la app nueva */
  { const { X, cache } = caja();
    cache['voztvest_conv-app'] = '1';
    X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, [])); const a = X.tvCerrar_('conv-app', true, false);
    const id1 = JSON.parse(cache['voztarjeta_conv-app']).id;
    ok(a && a.visible && JSON.parse(cache['voztv_actual_conv-app']).clave === 'reserva:HM4K2Q9XAB', '10 · estado: la reserva queda como lo que está en pantalla');
    const sin = X.tvCerrar_('conv-app', true, false);
    ok(sin === null && !cache['voztarjeta_conv-app'] && JSON.parse(cache['voztv_actual_conv-app']).id === id1, '10 · un turno sin tarjeta (otra pregunta, una lista) no la quita: la app la deja en pantalla');
    X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, [])); const b = X.tvCerrar_('conv-app', true, false);
    ok(b && b.visible && /^EN PANTALLA: /.test(b.voz) && JSON.parse(cache['voztarjeta_conv-app']).id === id1, '10 · la misma que ya está en pantalla: mismo id (no se rearma) y la voz sabe que se ve');
    X.tvCandidata_('apartamento', () => X.tvApartamento_(AP, {}, {})); const c = X.tvCerrar_('conv-app', true, false);
    const id2 = JSON.parse(cache['voztarjeta_conv-app']).id;
    ok(c && c.visible && c.tarjeta.tipo === 'apartamento' && id2 !== id1, '10 · otra cosa en la misma llamada la reemplaza (otro id)');
    X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, [])); const d = X.tvCerrar_('conv-app', true, false);
    ok(d && d.visible && d.tarjeta.tipo === 'reserva' && d.tarjeta.id !== id1 && d.tarjeta.id !== id2, '10 · volver a la reserva después del apartamento la muestra otra vez');
  }
  /* conferencia: solo con la pantalla encendida */
  { const { X, cache } = caja();
    cache['voztvest_conv-app'] = '1'; cache['vozpant_conv-app'] = '1';
    X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, [])); const a = X.tvCerrar_('conv-app', true, true);
    ok(a && a.visible && /^EN PANTALLA: /.test(a.voz) && cache['voztarjeta_conv-app'], '10 · conferencia con la pantalla encendida: el tablero sale y Alma no lee los datos');
    X.vozPantallaApi_({ email: 'juan@spacioam.com' }, { conv_id: 'conv-app', visible: false });
    X.tvCandidata_('apartamento', () => X.tvApartamento_(AP, {}, {})); const b = X.tvCerrar_('conv-app', true, true);
    ok(b && !b.visible && !b.voz && !cache['voztarjeta_conv-app'] && JSON.parse(b.celda).tipo === 'apartamento', '10 · conferencia con el teléfono bloqueado: queda en el chat como hoy');
    delete cache['vozpant_conv-app'];
    X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
    ok(!X.tvCerrar_('conv-app', true, true).visible, '10 · conferencia sin aviso de la app (la de antes): no sale');
    cache['vozpant_conv-app'] = '1';
    X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
    ok(X.tvCerrar_('conv-tel', false, true) === null, '10 · conferencia en una llamada que no es de la app: nada');
    X.AGENTE_PERMITIDAS_ = ['proyectos_personales'];
    X.tvCandidata_('reserva', () => X.tvReserva_(FILA, ITEM, []));
    ok(X.tvCerrar_('conv-app', true, true) === null, '10 · conferencia con la familia: nunca');
    X.AGENTE_PERMITIDAS_ = null;
    const w = caja({ canal: 'whatsapp' }); w.cache['vozpant_conv-app'] = '1';
    w.X.tvCandidata_('reserva', () => w.X.tvReserva_(FILA, ITEM, []));
    ok(w.X.tvCerrar_('conv-app', true, true) === null, '10 · fuera de la llamada (WhatsApp, chat): nunca');
  }
  /* fotos guardadas: galería y foto principal sin llamar a Hospitable */
  { const fu = fs.readFileSync(path.join(DIR, 'fuentes.js'), 'utf8'), fa = fu.slice(fu.indexOf('function fuentesFotosAnuncio_'), fu.indexOf('function fuentesMismaProp_'));
    ok(/hosp_\('get', '\/properties\/' \+ propId \+ '\/images'\)/.test(fa) && /tvGuardarFotos_\(propId, orden\)/.test(fa), '10 · fuentes.js guarda las fotos del anuncio cuando ya las pide (sin llamadas nuevas)');
    const tj = fs.readFileSync(path.join(DIR, 'tarjeta.js'), 'utf8');
    ok(!/hosp_\(|UrlFetchApp|uf_\(/.test(tj), '10 · tarjeta.js no llama a Hospitable ni a internet');
    const CAT = [{ id: 'p1', nombre: AP, foto: '', lat: 14.596, lng: -90.51 }, { id: 'p2', nombre: AP2, foto: 'https://fotos.example/705.jpg' }, { id: 'p3', nombre: AP3, foto: 'https://fotos.example/902.jpg' }];
    const IMGS = [{ url: 'https://fotos.example/g1.jpg', thumbnail_url: 'https://fotos.example/g1-t.jpg', order: 1, caption: 'Código 4821 de la puerta' },
      { url: 'http://inseguro.example/g2.jpg', order: 2 }, { url: 'javascript:alert(1)', order: 3 },
      { url: 'https://fotos.example/g3.jpg', thumbnail_url: 'https://fotos.example/g3-t.jpg', order: 4 }, { url: 'https://fotos.example/g4.jpg', order: 5 },
      { url: 'https://fotos.example/g5.jpg', order: 6 }];
    const arma = () => { const c = caja(); c.cache.calp_catalogo = JSON.stringify(CAT); c.cache['calp_base_' + HOY] = JSON.stringify({ estadias: [] }); return c; };
    const c0 = arma(); c0.X.tvGuardarFotos_('p1', IMGS);
    const guard = JSON.parse(c0.cache.calp_fotos_p1);
    ok(guard.length === 4 && guard.every((f) => /^https:\/\//.test(f.u) && /^https:\/\//.test(f.t)) && !/4821|caption|javascript|http:/.test(c0.cache.calp_fotos_p1), '10 · se guardan solo direcciones https (ni textos de las fotos, ni http, ni javascript)');
    ok(c0.puestos.some((p) => p.k === 'calp_fotos_p1' && p.s === 21600), '10 · las fotos guardadas duran 6 h (como el catálogo)');
    const ap = c0.X.tvApartamento_(AP, {}, {}), de = (t, id) => t.cuadros.filter((x) => x.id === id)[0];
    ok(ap.foto === 'https://fotos.example/g1.jpg' && de(ap, 'foto').fondo === 'https://fotos.example/g1.jpg' && de(ap, 'foto').tam === 'alto', '10 · sin picture en el catálogo: la primera foto guardada es la principal');
    ok(JSON.stringify(de(ap, 'galeria').fotos) === JSON.stringify(['https://fotos.example/g3-t.jpg', 'https://fotos.example/g4.jpg', 'https://fotos.example/g5.jpg']), '10 · galería del apartamento: 3 fotos guardadas (miniaturas), sin repetir la principal');
    const re = c0.X.tvReserva_(Object.assign({}, FILA), ITEM, []);
    ok(de(re, 'foto').fondo === 'https://fotos.example/g1.jpg' && de(re, 'galeria') && de(re, 'galeria').fotos.length === 3 && de(re, 'galeria').prioridad === 4, '10 · la reserva también trae la foto y la galería del apartamento');
    const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
    const i0 = html.indexOf('  function acomodar('), i1 = html.indexOf('    return filas;\n  }', i0);
    const acomodar = vm.runInNewContext('(' + html.slice(i0, i1 + '    return filas;\n  }'.length).trim() + ')');
    const forma = (f) => f.map((x) => x.hero ? 'hero[' + x.hero.id + '|' + x.pila.map((c) => c.id).join('+') + ']' : x.celdas.map((c) => c.id + ':' + x.span + 'x' + x.alto).join('+')).join(' / ');
    ok(forma(acomodar(re.cuadros)) === 'hero[foto|fechas+huespedes+pago] / galeria:6x2 / mapa:3x2+resumen:3x2', '10 · reserva con galería: ' + forma(acomodar(re.cuadros)));
    const ed = c0.X.tvEdificio_(c0.X.tvEdificioDe_('Brunelo', [], [AP, AP2, AP3]));
    ok(de(ed, 'galeria') && JSON.stringify(de(ed, 'galeria').fotos) === JSON.stringify(['https://fotos.example/705.jpg', 'https://fotos.example/902.jpg']), '10 · edificio: galería con las fotos de sus otros apartamentos');
    const c1 = arma(); const ap1 = c1.X.tvApartamento_(AP, {}, {});
    ok(!de(ap1, 'galeria') && !ap1.foto && de(ap1, 'foto').tam === 'm', '10 · sin fotos guardadas ni en la herramienta: sin galería y el número sobre el degradado');
    const c2 = arma(); c2.X.tvGuardarFotos_('p1', IMGS.slice(0, 1));
    const ap2 = c2.X.tvApartamento_(AP, { pictures: ['https://fotos.example/h1.jpg', 'https://fotos.example/h2.jpg'] }, {});
    ok(ap2.foto === 'https://fotos.example/g1.jpg' && JSON.stringify(de(ap2, 'galeria').fotos) === JSON.stringify(['https://fotos.example/h1.jpg', 'https://fotos.example/h2.jpg']), '10 · si las guardadas no alcanzan, completa con las que trajo la herramienta');
    const SECRETO = /4821|Brunelo2026|5555|wifi|clave|c[oó]digo|contrase/i, sinClave = (t) => { const o = Object.assign({}, t); delete o.clave; return JSON.stringify(o); };
    ok(!SECRETO.test(sinClave(ap)) && !SECRETO.test(sinClave(re)) && !SECRETO.test(sinClave(ed)), '10 · nada nuevo filtra códigos, claves, wifi ni teléfonos');
  }
  /* la página: el tablero no se va por tiempo, se reemplaza con un fundido y al terminar espera ~3 s (DOM de mentira) */
  { const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
    const i0 = html.indexOf('  window.AlmaTarjeta = {'), s0 = html.lastIndexOf('<script>', i0), s1 = html.indexOf('</script>', i0);
    const codigo = html.slice(s0 + '<script>'.length, s1);
    const v0 = html.indexOf('  function vozNativaEvento(e) {'), v1 = html.indexOf('  window.AlmaVoz = {', v0);
    let reloj = 0, timers = [], idT = 0, mandado = [], escena = [];
    const setT = (fn, ms, rep) => { const t = { id: ++idT, fn, at: reloj + (ms || 0), ms: ms || 0, rep }; timers.push(t); return t.id; };
    const clearT = (id) => { timers = timers.filter((t) => t.id !== id); };
    const avanza = (ms) => { const fin = reloj + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > fin) break; reloj = t.at; if (t.rep) t.at += Math.max(1, t.ms); else timers.shift(); t.fn(); } reloj = fin; };
    class Cls { constructor(e) { this.e = e; } _l() { return this.e.className.split(/\s+/).filter(Boolean); } add(...c) { const l = this._l(); c.forEach((x) => { if (l.indexOf(x) < 0) l.push(x); }); this.e.className = l.join(' '); } remove(...c) { this.e.className = this._l().filter((x) => c.indexOf(x) < 0).join(' '); } contains(c) { return this._l().indexOf(c) >= 0; } toggle(c, on) { if (on === undefined) on = !this.contains(c); if (on) this.add(c); else this.remove(c); return on; } }
    class El {
      constructor(tag) { this.tagName = String(tag).toUpperCase(); this.className = ''; this.children = []; this.parentNode = null; this.attrs = {}; this._txt = ''; this.classList = new Cls(this); this.style = { setProperty() {} }; this.hidden = false; }
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
      insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
      removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
      get firstChild() { return this.children[0] || null; } get nextSibling() { if (!this.parentNode) return null; const l = this.parentNode.children; return l[l.indexOf(this) + 1] || null; }
      setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
      set textContent(v) { this.children = []; this._txt = String(v); } get textContent() { return this._txt + this.children.map((c) => c.textContent).join(''); }
      set innerHTML(v) { this.children = []; this._txt = ''; } get innerHTML() { return ''; }
      addEventListener() {} getBoundingClientRect() { return { bottom: 60, top: 0, left: 0, width: 0, height: 0 }; }
      _match(sel) { return sel.split(',').some((one) => { const m = /^\.([\w-]+)(?:\[(\w+)=(\w+)\])?$/.exec(one.trim().split(/\s+/).pop()); return !!m && this.classList.contains(m[1]) && (!m[2] || this.attrs[m[2]] === m[3]); }); }
      querySelectorAll(sel) { const out = []; const rec = (n) => n.children.forEach((c) => { if (c._match && c._match(sel)) out.push(c); rec(c); }); rec(this); return out; }
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    }
    const txtNode = (t) => { const n = new El('#text'); n._txt = String(t); return n; };
    const body = new El('body'), raiz = new El('html'), ovEl = new El('div'); ovEl.className = 'san-ov on'; const bg = new El('div'); bg.className = 'san-ov-bg'; ovEl.appendChild(bg); body.appendChild(ovEl);
    const document = { body, documentElement: raiz, visibilityState: 'visible', createElement: (t) => new El(t), createTextNode: txtNode, getElementById: () => null,
      querySelector: (s) => body.querySelector(s), querySelectorAll: (s) => body.querySelectorAll(s) };
    const win = { addEventListener() {}, innerWidth: 390, innerHeight: 844, SANav: { escena: (o) => escena.push(o ? 's' + o.s : 'centro') } };
    const ctxW = { document, window: win, SANav: win.SANav, webkit: { messageHandlers: { alma: { postMessage: (m) => mandado.push(m.hacer || m.que) } } },
      setTimeout: (f, ms) => setT(f, ms), clearTimeout: clearT, setInterval: (f, ms) => setT(f, ms, true), clearInterval: clearT, requestAnimationFrame: (f) => setT(f, 16),
      console, JSON, Math, String, Number, Object, Array, RegExp, isFinite, Date };
    win.document = document; vm.createContext(ctxW);
    let errW = '';
    try { vm.runInContext(codigo, ctxW); } catch (e) { errW = e.message; }
    const AT = win.AlmaTarjeta;
    ok(!errW && AT && typeof AT.sostiene === 'function', '10 · la página arma AlmaTarjeta con sostiene()' + (errW ? ': ' + errW : ''));
    if (AT) {
      const T1 = { id: 'tv1', tipo: 'reserva', clave: 'reserva:A', titulo: 'Ana Prueba', cabeza: 'Reserva de Ana Prueba', cuadros: [{ id: 'foto', tipo: 'foto', tam: 'm', prioridad: 1, iniciales: 'AP' }, { id: 'fechas', tipo: 'dato', tam: 's', prioridad: 2, k: 'Fechas', v: '6 → 9 nov' }] };
      const T2 = { id: 'tv2', tipo: 'apartamento', clave: 'apartamento:b', titulo: 'Brunelo 1203', cabeza: 'Brunelo 1203', cuadros: [{ id: 'foto', tipo: 'foto', tam: 'm', prioridad: 1, iniciales: '1203' }] };
      const tableros = () => ovEl.children.filter((c) => c.classList.contains('tvb'));
      AT.evento({ tipo: 'tarjeta', vista: 'abierta', tarjeta: T1 }); avanza(100);
      ok(tableros().length === 1 && tableros()[0].classList.contains('on') && raiz.classList.contains('tvb-on') && escena.pop() === 's74', '10 · página: el tablero entra y Alma va a la esquina');
      avanza(5 * 60e3);
      ok(tableros().length === 1 && tableros()[0].classList.contains('on') && raiz.classList.contains('tvb-on'), '10 · página: 5 minutos después sigue ahí (no se va por tiempo)');
      AT.evento({ tipo: 'tarjeta', vista: 'abierta', tarjeta: T2 }); avanza(100);
      const l = tableros();
      ok(l.length === 2 && l.some((c) => c.classList.contains('sale')) && !l.some((c) => c.classList.contains('on')), '10 · página: otra tarjeta: el tablero de antes se funde y el nuevo espera');
      avanza(400);
      ok(tableros().length === 1 && tableros()[0].classList.contains('on') && /Brunelo 1203/.test(tableros()[0].textContent), '10 · página: … y entra el nuevo (transición suave entre tableros)');
      AT.evento({ tipo: 'tarjeta', vista: 'nada', tarjeta: null }); AT.evento({ tipo: 'estado', estado: 'apagada' });
      avanza(2900);
      ok(tableros().length === 1 && AT.sostiene() && raiz.classList.contains('tvb-on'), '10 · página: la llamada terminó: el tablero se queda ~3 s');
      avanza(500);
      ok(tableros().length === 0 && !AT.sostiene() && !raiz.classList.contains('tvb-on') && escena.pop() === 'centro', '10 · página: … y vuelve a la pantalla de inicio');
      AT.evento({ tipo: 'tarjeta', vista: 'abierta', tarjeta: T1 }); avanza(100);
      AT.evento({ tipo: 'tarjeta', vista: 'nada', tarjeta: null }); avanza(1000);
      AT.evento({ tipo: 'tarjeta', vista: 'abierta', tarjeta: T2 }); avanza(5000);
      ok(tableros().length === 1 && /Brunelo 1203/.test(tableros()[0].textContent), '10 · página: si llega otra tarjeta mientras espera, se queda la nueva');
      /* La llamada de la roca espera al tablero antes de cerrarse; si la conferencia vuelve a empezar, sigue la misma. */
      const fn = vm.runInNewContext('(function (window, SANav, setTimeout, clearTimeout) { var VN = { h: null, activa: true, estado: "hablando", soporta: true, fin: null }; var AlmaTarjeta = window.AlmaTarjeta;' +
        html.slice(v0, v1) + ' return { ev: vozNativaEvento, VN: VN }; })');
      let fin = 0, est = [], alma = 0;
      const vn = fn({ AlmaTarjeta: AT }, { alma: () => alma++ }, (f, ms) => setT(f, ms), clearT);
      vn.VN.h = { ended: () => fin++, status: (x) => est.push(x) };
      vn.ev({ tipo: 'estado', estado: 'apagada' });
      ok(fin === 0 && est.pop() === 'Llamada terminada', '10 · roca: con el tablero a la vista, la llamada no se cierra enseguida');
      avanza(3100);
      ok(fin === 1, '10 · roca: a los ~3 s se cierra y queda el inicio');
      vn.VN.activa = true; vn.VN.h = { ended: () => fin++, status: (x) => est.push(x) };
      AT.evento({ tipo: 'tarjeta', vista: 'abierta', tarjeta: T1 }); avanza(400);
      vn.ev({ tipo: 'estado', estado: 'apagada' }); avanza(1000);
      vn.ev({ tipo: 'estado', estado: 'conectando' });
      avanza(5000);
      ok(fin === 1 && alma === 0 && vn.VN.h && est.pop() === 'Conectando…', '10 · roca: la conferencia vuelve a oír «Alma» antes de los 3 s: sigue la misma llamada de la roca');
      AT.evento({ tipo: 'estado', estado: 'apagada' }); avanza(4000);
      vn.VN.activa = true; const h3 = vn.VN.h; vn.ev({ tipo: 'estado', estado: 'apagada' });
      ok(fin === 2 && h3, '10 · roca: sin tablero a la vista se cierra enseguida, como siempre');
      ok(mandado.indexOf('plegar') < 0, '10 · página: nada de esto encoge el tablero por su cuenta');
    }
  }
}

process.exit(fallo);
