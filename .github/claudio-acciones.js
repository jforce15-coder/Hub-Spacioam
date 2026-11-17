/* Acciones de Claudio y su hilo (apps-script/claudioacciones.js; Juan, 17-nov-2026), con dobles de la hoja, de GitHub y de
   Claude. Revisa:
   1. una acción solo sale con lo suyo (https, opciones, pantallas de la lista) y nunca pide una llave en el chat;
   2. solo el principal, sin repetir la misma pendiente;
   3. «Hecho»: elegir solo una opción que existe; con «espera» Claudio sigue (microResponder_); «aprobar» une de verdad;
      lo de otra persona no se toca; devuelve el aviso para la voz;
   4. el hilo junta chat, acciones y trabajos en orden de tiempo;
   5. escribirle a Claudio: lo que parece una llave no sale; el turno usa sus herramientas sin volver_con_alma y guarda
      las dos burbujas;
   6. la respuesta de un pedido trae «acciones» (paraClaudeRespuesta_) y la herramienta claudio_acciones existe.
   node .github/claudio-acciones.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const { armar } = require('./prompts-armados.js');
const a = armar(DIR), ctx = a._ctx, R = c => vm.runInContext(c, ctx);
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

/* Una hoja en memoria */
function hoja(cab) {
  const filas = [cab.slice()];
  const rango = (r, c, nr, nc) => ({
    getValues: () => filas.slice(r - 1, r - 1 + (nr || 1)).map(f => { const o = []; for (let j = 0; j < (nc || 1); j++) o.push(f[c - 1 + j] == null ? '' : f[c - 1 + j]); return o; }),
    setValues: v => v.forEach((f, i) => f.forEach((x, j) => { filas[r - 1 + i][c - 1 + j] = x; })),
    setValue: x => { filas[r - 1][c - 1] = x; }
  });
  return { filas, getLastRow: () => filas.length, getLastColumn: () => cab.length, getRange: rango, appendRow: f => filas.push(f.slice()) };
}
let SH = null, cache = {};
ctx.hojaCrear_ = (n, cab) => (SH = SH || hoja(cab));
ctx.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
ctx.CacheService = { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) };
const JUAN = { email: 'juan@x', nombre: 'Juan Prueba', principal: true, tels: ['50211110000'] };
const ANA = { email: 'ana@x', nombre: 'Ana', principal: false, tels: ['50222220000'] };
let resp = [], unir = [], micros = {}, chat = [], claude = [];
Object.assign(ctx, {
  esAdminPrincipal_: x => !!(x && x.principal), vozWebAdmin_: s => (s && s.email === 'juan@x' ? JUAN : s && s.email === 'ana@x' ? ANA : null),
  microLeer_: id => micros[id] || null, microResponder_: (adm, id, t) => { resp.push([id, t]); return { ok: true }; },
  unirCambio_: c => { unir.push(c); return { ok: true, unidos: [{ pr: c, titulo: 'x' }] }; },
  opFilas_: () => chat.slice(), opGuardar_: (adm, de, canal, texto, ac, clas) => { const r = { id: 'op' + chat.length, ts: new Date().toISOString(), de, canal, texto, esfera: clas && clas.esfera, subcategoria: clas && clas.subcategoria }; chat.push(r); return r; },
  prsAbiertos_: () => [], escalarEntregas_: () => [], microAbiertos_: () => Object.keys(micros).map(k => micros[k]), claudioFicha_: () => 'FICHA', literalLlamadaPoner_: () => {},
  normTel_: t => String(t), claudeTools_: (modelo, system, msgs, tools) => { claude.push({ system, tools }); return { content: [{ type: 'text', text: 'Te propongo A o B; te dejé los pasos abajo.' }] }; }
});
const N = o => { ctx.N_ = o; return R('claudioAccNormalizar_(N_)'); };

