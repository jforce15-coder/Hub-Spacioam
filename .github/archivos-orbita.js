/* Archivos en órbita y Carpeta de archivos (Juan, 18-nov-2026; apps-script/archivosorbita.js) con dobles: sin Drive, sin IA.
   Juan: «tiene que verse en el chat, pero también en las órbitas… durante las próximas 5 interacciones: 5 llamadas, 5 inicios
   de chat. Modo Inicio no cuenta… Una vez que pasaron esas 5 interacciones, el archivo pasa a una carpetita».
   1. Un archivo o una foto del chat queda en órbita con su descripción corta (si el modelo no responde, el nombre).
   2. El contador: cada llamada (vozWebVincular_) y cada chat cuentan una vez; la misma clave no cuenta dos veces; lo que
      llegó después de empezar la conversación no cuenta esa vuelta. A la 5.ª pasa a la carpeta; ya no va en la voz.
   3. La pantalla nunca recibe el resumen ni el drive_id; la voz sí lleva el resumen; quitar, usar otra vez y borrar.
   4. Cada persona tiene lo suyo; sin sesión, nada. Una lista larga no pasa de 9 KB.
   5. Los ganchos: la acción existe y cuenta en el canal «inicio», almaArchivo y almaFoto (no la captura) pasan por la
      órbita, la ficha de la voz los lleva, la llamada cuenta en vozWebVincular_, y el chat y el inicio los pintan.
   node .github/archivos-orbita.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

function caja(modelo) {
  const props = {}; let ahora = Date.parse('2026-11-18T15:00:00Z');
  const D = class extends Date { constructor(...a) { super(...(a.length ? a : [ahora])); } static now() { return ahora; } };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date: D, CFG: { MODELO_CLASIFICADOR: 'rapido' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { computeDigest: (a, t) => Array.from(require('crypto').createHash('md5').update(String(t)).digest()).map(b => (b > 127 ? b - 256 : b)), DigestAlgorithm: { MD5: 'md5' } },
    claude_: () => (modelo === undefined ? '{"desc": "Factura de luz", "resumen": "Factura de luz por Q 350, vence el 30 de noviembre."}' : modelo)
  };
  vm.createContext(ctx);
  vm.runInContext(leer('archivosorbita.js'), ctx, { filename: 'archivosorbita.js' });
  return { ctx, props, pasa: ms => { ahora += ms; } };
}
const JUAN = { email: 'juan@x.com' }, GABY = { email: 'gaby@x.com' };
const subir = (c, ses, nombre, texto) => c.ctx.archivoEnOrbita_(ses, { ok: true, nombre, texto, drive_id: 'drv-' + nombre }, nombre, '');

/* 1 */
{
  const c = caja(), r = subir(c, JUAN, 'factura-luz.pdf', 'FACTURA ... Q 350');
  ok(r.ok && r.orbita && r.orbita.desc === 'Factura de luz' && r.orbita.quedan === 5 && r.orbita.tipo === 'pdf', '1 · un archivo nuevo queda en órbita con su descripción corta y 5 vueltas por delante');
  const sin = caja('no sé'), r2 = subir(sin, JUAN, 'contrato_limpieza.docx', 'Contrato');
  ok(r2.orbita && r2.orbita.desc === 'contrato limpieza', '1 · si el modelo no responde, la descripción es el nombre sin extensión');
  const f = caja().ctx.archivoEnOrbita_(JUAN, { ok: true, texto: 'Se ve una factura' }, 'Foto', 'foto');
  ok(f.orbita && f.orbita.tipo === 'foto', '1 · una foto del chat también orbita');
  const malo = caja().ctx.archivoEnOrbita_(JUAN, { ok: false, error: 'x' }, 'x.pdf', '');
  ok(!malo.orbita, '1 · una subida que falló no orbita');
}
/* 2 */
{
  const c = caja(), A = c.ctx; const r = subir(c, JUAN, 'factura-luz.pdf', 'x'); c.pasa(1000);
  A.archivosInteraccion_(JUAN.email, 'voz:conv1'); A.archivosInteraccion_(JUAN.email, 'voz:conv1');
  let l = A.archivosOrbitaApi_(JUAN, {});
  ok(l.orbita[0].quedan === 4, '2 · la misma llamada cuenta una sola vez');
  const t0 = vm.runInContext('Date.now()', A); c.pasa(1000); const nuevo = subir(c, JUAN, 'gastos.xlsx', 'Luz | 350');
  A.archivosOrbitaApi_(JUAN, { que: 'interaccion', clave: 'k1', desde: t0 + 500 });
  l = A.archivosOrbitaApi_(JUAN, {});
  const q = id => l.orbita.filter(x => x.id === id)[0];
  ok(q(r.orbita.id).quedan === 3 && q(nuevo.orbita.id).quedan === 5, '2 · el chat donde llegó el archivo no le cuenta (llegó después de empezar)');
  ['voz:c2', 'voz:c3', 'chat:k2'].forEach(k => { c.pasa(1000); A.archivosInteraccion_(JUAN.email, k); });
  l = A.archivosOrbitaApi_(JUAN, {});
  ok(!l.orbita.some(x => x.id === r.orbita.id) && l.carpeta[0].id === r.orbita.id && l.carpeta[0].fecha, '2 · a la 5.ª interacción pasa a la Carpeta de archivos');
  ok(q(nuevo.orbita.id) === undefined ? l.orbita[0].quedan === 2 : true, '2 · el otro sigue en órbita con 2 por delante');
  const ficha = A.archivosFicha_(JUAN);
  ok(/gastos\.xlsx/.test(ficha) && !/factura-luz/.test(ficha), '2 · lo de la carpeta ya no va en la voz; lo de la órbita sí');
}
/* 3 */
{
  const c = caja(), A = c.ctx; const r = subir(c, JUAN, 'factura-luz.pdf', 'x');
  const l = A.archivosOrbitaApi_(JUAN, {}), s = JSON.stringify(l);
  ok(!/drv-|resumen|Q 350/.test(s), '3 · la pantalla no recibe el resumen ni el drive_id');
  ok(/Q 350/.test(A.archivosFicha_(JUAN)) && /factura-luz\.pdf/.test(A.archivosFicha_(JUAN)), '3 · la voz lleva el nombre y el resumen');
  for (let i = 0; i < 5; i++) { c.pasa(1000); A.archivosInteraccion_(JUAN.email, 'voz:x' + i); }
  const u = A.archivosOrbitaApi_(JUAN, { que: 'usar', id: r.orbita.id });
  ok(u.ok && u.orbita[0].quedan === 5 && !u.carpeta.length && /factura-luz\.pdf/.test(u.texto) && /Q 350/.test(u.texto), '3 · usar otra vez: vuelve a la órbita de cero y trae el texto para el chat');
  const q = A.archivosOrbitaApi_(JUAN, { que: 'quitar', id: r.orbita.id });
  ok(q.ok && !q.orbita.length, '3 · el ✕ antes de mandarlo lo quita de la órbita');
  ok(A.archivosOrbitaApi_(JUAN, { que: 'borrar', id: 'nada' }).ok === false, '3 · un id que no existe no rompe nada');
}
/* 4 */
{
  const c = caja(), A = c.ctx; subir(c, JUAN, 'a.pdf', 'x');
  ok(!A.archivosOrbitaApi_(GABY, {}).orbita.length && A.archivosFicha_(GABY) === '', '4 · cada persona ve solo lo suyo');
  ok(A.archivosOrbitaApi_(null, {}).ok === false, '4 · sin sesión, nada');
  for (let i = 0; i < 40; i++) { c.pasa(10); subir(c, JUAN, 'archivo-largo-' + i + '-' + 'x'.repeat(60) + '.pdf', 'y'.repeat(900)); }
  for (let i = 0; i < 5; i++) { c.pasa(1000); A.archivosInteraccion_(JUAN.email, 'voz:l' + i); }
  ok(Object.values(c.props).every(v => v.length <= 8500), '4 · lo guardado por persona no pasa de 9 KB');
  const l = A.archivosOrbitaApi_(JUAN, {});
  ok(l.orbita.length === 0 && l.carpeta.length <= 12, '4 · la carpeta guarda los 12 más nuevos');
}
/* 5 */
{
  const cod = leer('Código.js'), voz = leer('voz.js'), cupo = leer('cupo.js');
  ok(/case 'archivosOrbita': return json_\(archivosOrbitaApi_\(ses, body\)\)/.test(cod), '5 · la acción archivosOrbita existe');
  ok(/inicio: '[^']*\barchivosOrbita\b/.test(cupo), '5 · cuenta en el canal «inicio» del cupo');
  ok(/case 'almaArchivo': return json_\(archivoEnOrbita_\(ses, almaArchivo_\(/.test(cod) && /case 'almaFoto': return json_\(body\.captura \? almaFoto_\([^)]*\) : archivoEnOrbita_\(/.test(cod), '5 · almaArchivo y almaFoto (no la captura) pasan por la órbita');
  ok(/dv\.quien_llama \+= archivosFicha_\(adm\)/.test(voz), '5 · la ficha de la voz lleva los archivos en órbita');
  const vinc = voz.slice(voz.indexOf('function vozWebVincular_'), voz.indexOf('function vozEsperaAudio_'));
  ok(/archivosInteraccion_\(adm\.email, 'voz:' \+ convId\)/.test(vinc), '5 · cada llamada que empieza cuenta una vuelta (vozWebVincular_)');
  const nav = fs.readFileSync(path.join(RAIZ, 'js/sa-nav.js'), 'utf8'), ini = fs.readFileSync(path.join(RAIZ, 'alma/inicio.html'), 'utf8');
  ok(/adjuntar: function/.test(nav) && /san-adj/.test(nav) && /archivosOrbita/.test(nav), '5 · el chat deja el archivo cargado hasta el próximo mensaje (SANav.adjuntar) y cuenta el chat');
  ok(/AlmaArchivos/.test(ini) && /id="b-arch"/.test(ini) && /id="b-nav"/.test(ini) && /addEventListener\("drop"/.test(ini), '5 · el inicio pinta los archivos en órbita, la Carpeta de archivos, el Navegador y recibe lo que se suelta');
}
process.exit(fallo);
