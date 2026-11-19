/* Prueba con dobles del ahorro de llamadas a internet (apps-script/cupo.js, Código.js, promesas.js), sin Google ni
   Hospitable. 14-nov-2026: el Hub gastaba 7 000–12 000 llamadas al día y «Huéspedes» era el 65–70 %, casi plano de
   madrugada (lo automático de procesarCola, no las personas). Revisa:
   1. el conteo por función: cada llamada cuenta su canal y la función que la hizo, en la misma caché horaria; al cambiar
      la hora se vuelca a GOOGLE_USO_FUNCION, el total de los canales no cambia y «Uso» lo muestra;
   2. el respaldo de la bandeja: una pasada cada 15 min, la conversación que se movió en las últimas 2 h se relee en cada
      pasada y la quieta como mucho cada 60 min; en un día gasta menos de la mitad que antes; CUPO_AHORRO = 0 y la
      propiedad del intervalo lo devuelven a como estaba;
   3. lo que entra por webhook se procesa en la misma vuelta: procesarCola llama a la cola en cada vuelta, antes que el
      respaldo, y procesarColaPronto también; cada paso de procesarCola dice su nombre;
   4. el gasto de las otras apps se pregunta cada 60 min (antes 15) y cuenta como «cupoApps_»;
   5. las promesas usan la última copia del hilo si la conversación no se movió desde su último repaso, y la leen de
      Hospitable si hubo un mensaje nuevo, si no hay copia o con CUPO_AHORRO = 0.
   6. (19-nov-2026) extensionRevisar_ recuerda 3 h la reserva cuya conversación no aparece (no la busca cada 5 min),
      repararConsultas no reintenta en 6 h la misma consulta y la lista de cambios de GitHub dura 3 min en caché; con
      CUPO_AHORRO = 0 todo vuelve a como estaba.
   node .github/cupo-ahorro.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const COD = leer('Código.js'), CUPO = leer('cupo.js'), PROM = leer('promesas.js');
const INBOX_CAB = /const INBOX_CAB_ = (\[[^\]]*\]);/.exec(COD)[1];
const H = 3600000, MIN = 60000, AHORA0 = Date.parse('2026-11-14T15:00:00Z');   // 9:00 en Guatemala

/* Una hoja de mentira (filas con encabezado). */
function hoja(cab, filas0) {
  const filas = [cab.slice()].concat(filas0 || []);
  return {
    filas, getLastRow: () => filas.length, getLastColumn: () => cab.length,
    appendRow: r => filas.push(r.slice()), deleteRows: (a, n) => filas.splice(a - 1, n),
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = filas[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; },
      setValue: v => { filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = v; },
      setValues: vs => vs.forEach((row, i) => { filas[r - 1 + i] = filas[r - 1 + i] || []; row.forEach((v, j) => { filas[r - 1 + i][c - 1 + j] = v; }); })
    })
  };
}
function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, ttl = {}, hojas = {}, fetches = [];
  let ahora = o.ahora || AHORA0;
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const gt = d => new Date(d.getTime() - 6 * H).toISOString();   // hora de Guatemala
  const C = {
    get: k => (k in cache ? cache[k] : null), put: (k, v, s) => { cache[k] = String(v); ttl[k] = s; },
    getAll: ks => { const r = {}; ks.forEach(k => { if (k in cache) r[k] = cache[k]; }); return r; },
    putAll: (m, s) => Object.keys(m).forEach(k => { cache[k] = String(m[k]); ttl[k] = s; }), remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => delete cache[k])
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, isNaN, Error,
    CFG: { TZ: 'America/Guatemala', TAB_COLA: 'ALMA_COLA', TAB_LOG: 'ALMA_LOG', HUB_URL: 'https://hub' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => C },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate: (d, tz, f) => { const g = gt(d); return f === 'yyyyMMddHH' ? g.slice(0, 13).replace(/[-T]/g, '') : f === 'H' ? String(+g.slice(11, 13)) : f === 'HH' ? g.slice(11, 13) : f === 'HH:mm' ? g.slice(11, 16) : g.slice(0, 10); },
      parseDate: (s, tz, f) => new Date(Date.parse(s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) + 'T' + s.slice(8, 10) + ':00:00-06:00'))
    },
    UrlFetchApp: {
      fetch: (url) => { fetches.push(url); return { getResponseCode: () => 200, getContentText: () => '{}' }; },
      fetchAll: (l) => l.map(x => { fetches.push(x.url || x); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ ok: true, horas: {} }) }; })
    },
    ssAlma_: () => ({ getSheetByName: n => hojas[n] || null }),
    hojaCrear_: (n, cab) => (hojas[n] = hojas[n] || hoja(cab)),
    llaveRobot_: () => o.llave || '', ACCESOS_APPS_: { hola: () => 'https://h', epi: () => 'https://e', grow: () => 'https://g', docs: () => 'https://d', mi: () => 'https://m' },
    paraClaudePrincipalSes_: () => true, USO_CAB_: ['ts'], agPrincipal_: () => null, pendAvisar_() {}, pushA_() {}, waEnviar_() {}
  };
  vm.createContext(ctx);
  vm.runInContext(CUPO + '\nvar INBOX_CAB_ = ' + INBOX_CAB + ';', ctx);
  return { ctx, props, cache, ttl, hojas, fetches, mover: ms => { ahora += ms; }, hora: () => ahora, hoja };
}

