/* Prueba con dobles del registro de pruebas del Modo inicio (apps-script/pruebas.js, #764), sin Google. 18-nov-2026:
   Juan pidió «hacer un récord/registro de las pruebas del modo OK durante las siguientes dos horas». Revisa:
   1. sin ventana abierta, la página no guarda nada (activo: false);
   2. registro_de_pruebas empezar abre 2 h y deja un activador; lo que llega se guarda sin textos raros ni números;
   3. ver cuenta despertares, llamadas que conectaron y en cuánto, las que no conectaron y los errores;
   4. al terminar la ventana, pruebasCerrar la cierra y deja un solo aviso con el resumen; después ya no anota;
   5. solo el principal, y la página y la herramienta están conectadas (Código.js, agente.js, inicio.html).
   node .github/registro-pruebas.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const CANDADO_ = fs.readFileSync(path.join(DIR, 'candado.js'), 'utf8') + '\n';   // el candado único (apps-script/candado.js)
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const PR = leer('pruebas.js'), CALLE = leer('calle.js');
const H = 3600000, T0 = Date.parse('2026-11-18T08:55:00Z');

function caja(principal) {
  const props = {}, filas = [], avisos = [], triggers = [];
  let ahora = T0;
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const hoja = { getLastRow: () => filas.length + 1, getRange: (r, c, n, m) => ({ setValues: v => { v.forEach(f => filas.push(f)); }, getValues: () => filas.slice(r - 2, r - 2 + n) }) };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, isNaN, Error,
    CFG: { TZ: 'America/Guatemala', HUB_URL: 'https://hub' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: { formatDate: (d) => new Date(d.getTime() - 6 * H).toISOString().slice(11, 19) },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: f => ({ timeBased: () => ({ at: d => ({ create: () => triggers.push({ getHandlerFunction: () => f, at: d }) }) }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    hojaCrear_: () => hoja, hoja_: () => hoja,
    chatSesAdm_: s => (s ? { email: 'p@x', principal: principal !== false } : null), esAdminPrincipal_: a => !!(a && a.principal),
    agPrincipal_: () => ({ email: 'p@x' }), pendAvisar_: (a, t) => avisos.push(t), pushA_() {}
  };
  vm.createContext(ctx);
  vm.runInContext(CANDADO_ + sacar(CALLE, 'vozCaidaLimpiar_') + '\n' + PR, ctx);
  return { ctx, props, filas, avisos, triggers, mover: ms => { ahora += ms; }, ahora: () => ahora };
}
const SES = { t: 'ses' };

/* ── 1 ── sin ventana */
{ const c = caja(), r = c.ctx.pruebasInicio_(SES, { que: 'anotar', eventos: [{ t: T0, que: 'escucha_on' }] });
  ok(r.ok && r.activo === false && !c.filas.length, '1 · sin registro abierto no se guarda nada'); }

/* ── 2 a 4 ── */
{ const c = caja(), x = c.ctx, adm = { email: 'p@x', principal: true };
  const e = x.pruebasParaAlma_(adm, { que: 'empezar' });
  const v = JSON.parse(c.props.PRUEBAS_REGISTRO);
  ok(e.ok && Date.parse(v.hasta) - Date.parse(v.desde) === 2 * H, '2 · empezar abre 2 horas por defecto');
  ok(c.triggers.length === 1 && c.triggers[0].getHandlerFunction() === 'pruebasCerrar', '2 · deja un solo activador para cerrar');
  const t = c.ahora(); c.mover(70000);   // la página manda en lotes: lo que llega ya pasó
  const r = x.pruebasInicio_(SES, { que: 'anotar', eventos: [
    { t: t + 1000, que: 'escucha_on' }, { t: t + 5000, que: 'conferencia_on' }, { t: t + 5100, que: 'voz_conectando' },
    { t: t + 7600, que: 'voz_hablando', ms: 2500 }, { t: t + 40000, que: 'voz_fin', ms: 32400 },
    { t: t + 60000, que: 'voz_conectando' }, { t: t + 64000, que: 'error', det: 'No conecta, llama al +502 5555 1234' }, { t: t + 64100, que: 'voz_fin', det: 'sin_conectar', ms: 4100 },
    { t: t + 65000, que: 'cualquier_cosa' } ] });
  ok(r.activo && r.anotados === 8, '2 · guarda los 8 eventos válidos y descarta lo desconocido (' + r.anotados + ')');
  ok(!c.filas.some(f => /5555/.test(f[2])), '2 · el número del error no queda en la hoja');
  const s = x.pruebasParaAlma_(adm, { que: 'ver' });
  ok(s.despertares === 1 && s.llamadas === 2 && s.conectaron === 1 && s.sin_conectar === 1 && s.segundos_en_conectar.promedio === 2.5, '3 · ver: 1 despertar, 2 llamadas, 1 conectó en 2,5 s y 1 no');
  ok(s.errores.length === 1 && s.linea_de_tiempo.length === 8 && /conectó en 2.5 s/.test(s.linea_de_tiempo.join('|')), '3 · ver: errores y línea de tiempo');
  c.mover(2 * H + 60000); x.pruebasCerrar();
  ok(c.avisos.length === 1 && /despertó 1/.test(c.avisos[0]) && /1 conectaron/.test(c.avisos[0]), '4 · al terminar deja un solo aviso con el resumen');
  x.pruebasCerrar(); ok(c.avisos.length === 1, '4 · cerrar dos veces no repite el aviso');
  const d = x.pruebasInicio_(SES, { que: 'anotar', eventos: [{ t: c.ahora(), que: 'escucha_on' }] });
  ok(d.activo === false && c.filas.length === 8, '4 · cerrada, ya no anota'); }

/* ── 5 ── */
{ const c = caja(false);
  ok(c.ctx.pruebasParaAlma_({ email: 'o@x' }, { que: 'empezar' }).ok === false && !c.props.PRUEBAS_REGISTRO, '5 · otra persona no abre el registro');
  ok(c.ctx.pruebasInicio_(SES, { que: 'estado' }).activo === false, '5 · otra persona no anota');
  const COD = leer('Código.js'), AG = leer('agente.js'), PAG = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/case 'pruebasInicio': return json_\(pruebasInicio_\(ses, body\)\)/.test(COD), '5 · el Hub atiende pruebasInicio');
  ok(/T\('registro_de_pruebas'/.test(AG) && /case 'registro_de_pruebas': return pruebasParaAlma_\(adm, inp\)/.test(AG), '5 · Alma tiene la herramienta registro_de_pruebas');
  ok(['AlmaPrueba.voz(e)', 'AlmaPrueba.escucha(e)', 'AlmaPrueba.conf(e)', 'window.AlmaPrueba = {'].every(k => PAG.indexOf(k) >= 0), '5 · la página del inicio anota la voz, la escucha y la conferencia'); }

process.exit(fallo);
