/* Prueba de A la mano (apps-script/amano.js; Juan, 18-nov-2026) con dobles: caché y propiedades de mentira, una copia de
   Epi y una hoja de reservas inventadas (nada real).
   1. Cercanía: nombrar la limpieza la acerca; baja a la mitad cada hora; por la mañana la del principal no baja de 60.
   2. El paquete de limpieza sale de la copia de Epi: quién, cuántas, tentativas, sin persona, tareas vencidas, llegadas y
      salidas; dice de cuándo es el dato. La de mañana solo desde las 7 p. m.
   3. Se rehace solo cuando cambia la copia de Epi, y la calidad cuenta si lo que decía coincidía con la copia nueva.
   4. La ficha de la llamada lleva solo lo cercano y usable, recortado; vieja o en duda, no se usa.
   5. a_mano: al administrador le da el resumen al instante; a quien no es administrador, no; sin paquete, «usa secretaria».
   6. El bloque del chat solo aparece si el mensaje nombra el tema.
   7. Medición: solo números (sin textos ni nombres).
   node .github/a-la-mano.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const i = src.indexOf('function ' + nombre + '('); if (i < 0) throw new Error('falta ' + nombre); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } } return src.slice(i, j + 1); };

const HOY = '2026-11-18', MANANA = '2026-11-19';
function caja(o) {
  o = o || {};
  const cache = {}, props = {}, reloj = { ms: Date.parse(HOY + 'T' + (o.hora || '15:00') + ':00Z') };   // hora «local» = UTC en los dobles
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN,
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(reloj.ms); } static now() { return reloj.ms; } static parse(s) { return Date.parse(s); } },
    CFG: { TZ: 'UTC', TAB_RESERVAS: 'Reservas' },
    Utilities: { formatDate: (d, tz, f) => { const x = new Date(d).toISOString(); return f === 'H' ? String(Number(x.slice(11, 13))) : f === 'H:mm' ? Number(x.slice(11, 13)) + ':' + x.slice(14, 16) : x.slice(0, 10); } },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    sumarDias_: (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10),
    s_: (v) => (v == null || typeof v === 'object' ? '' : String(v)), fecha_: (v) => String(v || '').slice(0, 10),
    normTel_: (x) => String(x || '').replace(/\D/g, ''), instFechaTxt_: (f) => f,
    adminsOp_: () => [JUAN], adminPorTel_: (t) => (String(t).endsWith('5555') ? JUAN : null), esAdminPrincipal_: (a) => !!(a && a.principal),
    leerTabla_: () => o.reservas || RESERVAS, formsOk_: () => [],
    opFilas_: () => o.op || [], rapidoPideHacer_: (t) => /\b(env[ií]a|manda|escr[ií]bele|pon)\b/i.test(t),
    agBuscarReservas_: () => [], fichaSocioBuscar_: () => ({ error: 'no' }), fichaVer_: () => null, socioClaveProp_: (p) => String(p || '').toLowerCase().split(/\W+/).filter(Boolean),
    epiSnapCache_: () => ctx.__epi, epiSnap_: () => ctx.__epi
  };
  ctx.ahora_ = () => new ctx.Date(); ctx.recHoy_ = () => new ctx.Date().toISOString().slice(0, 10);
  vm.createContext(ctx);
  const ag = leer('agente.js');
  ctx.vendNombre_ = (v) => String(v.name || '');
  vm.runInContext('var RUTA_HORA_VISIBLE_ = 19;', ctx);
  ['epiSnapUtil_', 'rutaFechaOculta_', 'agRutaTrabajos_'].forEach((f) => vm.runInContext(sacar(ag, f), ctx));
  ctx.opMatch_ = (q, l) => l.find((x) => x.toLowerCase().includes(String(q).toLowerCase())) || '';
  vm.runInContext(leer('amano.js'), ctx);
  ctx.__epi = o.epi || EPI(reloj.ms);
  return { X: ctx, cache, props, reloj };
}
const JUAN = { email: 'juan@ejemplo.com', nombre: 'Juan', principal: true };
const EPI = (ms, extra) => ({ ts: new Date(ms).toISOString(),
  vendors: [{ id: 1, name: 'Técnica Uno', email: 'uno@x' }, { id: 2, name: 'Técnico Dos', email: 'dos@x' }], props: [{ nombre: 'Edificio A 101' }],
  tareas: [{ id: 't1', texto: 'Cambiar foco', vence: HOY, prop: 'Edificio A 101' }, { id: 't2', texto: 'Pintar', vence: '2026-12-01' }],
  schedules: [
    { id: 's1', fecha: HOY, hora: '10:00', tipo: 'Limpieza de salida', propiedad: 'Edificio A 101', vendorEmail: 'uno@x', estado: 'confirmada' },
    { id: 's2', fecha: HOY, hora: '12:00', tipo: 'Limpieza de salida', propiedad: 'Edificio B 202', vendorEmail: 'uno@x', estado: 'tentativa' },
    { id: 's3', fecha: HOY, hora: '09:00', tipo: 'Repaso', propiedad: 'Edificio C 303', vendorEmail: 'dos@x', estado: 'hecha' },
    { id: 's4', fecha: MANANA, hora: '09:00', tipo: 'Limpieza de salida', propiedad: 'Edificio D 404', vendorEmail: 'dos@x', estado: 'confirmada' }
  ].concat(extra || []) });
const RESERVAS = [{ code: 'R1', checkin_date: '2026-11-15', checkout_date: HOY, property_name: 'Edificio A 101', status: 'accepted' },
  { code: 'R2', checkin_date: HOY, checkout_date: '2026-11-21', property_name: 'Edificio E 505', status: 'accepted' },
  { code: 'R3', checkin_date: HOY, checkout_date: '2026-11-22', property_name: 'Edificio F 606', status: 'cancelled' }];

/* 1 · Cercanía */
{ const c = caja(), X = c.X;
  ok(!X.amanoCerca_(JUAN).length, '1 · a las 15:00 y sin mencionarla, la limpieza no está cerca');
  X.amanoSentir_(JUAN, '¿Quién está limpiando hoy?');
  const p0 = X.amanoCerca_(JUAN).find((x) => x.clave === 'limpieza');
  ok(p0 && p0.p === 60, '1 · nombrarla la acerca (60)');
  c.reloj.ms += 60 * 60000;
  const p1 = X.amanoCerca_(JUAN).find((x) => x.clave === 'limpieza');
  ok(!p1, '1 · una hora después baja a la mitad (30) y ya no está cerca');
  X.amanoHerramienta_(JUAN, 'ruta_del_dia', {});
  ok(X.amanoCerca_(JUAN).some((x) => x.clave === 'limpieza' && x.p === 80), '1 · una herramienta de limpieza la vuelve a acercar (30 + 50)');
  X.amanoSentir_(JUAN, 'Escríbele al socio de Edificio A 101');
  ok(X.amanoCerca_(JUAN).some((x) => x.clave === 'socio?' && /Edificio A 101/.test(x.q)), '1 · un socio queda «por ubicar» con lo que dijo');
  const m = caja({ hora: '08:00' });
  ok(m.X.amanoCerca_(JUAN).some((x) => x.clave === 'limpieza' && x.p >= 60), '1 · por la mañana la limpieza del principal está cerca sin nombrarla');
}

