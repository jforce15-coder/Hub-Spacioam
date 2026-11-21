/* Prueba con dobles de «Buscar en todo» (apps-script/buscartodo.js, pedido pc1795284175075, #964), sin Google.
   Juan (21-nov-2026): «cuando Alma busque un Keyboard, encuentre toda una lista de archivos e información disponible».
   Revisa:
   1. solo el administrador principal; sin palabra, lo pide;
   2. junta en una lista fotos, archivos, correos, mensajes del chat y datos, con un resumen simple;
   3. una foto en órbita se encuentra por lo que describe su resumen (no solo por su nombre) y un archivo no sale dos veces;
   4. la consulta a Drive no trae la hoja del sistema ni carpetas, y no se le puede meter comillas;
   5. de quién es un correo: solo el nombre, nunca la dirección ni un teléfono;
   6. si una fuente falla, lo demás sale igual y dice cuál no pudo;
   7. está conectada: la herramienta en agente.js, su caso en agEjecutar_ y en el camino rápido de la voz.
   node .github/buscar-todo.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const BT = leer('buscartodo.js'), AG = leer('agente.js'), RA = leer('rapido.js');

function caja(op) {
  op = op || {};
  const consultas = { drive: [], gmail: [] };
  const archivo = (n, mime, id) => ({ getName: () => n, getMimeType: () => mime, getLastUpdated: () => new Date('2026-11-20T15:00:00Z'), getId: () => id, getUrl: () => 'https://drive/' + id });
  const drive = [archivo('Keyboard Logitech factura.pdf', 'application/pdf', 'd1'), archivo('IMG_2201.jpg', 'image/jpeg', 'd2'),
    archivo('bmwm8abc12 · Manual keyboard.txt', 'text/plain', 'd3'), archivo('foto escritorio.jpg', 'image/jpeg', 'd9')];
  const msg = (de, cuerpo, adj) => ({ getFrom: () => de, getPlainBody: () => cuerpo, getAttachments: () => (adj || []).map(n => ({ getName: () => n })) });
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Error,
    CFG: { TZ: 'America/Guatemala' },
    Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
    norm_: t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(),
    esAdminPrincipal_: a => !!(a && a.principal),
    DriveApp: { searchFiles: q => { if (op.sinDrive) throw new Error('Drive caído'); consultas.drive.push(q); let i = 0; return { hasNext: () => i < drive.length, next: () => drive[i++] }; } },
    GmailApp: { search: (q, a, n) => { consultas.gmail.push(q); return [{
      getMessages: () => [msg('Tienda <ventas@tienda.com>', 'Tu keyboard llega mañana. Dudas al +502 5555 1234 o a soporte@tienda.com', ['recibo.pdf'])],
      getFirstMessageSubject: () => 'Pedido keyboard', getLastMessageDate: () => new Date('2026-11-19T10:00:00Z') }]; } },
    archOrbDelPrincipal_: () => [{ email: 'p@x', x: { id: 'ar1', nombre: 'IMG_2201.jpg', desc: 'Escritorio de trabajo', resumen: 'Un keyboard negro y una pantalla', tipo: 'foto', drive_id: 'd2', estado: 'carpeta', t: 1, tc: Date.parse('2026-11-18T10:00:00Z') } },
      { email: 'p@x', x: { id: 'ar2', nombre: 'luz.pdf', desc: 'Factura de luz', resumen: 'EEGSA octubre', tipo: 'pdf', drive_id: 'd5', estado: 'orbita', t: 2 } }],
    biblioActivos_: () => [{ nombre: 'Manual keyboard', para_que: 'Cómo conectar el teclado', archivo: 'manual.pdf', mime: 'application/pdf', fecha: '2026-11-17', drive_id: 'd7', tipo: 'documento' }],
    chatBuscar_: (adm, inp) => ({ ok: true, encontrados: 1, mensajes: [{ fecha: 'viernes 2026-11-20 10:00', de: 'administrador', canal: 'app', texto: 'Compra otro keyboard para la oficina' }] }),
    buscadorBuscar_: q => ({ reservas: [], propiedades: [], contactos: [{ nombre: 'Tienda Keyboard', tipo: 'Proveedor', empresa: '' }] })
  };
  vm.createContext(ctx); vm.runInContext(BT, ctx);
  return { ctx, consultas };
}
const JUAN = { email: 'p@x', principal: true };

/* ── 1 ── */
{ const c = caja();
  ok(c.ctx.buscarTodo_({ email: 'e@x', principal: false }, { texto: 'keyboard' }).ok === false, '1 · solo el administrador principal');
  ok(/Dime qué buscar/.test(c.ctx.buscarTodo_(JUAN, { texto: '  de la ' }).error || ''), '1 · sin palabra, la pide'); }

