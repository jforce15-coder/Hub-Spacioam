/* Prueba con dobles de Ver video (apps-script/vervideo.js; Juan, 18-nov-2026: «tengo que poder compartir un link de
   TikTok y que tú puedas ver el video, entenderlo»), sin Sheets, Drive, GitHub ni IA de verdad.
   1. Reconoce el enlace: TikTok, Instagram, Facebook, YouTube y X (sin lo de rastreo, con el v de YouTube), un enlace o id
      de Drive, y el primer enlace de un texto. Otros sitios, no.
   2. Pedir: anota y lanza el workflow (repository_dispatch «ver-video» con id y url o drive); lo visto se reusa (30 días)
      y lo que se está viendo no se lanza dos veces. Si GitHub no lo lanza, lo dice con su código.
   3. Lo que llega del workflow: sin la llave, nada. «listo» guarda en Drive, arma el resumen con las hojas y lo cuenta en
      el hilo de Claudio (Propósito · Desarrollo) con una notificación; «error» lo cuenta con la pista de la carpeta.
   4. «trozo» solo da un archivo que se pidió y que está en la carpeta de desarrollo.
   5. La herramienta de Claudio: la primera vez «lo estoy viendo»; ya visto, el resumen y la transcripción.
   6. Privado: el workflow no deja artefactos ni imprime la transcripción, y toma lo del pedido por variables de entorno.
   node .github/ver-video.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const LLAVE = 'llave-de-prueba', DEV = '1S1P3dhd6W71SEgzSTUMyC_V_Gg_BNJX7';

function caja() {
  const filas = [['cab']], gh = [], chat = [], avisos = [], creados = [], claude = [];
  const archivos = {
    '1AbCdEfGhIjKlMnOpQrStUvWxYz012345': { nombre: 'recorrido.mp4', tipo: 'video/mp4', padres: [DEV], bytes: [1, 2, 3, 4] },
    '1ZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZz': { nombre: 'otro.mp4', tipo: 'video/mp4', padres: ['otra-carpeta'], bytes: [9] }
  };
  const carpeta = id => ({ getId: () => id, getParents: () => { let i = 0; const l = []; return { hasNext: () => i < l.length, next: () => l[i++] }; } });
  const sh = {
    getLastRow: () => filas.length, getLastColumn: () => 99,
    appendRow: r => filas.push(r.slice()),
    getRange: (r, c, nr, nc) => ({
      getValues: () => filas.slice(r - 1, r - 1 + nr).map(f => Array.from({ length: nc }, (_, j) => f[c - 1 + j] ?? '')),
      setValues: v => { v.forEach((f, i) => { filas[r - 1 + i] = f.slice(); }); }
    })
  };
  let lanzar = 204;
  const ctx = {
    console, JSON, Math, Date, Object, Array, String, Number, RegExp, isNaN,
    hojaCrear_: () => sh, celdaTexto_: x => String(x),
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'PARA_ALMA_AVISO_KEY' ? LLAVE : '', setProperty() {} }) },
    paraAlmaAvisoLlave_: () => LLAVE, paraAlmaLlaveIgual_: (a, b) => a === b, PARA_ALMA_REPO_: 'jforce15-coder/Hub-Spacioam',
    paraAlmaGh_: (m, ruta, cuerpo) => { gh.push({ m, ruta, cuerpo }); return { code: lanzar }; },
    adminsOp_: () => [{ email: 'juan@x', nombre: 'Juan', principal: true }], agPrincipal_: () => ({ email: 'juan@x', nombre: 'Juan', principal: true }),
    opGuardar_: (adm, de, canal, texto, acc, clas) => { chat.push({ de, canal, texto, clas }); return { id: 'op1' }; },
    CHAT_DESARROLLO_: { esfera: 'Propósito', subcategoria: 'Desarrollo' },
    avisoPoner_: (adm, tipo, d) => { avisos.push({ tipo, d }); },
    claude_: (modelo, max, sys, user, t, imgs) => { claude.push({ sys, user, imgs }); return 'Una persona limpia una cocina. Para Spacio AM: sirve para la guía de limpieza.'; },
    CFG: { MODELO_REDACTOR: 'm' },
    Utilities: { formatDate: () => '2026-11-18 10:00', base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64'), newBlob: (b, t, n) => ({ b, t, n }) },
    MimeType: { PLAIN_TEXT: 'text/plain' },
    ScriptApp: { getOAuthToken: () => 'tok' },
    uf_: () => ({ getResponseCode: () => 206, getContent: () => [1, 2, 3, 4] }),
    DriveApp: {
      createFolder: n => ({ getId: () => 'raiz', createFolder: m => { creados.push(m); return { getId: () => 'c1', createFile: (a, b) => { creados.push(typeof a === 'string' ? a : a.n); return { getId: () => 'f' + creados.length }; } }; } }),
      getFolderById: id => { throw new Error('no'); },
      getFileById: id => { const a = archivos[id] || (/^f\d+$/.test(id) ? { nombre: 'transcripcion.txt', tipo: 'text/plain', padres: ['c1'], bytes: [] } : null); if (!a) throw new Error('no existe');
        return { getName: () => a.nombre, getMimeType: () => a.tipo, getSize: () => a.bytes.length, getBlob: () => ({ getBytes: () => a.bytes, getDataAsString: () => '[0:00] hola' }),
          getParents: () => { let i = 0; return { hasNext: () => i < a.padres.length, next: () => carpeta(a.padres[i++]) }; } }; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'vervideo.js'), 'utf8'), ctx);
  return { ctx, filas, gh, chat, avisos, creados, claude, set lanzar(v) { lanzar = v; } };
}

/* 1. El enlace */
let c = caja();
const E = t => JSON.stringify(c.ctx.vvEntrada_(t));
ok(E('https://www.tiktok.com/@spacio/video/7311111111111111111?is_from_webapp=1&sender_device=pc') === '{"url":"https://www.tiktok.com/@spacio/video/7311111111111111111"}', '1 · TikTok sin lo de rastreo');
ok(E('mira esto https://vm.tiktok.com/ZMabc123/ porfa') === '{"url":"https://vm.tiktok.com/ZMabc123/"}', '1 · el enlace corto de TikTok dentro de un texto');
ok(E('https://www.instagram.com/reel/Cxyz123/?igsh=abc') === '{"url":"https://www.instagram.com/reel/Cxyz123/"}', '1 · Instagram');
ok(E('https://youtube.com/watch?v=abc123&t=30s') === '{"url":"https://youtube.com/watch?v=abc123"}' && /youtu\.be/.test(E('https://youtu.be/abc123')), '1 · YouTube con su v');
ok(/facebook\.com\/watch\?v=99/.test(E('https://www.facebook.com/watch?v=99&ref=share')) && /fb\.watch/.test(E('https://fb.watch/abc/')) && /x\.com/.test(E('https://x.com/a/status/1')), '1 · Facebook y X');
ok(E('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing') === '{"drive":"1AbCdEfGhIjKlMnOpQrStUvWxYz012345"}', '1 · un enlace de Drive');
ok(c.ctx.vvEntrada_('https://example.com/video.mp4') === null && c.ctx.vvEntrada_('hola') === null && c.ctx.vvEntrada_('https://tiktok.com.malo.io/x') === null, '1 · otros sitios, no');