/* ── 1 ── Conteo por función. */
{ const c = caja(), x = c.ctx;
  x.cupoCanal_('Huéspedes'); x.cupoFuncion_('sincronizarInbox_');
  x.uf_('https://public.api.hospitable.com/v2/reservations/1/messages', {}); x.uf_('https://public.api.hospitable.com/v2/reservations/2/messages', {}); x.uf_('https://public.api.hospitable.com/v2/x', {});
  x.cupoFuncion_('hub · hilo'); x.ufAll_([{ url: 'https://public.api.hospitable.com/v2/a' }, { url: 'https://public.api.hospitable.com/v2/b' }]);
  x.cupoCanal_('Voz'); x.cupoFuncion_(''); x.uf_('https://api.elevenlabs.io/v1/x', {});
  const hora = x.cupoHora_(c.hora()), F = JSON.parse(c.cache['cupo_' + hora + '_fn'] || '{}');
  ok(F['Huéspedes'] && F['Huéspedes'].sincronizarInbox_ === 3 && F['Huéspedes']['hub · hilo'] === 2 && F.Voz && F.Voz.otra === 1,
    '1 · cada llamada cuenta su función en la caché de la hora (' + JSON.stringify(F) + ')');
  ok(c.cache['cupo_' + hora + '_huespedes'] === '5' && c.cache['cupo_' + hora + '_voz'] === '1', '1 · el canal sigue contando igual (Huéspedes 5, Voz 1)');
  ok(c.fetches.length === 6, '1 · contar no hace llamadas extra (6 pedidas, 6 hechas)');
  c.mover(H);   // la primera llamada de la hora siguiente vuelca la que cerró
  x.cupoCanal_('Huéspedes'); x.cupoFuncion_('sincronizarInbox_'); x.uf_('https://public.api.hospitable.com/v2/c', {});
  const fh = c.hojas.GOOGLE_USO_FUNCION, gh = c.hojas.GOOGLE_USO;
  const filasF = fh ? fh.filas.slice(1) : [], filasG = gh ? gh.filas.slice(1) : [];
  ok(filasF.some(r => r[1] === 'Huéspedes' && r[2] === 'sincronizarInbox_' && r[3] === 3) && filasF.some(r => r[1] === 'Huéspedes' && r[2] === 'hub · hilo' && r[3] === 2),
    '1 · al cerrar la hora se vuelca a GOOGLE_USO_FUNCION (' + JSON.stringify(filasF) + ')');
  ok(filasG.filter(r => r[1] === 'Huéspedes').reduce((s, r) => s + r[2], 0) === 5 && !filasG.some(r => /·/.test(r[1]) && r[1] !== 'IA · Claude'), '1 · GOOGLE_USO sigue con los canales y el mismo total (Huéspedes 5)');
  const horas = x.cupoLeer_(c.hora() - 3 * H), tot = x.cupoSuma_(horas, c.hora() - 3 * H);
  ok(tot === 7, '1 · el nivel suma solo los canales, sin contar dos veces la función (' + tot + ' de 7)');
  const u = x.cupoUso_({});
  const hoy = (u.funciones && u.funciones.hoy) || [];
  ok(hoy[0] && hoy[0].canal === 'Huéspedes' && hoy[0].funcion === 'sincronizarInbox_' && hoy[0].llamadas === 4, '1 · «Uso» muestra por función, de mayor a menor, con la hora vigente (' + JSON.stringify(hoy) + ')');
  const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'uso.html'), 'utf8');
  ok(/R\.funciones/.test(html) && /Por función/.test(html), '1 · la página Uso pinta «Por función»');
}

