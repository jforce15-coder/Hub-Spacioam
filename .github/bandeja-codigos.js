/* Prueba de la consulta que se vuelve reserva en la bandeja (ALMA_INBOX), con dobles: sin Google y sin Hospitable de
   verdad (apps-script/bandejareserva.js y extractos de Código.js). Repite noviembre: 95 filas de reserva sin código,
   entre ellas Oscar (Brunelo 1808, HMWM942RSN), todas de una consulta que se volvió reserva. Revisa que:
   1. el aviso reservation.created deja la fila con el código, la propiedad y las fechas de la reserva (no las de la
      consulta) y sin un «Cambio de fechas» de mentira;
   2. el primer mensaje con reservation_id (sin el código en el aviso) la completa leyendo Hospitable;
   3. reservaDeConsulta_ (la búsqueda por conversation_id) también la completa;
   4. ya fusionada, lo que llega con el id de la consulta va a la reserva y preContexto_ de «inq:» da la reserva;
   5. si el candado no llega, no quedan vínculos a medias: el siguiente intento mueve la fila;
   6. la reparación (BANDEJA_CODIGOS_V1) llena las filas viejas con tope por vuelta, no reintenta lo que Hospitable no
      conoce, reintenta un 429, y una segunda vez no hace nada;
   7. completar nunca abre una fila nueva.
   node .github/bandeja-codigos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js');
const sacar = (nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(COD); if (!m) throw new Error('no encontré ' + nombre + ' en Código.js'); return m[0]; };
const linea = (re) => { const m = re.exec(COD); if (!m) throw new Error('no encontré ' + re + ' en Código.js'); return m[0].replace(/^const /, 'var '); };

const AHORA = Date.parse('2026-11-07T23:54:20Z');
const R_OSCAR = 'b29098fa-b6df-4753-8036-6a94a9607a23', CONV_OSCAR = '8e9c4e12-53dd-4cdf-abda-638cf54035d7', Q_OSCAR = '5a1c0de0-0000-4000-8000-00000000000a';
const R_ELVIN = '7e1a0000-0000-4000-8000-000000000011', R_ELOISA = '7e1a0000-0000-4000-8000-000000000012', R_VIEJA = '7e1a0000-0000-4000-8000-000000000013';
const R_NOEXISTE = '7e1a0000-0000-4000-8000-000000000014', R_CON = '7e1a0000-0000-4000-8000-000000000015';
/* La reserva tal como la da Hospitable (GET /reservations/{uuid}); el 7-nov Oscar consultó por el 6 y reservó el 7. */
const RESERVAS = {
  [R_OSCAR]: { id: R_OSCAR, code: 'HMWM942RSN', platform: 'airbnb', platform_id: 'HMWM942RSN', conversation_id: CONV_OSCAR, arrival_date: '2026-11-07T00:00:00-06:00', departure_date: '2026-11-08T00:00:00-06:00', check_in: '2026-11-07T15:00:00-06:00', check_out: '2026-11-08T11:00:00-06:00', reservation_status: { current: { category: 'accepted' } }, properties: [{ name: 'Z10 - Brunelo - 1808' }], guest: { first_name: 'Oscar', last_name: 'Suchite' } },
  [R_ELVIN]: { id: R_ELVIN, code: 'HMELVIN311', platform: 'airbnb', arrival_date: '2026-11-01', departure_date: '2026-11-03', properties: [{ name: 'Z10 - Modra - 311' }], guest: { first_name: 'Elvin' } },
  [R_ELOISA]: { id: R_ELOISA, code: 'HMELOI1104', platform: 'airbnb', arrival_date: '2026-11-07', departure_date: '2026-11-09', properties: [{ name: 'Z10 - Ignacio - 1104' }], guest: { first_name: 'Eloísa' } },
  [R_VIEJA]: { id: R_VIEJA, code: 'HMVIEJA001', platform: 'booking', arrival_date: '2026-10-20', departure_date: '2026-10-22', properties: [{ name: 'Z14 - Rue - 301' }], guest: { first_name: 'Ana' } }
};
const CAB_FILA = (o) => ({ codigo: '', huesped: '', foto: '', propiedad: '', tipo: '', checkin: '', checkout: '', ultimo_texto: '', ultimo_de: '', ultimo_ts: '', ...o });