/* ── 2 a 5 ── */
{ const c = caja(), r = c.ctx.buscarTodo_(JUAN, { texto: 'Keyboard' });
  ok(r.ok && r.fotos.length >= 1 && r.archivos.length >= 2 && r.correos.length === 1 && r.textos.length === 1 && r.datos.contactos.length === 1, '2 · junta fotos, archivos, correos, mensajes y datos');
  ok(/^Sobre «Keyboard» encontré .*foto.*archivos.*correo.*mensaje.*dato/.test(r.resumen), '2 · resumen simple: ' + r.resumen);
  const foto = r.fotos.find(f => f.drive_id === 'd2');
  ok(foto && foto.donde === 'Carpeta de archivos' && /keyboard/.test(foto.resumen) && foto.enlace === 'https://drive/d2', '3 · la foto se encuentra por lo que se ve en ella (resumen) y lleva su enlace');
  ok(r.fotos.concat(r.archivos).filter(a => a.drive_id === 'd2').length === 1, '3 · el mismo archivo no sale dos veces');
  ok(!r.fotos.concat(r.archivos).some(a => a.drive_id === 'd5'), '3 · lo que no habla del tema no sale (factura de luz)');
  ok(!r.archivos.some(a => /\.txt$/.test(a.nombre)), '3 · el texto sacado de la Biblioteca no se repite junto a su original');
  const q = c.consultas.drive[0] || '';
  ok(/trashed = false/.test(q) && /mimeType != 'application\/vnd\.google-apps\.spreadsheet'/.test(q) && /mimeType != 'application\/vnd\.google-apps\.folder'/.test(q) && /fullText contains 'keyboard'/.test(q), '4 · Drive: sin la hoja del sistema ni carpetas, por lo que dice');
  c.ctx.buscarTodo_(JUAN, { texto: "teclado' or name contains 'x" });
  ok(!/contains 'x'|' or /.test(c.consultas.drive[1] || ''), '4 · no se le pueden meter comillas a la consulta de Drive');
  ok(/^keyboard newer_than:\d+d$/.test(c.consultas.gmail[0] || ''), '4 · Gmail: la palabra, del último año');
  const s = JSON.stringify(r.correos);
  ok(r.correos[0].de === 'Tienda' && !/@|5555/.test(s) && r.correos[0].adjuntos[0] === 'recibo.pdf', '5 · el correo: solo el nombre de quien lo manda, sin direcciones ni teléfonos, con sus adjuntos'); }

/* ── 6 ── */
{ const c = caja({ sinDrive: true }), r = c.ctx.buscarTodo_(JUAN, { texto: 'keyboard' });
  ok(r.ok && r.correos.length === 1 && r.no_pude && r.no_pude.indexOf('Drive') >= 0 && r.fotos.length === 1, '6 · si Drive falla, lo demás sale y dice cuál no pudo'); }

/* ── 7 ── */
ok(/T\('buscar_todo', '[^']{20,110}', \{ texto: s\('[^']+'\) \}, \['texto'\]\)/.test(AG), '7 · la herramienta buscar_todo, descripción mínima');
ok(/case 'buscar_todo': return buscarTodo_\(adm, inp\);/.test(AG), '7 · agEjecutar_ la manda a buscarTodo_ con quien habla (de la sesión)');
ok(/VOZ_RAPIDO_HERR_ = \[[^\]]*'buscar_todo'/.test(RA), '7 · también en el camino rápido de la voz (solo lee)');
ok(!/UrlFetchApp/.test(BT), '7 · sin UrlFetch: no gasta el cupo de llamadas externas');

process.exit(fallo);
