/* Prueba con dobles del cupo agotado (apps-script/cupo.js y voz.js, #737), sin Google. 17-nov-2026: Google cortó las
   llamadas a internet a las 15:26 («Service invoked too many times for one day: urlfetch») y la app de Alma saludaba y
   colgaba en cada llamada (también al despertarla con «Alma» en el Modo Inicio): la ficha de la voz no conseguía la URL
   firmada de ElevenLabs. Revisa:
   1. uf_ reconoce el error de Google: deja la marca (caché y CUPO_AGOTADO), el nivel pasa a «agotado», lo de fondo se
      pausa, Juan recibe un solo aviso y lo contado queda como el límite (CUPO_DIA_VISTO, nunca menos de 5 000);
   2. otro error (una página caída) no marca nada;
   3. la primera llamada que sale bien quita la marca y el nivel vuelve a lo contado;
   4. la ficha de la voz (vozWebUrlApi_) sin cupo devuelve sin_cupo y un mensaje claro, no la excepción de Google;
   5. lo aprendido al cortar baja también un CUPO_DIA más alto (#836); «Uso» pinta el nivel «Agotado»;
   6. reserva de la voz (97 %, #836): solo sale lo esencial, el respaldo de la bandeja se para y la URL firmada de la voz
      pasa siempre, aunque Juan agregue «voz» a CUPO_RESERVA_PAUSA;
   7. robot «cupo_top»: nivel, límite y de dónde sale, y el top de funciones, sin gastar si no hace falta.
   node .github/cupo-agotado.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const CUPO = leer('cupo.js'), VOZ = leer('voz.js'), ACC = leer('vozacceso.js');
const H = 3600000, AHORA0 = Date.parse('2026-11-17T21:26:00Z');   // 15:26 en Guatemala
const GOOGLE = 'Exception: Service invoked too many times for one day: urlfetch.';

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, avisos = [], fetches = [];
  let ahora = AHORA0, sinCupo = true;
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const gt = d => new Date(d.getTime() - 6 * H).toISOString();
  const C = {
    get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); },
    getAll: ks => { const r = {}; ks.forEach(k => { if (k in cache) r[k] = cache[k]; }); return r; },
    putAll: m => Object.keys(m).forEach(k => { cache[k] = String(m[k]); }), remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => delete cache[k])
  };
  const resp = () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ signed_url: 'wss://firmada' }) });
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, isNaN, Error,
    CFG: { TZ: 'America/Guatemala', HUB_URL: 'https://hub' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => C },
    Utilities: { formatDate: (d, tz, f) => { const g = gt(d); return f === 'yyyyMMddHH' ? g.slice(0, 13).replace(/[-T]/g, '') : f === 'H' ? String(+g.slice(11, 13)) : f === 'HH' ? g.slice(11, 13) : f === 'HH:mm' ? g.slice(11, 16) : g.slice(0, 10); } },
    UrlFetchApp: {
      fetch: (url) => { fetches.push(url); if (/caida/.test(url)) throw new Error('Address unavailable: ' + url); if (sinCupo) throw new Error(GOOGLE); return resp(); },
      fetchAll: (l) => { if (sinCupo) throw new Error(GOOGLE); return l.map(resp); }
    },
    ssAlma_: () => ({ getSheetByName: () => null }), hojaCrear_: () => null,
    llaveRobot_: () => '', ACCESOS_APPS_: {}, paraClaudePrincipalSes_: () => true, esAdminPrincipal_: () => true,
    agPrincipal_: () => ({ email: 'principal@x', tels: ['1'] }), pendAvisar_: (adm, t) => { avisos.push(t); }, pushA_() { ctx.uf_('https://onesignal.com/push', {}); }, waEnviar_() {},
    vozWebAdmin_: () => ({ tels: ['1'] }), ScriptApp: { getScriptId: () => 'proyecto-nuevo' }
  };
  vm.createContext(ctx);
  vm.runInContext(CUPO + '\n' + sacar(ACC, 'vozUrlFirmada_') + sacar(VOZ, 'vozFirmaSinCupo_') + sacar(VOZ, 'vozWebUrlApi_') + '\nvar VOZ_SIN_SESION_ = "sesion";', ctx);
  props.ELEVENLABS_KEY = 'k'; props.ELEVENLABS_AGENT_ID = 'a';
  return { ctx, props, cache, avisos, fetches, mover: ms => { ahora += ms; }, volver: () => { sinCupo = false; } };
}
/* Lo contado en la hora: 12 000 llamadas de «Huéspedes» en la caché (lo que el Hub llevaba cuando Google cortó). */
function contado(c, n) { const hora = c.ctx.cupoHora_(Date.now() === 0 ? 0 : AHORA0); c.cache['cupo_' + hora + '_huespedes'] = String(n); }

