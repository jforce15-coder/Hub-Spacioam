/* Prueba de «Responder en el hilo» (apps-script/correohilo.js) con dobles: sin internet ni Gmail de verdad.
   1. Reenvíos de Gmail web, iPhone y Outlook (español e inglés): sale bien quién lo escribió y el asunto.
   2. El original está en la misma bandeja: la respuesta usa .reply() en ese mensaje (o .replyAll() con a_todos).
   3. a_todos en false no copia a nadie.
   4. Nada sale sin el sí de Juan en un mensaje nuevo (ni con confirmado en el mismo turno, ni con otro texto, ni de fondo).
   5. Solo el reenvío: correo nuevo con «Re: <asunto>», y con Message-ID sale con In-Reply-To por el servicio avanzado.
   6. Correos largos: el hilo entero, lo más reciente primero, sin lo citado ni la firma, con tope y «recortado».
   7. Adjuntos: PDF y fotos pasan por el doble del modelo (el PDF como documento), CSV y Excel como tabla, lo demás
      «No puedo abrir este tipo», a lo mucho 3; releer no paga dos veces.
   8. Buscar (6-nov, Casa Sol): con un doble de la búsqueda de Gmail que distingue tildes, el correo sale por asunto
      partido, con o sin tilde, por quién lo mandó (casasol, Diana) y por el reenvío o el original; si no está, dice qué
      buscó y en qué cuenta, y nunca pide reenviarlo. Responder a todos va en el mismo hilo del original.
   9. Adjuntos por id de Drive (6-nov, los PDF del presupuesto de MONACO para Casa Sol): el borrador dice cuáles van; con
      el sí salen con .reply() o, solo con el reenvío, en el correo con In-Reply-To (multipart); solo PDF y fotos.
   node .github/correo-hilo.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const YO = 'juan@ejemplo.test', HOLA = 'hola@ejemplo.test', ANA = 'ana@socio.test';
function mensaje(o) {
  const m = { _o: o, replies: [], getId: () => o.id, getFrom: () => o.from, getTo: () => o.to || '', getCc: () => o.cc || '', getReplyTo: () => o.replyTo || '',
    getSubject: () => o.subject, getPlainBody: () => o.body, getDate: () => new Date(o.date || '2026-11-02T10:15:00Z'), getAttachments: () => o.adjuntos || [],
    reply: (t, op) => m.replies.push({ tipo: 'reply', texto: t, op: op || {} }), replyAll: (t, op) => m.replies.push({ tipo: 'replyAll', texto: t, op: op || {} }) };
  return m;
}
function hilo(id, msgs) { return { getId: () => id, getMessages: () => msgs, getFirstMessageSubject: () => msgs[0].getSubject() }; }
function adjunto(nombre, mime, contenido, extra) {
  const b = Buffer.from(contenido); const a = { getName: () => nombre, getContentType: () => mime, getSize: () => (extra && extra.tam) || b.length, getBytes: () => Array.from(b),
    getDataAsString: () => contenido, copyBlob: () => a, setContentType: () => a, _partes: extra && extra.partes };
  return a;
}

function caja(o) {
  const enviados = [], avanzado = [], filas = [], modelo = [], cache = {};
  const porId = {}; (o.hilos || []).forEach(h => h.getMessages().forEach(m => { porId[m.getId()] = m; }));
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Buffer,
    CFG: { EMAIL_DESDE: HOLA, TZ: 'America/Guatemala', MODELO_REDACTOR: 'vision' },
    AGENTE_TEXTO_: 'Responde a Ana que sí',
    Session: { getEffectiveUser: () => ({ getEmail: () => YO }) },
    GmailApp: { search: q => o.buscar(q), getAliases: () => [HOLA], getMessageById: id => porId[id],
      sendEmail: (para, asunto, texto, op) => enviados.push({ para, asunto, texto, op: op || {} }) },
    Gmail: o.sinAvanzado ? undefined : { Users: { Messages: { send: (r, yo) => { avanzado.push(Buffer.from(r.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); return { id: 'g1' }; } } } },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 16).replace('T', ' '), Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { MD5: 'md5' },
      base64Encode: x => Buffer.from(typeof x === 'string' ? x : Buffer.from(x)).toString('base64'),
      base64EncodeWebSafe: x => Buffer.from(typeof x === 'string' ? x : Buffer.from(x)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      computeDigest: (alg, bytes) => Array.from(require('crypto').createHash('md5').update(Buffer.from(bytes)).digest()),
      parseCsv: s => s.trim().split('\n').map(l => l.split(',')), unzip: b => b._partes || [] },
    hojaCrear_: (n, cab) => ({ getLastColumn: () => cab.length, appendRow: r => filas.push({ hoja: n, r }), getRange: () => ({ setValue() {} }) }),
    correoNoResponder_: () => '',
    DriveApp: { getFileById: id => { const a = (o.drive || {})[id]; if (!a) throw new Error('No item with the given ID could be found'); return a; } },
    claude_: (mod, max, sys, usr, temp, imgs) => { modelo.push({ usr, imgs: imgs || [] }); return 'Resumen del adjunto: ' + usr; }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'correohilo.js'), 'utf8'), ctx, { filename: 'correohilo.js' });
  return { ctx, enviados, avanzado, filas, modelo, porId, R: (f, ...a) => ctx[f](...a) };
}

/* ── 1. Reenvíos de cada cliente ── */
const REENVIOS = {
  'Gmail web (es)': { asunto: 'Fwd: Estado de cuenta octubre 1104', esperado: 'Estado de cuenta octubre 1104', body:
    'Mira lo que me mandó Ana.\n\n---------- Mensaje reenviado ---------\nDe: Ana Socia <ana@socio.test>\nFecha: lun, 2 nov 2026 a las 10:15\nAsunto: Estado de cuenta octubre 1104\nPara: Juan <juan@ejemplo.test>\n\n\nHola Juan, ¿me confirmas el pago?\nAna' },
  'Gmail web (en)': { asunto: 'Fwd: October statement', esperado: 'October statement', body:
    '---------- Forwarded message ---------\nFrom: Ana Socia <ana@socio.test>\nDate: Mon, Nov 2, 2026 at 10:15 AM\nSubject: October statement\nTo: Juan <juan@ejemplo.test>, Pedro <pedro@socio.test>\n\n\nHi Juan, can you confirm?' },
  'iPhone (en)': { asunto: 'Fwd: Re: Estado de cuenta', esperado: 'Re: Estado de cuenta', body:
    'Sent from my iPhone\n\nBegin forwarded message:\n\nFrom: Ana Socia <ana@socio.test>\nSubject: Re: Estado de cuenta\nDate: November 2, 2026 at 10:15:00 AM CST\nTo: Juan <juan@ejemplo.test>\n\nHola Juan' },
  'iPhone (es)': { asunto: 'Fwd: Factura noviembre', esperado: 'Factura noviembre', mid: '<abc123@mail.socio.test>', body:
    'Enviado desde mi iPhone\n\nInicio del mensaje reenviado:\n\n> De: Ana Socia <ana@socio.test>\n> Fecha: 2 de noviembre de 2026, 10:15:00 a.m. CST\n> Para: Juan <juan@ejemplo.test>\n> Asunto: Factura noviembre\n> Message-ID: <abc123@mail.socio.test>\n\n> Hola Juan, adjunto la factura.' },
  'Outlook (en)': { asunto: 'FW: Contrato 1104', esperado: 'Contrato 1104', body:
    'Te lo paso.\n\n________________________________\nFrom: Ana Socia <ana@socio.test>\nSent: Monday, November 2, 2026 10:15 AM\nTo: Juan <juan@ejemplo.test>\nSubject: Contrato 1104\n\nHi Juan' },
  'Outlook (es)': { asunto: 'RV: Pago de octubre', esperado: 'RE: Pago de octubre', body:
    '-----Mensaje original-----\nDe: Ana Socia [mailto:ana@socio.test]\nEnviado el: lunes, 2 de noviembre de 2026 10:15\nPara: Juan\nAsunto: RE: Pago de octubre\n\nHola Juan' },
  'Outlook web (negrita)': { asunto: 'FW: Llaves', esperado: 'Llaves', body:
    '________________________________\n*From:* Ana Socia <ana@socio.test>\n*Sent:* Monday, November 2, 2026 10:15 AM\n*To:* Juan <juan@ejemplo.test>\n*Subject:* Llaves\n\nHola' }
};
{
  const { R } = caja({ buscar: () => [] });
  Object.keys(REENVIOS).forEach(k => {
    const e = REENVIOS[k], rv = R('correoReenvio_', e.body);
    ok(rv && rv.de === ANA && rv.asunto === e.esperado && (!e.mid || rv.mid === e.mid) && R('correoEsReenvio_', e.asunto, e.body),
      k + ': socio y asunto («' + (rv && rv.de) + '», «' + (rv && rv.asunto) + '»)' + (e.mid ? ' y Message-ID' : ''));
  });
  ok(R('correoAsuntoBase_', 'RE: Fwd: RV: Pago') === 'Pago', 'el asunto base quita RE/Fwd/RV');
  /* Una respuesta de Outlook (cita «From:/Sent:» abajo) no es un reenvío. */
  ok(!R('correoEsReenvio_', 'RE: Contrato 1104', 'Gracias\n\n________________________________\nFrom: Juan <juan@ejemplo.test>\nSent: x\nSubject: Contrato'), 'una respuesta con el correo anterior citado no se toma por reenvío');
}

