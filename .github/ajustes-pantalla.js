/* Ajustes a pantalla completa y Wearables (Juan, 17-nov-2026: «el menú está muy desordenado […] una sección solo para
   dispositivos: Wearables […] en el iPad en pantalla completa y en móvil en pantalla completa»). Revisa, sin navegador:
   1. Ninguna opción se perdió: cada interruptor, selector, botón y enlace de antes sigue en el panel (mismo id, una vez).
   2. La raíz y sus páginas: cada fila que abre una página tiene su página, y cada página su «‹ Ajustes».
   3. Pantalla completa (sin hoja flotando), iPad con la lista y la página lado a lado, claro y oscuro, reducir movimiento.
   4. Lo técnico va en Avanzado: Llaves y el Diagnóstico del anillo no están en las páginas de todos los días.
   5. Wearables: se llama así en Ajustes y en la herramienta de la voz; nada visible dice «Dispositivos».
   node .github/ajustes-pantalla.js [raíz] */
const fs = require('fs'), path = require('path');
const R = process.argv[2] || path.join(__dirname, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const H = fs.readFileSync(path.join(R, 'alma', 'inicio.html'), 'utf8');
const ini = H.indexOf('<div class="panel aj" id="panel"'), fin = H.indexOf('<div class="entrar fuera" id="entrar"');
ok(ini > 0 && fin > ini, '0 · el panel de Ajustes existe');
const P = H.slice(ini, fin);

/* 1 · nada se perdió */
const antes = ['p-av', 'p-nombre', 'p-correo', 'p-rol', 'p-alt-f', 'p-tel-f', 'g-tarjetas', 'b-tarjetas', 'g-face', 'i-face', 'g-escucha', 'i-escucha',
  'g-avisos', 's-hablado', 's-telefono', 'q-hablado', 'q-telefono', 'p-avisos-tipo', 'g-calle', 'i-calle-musica', 'b-calle-probar', 'g-conf-aj', 'i-conf-musica',
  'g-anillo', 'b-dispositivos', 'i-anillo', 'b-probar', 'd-anillo', 'b-anillo-ble', 'n-anillo-ble', 'g-atajos', 'l-atajos', 'i-atajo', 'b-atajo', 'i-atajos-todos',
  'g-pers', 'pp-tope', 'g-weebo', 'pp-niveles', 'pp-modo', 'g-huesp', 'pp-tope-h', 'g-comp', 'i-comp', 'g-llaves', 'l-llaves', 's-llave', 'i-llave', 'b-llave',
  'p-health-f', 'a-health', 'p-agentes', 'p-reportes', 'p-correos', 'p-conexiones', 'p-uso-f', 'p-aprendio-f', 'p-biblioteca-f', 'p-hub', 'b-salir', 'p-nota'];
const faltan = antes.filter(id => (P.match(new RegExp('id="' + id + '"', 'g')) || []).length !== 1);
ok(!faltan.length, '1 · las ' + antes.length + ' opciones de antes siguen, una vez cada una' + (faltan.length ? ': faltan ' + faltan.join(', ') : ''));

/* 2 · raíz y páginas */
const pags = [...P.matchAll(/<section class="aj-pag[^"]*" data-pag="([\w-]+)"/g)].map(m => m[1]);
const irs = [...new Set([...P.matchAll(/data-ir="([\w-]+)"/g)].map(m => m[1]))];
ok(pags[0] === 'raiz' && irs.length >= 7 && irs.every(n => pags.includes(n)), '2 · cada fila de la raíz abre su página: ' + irs.join(', '));
ok((P.match(/class="aj-atras"/g) || []).length === pags.length - 1, '2 · cada página tiene su «‹ Ajustes»');
ok(/function ajIr\(/.test(H) && /function ajAtras\(/.test(H) && /function ajResumir\(/.test(H) && /window\.AlmaAjustes = \{/.test(H), '2 · ir, volver y resumir (los subtítulos con cómo está cada cosa)');

/* 3 · pantalla completa, iPad, claro y oscuro, reducir movimiento */
ok(/#panel \{[^}]*left: 0; right: 0; top: 0; bottom: 0; width: 100%; height: 100%; max-height: none;[^}]*border-radius: 0;/.test(H), '3 · Ajustes ocupa toda la pantalla (sin hoja flotando)');
ok(/@media \(min-width: 900px\) \{\s*#panel/.test(H), '3 · en el iPad, la lista a la izquierda y la página a la derecha');
ok(/@media \(prefers-color-scheme: dark\) \{\s*#panel \{ --aj-fondo/.test(H), '3 · modo oscuro');
ok(/@media \(prefers-reduced-motion: reduce\) \{\s*#panel/.test(H), '3 · reducir movimiento: sin deslizar');

/* 4 · lo técnico en Avanzado */
const pag = (n) => { const i = P.indexOf('data-pag="' + n + '"'); return i < 0 ? '' : P.slice(i, P.indexOf('</section>', i)); };
ok(/id="g-llaves"/.test(pag('llaves')) && /id="b-anillo-ble"/.test(pag('diagnostico')) && /id="d-anillo"/.test(pag('diagnostico')), '4 · Llaves y el diagnóstico viven en sus páginas de Avanzado');
const raiz = pag('raiz'), av = raiz.slice(raiz.indexOf('>Avanzado<'));
ok(/data-ir="llaves"/.test(av) && /data-ir="diagnostico"/.test(av) && /id="p-conexiones"/.test(av) && /id="p-uso-f"/.test(av), '4 · la raíz los pone abajo, en «Avanzado»');

/* 5 · Wearables */
const visible = P.replace(/<[^>]+>/g, ' ');
ok(/data-ir="wearables"/.test(P) && /<b>Wearables<\/b>/.test(P) && !/Dispositivos/.test(visible), '5 · se llama «Wearables» en Ajustes (nada visible dice «Dispositivos»)');
ok(/AlmaAjustes\.wear\(e\.wearables \|\| null\)/.test(H) && /accion: "dispositivos", id:/.test(H), '5 · las tarjetas con la batería que manda la app y, al tocar una, su detalle nativo');
const an = fs.readFileSync(path.join(R, 'apps-script', 'anillo.js'), 'utf8');
ok(/pantalla Wearables/.test(an) && !/pantalla Dispositivos/.test(an), '5 · la voz (anillo_estado con mostrar) dice «Wearables»');

process.exit(fallo);
