/* Mini estudio · el Hub (apps-script/estudio.js) con dobles: sin Drive, sin hoja y sin internet de verdad.
   Lo llama .github/estudio-calidad.js. Solo el principal y sus invitados; la toma va privada a «Sesión N»; un trozo o
   varios (subida reanudable de Drive con su Content-Range); un trozo incompleto o una toma de otra sesión no se guardan. */
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function (DIR, ok) {
  const src = fs.readFileSync(path.join(DIR, 'estudio.js'), 'utf8');
  const props = {}, cache = {}, archivos = [], carpetas = [], pedidos = [], filas = [];
  let publicos = 0, nid = 0;
  const carpeta = nombre => { const c = { nombre, id: 'c' + (++nid), getId: () => c.id, setSharing: () => publicos++,
    createFolder: x => carpeta(x), createFile: b => { const f = { b, id: 'f' + (++nid), getId: () => f.id, setSharing: () => publicos++, setDescription: d => { f.desc = d; } }; f.carpeta = c.nombre; archivos.push(f); return f; } };
    carpetas.push(c); return c; };
  const sh = { getLastRow: () => filas.length + 1, getLastColumn: () => 16, appendRow: r => filas.push(r),
    getRange: (r, c, nr) => ({ getValues: () => filas.slice(r - 2, r - 2 + nr), setValues() {} }) };
  const ctx = {
    console: { log() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: { base64Decode: s => Array.from(Buffer.from(s, 'base64')), newBlob: (d, m, n) => ({ d, m, n }) },
    DriveApp: { createFolder: n => carpeta(n), getFolderById: id => carpetas.find(c => c.id === id), getFileById: id => archivos.find(f => f.id === id) || { setDescription() {} } },
    ScriptApp: { getOAuthToken: () => 'tok' },
    hojaCrear_: () => sh,
    paraClaudePrincipalSes_: s => s && s.email === 'juan@x.com' ? { email: 'juan@x.com', principal: true } : null,
    uf_: (url, o) => {
      pedidos.push({ url, o });
      if (/uploadType=resumable/.test(url)) return { getResponseCode: () => 200, getHeaders: () => ({ Location: 'https://subida/1' }), getContentText: () => '' };
      const [, a, b, t] = /bytes (\d+)-(\d+)\/(\d+)/.exec(o.headers['Content-Range']).map(Number);
      return b + 1 === t ? { getResponseCode: () => 201, getContentText: () => '{"id":"drive9"}' } : { getResponseCode: () => 308, getContentText: () => '' };
    }
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const juan = { email: 'juan@x.com' }, lucia = { email: 'lucia@x.com' }, otro = { email: 'otro@x.com' };
  const b64 = n => Buffer.alloc(n, 1).toString('base64');
  ok(!ctx.estudioEstadoApi_(null).ok && !ctx.estudioEstadoApi_(otro).ok && ctx.estudioEstadoApi_(juan).ok, 'Estudio: sin sesión o sin invitación no entra; el principal sí');
  ok(!ctx.estudioInvitarApi_(otro, { email: 'lucia@x.com' }).ok && ctx.estudioInvitarApi_(juan, { email: 'Lucia@x.com' }).ok, 'Estudio: solo el principal invita');
  ok(ctx.estudioEstadoApi_(lucia).ok && !ctx.estudioEstadoApi_(lucia).invitados && !ctx.estudioInvitarApi_(lucia, { email: 'z@x.com' }).ok, 'Estudio: la invitada graba, pero no ve ni cambia la lista');
  const meta = { segundos: 3.2, pico: -9.1, rms: -22, ruido: -68, snr: 46, semaforo: 'verde', problemas: [], hz: 48000 };
  const r1 = ctx.estudioSubirApi_(lucia, { sesion: 1, toma: 'S1-E01-01', intento: 1, n: 0, total: 1, bytes: 1000, data: b64(1000), meta });
  ok(r1.ok && r1.listo && archivos.length === 1 && archivos[0].carpeta === 'Sesión 1' && filas.length === 1 && filas[0][2] === 'S1-E01-01' && filas[0][13] === 'lucia@x.com',
    'Estudio: una toma corta se guarda en «Voz oficial de Alma / Sesión 1» con su fila (sin audio en la hoja)');
  ok(!ctx.estudioSubirApi_(juan, { sesion: 1, toma: 'S2-E01-01', intento: 1, n: 0, total: 1, bytes: 1000, data: b64(1000) }).ok, 'Estudio: una toma de otra sesión no se guarda');
  ok(!ctx.estudioSubirApi_(juan, { sesion: 1, toma: 'S1-E01-02', intento: 1, n: 0, total: 1, bytes: 1000, data: b64(900) }).ok, 'Estudio: un trozo incompleto no se guarda');
  ok(!ctx.estudioSubirApi_(otro, { sesion: 1, toma: 'S1-E01-02', intento: 1, n: 0, total: 1, bytes: 1000, data: b64(1000) }).ok, 'Estudio: alguien sin invitación no sube');
  const T = ctx.ESTUDIO_TROZO_, total = 2 * T + 500, partes = [T, T, 500];
  let r; partes.forEach((len, n) => { r = ctx.estudioSubirApi_(juan, { sesion: 2, toma: 'S2-L-03', intento: 2, n, total: 3, bytes: total, data: b64(len), meta: Object.assign({}, meta, { semaforo: 'amarillo', problemas: ['snr'] }) }); });
  const puts = pedidos.filter(p => p.o.method === 'put').map(p => p.o.headers['Content-Range']);
  ok(r.ok && r.listo && r.archivo === 'drive9' && puts.join('|') === `bytes 0-${T - 1}/${total}|bytes ${T}-${2 * T - 1}/${total}|bytes ${2 * T}-${total - 1}/${total}`,
    'Estudio: una toma larga sube en 3 trozos por la subida reanudable de Drive, cada uno con su rango');
  const init = pedidos.find(p => /resumable/.test(p.url));
  ok(init && JSON.parse(init.o.payload).parents[0] === carpetas.find(c => c.nombre === 'Sesión 2').id && JSON.parse(init.o.payload).name === 'S2-L-03_t02.wav', 'Estudio: la toma larga queda en «Sesión 2» con su nombre de toma e intento');
  ok(ctx.estudioSubirApi_(juan, { sesion: 3, toma: 'S3-L-01', intento: 1, n: 1, total: 2, bytes: T + 10, data: b64(10) }).reiniciar === true, 'Estudio: si se perdió la subida, la página empieza la toma de nuevo');
  ok(publicos === 0, 'Estudio: nada se comparte con enlace');
  const est = ctx.estudioEstadoApi_(juan);
  ok(est.tomas.length === 2 && est.tomas[1].semaforo === 'amarillo' && est.invitados.join() === 'lucia@x.com', 'Estudio: el estado trae lo guardado por sesión (para retomar) y los invitados');
  const pag = fs.readFileSync(path.join(DIR, '..', 'alma', 'estudio.html'), 'utf8'), cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
  ok(/echoCancellation:\s*false/.test(pag) && /noiseSuppression:\s*false/.test(pag) && /autoGainControl:\s*false/.test(pag), 'Estudio: la página pide el micrófono crudo (sin cancelación de eco, ruido ni ganancia automática)');
  ok(/AudioWorklet|audioWorklet/.test(pag) && /wav24/.test(pag) && !/MediaRecorder/.test(pag), 'Estudio: graba PCM con AudioWorklet y guarda WAV (nada comprimido)');
  ok(['estudio', 'estudioSubir', 'estudioInvitar'].every(a => cod.includes("case '" + a + "'")), 'Estudio: el Hub conoce sus tres acciones');
  const g = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'alma', 'estudio-guion.json'), 'utf8'));
  const ids = g.sesiones.flatMap(s => s.bloques.flatMap(b => b.tomas.map(t => t.id)));
  ok(g.sesiones.length === 3 && ids.every(id => ctx.ESTUDIO_TOMA_RE_.test(id)) && new Set(ids).size === ids.length, 'Estudio: el guion tiene 3 sesiones y cada toma un id único que el Hub acepta');
  const tipos = s => new Set(s.bloques.map(b => b.tipo));
  ok(g.sesiones.every(s => ['sala', 'calentamiento', 'base', 'escena', 'numeros', 'ingles', 'cierre'].every(t => tipos(s).has(t))), 'Estudio: cada sesión sirve sola (sala, calentamiento, base, escenas, números, inglés y cierre)');
};
