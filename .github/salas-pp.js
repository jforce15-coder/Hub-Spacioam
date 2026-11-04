/* Prueba de las salas Priority Pass (apps-script/salas.js) con dobles: sin internet, sin Google y sin Claude.
   1. Filtro por terminal: CDG 2E (no las de 2F ni «toda la terminal 2»), ATL por la letra de la puerta, MIA North vs South,
      GUA (una sola terminal) sin terminal, y nada si el aeropuerto tiene varias y el vuelo no trae terminal.
   2. Una sala con el código de otro aeropuerto o sin página de prioritypass.com se descarta.
   3. Caché: la primera vez busca; luego sale de CacheService o de la hoja ALMA_SALAS sin buscar; a los 31 días busca otra vez;
      si la búsqueda falla no reintenta en 24 h; «soloGuardado» nunca busca.
   4. En el aire: las salas son las del aeropuerto de llegada, con su terminal de llegada.
   node .github/salas-pp.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const PP = 'https://www.prioritypass.com/en-GB/lounges/';
const RESP = {
  CDG: { una_terminal: false, salas: [
    { nombre: 'YotelAir Paris CDG', tipo: 'descanso', terminal: 'Terminal 2E', zonas: ['2E', '2', 'L'], lado: 'airside', horario: '24 h', ubicacion: 'Tren a las puertas L', nota: 'Solo fuera de Schengen', url: PP + 'france/paris-charles-de-gaulle/cdg8-yotelair-paris-charles-de-gaulle' },
    { nombre: 'Sala 2F', tipo: 'sala', terminal: 'Terminal 2F', zonas: ['2F'], lado: 'airside', horario: '06:00–21:00', url: PP + 'france/paris-charles-de-gaulle/cdg5-sala-2f' },
    { nombre: 'Sala de Atlanta colada', tipo: 'sala', terminal: 'Terminal 2E', zonas: ['2E'], lado: 'airside', horario: '24 h', url: PP + 'usa/atlanta/atl24-the-club-atl' },
    { nombre: 'Sala sin fuente', tipo: 'sala', terminal: 'Terminal 2E', zonas: ['2E'], lado: 'airside', url: 'https://otro-sitio.com/cdg9' }] },
  ATL: { una_terminal: false, salas: [
    { nombre: 'The Club ATL', tipo: 'sala', terminal: 'Concourse F', zonas: ['F'], lado: 'airside', horario: '06:00–22:00', url: PP + 'united-states-of-america/hartsfield-jackson-atlanta-international/atl24-the-club-atl' },
    { nombre: 'Minute Suites B', tipo: 'descanso', terminal: 'Concourse B', lado: 'airside', horario: '24 h', url: PP + 'united-states-of-america/hartsfield-jackson-atlanta-international/atl13-minute-suites' },
    { nombre: 'Samuel Adams Brew House', tipo: 'restaurante', terminal: 'Concourse B', lado: 'airside', horario: '07:00–22:00', url: PP + 'united-states-of-america/hartsfield-jackson-atlanta-international/atl15d-samuel-adams-brew-house' }] },
  MIA: { una_terminal: false, salas: [
    { nombre: 'Turkish Airlines Lounge Norte', tipo: 'sala', terminal: 'North Terminal Concourse D and E', lado: 'airside', horario: '05:00–22:00', url: PP + 'united-states-of-america/miami-international/mia14-turkish-airlines-lounge' },
    { nombre: 'Turkish Airlines Lounge Sur', tipo: 'sala', terminal: 'South Terminal Concourse H and J', lado: 'airside', horario: '24 h', url: PP + 'united-states-of-america/miami-international/mia15-turkish-airlines-lounge' }] },
  GUA: { una_terminal: true, salas: [
    { nombre: 'Copa Club', tipo: 'sala', terminal: 'Main', lado: 'airside', horario: '03:30–16:30', ubicacion: 'Junto a la puerta 14', url: PP + 'guatemala/la-aurora-international/gua4-copa-club' },
    { nombre: 'Casa del Ron', tipo: 'sala', terminal: 'Main', lado: 'airside', horario: '03:30–21:00', ubicacion: 'Entre las puertas 6 y 7', url: PP + 'guatemala/la-aurora-international/gua2-casa-del-ron-aeropuerto' }] }
};

function caja(o) {
  o = o || {};
  const props = { ANTHROPIC_KEY: 'k' }, cache = {}, hoja = [['iata', 'fecha', 'ok', 'una_terminal', 'salas', 'fuente', 'motivo']], llamadas = [];
  const sh = {
    getLastRow: () => hoja.length,
    getRange: (f, c, n, m) => ({
      getValues: () => hoja.slice(f - 1, f - 1 + n).map((r) => r.slice(c - 1, c - 1 + m)),
      setValues: (v) => { v.forEach((r, i) => { hoja[f - 1 + i] = r.slice(); }); }
    }),
    appendRow: (r) => hoja.push(r.slice())
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, encodeURIComponent,
    CFG: { MODELO_CLASIFICADOR: 'modelo-barato' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; } }) },
    hojaCrear_: () => sh, cupoPermite_: () => true, registrarUso_: () => {},
    uf_: (url, op, canal) => {
      const b = JSON.parse(op.payload), iata = /Aeropuerto: ([A-Z]{3})/.exec(b.messages[0].content)[1];
      llamadas.push({ iata, canal, dominios: b.tools[0].allowed_domains, modelo: b.model });
      if (o.falla) return { getResponseCode: () => 500, getContentText: () => '{"error":"x"}' };
      const texto = 'Encontré esto en prioritypass.com:\n' + JSON.stringify(RESP[iata] || { una_terminal: false, salas: [] });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ stop_reason: 'end_turn', usage: { server_tool_use: { web_search_requests: 1 } }, content: [{ type: 'server_tool_use' }, { type: 'text', text: texto }] }) };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'salas.js'), 'utf8'), ctx);
  return { ctx, llamadas, cache, hoja, vaciarCache: () => Object.keys(cache).forEach((k) => delete cache[k]) };
}
const nombres = (r) => (r ? r.salas.map((s) => s.nombre) : []);
const tramo = (o, d, ot, dt) => ({ sale: '2026-11-04T10:00:00+01:00', llega: '2026-11-04T19:00:00-05:00', origen: { iata: o, terminal: ot || '' }, destino: { iata: d, terminal: dt || '' }, puerta: '' });
const ANTES = Date.parse('2026-11-04T07:00:00Z'), EN_EL_AIRE = Date.parse('2026-11-04T12:00:00Z');

/* 1 y 2: filtro */
{ const c = caja(), X = c.ctx;
  const cdg = X.salasDelTramo_(tramo('CDG', 'ATL'), { terminal: '2E', puerta: 'L42' }, ANTES);
  ok(JSON.stringify(nombres(cdg)) === '["YotelAir Paris CDG"]', 'CDG 2E: solo la de 2E (ni la de 2F, ni la de otro aeropuerto, ni la que no es de prioritypass.com): ' + nombres(cdg));
  ok(cdg && cdg.etiqueta === 'Terminal 2E' && c.llamadas[0].canal === 'Viajes' && c.llamadas[0].dominios.join() === 'prioritypass.com' && c.llamadas[0].modelo === 'modelo-barato',
    'CDG: «Terminal 2E», canal Viajes, modelo barato y búsqueda solo en prioritypass.com');
  ok(!nombres(X.salasDelTramo_(tramo('CDG', 'ATL'), { terminal: '2', puerta: '' }, ANTES)).length, 'CDG terminal «2» a secas: no ve la de 2E («2» junto a «2E» se quita)');
  ok(!X.salasDelTramo_(tramo('CDG', 'ATL'), { terminal: '2G', puerta: 'G12' }, ANTES), 'CDG 2G: ninguna, y la tarjeta no muestra nada (null)');
  const atl = X.salasDelTramo_(tramo('ATL', 'GUA'), { terminal: 'S', puerta: 'B12' }, ANTES);
  ok(JSON.stringify(nombres(atl)) === '["Minute Suites B","Samuel Adams Brew House"]', 'ATL puerta B12: las del concourse B, la sala antes que el restaurante: ' + nombres(atl));
  const atlF = X.salasDelTramo_(tramo('ATL', 'GUA'), { terminal: 'F', puerta: '' }, ANTES);
  ok(JSON.stringify(nombres(atlF)) === '["The Club ATL"]', 'ATL terminal F: The Club ATL');
  const mia = X.salasDelTramo_(tramo('MIA', 'GUA'), { terminal: 'N', puerta: '' }, ANTES);
  ok(JSON.stringify(nombres(mia)) === '["Turkish Airlines Lounge Norte"]', 'MIA North: solo la del norte: ' + nombres(mia));
  const miaD = X.salasDelTramo_(tramo('MIA', 'GUA'), { terminal: '', puerta: 'D30' }, ANTES);
  ok(JSON.stringify(nombres(miaD)) === '["Turkish Airlines Lounge Norte"]', 'MIA sin terminal, puerta D30: la del concourse D');
  ok(!X.salasDelTramo_(tramo('MIA', 'GUA'), { terminal: '', puerta: '' }, ANTES), 'MIA sin terminal ni puerta (varias terminales): nada');
  const gua = X.salasDelTramo_(tramo('GUA', 'MIA'), {}, ANTES);
  ok(nombres(gua).length === 2 && gua.etiqueta === 'GUA', 'GUA (una sola terminal), sin terminal en el vuelo: las dos');
  const f = X.salasFiltrar_({ iata: 'X', una_terminal: true, salas: [1, 2, 3, 4, 5].map((i) => ({ nombre: 'S' + i, tipo: 'sala', lado: i === 1 ? 'landside' : 'airside', zonas: [] })) }, '', '');
  ok(f.salas.length === 3 && f.salas[0].nombre === 'S2', 'como mucho 3, las de después de seguridad primero');
  ok(X.salasCodigo_('Terminal 2E') === '2E' && X.salasCodigo_('T1') === '1' && X.salasCodigo_('North') === 'N' && X.salasCodigo_('Concourse F') === 'F', 'códigos: «Terminal 2E» → 2E, «T1» → 1, «North» → N, «Concourse F» → F');
  const alma = X.salasParaAlma_(cdg);
  ok(alma && /YotelAir Paris CDG · Terminal 2E · después de seguridad · 24 h/.test(alma.salas[0]) && /CDG · terminal 2E/.test(alma.donde), 'para Alma: una línea por sala: ' + (alma && alma.salas[0])); }