/* 1. Lo que sale y lo que no */
ok(N({ tipo: 'abrir_enlace', titulo: 'Abre la página', enlace: 'https://example.com/a' }).datos.enlace === 'https://example.com/a', 'abrir_enlace con https');
ok(N({ tipo: 'abrir_enlace', titulo: 'Abre', enlace: 'http://example.com' }) === null && N({ tipo: 'abrir_enlace', titulo: 'Abre', enlace: 'javascript:alert(1)' }) === null, 'sin https no sale');
ok(N({ tipo: 'borrar_todo', titulo: 'x' }) === null && N({ tipo: 'abrir_enlace', enlace: 'https://a.com' }) === null, 'un tipo que no existe o sin título: no');
ok(N({ tipo: 'elegir_opcion', titulo: 'Elige', opciones: 'A: grande | B: compacta' }).datos.opciones.length === 2 && N({ tipo: 'elegir_opcion', titulo: 'Elige', opciones: 'Solo una' }) === null, 'elegir_opcion: 2 a 4 opciones («A | B»)');
const conImg = N({ tipo: 'elegir_opcion', titulo: 'Elige el diseño', opciones: [{ t: 'A', imagen: 'https://x.com/a.png' }, { t: 'B', imagen: 'https://x.com/b.png' }] });
ok(conImg.datos.opciones[0].imagen === 'https://x.com/a.png' && conImg.espera === true, 'propuestas A/B con su captura; elegir siempre espera');
ok(N({ tipo: 'ir_a_pantalla', titulo: 'Ve a Conexiones', pantalla: 'conexiones' }).datos.pantalla === 'conexiones' && N({ tipo: 'ir_a_pantalla', titulo: 'Ve', pantalla: '../../etc' }) === null, 'ir_a_pantalla solo a las de la lista');
const ll = N({ tipo: 'pegar_en', titulo: 'Pega tu llave de OpenAI aquí en el chat', detalle: 'pégala en el chat' });
ok(ll && ll.titulo === 'Guarda la llave en Ajustes → Llaves' && ll.datos.destino === 'llaves' && !/chat/.test(ll.detalle.replace('nunca en el chat', '')), 'pedir una llave en el chat se vuelve «Guárdala en Ajustes → Llaves»');
const gh = N({ tipo: 'copiar_texto', titulo: 'Pon el token en GitHub', texto: 'NOMBRE_DEL_SECRETO', repo: 'alma-app' });
ok(gh && gh.datos.destino === 'github_secretos' && /\/alma-app\/settings\/secrets\/actions$/.test(gh.datos.enlace), 'una llave de GitHub va a sus secretos');
ok(N({ tipo: 'copiar_texto', titulo: 'Copia esto', texto: 'sk-' + 'abcdefghijklmnop1234' }) === null && N({ tipo: 'copiar_texto', titulo: 'Copia', texto: 'ghp_' + 'A'.repeat(30) }) === null, 'una acción con algo que parece una llave no sale');
ok(N({ tipo: 'copiar_texto', titulo: 'Copia el comando', texto: 'npm install' }).datos.texto === 'npm install', 'un texto normal sí');

/* 2. Crear */
const C = (adm, l, o) => { ctx.A_ = adm; ctx.L_ = l; ctx.O_ = o || {}; return R('claudioAccCrear_(A_, L_, O_)'); };
ok(!C(ANA, [{ tipo: 'abrir_enlace', titulo: 'Abre', enlace: 'https://a.com' }]).ok && !SH, 'otro administrador: no se crea nada');
micros.mp1 = { id: 'mp1', nombre: 'Botón', estado: 'Claude pregunta', pr: 'https://github.com/o/Hub-Spacioam/pull/12' };
const c1 = C(JUAN, [{ tipo: 'elegir_opcion', titulo: 'Elige el diseño', opciones: 'A | B' }, { tipo: 'abrir_enlace', titulo: 'Abre la página', enlace: 'https://a.com', espera: true }, { tipo: 'aprobar', titulo: 'Une el cambio' }], { micro: 'mp1', origen: 'claude' });
ok(c1.ok && c1.creadas.length === 3 && c1.pendientes === 3, 'del principal: se crean (' + c1.creadas.length + ')');
ok(C(JUAN, [{ tipo: 'abrir_enlace', titulo: 'Abre la página', enlace: 'https://a.com' }], { micro: 'mp1' }).pendientes === 3, 'la misma pendiente no se repite');

/* 3. Hecho */
const H = (ses, b) => { ctx.S_ = ses; ctx.B_ = b; return R('claudioAccionApi_(S_, B_)'); };
const [idE, idA, idU] = c1.creadas;
ok(!H({ email: 'ana@x' }, { id: idE, eleccion: 'A' }).ok, 'otro administrador no la toca');
ok(!H({ email: 'juan@x' }, { id: idE, eleccion: 'C' }).ok, 'elegir: solo una opción que existe');
const h1 = H({ email: 'juan@x' }, { id: idE, eleccion: 'B' });
ok(h1.ok && h1.accion.estado === 'hecho' && h1.accion.eleccion === 'B' && resp.length === 1 && resp[0][0] === 'mp1' && /«B»/.test(resp[0][1]), 'elegir: queda hecha y Claudio sigue con la elección (ajuste del mismo trabajo)');
ok(/eligió «B»/.test(h1.aviso) && /No se la vuelvas a pedir/.test(h1.aviso), 'y trae el aviso para la voz');
ok(H({ email: 'juan@x' }, { id: idE, eleccion: 'A' }).ya === true && resp.length === 1, 'tocarla otra vez no manda nada más');
H({ email: 'juan@x' }, { id: idA }); ok(resp.length === 2 && /Ya hice|ya hizo/i.test(resp[1][1]), '«Hecho» de una acción que espera: Claudio sigue');
const h3 = H({ email: 'juan@x' }, { id: idU });
ok(h3.ok && unir.length === 1 && unir[0] === '#12' && resp.length === 2, 'aprobar une de verdad (el cambio de su trabajo) y no manda otro ajuste');

