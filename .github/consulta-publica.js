/* Consultas sin reserva (Juan, 17-nov-2026): Alma responde lo público (piso, distancias a eventos) sin esperar a Juan,
   y lo privado (número de apartamento, WiFi, código) nunca sale. Corre las funciones reales del script, sin red.
   node .github/consulta-publica.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const src = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
const sacar = n => { const m = src.match(new RegExp('^(?:function ' + n + '\\([\\s\\S]*?\\n}|(?:var|const) ' + n + ' = .*;)$', 'm')); if (!m) throw new Error('No encontré ' + n); return m[0].replace(/^const /, 'var '); };
let fallo = 0; const ok = (c, t) => { console.log((c ? '✓ ' : '::error::') + t); if (!c) fallo = 1; };
const X = vm.createContext({});
try { vm.runInContext(['RX_CODIGO_ENVIADO_', 'fugaSinConfirmar_', 'tokensPrivados_', 'inqSinPrivado_', 'DIST_RX_', 'REGLAS_FIJAS_INQ_'].map(sacar).join('\n'), X); }
catch (e) { console.log('::error::' + e.message); process.exit(1); }
const ficha = 'Piso: 7\nApartamento / unidad: 703\nWiFi: red Casa clave "abc12345"';
ok(X.inqSinPrivado_('Zona 10 - Narama - 703', ficha, 'Está en el piso 7, a 10 min del estadio.') === 'Está en el piso 7, a 10 min del estadio.', '1 · el piso y la distancia salen tal cual');
ok(X.inqSinPrivado_('Zona 10 - Narama - 703', ficha, 'Está en el piso 7.\nEs el 703.\nLa clave del WiFi es abc12345.\nEl código es 4821.') === 'Está en el piso 7.', '2 · el número de apartamento, el WiFi y el código se quitan');
ok(X.fugaSinConfirmar_({ tokensPrivados: [] }, 'Tu código es 123456') === true, '3 · fugaSinConfirmar_ corre (RX_CODIGO_ENVIADO_ está definido en el script)');
['¿Qué tan lejos queda del estadio?', 'Voy al concierto del sábado, ¿a cuántos minutos queda?', 'How far is it from the stadium?', '¿Cómo llego al aeropuerto?']
  .forEach(t => ok(X.DIST_RX_.test(t), '4 · calcula distancia para «' + t + '»'));
ok(/piso o nivel/.test(X.REGLAS_FIJAS_INQ_) && /evento/.test(X.REGLAS_FIJAS_INQ_), '5 · la regla fija de datos públicos menciona el piso y los eventos');
ok(/prompt_\('INQUIRY_EVALUAR'\) \+ REGLAS_FIJAS_INQ_/.test(src), '6 · la regla fija va pegada al filtro de consultas (no depende de la hoja)');
process.exit(fallo);