/* Hojas de mentira: lo justo de SpreadsheetApp que usan la bandeja, la fusión y los hitos. */
function hoja(nombre, cab, filas) {
  const rows = filas.map((o) => cab.map((k) => (o[k] === undefined ? '' : o[k])));
  const sh = {
    nombre, cab, rows, appendRow: (r) => rows.push(r.slice()), getName: () => nombre,
    getLastRow: () => rows.length + 1, getLastColumn: () => cab.length, deleteRow: (r) => rows.splice(r - 2, 1),
    getRange: (r, c, nr, nc) => {
      nr = nr || 1; nc = nc || 1;
      const celda = (i, j) => (i === 1 ? cab[j - 1] : (rows[i - 2] || [])[j - 1]);
      const rg = {
        getValues: () => Array.from({ length: nr }, (_, a) => Array.from({ length: nc }, (_, b) => { const v = celda(r + a, c + b); return v === undefined ? '' : v; })),
        setValues: (vals) => vals.forEach((fila, a) => fila.forEach((v, b) => { if (r + a === 1) cab[c + b - 1] = v; else { const x = rows[r + a - 2]; while (x.length < c + b) x.push(''); x[c + b - 1] = v; } })),
        setValue: (v) => rg.setValues([[v]]),
        createTextFinder: (t) => { const tf = {
          matchEntireCell: () => tf,
          findNext: () => { for (let a = 0; a < nr; a++) for (let b = 0; b < nc; b++) if (String(celda(r + a, c + b)) === String(t)) return { getRow: () => r + a }; return null; },
          replaceAllWith: (x) => { for (let a = 0; a < nr; a++) for (let b = 0; b < nc; b++) if (r + a > 1 && String(celda(r + a, c + b)) === String(t)) rows[r + a - 2][c + b - 1] = x; }
        }; return tf; }
      };
      return rg;
    }
  };
  return sh;
}
const fila = (sh, id) => { const i = sh.rows.findIndex((x) => String(x[0]) === id); if (i < 0) return null; const o = {}; sh.cab.forEach((k, j) => o[k] = sh.rows[i][j]); return o; };

