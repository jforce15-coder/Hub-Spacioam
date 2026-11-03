/* Fuente única de Alma (decisión de Juan, 3-nov-2026): playbooks/alma.json y playbooks/huespedes.json son lo que se
   edita (con historial y checks). Apps Script no puede leer el repo, así que este script los copia, tal cual, a
   apps-script/almafuente.js (se publica con el resto del código). Nunca edites almafuente.js a mano.
     node tools/alma-fuente.js            regenera apps-script/almafuente.js
     node tools/alma-fuente.js --revisar  falla si almafuente.js no está al día (check de estandares.yml) */
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const leer = n => JSON.parse(fs.readFileSync(path.join(raiz, 'playbooks', n), 'utf8'));
const salida = path.join(raiz, 'apps-script', 'almafuente.js');
const texto = '/* GENERADO por tools/alma-fuente.js desde playbooks/alma.json y playbooks/huespedes.json: no lo edites a mano.\n' +
  '   Lo convierte en texto almaPrompt_ / huespedesReglas_ (persona.js). */\n' +
  'var ALMA_FUENTE_ = ' + JSON.stringify(leer('alma.json'), null, 1) + ';\n' +
  'var HUESPEDES_FUENTE_ = ' + JSON.stringify(leer('huespedes.json'), null, 1) + ';\n';
if (process.argv.includes('--revisar')) {
  const hoy = fs.existsSync(salida) ? fs.readFileSync(salida, 'utf8') : '';
  if (hoy !== texto) { console.log('::error::apps-script/almafuente.js no está al día con playbooks/alma.json o huespedes.json: corre «node tools/alma-fuente.js» y súbelo.'); process.exit(1); }
  console.log('✓ almafuente.js al día'); process.exit(0);
}
fs.writeFileSync(salida, texto);
console.log('apps-script/almafuente.js: ' + texto.length + ' caracteres');