/* 2. Pedir */
const adm = { email: 'juan@x', principal: true };
let r = c.ctx.vvPedir_(adm, 'https://www.tiktok.com/@a/video/1?x=1');
ok(r.ok && r.nuevo && c.gh.length === 1 && c.gh[0].ruta === '/repos/jforce15-coder/Hub-Spacioam/dispatches' && c.gh[0].cuerpo.event_type === 'ver-video' && /^vv\d+$/.test(c.gh[0].cuerpo.client_payload.id) && c.gh[0].cuerpo.client_payload.url === 'https://www.tiktok.com/@a/video/1', '2 · anota y lanza el workflow con id y url');
const id1 = c.gh[0].cuerpo.client_payload.id;
r = c.ctx.vvPedir_(adm, 'https://www.tiktok.com/@a/video/1');
ok(r.ok && r.viendo && c.gh.length === 1, '2 · si ya se está viendo, no lo lanza otra vez');
c.lanzar = 403;
r = c.ctx.vvPedir_(adm, 'https://www.instagram.com/reel/B1/');
ok(!r.ok && /403/.test(r.error) && /error/.test(c.filas[c.filas.length - 1].join('|')), '2 · si GitHub no lo lanza, lo dice con su código');
ok(!c.ctx.vvPedir_(adm, 'https://example.com/v').ok, '2 · un enlace que no es de una red, no');

/* 3. Lo que llega del workflow */
ok(c.ctx.vvApi_({ verVideo: 'listo', llave: 'otra', id: id1 }).ok === false && c.chat.length === 0, '3 · sin la llave, nada');
const jpg = Buffer.from('jpg').toString('base64');
r = c.ctx.vvApi_({ verVideo: 'listo', llave: LLAVE, id: id1, meta: { titulo: 'Cocina en 3 pasos', plataforma: 'tiktok' },
  resultado: { duracion: 15, idioma: 'es', segmentos: [{ i: 0, f: 7, t: 'Hola, vamos a limpiar.' }, { i: 7, f: 15, t: 'Primero los platos.' }] }, hojas: [{ desde: 1, hasta: 14, jpg }] });
