/* Música en Spotify sin dispositivo activo (apps-script/musica.js) con dobles: sin Spotify ni Google.
   Juan, 17-nov-2026 (pedido pc1794924234976): «si no hay dispositivo activo de Spotify, reproducir por defecto en el
   dispositivo actual o predeterminado para que la música empiece de inmediato sin error».
   1. Con dispositivos pero ninguno sonando: elige el predeterminado (el último donde sonó), le pasa la reproducción y suena.
   2. Sin predeterminado: el teléfono antes que la bocina o la compu; los restringidos no cuentan.
   3. Si Spotify contesta 404 (no hay dispositivo activo) al primer play, lo activa y lo intenta otra vez.
   4. Sin ningún dispositivo en la lista: prueba el predeterminado por su id; si Spotify no lo acepta, el mensaje claro.
   5. El que está sonando y el que Juan nombra siguen mandando (no se cambia de dispositivo sin razón).
   node .github/musica-dispositivo.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = { email: 'juan@x.com', principal: true };
const TEL = { id: 'tel1', name: 'iPhone de Juan', type: 'Smartphone', is_active: false };
const SALA = { id: 'sala1', name: 'Bocina sala', type: 'Speaker', is_active: false };
const COMPU = { id: 'pc1', name: 'MacBook', type: 'Computer', is_active: false };
const TV = { id: 'tv1', name: 'Tele', type: 'TV', is_active: false, is_restricted: true };

function caja(o) {
  o = o || {};
  const props = Object.assign({ SPOTIFY_CLIENT_ID: 'x', SPOTIFY_CLIENT_SECRET: 'y', SPOTIFY_REFRESH: 'z' }, o.props || {});
  const cache = { sp_access: 't' }, llamadas = [];
  let activo = o.activo || '', primerPlay404 = !!o.primerPlay404;
  const conocidos = (o.conocidos || []).concat((o.lista || []).map(d => d.id));
  const resp = (code, j) => ({ getResponseCode: () => code, getContentText: () => (j ? JSON.stringify(j) : '') });
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: { sleep() {}, getUuid: () => 'u', base64Encode: s => s },
    esAdminPrincipal_: a => !!(a && a.principal), AGENTE_APP_: true,
    uf_: (url, op) => {
      const ruta = url.replace('https://api.spotify.com/v1', ''), m = (op.method || 'get').toLowerCase(), cuerpo = op.payload ? JSON.parse(op.payload) : null;
      llamadas.push({ m, ruta, cuerpo });
      if (ruta === '/me/player/devices') return resp(200, { devices: (o.lista || []).map(d => Object.assign({}, d, { is_active: d.id === activo })) });
      if (ruta.indexOf('/search') === 0) return resp(200, { tracks: { items: [{ name: 'Clair de Lune', uri: 'spotify:track:1', artists: [{ name: 'Debussy' }] }] } });
      if (ruta === '/me/player' && m === 'put') {
        if (conocidos.indexOf(cuerpo.device_ids[0]) < 0) return resp(404, { error: { status: 404, message: 'Device not found' } });
        if (!o.transferIgnorada) activo = cuerpo.device_ids[0]; return resp(204);
      }
      if (ruta.indexOf('/me/player/play') === 0) {
        const id = decodeURIComponent((ruta.match(/device_id=([^&]+)/) || [])[1] || '');
        if (primerPlay404) { primerPlay404 = false; return resp(404, { error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } }); }
        if (id !== activo) return resp(404, { error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } });
        return resp(204);
      }
      return resp(204);
    }
  };
  vm.createContext(ctx);
  ['musica.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  const poner = extra => ctx.musica_(JUAN, Object.assign({ accion: 'poner', consulta: 'clair de lune', tipo: 'cancion' }, extra || {}));
  const pre = () => { try { return JSON.parse(props.SPOTIFY_DISPOSITIVO || 'null'); } catch (e) { return null; } };
  return { ctx, props, llamadas, poner, pre, activo: () => activo };
}
const traspasos = c => c.llamadas.filter(x => x.ruta === '/me/player' && x.m === 'put').map(x => x.cuerpo.device_ids[0]);

/* 1. Ninguno sonando: el predeterminado */
{
  const c = caja({ lista: [SALA, TEL, COMPU], props: { SPOTIFY_DISPOSITIVO: JSON.stringify({ id: 'sala1', name: 'Bocina sala' }) } });
  const r = c.poner();
  ok(r.ok && r.en === 'Bocina sala' && traspasos(c)[0] === 'sala1' && c.activo() === 'sala1',
    '1 · ninguno sonando: le pasa la reproducción al predeterminado y suena ahí (' + JSON.stringify(r) + ')');
  ok(traspasos(c).length === 1 && c.llamadas.filter(x => x.ruta.indexOf('/me/player/play') === 0).length === 1, '1 · una sola activación y un solo play (sin vueltas de más)');
  ok(c.llamadas.find(x => x.ruta === '/me/player').cuerpo.play === false, '1 · la activación no arranca la canción vieja (play: false)');
}