/* 3: caché */
{ const c = caja(), X = c.ctx, t0 = Date.now();
  X.salasAeropuerto_('CDG'); X.salasAeropuerto_('CDG');
  ok(c.llamadas.length === 1, 'la segunda vez sale de la caché, sin buscar');
  c.vaciarCache(); const g = X.salasAeropuerto_('CDG');
  ok(c.llamadas.length === 1 && g && g.salas.length === 2 && c.hoja.length === 2, 'sin CacheService sale de la hoja ALMA_SALAS (una fila por aeropuerto, las 2 salas de CDG con fuente), sin buscar');
  c.hoja[1][1] = new Date(t0 - 31 * 864e5).toISOString(); c.vaciarCache();
  ok(X.salasAeropuerto_('CDG', { soloGuardado: true }) && c.llamadas.length === 1, 'vencida y «soloGuardado»: devuelve lo viejo y no busca');
  X.salasAeropuerto_('CDG');
  ok(c.llamadas.length === 2 && c.hoja.length === 2 && Date.parse(c.hoja[1][1]) >= t0, 'a los 31 días busca otra vez y actualiza la misma fila');
  ok(X.salasAeropuerto_('ATL', { soloGuardado: true }) === null && c.llamadas.length === 2, 'aeropuerto nuevo con «soloGuardado»: nada, sin buscar'); }