function caja(opc) {
  opc = opc || {};
  const cache = {}, props = Object.assign({}, opc.props || {}), vinc = Object.assign({}, opc.vinc || {}), gets = [], logs = [];
  const lock = { ocupado: !!opc.lockOcupado, tengo: false };
  const resp = (code, json) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(json || {}), getHeaders: () => ({}) });
  let respuestasGet = (opc.respuestasGet || []).slice();
  const ctx = {
    console: { log: (m) => logs.push(String(m)), warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Boolean, encodeURIComponent, decodeURIComponent,
    Date: class extends Date { constructor(...a) { if (!a.length) super(AHORA); else super(...a); } static now() { return AHORA; } },
    CFG: { TZ: 'America/Guatemala', HOSPITABLE_API: 'https://hosp.example/v2', HUB_URL: 'https://hub.example' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: (k) => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { if (lock.ocupado) throw new Error('ocupado'); lock.tengo = true; }, tryLock: () => !lock.ocupado, releaseLock: () => { lock.tengo = false; }, hasLock: () => lock.tengo }) },
    Utilities: { sleep() {}, formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; }, removeAll: (ks) => ks.forEach((k) => delete cache[k]) }) },
    s_: (v) => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    fecha_: (v) => String(v || '').slice(0, 10),
    vGet_: (k) => (k in vinc ? vinc[k] : null), vSet_: (k, v) => { vinc[k] = String(v); },
    buscarReserva_: () => null, adjuntos_: () => [], nombrePropInq_: () => '', acortarEnTexto_: (t) => t, cacheEnvio_() {}, registrarEnvioInq_() {},
    estadoEs_: (x) => x, fechaCorta_: (x) => x, pushA_() {}, cupoPermite_: () => true,
    /* La consulta de Oscar: preguntó por el 6 y 7 de noviembre (luego reservó del 7 al 8). */
    inquiryDatos_: () => ({ codigo: '', propiedad: 'Z10 - Brunelo - 1808', huesped: 'Oscar', checkin: '2026-11-06', checkout: '2026-11-07', tipo: 'consulta', canal: 'airbnb' }),
    /* uf_ es la única puerta a internet (cupo.js): aquí contesta Hospitable de mentira. */
    uf_: (url) => {
      gets.push(url);
      if (respuestasGet.length) { const r = respuestasGet.shift(); if (r) return resp(r[0], r[1]); }
      const lista = /\/reservations\?conversation_id=([^&]+)/.exec(url);
      if (lista) return resp(200, { data: Object.values(RESERVAS).filter((x) => x.conversation_id === decodeURIComponent(lista[1])).map((x) => ({ id: x.id, code: x.code, arrival_date: x.arrival_date })) });
      const m = /\/reservations\/([0-9a-f-]{36})(\?|$)/.exec(url);
      if (m) return RESERVAS[m[1]] ? resp(200, { data: RESERVAS[m[1]] }) : resp(404, { message: 'not found' });
      return resp(404, {});
    }
  };
  vm.createContext(ctx);
  vm.runInContext([linea(/const INBOX_CAB_ = \[[^\]]*\];/), linea(/const HITOS_CAB_ = \[[^\]]*\];/), linea(/const fecha10_ = [^\n]*/)].join('\n'), ctx, { filename: 'Código.js (constantes)' });
  vm.runInContext(['hosp_', 'preContexto_', 'convId_', 'recordarConv_', 'vincularReserva_', 'reservaDeConsulta_', 'canalPlat_', 'tsMs_', 'autoResuelve_', 'inboxUpsert_', 'inboxDesdeWebhook_', 'snapReserva_', 'reservaCambio_'].map(sacar).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  vm.runInContext(leer('bandejareserva.js'), ctx, { filename: 'bandejareserva.js' });
  const inbox = hoja('ALMA_INBOX', ctx.INBOX_CAB_.slice(), (opc.inbox || []).map(CAB_FILA));
  const hitos = hoja('ALMA_HITOS', ctx.HITOS_CAB_.slice(), []);
  const cola = hoja('ALMA_COLA', ['recibido', 'message_id', 'reservation_id', 'conversation_id', 'texto'], opc.cola || []);
  const ss = { getSheetByName: (n) => ({ ALMA_INBOX: inbox, ALMA_HITOS: hitos, ALMA_COLA: cola })[n] || null, getSheets: () => [inbox, hitos, cola] };
  Object.assign(ctx, { ssAlma_: () => ss, hojaCrear_: (n) => ss.getSheetByName(n), hojaInbox_: () => inbox, inqDeConversacion_: (d) => vinc['cinq_' + (d.conversation_id || '')] || '' });
  return { X: ctx, inbox, hitos, cola, gets, logs, props, vinc, lock, cache };
}
const consultaOscar = () => ({ conv_id: 'inq:' + Q_OSCAR, huesped: 'Oscar', propiedad: 'Z10 - Brunelo - 1808', tipo: 'consulta', checkin: '2026-11-06', checkout: '2026-11-07', ultimo_texto: 'Is it available?', ultimo_de: 'guest', ultimo_ts: '2026-11-07T17:40:00Z', hosp_conv: CONV_OSCAR });
const vincOscar = { ['cinq_' + CONV_OSCAR]: Q_OSCAR, ['inqcid_' + Q_OSCAR]: CONV_OSCAR };
const completa = (f, cod, prop, ci, co) => f && f.codigo === cod && f.propiedad === prop && String(f.checkin).slice(0, 10) === ci && String(f.checkout).slice(0, 10) === co && f.tipo === 'reserva';

