/* Prueba de la foto del contacto (#567 T4, apps-script/fotoscontacto.js, bandejaesfera.js e index.html) con dobles: sin
   Google de verdad, sin hojas reales y sin fotos reales.
   Juan, 16-nov-2026: la familia, los amigos y los contactos sin reserva tienen foto en la bandeja, en este orden: los
   Contactos del iPhone (solo los números de la bandeja sin foto, nunca la agenda), los Contactos de Google y la que sube
   él a mano. Facebook e Instagram no. Las fotos son privadas (Drive del Hub) y nunca van en el repo ni con enlace público.
   Revisa que:
   1. la manual gana sobre las otras, la del iPhone sobre la de Google y una foto quitada a mano no vuelve sola;
   2. solo se guarda un JPEG de 256×256 o menos y de hasta 64 KB;
   3. sin sesión no hay fotos, «ver» devuelve solo la clave exacta que mandó la bandeja y lo demás es del principal;
   4. «faltan» da solo los WhatsApp de la bandeja sin foto (para el iPhone, también los que solo tienen la de Google);
   5. Google: solo esos números, solo fotos propias (no la letra), en 256 px JPEG, cada número una vez por semana;
   6. la carpeta y los archivos nunca se comparten y nada va a internet sin uf_;
   7. el Hub pide la foto aparte con sesión, el iPhone recibe a lo mucho 40 números y la foto a mano sale en 256 px JPEG.
   node .github/fotos-contactos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const CANDADO_ = fs.readFileSync(path.join(DIR, 'candado.js'), 'utf8') + '\n';   // el candado único (apps-script/candado.js)
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js'), FC = leer('fotoscontacto.js');
const HUB = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'), CLI = fs.readFileSync(path.join(RAIZ, 'js', 'alma-client.js'), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const linea = (src, re) => { const m = re.exec(src); if (!m) throw new Error('no encontré ' + re); return m[0].replace(/^const /, 'var '); };

/* Un JPEG mínimo (solo cabecera) del tamaño pedido: FFD8 · APP0 · SOF0 · FFD9. Bytes con signo, como en Apps Script. */
const jpeg = (ancho, alto, relleno) => {
  const app0 = [0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xFF, 0xC0, 0x00, 0x11, 0x08, alto >> 8, alto & 255, ancho >> 8, ancho & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Buffer.from([0xFF, 0xD8, ...app0, ...sof, ...new Array(relleno || 0).fill(0), 0xFF, 0xD9]);
};
const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
const dataUrl = (buf, mime) => 'data:' + (mime || 'image/jpeg') + ';base64,' + buf.toString('base64');

function caja(o) {
  o = o || {};
  const cache = {}, props = { FOTOS_CT_CARPETA_ID: '' }, drive = { archivos: {}, compartidos: 0, carpetas: 0, papelera: [] }, uso = { people: 0, uf: [], inbox: 0 };
  const hoja = { filas: null };
  const mkSheet = () => ({
    getLastRow: () => hoja.filas.length,
    getRange: (r, c, nr, nc) => ({
      getValues: () => hoja.filas.slice(r - 1, r - 1 + nr).map((f) => f.slice(c - 1, c - 1 + nc)),
      setValues: (v) => { v.forEach((f, i) => { hoja.filas[r - 1 + i] = f.slice(); }); }
    })
  });
  let nArch = 0;
  const carpeta = { getId: () => 'carpeta-1', getName: () => 'Fotos', setSharing: () => { drive.compartidos++; },
    createFile: (b) => { const id = 'f' + (++nArch); drive.archivos[id] = b; return { getId: () => id, setSharing: () => { drive.compartidos++; } }; } };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Object, String, Number, Math, Date, RegExp, Array, Error,
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      base64Decode: (s) => Array.from(Buffer.from(s, 'base64')).map((x) => (x > 127 ? x - 256 : x)),
      base64Encode: (b) => Buffer.from(b.map((x) => x & 255)).toString('base64'),
      newBlob: (bytes, mime, nombre) => ({ bytes, mime, nombre })
    },
    DriveApp: {
      createFolder: (n) => { drive.carpetas++; return carpeta; },
      getFolderById: (id) => { if (id === 'carpeta-1' && drive.carpetas) return carpeta; throw new Error('no existe'); },
      getFileById: (id) => ({ setTrashed: () => { drive.papelera.push(id); }, getBlob: () => ({ getBytes: () => (drive.archivos[id] || { bytes: [] }).bytes }) })
    },
    ssAlma_: () => ({ getSheetByName: () => (hoja.filas ? mkSheet() : null) }),
    hojaCrear_: (n, cab) => { if (!hoja.filas) hoja.filas = [cab.slice()]; return mkSheet(); },
    BANDEJA_ESFERA_CACHE_: 'bandeja_esfera_v1',
    hubInbox_: () => { uso.inbox++; return JSON.parse(JSON.stringify(o.inbox || [])); },
    bandejaEsferaFoto_: (filas) => filas,   // la foto del huésped, del login o de la reserva ya viene en .foto (bandejaesfera.js tiene su prueba)
    areasAdmin_: (ses) => (ses && ses.email === 'principal@x.com' ? { principal: true } : null),
    uf_: (url) => { uso.uf.push(url); const b = o.google && o.google.bytes ? o.google.bytes : jpeg(256, 256); return { getResponseCode: () => 200, getBlob: () => ({ getBytes: () => Array.from(b).map((x) => (x > 127 ? x - 256 : x)) }) }; }
  };
  if (o.people) ctx.People = { People: { Connections: { list: (who, q) => { uso.people++; return o.people(q); } } } };
  vm.createContext(ctx);
  vm.runInContext(CANDADO_ + [linea(COD, /const fin8_ = [^\n]*/), sacar(COD, 'normTel_'), FC].join('\n'), ctx);
  return { ctx, cache, props, drive, uso, hoja };
}
const P = { email: 'principal@x.com' }, E = { email: 'equipo@x.com' };
const inbox = [
  { conv_id: 'wa:50255550101', foto: '' },                       // familia, sin foto
  { conv_id: 'wa:50255550102', foto: 'https://fotos.x/login.jpg' }, // tiene la del login
  { conv_id: 'wa:50255550103', foto: '' },                       // sin foto
  { conv_id: 'wa:50255550104', foto: '' },                       // Juan la quitó
  { conv_id: 'r-huesped', foto: '' },                            // Airbnb: no es WhatsApp
  { conv_id: 'wa:50255550101', foto: '' }                        // repetido
];

