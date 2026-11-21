/* Archivos en los chats (#544, 16-nov-2026) con dobles: sin Drive, sin Meta, sin Hospitable, sin IA.
   Juan: «En los archivos compartidos no está permitiendo unir archivos; se intentan agregar y no los agrega». El «+» del
   chat de Alma solo aceptaba fotos y el del chat con huéspedes, fotos y PDF.
   1. Chat de Alma (almaArchivo_): solo con sesión; PDF, Word, Excel, CSV, texto y audio se guardan en una carpeta PRIVADA
      (nunca con enlace) y Alma recibe lo que dicen; un tipo desconocido no se guarda; un .doc viejo se guarda y lo dice.
   2. Chat con huéspedes (adjSubir_, adjEnviarWa_, adjEnviarHosp_): por WhatsApp salen Word y Excel como documento y el
      audio como audio (sin pie: el texto sale aparte, después); por Hospitable siguen solo las fotos.
   3. Las pantallas: el «+» del chat de Alma tiene «Archivo» con los tipos y el Hub, el «Archivo» de WhatsApp con Word,
      Excel y audio; el Hub sabe la acción y no la pausa el cupo como al chat de Alma.
   node .github/archivos-chat.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const W = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', X = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX = '<w:document><w:body><w:p><w:r><w:t>Contrato de limpieza</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Pago </w:t></w:r><w:r><w:t>semanal</w:t></w:r></w:p></w:body></w:document>';
const XLSX = { hoja: '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>350</v></c></row></sheetData>', comp: '<sst><si><t>Luz</t></si></sst>' };

function caja() {
  const props = {}, drive = { archivos: [], compartidos: 0, carpetas: 0 }, meta = [], hosp = [], wa = [], ia = [];
  let n = 0;
  const blob = (bytes, mime, nombre) => {
    const b = { _b: Buffer.from(bytes), _m: mime, _n: nombre,
      getBytes: () => Array.from(b._b), getDataAsString: () => b._b.toString('utf8'), getContentType: () => b._m, getName: () => b._n,
      setName: x => { b._n = x; return b; }, setContentType: x => { b._m = x; return b; }, copyBlob: () => blob(b._b, b._m, b._n) };
    return b;
  };
  const parte = (nom, txt) => ({ getName: () => nom, getDataAsString: () => txt });
  const carpeta = { getId: () => 'carpeta-' + drive.carpetas, setSharing: () => { drive.compartidos++; },
    createFile: b => { const id = 'archivo' + (++n) + 'xxxxxxxxxxxxxxxxxxxx'; const f = { b, desc: '', getId: () => id, getName: () => b.getName(), getMimeType: () => b.getContentType(),
      getBlob: () => b, setSharing: () => { drive.compartidos++; f.publico = true; }, setDescription: d => { f.desc = d; }, getParents: () => { let i = 0; return { hasNext: () => i++ === 0, next: () => carpeta }; } };
      drive.archivos.push(f); return f; } };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, Buffer,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    Utilities: { base64Decode: s => Array.from(Buffer.from(s, 'base64')), base64Encode: a => Buffer.from(a).toString('base64'), newBlob: blob,
      computeDigest: (a, bytes) => Array.from(require('crypto').createHash('md5').update(Buffer.from(bytes)).digest()), DigestAlgorithm: { MD5: 'md5' },
      parseCsv: t => t.trim().split('\n').map(l => l.split(',')),
      unzip: b => { const t = b._b.toString('utf8'); return t === 'DOCX' ? [parte('word/document.xml', DOCX)] : t === 'XLSX' ? [parte('xl/worksheets/sheet1.xml', XLSX.hoja), parte('xl/sharedStrings.xml', XLSX.comp)] : []; } },
    DriveApp: { createFolder: () => { drive.carpetas++; return carpeta; }, getFolderById: () => carpeta, getFileById: id => drive.archivos.find(f => f.getId() === id),
      Access: { ANYONE_WITH_LINK: 'a' }, Permission: { VIEW: 'v' } },
    CFG: { MODELO_REDACTOR: 'm', TZ: 'America/Guatemala' },
    claude_: (mod, max, sys, user, t, imgs) => { ia.push({ user, img: String((imgs || [])[0] || '').slice(0, 30) }); return 'Factura de luz por Q 350, vence el 30 de noviembre.'; },
    transcribir_: b => { ia.push({ audio: b.getContentType() }); return 'Hola Alma, el apartamento quedó listo.'; },
    waCfg_: () => ({ token: 't', phoneId: 'p' }), normTel_: x => String(x).replace(/\D/g, ''), waVentana_: () => true, acortarEnTexto_: t => t,
    uf_: (url, op) => { meta.push({ url, body: op && typeof op.payload === 'string' ? JSON.parse(op.payload) : op && op.payload }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(/media$/.test(url) ? { id: 'mid' + meta.length } : { messages: [{ id: 'w' }] }) }; },
    hosp_: (m, ruta, b) => { hosp.push(b); return { code: 200 }; },
    waEnviar_: (n, t) => { wa.push(t); return { ok: true }; },
    hojaWA_: () => ({ appendRow() {} }), inboxUpsert_() {}, s_: x => String(x || '')
  };
  vm.createContext(ctx);
  ['correohilo.js', 'adjuntos.js', 'salidahuesped.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  return { ctx, drive, meta, hosp, wa, ia, props };
}
const b64 = t => Buffer.from(t).toString('base64');
const SES = { email: 'juan@x.com' };

/* 1. Chat de Alma */
{
  const c = caja(), A = c.ctx.almaArchivo_;
  ok(A(null, { data: b64('x'), mime: 'application/pdf', nombre: 'f.pdf' }).error === 'session' && !c.drive.archivos.length, 'sin sesión no se guarda nada');
  const pdf = A(SES, { data: b64('%PDF-1.4'), mime: 'application/pdf', nombre: 'factura.pdf' });
  ok(pdf.ok && /Q 350/.test(pdf.texto) && pdf.drive_id && /^data:application\/pdf;base64,/.test(c.ia[0].img), 'PDF: se guarda y Alma recibe lo que dice (modelo de visión) con su drive_id');
  const w = A(SES, { data: b64('DOCX'), mime: W, nombre: 'contrato.docx' });
  ok(w.ok && w.texto === 'Contrato de limpieza\nPago semanal', 'Word (.docx): Alma recibe su texto, un párrafo por línea');
  const x = A(SES, { data: b64('XLSX'), mime: X, nombre: 'gastos.xlsx' });
  ok(x.ok && /Luz \| 350/.test(x.texto), 'Excel (.xlsx): Alma recibe la tabla');
  const csv = A(SES, { data: b64('a,b\n1,2'), mime: 'text/csv', nombre: 'datos.csv' });
  ok(csv.ok && /a \| b/.test(csv.texto), 'CSV: Alma recibe la tabla');
  const au = A(SES, { data: b64('AUDIO'), mime: 'audio/x-m4a', nombre: 'nota.m4a' });
  ok(au.ok && /quedó listo/.test(au.texto) && c.ia.some(i => i.audio === 'audio/mp4'), 'audio (nota del iPhone): Alma recibe la transcripción');
  const viejo = A(SES, { data: b64('DOC'), mime: 'application/msword', nombre: 'viejo.doc' });
  ok(viejo.ok && !viejo.texto && /formato viejo/.test(viejo.nota), 'un .doc viejo se guarda y Alma sabe que no lo pudo leer');
  const antes = c.drive.archivos.length, exe = A(SES, { data: b64('MZ'), mime: 'application/x-msdownload', nombre: 'x.exe' });
  ok(!exe.ok && c.drive.archivos.length === antes, 'un tipo que no se puede abrir no se guarda');
  ok(!A(SES, { data: '', mime: 'application/pdf' }).ok, 'un archivo vacío no se guarda');
  ok(c.drive.compartidos === 0 && c.drive.archivos.every(f => !f.publico) && /juan@x\.com/.test(c.drive.archivos[0].desc) && c.props.ALMA_ARCH_CARPETA_ID,
    'todo queda en la carpeta privada del chat de Alma (sin enlace público), con quién lo subió');
}

