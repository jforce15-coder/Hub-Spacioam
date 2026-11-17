/* Prueba de apps-script/unificar.js (Juan, 17-nov-2026, #715): un pedido, un microproyecto, venga de donde venga.
   Revisa que:
   1. un reintento con otras palabras (por otro canal) va al microproyecto que ya existe;
   2. si el tema de la conversación se eligió con certeza y tiene microproyecto, va ahí; «el más reciente» no basta;
   3. algo distinto abre uno nuevo; lo cerrado y lo de otra persona no se toca;
   4. un reintento mientras Claude trabaja (sin respuesta suya, menos de 3 h) no abre otra sesión;
   5. está conectado: paraClaudeCrear_ lo usa, escalar (llamada, WhatsApp, Maricarmen) y el chat lo piden, y lo que Juan
      dijo que es nuevo («Es nuevo», «es otro» en Hablar con Claudio) no se une.
   node .github/unificar-pedidos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const caja = {
  console, JEV_UMBRAL_: 0.8, TEMA_ACT_: null,
  esAdminPrincipal_: a => !!(a && a.principal),
  chatNorm_: x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(),
  claudeNivel_: n => n === 'sencillo' ? 'sencillo' : 'complejo'
};
vm.createContext(caja);
vm.runInContext(leer('microproyectos.js'), caja);
vm.runInContext(leer('unificar.js'), caja);

const H = 3600000, ahora = Date.now();
const micro = (id, nombre, texto, o) => Object.assign({ id, nombre, estado: caja.MICRO_ESTADOS_.trabajo, quien: 'juan@x', actualizado: ahora - H, tema_id: '', pr: '', unido: '',
  ajustes: [{ ts: ahora - H, de: 'juan', texto: nombre + ': ' + texto }] }, o || {});
let lista = [
  micro('mpuber1', 'Uber con Alma', 'Que Alma pueda pedir un Uber para los huéspedes desde la llamada y mande el enlace del viaje'),
  micro('mpluz22', 'Sonido al colgar', 'Que la app haga un sonido suave cuando cuelgo la llamada con Alma', { tema_id: 'tm7' }),
  micro('mpvie33', 'Reporte de limpieza', 'Que el reporte semanal de limpieza salga en PDF con las fotos de cada apartamento', { estado: caja.MICRO_ESTADOS_.cerrado })
];
caja.microAbiertos_ = (email) => lista.filter(m => !email || m.quien === email);
caja.microElegir_ = () => ({ nuevo: true });
const juan = { email: 'juan@x', principal: true }, otro = { email: 'otro@x', principal: false };
const U = (t) => caja.microUnificar_(juan, t, { sinJev: true });

// 1. Reintento
let r = U('Alma, te pedí que puedas pedir un Uber para los huéspedes desde la llamada, ¿sí quedó? Que mande el enlace del viaje');
ok(r && r.id === 'mpuber1' && r.por === 'reintento', '1. el mismo pedido con otras palabras va a «Uber con Alma» (reintento)');
r = U('otra vez: el uber para los huéspedes desde la llamada, con el enlace del viaje');
ok(r && r.id === 'mpuber1', '1. un reintento corto también');

// 2. Tema de la conversación
caja.TEMA_ACT_ = { id: 'tm7', por: 'jev', email: 'juan@x' };
r = U('y que también vibre un poquito');
ok(r && r.id === 'mpluz22' && r.por === 'tema', '2. con el tema elegido con certeza, va a su microproyecto');
caja.TEMA_ACT_ = { id: 'tm7', por: 'reciente', email: 'juan@x' };
ok(U('y que también vibre un poquito') === null, '2. «el más reciente» no basta para unir');
caja.TEMA_ACT_ = { id: 'tm7', por: 'orbita', email: 'otro@x' };
ok(U('y que también vibre un poquito') === null, '2. el tema de otra persona no cuenta');
caja.TEMA_ACT_ = null;

// 3. Distinto, cerrado, otra persona
ok(U('Quiero que Epi muestre el saldo de cada socio en la portada') === null, '3. algo distinto abre uno nuevo');
ok(U('Que el reporte semanal de limpieza salga en PDF con las fotos de cada apartamento') === null, '3. un microproyecto cerrado no recibe nada');
ok(caja.microUnificar_(otro, 'pedir un Uber para los huéspedes desde la llamada y mande el enlace', { sinJev: true }) === null, '3. solo el administrador principal');
caja.microElegir_ = () => ({ id: 'mpluz22', nombre: 'Sonido al colgar', seguro: true });
r = U('cambia el tono del final');
ok(r && r.id === 'mpluz22' && r.por === 'palabras', '3. la regla de palabras de siempre (segura) también une');
caja.microElegir_ = () => ({ id: 'mpluz22', nombre: 'Sonido al colgar', seguro: false });
ok(U('cambia el tono del final') === null, '3. con duda de palabras no se une solo');

// 4. En curso
ok(caja.unifEnCurso_(lista[0], ahora) === true, '4. Claude trabaja y no ha respondido: es reintento, no sale otra sesión');
const resp = Object.assign({}, lista[0], { ajustes: lista[0].ajustes.concat([{ ts: ahora - 1000, de: 'claude', texto: 'Listo' }]) });
ok(caja.unifEnCurso_(resp, ahora) === false, '4. si Claude ya respondió, el reintento sale como ajuste');
ok(caja.unifEnCurso_(Object.assign({}, lista[0], { ajustes: [{ ts: ahora - 4 * H, de: 'juan', texto: 'x' }] }), ahora) === false, '4. después de 3 h sin respuesta, sale otra vez');

// 5. Conectado
const pc = leer('paraclaude.js'), es = leer('escalar.js'), ch = leer('chat.js'), cl = leer('claudio.js');
ok(/inp\.unificar[\s\S]{0,400}microUnificar_\(/.test(pc) && /unifEnCurso_\(m\)\)\s*return unifAnotarReintento_/.test(pc), '5. paraClaudeCrear_ busca el microproyecto y no dispara otra sesión en un reintento');
ok(/paraClaudeCrear_\([\s\S]{0,400}unificar: true/.test(es), '5. lo que Alma escala (llamada, WhatsApp, Maricarmen, Desarrollo) se une');
ok(/unificar: !b\.micro && !b\.nuevo/.test(ch), '5. el chat se une, salvo que Juan dijo «Es nuevo»');
ok(/nuevoJuan: micro === 'nuevo'/.test(cl) && /o\.nuevoJuan\)[^\n]*b\.nuevo = true/.test(ch), '5. «es otro» en Hablar con Claudio no se une');
process.exit(fallo);
