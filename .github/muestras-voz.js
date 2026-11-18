/* Prueba con dobles de las Muestras de voz (apps-script/muestrasvoz.js; Juan, 18-nov-2026, #781: «que Claudio pueda
   reproducir audios de las voces que pida durante la llamada, y que también quede la opción de reproducirlos aquí»),
   sin ElevenLabs, Sheets ni caché de verdad.
   1. Buscar: «la voz de Alma» da la de Alma sin ir a internet; por descripción, primero las de la cuenta (respeta mujer u
      hombre) y, si faltan, la biblioteca pública; como mucho 3.
   2. La herramienta de Claudio deja la tarjeta «voces» en el hilo (Propósito · Desarrollo) y devuelve los voice_id.
   3. vozMuestra: solo el principal; voice_id y hz válidos; PCM al hz de la llamada o mp3; la segunda vez sale de la caché
      (no se paga dos veces).
   4. Una voz de la biblioteca que ElevenLabs no deja usar: en el hilo, su muestra pública; en la llamada, lo dice.
   node .github/muestras-voz.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const JUAN = { email: 'juan@x', nombre: 'Juan', principal: true }, OTRO = { email: 'eq@x', nombre: 'Equipo' };
const ALMA_VOZ = 'AlmaVoz0000000000001', LIB = 'LibVoz00000000000001';

function caja() {
  const red = [], chat = [], cache = {};
  const resp = (code, cuerpo) => ({ getResponseCode: () => code, getContentText: () => typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), getBlob: () => ({ getBytes: () => Buffer.from('audio:' + code) }) });
  const ctx = {
    console: { log() {}, error() {} }, JSON, Math, Date, Object, Array, String, Number, RegExp, isNaN, encodeURIComponent, Buffer,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'ELEVENLABS_KEY' ? 'k' : '' }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, getAll: ks => { const o = {}; ks.forEach(k => { if (cache[k]) o[k] = cache[k]; }); return o; }, putAll: o => Object.assign(cache, o) }) },
    Utilities: { computeDigest: (a, t) => Array.from(require('crypto').createHash('md5').update(t).digest()), DigestAlgorithm: { MD5: 1 }, Charset: { UTF_8: 1 }, base64Encode: b => Buffer.from(b).toString('base64') },
    uf_: (url, o) => {
      o = o || {}; red.push({ url, metodo: o.method || 'get', cuerpo: o.payload ? JSON.parse(o.payload) : null });
      if (/\/v2\/voices/.test(url)) return resp(200, { voices: [
        { voice_id: 'CuentaMujer000000001', name: 'Rachel - calm', labels: { gender: 'female', accent: 'american' }, preview_url: 'https://storage.googleapis.com/a.mp3' },
        { voice_id: 'CuentaHombre00000001', name: 'Adam', labels: { gender: 'male' } }] });
      if (/shared-voices/.test(url)) return resp(200, { voices: [{ voice_id: LIB, name: 'Lucía', gender: 'female', accent: 'mexicana', preview_url: 'https://storage.googleapis.com/lib.mp3' }] });
      if (/text-to-speech\/LibVoz/.test(url)) return resp(400, { detail: 'voice not found' });
      if (/text-to-speech/.test(url)) return resp(200, '');
      if (/lib\.mp3/.test(url)) return resp(200, '');
      return resp(404, '');
    },
    vozVozId_: () => ALMA_VOZ, CLAUDIO_VOZ_ID_: 'wRoroUVFu5pwV8ummDdd',
    opGuardar_: (adm, de, canal, texto, acc, clas, tarjeta) => { chat.push({ de, canal, texto, clas, tarjeta }); return { id: 'op1' }; },
    CHAT_DESARROLLO_: { esfera: 'Propósito', subcategoria: 'Desarrollo' },
    VOZ_SIN_SESION_: 'sin sesión',
    vozWebAdmin_: s => s === 'juan' ? JUAN : s === 'otro' ? OTRO : null,
    esAdminPrincipal_: a => !!(a && a.principal)
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'muestrasvoz.js'), 'utf8'), ctx);
  return { ctx, red, chat, cache };
}

/* 1 · Buscar */
{ const b = caja(), v = b.ctx.mvBuscar_('ponme la voz de Alma', '');
  ok(v.length === 1 && v[0].id === ALMA_VOZ && v[0].nombre === 'Alma' && !b.red.length, '1 · «la voz de Alma» da la de Alma sin ir a ElevenLabs'); }
{ const b = caja(), v = b.ctx.mvBuscar_('una voz de mujer tranquila', '');
  ok(v[0].id === 'CuentaMujer000000001' && v[0].nombre === 'Rachel' && !v.some(x => x.id === 'CuentaHombre00000001'), '1 · por descripción, las de la cuenta y respeta «mujer»: ' + v.map(x => x.nombre));
  ok(/search=tranquila/.test(b.red[0].url), '1 · busca solo lo que describe la voz («tranquila»), sin «una voz de mujer»');
  ok(v.some(x => x.id === LIB && x.lib) && b.red.some(r => /shared-voices.*gender=female/.test(r.url)), '1 · si faltan, la biblioteca pública (en español y del mismo género)');
  ok(v.length <= 3, '1 · como mucho 3'); }