/* 2. Chat con huéspedes */
{
  const c = caja(), C = c.ctx;
  const w = C.adjSubir_(SES, { data: b64('DOCX'), mime: W, nombre: 'reglamento.docx' }), au = C.adjSubir_(SES, { data: b64('AU'), mime: 'audio/x-m4a', nombre: 'bienvenida.m4a' });
  const xl = C.adjSubir_(SES, { data: b64('XLSX'), mime: X, nombre: 'inventario.xlsx' }), mal = C.adjSubir_(SES, { data: b64('MZ'), mime: 'application/zip', nombre: 'x.zip' });
  ok(w.ok && w.tipo === 'documento' && xl.ok && xl.tipo === 'documento' && au.ok && au.tipo === 'audio' && au.mime === 'audio/mp4', 'Word, Excel y audio se suben (la nota del iPhone queda como audio/mp4)');
  ok(!mal.ok && /Word, Excel o audio/.test(mal.error), 'un .zip no se sube y dice qué sí');
  const it = C.adjLeer_([au.id, w.id]); ok(it.ok && it.items.length === 2, 'los adjuntos subidos se pueden mandar');
  const r = C.adjEnviarWa_('50255555555', 'Te mando el audio y el reglamento', it.items, 'wa:50255555555', 'Juan');
  const msgs = c.meta.filter(m => /messages$/.test(m.url)).map(m => m.body);
  ok(r.ok && msgs[0].type === 'audio' && !msgs[0].audio.caption && msgs[1].type === 'document' && msgs[1].document.filename === 'reglamento.docx',
    'WhatsApp: el audio sale como audio y el Word como documento con su nombre');
  ok(c.wa.length === 1 && c.wa[0] === 'Te mando el audio y el reglamento' && !msgs[1].document.caption, 'el audio no lleva pie: el texto sale aparte, una vez');
  const c2 = caja(), w2 = c2.ctx.adjSubir_(SES, { data: b64('DOCX'), mime: W, nombre: 'r.docx' }), it2 = c2.ctx.adjLeer_([w2.id]);
  c2.ctx.adjEnviarWa_('50255555555', 'Aquí va', it2.items, 'wa:1', 'Juan');
  const m2 = c2.meta.filter(m => /messages$/.test(m.url)).map(m => m.body);
  ok(m2[0].document.caption === 'Aquí va' && c2.wa.length === 0, 'con un documento primero, el texto va de pie y no se repite');
  const h = C.adjEnviarHosp_('R1', 'hola', [it.items[1]]);
  ok(h.code === 422 && /solo se pueden mandar fotos/.test(h.error) && !c.hosp.length, 'Hospitable sigue solo con fotos');
}

