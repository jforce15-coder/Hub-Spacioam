/* Llaves desde Ajustes (apps-script/llaves.js), con dobles de Google: sin internet ni hojas reales. 13-nov-2026: la
   pantalla de Propiedades del script ya no deja agregar más (~50) y Juan eligió guardarlas desde Ajustes (opción A).
   Revisa:
   1. sin sesión (la llave vieja del Hub o un robot), con otro usuario o con un administrador que no es el principal: no;
   2. solo los nombres de la lista permitida (nunca HUB_TOKEN, GITHUB_TOKEN ni cualquier otra propiedad);
   3. guarda con setProperty y responde solo { ok, nombre, guardada_el, termina_en }: nunca el valor;
   4. llaveEstado dice si está y sus 4 últimas letras, nunca el valor; el registro tampoco lo lleva;
   5. el Hub las enruta con la sesión verificada y la pantalla borra el campo al enviar y no lo guarda en el teléfono.
   node .github/llaves.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script'), RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(f, 'utf8');

/* Las funciones de verdad: llaves.js entero y, de paraclaude.js, quién es el principal con su sesión. */
const pc = leer(path.join(DIR, 'paraclaude.js'));
const fn = n => { const m = pc.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}|function ' + n + '\\([^)]*\\) \\{[^\\n]*\\}')); if (!m) throw new Error('no encontré ' + n + ' en paraclaude.js'); return m[0]; };

function caja(admins) {
  const mem = { HUB_TOKEN: 'viejo', OTRA: 'x' }, filas = [], puestas = [];
  const JUAN = admins.find(a => a.email === 'juan@x');
  const ctx = {
    console: { log() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp,
    CFG: { TZ: 'America/Guatemala', TAB_LOG: 'ALMA_LOG' },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 16).replace('T', ' ') },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { puestas.push(k); mem[k] = String(v); }, deleteProperty: k => { delete mem[k]; } }) },
    hoja_: () => ({ appendRow: r => filas.push(r) }),
    adminsOp_: () => admins,
    /* como en Código.js: un correo que no es administrador vuelve como alguien sin permiso (principal: false) */
    adminPorEmail_: e => { e = String(e || '').trim().toLowerCase(); return admins.find(a => a.email === e) || (e ? { email: e, nombre: e, tels: [], principal: false } : null); },
    /* como en voz.js: sin sesión devuelve al principal (llave antigua del Hub). Las llaves no deben aceptarlo. */
    vozWebAdmin_: ses => (!ses ? JUAN || null : admins.find(a => (a.alternos || []).indexOf(String(ses.email || '').toLowerCase()) >= 0) || null)
  };
  vm.createContext(ctx);
  vm.runInContext(fn('esAdminPrincipal_') + '\n' + fn('paraClaudePrincipalSes_') + '\n' + leer(path.join(DIR, 'llaves.js')), ctx);
  ctx.mem = mem; ctx.filas = filas; ctx.puestas = puestas;
  return ctx;
}
const JUAN = { email: 'juan@x', nombre: 'Juan', principal: true, alternos: ['juan.otro@x'], tels: ['1'] };
const ANA = { email: 'ana@x', nombre: 'Ana', principal: false, alternos: [], tels: ['2'] };
const VALOR = 'jev_PRUEBA_0123456789abcdefZ9q7';

/* 1. Quién puede */
{ const c = caja([JUAN, ANA]);
  for (const [ses, como] of [[null, 'sin sesión (llave vieja del Hub o robot)'], [undefined, 'sin sesión'], [{}, 'con una sesión sin correo'],
    [{ email: 'ana@x' }, 'con la sesión de otro administrador'], [{ email: 'nadie@x' }, 'con la sesión de alguien que no es administrador']]) {
    c.SES_ = ses;
    const g = vm.runInContext('llaveGuardarApi_(SES_, "JEV_KEY", "' + VALOR + '")', c), e = vm.runInContext('llaveEstadoApi_(SES_)', c);
    ok(g.ok === false && !c.puestas.length && !('JEV_KEY' in c.mem), 'llaveGuardar ' + como + ': la rechaza y no guarda nada');
    ok(e.ok === false && !e.llaves, 'llaveEstado ' + como + ': la rechaza');
  }
  c.SES_ = { email: 'juan.otro@x' };
  ok(vm.runInContext('llaveEstadoApi_(SES_)', c).ok === true, 'el principal también entra con su correo alterno'); }
{ // sin nadie marcado como principal, esAdminPrincipal_ deja pasar a cualquier administrador: las llaves no
  const c = caja([Object.assign({}, ANA)]); c.SES_ = { email: 'ana@x' };
  ok(vm.runInContext('llaveGuardarApi_(SES_, "JEV_KEY", "' + VALOR + '")', c).ok === false && !c.puestas.length, 'un administrador que no está marcado como principal no guarda llaves (aunque no haya principal)'); }