/* 2 · La herramienta de Claudio */
{ const b = caja(), r = b.ctx.claudioVocesHerr_(JUAN, { buscar: 'mujer tranquila' });
  const t = b.chat[0] && JSON.parse(b.chat[0].tarjeta);
  ok(r.ok && r.voces.length && r.voces[0].voice_id && /reproducir_voz/.test(r.resultado), '2 · devuelve los voice_id y cómo ponerlas en la llamada');
  ok(b.chat.length === 1 && b.chat[0].canal === 'claudio' && b.chat[0].clas.subcategoria === 'Desarrollo' && t.tipo === 'voces' && t.voces.length === r.voces.length && t.frase, '2 · deja la tarjeta «voces» en el hilo de Claudio, con la frase');
  ok(t.voces.filter(x => x.lib).every(x => /^https:\/\/storage\.googleapis\.com\//.test(x.preview)) && t.voces.filter(x => !x.lib).every(x => !x.preview), '2 · la de la biblioteca lleva su muestra pública; las de la cuenta, no'); }

/* 3 · vozMuestra */
{ const b = caja();
  ok(!b.ctx.vozMuestraApi_(null, { voice_id: ALMA_VOZ }).ok && !b.ctx.vozMuestraApi_('otro', { voice_id: ALMA_VOZ }).ok, '3 · sin sesión o sin ser el principal, nada');
  ok(!b.ctx.vozMuestraApi_('juan', { voice_id: '../x' }).ok && !b.ctx.vozMuestraApi_('juan', { voice_id: ALMA_VOZ, hz: 12345 }).ok && !b.red.length, '3 · voice_id o formato raros: nada (sin gastar)');
  const p = b.ctx.vozMuestraApi_('juan', { voice_id: ALMA_VOZ, hz: 16000, frase: 'Hola' });
  ok(p.ok && p.formato === 'pcm' && p.hz === 16000 && p.audio && /output_format=pcm_16000/.test(b.red[0].url) && b.red[0].cuerpo.text === 'Hola', '3 · en la llamada: PCM al hz de la llamada, con la frase');
  const m = b.ctx.vozMuestraApi_('juan', { voice_id: ALMA_VOZ });
  ok(m.ok && m.formato === 'mp3' && /mp3_44100_64/.test(b.red[1].url) && b.red[1].cuerpo.text === b.ctx.MV_FRASE_, '3 · en el hilo: mp3 con la frase de muestra');
  const n = b.red.length; b.ctx.vozMuestraApi_('juan', { voice_id: ALMA_VOZ, hz: 16000, frase: 'Hola' });
  ok(b.red.length === n, '3 · la segunda vez sale de la caché (no se paga dos veces)');
  const larga = b.ctx.vozMuestraApi_('juan', { voice_id: ALMA_VOZ, frase: 'x'.repeat(500) });
  ok(larga.ok && b.red[b.red.length - 1].cuerpo.text.length <= b.ctx.MV_FRASE_MAX_, '3 · la frase se corta (costo chico)'); }

/* 4 · Voz de la biblioteca que no se puede usar por API */
{ const b = caja(); b.ctx.mvBuscar_('mujer tranquila', '');
  const h = b.ctx.vozMuestraApi_('juan', { voice_id: LIB });
  ok(h.ok && h.formato === 'mp3' && b.red.some(r => /lib\.mp3/.test(r.url)), '4 · en el hilo suena con su muestra pública');
  const l = b.ctx.vozMuestraApi_('juan', { voice_id: LIB, hz: 16000 });
  ok(!l.ok && /biblioteca/.test(l.error), '4 · en la llamada dice que esa no se puede poner'); }

process.exit(fallo);
