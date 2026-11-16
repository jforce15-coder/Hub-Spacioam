/* UNA ROCA (Juan, 16-nov-2026): «en cada pantalla que naveguemos solo debe haber un botón roca […] siempre tiene que ser
   la misma con diferentes tamaños. El pulse de la roca es súper importante: siempre tiene que hacerlo y no tiene que tener
   ningún conflicto con las animaciones de alrededor». Revisa, sin navegador:
   1. El dibujo de la piedra vive en un solo lugar: piedraHTML() de js/sa-nav.js (la llamada, el portal y la roca suelta
      SANav.roca lo usan). Ninguna otra página ni script arma su propia piedra (san-rock / san-st-body) ni pinta una esfera
      propia con degradado que se llame roca, orbe o esfera.
   2. Nunca dos a la vez: el portal quita el anterior y esconde el botón mientras pasa; la piedra de la llamada esconde el
      botón (hideCore).
   3. El pulso: la voz inválida no congela la roca; la roca suelta respira (3,6 s) y se queda quieta con «reducir
      movimiento»; en el inicio, las esferas y los anillos en órbita respiran en la fase de la roca (sin desfases propios)
      y se quedan quietos mientras hay una llamada (el único pulso con la voz es el de la roca).
   4. Health usa la roca de Alma (SANav.roca) al conectar el anillo y en Respira.
   (En la app de iPhone lo mismo lo revisa su robot: solo Alma/RocaAlma.swift dibuja la piedra.)
   node .github/una-roca.js [raíz] */
const fs = require('fs'), path = require('path');
const R = process.argv[2] || path.join(__dirname, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(R, f), 'utf8');
function archivos(d, out) {
  for (const f of fs.readdirSync(path.join(R, d), { withFileTypes: true })) {
    const r = path.posix.join(d, f.name);
    if (f.name.startsWith('.') || f.name === 'node_modules' || /^(apps-script|pruebas|assets|ds|tools)$/.test(r)) continue;
    if (f.isDirectory()) archivos(r, out); else if (/\.(html|js)$/.test(f.name)) out.push(r);
  }
  return out;
}
const NAV = leer('js/sa-nav.js');

/* 1 · un solo dibujo */
ok((NAV.match(/function piedraHTML\(/g) || []).length === 1, '1 · sa-nav.js tiene una sola función que dibuja la piedra (piedraHTML)');
ok((NAV.match(/class="san-st-body"/g) || []).length === 1 && /function piedraHTML[\s\S]{0,400}class="san-st-body"/.test(NAV), '1 · el marcado de la piedra aparece una sola vez, dentro de piedraHTML');
ok(/ov\.innerHTML = [^\n]*piedraHTML\("san-rock"/.test(NAV) && /pv\.innerHTML = piedraHTML\("san-rock san-pp"/.test(NAV) && /piedraHTML\("san-rock san-rs"/.test(NAV), '1 · la llamada, el portal y la roca suelta usan piedraHTML');
const otros = archivos('', []).filter((f) => f !== 'js/sa-nav.js');
const propia = otros.filter((f) => /class=["']san-(rock|st-body|st-glow)|["']san-rock san-|san-st-body["']/.test(leer(f)));
ok(!propia.length, '1 · ninguna otra página ni script arma su propia piedra' + (propia.length ? ': ' + propia.join(', ') : ''));
const esferas = [];
otros.filter((f) => f.endsWith('.html')).forEach((f) => {
  const css = (leer(f).match(/<style[\s\S]*?<\/style>/g) || []).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  (css.match(/[^{}]+\{[^{}]*\}/g) || []).forEach((regla) => {
    const sel = regla.slice(0, regla.indexOf('{'));
    if (/(^|[\s.#-])(roca|orbe|esfera|stone)(\b|[-_])/i.test(sel) && /radial-gradient/.test(regla)) esferas.push(f + ' → ' + sel.trim().slice(0, 60));
  });
});
ok(!esferas.length, '1 · ninguna página pinta una roca, orbe o esfera propia con degradado (usa SANav.roca)' + (esferas.length ? ': ' + esferas.join(' · ') : ''));

/* 2 · nunca dos a la vez */
ok(/portalBarrer\(true\);[^\n]*nunca dos piedras/.test(NAV) && /if \(tengo\) hideCore\(true\)/.test(NAV), '2 · el portal quita el anterior y esconde el botón mientras pasa');
ok(/function hideCore\(h\)/.test(NAV) && /viejos\[vi\]\.remove\(\)/.test(NAV), '2 · un solo menú montado por página (la piedra del botón no se duplica)');

/* 3 · el pulso */
ok(/if \(!isFinite\(lv\)\) lv = 0;/.test(NAV) && /J\.p = \(1 - Math\.cos\(2 \* Math\.PI \* \(\(t % PULSE\) \/ PULSE\)\)\) \/ 2/.test(NAV), '3 · la roca respira con su ciclo y una voz inválida no la congela');
ok(/\.san-rock\.san-rs\{[^"]*animation:san-core 3\.6s/.test(NAV) && /prefers-reduced-motion:reduce\)\{\.san-scope \.san-rock\.san-rs\{animation:none\}/.test(NAV), '3 · la roca suelta respira siempre (3,6 s) y se queda quieta con «reducir movimiento»');
const INI = leer('alma/inicio.html');
ok(!/setProperty\("--dl"/.test(INI), '3 · inicio: las esferas y los anillos en órbita no tienen desfases propios');
ok(/window\.SAPulso = \{/.test(INI) && /a\.startTime = 0/.test(INI) && /SAPulso\.enFase\(o\)/.test(INI) && /SAPulso\.enFase\(el\)/.test(INI), '3 · inicio: las esferas y los anillos respiran en la fase de la roca');
ok(/html:has\(#sa-nav-root \.san-ov\.on:not\(\.quieta\)\) \.pob-s \.resp[^{]*\{ animation: none; \}/.test(INI) && /html:has\(#sa-nav-root \.san-ov\.on:not\(\.quieta\)\) \.esf \.resp/.test(INI), '3 · inicio: con una llamada, solo la roca pulsa (esferas y órbitas quietas)');

/* 4 · Health */
const H = leer('health/index.html');
ok(/sa-nav\.js\?v=/.test(H) && /SANav\.roca\(document\.querySelector\("\.conexion \.orbe"\)/.test(H) && /SANav\.roca\(\$\("esfera"\)/.test(H), '4 · Health usa la roca de Alma al conectar el anillo y en Respira');

if (fallo) process.exit(1);
console.log('Una sola roca.');
