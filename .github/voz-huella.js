/* Prueba de la huella de las herramientas de voz (apps-script/voz.js · vozHerramientasSiCambiaron_) con un ElevenLabs de
   mentira: sin internet ni Google. 17-nov-2026: el Hub guardó VOZ_TOOLS_HUELLA aunque las 5 herramientas del anillo no
   quedaron en el agente; voz_sync y la vuelta de 30 min decían «sin_cambios» y hubo que forzarlas con voz_tools. Revisa:
   1. respuesta completa (cada herramienta con id y en los tool_ids del agente) → guarda la huella y la siguiente vuelta es sin_cambios;
   2. el agente no se quedó con las nuevas (tool_ids sin ellas) → no guarda la huella, ok:false con las que faltan, y la siguiente vuelta reintenta;
   3. una herramienta vuelve sin id → no guarda la huella;
   4. el GET del agente falla (vozEstado_ ok:false) → no guarda la huella.
   node .github/voz-huella.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const PUENTE = 'https://alma-puente.jforce15.workers.dev/';

/* ElevenLabs de mentira: herramientas por id y un agente con tool_ids. Opciones: el agente ignora los tool_ids nuevos,
   un POST de una herramienta vuelve sin id, el GET del agente desde vozEstado_ falla. */
function caja(opc) {
  opc = opc || {};
  const props = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'ag1' }, avisos = [];
  let n = 0;
  const tools = { t0: { id: 't0', tool_config: { name: 'secretaria', api_schema: { url: PUENTE + '?voz=1&k=x&h=secretaria' } } } };
  const agente = { name: 'Alma', conversation_config: { agent: { prompt: { prompt: 'p', tool_ids: ['t0'], built_in_tools: {} } }, turn: {} }, platform_settings: {} };
  let getsAgente = 0;
  const resp = (code, o) => ({ getResponseCode: () => code, getContentText: () => (o === undefined ? '' : JSON.stringify(o)) });
  const ctx = {
    console: { log() {}, warn: m => avisos.push(String(m)), error: m => avisos.push(String(m)) },
    JSON, Date, Math, String, Number, Object, Array, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: {
      computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(String(s)).digest()),
      base64Encode: b => Buffer.from(b).toString('base64'), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
    },
    uf_: (url, o) => {
      o = o || {}; const m = (o.method || 'get').toLowerCase(), ruta = url.replace('https://api.elevenlabs.io/v1/convai', '');
      const b = o.payload ? JSON.parse(o.payload) : null;
      if (m === 'get' && ruta === '/tools') return resp(200, { tools: Object.values(tools) });
      if (m === 'post' && ruta === '/tools') {
        const id = 'n' + (++n); tools[id] = { id, tool_config: b.tool_config };
        return resp(200, opc.sinId === b.tool_config.name ? { tool_config: b.tool_config } : { id, tool_config: b.tool_config });
      }
      if (m === 'patch' && ruta.indexOf('/tools/') === 0) { const id = ruta.slice(7); tools[id].tool_config = b.tool_config; return resp(200, tools[id]); }
      if (ruta.indexOf('/agents/') === 0) {
        if (m === 'patch') {
          const pr = b.conversation_config.agent.prompt;
          if (!opc.ignorarIds) agente.conversation_config.agent.prompt.tool_ids = pr.tool_ids.slice();
          return resp(200, agente);
        }
        getsAgente++;
        if (opc.estadoFalla && getsAgente > 1) return resp(500, { detail: 'error' });
        return resp(200, JSON.parse(JSON.stringify(agente)));
      }
      return resp(404, { detail: 'ruta ' + m + ' ' + ruta });
    },
    vozProteccionResumen_: () => ({}), vozAccesoCerrado_: () => true
  };
  vm.createContext(ctx);
  ['voz.js', 'anillo.js', 'manos.js', 'claudio.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  return { ctx, props, avisos, agente };
}
const esperadas = c => c.ctx.vozDefHerramientas_('BASE').map(d => d.name);

{ const c = caja();
  const r = c.ctx.vozHerramientasSiCambiaron_();
  const anillo = esperadas(c).filter(x => /^anillo_/.test(x));
  ok(anillo.length === 5, 'las 5 herramientas del anillo están entre las que define el Hub (' + anillo.join(', ') + ')');
  ok(r.ok !== false && c.props.VOZ_TOOLS_HUELLA === c.ctx.vozHerramientasHuella_(), 'respuesta completa: guarda la huella');
  ok(JSON.parse(c.props.VOZ_TOOLS_SYNC).ok === true, 'respuesta completa: VOZ_TOOLS_SYNC queda ok');
  const r2 = c.ctx.vozHerramientasSiCambiaron_();
  ok(r2.sin_cambios === true, 'con la huella guardada, la siguiente vuelta es sin_cambios'); }

{ const c = caja({ ignorarIds: true });
  const r = c.ctx.vozHerramientasSiCambiaron_();
  ok(!('VOZ_TOOLS_HUELLA' in c.props), 'el agente no se quedó con las nuevas: no guarda la huella');
  ok(r.ok === false && r.faltan && r.faltan.indexOf('anillo_estado') >= 0, 'el agente no se quedó con las nuevas: ok:false con las que faltan (' + (r.faltan || []).length + ')');
  const s = JSON.parse(c.props.VOZ_TOOLS_SYNC);
  ok(s.ok === false && s.faltan && s.faltan.length === r.faltan.length, 'VOZ_TOOLS_SYNC dice ok:false y cuáles faltan');
  ok(c.avisos.some(a => /no se guarda la huella/.test(a)), 'deja un aviso en el registro');
  const r2 = c.ctx.vozHerramientasSiCambiaron_();
  ok(!r2.sin_cambios, 'la siguiente vuelta reintenta (no dice sin_cambios)'); }

{ const c = caja({ sinId: 'anillo_buscar' });
  let r, err = null; try { r = c.ctx.vozHerramientasSiCambiaron_(); } catch (e) { err = e; }
  ok(!('VOZ_TOOLS_HUELLA' in c.props), 'una herramienta vuelve sin id: no guarda la huella' + (err ? ' (corta con error)' : ' (faltan: ' + ((r && r.faltan) || []).join(', ') + ')')); }

{ const c = caja({ estadoFalla: true });
  const r = c.ctx.vozHerramientasSiCambiaron_();
  ok(r.ok === false && !('VOZ_TOOLS_HUELLA' in c.props), 'el GET del agente falla: no guarda la huella'); }

{ const c = caja();
  const parcial = { ok: true, herramientas: [{ name: 'secretaria', id: 't0' }], tool_ids: ['t0'] };
  const f = c.ctx.vozHerramientasFaltan_(parcial);
  ok(f.length === esperadas(c).length - 1 && f.indexOf('secretaria') < 0, 'vozHerramientasFaltan_: una respuesta parcial nombra a todas las que faltan'); }

process.exit(fallo);