/* ── 2 ── El respaldo de la bandeja. */
function bandeja(c, activas, quietas) {
  const filas = [], cab = c.ctx.INBOX_CAB_;
  const fila = (id, t) => { const r = cab.map(() => ''); r[0] = id; r[10] = new Date(t).toISOString(); return r; };
  for (let i = 0; i < activas; i++) filas.push(fila('act-' + i, c.hora() - (10 + i) * MIN));
  for (let i = 0; i < quietas; i++) filas.push(fila('qui-' + i, c.hora() - (5 + i) * H));
  return hoja(cab, filas);
}
function respaldo(o) {
  const c = caja(o), x = c.ctx, leidas = [];
  const sh = bandeja(c, o.activas, o.quietas), vacia = hoja(['recibido', 'reservation_id']);
  Object.assign(x, {
    s_: v => (v == null ? '' : String(v)), hojaInbox_: () => sh, hoja_: () => vacia,
    hiloConv_: id => { leidas.push({ id, t: c.hora() }); return { code: 200, hilo: [{ tipo: 'guest', texto: 'hola', created: new Date(c.hora() - H).toISOString() }] }; },
    preContexto_: () => ({}), inboxUpsert_() {}, repararConsultas() {}, repararHilosConsultas() {}
  });
  vm.runInContext(sacar(COD, 'sincronizarInbox_') + sacar(COD, 'respaldoPorLeer_'), x);
  /* Un día de procesarCola (cada minuto). La actividad de la bandeja no cambia: las «activas» siguen activas porque el
     reloj de la prueba solo dura lo que se pide. */
  const dia = (minutos) => { for (let m = 0; m < minutos; m++) { x.sincronizarInbox_(); c.mover(MIN); } };
  return { c, x, leidas, dia, sh };
}
{ const r = respaldo({ activas: 3, quietas: 17 });
  r.dia(120);
  const pasadas = new Set(r.leidas.map(l => l.t)).size;
  ok(pasadas === 8, '2 · una pasada cada 15 min (' + pasadas + ' pasadas en 2 h)');
  const de = id => r.leidas.filter(l => l.id === id).map(l => l.t), gap = ts => Math.max.apply(null, ts.slice(1).map((t, i) => t - ts[i]));
  ok(de('act-0').length === 8 && gap(de('act-0')) <= 15 * MIN, '2 · la que se movió hace poco se relee en cada pasada (' + de('act-0').length + ' veces)');
  ok(de('qui-0').length === 2 && gap(de('qui-0')) <= 60 * MIN, '2 · la quieta, una vez por hora (' + de('qui-0').length + ' veces en 2 h)');
  ok(!r.leidas.some(l => /^qui-1[2-6]$/.test(l.id)), '2 · solo las 15 más recientes, como antes');
  const nuevo = r.leidas.length;
  const v = respaldo({ activas: 3, quietas: 17, props: { CUPO_AHORRO: '0' } }); v.dia(120);
  const pv = new Set(v.leidas.map(l => l.t)).size;
  ok(pv === 12 && v.leidas.length === 12 * 15, '2 · con CUPO_AHORRO = 0 vuelve a lo de antes: cada 10 min, las 15 (' + pv + ' pasadas, ' + v.leidas.length + ' lecturas)');
  ok(nuevo * 2 < v.leidas.length, '2 · gasta menos de la mitad que antes (' + nuevo + ' contra ' + v.leidas.length + ' lecturas en 2 h)');
  const p = respaldo({ activas: 3, quietas: 17, props: { CUPO_RESPALDO_MIN: '10' } }); p.dia(60);
  ok(new Set(p.leidas.map(l => l.t)).size === 6, '2 · la propiedad CUPO_RESPALDO_MIN cambia el intervalo sin PR');
  const s = respaldo({ activas: 3, quietas: 17 }); s.c.ctx.CacheService.getScriptCache().getAll = () => { throw new Error('sin caché'); };
  s.dia(1);
  ok(s.leidas.length === 15, '2 · sin caché lee las 15: mejor gastar que perder un mensaje');
}

