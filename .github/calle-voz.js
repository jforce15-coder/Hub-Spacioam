/* Prueba de la voz del Modo calle (apps-script/calle.js) con dobles de ElevenLabs: sin internet ni Google. Revisa que,
   cuando no hay audio, calleVoz diga por qué («el Hub no mandó la voz: <motivo>» en el diagnóstico de la app):
   1. sin ELEVENLABS_KEY → el motivo lo dice (y nunca escribe una llave);
   2. la llave sin el permiso «Text to Speech» (401 missing_permissions) → lo dice y no le vuelve a preguntar en 5 min;
   3. sin créditos (401 quota_exceeded) → lo dice;
   4. el modelo rápido rechazado para esta voz (400) → intenta una vez con el otro modelo y sale la voz;
   5. todo bien → manda el audio, sin motivo.
   node .github/calle-voz.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

function caja(props, respuestas) {
  const cache = {}, llamadas = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); } }) },
    Utilities: {
      base64EncodeWebSafe: x => Buffer.from(String(x)).toString('base64'), base64Encode: b => Buffer.from(b).toString('base64'),
      computeDigest: (a, s) => String(s), DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' }
    },
    uf_: (url, o) => {
      const b = JSON.parse(o.payload); llamadas.push({ url, modelo: b.model_id, llave: o.headers['xi-api-key'] });
      const [code, cuerpo] = respuestas.length ? respuestas.shift() : [200, ''];
      return { getResponseCode: () => code, getContentText: () => cuerpo, getBlob: () => ({ getBytes: () => [109, 112, 51] }) };
    },
    vozSinNotas_: t => String(t || ''), vozVozId_: () => 'vozAlma',
    chatSesAdm_: s => (s ? { email: 'juan@x' } : null)
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'calle.js'), 'utf8'), ctx);
  return { ctx, llamadas, cache };
}
const ses = { email: 'juan@x' };

{ const c = caja({}, []);
  const r = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(!r.ok && /falta ELEVENLABS_KEY/.test(r.motivo) && !c.llamadas.length, 'sin llave: «' + r.motivo + '», sin llamar a ElevenLabs'); }

{ const c = caja({ ELEVENLABS_KEY: 'llave-de-prueba' }, [[401, JSON.stringify({ detail: { status: 'missing_permissions', message: 'The API key you used is missing the permission text_to_speech to execute this operation.' } })]]);
  const r = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(!r.ok && /permiso «Text to Speech»/.test(r.motivo), 'llave sin permiso: «' + r.motivo + '»');
  ok(r.motivo.indexOf('llave-de-prueba') < 0, 'el motivo nunca lleva la llave');
  const r2 = c.ctx.calleVoz_(ses, { texto: 'Otra frase.' });
  ok(!r2.ok && r2.motivo === r.motivo && c.llamadas.length === 1, 'sin permiso: la siguiente no le vuelve a preguntar a ElevenLabs (5 min)'); }

{ const c = caja({ ELEVENLABS_KEY: 'k' }, [[401, JSON.stringify({ detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 100000.' } })]]);
  const r = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(!r.ok && /créditos/.test(r.motivo), 'sin créditos: «' + r.motivo + '»'); }

{ const c = caja({ ELEVENLABS_KEY: 'k' }, [[400, JSON.stringify({ detail: { status: 'model_not_supported', message: 'This voice does not support eleven_flash_v2_5' } })], [200, '']]);
  const r = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(r.ok && r.audio && c.llamadas.length === 2 && c.llamadas[0].modelo === 'eleven_flash_v2_5' && c.llamadas[1].modelo === 'eleven_multilingual_v2',
    'modelo rápido rechazado (400): una vez con eleven_multilingual_v2 y sale la voz'); }

{ const c = caja({ ELEVENLABS_KEY: 'k' }, [[500, JSON.stringify({ detail: { message: 'Internal error' } })]]);
  const r = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(!r.ok && /respondió 500/.test(r.motivo) && c.llamadas.length === 1, 'otro error: «' + r.motivo + '», sin reintentar'); }

{ const c = caja({ ELEVENLABS_KEY: 'k' }, [[200, '']]);
  const r = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(r.ok && r.audio && !r.motivo, 'todo bien: manda la voz de Alma');
  const r2 = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(r2.ok && c.llamadas.length === 1, 'la misma frase sale de la caché'); }

{ const c = caja({ ELEVENLABS_KEY: 'k', CALLE_AUDIO: '0' }, []);
  const r = c.ctx.calleVoz_(ses, { texto: 'Listo.' });
  ok(!r.ok && /apagada/.test(r.motivo), 'voz apagada: «' + r.motivo + '»'); }

process.exit(fallo);
