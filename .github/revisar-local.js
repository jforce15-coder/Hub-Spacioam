/* Revisar en local, antes de subir (17-nov-2026): los agentes subían sin correr las revisiones y «Revisar estándares»
   salía en rojo una y otra vez. Este script corre, en silencio y sin red ni secretos, los mismos pasos de
   .github/workflows/estandares.yml y revisar-apps-script.yml (los lee del propio yml: un paso nuevo entra solo) y al
   final dice solo «OK (N revisiones)» o las revisiones que fallaron con sus líneas de error (máximo 30 por fallo).
   Así el resultado cuesta cientos de tokens y no miles.
     node .github/revisar-local.js            corre todo
     node .github/revisar-local.js --hook     modo hook de Claude Code (PreToolUse en Bash): solo actúa en «git push»;
                                              si algo falla, sale con 2 y el resumen va a stderr (bloquea el push).
   Se salta lo que no tiene sentido sin PR: los pasos que leen el cuerpo del PR ($CUERPO) y los «uses:». Los «git fetch»
   se quitan y FETCH_HEAD se vuelve origin/$BASE (se intenta un fetch rápido al inicio; sin red usa el origin/main local).
   Emergencia: SALTAR_REVISION=1 delante del push lo deja pasar (no lo uses para esquivar un rojo). */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');

const YMLS = ['.github/workflows/estandares.yml', '.github/workflows/revisar-apps-script.yml'];
const MAX_LINEAS = 30;

function pasos(texto, archivo) {
  const out = []; const ls = texto.split('\n'); let paso = null;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    const m = l.match(/^(\s*)- (name|uses):\s*(.*)$/);
    if (m) { paso = { nombre: m[2] === 'name' ? m[3].trim() : null, uses: m[2] === 'uses', archivo }; out.push(paso); continue; }
    if (!paso) continue;
    if (/^\s+uses:/.test(l)) { paso.uses = true; continue; }
    const r = l.match(/^(\s*)run:\s*(.*)$/);
    if (!r) continue;
    if (/^[|>][-+]?$/.test(r[2].trim())) {
      const base = r[1].length, cuerpo = [];
      while (i + 1 < ls.length && (ls[i + 1].trim() === '' || ls[i + 1].match(/^\s*/)[0].length > base)) cuerpo.push(ls[++i]);
      const sangria = Math.min(...cuerpo.filter(x => x.trim()).map(x => x.match(/^\s*/)[0].length));
      paso.run = cuerpo.map(x => x.slice(sangria)).join('\n');
    } else paso.run = r[2];
  }
  return out.filter(p => p.run && !p.uses);
}

function preparar(run) {
  return run.split('\n').filter(l => !/^\s*git fetch\b/.test(l)).join('\n').replace(/\bFETCH_HEAD\b/g, '"origin/$BASE"');
}

function limpiar(salida) {
  const ls = salida.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l && !/^\s*✓/.test(l) && !/^\s+at .*(node:internal|\(node:)/.test(l));
  const err = ls.filter(l => /::error|Error|error:|✗|FALL/i.test(l));
  const elegidas = err.length ? ls.filter(l => !/::warning/.test(l)) : ls.slice(-MAX_LINEAS);   // con errores: desde el principio
  const recorte = elegidas.slice(0, MAX_LINEAS);
  if (elegidas.length > MAX_LINEAS) recorte.push(`… (${elegidas.length - MAX_LINEAS} líneas más)`);
  return recorte.map(l => '    ' + l.replace(/^::(error|warning)[^:]*::/, '')).join('\n');
}

function correr(raiz) {
  const t0 = Date.now();
  try { cp.execFileSync('git', ['fetch', '-q', 'origin', 'main'], { cwd: raiz, stdio: 'ignore', timeout: 15000 }); } catch (e) {}
  const lista = [];
  for (const y of YMLS) {
    const f = path.join(raiz, y);
    if (fs.existsSync(f)) lista.push(...pasos(fs.readFileSync(f, 'utf8'), path.basename(y)));
  }
  const corren = lista.filter(p => !/\$\{?CUERPO\b/.test(p.run));
  const env = Object.assign({}, process.env, { BASE: 'main', CUERPO: '' });
  const max = Math.max(2, Math.min(8, os.cpus().length));
  const res = new Array(corren.length); let sig = 0, vivos = 0;
  return new Promise(fin => {
    if (!corren.length) return fin();
    const lanzar = () => {
      while (vivos < max && sig < corren.length) {
        const i = sig++, p = corren[i]; vivos++;
        const h = cp.spawn('bash', ['-e', '-c', preparar(p.run)], { cwd: raiz, env });
        let s = ''; h.stdout.on('data', d => s += d); h.stderr.on('data', d => s += d);
        h.on('close', code => { res[i] = { p, code, s }; vivos--; if (sig >= corren.length && vivos === 0) fin(); else lanzar(); });
      }
    };
    lanzar();
  }).then(() => {
    const fallos = res.filter(r => r.code !== 0);
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    if (!fallos.length) return { ok: true, texto: `OK (${res.length} revisiones, ${seg} s)` };
    const partes = fallos.map(r => `✗ ${r.p.nombre || '(sin nombre)'} [${r.p.archivo}]\n${limpiar(r.s)}`);
    return { ok: false, texto: `Fallan ${fallos.length} de ${res.length} revisiones (${seg} s):\n` + partes.join('\n') };
  });
}

function raizDe(dir) {
  try { return cp.execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return null; }
}

async function modoHook() {
  let entrada = ''; for await (const c of process.stdin) entrada += c;
  let j = {}; try { j = JSON.parse(entrada); } catch (e) { return 0; }
  const cmd = (j.tool_input && j.tool_input.command) || '';
  if (!/\bgit\b(\s+-C\s+\S+)?[^|;&\n]*\bpush\b/.test(cmd)) return 0;
  if (/\bSALTAR_REVISION=1\b/.test(cmd)) return 0;
  // ¿Desde qué carpeta sube? git -C <dir> o el último «cd <dir>» antes del push; si no, la carpeta de la sesión.
  let dir = j.cwd || process.cwd();
  const antes = cmd.slice(0, cmd.search(/\bpush\b/));
  const cds = [...antes.matchAll(/(?:\bcd|\bgit\s+-C)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g)];
  if (cds.length) { const c = cds[cds.length - 1]; const d = c[1] || c[2] || c[3]; dir = path.resolve(dir, d.replace(/^~(?=\/|$)/, os.homedir())); }
  const raiz = raizDe(dir);
  if (!raiz || !fs.existsSync(path.join(raiz, YMLS[0]))) return 0;   // otro repo: no se toca
  const r = await correr(raiz);
  if (r.ok) return 0;
  process.stderr.write(r.texto + '\nArregla esto y vuelve a subir (node .github/revisar-local.js para repetir).\n');
  return 2;
}

(async () => {
  if (process.argv.includes('--hook')) { process.exitCode = await modoHook(); return; }
  const raiz = raizDe(process.argv[2] || process.cwd()) || path.join(__dirname, '..');
  const r = await correr(raiz);
  console.log(r.texto);
  process.exitCode = r.ok ? 0 : 1;
})();
