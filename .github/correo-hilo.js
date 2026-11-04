/* Prueba de «Responder en el hilo» (apps-script/correohilo.js) con dobles: sin internet ni Gmail de verdad.
   1. Reenvíos de Gmail web, iPhone y Outlook (español e inglés): sale bien quién lo escribió y el asunto.
   2. El original está en la misma bandeja: la respuesta usa .reply() en ese mensaje (o .replyAll() con a_todos).
   3. a_todos en false no copia a nadie.
   4. Nada sale sin el sí de Juan en un mensaje nuevo (ni con confirmado en el mismo turno, ni con otro texto, ni de fondo).
   5. Solo el reenvío: correo nuevo con «Re: <asunto>», y con Message-ID sale con In-Reply-To por el servicio avanzado.
   6. Correos largos: el hilo entero, lo más reciente primero, sin lo citado ni la firma, con tope y «recortado».
   7. Adjuntos: PDF y fotos pasan por el doble del modelo (el PDF como documento), CSV y Excel como tabla, lo demás
      «No puedo abrir este tipo», a lo mucho 3; releer no paga dos veces.
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
process.exit(fallo);