/* 1 · reservation.created: la consulta se vuelve reserva y la fila toma el código, la propiedad y las fechas */
{ const { X, inbox, hitos, vinc } = caja({ inbox: [consultaOscar()], vinc: vincOscar });
  X.reservaCambio_('reservation.created', RESERVAS[R_OSCAR]);
  const f = fila(inbox, R_OSCAR);
  ok(!fila(inbox, 'inq:' + Q_OSCAR) && inbox.rows.length === 1, '1 · la fila de la consulta pasa a la reserva (una sola fila)');
  ok(completa(f, 'HMWM942RSN', 'Z10 - Brunelo - 1808', '2026-11-07', '2026-11-08'), '1 · la fila tiene el código, la propiedad y las fechas de la reserva (antes: sin código y con las fechas de la consulta): ' + JSON.stringify(f && { codigo: f.codigo, checkin: f.checkin, checkout: f.checkout, tipo: f.tipo }));
  ok(f && f.ultimo_texto === 'Is it available?' && f.hosp_conv === CONV_OSCAR, '1 · conserva el último mensaje y la conversación de Hospitable');
  ok(!hitos.rows.some((h) => h[3] === 'fechas'), '1 · sin «Cambio de fechas» de mentira entre la consulta y la reserva');
  ok(vinc['inqres_' + Q_OSCAR] === R_OSCAR && vinc['cres_' + CONV_OSCAR] === R_OSCAR, '1 · quedan los vínculos consulta → reserva');
}
/* 2 · el primer mensaje con reservation_id (el aviso no trae el código): la fila lo toma de Hospitable */
{ const { X, inbox, gets } = caja({ inbox: [consultaOscar()], vinc: vincOscar });
  const d = { id: 'm1', reservation_id: R_OSCAR, conversation_id: CONV_OSCAR, sender_type: 'host', body: 'Hola Oscar, bienvenido', created_at: '2026-11-07T23:54:00Z' };
  const id = X.convId_(d); X.inboxDesdeWebhook_(id, d);
  const f = fila(inbox, R_OSCAR);
  ok(id === R_OSCAR && completa(f, 'HMWM942RSN', 'Z10 - Brunelo - 1808', '2026-11-07', '2026-11-08'), '2 · mensaje con reservation_id: la fila queda con HMWM942RSN, Brunelo 1808 y 7 a 8 de noviembre');
  ok(f && f.ultimo_texto === 'Hola Oscar, bienvenido' && inbox.rows.length === 1, '2 · y con su último mensaje, en la misma fila');
  ok(gets.filter((u) => u.indexOf('/reservations/' + R_OSCAR) >= 0).length === 1, '2 · una sola lectura de la reserva en Hospitable (la caché sirve al webhook)');
}
/* 3 · reservaDeConsulta_ (el Hub abre la consulta o la pasada la repasa): también la completa */
{ const { X, inbox } = caja({ inbox: [consultaOscar()], vinc: vincOscar });
  ok(X.reservaDeConsulta_(Q_OSCAR) === R_OSCAR, '3 · reservaDeConsulta_ encuentra la reserva por conversation_id');
  ok(completa(fila(inbox, R_OSCAR), 'HMWM942RSN', 'Z10 - Brunelo - 1808', '2026-11-07', '2026-11-08'), '3 · y la fila queda con código, propiedad y fechas (la lista no trae la propiedad: la lee de Hospitable)');
}
/* 4 · ya fusionada: lo que llega con el id de la consulta va a la reserva; preContexto_ de «inq:» da la reserva */
{ const { X, inbox } = caja({ inbox: [consultaOscar()], vinc: vincOscar });
  X.reservaCambio_('reservation.created', RESERVAS[R_OSCAR]);
  ok(X.convId_({ inquiry_id: Q_OSCAR, conversation_id: CONV_OSCAR }) === R_OSCAR, '4 · un mensaje con inquiry_id va a la reserva (no abre otra fila «inq:»)');
  ok(X.convId_({ conversation_id: CONV_OSCAR }) === R_OSCAR, '4 · uno con solo conversation_id, también');
  ok(X.convId_({ inquiry_id: 'consulta-nueva-0001', conversation_id: CONV_OSCAR }) === 'inq:consulta-nueva-0001', '4 · una consulta nueva en el mismo hilo sigue siendo consulta (no cae en la reserva anterior)');
  const p = X.preContexto_('inq:' + Q_OSCAR);
  ok(p.codigo === 'HMWM942RSN' && p.tipo === 'reserva' && p.checkin === '2026-11-07', '4 · preContexto_ de la consulta ya convertida da la reserva: ' + JSON.stringify({ codigo: p.codigo, tipo: p.tipo, checkin: p.checkin }));
  const d = { id: 'm2', inquiry_id: Q_OSCAR, conversation_id: CONV_OSCAR, sender_type: 'guest', body: 'Thanks!', created_at: '2026-11-08T01:00:00Z' };
  X.inboxDesdeWebhook_(X.convId_(d), d);
  ok(inbox.rows.length === 1 && fila(inbox, R_OSCAR).ultimo_texto === 'Thanks!', '4 · su mensaje cae en la fila de la reserva');
}
/* 5 · sin candado no quedan vínculos a medias: el siguiente intento mueve la fila */
{ const { X, inbox, vinc, lock } = caja({ inbox: [consultaOscar()], vinc: vincOscar, lockOcupado: true });
  X.vincularReserva_(CONV_OSCAR, R_OSCAR);
  ok(!vinc['cres_' + CONV_OSCAR] && fila(inbox, 'inq:' + Q_OSCAR), '5 · candado ocupado: ni vínculo ni fila movida (antes: el vínculo quedaba y la fila nunca se movía)');
  lock.ocupado = false; X.vincularReserva_(CONV_OSCAR, R_OSCAR);
  ok(completa(fila(inbox, R_OSCAR), 'HMWM942RSN', 'Z10 - Brunelo - 1808', '2026-11-07', '2026-11-08') && vinc['cres_' + CONV_OSCAR] === R_OSCAR, '5 · al segundo intento se mueve y queda completa');
}
/* 6 · reparación una sola vez: tope por vuelta, 404 no se reintenta, 429 sí, la segunda vez no hace nada */
{ const viejas = [
    { conv_id: R_OSCAR, huesped: 'Oscar', propiedad: 'Z10 - Brunelo - 1808', tipo: 'reserva', checkin: '2026-11-06', checkout: '2026-11-07', ultimo_ts: '2026-11-07T23:49:04Z' },
    { conv_id: R_ELVIN, huesped: 'Elvin', tipo: 'reserva' },
    { conv_id: R_ELOISA, huesped: 'Eloísa', tipo: 'reserva' },
    { conv_id: R_VIEJA, huesped: 'Ana', tipo: 'reserva' },
    { conv_id: R_NOEXISTE, huesped: 'Alguien', tipo: 'reserva' },
    { conv_id: R_CON, codigo: 'HMYATIENE1', propiedad: 'Z10 - Ignacio - 1206', tipo: 'reserva' },
    { conv_id: 'wa:50255550101', huesped: 'Recepción', tipo: 'recepcion' },
    { conv_id: 'inq:' + Q_OSCAR, huesped: 'Otra consulta', tipo: 'consulta' }
  ];
  /* Primera vuelta: tope 3 y un 429 de Hospitable en la segunda lectura (hosp_ lo reintenta 2 veces y sigue en 429). */
  const { X, inbox, gets, props, logs } = caja({ inbox: viejas, respuestasGet: [null, [429, { message: 'too many' }], [429, {}], [429, {}]] });
  const r1 = X.bandejaCodigosReparar_({ tope: 3 });
  ok(r1.reparadas === 2 && !r1.hecho && !props.BANDEJA_CODIGOS_V1, '6 · primera vuelta: 3 lecturas (tope), 2 reparadas, el 429 queda para después y la marca no se pone: ' + JSON.stringify(r1));
  const leidas = new Set(gets.map((u) => u.split('?')[0]));
  ok(leidas.size === 3 && gets.every((u) => !/50255550101|inq:|HMYATIENE1/.test(u) && u.indexOf(R_CON) < 0), '6 · solo lee filas de reserva sin código (ni WhatsApp, ni consultas, ni las que ya tienen código)');
  ok(completa(fila(inbox, R_OSCAR), 'HMWM942RSN', 'Z10 - Brunelo - 1808', '2026-11-07', '2026-11-08'), '6 · Oscar recupera código y toma las fechas de la reserva (no las de la consulta)');
  let n = 0, r;
  do { r = X.bandejaCodigosReparar_({ tope: 3 }); n++; } while (!r.hecho && n < 5);
  ok(r.hecho && /^2026-11-07T.* · 4 reparadas · 1 sin código en Hospitable$/.test(props.BANDEJA_CODIGOS_V1 || ''), '6 · termina en ' + (n + 1) + ' vueltas y la marca dice cuántas: ' + props.BANDEJA_CODIGOS_V1);
  ok(['HMELVIN311', 'HMELOI1104', 'HMVIEJA001'].every((c) => inbox.rows.some((x) => x[1] === c)), '6 · Elvin (Modra 311), Eloísa (Ignacio 1104) y la de octubre quedan con su código');
  ok(gets.filter((u) => u.indexOf(R_NOEXISTE) >= 0).length === 1, '6 · lo que Hospitable no conoce (404) se pregunta una sola vez');
  ok(fila(inbox, R_CON).codigo === 'HMYATIENE1' && inbox.rows.length === viejas.length, '6 · no toca la que ya tenía código ni abre filas');
  ok(logs.some((l) => /bandeja reparada: .* → HMWM942RSN · Z10 - Brunelo - 1808 · 2026-11-07 a 2026-11-08/.test(l)), '6 · cada fila reparada queda en el registro');
  const antes = gets.length, filasAntes = JSON.stringify(inbox.rows);
  const r2 = X.bandejaCodigosReparar_();
  ok(r2.hecho && r2.reparadas === 0 && gets.length === antes && JSON.stringify(inbox.rows) === filasAntes, '6 · una segunda vez no hace nada (ni Hospitable ni la hoja)');
}
/* 7 · completar nunca abre una fila nueva */
{ const { X, inbox } = caja({ inbox: [] });
  X.bandejaReservaCompletar_(R_OSCAR, RESERVAS[R_OSCAR]);
  X.reservaCambio_('reservation.updated', RESERVAS[R_OSCAR]);
  ok(inbox.rows.length === 0, '7 · una reserva sin conversación en la bandeja no abre fila');
}
process.exit(fallo);