/* 2 · El paquete de limpieza */
{ const c = caja(), X = c.X, p = X.amanoLimpieza_();
  ok(p && /Hoy: 3 trabajos con 2 personas \(Técnica 2, Técnico 1\)/.test(p.corto), '2 · hoy: cuántos trabajos y quién (' + (p && p.corto.slice(0, 80)) + ')');
  ok(/1 hecha/.test(p.corto) && /1 tentativa/.test(p.corto), '2 · cómo va: hechas y tentativas');
  ok(/1 tarea vencida o de hoy/.test(p.corto), '2 · problemas: la tarea que vence hoy');
  ok(/Hoy 1 llegada y 1 salida/.test(p.corto), '2 · llegadas y salidas de la hoja, sin las canceladas');
  ok(p.detalle.some((l) => /Técnica Uno: 10:00 limpieza de salida en Edificio A 101; 12:00 .* \(tentativa\)/.test(l)), '2 · el detalle por persona, con hora y tentativa');
  ok(!/Mañana/.test(p.corto), '2 · antes de las 7 p. m. no dice la de mañana');
  ok(p.de === X.__epi.ts, '2 · el dato es de la hora de la copia de Epi');
  const n = caja({ hora: '20:00' }).X.amanoLimpieza_();
  ok(/Mañana: 1 trabajo con 1 persona/.test(n.corto), '2 · desde las 7 p. m. también la de mañana');
  c.props.RED_SAL_ULTIMA = JSON.stringify({ fecha: HOY, ts: X.__epi.ts, ok: true, faltan: [{ propiedad: 'Edificio E 505', propuesta: '' }] });
  ok(/1 salida sin limpieza confirmada hoy/.test(X.amanoLimpieza_().corto), '2 · la red de salidas: salida sin limpieza');
}

/* 3 · Se rehace cuando cambia Epi; la calidad cuenta */
{ const c = caja(), X = c.X;
  const a = X.amanoPaquete_('limpieza', '', true), b = X.amanoPaquete_('limpieza', '', true);
  ok(a && b && a.hecho === b.hecho, '3 · con la misma copia de Epi no se rehace');
  c.reloj.ms += 10 * 60000; X.__epi = EPI(c.reloj.ms);
  X.amanoPaquete_('limpieza', '', true);
  c.reloj.ms += 10 * 60000; X.__epi = EPI(c.reloj.ms, [{ id: 's9', fecha: HOY, hora: '15:00', tipo: 'Repaso', propiedad: 'Edificio G 707', vendorEmail: 'dos@x', estado: 'confirmada' }]);
  const d = X.amanoPaquete_('limpieza', '', true), q = JSON.parse(c.props.AMANO_CALIDAD)[HOY];
  ok(/4 trabajos/.test(d.corto), '3 · con una copia nueva de Epi se rehace');
  ok(q.iguales === 1 && q.distintos === 1, '3 · calidad: una vez igual, una vez distinto');
}

