/* Modo calle con comandos cortos (Juan, 17-nov-2026, «listo Llorens»): Alma contesta al oído como en un radio.
   1. la regla del canal (CALLE_REGLA_) pide comandos cortos: «Listo» y 1 a 4 palabras para confirmar, solo el dato para una
      pregunta (12 palabras como mucho), sin saludos ni repetir el pedido;
   2. la respuesta a un pedido se corta en la última frase entera que cabe en 12 palabras (CALLE_COMANDO_PALABRAS_);
   3. los avisos hablados y los errores siguen con su largo de antes (CALLE_PALABRAS_ = 20).
   node .github/calle-comandos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const ctx = { console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, vozSinNotas_: t => String(t || '') };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'calle.js'), 'utf8') + '\nthis.__R = { regla: CALLE_REGLA_, cmd: CALLE_COMANDO_PALABRAS_, max: CALLE_PALABRAS_ };', ctx);
const R = ctx.__R, palabras = s => String(s).split(/\s+/).filter(Boolean).length;

ok(/COMANDO CORTO/.test(R.regla) && /sin saludos/.test(R.regla) && /sin repetir el pedido/.test(R.regla), '1 · la regla del Modo calle pide comandos cortos, sin saludos ni repetir el pedido');
ok(/1 a 4 palabras/.test(R.regla) && /«Listo\.»/.test(R.regla) && /12 palabras como mucho/.test(R.regla), '1 · confirmar con «Listo» y 1 a 4 palabras; una pregunta, solo el dato (12 palabras)');
ok(R.cmd === 12 && R.max === 20, '2 · 12 palabras para la respuesta; 20 siguen para avisos y errores');

const larga = 'Claro, con gusto. Ya anoté que mañana tienes la limpieza del 1104 a las nueve y le avisé a Flor por WhatsApp para que llegue temprano.';
const h = ctx.calleRespuesta_({}, { ok: true, alma: { texto: larga, acciones: [] } }).hablar;
ok(palabras(h) <= 12 && h === 'Claro, con gusto.', '2 · una respuesta larga se corta en la última frase entera que cabe: «' + h + '»');
ok(ctx.calleRespuesta_({}, { ok: true, alma: { texto: 'Listo, anotado.', acciones: [] } }).hablar === 'Listo, anotado.', '2 · «Listo, anotado.» pasa tal cual');
ok(ctx.calleRespuesta_({}, { ok: true, alma: { texto: '', acciones: [] } }).hablar === 'Listo.', '2 · sin texto, «Listo.»');

const err = ctx.calleRespuesta_({}, { ok: true, alma: { texto: '', acciones: [{ error: true, resumen: 'no encontré el contacto de la persona que me dijiste para mandarle el mensaje hoy' }] } }).hablar;
ok(palabras(err) > 12 && palabras(err) <= 20, '3 · un error sigue con hasta 20 palabras para decir qué falló');
process.exit(fallo);
