/* Prueba con dobles de los enlaces cortos del Hub (#488 · T2, apps-script/enlaces.js), sin Sheets, red ni WhatsApp.
   1. Acortar dos veces el mismo enlace da el mismo código (también sin la caché); el código tiene 5 caracteres del
      alfabeto sin 0/o ni 1/l/i y la celda va como texto. Si el código sorteado ya existe, se sortea otro.
   2. El corto lleva la dirección de la app que lo genera (Juan, 12-nov): hub.spacioam.com y Drive/Docs sin app → Hub;
      grow.spacioam.com y lo que nace en Grow → grow.spacioam.com/<código que da Grow>; hola, docs y mi.spacioam.com y otros
      dominios → tal cual. Si el candado, la hoja o Grow fallan, sale el enlace largo (nunca con otra dirección ni frena
      un envío).
   3. La acción pública «enlace» (doPost y doGet de Código.js): con un código válido devuelve solo el enlace y suma un
      clic; uno raro o que no existe da error y nada más, y nunca crea la hoja. «acortar» del Hub pide sesión.
   4. acortarEnTexto_ acorta los de Drive, Grow y el Hub dentro de un texto (cada uno con su app) y deja los ya cortos,
      los de otros dominios y de hola/docs/mi, las direcciones que se escriben a mano y los códigos y números.
   5. Un WhatsApp, un correo y un mensaje de Hospitable con un enlace largo salen con el corto (un aviso del Hub con el
      del Hub, el formulario de Grow con el de Grow).
   6. Cada función que manda un WhatsApp o un correo llama a acortarEnTexto_ (o está en la lista de excepciones, con su
      porqué), y hosp_ lo hace con todo mensaje a un huésped.
   node .github/enlaces.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const linea = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\(.*').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };

const ABC = '23456789abcdefghjkmnpqrstuvwxyz', CODIGO = /^[23456789abcdefghjkmnpqrstuvwxyz]{5}$/;
const CORTO = /^https:\/\/hub\.spacioam\.com\/([23456789abcdefghjkmnpqrstuvwxyz]{5})$/;
const CORTO_GROW = /^https:\/\/grow\.spacioam\.com\/([23456789abcdefghjkmnpqrstuvwxyz]{5})$/;
const PDF = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing';
const GROW = 'https://grow.spacioam.com/?datos=p123&k=abcd1234efgh&c=eyJwIjoiUHJ1ZWJhIn0';
const HUB = 'https://hub.spacioam.com/?conv=b29098fa-0000-4000-8000-000000000001';
const CAB = ['codigo', 'url', 'app', 'creado', 'por', 'clics', 'ultimo'];

/* Una hoja de cálculo de mentira: filas en memoria, con lo que usa enlaces.js. */
function hojaFalsa(filas) {
  const sh = { filas, formatos: [],
    getDataRange: () => ({ getValues: () => sh.filas.map(f => f.slice()) }),
    getLastRow: () => sh.filas.length,
    setFrozenRows() {},
    getRange(r, c, nr, nc) {
      if (typeof r === 'string') return { setNumberFormat(f) { sh.formatos.push([r, f]); } };
      nr = nr || 1; nc = nc || 1;
      const rango = {
        setValues(vals) { vals.forEach((fila, i) => { while (sh.filas.length < r + i) sh.filas.push([]); fila.forEach((v, j) => { sh.filas[r + i - 1][c + j - 1] = v; }); }); return rango; },
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((sh.filas[r + i - 1] || [])[c + j - 1]) ?? '')),
        setNumberFormat(f) { sh.formatos.push([r, c, f]); return rango; }
      };
      return rango;
    } };
  return sh;
}