/* ── 1 · Quién gana ── */
{
  const { ctx } = caja();
  ok(ctx.fctGana_('manual', 'iphone') && ctx.fctGana_('manual', 'google') && ctx.fctGana_('iphone', 'google'), 'la manual gana sobre el iPhone y Google, y el iPhone sobre Google');
  ok(!ctx.fctGana_('google', 'iphone') && !ctx.fctGana_('iphone', 'manual') && !ctx.fctGana_('google', 'manual'), 'Google no pisa al iPhone y ninguna automática pisa la manual');
  ok(!ctx.fctGana_('iphone', 'quitada') && !ctx.fctGana_('google', 'quitada') && ctx.fctGana_('manual', 'quitada'), 'una foto quitada a mano no vuelve sola (solo otra manual)');
  ok(ctx.fctGana_('google', '') && ctx.fctGana_('iphone', 'iphone') && !ctx.fctGana_('facebook', '') && !ctx.fctGana_('instagram', ''), 'sin foto, cualquiera de las 3; Facebook e Instagram no existen como origen');
}

/* ── 2 · Solo JPEG de 256×256 o menos ── */
{
  const { ctx } = caja();
  const t = ctx.fctJpegLado_(ctx.Utilities.base64Decode(jpeg(200, 180).toString('base64')));
  ok(t && t.ancho === 200 && t.alto === 180, 'lee el tamaño de un JPEG por su cabecera (200×180)');
  ok(ctx.fctRevisar_(dataUrl(jpeg(256, 256))).ok, 'acepta un JPEG de 256×256');
  ok(!ctx.fctRevisar_(dataUrl(jpeg(300, 256))).ok && !ctx.fctRevisar_(dataUrl(jpeg(256, 257))).ok, 'rechaza una foto de más de 256 px de lado');
  ok(!ctx.fctRevisar_(dataUrl(png, 'image/png')).ok && !ctx.fctRevisar_(png.toString('base64')).ok, 'rechaza lo que no es JPEG (aunque llegue sin data:)');
  ok(!ctx.fctRevisar_(dataUrl(jpeg(256, 256, 70 * 1024))).ok, 'rechaza una foto de más de 64 KB');
  ok(!ctx.fctRevisar_('').ok && !ctx.fctRevisar_('no es base64 !!').ok, 'rechaza lo vacío o ilegible');
}