/* 4 · La ficha de la llamada */
{ const c = caja(), X = c.X;
  ok(X.amanoFicha_(JUAN) === '', '4 · sin nada cerca, la ficha no cambia');
  X.amanoSentir_(JUAN, 'cómo va la limpieza'); X.amanoPaquete_('limpieza', '', true);
  const f = X.amanoFicha_(JUAN);
  ok(/A LA MANO/.test(f) && /Limpiezas y operación del día \(dato de las 15:00\)/.test(f), '4 · con la limpieza cerca, va en la ficha con su hora');
  ok(f.length <= X.AMANO_FICHA_MAX_ + 400, '4 · recortada (' + f.length + ' caracteres)');
  c.cache.AMANO_DUDA_limpieza = '1';
  ok(X.amanoFicha_(JUAN) === '', '4 · en duda (amano_prueba no coincidió), no se usa');
  delete c.cache.AMANO_DUDA_limpieza; c.reloj.ms += 50 * 60000;
  ok(X.amanoFicha_(JUAN) === '', '4 · con más de 45 min, no se usa');
}

/* 5 · a_mano */
{ const c = caja(), X = c.X;
  const r = X.amanoVoz_({ caller_id: '50255555555', tema: 'limpieza', que: '¿quién limpia hoy?' });
  ok(r.encontrado && /3 trabajos/.test(r.resumen) && /dato de las/.test(r.de), '5 · al administrador: el resumen y de cuándo es');
  ok(/Técnico Dos/.test(r.detalle), '5 · y el detalle');
  const n = X.amanoVoz_({ caller_id: '50211112222', tema: 'limpieza' });
  ok(!n.encontrado && !n.resumen, '5 · a quien no es administrador, nada');
  const s = X.amanoVoz_({ caller_id: '50255555555', tema: 'socio', que: 'socio del 999' });
  ok(!s.encontrado && /secretaria/.test(s.resultado), '5 · sin paquete: que use la secretaria');
  ok(X.amanoCerca_(JUAN).some((x) => x.clave === 'limpieza'), '5 · usar a_mano acerca el tema');
  X.__epi = null; c.cache = {};
  const v = caja(); v.X.__epi = null;
  ok(!v.X.amanoVoz_({ caller_id: '50255555555', tema: 'limpieza' }).encontrado, '5 · sin copia de Epi no inventa');
}

/* 6 · El bloque del chat */
{ const c = caja(), X = c.X;
  X.amanoSentir_(JUAN, 'la ruta de hoy'); X.amanoPaquete_('limpieza', '', true);
  ok(/A LA MANO/.test(X.amanoBloque_(JUAN, '¿y quién limpia el 202?')), '6 · el mensaje nombra la limpieza: va el paquete');
  ok(X.amanoBloque_(JUAN, 'mándale un correo a Pedro') === '', '6 · otro tema: nada');
  ok(/A LA MANO para lo que siga/.test(X.amanoParaSecretaria_(JUAN, 'Revisar las limpiezas de hoy')), '6 · al resultado de la secretaria de limpieza se le suma el paquete');
}

/* 7 · Medición */
{ const t = (min) => new Date(Date.parse(HOY + 'T14:00:00Z') + min * 60000).toISOString();
  const op = [
    { ts: t(0), usuario: 'j', de: 'yo', canal: 'llamada', texto: 'Revisar las limpiezas de hoy', id: 'op1' },
    { ts: t(0.25), usuario: 'j', de: 'alma', canal: 'llamada', texto: 'Hay 3…', id: 'op2' },
    { ts: t(1), usuario: 'j', de: 'yo', canal: 'llamada', texto: 'Envía a Ana que llego tarde', id: 'op3' },
    { ts: t(1.5), usuario: 'j', de: 'alma', canal: 'llamada', texto: 'Listo', id: 'op4' },
    { ts: t(2), usuario: 'j', de: 'yo', canal: 'llamada', texto: 'transcripción', id: 'oplXYZ_3' } ];
  const c = caja({ op }), m = c.X.amanoMedir_(3), d = m.por_dia.find((x) => x.dia === HOY);
  ok(d && d.pedidos === 2 && d.leer_tema === 1 && d.s_prom_leer_tema === 15, '7 · cuenta los pedidos a la secretaria, los de leer un tema y sus segundos');
  ok(!/Ana|limpiezas de hoy/.test(JSON.stringify(m)), '7 · sin textos ni nombres');
}
process.exit(fallo);