/* ── 2 y 3. El original está en esta bandeja: .reply() en ese mensaje, sin copia ── */
function bandejaConOriginal() {
  const orig = mensaje({ id: 'm-ana', from: 'Ana Socia <' + ANA + '>', to: YO + ', Pedro <pedro@socio.test>', cc: 'Luis <luis@socio.test>, ' + HOLA, subject: 'Estado de cuenta octubre 1104', body: 'Hola Juan, ¿me confirmas el pago?' });
  const fwd = mensaje({ id: 'm-fwd', from: 'Juan <' + YO + '>', to: YO, subject: 'Fwd: Estado de cuenta octubre 1104', body: REENVIOS['Gmail web (es)'].body });
  const T1 = hilo('h-ana', [orig]), T2 = hilo('h-fwd', [fwd]);
  return { orig, T1, T2, buscar: q => /^from:/.test(q) ? (q.indexOf(ANA) >= 0 ? [T1, T2] : []) : [T2] };
}
{
  const b = bandejaConOriginal(), c = caja({ hilos: [b.T1, b.T2], buscar: b.buscar });
  const r1 = c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola Ana, sí, el pago sale el viernes.' });
  ok(r1.falta_confirmar && r1.borrador.para === ANA && r1.borrador.asunto === 'Re: Estado de cuenta octubre 1104' && /mismo hilo/.test(r1.borrador.como), 'reenvío con el original en la bandeja: borrador para el socio, en el mismo hilo');
  ok(r1.borrador.copia === 'nadie', 'a_todos en false: el borrador no copia a nadie');
  ok(!b.orig.replies.length && !c.enviados.length, 'el borrador no manda nada');
  c.ctx.AGENTE_TEXTO_ = 'Sí, mándalo';
  const r2 = c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola Ana, sí, el pago sale el viernes.', confirmado: true });
  const rep = b.orig.replies[0] || {};
  ok(r2.enviado && rep.tipo === 'reply' && b.orig.replies.length === 1 && !c.enviados.length, 'con el sí: .reply() en el mensaje del socio (no un correo nuevo)');
  ok(!rep.op.cc && !rep.op.bcc && rep.op.from === HOLA, 'sin copia y desde el alias de hola@');
  const fila = (c.filas[0] || {}).r || [];
  ok(c.filas.length === 1 && fila[1] === 'respuesta' && fila[2] === ANA && fila[10] === 'h-ana', 'queda en ALMA_CORREOS: tipo respuesta, destinatario y hilo');
  c.ctx.AGENTE_TEXTO_ = 'otra vez sí';
  c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola Ana, sí, el pago sale el viernes.', confirmado: true });
  ok(b.orig.replies.length === 1, 'el mismo borrador no sale dos veces');
}
{
  const b = bandejaConOriginal(), c = caja({ hilos: [b.T1, b.T2], buscar: b.buscar });
  const r1 = c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola a todos.', a_todos: true });
  ok(r1.borrador.copia === 'pedro@socio.test, luis@socio.test', 'a_todos: el borrador muestra la copia, sin nuestras direcciones');
  c.ctx.AGENTE_TEXTO_ = 'sí';
  c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola a todos.', a_todos: true, confirmado: true });
  ok((b.orig.replies[0] || {}).tipo === 'replyAll', 'a_todos con el sí: .replyAll()');
}