/* ── 3, 4 y 6 · API, permisos, guardar y ver ── */
{
  const c = caja({ inbox });
  const { ctx, drive } = c;
  ok(!ctx.fotosContactoApi_(null, { que: 'ver', claves: ['55550101.x'] }).ok, 'sin sesión no hay fotos');
  ok(!ctx.fotosContactoApi_(E, { que: 'faltan' }).ok && !ctx.fotosContactoApi_(E, { que: 'subir', origen: 'manual', fotos: [{ tel: '50255550101', jpeg: dataUrl(jpeg(64, 64)) }] }).ok, 'pedir números o subir fotos es solo del administrador principal');
  ok(!ctx.fotosContactoApi_(P, { que: 'subir', origen: 'google', fotos: [{ tel: '50255550101', jpeg: dataUrl(jpeg(64, 64)) }] }).ok, 'por la API solo se sube del iPhone o a mano (Google lo trae el Hub solo)');
  ctx.fotosContactoApi_(P, { que: 'quitar', tel: '50255550104' });
  let f = ctx.fotosContactoApi_(P, { que: 'faltan' });
  ok(f.ok && JSON.stringify(f.tels) === JSON.stringify(['50255550101', '50255550103']), 'faltan: solo los WhatsApp de la bandeja sin foto, sin repetir ni los quitados a mano: ' + (f.tels || []).join(', '));
  const m = ctx.fotosContactoApi_(P, { que: 'subir', origen: 'manual', fotos: [{ tel: '+502 5555 0101', jpeg: dataUrl(jpeg(256, 256)) }] });
  const m0 = m.fotos && m.fotos[0];
  ok(m0 && m0.ok && /^55550101\.[a-z0-9]+$/.test(m0.clave), 'la foto a mano se guarda y vuelve su clave «últimos 8.versión»');
  const i1 = ctx.fotosContactoApi_(P, { que: 'subir', origen: 'iphone', fotos: [{ tel: '50255550101', jpeg: dataUrl(jpeg(128, 128)) }, { tel: '50255550103', jpeg: dataUrl(jpeg(128, 128)) }] });
  ok(i1.fotos[0].omitida && i1.fotos[1].ok && !i1.fotos[1].omitida, 'la del iPhone no pisa la manual, pero sí entra donde no hay foto');
  ok(Object.keys(drive.archivos).length === 2 && drive.carpetas === 1, 'cada foto es un archivo en UNA carpeta del Drive del Hub');
  ok(drive.compartidos === 0 && !/setSharing|ANYONE|addViewer|addEditor|getUrl\(|getDownloadUrl/.test(FC), 'ni la carpeta ni las fotos se comparten ni se pide su enlace');
  const cab = c.hoja.filas[0].join(',');
  ok(cab === 'tel,archivo,origen,actualizado,google_buscado' && c.hoja.filas.some((r) => r[0] === '50255550101' && r[2] === 'manual'), 'el índice ALMA_FOTOS guarda teléfono, archivo y origen');
  const ver = ctx.fotosContactoApi_(E, { que: 'ver', claves: [m0.clave, '55550101.otra', '55550103.zz', 'cualquier-cosa'] });
  ok(ver.ok && Object.keys(ver.fotos).join() === m0.clave && /^data:image\/jpeg;base64,/.test(ver.fotos[m0.clave]), '«ver» devuelve solo la clave exacta que mandó la bandeja (otra versión o un número adivinado, nada)');
  f = ctx.fotosContactoApi_(P, { que: 'faltan' });
  ok(f.tels.length === 0, 'con foto guardada ya no se pide al iPhone');
  ctx.fotosContactoApi_(P, { que: 'quitar', tel: '50255550101' });
  ok(c.drive.papelera.length === 1 && ctx.fctVersiones_()['55550101'] === undefined, 'quitar manda la foto a la papelera y la bandeja vuelve a las iniciales');
  ok(ctx.fotosContactoApi_(P, { que: 'subir', origen: 'iphone', fotos: [{ tel: '50255550101', jpeg: dataUrl(jpeg(64, 64)) }] }).fotos[0].omitida, 'después de quitarla, el iPhone no la vuelve a poner');
}

/* ── 5 · Contactos de Google ── */
{
  const tel = (v) => ({ value: v });
  const personas = (q) => ({ connections: [
    { phoneNumbers: [tel('+502 5555-0101')], photos: [{ url: 'https://lh3.x/a=s100', default: true }] },              // la letra: no es foto
    { phoneNumbers: [{ value: '5555 0103', canonicalForm: '+50255550103' }], photos: [{ url: 'https://lh3.x/b=s100' }] }, // sí
    { phoneNumbers: [tel('+502 5555 0199')], photos: [{ url: 'https://lh3.x/z=s100' }] }                                 // no está en la bandeja
  ], totalPeople: 3, nextPageToken: q.pageToken ? '' : '' });
  const c = caja({ inbox, people: personas });
  const r = c.ctx.fotosGoogleRepasar_({ ahora: Date.parse('2026-11-16T12:00:00Z') });
  ok(r.ok && r.encontradas === 1 && r.buscados === 3, 'busca solo los números de la bandeja sin foto y guarda solo los que tienen foto propia (no la letra)');
  ok(c.uso.uf.length === 1 && c.uso.uf[0] === 'https://lh3.x/b=s256-c-rj', 'baja la foto en 256 px y JPEG (=s256-c-rj), por uf_');
  ok(!c.hoja.filas.some((x) => x[0] === '50255550199'), 'un contacto que no está en la bandeja no se guarda (nunca la agenda)');
  ok(c.hoja.filas.some((x) => x[0] === '50255550103' && x[2] === 'google') && c.hoja.filas.some((x) => x[0] === '50255550101' && x[4]), 'queda la de Google y la marca de búsqueda de cada número');
  const n0 = c.uso.people;
  c.ctx.fotosGoogleRepasar_({ ahora: Date.parse('2026-11-17T12:00:00Z') });
  ok(c.uso.people === n0, 'al día siguiente no vuelve a preguntarle a Google por los mismos números (una vez por semana)');
  const f = c.ctx.fotosContactoApi_(P, { que: 'faltan' });
  ok(f.tels.indexOf('50255550103') >= 0, 'para el iPhone, un número con solo la foto de Google sigue en la lista (la del iPhone va antes)');
  const c2 = caja({ inbox: [{ conv_id: 'wa:50255550101', foto: '' }] });
  ok(c2.ctx.fotosGoogleRepasar_({}).ok === false && c2.uso.people === 0, 'sin el servicio People (o sin permiso) no hace nada y no rompe');
  const c3 = caja({ inbox: [{ conv_id: 'wa:50255550102', foto: 'https://fotos.x/login.jpg' }], people: personas });
  c3.ctx.fotosGoogleRepasar_({});
  ok(c3.uso.people === 0, 'si no falta ninguna foto, no se le pregunta a Google');
}

/* ── 6 · Código ── */
ok(!/UrlFetchApp/.test(FC), 'fotoscontacto.js va a internet solo por uf_');
ok(!/facebook|instagram/i.test(FC.replace(/Facebook e Instagram no[^\n]*/g, '')), 'no se usan Facebook ni Instagram');
const man = JSON.parse(leer('appsscript.json'));
// People pide un permiso nuevo («Ver tus contactos»): se agrega en su propio PR cuando Juan puede autorizarlo al momento.
// Mientras no esté, Google no se consulta y el resto (iPhone y a mano) funciona igual.
const conPeople = (man.dependencies.enabledAdvancedServices || []).some((s) => s.userSymbol === 'People' && s.serviceId === 'peopleapi');
ok(conPeople || /typeof People === 'undefined'/.test(FC), 'sin el servicio People en appsscript.json, Google se salta sin romper (' + (conPeople ? 'People activo' : 'People pendiente de autorizar') + ')');
ok(/case 'fotosContacto': return json_\(fotosContactoApi_\(ses, body\)\)/.test(COD), 'la acción fotosContacto pasa la sesión verificada');
ok(/try \{ fotosGoogleRepasar_\(\); \} catch/.test(COD), 'Google se repasa en la rutina de cada hora (aprender) y un error no la tumba');
ok(/fotosCt: fotosCt \}/.test(COD), 'la bandeja manda la foto del contacto de todas las conversaciones, también las quietas');

