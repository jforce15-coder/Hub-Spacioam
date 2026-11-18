/* Prueba de los modos del Navegador de Alma (apps-script/manos.js; la app los ejecuta en alma-app ManosAlma.swift) sin
   internet ni la app: dobles de lo que responde la app (te_toca, pausa_sitio, espera, rechazado) y revisión de que las
   herramientas y la regla de voz los nombran, y de que nada le pide a Alma ver, decir o guardar contraseñas o códigos.
   node .github/navegador-modos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'manos.js'), 'utf8') + '\n;this.REGLA = VOZ_MANOS_REGLA_;', ctx);
const hs = ctx.vozManosHerramientas_(), por = {}; hs.forEach(h => { por[h.name] = h; });

// Las herramientas del navegador: de la app (client) y solo con la ficha del navegador.
['leer_pagina', 'senalar', 'tocar', 'escribir', 'bajar', 'mostrar_dato'].forEach(n => {
  ok(por[n] && por[n].type === 'client' && por[n].expects_response === true && /NAVEGADOR DE ALMA/.test(por[n].description), n + ' es de la app y solo con «NAVEGADOR DE ALMA»');
});

// Modo guiado: la tarjeta para copiar.
const md = por.mostrar_dato || { parameters: { properties: {}, required: [] }, description: '' };
ok(JSON.stringify(md.parameters.required) === '["etiqueta","valor"]', 'mostrar_dato pide etiqueta y valor');
ok(/aunque la llamada termine/.test(md.description) && /Nunca contraseñas, códigos ni tarjetas/.test(md.description), 'mostrar_dato: se queda al colgar y nunca lleva nada privado');

// Dobles de lo que responde la app (alma-app ManosAlma.swift) y quién lo explica a Alma.
const dobles = {
  te_toca: { te_toca: true, motivo: 'clave', instruccion: 'PAUSA DE PRIVACIDAD: …' },
  pausa_sitio: { pausa_sitio: true, segundos: 41, instruccion: 'Voy despacio en esta página…' },
  espera: { espera: true, instruccion: 'Todavía estoy terminando lo anterior…' },
  rechazado: { rechazado: true, motivo: 'Eso es privado…' }
};
ok(/te_toca/.test(por.leer_pagina.description) && /te_toca/.test(por.tocar.description) && /te_toca/.test(ctx.REGLA), 'te_toca (pausa de privacidad) está en leer_pagina, tocar y la regla de voz');
ok(/pausa_sitio/.test(por.tocar.description) && /\bespera\b/.test(por.tocar.description), 'tocar explica pausa_sitio y espera (no ir rápido en sitios como PedidosYa)');
ok(/rechazado/.test(md.description), 'mostrar_dato explica rechazado');
Object.keys(dobles).forEach(k => ok(JSON.stringify(dobles[k]).indexOf('"' + k + '":true') >= 0, 'el doble de «' + k + '» tiene la marca que buscan las reglas'));

// Privacidad: nada pide ver, decir ni guardar una contraseña o un código, ni hay un parámetro para eso.
const todo = hs.map(h => h.description + ' ' + JSON.stringify(h.parameters)).join(' ') + ' ' + ctx.REGLA;
ok(!/(dime|dímelo|díctame|pídele|pide|lee|guarda|anota)[^.]{0,30}(contraseña|código de verificación|clave)/i.test(todo), 'nada pide decir, leer ni guardar contraseñas o códigos');
ok(!hs.some(h => Object.keys(h.parameters.properties || {}).some(p => /contrase|password|clave|codigo|otp|pin/i.test(p))), 'ninguna herramienta tiene un parámetro para contraseñas o códigos');
ok(/«te toca a ti»/.test(ctx.REGLA) && /mostrar_dato/.test(ctx.REGLA), 'la regla de voz nombra «te toca a ti» y mostrar_dato');
ok(ctx.REGLA.length <= 742, 'la regla de voz no creció (' + ctx.REGLA.length + ' ≤ 742: el prompt de voz está en su tope)');
process.exit(fallo);
