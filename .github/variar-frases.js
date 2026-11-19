/* Prueba de apps-script/variar.js: Alma no repite la misma muletilla ni la misma frase seguidas (Juan, 14-nov-2026:
   «evitar que Alma repita frases idénticas seguidas o caiga en bucles como "Listo, entregado"»). Revisa que:
   1. una respuesta igual a la anterior («Listo, entregado.») sale con otro arranque, y en un bucle de 4 no se repite ninguna;
   2. el mismo arranque seguido («Listo, …» después de «Listo, …») cambia y el resto del texto queda igual;
   3. sin respuestas anteriores, o con otro arranque, o sin muletilla conocida, el texto no se toca;
   4. el chat del administrador (Código.js) la usa antes de guardar y enviar, y la regla «varia» está en alma.json;
   5. (16-nov-2026: «me halagas», «vale, lo hago») «Vale, lo hago.» seguido cambia; «¡Me halagas!» no vuelve a salir si
      ya salió en las últimas respuestas (aunque no fuera la anterior), y las instrucciones no traen esas frases de guion.
   6. (17-nov-2026, pc1794933663821: «repite "Listo, quedó pedido" hasta ocho veces; con una sola vez basta») después de un
      pedido confirmado, los siguientes se confirman cortos y sin «quedó pedido»; ocho pedidos seguidos lo dicen una vez.
   7. (19-nov-2026, pc1795089818616: «evitar la duplicación o repetición de frases idénticas en las respuestas de voz») la
      llamada (vozSecretaria_) y la calle pasan por variarVoz_: una frase dicha dos veces en una respuesta sale una vez,
      lo ya dicho en las dos anteriores no se repite si queda algo nuevo, y la regla v_espera pide variar la espera.
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

ok(V('Listo, quedó pedido.', ['Hecho, quedó pedido.']) === 'También quedó.', '6. pedido ya confirmado: «También quedó.» (' + V('Listo, quedó pedido.', ['Hecho, quedó pedido.']) + ')');
hist = []; salidas = [];
for (let i = 0; i < 8; i++) { const s = V('Listo, quedó pedido.', hist); salidas.push(s); hist.push(s); }
ok(salidas.filter(s => /quedó pedido/i.test(s)).length === 1 && salidas.every((s, i) => !i || s !== salidas[i - 1]), '6. ocho pedidos seguidos: «quedó pedido» una sola vez y nunca igual seguido: ' + salidas.join(' · '));
ok(V('Listo, quedó pedido lo de cambiar el botón.', ['Listo, quedó pedido.']) === 'También quedó lo de cambiar el botón.', '6. con «lo de …», lo nombra corto');
ok(V('Listo, quedó sumado a «Música durante Alma».', ['Listo, quedó pedido.']) === 'Sumado a «Música durante Alma».', '6. un ajuste: «Sumado a «…».»');
ok(V('Listo, quedó pedido. Lo hago en segundo plano.', ['Listo, quedó pedido.']) === 'También quedó. Lo hago en segundo plano.', '6. el resto del texto queda');
ok(/quedó pedido\.$/.test(V('Listo, quedó pedido.', ['Mañana entran 3.', 'Listo, le escribí a Flor.'])), '6. sin pedido confirmado antes, la primera vez se dice completo');
ok(V('Listo, me encargo de que quedó pedido.', ['Listo, quedó pedido.']) !== 'También quedó.', '6. solo la frase fija se acorta');

const VV = caja.variarVoz_, SR = caja.variarSinRepetidas_;
ok(SR('Listo, le escribí a Flor. Le dije que llegas a las tres. Listo, le escribí a Flor.') === 'Listo, le escribí a Flor. Le dije que llegas a las tres.', '7. la misma frase dos veces en una respuesta: sale una vez');
ok(SR('Mañana entran tres huéspedes.\n\nMañana entran tres huéspedes. ¿Quieres los nombres?') === 'Mañana entran tres huéspedes.\n\n¿Quieres los nombres?', '7. tarjeta y respuesta con la misma frase: una vez');
ok(SR('Sí. Sí. Entran tres.') === 'Sí. Sí. Entran tres.', '7. frases cortas («Sí.») no cuentan como repetición');
const v1 = VV('Hecho, anoté la tarea. Te aviso cuando esté listo.', ['Listo, quedó pedido. Te aviso cuando esté listo.']);
ok(v1 === 'Hecho, anoté la tarea.', '7. lo ya dicho en la respuesta anterior no se repite: ' + v1);
ok(VV('Mañana entran tres huéspedes.', ['Mañana entran tres huéspedes.']) === 'Mañana entran tres huéspedes.', '7. si todo era repetido (pudo pedir que lo repitiera), se queda');
ok(VV('Listo, quedó pedido.', ['Hecho, quedó pedido.']) === 'También quedó.', '7. por voz también la confirmación corta');
const vz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8'), iVV = vz.indexOf('variarVoz_(r.respuesta'), iGV = vz.indexOf("opGuardar_(adm, 'alma', 'llamada', r.respuesta, r.hechas");
ok(iVV > 0 && iGV > iVV && /resultado: variarSinRepetidas_\(/.test(vz), '7. la llamada (vozSecretaria_) varía y quita repetidas antes de guardar y de decirlo');
ok(/canal === 'calle' \? variarVoz_\(resp/.test(cod), '7. la calle (voz al oído) también usa variarVoz_');
ok(/"id": "v_espera", "texto": "[^"]*cada vez distinta[^"]*solo lo nuevo/.test(fs.readFileSync(path.join(DIR, '..', 'playbooks', 'alma.json'), 'utf8')), '7. v_espera pide variar la frase de espera y decir solo lo nuevo');
process.exit(fallo);
