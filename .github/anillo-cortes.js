/* El cierre de una llamada no se pierde (guardia 19-nov-2026, apps-script/anillo.js) con dobles: sin hoja ni Google.
   La llamada con Alma se cortó (1006) y no se vio por qué: las «Voz enviada: 10 s en 10 s» llenaban los 30 pasos del
   registro y el cierre se borró con la llamada siguiente.
   1. Las «Voz enviada» normales (9 s o más de 10) no se guardan; las raras (el micrófono mandó poco) sí.
   2. Cada cierre (socket caído, la app se cerró, llamada terminada…) queda aparte con los pasos que lo antecedieron, y la
      llamada siguiente no lo borra. Los cierres seguidos de una misma llamada se juntan en uno.
   3. Solo los últimos 3 cierres, por usuario, y la propiedad cabe (~9 KB). El robot los lee con «anillo» (campo cortes).
   node .github/anillo-cortes.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = { email: 'juan@x.com' };
const props = {};
const ctx = {
  console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, isFinite, Date,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => Object.assign({}, props) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  retClave_: a => 'VOZ_RET_' + Buffer.from(a.email).toString('base64url').slice(0, 16),
  ssAlma_: () => ({ getSheetByName: () => null })
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'anillo.js'), 'utf8'), ctx);
const clave = ctx.retClave_(JUAN).slice(8), app = () => JSON.parse(props['ANILLO_APP_' + clave] || '[]'), cortes = () => JSON.parse(props['ANILLO_CORTE_' + clave] || '[]');

// 1. «Voz enviada» normal fuera, rara dentro
const llamada = [];
for (let i = 0; i < 20; i++) llamada.push('10:40:' + String(i).padStart(2, '0') + ' Voz enviada: 10.0 s en 10 s');
llamada.push('10:40:21 Voz enviada: 9.4 s en 10 s', '10:40:22 Voz enviada: 2.3 s en 10 s', '10:40:23 Alma usa secretaria');
ctx.anilloPasosGuardar_(JUAN, llamada, false);
ok(!app().some(x => /Voz enviada: (10\.0|9\.4) s/.test(x.paso)), 'las «Voz enviada» normales (10 y 9,4 s de 10) no llenan el registro');
ok(app().some(x => /Voz enviada: 2\.3 s/.test(x.paso)), 'la rara (2,3 s de 10: el micrófono mandó poco) sí se guarda');
ok(app().length === 2, 'quedan solo los pasos que dicen algo');

// 2. El cierre queda aparte con lo que lo antecedió
ctx.anilloPasosGuardar_(JUAN, ['10:40:30 Socket caído: NSPOSIXErrorDomain 57 · herramienta secretaria en curso hace 7 s · salida Speaker · app en segundo plano'], false);
ctx.anilloPasosGuardar_(JUAN, ['10:40:31 Llamada terminada · se cortó'], false);
let c = cortes();
ok(c.length === 1, 'el corte y su «Llamada terminada» son un solo cierre (no dos)');
ok(c[0] && /Llamada terminada/.test(c[0].cierre) && c[0].pasos.some(p => /Socket caído/.test(p)) && c[0].pasos.some(p => /Alma usa secretaria/.test(p)), 'el cierre guarda los pasos de antes: la herramienta en curso y el socket caído');

// La llamada siguiente llena el registro y no borra el cierre
const otra = [];
for (let i = 0; i < 40; i++) otra.push('10:45:' + String(i).padStart(2, '0') + ' Alma está hablando ' + i);
ctx.anilloPasosGuardar_(JUAN, otra.slice(0, 30), false); ctx.anilloPasosGuardar_(JUAN, otra.slice(30), false);
ok(!app().some(x => /Socket caído/.test(x.paso)), '(el registro de 30 ya no tiene el corte: así se perdía)');
ok(cortes().length === 1 && /Llamada terminada/.test(cortes()[0].cierre), 'el cierre sigue guardado aparte después de la llamada siguiente');
ok(ctx.anilloLeer_(30).cortes && ctx.anilloLeer_(30).cortes[clave].length === 1, 'el robot lo lee con «anillo» (campo cortes)');

// La app se cerró a media llamada (el paso que manda al volver a abrir)
ctx.anilloPasosGuardar_(JUAN, ['11:02:00 La app se cerró a media llamada (iOS la terminó o falló), sin que tocaras Terminar · última señal: 10:59:50'], false);
ok(cortes().length === 2 && /La app se cerró/.test(cortes()[1].cierre), 'la app cerrada a media llamada también es un cierre');

// 3. Solo los últimos 3 y siempre caben
for (let n = 0; n < 5; n++) {
  const larga = []; for (let i = 0; i < 29; i++) larga.push('12:0' + n + ':' + String(i).padStart(2, '0') + ' ' + 'x'.repeat(150));
  larga.push('12:0' + n + ':59 Cierre del socket: 1006');
  ctx.anilloPasosGuardar_(JUAN, larga, false);
}
ok(cortes().length <= 3, 'como mucho los últimos 3 cierres');
ok(props['ANILLO_CORTE_' + clave].length <= 8500, 'la propiedad cabe (~9 KB): ' + props['ANILLO_CORTE_' + clave].length);
ok(/12:04:59 Cierre del socket/.test(cortes()[cortes().length - 1].cierre), 'el más nuevo siempre se queda');
ok(!ctx.anilloEsCierre_('Otra app tomó el audio: el anillo espera') && !ctx.anilloEsCierre_('Alma está hablando'), 'los pasos del anillo y los normales no son cierres');
ok(ctx.anilloPasosGuardar_(null, ['x'], false) === 0, 'sin usuario no se guarda nada');

process.exit(fallo);
