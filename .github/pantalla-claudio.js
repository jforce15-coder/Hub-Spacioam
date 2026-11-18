/* La pantalla llega a Claudio (pedido pc1795009527355, 18-nov-2026), con dobles: sin caché real, sin IA.
   Juan: «Mira esta pantalla. Hay un ícono mal posicionado. Necesito que lo corrijas.» y el pedido salió sin la captura.
   1. pantallaGuardar_ guarda la descripción por persona y pantallaParaClaude_ la devuelve en un bloque, con la hora.
   2. Pasados 30 min ya no va; otra persona no ve la de Juan; sin captura, nada.
   3. almaFoto_ (captura del chat y de la llamada) la guarda; paraClaudeCrear_ la pone en la instrucción, no en el issue.
   node .github/pantalla-claudio.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const caja = {};
const ctx = { console, JSON, Date, Math, String, Number, CacheService: { getScriptCache: () => ({ put: (k, v) => { caja[k] = v; }, get: k => caja[k] || null }) } };
vm.createContext(ctx); vm.runInContext(leer('pantalla.js'), ctx);

ok(ctx.pantallaParaClaude_('juan@x') === '', '1 · sin captura no va nada');
ctx.pantallaGuardar_('Juan@x', 'Pantalla Bandeja: el ícono de la campana está encima del título.');
const b = ctx.pantallaParaClaude_('juan@x');
ok(/^### Lo que tenía en pantalla/.test(b) && /campana está encima del título/.test(b) && /no va al issue/.test(b), '1 · la captura va en un bloque, privado');
ok(ctx.pantallaParaClaude_('otra@x') === '', '2 · otra persona no ve la captura de Juan');
const j = JSON.parse(caja['ALMA_PANTALLA_juan@x']); j.t -= 31 * 60000; caja['ALMA_PANTALLA_juan@x'] = JSON.stringify(j);
ok(ctx.pantallaParaClaude_('juan@x') === '', '2 · pasados 30 min ya no va');

const cod = leer('Código.js'), pc = leer('paraclaude.js');
const foto = (cod.match(/function almaFoto_[\s\S]*?\n}/) || [''])[0];
ok((foto.match(/pantallaGuardar_\(ses\.email, t[vc]\)/g) || []).length === 2, '3 · almaFoto_ guarda la captura del chat y de la llamada');
ok(/pantallaParaClaude_\(adm\.email\)/.test(pc) && /var instruccion = cuerpo \+ \(pantalla \?/.test(pc) && !/cuerpo[^;\n]*pantalla[^;\n]*paraClaudeIssue_|cuerpo \+= pantalla/.test(pc), '3 · paraClaudeCrear_ la pone en la instrucción, no en el issue');

process.exit(fallo);