/* 2. Solo la lista permitida */
{ const c = caja([JUAN, ANA]); c.SES_ = { email: 'juan@x' };
  for (const n of ['HUB_TOKEN', 'GITHUB_TOKEN', 'CLAUDE_RUTINA_TOKEN', 'jev_key', '', '__proto__', 'constructor', 'LLAVES_GUARDADAS']) {
    const r = vm.runInContext('llaveGuardarApi_(SES_, ' + JSON.stringify(n) + ', "' + VALOR + '")', c);
    ok(r.ok === false && !c.puestas.length, 'un nombre fuera de la lista («' + n + '») se rechaza sin tocar nada');
  }
  ok(c.mem.HUB_TOKEN === 'viejo', 'HUB_TOKEN sigue igual');
  for (const [v, por] of [['', 'vacía'], ['   ', 'solo espacios'], ['abc def ghi jkl mno pqr', 'con espacios'], ['corta123', 'muy corta'], ['x'.repeat(513), 'muy larga'], ['llaveñandú1234567890', 'con acentos']]) {
    const r = vm.runInContext('llaveGuardarApi_(SES_, "JEV_KEY", ' + JSON.stringify(v) + ')', c);
    ok(r.ok === false && !c.puestas.length && r.error, 'una llave ' + por + ' se rechaza con un texto claro');
  }
  const lista = (leer(path.join(DIR, 'llaves.js')).match(/var LLAVES_PERMITIDAS_ = \[([\s\S]*?)\n\];/) || [])[1] || '';
  ok(/'JEV_KEY'/.test(lista), 'JEV_KEY está en la lista permitida');
  const otros = fs.readdirSync(DIR).filter(f => /\.js$/.test(f) && f !== 'llaves.js' && /LLAVES_PERMITIDAS_\s*=/.test(leer(path.join(DIR, f))));
  ok(!otros.length, 'la lista permitida vive en un solo lugar (llaves.js)' + (otros.length ? ': también en ' + otros.join(', ') : '')); }

/* 3 y 4. Guardar y ver el estado sin el valor */
{ const c = caja([JUAN, ANA]); c.SES_ = { email: 'juan@x' };
  const antes = vm.runInContext('llaveEstadoApi_(SES_)', c), j0 = (antes.llaves || []).find(l => l.nombre === 'JEV_KEY');
  ok(antes.ok && j0 && j0.guardada === false && j0.termina_en === '', 'antes de guardarla: JEV_KEY dice «falta»');
  const r = vm.runInContext('llaveGuardarApi_(SES_, " JEV_KEY ", "  ' + VALOR + '  ")', c);
  ok(r.ok === true && c.mem.JEV_KEY === VALOR, 'el principal con sesión la guarda en las Propiedades del script (sin los espacios de los lados)');
  ok(Object.keys(r).sort().join() === 'guardada_el,nombre,ok,termina_en', 'la respuesta trae solo ok, nombre, guardada_el y termina_en');
  ok(r.termina_en === VALOR.slice(-4) && r.nombre === 'JEV_KEY' && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(r.guardada_el), 'termina_en son las 4 últimas letras y guardada_el la fecha');
  ok(JSON.stringify(r).indexOf(VALOR.slice(0, 12)) < 0, 'la respuesta nunca trae el valor');
  ok(c.filas.length === 1 && /JEV_KEY/.test(c.filas[0].join(' ')) && /Juan/.test(c.filas[0].join(' ')), 'queda la huella en ALMA_LOG: qué llave y quién');
  ok(JSON.stringify(c.filas).indexOf(VALOR.slice(0, 12)) < 0 && JSON.stringify(c.filas).indexOf(VALOR.slice(-4)) < 0, 'el registro no lleva el valor (ni sus letras)');
  ok(String(c.mem.LLAVES_GUARDADAS || '').indexOf(VALOR.slice(0, 12)) < 0, 'la marca de cuándo se guardó no lleva el valor');
  const e = vm.runInContext('llaveEstadoApi_(SES_)', c), j = e.llaves.find(l => l.nombre === 'JEV_KEY');
  ok(e.ok && j.guardada === true && j.termina_en === VALOR.slice(-4) && j.guardada_el === r.guardada_el, 'llaveEstado: guardada, sus 4 últimas letras y cuándo');
  ok(JSON.stringify(e).indexOf(VALOR.slice(0, 12)) < 0 && Object.keys(j).sort().join() === 'guardada,guardada_el,nombre,para,termina_en', 'llaveEstado nunca trae el valor');
  c.mem.LLAVES_GUARDADAS = '{roto';
  ok(vm.runInContext('llaveEstadoApi_(SES_)', c).ok === true, 'si la marca de fechas se dañó, el estado igual responde'); }

/* 5. El Hub y la pantalla */
{ const cod = leer(path.join(DIR, 'Código.js')), cupo = leer(path.join(DIR, 'cupo.js'));
  ok(/case 'llaveGuardar': return json_\(llaveGuardarApi_\(ses, body\.nombre, body\.valor\)\)/.test(cod), 'la acción llaveGuardar del Hub pasa la sesión verificada');
  ok(/case 'llaveEstado': return json_\(llaveEstadoApi_\(ses\)\)/.test(cod), 'la acción llaveEstado del Hub pasa la sesión verificada');
  ok(/inicio: '[^']*\bllaveEstado llaveGuardar\b/.test(cupo), 'llaveEstado y llaveGuardar están en su canal del cupo');
  const html = leer(path.join(RAIZ, 'alma', 'inicio.html'));
  const blq = (html.match(/<script>\s*\/\* ── Llaves \(apps-script\/llaves\.js[\s\S]*?<\/script>/) || [''])[0];
  ok(!!blq, 'Ajustes tiene la sección Llaves (alma/inicio.html)');
  ok(/id="i-llave"[^>]*type="password"|type="password"[^>]*id="i-llave"/.test(html), 'el campo de la llave es de tipo contraseña');
  ok(/i\.value = "";[^\n]*hub\("llaveGuardar"|i\.value = "";[\s\S]{0,80}hub\("llaveGuardar"/.test(blq), 'el campo se borra antes de mandarla al Hub');
  ok(!/localStorage|sessionStorage|indexedDB|console\.log/.test(blq), 'la pantalla no guarda ni escribe la llave en el teléfono');
  ok(/admin_principal/.test(blq) && /mostrar\(false\)/.test(blq), 'la sección se ve solo con el administrador principal'); }

process.exit(fallo);
