/* Consulta que quiere reservar (19-nov-2026, Booking, Mónaco B2): «No other questions thanks can we book please» quedó sin
   respuesta (el filtro lo tomó como «solo agradeció») y la primera respuesta tardó ~6 min esperando el automático de
   Hospitable, que en Booking no pre-aprueba nada. Corre las funciones reales del script, sin red.
   node .github/consulta-reservar.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const src = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
const sacar = n => { const m = src.match(new RegExp('^(?:function ' + n + '\\([\\s\\S]*?\\n}|(?:var|const) ' + n + ' = .*;)$', 'm')); if (!m) throw new Error('No encontré ' + n); return m[0].replace(/^const /, 'var '); };
let fallo = 0; const ok = (c, t) => { console.log((c ? '✓ ' : '::error::') + t); if (!c) fallo = 1; };
const X = vm.createContext({});
try { vm.runInContext(['INQ_RESERVAR_RX_', 'inqQuiereReservar_', 'inqIdiomaReservar_', 'inqComoReservar_'].map(sacar).join('\n'), X); }
catch (e) { console.log('::error::' + e.message); process.exit(1); }
['No other questions thanks can we book please :), thanks', 'I was hoping to book a one night stay at this apartment', "I'd like to book it",
 'How do I book?', 'Quiero reservar del 8 al 9', '¿Cómo reservo?', '¿Cómo hago para reservar?', 'Podemos hacer la reserva?', 'Me gustaría reservar']
  .forEach(t => ok(X.inqQuiereReservar_(t), '1 · quiere reservar: «' + t + '»'));
['Thanks!', 'Is parking included?', 'I already booked on Booking.com', 'Mi reserva es del 8', '¿Tiene parqueo?', 'Gracias, todo bien']
  .forEach(t => ok(!X.inqQuiereReservar_(t), '2 · no es intención de reservar: «' + t + '»'));
ok(X.inqIdiomaReservar_('English', '') === 'en' && X.inqIdiomaReservar_('', '¿Cómo reservo?') === 'es' && X.inqIdiomaReservar_('es', 'book') === 'es', '3 · idioma del texto fijo');
const bk = X.inqComoReservar_('booking', 'en', true), ab = X.inqComoReservar_('airbnb', 'es', true);
ok(/Booking\.com/.test(bk) && /book directly from our listing/.test(bk), '4 · Booking: reservar desde el anuncio');
ok(/Airbnb/.test(ab) && /Reservar/.test(ab), '5 · Airbnb: tocar «Reservar»');
ok(![bk, ab].some(t => /\b\d{3,}\b|wifi|c[oó]digo|code|apartment number|we.ll send|te enviamos/i.test(t)), '6 · sin datos privados ni promesas que abran un caso');
ok(/const esBooking = \/booking\/\.test\(inf\.plataforma/.test(src) && /if \(!prog && !esBooking && desdeMs/.test(src), '7 · Booking no espera el automático (Airbnb sí, pre-aprueba)');
ok(/if \(inqQuiereReservar_\(pregunta\)\)/.test(src) && src.indexOf('if (inqQuiereReservar_(pregunta))') < src.indexOf("nota: 'inquiry: seguimiento sin pregunta'"), '8 · la intención de reservar se revisa antes de «seguimiento sin pregunta»');
process.exit(fallo);