/* ── 3 ── Lo del webhook, en la misma vuelta. */
{ const cola = sacar(COD, 'procesarCola'), pronto = sacar(COD, 'procesarColaPronto');
  const pasos = []; let etiqueta = '';
  const ctx = { console: { error() {} }, Date, pulso_() {}, cupoCanal_() {}, cupoFuncion_: n => { etiqueta = n; }, cupoPermite_: () => true,
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {} } };
  const nombres = [...new Set((cola.match(/try \{ ([A-Za-z0-9_]+)\(/g) || []).map(m => m.slice(6, -1)))];
  nombres.forEach(n => { ctx[n] = () => pasos.push({ n, etiqueta }); });
  vm.createContext(ctx); vm.runInContext(cola + pronto, ctx);
  for (let i = 0; i < 30; i++) ctx.procesarCola();
  const vueltas = pasos.filter(p => p.n === 'procesarColaNucleo_').length;
  ok(vueltas === 30, '3 · procesarCola procesa la cola (lo que llegó por webhook) en cada vuelta (' + vueltas + ' de 30)');
  const orden = pasos.slice(0, nombres.length).map(p => p.n);
  ok(orden.indexOf('procesarColaNucleo_') >= 0 && orden.indexOf('procesarColaNucleo_') < orden.indexOf('sincronizarInbox_'), '3 · la cola va antes que el respaldo');
  ok(pasos.every(p => p.etiqueta === p.n), '3 · cada paso de procesarCola dice su nombre antes de gastar (' + pasos.filter(p => p.etiqueta !== p.n).map(p => p.n).join(', ') + ')');
  pasos.length = 0; ctx.procesarColaPronto();
  ok(pasos.length === 1 && pasos[0].n === 'procesarColaNucleo_', '3 · procesarColaPronto (tras el webhook) procesa la cola al momento');
  ok(/cupoFuncion_\('webhook Hospitable'\)/.test(COD) && /cupoFuncion_\('hub · ' \+/.test(COD), '3 · el webhook y las acciones del Hub también dicen su nombre');
}

/* ── 4 ── Las otras apps, cada 60 min. */
{ const c = caja({ llave: 'k' }), x = c.ctx;
  x.cupoFuncion_('vigProcesar_'); x.cupoApps_();
  ok(c.ttl.cupo_apps === 3600, '4 · el gasto de las otras apps se guarda 60 min (' + c.ttl.cupo_apps + ' s)');
  const F = JSON.parse(c.cache['cupo_' + x.cupoHora_(c.hora()) + '_fn'] || '{}');
  ok(F['Otras apps'] && F['Otras apps'].cupoApps_ === 5 && x.CUPO_FUNC_ === 'vigProcesar_', '4 · cuenta como «cupoApps_» y deja la función de antes');
  const n = c.fetches.length; x.cupoApps_(); ok(c.fetches.length === n, '4 · con la copia vigente no vuelve a preguntar');
  const v = caja({ llave: 'k', props: { CUPO_AHORRO: '0' } }); v.ctx.cupoApps_();
  ok(v.ttl.cupo_apps === 900, '4 · con CUPO_AHORRO = 0 vuelve a 15 min');
}

/* ── 5 ── Promesas: la copia del hilo si la conversación no se movió. */
function promesas(o) {
  const c = caja(o), x = c.ctx, lecturas = [], copias = [];
  const cab = x.INBOX_CAB_, r = cab.map(() => ''); r[0] = 'res-1'; r[cab.indexOf('ultimo_ts')] = new Date(c.hora() - o.actividadHace).toISOString();
  const inbox = hoja(cab, [r]);
  let shP = null;
  Object.assign(x, {
    ssAlma_: () => ({ getSheetByName: n => (n === 'ALMA_INBOX' ? inbox : null) }),
    hojaCrear_: (n, cb) => (shP = shP || hoja(cb)),
    hiloConv_: id => { lecturas.push(id); return { code: 200, hilo: [] }; },
    hiloGuardado_: id => { copias.push(id); return o.sinCopia ? null : { code: 200, hilo: [], cache: true }; },
    preContexto_: () => ({ checkin: '2026-11-13', checkout: '2026-11-18', status: 'accepted', tipo: 'reserva' }),
    inboxUpsert_() {}, adminPorTel_: () => null, claude_: () => ''
  });
  vm.runInContext(PROM, x);
  const P = x.PROM_CAB_, f = { id: 'pr1', creada: new Date(c.hora() - 30 * H).toISOString(), conv_id: 'res-1', huesped: 'Huésped', propiedad: 'Z10 - Prueba - 101', canal: 'plataforma',
    que: 'Revisar la lavadora y confirmar al huésped', vence: new Date(c.hora() - 20 * H).toISOString(), estado: 'vencida', origen: 'texto', texto: 'Lo revisamos y te confirmo.', avisos: 1,
    revisada: o.revisadaHace == null ? '' : new Date(c.hora() - o.revisadaHace).toISOString() };
  x.hojaProm_().appendRow(P.map(k => (f[k] === undefined ? '' : f[k])));
  x.promesasRepasar_({ ahora: c.hora() });
  return { lecturas, copias };
}
{ let r = promesas({ actividadHace: 3 * H, revisadaHace: 40 * MIN });
  ok(r.lecturas.length === 0 && r.copias.length === 1, '5 · sin mensajes desde el último repaso usa la copia, sin ir a Hospitable');
  r = promesas({ actividadHace: 35 * MIN, revisadaHace: 40 * MIN });
  ok(r.lecturas.length === 1, '5 · un mensaje justo antes del repaso (dentro del margen de 10 min) se lee de Hospitable');
  r = promesas({ actividadHace: 5 * MIN, revisadaHace: 40 * MIN });
  ok(r.lecturas.length === 1, '5 · con un mensaje nuevo se lee de Hospitable');
  r = promesas({ actividadHace: 3 * H, revisadaHace: null });
  ok(r.lecturas.length === 1, '5 · nunca repasada: se lee de Hospitable');
  r = promesas({ actividadHace: 3 * H, revisadaHace: 40 * MIN, sinCopia: true });
  ok(r.lecturas.length === 1, '5 · sin copia guardada: se lee de Hospitable');
  r = promesas({ actividadHace: 3 * H, revisadaHace: 40 * MIN, props: { CUPO_AHORRO: '0' } });
  ok(r.lecturas.length === 1 && r.copias.length === 0, '5 · con CUPO_AHORRO = 0 se lee siempre, como antes');
}

/* ── 6 ── 19-nov-2026: extensión sin conversación, consultas sin fechas y cambios de GitHub. */
{ const EXT = leer('codigoextension.js'), UNIR = leer('unir.js');
  const ext = o => { const c = caja(o), x = c.ctx; let busca = 0;
    Object.assign(x, { s_: v => (v == null ? '' : String(v)), agResId_: () => { busca++; return o.id || ''; } });
    vm.runInContext(sacar(EXT, 'extConv_'), x);
    for (let i = 0; i < 12; i++) { x.extConv_({ code: 'ABC123', reservation_uuid: '' }); c.mover(5 * MIN); }
    return busca; };
  ok(ext({}) === 1, '6 · extensión: la reserva sin conversación se busca una vez y no en cada vuelta de 5 min');
  ok(ext({ id: 'u-1' }) === 12, '6 · extensión: la que sí aparece sigue igual (su caché es la de reservaConv_)');
  ok(ext({ props: { CUPO_AHORRO: '0' } }) === 12, '6 · extensión: con CUPO_AHORRO = 0 se busca en cada vuelta, como antes');
  const inq = o => { const c = caja(o), x = c.ctx, cab = x.INBOX_CAB_, pedidas = [];
    const filas = []; for (let i = 0; i < 10; i++) { const r = cab.map(() => ''); r[0] = 'inq:q' + i; filas.push(r); }
    const sh = hoja(cab, filas);
    Object.assign(x, { ssAlma_: () => ({ getSheetByName: () => sh }), inquiryDatos_: id => { pedidas.push(id); return null; }, inboxUpsert_() {} });
    vm.runInContext(sacar(COD, 'repararConsultas'), x);
    for (let i = 0; i < 6; i++) { x.repararConsultas(8); c.mover(15 * MIN); }
    return pedidas; };
  let q = inq({});
  ok(q.length === 10 && new Set(q).size === 10, '6 · consultas: cada consulta sin fechas se intenta una vez en 6 h (' + q.length + ' pedidas en 6 pasadas)');
  q = inq({ props: { CUPO_AHORRO: '0' } });
  ok(q.length === 48, '6 · consultas: con CUPO_AHORRO = 0, 8 por pasada como antes (' + q.length + ')');
  const prs = o => { const c = caja(o), x = c.ctx; vm.runInContext(sacar(UNIR, 'prsCacheSeg_'), x); return x.prsCacheSeg_(); };
  ok(prs({}) === 180 && prs({ props: { CUPO_AHORRO: '0' } }) === 45, '6 · cambios de GitHub: 3 min en caché (antes 45 s)');
  ok(/c\.put\('prs_abiertos', JSON\.stringify\(lista\), prsCacheSeg_\(\)\)/.test(UNIR) && /'abierto' \? prsCacheSeg_\(\)/.test(leer('paraclaude.js')), '6 · la lista y el estado de cada PR abierto usan esa caché');
  ok(/removeAll\(\['prs_abiertos'\]\.concat/.test(UNIR), '6 · al unir se borra la caché: lo unido se ve al instante');
}

/* Lo que nunca se pausa sigue igual. */
ok(/var CUPO_NUNCA_ = \['login', 'sesion', 'huespedes', 'documentos', 'epi', 'limpieza'\];/.test(CUPO), 'lo que nunca se pausa (CUPO_NUNCA_) no cambió');

process.exit(fallo);
