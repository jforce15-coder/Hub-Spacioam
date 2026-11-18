/* Prueba de «unir = publicar» (apps-script/publicarsolo.js y .github/workflows/traslado.yml) con dobles: sin internet.
   18-nov-2026: el horario de «Traslado a Workspace» pasó 12 h sin correr y lo unido no llegaba a alma@. Revisa:
   1. la primera vez y cuando cambia la carpeta de una app en main, el Hub pide el Traslado (repository_dispatch publicar);
   2. sin cambios no pide nada, y entre vueltas de procesarCola espera 5 min (el aviso de una app no espera);
   3. si GitHub no toma el pedido, no guarda las huellas (la siguiente vuelta reintenta);
   4. traslado.yml corre al unir en el Hub, con el pedido del Hub y a mano sincroniza todas; usa la huella de la carpeta;
   5. procesarCola y doPost llaman a la revisión.
   node .github/publicar-solo.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const props = {}, cache = {}, pedidos = []; let huellaDocs = 'aaa', codigoPedido = 204, gets = 0;
const proyectos = { _nota: 'x', docs: { repo: 'Docs-spacioam', carpeta: 'apps-script', sincronizar: true },
  login: { repo: 'Hub-Spacioam', carpeta: 'login/apps-script' }, mi: { repo: 'mi-spacioam', carpeta: 'apps-script', sincronizar: true } };
const ctx = { console: { log() {}, error() {} }, JSON, Date, Object, Number, String, Error, encodeURIComponent,
  Utilities: { base64Decode: s => Buffer.from(s, 'base64'), newBlob: b => ({ getDataAsString: () => Buffer.from(b).toString('utf8') }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  UNIR_DUENO_: 'dueno',
  paraAlmaGh_: (m, ruta, cuerpo) => {
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
r = ctx.pubSoloRevisar_(false);
ok(r.mirado === false && pedidos.length === 1, '2 · procesarCola espera 5 min entre vueltas');
const g0 = gets; r = ctx.pubSoloAviso_();
ok(pedidos.length === 1 && r.cambiaron && r.cambiaron.length === 0 && gets > g0, '2 · el aviso mira al instante y sin cambios no pide nada');
ok(props.PUBLICAR_MIRADO === '0', '2 · el aviso sin nada nuevo hace que procesarCola vuelva a mirar en su próximo minuto (GitHub tarda en mostrarlo)');
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