/* ── 7 · El Hub ── */
ok(/fotosContacto: function \(b\) \{ return call\('fotosContacto', b \|\| \{\}\); \}/.test(CLI), 'el cliente del Hub pide las fotos por el Apps Script (con la sesión)');
const met = (n) => { const m = new RegExp('\\n  ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}').exec(HUB); return m ? m[0] : ''; };
const fc = met('fotoContacto'), fp = met('fotoContactoPedir'), fi = met('fotosIphone'), fm = met('fotoContactoElegir'), fq = met('fotoCuadrada');
ok(!!fc && /foto_contacto/.test(fc) && /fotosCt/.test(fc), 'el Hub usa foto_contacto (de la fila o del mapa de la bandeja) como 4.ª fuente');
ok(/que: "ver", claves: claves/.test(fp) && /slice\(0, 12\)/.test(fp), 'el Hub pide las fotos aparte, de a 12');
ok(/var fotoDe = function \(g\) \{[^\n]*self\.fotoContacto\(ib\)/.test(HUB), 'círculos y lista toman la foto del contacto antes de las iniciales');
ok(/messageHandlers\.alma/.test(fi) && /this\.rol\(\) !== "admin"/.test(fi) && /slice\(0, 40\)/.test(fi) && /12 \* 3600000/.test(fi), 'el iPhone recibe solo los números sin foto, del principal, a lo mucho 40 y cada 12 h');
ok(/accion: "fotosContactos", numeros: tels/.test(fi) && /origen: "iphone"/.test(fi) && /permiso === "negado"/.test(fi), 'lo que devuelve el iPhone se sube como «iphone» y un permiso negado no se vuelve a pedir enseguida');
ok(/fotoCuadrada\(f, 256\)/.test(fm) && /origen: "manual"/.test(fm) && /toDataURL\("image\/jpeg"/.test(fq), 'la foto a mano se recorta cuadrada a 256 px JPEG en el teléfono antes de subirla');
ok(/c\.fotoCtHay = String\(g\.key\)\.indexOf\("wa:"\) === 0 && self\.rol\(\) === "admin"/.test(HUB), 'el botón de subir foto sale solo en WhatsApp y solo al principal');

process.exit(fallo);
