/* Biblioteca de Claudio (pedido pc1794916196762, 17-nov-2026) con dobles: sin Drive, sin hoja, sin GitHub, sin IA.
   Juan: «una opción para que el usuario comparta fácilmente un skill o documento, sin usar el chat, y que Claudio pueda
   pedirlo cuando sea necesario para hacerlo más rápido e inteligente».
   1. Compartir: solo el principal; .md, .zip/.skill (sus archivos de texto), PDF (lo lee del original) y texto pegado;
      un tipo desconocido no se guarda; todo privado (nunca con enlace).
   2. Cada pedido lleva la lista y cómo leer con el «lector» (nunca la llave de responder); BIBLIO_ON = 0 la quita.
   3. Claudio lee solo con el lector vivo de su pedido: en páginas, el original con «crudo», nada si venció o se quitó.
   4. Claudio pide («pide»): queda en la biblioteca y al compartirlo sale solo como ajuste de su microproyecto, una vez.
   5. paraclaude.js, Código.js, cupo.js y las pantallas lo conectan.
   node .github/biblioteca-claudio.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = t => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');

function hoja(cab) {
  const filas = [cab.slice()];
  const sh = {
    filas,
    appendRow: r => filas.push(r.slice()),
    getLastRow: () => filas.length,
    getLastColumn: () => Math.max(...filas.map(f => f.length)),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => filas.slice(r - 1, r - 1 + nr).map(f => Array.from({ length: nc }, (_, j) => f[c - 1 + j] === undefined ? '' : f[c - 1 + j])),
      setValues: v => v.forEach((f, i) => f.forEach((x, j) => { filas[r - 1 + i][c - 1 + j] = x; })),
      setValue: x => { filas[r - 1][c - 1] = x; }
    })
  };
  return sh;
}
function caja(o = {}) {
  const props = Object.assign({}, o.props || {}), drive = { archivos: [], publicos: 0 }, ajustes = [];
  let n = 0;
  const blob = (bytes, mime, nombre) => {
    const b = { _b: Buffer.isBuffer(bytes) ? bytes : Buffer.from(typeof bytes === 'string' ? bytes : bytes), _m: mime, _n: nombre,
      getBytes: () => Array.from(b._b), getDataAsString: () => b._b.toString('utf8'), getContentType: () => b._m, getName: () => b._n,
      setContentType: x => { b._m = x; return b; }, copyBlob: () => blob(b._b, b._m, b._n) };
    return b;
  };
  const carpeta = { getId: () => 'carpeta', setSharing: () => { drive.publicos++; },
    createFile: b => { const id = 'f' + (++n); const f = { b, desc: '', getId: () => id, getBlob: () => b, setSharing: () => { drive.publicos++; }, setDescription: d => { f.desc = d; } }; drive.archivos.push(f); return f; } };
  const hojas = { ALMA_BIBLIOTECA: null, ALMA_PARA_CLAUDE: o.paraClaude || null };
  const ZIPS = { SKILL: [['mi-skill/SKILL.md', '# Tono\nHabla simple.'], ['mi-skill/ejemplo.py', 'print(1)'], ['mi-skill/logo.png', 'PNG'], ['__MACOSX/._SKILL.md', 'x']] };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, Buffer, Promise,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: { base64Decode: s => Buffer.from(s, 'base64'), base64Encode: a => Buffer.from(a).toString('base64'), newBlob: blob,
      unzip: b => (ZIPS[b._b.toString('utf8')] || (() => { throw new Error('zip'); })()).map(([nm, t]) => ({ getName: () => nm, getDataAsString: () => t })),
      computeDigest: (alg, t) => Array.from(crypto.createHash('sha256').update(String(t), 'utf8').digest()).map(x => x > 127 ? x - 256 : x),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' } },
    DriveApp: { createFolder: () => carpeta, getFolderById: () => carpeta, getFileById: id => drive.archivos.find(f => f.getId() === id) },
    hojaCrear_: (nom, cab) => hojas[nom] || (hojas[nom] = hoja(cab)),
    ssAlma_: () => ({ getSheetByName: nom => hojas[nom] }),
    paraClaudePrincipalSes_: ses => ses && ses.email === 'juan@x.com' ? { email: 'juan@x.com', nombre: 'Juan', principal: true } : null,
    almaDocxTexto_: () => ({ texto: 'Word' }), correoXlsxTabla_: () => ({ texto: 'a | b' }),
    microResponder_: (adm, micro, texto, op) => { ajustes.push({ micro, texto }); return { ok: true }; }
  };
  ctx.paraClaudeHuella_ = t => sha(t);
  vm.createContext(ctx);
  vm.runInContext(leer('biblioteca.js'), ctx, { filename: 'biblioteca.js' });
  return { ctx, drive, props, hojas, ajustes };
}
const b64 = t => Buffer.from(t).toString('base64');
const JUAN = { email: 'juan@x.com' }, OTRO = { email: 'flor@x.com' };

/* 1. Compartir */
const c = caja();
{
  const S = c.ctx.bibliotecaSubir_;
  ok(!S(OTRO, { nombre: 'x', texto: 'hola' }).ok && !c.drive.archivos.length, 'alguien que no es el principal no comparte nada');
  ok(!c.ctx.bibliotecaLista_(OTRO).ok, 'ni ve la biblioteca');
  const md = S(JUAN, { tipo: 'skill', nombre: 'Tono Spacio', para_que: 'escribir a huéspedes', data: 'data:text/markdown;base64,' + b64('# Tono\nCálido y corto.'), mime: '', archivo: 'tono.md' });
  ok(md.ok && md.documento.tipo === 'skill' && md.documento.caracteres > 5 && !md.documento.solo_archivo, 'un .md (sin tipo del navegador) se guarda y se lee su texto');
  const zip = S(JUAN, { tipo: 'skill', nombre: 'Mi skill', data: b64('SKILL'), mime: 'application/zip', archivo: 'mi-skill.skill' });
  const tZip = c.drive.archivos.find(f => /Mi skill\.txt$/.test(f.b.getName()));
  ok(zip.ok && tZip && /=== mi-skill\/SKILL\.md ===/.test(tZip.b.getDataAsString()) && /print\(1\)/.test(tZip.b.getDataAsString()) && !/PNG|__MACOSX/.test(tZip.b.getDataAsString()),
    'un .skill (zip) junta sus archivos de texto, sin imágenes ni basura de macOS');
  const pdf = S(JUAN, { tipo: 'documento', nombre: 'Contrato', data: b64('%PDF-1.4'), mime: 'application/pdf', archivo: 'contrato.pdf' });
  ok(pdf.ok && pdf.documento.solo_archivo, 'un PDF se guarda y Claudio lo lee del original (sin gastar IA)');
  const peg = S(JUAN, { tipo: 'documento', nombre: 'Reglas de casa', texto: 'No fiestas.' });
  ok(peg.ok && c.drive.archivos.some(f => f.b.getName() === 'Reglas de casa.md'), 'el texto pegado se guarda como .md');
  const antes = c.drive.archivos.length;
  ok(!S(JUAN, { nombre: 'x', data: b64('MZ'), mime: 'application/x-msdownload', archivo: 'x.exe' }).ok && c.drive.archivos.length === antes, 'un tipo que no se puede leer no se guarda');
  ok(!S(JUAN, { nombre: 'x' }).ok && !S(JUAN, { texto: 'sin nombre' }).ok, 'sin archivo ni texto, o sin nombre, no se guarda');
  ok(!S(JUAN, { nombre: 'x', data: 'A'.repeat(11500001), archivo: 'x.md' }).ok, 'más de 8 MB no se guarda');
  ok(c.drive.publicos === 0 && /Biblioteca de Claudio/.test(c.drive.archivos[0].desc), 'todo queda privado (nunca con enlace) y con su descripción');
  const L = c.ctx.bibliotecaLista_(JUAN);
  ok(L.ok && L.documentos.length === 4 && L.documentos[0].nombre === 'Reglas de casa' && !('drive_id' in L.documentos[0]), 'la lista: lo más nuevo primero y sin ids de Drive');
}
/* 2. Cada pedido lleva la lista */
{
  const t = c.ctx.bibliotecaParaClaude_('https://hub/exec');
  ok(/Biblioteca de Claudio/.test(t) && /«Tono Spacio» · escribir a huéspedes/.test(t) && /PDF, pide "crudo":1/.test(t) && /"lector"/.test(t) && /"pide"/.test(t) && /https:\/\/hub\/exec/.test(t),
    'la instrucción trae la lista, cómo leer con el lector y cómo pedir');
  ok(!/"llave"/.test(t), 'la lectura nunca usa la llave de responder');
  c.props.BIBLIO_ON = '0'; ok(c.ctx.bibliotecaParaClaude_('u') === '', 'BIBLIO_ON = 0 la quita de los pedidos'); delete c.props.BIBLIO_ON;
}
/* 3. Claudio lee con el lector de su pedido */
{
  const cab = ['id', 'fecha', 'quien', 'app', 'tipo', 'prioridad', 'titulo', 'detalle', 'estado', 'issue', 'sesion', 'respuesta', 'llave', 'simple', 'chat', 'micro', 'nivel', 'lector', 'fecha_lector'];
  const pc = hoja(cab), fila = cab.map(() => '');
  Object.assign(fila, { 0: 'pc1', 12: sha('LLAVE'), 15: 'mp1', 17: sha('LECTOR'), 18: Date.now() });
  pc.appendRow(fila);
  const vieja = cab.map(() => ''); Object.assign(vieja, { 0: 'pc0', 17: sha('VIEJO'), 18: Date.now() - 25 * 3600000 }); pc.appendRow(vieja);
  c.hojas.ALMA_PARA_CLAUDE = pc;
  const C = c.ctx.bibliotecaClaude_, id = c.ctx.bibliotecaLista_(JUAN).documentos.find(d => d.nombre === 'Tono Spacio').id;
  ok(C({ id: 'pc1', lector: 'MAL', doc: id }).error === 'lector' && C({ id: 'pc1', llave: 'LLAVE', doc: id }).error === 'lector', 'sin el lector correcto (ni con la llave de responder) no lee nada');
  ok(/vencido/.test(C({ id: 'pc0', lector: 'VIEJO' }).error), 'el lector vence a las 24 h');
  const lista = C({ id: 'pc1', lector: 'LECTOR' });
  ok(lista.ok && lista.documentos.length === 4, 'sin «doc» devuelve la lista');
  const d = C({ id: 'pc1', lector: 'LECTOR', doc: id });
  ok(d.ok && /Cálido y corto/.test(d.texto) && d.sigue === null, 'con «doc» devuelve el texto');
  const pid = c.ctx.bibliotecaLista_(JUAN).documentos.find(x => x.nombre === 'Contrato').id;
  const p = C({ id: 'pc1', lector: 'LECTOR', doc: pid }), cr = C({ id: 'pc1', lector: 'LECTOR', doc: pid, crudo: 1 });
  ok(p.ok && /crudo/.test(p.nota) && Buffer.from(cr.base64, 'base64').toString() === '%PDF-1.4' && cr.mime === 'application/pdf', 'el PDF: pide «crudo» y recibe el original');
  const largo = c.ctx.bibliotecaSubir_(JUAN, { nombre: 'Largo', texto: 'x'.repeat(70000) }).documento.id;
  const p1 = C({ id: 'pc1', lector: 'LECTOR', doc: largo }), p2 = C({ id: 'pc1', lector: 'LECTOR', doc: largo, desde: p1.sigue });
  ok(p1.texto.length === 60000 && p1.sigue === 60000 && p2.texto.length === 10000 && p2.sigue === null && p1.total === 70000, 'lo largo llega en páginas y sigue con «desde»');
  ok(c.ctx.bibliotecaQuitar_(JUAN, id).ok && !C({ id: 'pc1', lector: 'LECTOR', doc: id }).ok && !c.ctx.bibliotecaParaClaude_('u').includes('Tono Spacio') && c.drive.archivos.length > 0,
    'quitar: Claudio ya no lo ve ni lo lee, y el archivo se queda en el Drive');
  ok(!c.ctx.bibliotecaQuitar_(OTRO, largo).ok, 'solo el principal quita');
}
/* 4. Claudio pide */
{
  const k = caja();
  ok(k.ctx.biblioPedir_('mp9', 'Uber con Alma', 'el skill de tarifas de Uber') && k.ctx.bibliotecaLista_(JUAN).pedidos[0].que === 'el skill de tarifas de Uber', 'lo que Claudio pide aparece arriba en la biblioteca');
  k.ctx.biblioPedir_('mp9', 'Uber con Alma', 'mejor el PDF de tarifas');
  ok(k.ctx.bibliotecaLista_(JUAN).pedidos.length === 1, 'uno por microproyecto: el último manda');
  const r = k.ctx.bibliotecaSubir_(JUAN, { tipo: 'documento', nombre: 'Tarifas', texto: 'Q 50 al aeropuerto', pedido: 'mp9' });
  ok(r.ok && k.ajustes.length === 1 && k.ajustes[0].micro === 'mp9' && new RegExp('id ' + r.documento.id).test(k.ajustes[0].texto) && /Claudio ya lo tiene en «Uber con Alma»/.test(r.claudio),
    'al compartirlo desde el pedido, sale solo como ajuste de su microproyecto con el id');
  ok(!k.ctx.bibliotecaLista_(JUAN).pedidos.length, 'y el pedido deja de esperar');
  k.ctx.bibliotecaSubir_(JUAN, { nombre: 'Otra', texto: 'x', pedido: 'mp9' });
  ok(k.ajustes.length === 1, 'un pedido ya atendido no vuelve a mandar ajuste');
  k.ctx.biblioPedir_('mp8', 'Otro', 'algo');
  ok(k.ctx.bibliotecaPedidoDejar_(JUAN, 'mp8').ok && !k.ctx.bibliotecaLista_(JUAN).pedidos.length && !k.ajustes.some(a => a.micro === 'mp8'), '«No lo tengo» deja de esperar sin mandar nada');
  k.props.BIBLIO_PEDIDOS = JSON.stringify([{ micro: 'mp7', nombre: 'Viejo', que: 'x', ts: Date.now() - 15 * 86400000 }]);
  ok(!k.ctx.bibliotecaLista_(JUAN).pedidos.length, 'lo pedido hace más de 14 días se olvida');
}
/* 5. Conexiones */
{
  const pc = leer('paraclaude.js'), cod = leer('Código.js'), cupo = leer('cupo.js');
  ok(/'lector', 'fecha_lector'\]/.test(pc) && /bibliotecaParaClaude_\(hubUrl\)/.test(pc) && /biblioteca: lector \? \{ lector: lector \}/.test(pc) && /paraClaudeHuella_\(lector\)/.test(pc),
    'paraClaudeCrear_: la lista en la instrucción, el lector en el pedido y solo su huella en la hoja');
  const crear = pc.slice(pc.indexOf('function paraClaudeCrear_'), pc.indexOf('function paraClaudeDesdeChat_'));
  ok(/var cuerpo = /.test(crear) && !/cuerpo\s*\+=?\s*biblio|biblio[^\n]*microComentar_/.test(crear) && crear.indexOf('bibliotecaParaClaude_') > crear.indexOf('microComentar_(issue, cuerpo)'), 'la biblioteca no va al issue (el repo es público)');
  ok(/biblioPedir_\(String\(v\[i\]\[15\]\)/.test(pc) && /Claudio necesita: /.test(pc) && /sh\.getRange\(i \+ 2, 18\)\.setValue\(''\)/.test(pc), 'paraClaudeRespuesta_: «pide» queda en la biblioteca y el lector deja de servir al responder');
  ok(/body\.mejora && body\.action === 'biblioteca'/.test(cod) && /case 'bibliotecaSubir'/.test(cod) && /case 'bibliotecaQuitar'/.test(cod) && /case 'bibliotecaPedidoDejar'/.test(cod) && /case 'biblioteca':/.test(cod), 'el Hub sabe las acciones');
  ok(/biblioteca bibliotecaSubir bibliotecaQuitar bibliotecaPedidoDejar/.test(cupo), 'las acciones cuentan en el cupo de «inicio»');
  const ini = fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8'), pag = fs.readFileSync(path.join(RAIZ, 'alma', 'biblioteca.html'), 'utf8');
  ok(/id="p-biblioteca-f" hidden><a href="biblioteca\.html"/.test(ini) && /\$\("p-biblioteca-f"\)\.hidden = \$\("p-health-f"\)\.hidden/.test(ini), 'Ajustes tiene «Biblioteca de Claudio», solo para el principal');
  ok(/bibliotecaSubir/.test(pag) && /bibliotecaPedidoDejar/.test(pag) && /Claudio te pidió/.test(pag) && /\.skill/.test(pag) && /sa-sesion\.js/.test(pag), 'la página comparte, muestra lo que Claudio pidió y usa la sesión');
  const glo = fs.readFileSync(path.join(RAIZ, 'docs', 'GLOSARIO.md'), 'utf8');
  ok(/\*\*Biblioteca de Claudio\*\*/.test(glo), 'el glosario tiene «Biblioteca de Claudio»');
}
process.exit(fallo);
