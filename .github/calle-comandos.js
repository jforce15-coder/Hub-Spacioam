/* Modo calle con comandos cortos (Juan, 17-nov-2026, «listo Llorens»): Alma contesta al oído como en un radio.
   1. la regla del canal (CALLE_REGLA_) pide comandos cortos: «Listo» y 1 a 4 palabras para confirmar, solo el dato para una
      pregunta (12 palabras como mucho), sin saludos ni repetir el pedido;
   2. la respuesta a un pedido se corta en la última frase entera que cabe en 12 palabras (CALLE_COMANDO_PALABRAS_);
   3. los avisos hablados y los errores siguen con su largo de antes (CALLE_PALABRAS_ = 20);
   4. táctica y una sola confirmación (Juan, 17-nov-2026): «Copiado», «Confirmado», «Listo», cálida; nunca dos
      confirmaciones seguidas ni la misma frase dos veces (calleUnaVez_), y la llamada no fuerza la frase previa.
   node .github/calle-comandos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const ctx = { console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, vozSinNotas_: t => String(t || '') };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'calle.js'), 'utf8') + '\nthis.__R = { regla: CALLE_REGLA_, cmd: CALLE_COMANDO_PALABRAS_, max: CALLE_PALABRAS_ };', ctx);
const R = ctx.__R, palabras = s => String(s).split(/\s+/).filter(Boolean).length;

ok(/TÁCTICO/.test(R.regla) && /sin saludos/.test(R.regla) && /sin repetir el pedido/.test(R.regla), '1 · la regla del Modo calle pide comandos cortos, sin saludos ni repetir el pedido');
ok(/1 a 4 palabras/.test(R.regla) && /«Copiado\.»/.test(R.regla) && /12 palabras como mucho/.test(R.regla), '1 · confirmar con «Copiado» o «Listo, …» y 1 a 4 palabras; una pregunta, solo el dato (12 palabras)');
ok(R.cmd === 12 && R.max === 20, '2 · 12 palabras para la respuesta; 20 siguen para avisos y errores');

const larga = 'Claro, con gusto. Ya anoté que mañana tienes la limpieza del 1104 a las nueve y le avisé a Flor por WhatsApp para que llegue temprano.';
const h = ctx.calleRespuesta_({}, { ok: true, alma: { texto: larga, acciones: [] } }).hablar;
ok(palabras(h) <= 12 && h === 'Claro, con gusto.', '2 · una respuesta larga se corta en la última frase entera que cabe: «' + h + '»');
ok(ctx.calleRespuesta_({}, { ok: true, alma: { texto: 'Listo, anotado.', acciones: [] } }).hablar === 'Listo, anotado.', '2 · «Listo, anotado.» pasa tal cual');
ok(ctx.calleRespuesta_({}, { ok: true, alma: { texto: '', acciones: [] } }).hablar === 'Listo.', '2 · sin texto, «Listo.»');

const err = ctx.calleRespuesta_({}, { ok: true, alma: { texto: '', acciones: [{ error: true, resumen: 'no encontré el contacto de la persona que me dijiste para mandarle el mensaje hoy' }] } }).hablar;
ok(palabras(err) > 12 && palabras(err) <= 20, '3 · un error sigue con hasta 20 palabras para decir qué falló');

ok(/UNA sola vez/.test(R.regla), '4 · la regla del canal pide una sola confirmación');
const k = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'playbooks', 'alma.json'), 'utf8')).canales.calle.reglas.find(x => x.id === 'k_corto').texto;
ok(/Táctica y cálida/.test(k) && /«Copiado\.»/.test(k) && /«Confirmado\.»/.test(k) && /una sola vez/.test(k) && /nunca dos seguidas/.test(k), '4 · k_corto (alma.json): táctica y cálida, «Copiado», «Confirmado», una sola confirmación');
const dos = [['Listo. Listo.', 'Listo.'], ['Copiado. Listo, anotado.', 'Listo, anotado.'], ['Listo, le escribí a Flor. Listo, le escribí a Flor.', 'Listo, le escribí a Flor.'],
  ['Confirmado.\n\nListo, quedó la tarea.', 'Listo, quedó la tarea.'], ['Copiado.', 'Copiado.'], ['Tres llegadas hoy.', 'Tres llegadas hoy.']];
dos.forEach(([t, e]) => { const h2 = ctx.calleRespuesta_({}, { ok: true, alma: { texto: t, acciones: [] } }).hablar; ok(h2 === e, '4 · «' + t.replace(/\n/g, ' ') + '» → «' + h2 + '»'); });
const voz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8');
ok(!/pre_tool_speech = sec \? 'force'/.test(voz) && /pre_tool_speech = sec \? 'auto'/.test(voz), '4 · la llamada no fuerza la frase antes de secretaria (ElevenLabs la duplicaba)');
ok(/MODO CALLE: táctica y cálida[^']*una sola confirmación/.test(voz), '4 · la llamada en Modo calle también habla táctico y confirma una vez');
process.exit(fallo);