const fila = c.filas.find(f => f[0] === id1);
ok(r.ok && fila && fila[6] === 'listo' && /Para Spacio AM/.test(fila[11]) && c.creados.includes('transcripcion.txt') && c.creados.includes('hoja_1.jpg') && c.creados.includes('video.json'), '3 · «listo» guarda en Drive (transcripción, hojas, datos) y el resumen');
ok(c.claude.length === 1 && c.claude[0].imgs.length === 1 && /^data:image\/jpeg;base64,/.test(c.claude[0].imgs[0]) && /\[0:07\] Primero los platos/.test(c.claude[0].user) && /formato_de_respuesta/.test(c.claude[0].sys), '3 · el resumen mira las hojas y lee la transcripción con tiempos (prompt en JSON)');
ok(c.chat.length === 1 && c.chat[0].canal === 'claudio' && c.chat[0].clas.subcategoria === 'Desarrollo' && /Ya vi el video «Cocina en 3 pasos»/.test(c.chat[0].texto) && c.avisos[0].tipo === 'video_visto', '3 · lo cuenta en el hilo de Claudio y con una notificación');
ok(c.ctx.vvApi_({ verVideo: 'listo', llave: LLAVE, id: id1 }).ya === true && c.chat.length === 1, '3 · lo mismo dos veces: una sola vez');
c.lanzar = 204;
c.ctx.vvPedir_(adm, 'https://www.instagram.com/reel/C2/');
const id2 = c.gh[c.gh.length - 1].cuerpo.client_payload.id;
c.ctx.vvApi_({ verVideo: 'listo', llave: LLAVE, id: id2, error: 'Instagram: This content requires login (use --cookies)' });
ok(c.chat.length === 2 && /carpeta de desarrollo/.test(c.chat[1].texto) && c.avisos[1].tipo === 'video_fallo', '3 · si no se pudo, lo dice con la pista de la carpeta');

/* 4. Trozos de Drive */
ok(c.ctx.vvApi_({ verVideo: 'trozo', llave: LLAVE, id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', desde: 0 }).ok === false, '4 · sin pedido abierto de ese archivo, no da nada');
c.ctx.vvPedir_(adm, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view');
r = c.ctx.vvApi_({ verVideo: 'trozo', llave: LLAVE, id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', desde: 0 });
ok(r.ok && r.total === 4 && r.datos === Buffer.from([1, 2, 3, 4]).toString('base64') && c.gh[c.gh.length - 1].cuerpo.client_payload.drive === '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', '4 · con el pedido, da el trozo (y el workflow recibió el id de Drive)');
c.ctx.vvPedir_(adm, '1ZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZz');
ok(/carpeta de desarrollo/.test(c.ctx.vvApi_({ verVideo: 'trozo', llave: LLAVE, id: '1ZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZz', desde: 0 }).error || ''), '4 · un archivo fuera de la carpeta de desarrollo, no');

/* 5. La herramienta de Claudio */
c = caja();
r = c.ctx.claudioVerVideo_(adm, { url: 'Mira este https://www.tiktok.com/@a/video/5' });
ok(r.ok && /Lo estoy viendo; te aviso en el hilo/.test(r.resultado), '5 · la primera vez: «lo estoy viendo»');
const id5 = c.gh[0].cuerpo.client_payload.id;
c.ctx.vvApi_({ verVideo: 'listo', llave: LLAVE, id: id5, meta: { titulo: 'T' }, resultado: { duracion: 9, segmentos: [{ i: 0, f: 3, t: 'hola' }] }, hojas: [] });
r = c.ctx.claudioVerVideo_(adm, { url: 'https://www.tiktok.com/@a/video/5' });
ok(r.ok && r.visto && /Para Spacio AM/.test(r.resumen) && /hola/.test(r.transcripcion) && /YA LO VISTE/.test(r.resultado) && c.gh.length === 1, '5 · ya visto: el resumen y la transcripción, sin volver a lanzarlo');
ok(!c.ctx.claudioVerVideo_(adm, { url: 'https://example.com' }).ok, '5 · un enlace que no sirve: lo dice');

/* 6. Privado */
const wf = fs.readFileSync(path.join(__dirname, 'workflows', 'ver-video.yml'), 'utf8'), py = fs.readFileSync(path.join(__dirname, 'ver-video', 'ver_video.py'), 'utf8');
ok(!/upload-artifact/.test(wf) && !/\$\{\{\s*github\.event\.(client_payload|inputs)\.[a-z]+\s*\}\}[^\n]*\n?/.test(wf.split('run: |').slice(1).join('')), '6 · el workflow no deja artefactos y no mete el pedido en el script (solo por variables de entorno)');
ok(/VV_LLAVE: \$\{\{ secrets\.PARA_ALMA_AVISO_KEY \}\}/.test(wf) && !/print\([^)]*(segmentos|transcrip|descripcion|LLAVE)/i.test(py.split('def main')[1].split("if __name__")[0]), '6 · la llave es un secreto y el script no imprime la transcripción, la descripción ni la llave');

process.exit(fallo);
