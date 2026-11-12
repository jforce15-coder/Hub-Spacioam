/* Prueba del WhatsApp a recepción (apps-script/recepcion.js) con dobles: sin internet ni Google. 12-nov-2026: en Hola
   los números de recepción se escriben de muchas formas («+502 5555 0101», «5555-0101», sin 502). Revisa que:
   1. a Meta siempre va el formato internacional de Guatemala (502 + 8 dígitos, sin espacios, guiones ni +), con
      normTel_ de Código.js (el único lugar del formato);
   2. el mismo número escrito de dos formas recibe una sola vez;
   3. la prueba manual (soloA) también se normaliza y un número inválido no sale;
   4. la lista de recepciones conocidas (recepcionNumeros_) guarda el número ya normalizado;
   5. ALMA_RECEPCION anota «2 de 2 enviados» (solo «2 de 2» Sheets lo guardaba como fecha).
   node .github/recepcion-numeros.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* normTel_, telsDe_ y fin8_ se toman tal cual de Código.js: la prueba usa los de verdad. */
const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
const trozo = (inicio) => { const i = cod.indexOf(inicio); if (i < 0) throw new Error('no encontré ' + inicio + ' en Código.js'); return cod.slice(i, cod.indexOf('\n}\n', i) + 3); };
const ayudas = cod.match(/^const fin8_ = .*$/m)[0] + '\n' + trozo('function normTel_(') + trozo('function telsDe_(');

function caja(holaNums) {
  const props = { ROBOT_TOKEN: 'robot' }, meta = [], cache = {}, filasWA = [], filasLog = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: { base64Decode: () => [1], newBlob: (b, t, n) => ({ getName: () => n }) },
    holaUrl_: () => 'https://hola.prueba', llaveRobot_: () => 'robot',
    waCfg_: () => ({ token: 't', phoneId: 'p' }),
    hojaWA_: () => ({ appendRow: r => filasWA.push(r) }),
    ssAlma_: () => ({ getSheetByName: () => ({ appendRow: r => filasLog.push(r) }) }),
    uf_: (url, o) => {
      const r = (code, j) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(j) });
      if (url === 'https://hola.prueba') {
        const b = JSON.parse(o.payload);
        if (b.action === 'listContacts') return r(200, { ok: true, properties: [{ name: 'Z10 - Prueba - 905', whatsapps: holaNums }], admin: '50255550999' });
        return r(200, { ok: true, pdfB64: 'x', filename: 'Registro.pdf', whatsapps: holaNums, meta: { propiedad: 'Z10 - Prueba - 905', principal: 'Ana', ingreso: '12 nov', salida: '13 nov', noches: 1, huespedes: 2 } });
      }
      if (/\/media$/.test(url)) return r(200, { id: 'media1' });
      if (/\/messages$/.test(url)) { meta.push(JSON.parse(o.payload).to); return r(200, { messages: [{ id: 'wamid.' + meta.length }] }); }
      return r(404, {});
    }
  };
  vm.createContext(ctx);
  vm.runInContext(ayudas + '\n' + fs.readFileSync(path.join(DIR, 'recepcion.js'), 'utf8'), ctx);
  ctx.recepcionPlantillaUsar_ = () => 'registro_recepcion';
  return { ctx, meta, props, filasWA, filasLog };
}

// 1 y 2. Envío normal: números escritos de varias formas, uno repetido
let c = caja(['+502 5555 0101', '5555-0101', '(502) 5555 0202', 55550303]);
let r = c.ctx.recepcionEnviar_('HMPRUEBA1');
ok(r.ok && igual(c.meta, ['50255550101', '50255550202', '50255550303']), 'a Meta va 502 + 8 dígitos y una sola vez por número (dio ' + JSON.stringify(c.meta) + ')');
ok(igual(r.nums, c.meta), 'el estado de entrega se sigue con los mismos números que salieron');
ok(c.filasWA.every(f => /^502\d{8}$/.test(f[1])), 'la conversación de recepción en ALMA_WHATSAPP queda con el número normalizado');

// 3. Prueba manual (soloA)
c = caja(['50255550101']);
r = c.ctx.recepcionEnviar_('HMPRUEBA2', '+502 5555-0404');
ok(r.ok && igual(c.meta, ['50255550404']), 'la prueba manual sale solo al número indicado, normalizado');
c = caja(['50255550101']);
r = c.ctx.recepcionEnviar_('HMPRUEBA3', '12');
ok(!r.ok && c.meta.length === 0, 'un número de prueba inválido no sale a nadie');

// Sin números válidos: no se llama a Meta
c = caja(['', '123']);
r = c.ctx.recepcionEnviar_('HMPRUEBA4');
ok(!r.ok && c.meta.length === 0, 'sin números válidos no se manda nada y lo dice');

// 4. recepcionNumeros_
c = caja(['+502 5555 0101', '5555 0606']);
const rn = c.ctx.recepcionNumeros_();
ok(rn['55550101'] && rn['55550101'].n === '50255550101' && rn['55550606'] && rn['55550606'].n === '50255550606', 'las recepciones conocidas guardan el número con 502');

// 5. ALMA_RECEPCION
c = caja(['50255550101']);
c.ctx.recepcionLog_('HMPRUEBA5', { ok: true, enviados: 2, total: 2, plantilla: 'registro_recepcion' });
ok(c.filasLog[0][3] === '2 de 2 enviados', 'ALMA_RECEPCION anota «2 de 2 enviados» (texto, no fecha)');

process.exit(fallo);