function caja(o) {
  o = o || {};
  const hojas = {}, cache = {}, enviados = [], correos = [], grow = [], growCodigos = {};
  if (o.filas) hojas.ENLACES = hojaFalsa(o.filas);
  const azar = (o.azar || []).slice();
  const M = Object.create(Math); M.random = () => (azar.length ? azar.shift() : Math.random());
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math: M, String, Number, Object, Array, RegExp, Error, Buffer, isNaN,
    CFG: { HUB_URL: 'https://hub.spacioam.com', HOSPITABLE_API: 'https://hosp.example/v2', EMAIL_DESDE: 'hola@ejemplo.com' },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getUserLock: () => (o.sinCandado ? { hasLock: () => false, tryLock: () => false, releaseLock() {} } : { hasLock: () => false, tryLock: () => true, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => ({ WA_TOKEN: 'tok', WA_PHONE_ID: 'pid', HOSPITABLE_TOKEN: 'h' })[k] ?? null, setProperty() {} }) },
    ContentService: { createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' }, sleep() {},
      computeDigest: (alg, t) => Array.from(crypto.createHash(alg).update(String(t)).digest()).map(b => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64url') },
    ssAlma_: () => { if (o.hojaRota) throw new Error('Sheets no responde'); return { getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hojaFalsa([])) }; },
    cupoCanal_() {}, waVentana_: () => true, waUltimoGuardar_() {}, cacheEnvio_() {}, registrarEnvioInq_() {},
    uf_: (url, op) => { enviados.push({ url, cuerpo: JSON.parse(op.payload || '{}') }); return { getResponseCode: () => 200, getContentText: () => '{"messages":[{"id":"wamid.1"}]}', getHeaders: () => ({}) }; },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'hola@ejemplo.com' }) },
    GmailApp: { getAliases: () => [], sendEmail: (para, asunto, texto) => correos.push({ para, asunto, texto }) },
    hojaCrear_: () => ({ appendRow() {} }),
    /* Grow de mentira (la puerta de la secretaria, op «acortar»): el mismo enlace da el mismo código; caído si o.growCaido. */
    growApi_: (op, d) => { grow.push({ op, d }); if (o.growCaido) return { ok: false, error: 'Grow no respondió: timeout' };
      if (op !== 'acortar' || !/^https:\/\/(grow\.spacioam\.com|drive\.google\.com|docs\.google\.com)[\/?#]/.test(d.url)) return { ok: false, error: 'Ese enlace no se puede acortar' };
      const c = growCodigos[d.url] || (growCodigos[d.url] = 'g' + crypto.createHash('md5').update(d.url).digest('hex').replace(/[^2-9a-hjkmnp-z]/g, '').slice(0, 4).padEnd(4, 'x'));
      return { ok: true, codigo: c, corto: 'https://grow.spacioam.com/' + c }; }
  };
  vm.createContext(ctx);
  vm.runInContext(['s_', 'celdaTexto_', 'json_'].map(n => linea(COD, n)).join('\n') + '\n' + ['doPost', 'doGet', 'waEnviar_', 'hosp_'].map(n => sacar(COD, n)).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  vm.runInContext(sacar(leer('agente.js'), 'correoSimple_'), ctx, { filename: 'agente.js (extracto)' });
  vm.runInContext(leer('enlaces.js'), ctx, { filename: 'enlaces.js' });
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) }, parameter: {} }).getContent());
  const get = q => JSON.parse(ctx.doGet({ parameter: q }).getContent());
  return { ctx, hojas, cache, enviados, correos, grow, growCodigos, post, get, filas: () => (hojas.ENLACES ? hojas.ENLACES.filas : null) };
}