{ const c = caja({ falla: true }), X = c.ctx;
  ok(X.salasAeropuerto_('ATL') === null && c.hoja[1] && c.hoja[1][2] === false && /Claude respondió 500/.test(c.hoja[1][6]), 'si la búsqueda falla: nada en la tarjeta y el motivo queda en la hoja (' + (c.hoja[1] || [])[6] + ')');
  c.vaciarCache(); X.salasAeropuerto_('ATL');
  ok(c.llamadas.length === 1, 'falló hace poco: no reintenta (24 h)');
  c.hoja[1][1] = new Date(Date.now() - 25 * 36e5).toISOString(); c.vaciarCache(); X.salasAeropuerto_('ATL');
  ok(c.llamadas.length === 2, 'a las 25 h reintenta'); }

/* 4: en el aire, las de llegada */
{ const c = caja(), X = c.ctx;
  const r = X.salasDelTramo_(tramo('CDG', 'ATL', '2E', 'S'), { terminal: '2E', terminal_llega: 'F', sale_utc: '2026-11-04T09:00:00Z' }, EN_EL_AIRE);
  ok(r && r.iata === 'ATL' && r.llegada && JSON.stringify(nombres(r)) === '["The Club ATL"]', 'en el aire: las de ATL en su terminal de llegada (F)'); }

process.exit(fallo);
