/* Prueba del resolvedor único de destinatarios (apps-script/destino.js y sociosmi.js, #583 T3) con dobles: sin internet
   ni Google. 13-nov-2026: Juan pidió escribirle al socio de un apartamento; Alma buscó por un pedazo del nombre, tomó la
   PRIMERA coincidencia sin revisar el apartamento (antes había dicho «El único Mayorga que tengo es …», inventado) y el
   borrador nunca salió. Revisa:
   1. un apartamento nombrado manda: el 633 nunca da a alguien del 623 (ni por nombre parecido);
   2. dos contactos con el mismo nombre → dos candidatos, sin elegir; un pedazo de nombre («Ana») no es «Mariana»;
   3. un socio con número solo en su ficha de contacto → ese número, con su fuente;
   4. «los socios» de un apartamento con dos números → los dos;
   5. el teléfono del Control de usuarios con un encabezado distinto («Teléfono WhatsApp»), nunca el de emergencia;
   6. el número que da Juan gana; el parecido nunca es único; lo que se le dice a Alma lleva nombre, rol, apartamento y fuente;
   7. escribir_a_equipo, encargar_conversacion, programar_mensaje, mensaje_personal y los avisos de aterrizaje usan el
      resolvedor (destinoElegir_) y ya no agPersona_, opMatch_, personalPorNombre_ ni agSocio_; la voz recibe «decir».
   node .github/destino.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js'), AGE = leer('agente.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };

/* Números y nombres de prueba: no son los reales. */
const SOC_A = '50255550201', VECINO = '50255550203', SOC_B = '50255550202', SOC_D = '50255550204', SOC_C = '50255550205', EMERG = '50255550299';
const AXEL1 = '50255550301', AXEL2 = '50255550302', MARIANA = '50255550303', TECNICO = '50255550304', RECEP = '50255550401', JUAN = '50255550100';
const PROPS = ['Z13 - Edificio Alto - 633', 'Z13 - Edificio Alto - 623', 'Z4 - Calle Rue - 301', 'Z10 - Torre Sol - 1508'];