/* ── 1 ── */
{ const c = caja();
  const a = c.ctx.acortar_(PDF, 'prueba'), b = c.ctx.acortar_(PDF, 'prueba');
  ok(CORTO.test(a) && a === b, 'acortar dos veces el mismo enlace da el mismo código (' + a + ')');
  Object.keys(c.cache).forEach(k => delete c.cache[k]);
  ok(c.ctx.acortar_(PDF, 'prueba') === a, '…también sin la caché: lo busca en la hoja');
  ok(c.filas().length === 2 && JSON.stringify(c.filas()[0]) === JSON.stringify(CAB), 'la hoja ENLACES se crea sola: encabezado (codigo · url · app · creado · por · clics · ultimo) y una sola fila');
  const f = c.filas()[1];
  ok(CODIGO.test(f[0]) && f[1] === PDF && f[2] === 'hub' && f[4] === 'prueba' && f[5] === 0, 'la fila guarda el código, el enlace, la app, quién y 0 clics');
  ok(c.hojas.ENLACES.formatos.some(x => x[0] === 'A:A' && x[1] === '@') && c.hojas.ENLACES.formatos.some(x => x[0] === 2 && x[1] === 1 && x[2] === '@'), 'la columna del código va como texto («22345» no se vuelve número)');
  const otro = c.ctx.acortar_(HUB, 'prueba');
  ok(CORTO.test(otro) && otro !== a, 'otro enlace da otro código');
  const vistos = new Set([a, otro]); let bien = true;
  for (let i = 0; i < 200; i++) { const r = c.ctx.acortar_(PDF + '&n=' + i, 'prueba'); if (!CORTO.test(r) || vistos.has(r)) bien = false; vistos.add(r); }
  ok(bien, '200 enlaces más: todos con el formato y sin repetir código'); }

{ // El azar da primero «22222» (ya existe) y después «33333».
  const i2 = ABC.indexOf('2') / 31 + 0.001, i3 = ABC.indexOf('3') / 31 + 0.001;
  const c = caja({ filas: [CAB, ['22222', 'https://drive.google.com/file/d/otro-archivo-largo/view', 'hub', '', '', 0, '']], azar: [i2, i2, i2, i2, i2, i3, i3, i3, i3, i3] });
  ok(c.ctx.acortar_(PDF, 'prueba') === 'https://hub.spacioam.com/33333' && c.filas().length === 3, 'si el código choca con uno que ya existe, se sortea otro'); }

/* ── 2 ── */
{ const c = caja();
  const malos = ['https://evil.example.com/' + 'x'.repeat(60), 'http://hub.spacioam.com/?conv=' + 'x'.repeat(40), 'https://hub.spacioam.com.evil.com/' + 'x'.repeat(40),
    'https://evil.com@hub.spacioam.com/' + 'x'.repeat(40), 'https://hub.spacioam.com:8443/' + 'x'.repeat(40), 'javascript:alert(1)', 'https://spacioam.com.mx/' + 'x'.repeat(40)];
  ok(malos.every(u => c.ctx.acortar_(u, 'prueba') === u) && !c.hojas.ENLACES, 'un enlace de otro dominio, sin https, con @ o con puerto vuelve tal cual y no escribe nada');
  ok(CORTO.test(c.ctx.acortar_('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit', 'prueba')), 'un Doc de Google sin app sale con el Hub');
  const otras = ['https://hola.spacioam.com/?r=HMWM942RSN&k=abcdef1234567890', 'https://docs.spacioam.com/firmar?contrato=c-1234567890abcdef', 'https://mi.spacioam.com/reportes?propiedad=Z10-Brunelo-1203&mes=2026-10', 'https://epi.spacioam.com/rutas?dia=2026-11-12&quien=equipo'];
  ok(otras.every(u => c.ctx.acortar_(u, 'prueba') === u && c.ctx.acortar_(u, 'prueba', 'grow') === u) && !c.grow.length, 'hola, docs, mi y las demás apps salen largas, tal cual (sus tickets les darán su dirección): ni Hub ni Grow');
  const g1 = c.ctx.acortar_(GROW, 'prueba'), g2 = c.ctx.acortar_(GROW, 'prueba');
  ok(CORTO_GROW.test(g1) && g1 === 'https://grow.spacioam.com/' + c.growCodigos[GROW] && g2 === g1 && c.grow.length === 1, 'un enlace de Grow sale con grow.spacioam.com y el código que da Grow (' + g1 + '); el segundo sale de la caché');
  const n0 = c.filas().length;
  const pdfGrow = c.ctx.acortar_(PDF + '&grow=1', 'grow_presupuesto_pdf', 'grow');
  ok(CORTO_GROW.test(pdfGrow) && c.grow[c.grow.length - 1].d.url === PDF + '&grow=1' && c.filas().length === n0, 'un PDF de Drive que nace en Grow (app grow) sale con grow.spacioam.com y no escribe en la hoja del Hub');
  const caido = caja({ growCaido: true });
  const l1 = caido.ctx.acortar_(GROW, 'prueba'), l2 = caido.ctx.acortar_(GROW + '&x=2', 'prueba'), l3 = caido.ctx.acortar_(PDF, 'prueba', 'grow');
  ok(l1 === GROW && l2 === GROW + '&x=2' && l3 === PDF && !caido.hojas.ENLACES, 'Grow caído: el enlace sale largo, nunca con hub.spacioam.com');
  ok(caido.grow.length === 1, '…y por 10 min no se le vuelve a preguntar (no traba cada envío): ' + caido.grow.length + ' llamada');
  ok(c.ctx.enlaceAcortarApi_({ email: 'equipo@ejemplo.com' }, GROW).ok === false, '«acortar» del Hub no da un corto del Hub para un enlace de Grow');
  const sc = caja({ sinCandado: true });
  ok(sc.ctx.acortar_(PDF, 'prueba') === PDF && !sc.hojas.ENLACES, 'sin el candado en 5 s: sale el enlace largo (nunca frena el envío)');
  const rota = caja({ hojaRota: true });
  ok(rota.ctx.acortar_(PDF, 'prueba') === PDF, 'si la hoja falla: sale el enlace largo'); }

