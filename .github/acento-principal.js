/* Acento de España solo con el administrador principal (ajuste a #571/#572, 16-nov-2026), con dobles: sin hoja ni Google.
   El acento de España sube con el nivel del Modo Weebo, pero la voz de marca prohíbe «vale» y modismos de España con
   huéspedes, y con el equipo, socios y familia Alma habla en nombre de la empresa: con ellos, siempre neutro.
   1. Mensajes (weeboBloque_): el principal en su chat sube hasta España pleno; un administrador del equipo, aunque el
      Modo Weebo esté fijo en 3, y un huésped reciben solo la línea neutra.
   2. Voz (weeboVozBloque_): el prompt de llamadas dice que solo con Juan (caller_type juan) sube; el de la familia, neutro.
   node .github/acento-principal.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const props = { WEEBO_MODO: 'fijo', WEEBO_NIVEL_FIJO: '3' }, cache = {};
const ctx = {
  console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); } }) },
  prompt_: () => ''
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'weebo.js'), 'utf8'), ctx, { filename: 'weebo.js' });

const ESPANA_ESCALA = /«vale» suelto|mitad España|España pleno/;
const linea = t => (String(t).match(/ACENTO[^\n]*/) || [''])[0];
const charla = ['jajaja qué buena idea', 'me encanta, pensemos la estrategia de marca 😂', 'jaja genial'];

/* 1. Mensajes */
const juan = ctx.weeboBloque_({ contexto: 'admin', principal: true, clave: 'juan@x.com', texto: 'jaja pensemos la estrategia', historial: charla });
ok(/NIVEL 3/.test(juan) && /España pleno/.test(linea(juan)), 'Juan con el Modo Weebo fijo en 3: su chat lleva español de España pleno');
const equipo = ctx.weeboBloque_({ contexto: 'admin', principal: false, clave: 'ana@x.com', texto: 'jaja pensemos la estrategia de marca', historial: charla });
ok(/neutro latinoamericano/.test(linea(equipo)) && !ESPANA_ESCALA.test(equipo),
  'Un administrador del equipo con mucha confianza: acento neutro, sin modismos de España');
const huesped = ctx.weeboBloque_({ contexto: 'huesped', texto: 'jajaja gracias, todo genial 😊', historial: ['jaja perfecto', 'me encanta el apartamento'] });
ok(/neutro latinoamericano/.test(linea(huesped)) && !ESPANA_ESCALA.test(huesped), 'Un huésped contento (nivel 1): acento neutro, ni un «vale» suelto');
const familiaMsg = ctx.weeboBloque_({ contexto: 'familia', principal: true, texto: 'jajaja', historial: charla });
ok(!ESPANA_ESCALA.test(familiaMsg), 'La familia, aunque escriba el principal: acento neutro');
ok(/neutro latinoamericano/.test(ctx.weeboAcento_(3)) && !ESPANA_ESCALA.test(ctx.weeboAcento_(3)), 'weeboAcento_ sin decir que es el principal da el neutro (por defecto, neutro)');

/* 2. Voz */
const voz = ctx.weeboVozBloque_(false);
ok(/Solo con Juan \(caller_type juan\)/.test(voz) && /equipo, socios y huéspedes, siempre nivel 0/.test(voz) && /España pleno/.test(voz),
  'Prompt de llamadas: el acento sube solo con Juan; con equipo, socios y huéspedes, nivel 0');
const vozFam = ctx.weeboVozBloque_(true);
ok(/neutro latinoamericano/.test(vozFam) && !ESPANA_ESCALA.test(vozFam), 'Prompt de la familia: acento neutro, sin la escala de España');

process.exit(fallo);
