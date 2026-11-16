/* Modo calle en un solo control (Juan, 16-nov-2026): en la pantalla principal de la app (alma/inicio.html) solo queda el
   botón del caminante. Un toque = Alma escucha ya (que: "ahora"); un toque largo = enciende o apaga el Modo calle que
   espera «Alma» (que: "on" / "off"), con una señal clara en el botón (respira y lleva un punto) y en la línea de estado.
   «Probar el Modo calle» se abre tocando esa línea o desde Ajustes. Ya no hay interruptor «Modo calle encendido».
   node .github/calle-boton.js */
const fs = require('fs'), path = require('path');
const H = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

ok(!/id="i-calle"/.test(H) && !/id="f-calle-on"/.test(H) && !/\$\("i-calle"\)/.test(H), 'ya no hay interruptor «Modo calle encendido» en Ajustes');
const toque = (H.match(/\$\("b-calle"\)\.onclick = function \(\) \{[\s\S]*?\n  \};/) || [''])[0];
ok(/if \(CALLE\.largo\) \{ CALLE\.largo = false; return; \}/.test(toque) && /que: "ahora"/.test(toque), 'un toque: Alma escucha ya (y el toque que sigue a un toque largo no escucha)');
const largo = (H.match(/var b = \$\("b-calle"\), t = null;[\s\S]*?\n    \}\);/) || [''])[0];
ok(/CALLE\.largo = true/.test(largo) && /callePoner\(!calleOn\(\)\)/.test(largo) && !/cpAbrir/.test(largo), 'un toque largo: enciende o apaga el Modo calle (ya no abre «Probar»)');
const poner = (H.match(/function callePoner\(on\) \{[\s\S]*?\n  \}/) || [''])[0];
ok(/que: on \? "on" : "off"/.test(poner) && /CALLE\.recien = /.test(poner) && /grabadora\(on\)/.test(poner), 'encender o apagar lo guarda la app (on/off), suena y se ve en la línea unos segundos');
ok(/classList\.toggle\("encendido", on\)/.test(H) && /\.calle\.encendido::before/.test(H) && /\.calle\.esperando \{/.test(H), 'el botón dice si está encendido: respira y lleva un punto');
ok(/\$\("calle-linea"\)\.onclick = function \(\) \{ cpAbrir\(\); \}/.test(H) && /\$\("b-calle-probar"\)\.onclick = function \(\) \{ cpAbrir\(\); \}/.test(H), '«Probar el Modo calle»: tocando la línea o desde Ajustes');
ok(/Date\.now\(\) < CALLE\.recien/.test(H), 'al apagarlo, «Modo calle · apagado» se ve un momento en la línea');

if (fallo) process.exit(1);
console.log('Todo bien.');
