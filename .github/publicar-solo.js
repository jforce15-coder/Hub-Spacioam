/* Prueba de «unir = publicar» (apps-script/publicarsolo.js y .github/workflows/traslado.yml) con dobles: sin internet.
   18-nov-2026: el horario de «Traslado a Workspace» pasó 12 h sin correr y lo unido no llegaba a alma@. Revisa:
   1. la primera vez y cuando cambia la carpeta de una app en main, el Hub pide el Traslado (repository_dispatch publicar);
   2. sin cambios no pide nada, y entre vueltas de procesarCola espera CUPO_PUBLICAR_MIN (30 min; el aviso de una app no
      espera y, si no vio nada nuevo, procesarCola vuelve a mirar cada minuto 3 veces);
   6. (19-nov-2026, ahorro de cupo) las huellas de todas las apps salen en UNA llamada (GraphQL); si GitHub no responde
      bien, se mira como antes, una llamada por app.
   3. si GitHub no toma el pedido, no guarda las huellas (la siguiente vuelta reintenta);
   4. traslado.yml corre al unir en el Hub, con el pedido del Hub y a mano sincroniza todas; usa la huella de la carpeta;
   5. procesarCola y doPost llaman a la revisión.
   node .github/publicar-solo.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const props = {}, cache = {}, pedidos = []; let huellaDocs = 'aaa', codigoPedido = 204, gets = 0, graphql = 0, graphqlFalla = false;
const proyectos = { _nota: 'x', docs: { repo: 'Docs-spacioam', carpeta: 'apps-script', sincronizar: true },
  login: { repo: 'Hub-Spacioam', carpeta: 'login/apps-script' }, mi: { repo: 'mi-spacioam', carpeta: 'apps-script', sincronizar: true } };
const ctx = { console: { log() {}, error() {} }, JSON, Date, Object, Number, String, Error, encodeURIComponent,
  Utilities: { base64Decode: s => Buffer.from(s, 'base64'), newBlob: b => ({ getDataAsString: () => Buffer.from(b).toString('utf8') }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  UNIR_DUENO_: 'dueno', cupoIntervalo_: n => (n === 'CUPO_PUBLICAR_MIN' ? 30 : 0),
  paraAlmaGh_: (m, ruta, cuerpo) => {
    if (m === 'POST' && ruta === '/graphql') {
      graphql++; if (graphqlFalla) return { code: 502, json: null };
      const q = cuerpo.query, data = {}, re = /(a\d+): repository\(owner: "dueno", name: "([^"]+)"\) \{ object\(expression: "main:([^"]+)"\)/g; let x;
      while ((x = re.exec(q))) data[x[1]] = x[2] === 'Docs-spacioam' && x[3] === 'apps-script' ? { object: { oid: huellaDocs } } : x[2] === 'mi-spacioam' ? { object: { oid: 'mmm' } } : null;
      return { code: 200, json: { data } };
    }
    if (m === 'POST') { pedidos.push({ ruta, cuerpo }); return { code: codigoPedido, json: null }; }
    gets++;
    if (/proyectos\.json/.test(ruta)) return { code: 200, json: { content: Buffer.from(JSON.stringify(proyectos)).toString('base64') } };
    if (/\/repos\/dueno\/Docs-spacioam\/contents\?ref=main$/.test(ruta)) return { code: 200, json: [{ name: 'apps-script', type: 'dir', sha: huellaDocs }, { name: 'x.md', type: 'file', sha: 'z' }] };
    if (/\/repos\/dueno\/mi-spacioam\/contents\?ref=main$/.test(ruta)) return { code: 200, json: [{ name: 'apps-script', type: 'dir', sha: 'mmm' }] };
    return { code: 404, json: null };
  } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'publicarsolo.js'), 'utf8'), ctx);

let r = ctx.pubSoloRevisar_(false);
ok(r.pedido && pedidos.length === 1 && pedidos[0].ruta === '/repos/dueno/Hub-Spacioam/dispatches' && pedidos[0].cuerpo.event_type === 'publicar', '1 · la primera vez pide el Traslado (publicar)');
ok(JSON.stringify(r.cambiaron) === '["docs","mi"]', '1 · solo las apps con sincronizar (login no): ' + JSON.stringify(r.cambiaron));
ok(graphql === 1 && gets === 1, '6 · una sola llamada para las huellas de todas las apps (más la lista de apps, 6 h en caché)');
r = ctx.pubSoloRevisar_(false);
ok(r.mirado === false && pedidos.length === 1, '2 · procesarCola espera entre vueltas');
props.PUBLICAR_MIRADO = String(Date.now() - 6 * 60000); r = ctx.pubSoloRevisar_(false);
ok(r.mirado === false && graphql === 1, '2 · a los 6 min todavía no mira (cada 30 min)');
props.PUBLICAR_MIRADO = String(Date.now() - 31 * 60000); r = ctx.pubSoloRevisar_(false);
ok(r.mirado !== false && graphql === 2 && pedidos.length === 1, '2 · a los 30 min mira (una llamada) y sin cambios no pide nada');
const g0 = gets + graphql; r = ctx.pubSoloAviso_();
ok(pedidos.length === 1 && r.cambiaron && r.cambiaron.length === 0 && gets + graphql > g0, '2 · el aviso mira al instante y sin cambios no pide nada');
ok(props.PUBLICAR_MIRADO === '0' && props.PUBLICAR_PRONTO === '3', '2 · el aviso sin nada nuevo hace que procesarCola vuelva a mirar en su próximo minuto (GitHub tarda en mostrarlo)');
{ const g1 = graphql; ctx.pubSoloRevisar_(false); props.PUBLICAR_MIRADO = String(Date.now() - 61000); ctx.pubSoloRevisar_(false);
  props.PUBLICAR_MIRADO = String(Date.now() - 61000); ctx.pubSoloRevisar_(false); props.PUBLICAR_MIRADO = String(Date.now() - 61000); const r4 = ctx.pubSoloRevisar_(false);
  ok(graphql === g1 + 3 && r4.mirado === false && props.PUBLICAR_PRONTO === '0', '2 · después del aviso mira cada minuto 3 veces y vuelve a cada 30 min'); }
graphqlFalla = true; delete cache.pub_solo_aviso; { const g2 = gets; r = ctx.pubSoloAviso_();
  ok(r.ok && gets === g2 + 2, '6 · si GitHub no responde la llamada junta, mira como antes (una por app)'); }
graphqlFalla = false;
r = ctx.pubSoloAviso_();
ok(r.espera === true, '2 · dos avisos seguidos: el segundo espera (20 s)');
huellaDocs = 'bbb'; codigoPedido = 500; delete cache.pub_solo_aviso;
r = ctx.pubSoloAviso_();
ok(r.ok === false && JSON.parse(props.PUBLICAR_HUELLAS).docs === 'aaa', '3 · GitHub no tomó el pedido: no guarda la huella');
codigoPedido = 204; delete cache.pub_solo_aviso;
r = ctx.pubSoloAviso_();
ok(r.pedido && JSON.stringify(r.cambiaron) === '["docs"]' && JSON.parse(props.PUBLICAR_HUELLAS).docs === 'bbb', '1 · cambió Docs en main: pide el Traslado y guarda la huella');

const yml = fs.readFileSync(path.join(DIR, '..', '.github', 'workflows', 'traslado.yml'), 'utf8');
ok(/\n  push:\n    branches: \[main\]\n    paths:[\s\S]*"apps-script\/\*\*"/.test(yml), '4 · traslado.yml corre al unir cambios de apps-script en el Hub');
ok(/repository_dispatch:\n    types: \[publicar\]/.test(yml), '4 · traslado.yml corre con el pedido «publicar» del Hub');
ok(/default: sincronizar/.test(yml) && !/default: estado/.test(yml), '4 · a mano sin proyecto sincroniza todas (no «estado»)');
ok(/rev-parse "HEAD:\$DIR"/.test(yml), '4 · la huella es la de la carpeta (sin cambios, sin versión nueva)');
const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
ok(/pubSoloRevisar_\(false\)/.test(cod) && /body\.publicarAviso[^\n]*pubSoloAviso_\(\)/.test(cod), '5 · procesarCola y doPost llaman a la revisión');
process.exit(fallo);