/* 4. El hilo */
chat = [{ id: 'op1', ts: new Date(Date.now() - 5000).toISOString(), de: 'yo', canal: 'claudio', texto: 'Hola Claudio', esfera: 'Propósito', subcategoria: 'Desarrollo' },
  { id: 'op2', ts: new Date(Date.now() - 4000).toISOString(), de: 'alma', canal: 'claude', texto: 'Listo · Botón https://github.com/o/Hub-Spacioam/pull/12', esfera: 'Propósito', subcategoria: 'Desarrollo' },
  { id: 'op3', ts: new Date().toISOString(), de: 'yo', canal: 'hub', texto: 'Algo de huéspedes', esfera: 'Propósito', subcategoria: 'Huéspedes' }];
const hilo = R("claudioHiloApi_({ email: 'juan@x' }, {})");
const ks = hilo.items.map(x => x.k);
ok(hilo.ok && ks.indexOf('msg') >= 0 && ks.indexOf('accion') >= 0 && ks.indexOf('estado') >= 0, 'el hilo junta burbujas, acciones y el estado de cada trabajo');
ok(!hilo.items.some(x => x.texto === 'Algo de huéspedes') && hilo.items.some(x => x.k === 'msg' && x.de === 'claudio' && /cambio #12/.test(x.texto) && !/https/.test(x.texto)), 'solo Desarrollo; los enlaces de GitHub como «cambio #12»');
ok(hilo.items.every((x, i, l) => !i || l[i - 1].ts <= x.ts), 'en orden de tiempo');
ok(!R("claudioHiloApi_({ email: 'ana@x' }, {})").ok, 'el hilo es solo del principal');

/* 5. Escribirle a Claudio */
const n0 = chat.length;
const e1 = R("claudioEscribirApi_({ email: 'juan@x' }, { texto: 'mi llave es sk-" + "abcdefghijklmnopqrst" + "' })");
ok(!e1.ok && e1.llave && chat.length === n0 && !claude.length, 'algo que parece una llave no sale ni se guarda');
const e2 = R("claudioEscribirApi_({ email: 'juan@x' }, { texto: '¿Cómo hacemos el botón de facturas?' })");
const names = claude[0].tools.map(t => t.name);
ok(e2.ok && /A o B/.test(e2.respuesta) && names.indexOf('claudio_acciones') >= 0 && names.indexOf('volver_con_alma') < 0, 'el turno usa sus herramientas (con claudio_acciones, sin volver_con_alma)');
ok(/por_escrito/.test(claude[0].system) && !/"por_voz"/.test(claude[0].system), 'con las reglas de texto, no las de voz');
ok(chat.length === n0 + 2 && chat[n0].canal === 'claudio' && chat[n0 + 1].de === 'alma', 'guarda las dos burbujas en el chat de Desarrollo');
ok(!R("claudioEscribirApi_({ email: 'ana@x' }, { texto: 'hola' })").ok, 'escribirle a Claudio es solo del principal');

/* 6. Por dónde llegan */
ok(/claudioAccCrear_\(dAcc, b\.acciones/.test(leer('paraclaude.js')), 'la respuesta de un pedido trae «acciones» (paraClaudeRespuesta_)');
ok(/acciones/.test(R('MICRO_RESPONDER_')) && /llaves/.test(R('MICRO_RESPONDER_')), 'Claudio sabe mandarlas y que una llave va a Ajustes → Llaves');
const defs = R("claudioDefHerramientas_('B')"), t = defs.filter(d => d.name === 'claudio_acciones')[0];
ok(t && t.type === 'webhook' && t.api_schema.request_body_schema.properties.sa_web && /Te dejé/.test(t.description), 'la herramienta claudio_acciones (con la firma) dice qué decir por voz');
ok(/'claudioHilo'|"claudioHilo"/.test(leer('Código.js')) && /case 'claudioAccion'/.test(leer('Código.js')) && /case 'claudioEscribir'/.test(leer('Código.js')), 'las acciones del Hub existen');
process.exit(fallo);
