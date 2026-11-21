/* Pedidos a Claudio que no salieron (apps-script/paraclaude.js, 17-nov-2026): con dobles, sin Google ni internet.
   1. Sin cupo de Google, la nota dice la causa real (no «falta CLAUDE_RUTINA_TOKEN»).
   2. paraClaudeReintentar_ manda los «pendiente» de las últimas 48 h sin sesión; deja los viejos y los que ya salieron.
   3. Si Google sigue sin cupo, para en el primero y no cuenta el intento; otro error cuenta y a los 6 se deja.
   node .github/pedidos-reintento.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const CANDADO_ = fs.readFileSync(path.join(DIR, 'candado.js'), 'utf8') + '\n';   // el candado único (apps-script/candado.js)
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const src = fs.readFileSync(path.join(DIR, 'paraclaude.js'), 'utf8');
const sacar = n => { const m = new RegExp('\\nfunction ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + n); return m[0]; };
const varDe = n => { const m = new RegExp('\\nvar ' + n + '[^\\n]*').exec(src); if (!m) throw new Error('no encontré ' + n); return m[0]; };
const CAB = ['id', 'fecha', 'quien', 'app', 'tipo', 'prioridad', 'titulo', 'detalle', 'estado', 'issue', 'sesion', 'respuesta', 'llave', 'simple', 'chat', 'micro', 'nivel', 'lector', 'fecha_lector'];

function caja(filas, disparo, props) {
  props = Object.assign({ CLAUDE_RUTINA_TOKEN: 't', GITHUB_TOKEN: 'g' }, props || {});
  const disparos = [], celdas = {};
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Date, Number, String, Object, Math,
    PARA_CLAUDE_CAB_: CAB, HUB_EXEC_DEF_: 'https://hub', MICRO_RESPONDER_: 'responde', MICRO_ESTADOS_: { trabajo: 'en trabajo' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: { getUuid: () => 'a-b' },
    paraClaudeHoja_: () => ({ getLastRow: () => filas.length + 1, getRange: (f, c, nf, nc) => nf ? { getValues: () => filas.map(r => CAB.map(k => r[k] || '')) } : { setValue: v => { celdas[f + ':' + CAB[c - 1]] = v; } } }),
    paraClaudeHuella_: x => 'h' + x.length, paraClaudeIssue_: () => 'https://github.com/x/y/issues/9', claudeNivel_: x => x || 'complejo',
    microLeer_: () => null, bibliotecaParaClaude_: () => '',
    paraClaudeDisparar_: (p) => { disparos.push(p); return disparo(disparos.length); }
  };
  vm.createContext(ctx);
  vm.runInContext(CANDADO_ + [varDe('PC_REINTENTO_H_'), sacar('paraClaudeSinCupo_'), sacar('paraClaudeNotaFallo_'), sacar('paraClaudeReintentar_')].join('\n'), ctx);
  return { ctx, disparos, celdas, props };
}
const ahora = Date.now(), h = x => 'pc' + (ahora - x * 3600000);
const filas = () => [
  { id: h(80), estado: 'pendiente', detalle: 'viejo' },
  { id: h(3), estado: 'pendiente', detalle: 'A' },
  { id: h(2), estado: 'con Claude', sesion: 'https://s', llave: 'x', detalle: 'ya salió' },
  { id: h(1), estado: 'pendiente', detalle: 'B' }
];
const SIN = 'Exception: Service invoked too many times for one day: urlfetch.';

let c = caja(filas(), () => ({ ok: true, url: 'https://sesion', nivel: 'complejo' }));
ok(/sin cupo/.test(c.ctx.paraClaudeNotaFallo_({ error: SIN }, '')) && !/CLAUDE_RUTINA_TOKEN/.test(c.ctx.paraClaudeNotaFallo_({ error: SIN }, '')), 'sin cupo: la nota dice la causa real');
ok(/falta CLAUDE_RUTINA_TOKEN/.test(c.ctx.paraClaudeNotaFallo_({ error: 'falta CLAUDE_RUTINA_TOKEN' }, '')), 'sin llave: lo dice como antes');
let r = c.ctx.paraClaudeReintentar_();
ok(r.enviados.length === 2 && c.disparos.map(d => d.instruccion.slice(0, 1)).join('') === 'AB', 'manda los dos recientes, del más viejo al más nuevo; no el de 80 h ni el que ya salió');
ok(c.celdas['3:estado'] === 'con Claude' && c.celdas['3:sesion'] === 'https://sesion' && c.celdas['3:issue'], 'la fila queda «con Claude», con su sesión y su issue');

c = caja(filas(), () => ({ ok: false, error: SIN }));
r = c.ctx.paraClaudeReintentar_();
ok(r.sin_cupo && c.disparos.length === 1 && !JSON.parse(c.props.PC_REINTENTOS)[h(3)], 'sin cupo: para en el primero y no cuenta el intento');

c = caja(filas(), () => ({ ok: false, error: 'Claudio respondió 500' }));
for (let i = 0; i < 7; i++) r = c.ctx.paraClaudeReintentar_();
ok(c.disparos.length === 12 && r.dejados.length === 2, 'otro error: cuenta y a los 6 intentos se deja');

c = caja(filas(), () => ({ ok: true }), { CLAUDE_RUTINA_TOKEN: null });
ok(c.ctx.paraClaudeReintentar_().enviados.length === 0 && c.disparos.length === 0, 'sin la llave de Claudio no intenta nada');
process.exit(fallo);