function hoja(filas) { return { getDataRange: () => ({ getDisplayValues: () => filas.map(r => r.map(String)) }), getLastRow: () => filas.length, appendRow: r => filas.push(r) }; }
function caja(o) {
  o = o || {};
  const cache = {}, guardadas = [];
  const SETUP = [['property_id', 'property_name', 'Usuario ID', 'User email', 'secondary user email'],
    ['a', PROPS[0], 'Socio_010', 'socio.a@prueba.test', ''], ['b', PROPS[1], 'Socio_006', 'vecino@prueba.test', ''],
    ['c', PROPS[2], 'Socio_032', 'socio.b@prueba.test', 'socio.d@prueba.test'], ['d', PROPS[3], 'Socio_020', 'socio.c@prueba.test', '']];
  /* El Control de usuarios con el teléfono bajo «Teléfono WhatsApp» y, antes, el de emergencia (que nunca se toma). */
  const USR = [['user_id', 'Nombre', 'Email', 'Teléfono de emergencia', 'Teléfono WhatsApp'],
    ['u1', 'Ana Prueba', 'socio.a@prueba.test', EMERG, '5555 0201'], ['u2', 'Mario Mayorga', 'vecino@prueba.test', EMERG, VECINO],
    ['u3', 'Beto Prueba', 'socio.b@prueba.test', '', SOC_B], ['u4', 'Dora Prueba', 'socio.d@prueba.test', '', SOC_D], ['u5', 'Ciro Prueba', 'socio.c@prueba.test', EMERG, '']];
  const fichas = (o.fichas || [
    { tel: AXEL1, nombre: 'Axel Ramírez', tipo: 'proveedor', rol: 'Proveedor de aire', propiedades: '' },
    { tel: AXEL2, nombre: 'Axel Duarte', tipo: 'equipo', rol: 'Técnico', propiedades: '' },
    { tel: MARIANA, nombre: 'Mariana Test', tipo: 'proveedor', rol: 'Lavandería', propiedades: '' },
    { tel: SOC_C, nombre: 'Ciro Prueba', tipo: 'socio', rol: 'Socio de Torre Sol 1508', propiedades: PROPS[3] },
    { tel: VECINO, nombre: 'Mario Mayorga', tipo: 'socio', rol: 'Socio', propiedades: PROPS[1] }
  ]).slice();
  const ctx = {
    console: { log() {}, warn() {}, error(e) { if (o.verErrores) console.log('  (error) ' + e); } }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10), sleep() {} },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => (n === 'SETUP' ? hoja(SETUP) : null), getSheets: () => [hoja(USR)] }) },
    RMES_HOJA_: 'hoja-mi', SHEET_ACCESOS_ID: 'hoja-usuarios', CFG: { TZ: 'America/Guatemala' }, ahora_: () => new Date('2026-11-16T18:00:00Z'),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8), celdaTexto_: x => String(x), DATO_HECHO_CAB_: [], hojaCrear_: () => ({ appendRow() {} }),
    adminsOp_: () => [{ nombre: 'Juan Prueba', email: 'juan@prueba', tels: [JUAN], principal: true }], adminPorTel_: () => null, opFilas_: () => [],
    contactosTodos_: () => fichas, contactoFicha_: w => fichas.filter(f => ctx.fin8_(f.tel) === ctx.fin8_(w))[0] || null,
    contactoGuardar_: (w, x) => guardadas.push(Object.assign({ tel: w }, x)), CONTACTO_TIPOS_: { proveedor: 'Proveedor', equipo: 'Equipo', socio: 'Socio' },
    epiSnap_: () => ({ vendors: [{ name: 'Karen Técnico', phone: TECNICO, cat: 'EPI Limpieza' }] }), vendNombre_: v => String(v.name || ''), contactoRolEpi_: c => 'Equipo de ' + c,
    escalamiento_: () => [], recepcionNumeros_: () => ({ x: { n: RECEP, prop: PROPS[0] } }), accesosPorRol_: () => ({ socios: [] }),
    contactoRecientes_: () => o.recientes || [], bqMejor_: (q, l) => (o.parecido ? l.filter(n => n === o.parecido)[0] || '' : ''),
    agElegirReserva_: () => ({ error: 'sin reserva' })
  };
  vm.createContext(ctx);
  vm.runInContext(['telsEnTexto_', 'normTel_', 'telsDe_'].map(n => sacar(COD, n)).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  ['sociosmi.js', 'destino.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  return { ctx, guardadas };
}
const tels = r => r.candidatos.map(c => c.tel).sort().join(',');

/* ── 5 · El teléfono del Control de usuarios con otro encabezado, nunca el de emergencia ── */
let C = caja();
const usr = C.ctx.socioMiUsuarios_();
ok(usr['socio.a@prueba.test'].tel.replace(/\D/g, '').slice(-8) === '55550201' && usr['socio.c@prueba.test'].tel === '', '«Teléfono WhatsApp» se lee como el teléfono de esa fila y el de emergencia nunca se toma (Ciro queda sin número)');
ok(C.ctx.socioColTel_(['numero_de_apartamento', 'numero']) === 1 && C.ctx.socioColTel_(['telefono_asistente', 'nombre']) === -1 && C.ctx.socioColTel_(['celular']) === 0, '«Número» solo sí es el teléfono; «Número de apartamento» y el del asistente no');

/* ── 1 · El 633 nunca es el 623 ── */
let r = C.ctx.destinoResolver_({ persona: 'socio de Edificio Alto 633' });
ok(r.unico && r.candidatos[0].tel === SOC_A && r.candidatos[0].fuente === 'Control de usuarios' && /Edificio Alto 633/.test(C.ctx.destinoDecir_(r.candidatos[0])), '«socio de Edificio Alto 633»: Ana, del 633, con su fuente (Control de usuarios)');
r = C.ctx.destinoResolver_({ persona: 'Mayorga', propiedad: 'Edificio Alto 633' });
ok(!r.candidatos.some(c => c.tel === VECINO) && !r.unico, '«Mayorga» con el 633: nunca Mario Mayorga del 623 (ni en Mi ni en su ficha); no se inventa a nadie');
r = C.ctx.destinoResolver_({ persona: 'Edificio Alto 633' });
ok(r.candidatos.length === 1 && r.candidatos[0].tel === SOC_A, 'solo el apartamento («Edificio Alto 633»): su socio, no el del vecino');
r = C.ctx.destinoResolver_({ persona: 'Recepción Edificio Alto' });
ok(r.unico && r.candidatos[0].tel === RECEP && r.candidatos[0].rol === 'recepción', '«Recepción Edificio Alto»: la recepción del edificio (no el socio)');

/* ── 2 · Mismo nombre, dos personas; un pedazo no es un nombre ── */
r = C.ctx.destinoResolver_({ persona: 'Axel' });
ok(r.candidatos.length === 2 && !r.unico && tels(r) === [AXEL1, AXEL2].sort().join(','), '«Axel» con dos contactos: dos candidatos, sin elegir');
const e2 = C.ctx.destinoElegir_({ persona: 'Axel', texto: 'Hola' }, { hechas: [] }, '');
ok(e2.error && /2 personas posibles/.test(e2.error) && /Axel Ramírez/.test(e2.error) && /Axel Duarte/.test(e2.error) && e2.candidatos.every(c => !c.tel && c.tel_ultimos4), 'y la herramienta no envía: nombra a las dos (sin el número completo) para preguntar solo cuál');
r = C.ctx.destinoResolver_({ persona: 'Ana' });
ok(!r.candidatos.some(c => c.tel === MARIANA), '«Ana» no es «Mariana» (nada de pedazos sueltos)');
r = C.ctx.destinoResolver_({ persona: 'Axel Duarte' });
ok(r.unico && r.candidatos[0].tel === AXEL2, '«Axel Duarte»: uno solo');

/* ── 3 · El número solo en la ficha de contacto ── */
r = C.ctx.destinoResolver_({ persona: 'socio de Torre Sol 1508' });
ok(r.unico && r.candidatos[0].tel === SOC_C && r.candidatos[0].fuente === 'ficha de contacto', 'socio con número solo en su ficha: ese número, con la fuente «ficha de contacto»');
C = caja({ fichas: [] });
const e3 = C.ctx.destinoElegir_({ persona: 'socio de Torre Sol 1508', texto: 'Hola' }, { hechas: [] }, '');
ok(e3.error && e3.sin_numero && /Ciro Prueba/.test(e3.error) && /UNA vez/.test(e3.error), 'sin número en ningún lado: dice quién es según Mi y pide el número una sola vez');

/* ── 4 · «Los socios» ── */
C = caja();
r = C.ctx.destinoResolver_({ persona: 'los socios de Calle Rue 301' });
ok(r.todos && r.candidatos.length === 2 && tels(r) === [SOC_B, SOC_D].sort().join(','), '«los socios de Calle Rue 301» con dos números: los dos');
const e4 = C.ctx.destinoElegir_({ persona: 'los socios de Calle Rue 301' }, { hechas: [] }, '');
ok(e4.destinos && e4.destinos.length === 2, 'y escribir_a_equipo les escribe a los dos');
const e4b = C.ctx.destinoElegir_({ persona: 'socio de Calle Rue 301' }, { hechas: [] }, '');
ok(e4b.error && /2 personas posibles/.test(e4b.error), '«el socio» (uno) con dos socios: pregunta cuál, no manda al primero');

/* ── 6 · El número de Juan gana; el parecido nunca es único ── */
r = C.ctx.destinoResolver_({ persona: 'socio de Edificio Alto 633', numero: '+502 5555 0777' });
ok(r.unico && r.candidatos[0].tel === '50255550777' && r.candidatos[0].fuente === 'el número que diste', 'con el número que dio Juan, ese número (fuente: el que diste)');
C = caja({ parecido: 'Axel Ramírez' });
r = C.ctx.destinoResolver_({ persona: 'Aksel Ramires' });
ok(r.candidatos.length === 1 && r.candidatos[0].parecido && !r.unico, 'parecido por escritura o voz: candidato marcado y nunca único (Alma pregunta)');
const ctxD = { hechas: [] }; C.ctx.destinoElegir_({ persona: 'socio de Edificio Alto 633' }, ctxD, '');
ok(ctxD.destinos && /^Ana Prueba \(socio de Edificio Alto 633, número de Control de usuarios\)$/.test(ctxD.destinos[0]), 'lo que se dice queda en ctx.destinos: «Ana Prueba (socio de Edificio Alto 633, número de Control de usuarios)»');

/* ── 7 · Las cinco herramientas usan el resolvedor ── */
const caso = n => (new RegExp("case '" + n + "': \\{[\\s\\S]*?\\n    \\}").exec(AGE) || [''])[0];
const viejo = /agPersona_\(|opMatch_\(|personalPorNombre_\(|relevoNumeroDe_\(|agSocio_\(|familiaNumero_\(/;
['escribir_a_equipo', 'encargar_conversacion', 'programar_mensaje', 'mensaje_personal'].forEach(n => {
  const c = caso(n); ok(c && /destinoElegir_\(/.test(c) && !viejo.test(c), n + ' usa destinoElegir_ (destinoResolver_) y no agPersona_/opMatch_/personalPorNombre_');
});
const avl = sacar(leer('avisovuelo.js'), 'avlPersona_');
ok(/destinoElegir_\(/.test(avl) && !viejo.test(avl), 'los avisos de aterrizaje (avlPersona_) usan el resolvedor');
const sec = sacar(leer('voz.js'), 'vozSecretaria_');
ok(/out\.decir = /.test(sec) && /r\.destinos/.test(sec) && /destinos: ctx\.destinos/.test(sacar(AGE, 'agCerrarTurno_')), 'la respuesta de secretaria a la voz trae «decir» con el nombre y el apartamento del resolvedor');

process.exit(fallo);
