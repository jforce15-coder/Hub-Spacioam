/* Mapa de funciones (docs/mapa-funciones.json; Juan, 20-nov-2026): la lista de lo que Juan usa y cómo se comprueba
   corriendo la página. Los bots lo recorren después de unir (pruebas/bots.mjs); esta revisión, sin navegador y en
   segundos, cuida que el mapa no quede viejo: JSON válido, ids únicos, cada página existe, cada «#id» que el bot busca
   aparece en su página o en un script de js/, y cada revisión nombrada existe. Así, si renombras un id o borras una
   página, el PR lo dice antes de que los bots fallen después de unir.
   node .github/mapa-funciones.js [raíz] */
const fs = require('fs'), path = require('path');
const R = process.argv[2] || path.join(__dirname, '..');
let fallo = 0; const mal = (m) => { console.log('::error file=docs/mapa-funciones.json::' + m); fallo = 1; };
let mapa;
try { mapa = JSON.parse(fs.readFileSync(path.join(R, 'docs/mapa-funciones.json'), 'utf8')); }
catch (e) { mal('docs/mapa-funciones.json no es JSON válido (' + e.message + '). Corrígelo: los bots lo leen después de unir.'); process.exit(1); }
const js = fs.readdirSync(path.join(R, 'js')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(R, 'js', f), 'utf8')).join('\n');
const vistos = new Set(); let conBot = 0;
for (const f of mapa.funciones || []) {
  if (!f.id || vistos.has(f.id)) mal('Función sin id o con id repetido: «' + (f.funcion || f.id) + '». Cada función lleva un id único.');
  vistos.add(f.id);
  if (!f.funcion || !f.para_juan || !(f.como_verificar || []).length) mal('«' + f.id + '» necesita funcion, para_juan y como_verificar (pasos de una persona).');
  for (const r of f.revisiones || []) if (!fs.existsSync(path.join(R, r))) mal('«' + f.id + '» nombra la revisión ' + r + ', que no existe. Pon la que la cuida hoy o quítala.');
  if (!f.bot) { if (!f.sin_bot) mal('«' + f.id + '» no tiene bot: di por qué en sin_bot.'); continue; }
  conBot++;
  const pag = path.join(R, f.bot.pagina || '');
  if (!f.bot.pagina || !fs.existsSync(pag)) { mal('«' + f.id + '»: la página ' + f.bot.pagina + ' no existe. Si la moviste, corrige el mapa.'); continue; }
  if (!/^(telefono|computadora)$/.test(f.bot.ancho || 'telefono')) mal('«' + f.id + '»: ancho es «telefono» o «computadora».');
  const html = fs.readFileSync(pag, 'utf8');
  for (const s of [].concat(f.bot.ver || [], f.bot.luego || [], f.bot.tocar ? [f.bot.tocar] : [])) {
    const id = (s.match(/#([\w-]+)/) || [])[1];
    if (id && !new RegExp('id=["\']' + id + '["\']|["\'#]' + id + '["\']').test(html + js)) mal('«' + f.id + '» busca ' + s + ' y ' + f.bot.pagina + ' ya no tiene ese id. Si lo renombraste, corrige el mapa en este PR (los bots lo buscan después de unir).');
  }
}
if (!fallo) console.log('✓ Mapa de funciones: ' + vistos.size + ' funciones, ' + conBot + ' con su bot.');
process.exit(fallo);