/* ── 3 ── */
{ const c = caja({ filas: [CAB, ['k7q2m', PDF, 'hub', '2026-11-12', 'alma', 3, ''], ['zzzzz', 'https://evil.example.com/robo', 'hub', '', '', 0, ''], [22222, HUB, 'hub', '', '', 0, '']] });
  const r = c.post({ action: 'enlace', codigo: 'k7q2m' });
  ok(r.ok && r.data.url === PDF && Object.keys(r.data).join() === 'url' && Object.keys(r).sort().join() === 'data,ok', '«enlace» (doPost, sin llave ni sesión) devuelve solo el enlace');
  ok(c.filas()[1][5] === 4 && c.filas()[1][6], 'y suma un clic y apunta la hora (ultimo)');
  const g = c.get({ enlace: 'K7Q2M' });
  ok(g.ok && g.data.url === PDF && c.filas()[1][5] === 5, 'también por doGet (?enlace=) y en mayúsculas');
  ok(c.post({ action: 'enlace', codigo: '22222' }).data.url === HUB, 'un código que la hoja guardó como número igual se abre');
  const malos = ['k7q2', 'k7q2m1', 'k7q0m', 'k7qlm', 'k7q m', "' or 1", '', null, 'k7q2m/../x'].map(x => c.post({ action: 'enlace', codigo: x }));
  ok(malos.every(x => x.ok === false && !x.data), 'un código con forma rara da error y ningún dato');
  const no = c.post({ action: 'enlace', codigo: 'abcde' });
  ok(no.ok === false && !no.data && /no existe/.test(no.error), 'un código que no existe da «Este enlace no existe.» y ningún dato');
  const fuera = c.post({ action: 'enlace', codigo: 'zzzzz' });
  ok(fuera.ok === false && !fuera.data && c.filas()[2][5] === 0, 'si alguien escribe a mano otro dominio en la hoja, no se redirige allá ni cuenta clic');
  const sin = caja();
  ok(sin.post({ action: 'enlace', codigo: 'k7q2m' }).ok === false && !sin.hojas.ENLACES, 'sin la hoja: «enlace» da error y no crea la hoja');
  ok(sin.ctx.enlaceAcortarApi_(null, PDF).ok === false && !sin.hojas.ENLACES, '«acortar» del Hub sin sesión se rechaza y no escribe nada');
  const con = sin.ctx.enlaceAcortarApi_({ email: 'equipo@ejemplo.com' }, PDF);
  ok(con.ok && CORTO.test(con.corto) && CODIGO.test(con.codigo) && sin.filas()[1][4] === 'equipo@ejemplo.com', '«acortar» con sesión da el corto y guarda quién');
  ok(/acortar.*enlaceAcortarApi_\(ses/.test(COD), 'hubApi_ tiene la acción «acortar» (con la sesión)'); }

/* ── 4 ── */
{ const c = caja(), T = c.ctx.acortarEnTexto_;
  const t = 'Hola Ana. Tu presupuesto: ' + PDF + '. El formulario (' + GROW + ') y la conversación: *' + HUB + '*';
  const r = T(t, 'prueba'), cortos = r.match(/https:\/\/hub\.spacioam\.com\/[23456789a-z]{5}/g) || [];
  ok(cortos.length === 2 && /\(https:\/\/grow\.spacioam\.com\/\w{5}\)/.test(r) && !/drive\.google|\?datos=|\?conv=/.test(r), 'acorta los de Drive y el Hub con hub.spacioam.com y el de Grow con grow.spacioam.com: ' + r);
  ok(/presupuesto: https:\/\/hub\.spacioam\.com\/\w{5}\. El formulario \(https:\/\/grow\.spacioam\.com\/\w{5}\) y la conversación: \*https:\/\/hub\.spacioam\.com\/\w{5}\*$/.test(r), 'el punto, el paréntesis y las *negritas* quedan fuera del enlace');
  const rg = T('Tu presupuesto: ' + PDF, 'grow_presupuesto_pdf', 'grow');
  ok(/^Tu presupuesto: https:\/\/grow\.spacioam\.com\/\w{5}$/.test(rg), 'con app grow, el PDF de Drive sale con grow.spacioam.com: ' + rg);
  ok(T(t, 'prueba') === r, 'el mismo texto otra vez da los mismos códigos');
  ok(T(r, 'prueba') === r, 'un texto ya corto no cambia');
  const quieto = 'Ya corto: https://grow.spacioam.com/k7q2m y https://hola.spacioam.com/a2b3c/ · otro: https://www.airbnb.com/rooms/12345678901234567890?check_in=2026-11-20 · ' +
    'registro: https://hola.spacioam.com/?r=HMWM942RSN&k=abcdef1234567890 · contrato: https://docs.spacioam.com/firmar?contrato=c-1234567890abcdef · ' +
    'entra a https://hola.spacioam.com o https://hola.spacioam.com/registro · código de la puerta 482913# · WiFi Spacio2026 · reserva HMWM942RSN · +502 5555 0000';
  ok(T(quieto, 'prueba') === quieto && c.filas().length === 3, 'deja los ya cortos, los de otros dominios, los de hola y docs (largos), las direcciones que se escriben a mano y los códigos y números');
  const obj = c.ctx.acortarEnObjeto_({ ok: true, nota: 'Formulario: ' + GROW, _imgs: ['data:image/jpeg;base64,AAAA'], drive_id: 'DA4', lista: [{ url: PDF }] }, 'grow_proyectos', 'grow');
  ok(CORTO_GROW.test(obj.nota.replace('Formulario: ', '')) && CORTO_GROW.test(obj.lista[0].url) && obj._imgs[0] === 'data:image/jpeg;base64,AAAA' && obj.drive_id === 'DA4', 'el resultado de una herramienta grow_* sale con grow.spacioam.com; las fotos y el drive_id no se tocan');
  ok(T('', 'x') === '' && T(null, 'x') === null && T('Sin enlaces, gracias.', 'x') === 'Sin enlaces, gracias.', 'un texto sin enlaces vuelve igual');
  const par = 'https://docs.google.com/document/d/1AbC(version-2)DeFgHiJkLmNoP/edit';
  ok(CORTO.test(T(par, 'x')) && T('(ver ' + par + ')', 'x').slice(-1) === ')', 'un paréntesis del propio enlace se respeta; el que lo envuelve queda fuera'); }

/* ── 5 ── */
{ const c = caja();
  const w = c.ctx.waEnviar_('50200000000', 'Hola, tu PDF: ' + PDF, {});
  const cuerpo = (c.enviados[0] || {}).cuerpo || {};
  ok(w.ok && /^Hola, tu PDF: https:\/\/hub\.spacioam\.com\/[23456789a-z]{5}$/.test(cuerpo.text && cuerpo.text.body), 'un WhatsApp con un enlace largo sale con el corto: ' + (cuerpo.text && cuerpo.text.body));
  c.ctx.waEnviar_('50200000000', 'Llena tus datos: ' + GROW + ' · el caso: ' + HUB, {});
  const w2 = ((c.enviados[1] || {}).cuerpo || { text: {} }).text.body || '';
  ok(/^Llena tus datos: https:\/\/grow\.spacioam\.com\/\w{5} · el caso: https:\/\/hub\.spacioam\.com\/\w{5}$/.test(w2), 'el formulario de Grow sale con grow.spacioam.com y el aviso del Hub con hub.spacioam.com: ' + w2);
  c.enviados.splice(1, 1);
  c.ctx.correoSimple_('socio@ejemplo.com', 'Tu reporte', 'Aquí está: ' + PDF);
  ok(c.correos.length === 1 && CORTO.test(c.correos[0].texto.replace('Aquí está: ', '')), 'un correo con un enlace largo sale con el corto: ' + (c.correos[0] || {}).texto);
  c.ctx.hosp_('post', '/reservations/r-1/messages', { body: 'Tu factura: ' + PDF });
  const h = c.enviados[1] || {};
  ok(/\/reservations\/r-1\/messages$/.test(h.url) && /^Tu factura: https:\/\/hub\.spacioam\.com\/[23456789a-z]{5}$/.test(h.cuerpo.body), 'un mensaje de Hospitable con un enlace largo sale con el corto: ' + (h.cuerpo || {}).body);
  c.ctx.hosp_('post', '/reviews/r-1/respond', { response: 'Gracias ' + PDF });
  ok((c.enviados[2] || { cuerpo: {} }).cuerpo.response === 'Gracias ' + PDF, 'las reseñas no se tocan'); }

/* ── 6 ── Cada función que manda algo a una persona pasa por acortarEnTexto_. */
{ const EXCEPCIONES = {   // función → por qué no hace falta
    recepcionEnviar_: 'plantilla de Meta con los datos del registro (propiedad, código, fechas) y el PDF: sin enlaces',
    confResumenCorreo_: 'el resumen de una reunión a Juan (lo que se dijo): sin enlaces'
  };
  const sinAcortar = [], vistas = [];
  fs.readdirSync(DIR).filter(f => f.endsWith('.js')).forEach(f => {
    const s = leer(f), re = /^function\s+([\w$]+)\s*\(/gm, idx = []; let m;
    while ((m = re.exec(s))) idx.push([m.index, m[1]]);
    idx.forEach(([i, n], k) => {
      const cuerpo = s.slice(i, k + 1 < idx.length ? idx[k + 1][0] : s.length);
      const manda = /graph\.facebook\.com\/v[\d.]+\/'\s*\+\s*[\w.]+\s*\+\s*'\/messages'/.test(cuerpo) || /GmailApp\.sendEmail\(|MailApp\.sendEmail\(|\.replyAll?\(/.test(cuerpo);
      if (!manda || n === 'correoEnviarConEncabezados_') return;   // ese lo llama correoResponderEnviar_ con el texto ya corto
      vistas.push(n);
      if (!/acortarEnTexto_\(/.test(cuerpo) && !EXCEPCIONES[n]) sinAcortar.push(f + ': ' + n);
    });
  });
  ok(vistas.length >= 12 && !sinAcortar.length, 'cada función que manda un WhatsApp o un correo llama a acortarEnTexto_ (' + vistas.length + ' revisadas)' + (sinAcortar.length ? '; faltan: ' + sinAcortar.join(', ') : ''));
  ok(/acortarEnTexto_\(payload\.body/.test(sacar(COD, 'hosp_')), 'hosp_ acorta todo mensaje a un huésped o a una consulta (Hospitable)');
  ok(/correoEnviarConEncabezados_\(b,/.test(sacar(leer('correohilo.js'), 'correoResponderEnviar_')) && /acortarEnTexto_\(String\(b\.texto/.test(sacar(leer('correohilo.js'), 'correoResponderEnviar_')), 'responder en el hilo acorta antes de cualquiera de sus tres formas de enviar'); }

process.exit(fallo);
