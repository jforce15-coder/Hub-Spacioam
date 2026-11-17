/* Prueba de apps-script/variar.js: Alma no repite la misma muletilla ni la misma frase seguidas (Juan, 14-nov-2026:
   «evitar que Alma repita frases idénticas seguidas o caiga en bucles como "Listo, entregado"»). Revisa que:
   1. una respuesta igual a la anterior («Listo, entregado.») sale con otro arranque, y en un bucle de 4 no se repite ninguna;
   2. el mismo arranque seguido («Listo, …» después de «Listo, …») cambia y el resto del texto queda igual;
   3. sin respuestas anteriores, o con otro arranque, o sin muletilla conocida, el texto no se toca;
   4. el chat del administrador (Código.js) la usa antes de guardar y enviar, y la regla «varia» está en alma.json;
   5. (16-nov-2026: «me halagas», «vale, lo hago») «Vale, lo hago.» seguido cambia; «¡Me halagas!» no vuelve a salir si
      ya salió en las últimas respuestas (aunque no fuera la anterior), y las instrucciones no traen esas frases de guion.
   node .github/variar-frases.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const caja = {}; vm.createContext(caja); vm.runInContext(fs.readFileSync(path.join(DIR, 'variar.js'), 'utf8'), caja);
const V = caja.variarFrase_, arr = t => (caja.variarArranque_(t) || {}).norm || '';

ok(V('Listo, entregado.', ['Listo, entregado.']) !== 'Listo, entregado.', '1. «Listo, entregado.» repetido cambia');
let hist = [], salidas = [];
for (let i = 0; i < 4; i++) { const s = V('Listo, entregado.', hist); salidas.push(s); hist.push(s); }
ok(salidas.every((s, i) => !i || arr(s) !== arr(salidas[i - 1])) && new Set(salidas).size === 4, '1. bucle de 4 «Listo, entregado.»: ' + salidas.join(' · '));
hist = []; salidas = [];
for (let i = 0; i < 4; i++) { const s = V('Listo.', hist); salidas.push(s); hist.push(s); }
ok(salidas.every((s, i) => !i || s !== salidas[i - 1]), '1. «Listo.» solo, cuatro veces, nunca igual seguido: ' + salidas.join(' · '));
const r2 = V('Listo, quedó pedido.', ['Listo, le escribí a Flor.']);
ok(arr(r2) !== 'listo' && /quedó pedido\.$/i.test(r2), '2. mismo arranque seguido cambia y el resto queda: ' + r2);
const r3 = V('Listo. Le escribí a Flor.', ['Listo, anotado.']);
ok(/Le escribí a Flor\.$/.test(r3) && !/^Listo/.test(r3), '2. con punto, la frase siguiente queda con su mayúscula: ' + r3);
ok(V('Listo, quedó pedido.', []) === 'Listo, quedó pedido.', '3. sin respuestas anteriores no se toca');
ok(V('Listo, quedó pedido.', ['Hecho, anotado.']) === 'Listo, quedó pedido.', '3. otro arranque antes: no se toca');
ok(V('Mañana entran 3 huéspedes.', ['Mañana entran 3 huéspedes.']) === 'Mañana entran 3 huéspedes.', '3. sin muletilla (puede ser «¿qué?» y repetir): no se toca');
const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), iV = cod.indexOf('variarFrase_(resp'), iG = cod.indexOf("opGuardar_(adm, 'alma', canal, resp");
ok(iV > 0 && iG > iV, '4. el chat del administrador varía la respuesta antes de guardarla y mandarla por WhatsApp');
ok(/"id": "varia"/.test(fs.readFileSync(path.join(DIR, '..', 'playbooks', 'alma.json'), 'utf8')), '4. la regla «varia» está en playbooks/alma.json');

ok(V('Vale, lo hago.', ['Vale, lo hago.']) === 'Lo hago.', '5. «Vale, lo hago.» repetido: ' + V('Vale, lo hago.', ['Vale, lo hago.']));
const h1 = V('¡Me halagas! Soy Alma, la asistente virtual.', ['¡Me halagas! Coordino todo.', 'Mañana entran 3.']);
ok(h1 === 'Soy Alma, la asistente virtual.', '5. «¡Me halagas!» ya dicho hace dos respuestas: se quita y queda el resto: ' + h1);
ok(V('¡Me halagas!', ['Ay, me halagas, gracias.']) !== '¡Me halagas!', '5. «¡Me halagas!» solo, ya dicho en medio de otra respuesta: cambia');
ok(V('¡Me halagas! Soy Alma.', ['Mañana entran 3.']) === '¡Me halagas! Soy Alma.', '5. la primera vez el halago se queda');
const fuente = fs.readFileSync(path.join(DIR, '..', 'playbooks', 'alma.json'), 'utf8') + fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8');
ok(!/«¡Me halagas! Soy Alma/.test(fuente) && !/"bien": "¡Me halagas/.test(fuente), '5. las instrucciones no ponen «¡Me halagas!» como guion al preguntar si es persona');
ok(!/di solo «Entendido, lo hago y te aviso cuando esté listo»/.test(fuente) && !/UNA frase corta \(«Listo, me encargo»\)/.test(fuente), '5. segundo plano: sin una frase fija que se repita en cada pedido');
process.exit(fallo);
