/* Prueba de apps-script/variar.js: Alma no repite la misma muletilla ni la misma frase seguidas (Juan, 14-nov-2026:
   «evitar que Alma repita frases idénticas seguidas o caiga en bucles como "Listo, entregado"»). Revisa que:
   1. una respuesta igual a la anterior («Listo, entregado.») sale con otro arranque, y en un bucle de 4 no se repite ninguna;
   2. el mismo arranque seguido («Listo, …» después de «Listo, …») cambia y el resto del texto queda igual;
   3. sin respuestas anteriores, o con otro arranque, o sin muletilla conocida, el texto no se toca;
   4. el chat del administrador (Código.js) la usa antes de guardar y enviar, y la regla «varia» está en alma.json.
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
process.exit(fallo);