/* 3. Pantallas y Hub */
{
  const nav = fs.readFileSync(path.join(RAIZ, 'js/sa-nav.js'), 'utf8'), cli = fs.readFileSync(path.join(RAIZ, 'js/alma-client.js'), 'utf8');
  const hub = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'), cod = leer('Código.js'), cupo = leer('cupo.js');
  ok(/docOk \? \[\{ txt: "Archivo"/.test(nav) && /class="san-doc"/.test(nav) && /docx:/.test(nav) && /xlsx:/.test(nav) && /m4a:/.test(nav) && /function chatArchivo/.test(nav),
    'chat de Alma: el «+» tiene «Archivo» (PDF, Word, Excel, audio) cuando el Hub lo sabe recibir');
  ok(/almaArchivo: function/.test(cli) && /almaArchivo: 1/.test(cli), 'alma-client: almaArchivo, con el tiempo de las acciones lentas');
  ok(/txt: "Archivo", icono/.test(hub) && /elegir\("\.pdf,\.doc,\.docx,\.xls,\.xlsx,\.mp3,\.m4a/.test(hub) && /esFoto: x\.tipo === "foto"/.test(hub),
    'chat con huéspedes: el «Archivo» de WhatsApp acepta Word, Excel y audio y los muestra como archivo, no como foto');
  ok(/case 'almaArchivo': return json_\((archivoEnOrbita_\(ses, )?almaArchivo_\(ses, body\)/.test(cod) && /CUPO_ACC_ALMA_ = \[[^\]]*'almaArchivo'/.test(cupo) && /chat: '[^']*almaArchivo/.test(cupo),
    'el Hub sabe la acción y la cuenta como chat de Alma (aviso amable si hay pausa por cupo)');
}
process.exit(fallo);