/* ── 4. Nada sale sin el sí ── */
{
  const b = bandejaConOriginal(), c = caja({ hilos: [b.T1, b.T2], buscar: b.buscar }), q = { buscar: 'Estado de cuenta', texto: 'Hola Ana.' };
  const nada = () => !b.orig.replies.length && !c.enviados.length && !c.avanzado.length;
  const r1 = c.R('correoResponder_', { email: YO }, Object.assign({ confirmado: true }, q));
  ok(r1.falta_confirmar && nada(), 'confirmado = true sin borrador previo: solo devuelve el borrador');
  c.R('correoResponder_', { email: YO }, Object.assign({ confirmado: true }, q));
  ok(nada(), 'confirmado en el mismo turno del borrador: no sale');
  c.ctx.AGENTE_TEXTO_ = 'sí'; c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Otro texto que Juan no vio.', confirmado: true });
  ok(nada(), 'con otro texto: es un borrador nuevo y no sale');
  c.ctx.AGENTE_TEXTO_ = ''; c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Otro texto que Juan no vio.', confirmado: true });
  ok(nada(), 'de fondo (sin mensaje de Juan en el turno): no sale');
  c.ctx.AGENTE_TEXTO_ = 'Juan en otro turno'; c.R('correoResponder_', { email: 'otra@ejemplo.test' }, { buscar: 'Estado de cuenta', texto: 'Otro texto que Juan no vio.', confirmado: true });
  ok(nada(), 'el borrador de una persona no lo confirma otra');
  const src = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8');
  ok(/T\('responder_correo'/.test(src) && /case 'responder_correo'[\s\S]{0,200}esAdminPrincipal_[\s\S]{0,120}correoResponder_\(adm, inp\)/.test(src), 'agente.js: responder_correo existe y solo para Juan');
}

/* ── 5. Solo el reenvío ── */
{
  const e = REENVIOS['iPhone (es)'], fwd = mensaje({ id: 'm-f', from: 'Juan <' + YO + '>', subject: e.asunto, body: e.body }), T = hilo('h-f', [fwd]);
  const c = caja({ hilos: [T], buscar: q => /^from:/.test(q) ? [] : [T] });
  const r1 = c.R('correoResponder_', { email: YO }, { buscar: 'Factura', texto: 'Hola Ana, recibida. Gracias.' });
  ok(r1.borrador.para === ANA && r1.borrador.asunto === 'Re: Factura noviembre' && /reenvío/.test(r1.borrador.como), 'solo el reenvío: borrador al socio con «Re: <asunto original>»');
  c.ctx.AGENTE_TEXTO_ = 'sí, mándalo';
  c.R('correoResponder_', { email: YO }, { buscar: 'Factura', texto: 'Hola Ana, recibida. Gracias.', confirmado: true });
  const raw = c.avanzado[0] || '';
  ok(/^To: ana@socio\.test$/m.test(raw) && /^In-Reply-To: <abc123@mail\.socio\.test>$/m.test(raw) && /^References: <abc123@mail\.socio\.test>$/m.test(raw) && !/^Cc:/m.test(raw) && !c.enviados.length,
    'con Message-ID: sale por el servicio avanzado con In-Reply-To y References, sin copia');
  ok(/^From: Alma <hola@ejemplo\.test>$/m.test(raw) && raw.indexOf('=?UTF-8?B?' + Buffer.from('Re: Factura noviembre').toString('base64') + '?=') >= 0, 'desde hola@ y con el asunto «Re:»');
}
{
  const e = REENVIOS['Gmail web (en)'], fwd = mensaje({ id: 'm-g', from: 'Juan <' + YO + '>', subject: e.asunto, body: e.body }), T = hilo('h-g', [fwd]);
  const c = caja({ hilos: [T], buscar: q => /^from:/.test(q) ? [] : [T] });
  c.R('correoResponder_', { email: YO }, { buscar: 'October', texto: 'Hi Ana, confirmed.' });
  c.ctx.AGENTE_TEXTO_ = 'yes';
  c.R('correoResponder_', { email: YO }, { buscar: 'October', texto: 'Hi Ana, confirmed.', confirmado: true });
  const s = c.enviados[0] || {};
  ok(s.para === ANA && s.asunto === 'Re: October statement' && !s.op.cc && !c.avanzado.length, 'sin Message-ID: correo nuevo con GmailApp, «Re:» y sin copiar a Pedro');
}

/* ── 6. Correos largos ── */
{
  const largo = 'Hola Juan,\n' + 'Necesitamos revisar el contrato del 1104 y los pagos pendientes. '.repeat(400) + '\nSaludos\n-- \nAna Socia\nGerente\n\nEl lun, 26 oct 2026 a las 9:00, Juan (<juan@ejemplo.test>)\nescribió:\n> lo viejo';
  const m1 = mensaje({ id: 'a1', from: ANA, subject: 'Contrato', body: 'Primer mensaje del hilo.\n\nSent from my iPhone', date: '2026-10-30T10:00:00Z' });
  const m2 = mensaje({ id: 'a2', from: ANA, subject: 'Re: Contrato', body: largo, date: '2026-11-02T10:00:00Z' });
  const T = hilo('h-l', [m1, m2]), c = caja({ hilos: [T], buscar: () => [T] }), r = c.R('correoLeer_', 'Contrato');
  const total = r.mensajes.reduce((n, m) => n + m.texto.length, 0);
  ok(r.mensajes[0].texto.indexOf('Hola Juan') === 0 && r.mensajes[1].texto === 'Primer mensaje del hilo.', 'el hilo entero, lo más reciente primero, sin «Sent from my iPhone»');
  ok(r.mensajes[0].texto.indexOf('lo viejo') < 0 && r.mensajes[0].texto.indexOf('Gerente') < 0, 'sin el historial citado ni la firma');
  ok(total <= 20000 && r.recortado === true && /resumen/.test(r.nota || ''), 'tope de 20.000 caracteres, dice recortado y pide un resumen');
}
{
  const e = REENVIOS['Gmail web (es)'], fwd = mensaje({ id: 'm-r', from: 'Juan <' + YO + '>', subject: e.asunto, body: e.body }), T = hilo('h-r', [fwd]);
  const r = caja({ hilos: [T], buscar: () => [T] }).R('correoLeer_', 'Estado');
  ok(r.reenvio && r.reenvio.de === ANA && r.reenvio.asunto === 'Estado de cuenta octubre 1104' && /\[Reenviado · de Ana Socia <ana@socio\.test>/.test(r.mensajes[0].texto), 'leer_correo de un reenvío dice quién lo escribió y su asunto');
}

/* ── 7. Adjuntos ── */
{
  const xlsx = adjunto('pagos.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'zip', { partes: [
    { getName: () => 'xl/sharedStrings.xml', getDataAsString: () => '<sst><si><t>Mes</t></si><si><t>Monto</t></si><si><t>Octubre</t></si></sst>' },
    { getName: () => 'xl/worksheets/sheet1.xml', getDataAsString: () => '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>1500</v></c></row></sheetData></worksheet>' }] });
  const adj = [adjunto('factura.pdf', 'application/pdf', '%PDF-1.4 factura'), adjunto('foto.png', 'image/png', 'PNGDATA'), adjunto('pagos.csv', 'text/csv', 'mes,monto\noctubre,1500'),
    adjunto('fotos.zip', 'application/zip', 'zip'), xlsx, adjunto('otra.pdf', 'application/pdf', '%PDF otra')];
  const m = mensaje({ id: 'x1', from: ANA, subject: 'Documentos', body: 'Te mando los documentos.', adjuntos: adj });
  const T = hilo('h-x', [m]), c = caja({ hilos: [T], buscar: () => [T] }), r = c.R('correoLeer_', 'Documentos'), a = {};
  (r.adjuntos || []).forEach(x => { a[x.nombre] = x; });
  ok(c.modelo.length === 2 && /^data:application\/pdf;base64,/.test(c.modelo[0].imgs[0]) && /^data:image\/png;base64,/.test(c.modelo[1].imgs[0]), 'el PDF y la foto pasan por el doble del modelo');
  ok(/Resumen del adjunto/.test((a['factura.pdf'] || {}).contenido) && /Resumen del adjunto/.test((a['foto.png'] || {}).contenido), 'cada adjunto trae lo que el modelo leyó');
  ok((a['pagos.csv'] || {}).contenido === 'mes | monto\noctubre | 1500', 'el CSV se vuelve tabla');
  ok(/no puedo abrir este tipo/i.test((a['fotos.zip'] || {}).nota), 'un zip: «No puedo abrir este tipo»');
  ok(/a lo mucho 3/.test((a['pagos.xlsx'] || {}).nota) && /a lo mucho 3/.test((a['otra.pdf'] || {}).nota), 'a lo mucho 3 adjuntos leídos por correo');
  const T2 = hilo('h-x2', [mensaje({ id: 'x2', from: ANA, subject: 'Excel', body: 'El excel.', adjuntos: [xlsx] })]);
  const r2 = caja({ hilos: [T2], buscar: () => [T2] }).R('correoLeer_', 'Excel');
  ok(((r2.adjuntos || [])[0] || {}).contenido === 'Mes | Monto\nOctubre |  | 1500', 'el Excel (.xlsx) se vuelve tabla, con su columna vacía');
  c.R('correoLeer_', 'Documentos');
  ok(c.modelo.length === 2, 'releer el mismo correo no paga el modelo otra vez (caché)');
  const grande = mensaje({ id: 'x3', from: ANA, subject: 'Pesado', body: 'x', adjuntos: [adjunto('enorme.pdf', 'application/pdf', 'x', { tam: 11 * 1024 * 1024 })] });
  const T3 = hilo('h-x3', [grande]), c3 = caja({ hilos: [T3], buscar: () => [T3] }), r3 = c3.R('correoLeer_', 'Pesado');
  ok(!c3.modelo.length && /pesado/.test(r3.adjuntos[0].nota), 'más de 10 MB: no se lee');
  /* imgBloque_ (Código.js) manda el PDF como bloque de documento. */
  const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), src = (/function imgBloque_\(u\) \{[\s\S]*?\n\}/.exec(cod) || [''])[0];
  const caja2 = { String, DriveApp: {}, Utilities: {}, console }; vm.createContext(caja2); vm.runInContext(src, caja2);
  const bl = caja2.imgBloque_ ? caja2.imgBloque_('data:application/pdf;base64,QUJD') : null;
  ok(bl && bl.type === 'document' && bl.source.media_type === 'application/pdf' && bl.source.data === 'QUJD', 'claude_ recibe el PDF como documento');
  ok(/correoAdjuntoVer_: 'Correo · leer adjuntos'/.test(cod), 'el costo queda en IA_USO con su nombre');
}
/* ── 8. Buscar como Gmail: distingue tildes, {a b} es «o», -x es «sin x», from: mira quién lo mandó ── */
function gmailDoble(hilos) {
  const tok = t => String(t || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const lados = h => h.getMessages().map(m => ({ de: String(m.getFrom()).toLowerCase(), asunto: tok(m.getSubject()),
    todo: (m.getSubject() + ' ' + m.getFrom() + ' ' + m.getTo() + ' ' + m.getCc() + ' ' + m.getPlainBody()).toLowerCase() }));
  const termino = (t, ls) => {
    if (/^from:/i.test(t)) { const v = t.slice(5).toLowerCase(); return ls.some(l => l.de.indexOf(v) >= 0); }
    if (/^subject:/i.test(t)) { const v = t.slice(8).toLowerCase(); return ls.some(l => l.asunto.indexOf(v) >= 0); }
    if (/^(in|newer_than|older_than|has|is):/i.test(t)) return true;
    const v = t.toLowerCase();
    return ls.some(l => /[@.]/.test(v) ? l.todo.indexOf(v) >= 0 : tok(l.todo).indexOf(v) >= 0);
  };
  const buscados = [];
  const buscar = (q, ini, max) => {
    buscados.push(q);
    const partes = String(q).match(/-?\{[^}]*\}|\S+/g) || [];
    return hilos.filter(h => { const ls = lados(h); return partes.every(p => {
      const neg = p[0] === '-' && p.length > 1, x = neg ? p.slice(1) : p;
      const si = x[0] === '{' ? x.slice(1, -1).split(/\s+/).filter(Boolean).some(t => termino(t, ls)) : termino(x, ls);
      return neg ? !si : si; }); }).slice(0, max || 500);
  };
  return { buscar, buscados };
}
{
  const DIANA = 'administración Casa Sol <administracion@casasol.com.gt>', JUAN = 'Juan Ovalle | Spacio AM <' + YO + '>';
  const ASUNTO = 'Seguimiento a rentas Actuales -Apartamentos para remodelacion.';
  const orig = mensaje({ id: 'cs-1', from: DIANA, to: YO, cc: 'Casa Sol Bienes Raices <gerencia@casasol.com.gt>', subject: ASUNTO,
    body: 'Buenas tardes, Juan:\nLe comparto el resumen de los apartamentos en uso y los disponibles para equipar.\n\nAtentamente,\nDiana Amaya\nAsistente de Administración' });
  const fwd = mensaje({ id: 'cs-2', from: JUAN, to: HOLA, subject: 'Fwd: ' + ASUNTO,
    body: '---------- Forwarded message ---------\nDe: administración Casa Sol <administracion@casasol.com.gt>\nDate: lun, 3 nov 2026\nSubject: ' + ASUNTO +
      '\nTo: <' + YO + '>\nCc: Casa Sol Bienes Raices <gerencia@casasol.com.gt>\n\n\nBuenas tardes, Juan:\nLe comparto el resumen.\nDiana Amaya' });
  const CASASOL = hilo('h-casasol', [orig, fwd]);
  const nuevos = [hilo('h-bienvenida', [mensaje({ id: 'b1', from: 'Spacio AM <' + HOLA + '>', to: 'huesped@ejemplo.test', subject: '¡Bienvenido a Spacio AM! ✦ Tu registro está listo', body: 'Gracias por completar tu registro para tu estadía en los apartamentos.' })]),
    hilo('h-promesas', [mensaje({ id: 'b2', from: HOLA, to: YO, subject: 'Promesas pendientes · 160', body: 'Resumen de lo que ALMA prometió para los huéspedes.' })])];
  const viejos = [hilo('h-recibos', [mensaje({ id: 'r1', from: DIANA, to: YO, subject: 'Recibos de Luz Rentas Fijas', body: 'Adjunto los recibos de energía eléctrica para coordinar el pago.\nDiana Amaya' })])];
  const g = gmailDoble(nuevos.concat([CASASOL], viejos));   // lo más nuevo primero, como Gmail
  ok(!g.buscar('Seguimiento a rentas Actuales - Apartamentos para remodelación').length && g.buscar('remodelacion').length === 1 && !g.buscar('energia').length,
    'el doble distingue tildes como Gmail («remodelación» no encuentra «remodelacion» ni «energia» a «energía»)');
  const pedidos = {
    'el asunto que dictó Juan, con tilde': 'Seguimiento a rentas Actuales - Apartamentos para remodelación',
    'entre comillas latinas': '«Seguimiento a rentas Actuales - Apartamentos para remodelación»',
    'asunto partido': 'rentas actuales remodelación',
    'una sola palabra con tilde': 'remodelación',
    'sin tilde': 'Apartamentos remodelacion',
    'from: con el nombre de la firma': 'from:diana remodelación',
    'quién lo mandó (dominio)': 'casasol seguimiento',
    'Diana y Casa Sol': 'Diana Casa Sol apartamentos',
    'subject: con el guion pegado': 'subject:"Seguimiento a rentas Actuales -Apartamentos para remodelación"',
    'el reenvío': 'Fwd: Seguimiento a rentas',
    'la dirección completa': 'administracion@casasol.com.gt'
  };
  Object.keys(pedidos).forEach(k => {
    const c = caja({ hilos: [CASASOL], buscar: g.buscar }), r = c.R('correoLeer_', pedidos[k]);
    ok(r.ok && r.asunto === ASUNTO && r.cuenta === YO, 'leer_correo lo encuentra: ' + k + ' («' + pedidos[k] + '»)' + (r.ok ? '' : ' → ' + String(r.error || r.asunto).slice(0, 160)));
  });
  {
    const c = caja({ hilos: [CASASOL], buscar: g.buscar }), r = c.R('correoLeer_', 'Diana Casa Sol');
    ok(r.ok && r.asunto === ASUNTO, 'con dos correos de Casa Sol, el más nuevo que tiene todas las palabras («Diana Casa Sol»)');
  }
  {
    const c = caja({ hilos: [CASASOL], buscar: g.buscar }), r = c.R('correoLeer_', 'Factura Tigo octubre');
    ok(r.error && r.error.indexOf(YO) >= 0 && /Busqué en Gmail: «[^»]*Factura[^»]*»/.test(r.error) && (r.buscado || []).length >= 2, 'si no está: dice la cuenta y exactamente qué buscó');
    ok(!/Dile a Juan exactamente esto|que lo reenvíe a|no está entrando/.test(r.error) && /No le pidas que lo reenvíe/.test(r.error), 'si no está: nunca le pide a Juan que lo reenvíe');
    const r3 = c.R('correoLeer_', 'apartamentos presupuesto techos Aktiva');
    ok(r3.error && /Lo más parecido/.test(r3.error), 'con una sola palabra en común de cuatro no adivina otro correo: lo nombra como parecido');
  }
  {
    const c = caja({ hilos: [CASASOL], buscar: g.buscar });
    const r1 = c.R('correoResponder_', { email: YO }, { buscar: 'Seguimiento a rentas Actuales - Apartamentos para remodelación', texto: 'Hola Diana, gracias.', a_todos: true });
    ok(r1.falta_confirmar && r1.borrador.para === 'administracion@casasol.com.gt' && r1.borrador.copia === 'gerencia@casasol.com.gt' && /mismo hilo/.test(r1.borrador.como),
      'responder a todos con el reenvío y el original en el mismo hilo: a Casa Sol, copia a gerencia, en el mismo hilo');
    c.ctx.AGENTE_TEXTO_ = 'sí, mándalo';
    c.R('correoResponder_', { email: YO }, { buscar: 'Seguimiento a rentas Actuales - Apartamentos para remodelación', texto: 'Hola Diana, gracias.', a_todos: true, confirmado: true });
    ok((orig.replies[0] || {}).tipo === 'replyAll' && !fwd.replies.length && !c.enviados.length, 'con el sí: .replyAll() en el mensaje de Casa Sol, no en el reenvío');
  }
}
/* ── 9. Adjuntos de Drive ── */
{
  const pdf = (id, n) => ({ getName: () => n, getMimeType: () => 'application/pdf', getSize: () => 52000, getBlob: () => ({ getName: () => n, getContentType: () => 'application/pdf', getBytes: () => Array.from(Buffer.from('%PDF-' + id)) }) });
  const drive = { DB5xxxxxxxxxx: pdf('B5', 'Presupuesto MONACO Equipamiento B5 2026-11-06.pdf'), DA4xxxxxxxxxx: pdf('A4', 'Presupuesto MONACO Equipamiento A4 2026-11-06.pdf'),
    HOJAxxxxxxxxx: { getName: () => 'Presupuesto edificio Mónaco Fase 2', getMimeType: () => 'application/vnd.google-apps.spreadsheet', getSize: () => 0 } };
  const b = bandejaConOriginal(), c = caja({ hilos: [b.T1, b.T2], buscar: b.buscar, drive });
  const r1 = c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola Ana, te mando los presupuestos.', adjuntos: 'DB5xxxxxxxxxx, https://drive.google.com/file/d/DA4xxxxxxxxxx/view' });
  ok(r1.falta_confirmar && /Equipamiento B5 .*\(51 KB\), .*Equipamiento A4/.test(r1.borrador.adjuntos) && /adjuntos/.test(r1.nota), 'el borrador dice qué adjuntos van (nombre y tamaño), por id o por enlace');
  c.ctx.AGENTE_TEXTO_ = 'sí, mándalo';
  const r2 = c.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola Ana, te mando los presupuestos.', confirmado: true });
  const rep = b.orig.replies[0] || { op: {} };
  ok(r2.enviado && r2.adjuntos === 2 && rep.tipo === 'reply' && (rep.op.attachments || []).length === 2 && rep.op.attachments[0].getName() === 'Presupuesto MONACO Equipamiento B5 2026-11-06.pdf', 'con el sí: .reply() en el hilo con los 2 PDF');
  ok(/\[Adjuntos: Presupuesto MONACO Equipamiento B5/.test(c.filas[0].r[8]), 'ALMA_CORREOS anota qué adjuntos salieron');
  const c2 = caja({ hilos: [b.T1, b.T2], buscar: b.buscar, drive });
  c2.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola Ana.', adjuntos: ['DB5xxxxxxxxxx'] });
  c2.ctx.AGENTE_TEXTO_ = 'sí';
  const r3 = c2.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola Ana.', adjuntos: ['DB5xxxxxxxxxx', 'DA4xxxxxxxxxx'], confirmado: true });
  ok(r3.falta_confirmar && !b.orig.replies.slice(1).length, 'cambiar los adjuntos al confirmar es un borrador nuevo: no sale');
  const e1 = c2.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola', adjuntos: 'HOJAxxxxxxxxx' });
  const e2 = c2.R('correoResponder_', { email: YO }, { buscar: 'Estado de cuenta', texto: 'Hola', adjuntos: 'NOEXISTExxxxx' });
  ok(/no es un PDF ni una foto/.test(e1.error) && /No encuentro en Drive/.test(e2.error), 'una hoja no se adjunta y un id que no existe lo dice');
  const e = REENVIOS['iPhone (es)'], fwd = mensaje({ id: 'm-f9', from: 'Juan <' + YO + '>', subject: e.asunto, body: e.body }), T = hilo('h-f9', [fwd]);
  const c3 = caja({ hilos: [T], buscar: q => /^from:/.test(q) ? [] : [T], drive });
  c3.R('correoResponder_', { email: YO }, { buscar: 'Factura', texto: 'Hola Ana, van los PDF.', adjuntos: 'DB5xxxxxxxxxx' });
  c3.ctx.AGENTE_TEXTO_ = 'sí';
  c3.R('correoResponder_', { email: YO }, { buscar: 'Factura', texto: 'Hola Ana, van los PDF.', confirmado: true });
  const raw = c3.avanzado[0] || '';
  ok(/^In-Reply-To: <abc123@mail\.socio\.test>$/m.test(raw) && /multipart\/mixed; boundary=/.test(raw) && /Content-Disposition: attachment; filename="=\?UTF-8\?B\?/.test(raw) && raw.indexOf(Buffer.from('%PDF-B5').toString('base64')) >= 0,
    'solo el reenvío: el correo con In-Reply-To lleva el PDF (multipart)');
}
process.exit(fallo);