/* 2. Sin predeterminado: el teléfono; los restringidos no cuentan; y queda recordado */
{
  const c = caja({ lista: [TV, SALA, COMPU, TEL] });
  const r = c.poner();
  ok(r.ok && r.en === 'iPhone de Juan', '2 · sin predeterminado elige el teléfono antes que la bocina, la compu o la tele restringida (' + r.en + ')');
  ok(c.pre() && c.pre().id === 'tel1' && !/@|\+\d/.test(c.props.SPOTIFY_DISPOSITIVO), '2 · el teléfono queda como predeterminado (solo id, nombre y tipo)');
  const c2 = caja({ lista: [TV] });
  ok(c2.poner().error && traspasos(c2).length === 0, '2 · solo un dispositivo restringido: no lo intenta y da el mensaje claro');
}

/* 3. El primer play falla con 404: activa y reintenta */
{
  const c = caja({ lista: [TEL], activo: 'tel1', primerPlay404: true });
  const r = c.poner();
  ok(r.ok && r.en === 'iPhone de Juan' && traspasos(c).length === 1, '3 · si Spotify dice «no hay dispositivo activo», lo activa y vuelve a intentar: suena (' + JSON.stringify(r) + ')');
}

/* 4. Lista vacía: el predeterminado por id, o el mensaje claro */
{
  const c = caja({ lista: [], conocidos: ['sala1'], props: { SPOTIFY_DISPOSITIVO: JSON.stringify({ id: 'sala1', name: 'Bocina sala', type: 'Speaker' }) } });
  const r = c.poner();
  ok(r.ok && r.en === 'Bocina sala', '4 · lista vacía y Spotify acepta el predeterminado por su id: suena ahí');
  const c2 = caja({ lista: [], props: { SPOTIFY_DISPOSITIVO: JSON.stringify({ id: 'viejo', name: 'Bocina vieja' }) } });
  const r2 = c2.poner();
  ok(r2.error && /Abre Spotify en el teléfono/.test(r2.error), '4 · lista vacía y Spotify no lo acepta: el mensaje claro, no «HTTP 404»');
  const c3 = caja({ lista: [] });
  ok(/Abre Spotify en el teléfono/.test(c3.poner().error || '') && traspasos(c3).length === 0, '4 · sin lista ni predeterminado: el mensaje claro sin llamadas de más');
}

/* 5. El que suena y el nombrado mandan */
{
  const c = caja({ lista: [TEL, SALA], activo: 'sala1', props: { SPOTIFY_DISPOSITIVO: JSON.stringify({ id: 'tel1' }) } });
  const r = c.poner();
  ok(r.ok && r.en === 'Bocina sala' && traspasos(c).length === 0, '5 · lo que ya suena se queda donde suena, sin traspasar');
  const c2 = caja({ lista: [TEL, SALA, COMPU], activo: 'tel1' });
  const r2 = c2.poner({ dispositivo: 'macbook' });
  ok(r2.ok && r2.en === 'MacBook' && traspasos(c2)[0] === 'pc1', '5 · «ponlo en la MacBook»: la activa y suena ahí');
  const c3 = caja({ lista: [TEL, SALA] });
  ok(c3.ctx.musica_(JUAN, { accion: 'pausar' }) && c3.pre() === null, '5 · pausar no cambia el predeterminado');
}

process.exit(fallo);