/* ── 1 ── Google corta. */
{ const c = caja(), x = c.ctx; contado(c, 12000);
  x.cupoCanal_('Huéspedes');
  let lanzo = ''; try { x.uf_('https://public.api.hospitable.com/v2/x', {}); } catch (e) { lanzo = String(e.message); }
  ok(lanzo === GOOGLE, '1 · el error de Google sigue saliendo a quien llamó (' + lanzo + ')');
  ok(!!c.cache.cupo_agotado && !!c.props.CUPO_AGOTADO, '1 · queda la marca en la caché y en CUPO_AGOTADO');
  const ag = JSON.parse(c.props.CUPO_AGOTADO || '{}');
  ok(ag.hora === '15:26' && ag.contado === 12001, '1 · guarda la hora de Guatemala y lo contado (' + JSON.stringify(ag) + ')');
  ok(c.props.CUPO_DIA_VISTO === '12001' && x.cupoLimite_() === 12001, '1 · lo contado queda como el límite (' + x.cupoLimite_() + ')');
  x.CUPO_MEMO_ = null;
  ok(x.cupoNivel_().nivel === 'agotado', '1 · el nivel pasa a «agotado»');
  ok(x.cupoPermite_('fondo') === false && x.cupoPermite_('huespedes') === true && x.cupoPermite_('alma') === true, '1 · lo de fondo se pausa; huéspedes y Alma no se apagan');
  ok(c.avisos.length === 1 && /sin cupo/.test(c.avisos[0]) && /No es el Modo Inicio/.test(c.avisos[0]), '1 · Juan recibe un solo aviso, claro (' + c.avisos.length + ')');
  try { x.uf_('https://public.api.hospitable.com/v2/y', {}); } catch (e) {}
  try { x.ufAll_([{ url: 'https://public.api.hospitable.com/v2/z' }]); } catch (e) {}
  ok(c.avisos.length === 1, '1 · otra llamada sin cupo no repite el aviso');
}
/* ── 2 ── Otro error no marca. */
{ const c = caja(), x = c.ctx; c.volver();
  try { x.uf_('https://caida.example/x', {}); } catch (e) {}
  ok(!c.cache.cupo_agotado && !c.props.CUPO_AGOTADO && c.avisos.length === 0, '2 · una página caída no marca el cupo como agotado');
}
/* ── 3 ── Vuelve. */
{ const c = caja(), x = c.ctx; contado(c, 12000);
  try { x.uf_('https://public.api.hospitable.com/v2/x', {}); } catch (e) {}
  c.volver();
  vm.runInContext('CUPO_AGOTADO_HECHO_ = false; CUPO_AGOTADO_VISTO_ = false; CUPO_MEMO_ = null;', x);   // otra ejecución
  x.uf_('https://public.api.hospitable.com/v2/x', {});
  ok(!c.cache.cupo_agotado, '3 · la primera llamada que sale bien quita la marca');
  vm.runInContext('CUPO_MEMO_ = null;', x);
  ok(x.cupoNivel_().nivel !== 'agotado', '3 · el nivel vuelve a lo contado (' + x.cupoNivel_().nivel + ')');
  ok(x.cupoLimite_() === 12002 || x.cupoLimite_() === 12001, '3 · el límite aprendido se queda');
}
/* ── 4 ── La ficha de la voz. */
{ const c = caja(), x = c.ctx;
  const r = x.vozWebUrlApi_({ email: 'p@x' });
  ok(r.ok === false && r.sin_cupo === true && r.error === x.CUPO_VOZ_SIN_ && !/Exception/.test(r.error), '4 · sin cupo, la voz responde sin_cupo y un mensaje claro (' + r.error + ')');
  c.volver(); const r2 = x.vozWebUrlApi_({ email: 'p@x' });
  ok(r2.ok === true && r2.signed_url === 'wss://firmada', '4 · con cupo, la URL firmada sale igual que antes');
  ok(/vozFirmaSinCupo_\(\); if \(!uf\.ok\) return uf;/.test(sacar(VOZ, 'vozWebInicio_')), '4 · la ficha completa (vozWebInicio_) también usa vozFirmaSinCupo_');
}
/* ── 5 ── Lo aprendido baja también un CUPO_DIA más alto (#836: alma@ decía 100 000 y Google cortó antes); Uso. */
{ const c = caja({ props: { CUPO_DIA: '100000', CUPO_DIA_VISTO: '30000' } });
  ok(c.ctx.cupoLimite_() === 30000 && c.ctx.cupoLimiteOrigen_() === 'visto', '5 · Google cortó antes de CUPO_DIA: manda lo contado (' + c.ctx.cupoLimite_() + ')');
  const c1 = caja({ props: { CUPO_DIA: '100000' } });
  ok(c1.ctx.cupoLimite_() === 100000 && c1.ctx.cupoLimiteOrigen_() === 'cupo_dia', '5 · sin corte, manda CUPO_DIA');
  const c2 = caja({ props: { CUPO_DIA_VISTO: '800' } });
  ok(c2.ctx.cupoLimite_() === 20000, '5 · un límite aprendido absurdo (menos de 5 000) no se usa');
  const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'uso.html'), 'utf8');
  ok(/agotado: "Agotado"/.test(html) && /R\.agotado/.test(html), '5 · «Uso» pinta el nivel «Agotado» y cuándo cortó Google');
}
/* ── 6 ── Reserva de la voz. */
{ const c = caja(), x = c.ctx; c.volver();
  c.cache.cupo_nivel = JSON.stringify({ pct: 98, nivel: 'critico' });
  const lanza = (f) => { try { f(); return ''; } catch (e) { return String(e.message); } };
  x.cupoCanal_('Otros');
  ok(lanza(() => x.uf_('https://otra.example/x', {})) === x.CUPO_RESERVA_VOZ_ERROR_, '6 · en 98 % lo que no es esencial no sale');
  x.cupoCanal_('Huéspedes'); x.cupoFuncion_('procesarColaNucleo_');
  ok(lanza(() => x.uf_('https://public.api.hospitable.com/v2/x', {})) === '', '6 · responder a huéspedes sigue');
  x.cupoFuncion_('sincronizarInbox_');
  ok(lanza(() => x.uf_('https://public.api.hospitable.com/v2/x', {})) === x.CUPO_RESERVA_VOZ_ERROR_, '6 · el respaldo de la bandeja se para');
  x.cupoFuncion_('vozWeb'); vm.runInContext('CUPO_CTX_ = "";', x);
  const r = x.vozWebUrlApi_({ email: 'p@x' });
  ok(r.ok === true && r.signed_url === 'wss://firmada', '6 · la URL firmada de la voz sale');
  const c2 = caja({ props: { CUPO_RESERVA_PAUSA: 'voz,fondo' } }), x2 = c2.ctx; c2.volver();
  c2.cache.cupo_nivel = JSON.stringify({ pct: 99, nivel: 'critico' });
  const r2 = x2.vozWebUrlApi_({ email: 'p@x' });
  ok(r2.ok === true, '6 · aunque «voz» esté en CUPO_RESERVA_PAUSA, la URL firmada pasa (esencial)');
  x2.cupoCanal_('Voz');
  ok(lanza(() => x2.uf_('https://api.elevenlabs.io/v1/convai/conversations', {})) === x2.CUPO_RESERVA_ERROR_, '6 · lo demás de la voz sí respeta CUPO_RESERVA_PAUSA');
  const c3 = caja({ props: { CUPO_RESERVA_VOZ_PCT: '0' } }), x3 = c3.ctx; c3.volver();
  c3.cache.cupo_nivel = JSON.stringify({ pct: 98, nivel: 'critico' }); x3.cupoCanal_('Otros');
  ok(lanza(() => x3.uf_('https://otra.example/x', {})) === '', '6 · CUPO_RESERVA_VOZ_PCT = 0 la apaga');
}
/* ── 7 ── Robot «cupo_top». */
{ const c = caja({ props: { CUPO_DIA: '100000', CUPO_DIA_VISTO: '30000' } }), x = c.ctx; c.volver();
  const hora = x.cupoHora_(AHORA0); c.cache['cupo_' + hora + '_huespedes'] = '900'; c.cache['cupo_' + hora + '_fn'] = JSON.stringify({ 'Huéspedes': { sincronizarInbox_: 700, procesarColaNucleo_: 200 } });
  const r = x.cupoRobot_(5);
  ok(r.ok && r.limite === 30000 && r.limite_origen === 'visto' && r.cupo_dia === '100000', '7 · dice el límite y de dónde sale');
  ok(r.funciones_24h[0] && r.funciones_24h[0].funcion === 'sincronizarInbox_' && r.funciones_24h[0].llamadas === 700, '7 · el top de funciones de 24 h');
  ok(r.canales_24h[0] && r.canales_24h[0].canal === 'Huéspedes' && r.usado_24h === 900, '7 · los canales de 24 h');
  ok(c.fetches.length === 0, '7 · sin llave del robot no llama a nadie');
  ok(/case 'cupo_top': return json_\(cupoRobot_\(body\.n\)\)/.test(fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8')), '7 · el robot tiene la acción cupo_top');
}
process.exit(fallo);
