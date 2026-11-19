/* Despedida única (Juan, 19-nov-2026: «solo te puedes despedir una vez, a menos que haya una interrupción del usuario
   antes de cortar la llamada… Si el usuario no responde, cuelgas. Hay que colgar la llamada porque no estás colgando»).
   1. La voz del Hub tiene la regla DESPEDIDA ÚNICA: una sola despedida y, si luego calla o solo responde otra cortesía,
      end_call sin hablar; solo una interrupción con algo nuevo abre otra despedida. Con conversación continua no se despide.
      La espera de unos segundos la dan el turno de ElevenLabs y, en la app de iPhone, su reloj tras la despedida.
   2. La descripción de end_call y el SILENCIO LARGO dicen lo mismo (también en la app de Alma: antes solo «fuera de la app»).
   3. La fuente única (playbooks/alma.json → almafuente.js) dice lo mismo.
   node .github/despedida-unica.js [carpeta apps-script] */
const fs = require('fs'), path = require('path');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const VOZ = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8');
const regla = n => (VOZ.match(new RegExp("'· " + n + "[^\\n]*")) || [''])[0];

const du = regla('Nunca cuelgues tú primero');
ok(/DESPEDIDA ÚNICA: te despides UNA sola vez; si luego calla o solo responde otra cortesía, end_call sin hablar/.test(du), '1 · una sola despedida y, si calla o solo responde otra cortesía, cuelga sin hablar');
ok(/\(otra solo si te interrumpe con algo nuevo\)/.test(du), '1 · solo una interrupción con algo nuevo abre otra despedida');
ok(/CONVERSACIÓN CONTINUA nunca cuelgas tú ni te despides/.test(du), '1 · con conversación continua no se despide (Modo calle y conferencia)');

const ec = (VOZ.match(/end_call: '[^\n]*/) || [''])[0];
ok(/DESPEDIDA ÚNICA[^']*úsala sin decir nada más; nunca te despidas dos veces/.test(ec), '2 · la descripción de end_call: tras la despedida sin respuesta, cuelga sin hablar');
const sl = regla('SILENCIO LARGO');
ok(/aquí estoy»\); si no responde, end_call\./.test(sl) && !/fuera de la app de Alma, usa end_call/.test(sl), '2 · SILENCIO LARGO: también en la app cuelga ella (antes solo fuera de la app)');

const pb = fs.readFileSync(path.join(DIR, '..', 'playbooks', 'alma.json'), 'utf8'), af = fs.readFileSync(path.join(DIR, 'almafuente.js'), 'utf8');
const vd = /Despídete una sola vez, corto y cálido\. Si luego calla o solo responde otra cortesía, cuelga sin decir nada más/;
ok(vd.test(pb) && vd.test(af), '3 · la fuente única (v_despedida) dice lo mismo y almafuente.js está al día');
process.exit(fallo);
