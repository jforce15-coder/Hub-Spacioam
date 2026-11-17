/* Prueba del estado de los equipos precargado (apps-script/equipos.js) con dobles: sin internet ni Google.
   Juan, 17-nov-2026: «mantener precargado e inmediato el estado y resumen de los equipos de operaciones, finanzas y
   desarrollo (tareas, limitaciones y problemas) para poder darlo al instante». Revisa:
   1. las frases de Juan van a la respuesta instantánea «equipos» (con los equipos que nombró) y las de la operación del
      día siguen en su regla de siempre;
   2. el resumen sale de lo guardado (EQ_RESUMEN) sin volver a leer hojas ni llamar a la IA;
   3. trae tareas, problemas y limitaciones de cada equipo; la voz es una línea por equipo;
   4. solo el administrador principal; cabe en una propiedad (9 KB);
   5. estado_equipos está en el camino rápido de la voz y en las herramientas de Alma.
   node .github/equipos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const props = {}, ahora = Date.now(); let lecturas = 0;
const ctx = { console, JSON, Date, Math, String, Number, Array, RegExp, Object,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = String(v); } }) },
  Utilities: { formatDate: (d, tz, f) => { const x = new Date(d); return f === 'yyyy-MM' ? x.toISOString().slice(0, 7) : x.toISOString().slice(0, 10); } },
  CFG: { TZ: 'America/Guatemala' } };
vm.createContext(ctx);
['instantaneas.js', 'equipos.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx));
vm.runInContext(`
var MICRO_ESTADOS_ = { trabajo: 'en trabajo', pregunta: 'Claude pregunta', listo: 'listo para unir', unido: 'unido', cerrado: 'cerrado' };
var AGT_CAB_ = [], AGP_CAB_ = [], PRINCIPAL_ = true;
function agente_(id) { return { id: id, nombre: id, estado: 'activo', ultima: new Date(${ahora} - 2 * 3600000).toISOString(), horas: id === 'finanzas' ? '9' : '7,13,19', dias: id === 'finanzas' ? '1,2,3,4,5' : '1,2,3,4,5,6,7', presupuesto_usd: 10, mes: '', gasto_mes: 0 }; }
function hojaAgT_() { LECTURAS_(); return 'T'; } function hojaAgP_() { return 'P'; }
function agFilas_(sh) { return sh === 'T' ? [{ agente: 'operaciones', estado: 'hecha', informe: 'Revisé llegadas de hoy y mañana.\\nListo: ✓ todo' }]
  : [{ agente: 'operaciones', estado: 'pendiente', titulo: 'Crear tarea en 1102: cambiar foco' }, { agente: 'finanzas', estado: 'error', titulo: 'Guardar nota: cobro', decidido: new Date().toISOString() }]; }
function cupoPermite_() { return true; }
function recHoy_() { return new Date().toISOString().slice(0, 10); }
function epiSnap_() { return { tareas: [{ id: 1, texto: 'Cambiar foco', vence: '2020-01-01' }, { id: 2, texto: 'Revisar WiFi' }] }; }
function microFilas_() { return [{ nombre: 'Sonido al colgar', estado: 'listo para unir', actualizado: ${ahora} }, { nombre: 'Otra cosa', estado: 'Claude pregunta', actualizado: ${ahora} }]; }
function paraClaudeLista_() { return { pedidos: [] }; }
function esAdminPrincipal_() { return PRINCIPAL_; }
`, ctx);
ctx.LECTURAS_ = () => { lecturas++; };

/* 1 · frases */
const eq = ['¿Cómo van los equipos?', 'Alma, estado y resumen de los equipos de operaciones, finanzas y desarrollo (tareas, limitaciones y problemas)',
  'resumen de operaciones', 'cómo va desarrollo', 'dame el estado de finanzas y desarrollo', 'estado de los agentes'];
eq.forEach(f => { const r = ctx.instReconocer_(f); ok(r && r.tipo === 'equipos', '1 · «' + f + '» → equipos'); });
['¿Cómo está la operación hoy?', 'resumen de la operación de hoy', '¿qué tareas tengo abiertas?'].forEach(f => { const r = ctx.instReconocer_(f); ok(r && r.tipo !== 'equipos', '1 · «' + f + '» sigue en su regla (' + (r && r.tipo) + ')'); });
ok(JSON.stringify(ctx.eqCuales_('finanzas y desarrollo')) === '["finanzas","desarrollo"]', '1 · «finanzas y desarrollo» → solo esos dos');

/* 2 y 3 · al instante desde lo guardado */
const adm = { email: 'principal' };
const chat = ctx.instEquipos_(adm, ctx.instReconocer_(eq[1]), 'chat');
ok(lecturas === 1 && !!props.EQ_RESUMEN, '2 · la primera vez lo arma y lo guarda');
const otra = ctx.instEquipos_(adm, ctx.instReconocer_(eq[0]), 'chat');
ok(lecturas === 1, '2 · la segunda sale de lo guardado, sin leer hojas');
ok(['Operaciones', 'Finanzas', 'Desarrollo'].every(n => chat.indexOf(n + '\n') >= 0), '3 · trae los tres equipos');
ok(/Tareas[\s\S]*Problemas[\s\S]*Limitaciones/.test(chat), '3 · tareas, problemas y limitaciones');
ok(/tarea vencida en Epi/.test(chat) && /propuesta aprobada no salió/.test(chat) && /Claudio espera tu respuesta/.test(chat) && /listo para unir/.test(chat), '3 · problemas y tareas reales de cada equipo');
ok(/nunca mueve dinero/.test(chat), '3 · la limitación de Finanzas');
const voz = ctx.instEquipos_(adm, ctx.instReconocer_('cómo va desarrollo'), 'llamada');
ok(/^Desarrollo: /.test(voz) && voz.indexOf('Operaciones') < 0 && voz.split(' ').length <= 40 && voz.indexOf('\n') < 0, '3 · en voz, una línea corta y solo el equipo pedido: ' + voz);
ok(otra === chat, '3 · lo mismo con otra frase');

/* 4 · solo el principal y cabe */
vm.runInContext('PRINCIPAL_ = false', ctx);
ok(ctx.instEquipos_(adm, ctx.instReconocer_(eq[0]), 'chat') === null && ctx.eqHerramienta_(adm, {}).ok === false, '4 · otro administrador no lo recibe');
ok(props.EQ_RESUMEN.length <= 9000, '4 · cabe en una propiedad (' + props.EQ_RESUMEN.length + ' caracteres)');

/* 5 · herramienta */
const rap = fs.readFileSync(path.join(DIR, 'rapido.js'), 'utf8'), ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8');
ok(/VOZ_RAPIDO_HERR_[^;]*'estado_equipos'/.test(rap), '5 · estado_equipos en el camino rápido');
ok(/T\('estado_equipos'/.test(ag) && /case 'estado_equipos': return eqHerramienta_/.test(ag), '5 · estado_equipos en las herramientas de Alma');
process.exit(fallo);
