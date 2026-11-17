/* Arma el pedido para el Mudador (lo usa .github/workflows/traslado.yml). Lee la llave de MUDADOR_LLAVE (secreto) y la
   pone en el archivo de salida; nunca la imprime.
     node traslado/empacar.js publicar <proyecto> <carpeta con el código> <sha> <salida.json> [crear]
     node traslado/empacar.js mudador  <sha> <salida.json>          (el Mudador se sube a sí mismo: traslado/)
     node traslado/empacar.js estado   <salida.json> */
const fs = require('fs'), path = require('path');

function archivos(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const ruta = path.join(dir, f);
    if (!fs.statSync(ruta).isFile()) continue;
    const ext = path.extname(f), nombre = path.basename(f, ext);
    if (f === 'appsscript.json') out.push({ name: 'appsscript', type: 'JSON', source: fs.readFileSync(ruta, 'utf8') });
    else if (ext === '.js' || ext === '.gs') out.push({ name: nombre, type: 'SERVER_JS', source: fs.readFileSync(ruta, 'utf8') });
    else if (ext === '.html') out.push({ name: nombre, type: 'HTML', source: fs.readFileSync(ruta, 'utf8') });
  }
  if (!out.some(a => a.name === 'appsscript')) throw new Error('Falta appsscript.json en ' + dir);
  return out;
}

function armar(argv, env) {
  const llave = env.MUDADOR_LLAVE || '';
  if (!llave) throw new Error('Falta el secreto MUDADOR_LLAVE');
  const [accion] = argv;
  if (accion === 'estado') return { salida: argv[1], cuerpo: { llave, accion: 'estado' } };
  if (accion === 'mudador') {
    const dir = path.join(__dirname);
    const lista = archivos(dir).filter(a => a.name === 'appsscript' || a.name === 'Mudador');
    return { salida: argv[2], cuerpo: { llave, accion: 'actualizar_mudador', sha: argv[1], archivos: lista } };
  }
  if (accion === 'publicar') {
    const [, proyecto, dir, sha, salida, crear] = argv;
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'proyectos.json'), 'utf8'))[proyecto];
    if (!cfg || proyecto.startsWith('_')) throw new Error('Proyecto desconocido: ' + proyecto);
    return { salida, cuerpo: { llave, accion: 'publicar', proyecto, titulo: cfg.titulo, viejo: cfg.viejo, copiar: cfg.copiar,
      excluir: cfg.excluir, al_traer: cfg.al_traer, sha, mensaje: env.MENSAJE || '', crear: crear === 'true', archivos: archivos(dir) } };
  }
  throw new Error('Acción desconocida: ' + accion);
}

if (require.main === module) {
  try {
    const { salida, cuerpo } = armar(process.argv.slice(2), process.env);
    fs.writeFileSync(salida, JSON.stringify(cuerpo), { mode: 0o600 });
    console.log('Pedido listo: ' + cuerpo.accion + (cuerpo.archivos ? ' · ' + cuerpo.archivos.length + ' archivos' : ''));
  } catch (e) { console.log('::error::' + e.message); process.exit(1); }
}
module.exports = { armar, archivos };
