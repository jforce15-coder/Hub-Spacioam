/* Prueba de los «Pedidos en órbita» (#509 T3, apps-script/orbita.js y alma/inicio.html) con dobles: sin hoja, sin Claude.
   Juan, 13-nov-2026: lo que Alma sigue trabajando en segundo plano se ve como anillos que orbitan la roca; la órbita
   cercana para lo rápido y la lejana para lo largo; al terminar, check y se va a los 8 s; sin porcentajes inventados.
   1. La lista: lo de segundo plano (llamada, Modo calle, en segundo plano) es «rapido»; lo de desarrollo (pedido a Claude
      en trabajo, o lo que Alma escaló y une sola) es «largo». Solo lo de quien pregunta; desarrollo, solo del principal.
   2. El paso sale de la herramienta que Alma usa («Revisando», «Redactando», «Agendando»), nunca un porcentaje.
   3. Terminado → «listo» (o «fallo») con su hora, y a los 10 min ya no viene. Un «en curso» de hace más de 15 min no viene.
   4. Nunca datos sensibles: ni teléfonos, ni correos, ni enlaces, ni códigos, ni el pedido completo; solo los campos
      id, nombre, paso, tipo, estado, desde y fin. Sin sesión de administrador, nada.
   5. Los ganchos: vozSecEncolar_ y vozSeguirGuardar_ lo anotan, el bucle del agente pone el paso, al terminar se cierra,
      la acción pedidosOrbita existe y cuenta en el canal «inicio».
   7. El nombre es un título de 2 o 3 palabras (Juan, 14-nov-2026): lo escribe el modelo una vez por pedido (caché), máximo
      3 nuevos por consulta; si no responde o responde algo largo, las primeras 3 palabras del pedido.
   6. La pantalla: las dos órbitas alrededor de la roca, el check que se va a los 8 s, el contador con el tablero abierto y
      prefers-reduced-motion (sin giro, sin pulso, anillos quietos).
   7. Explicar (Juan, 14-nov-2026, #539): al tocar un anillo o preguntar por él, Alma cuenta qué pasó, qué se hizo y en qué
      estado va (pedidos_en_orbita → orbitaExplicar_). El detalle se queda en el Hub: nunca va en la lista de la app.
   node .github/orbita.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = { email: 'juan@x.com', nombre: 'Juan', principal: true, tels: ['50200000000'] };
const GABY = { email: 'gaby@x.com', nombre: 'Gabriel', principal: false, tels: ['50211111111'] };

function caja() {
  const cache = {}; let ahora = Date.parse('2026-11-13T15:00:00Z');
  const D = class extends Date { constructor(...a) { super(...(a.length ? a : [ahora])); } static now() { return ahora; } };
  const dobles = { escalar: [], micros: [], titulos: [], llamadas: 0 };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date: D, CFG: { TZ: 'America/Guatemala' },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 16), base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'), computeDigest: (a, t) => Array.from(require('crypto').createHash('md5').update(String(t)).digest()), DigestAlgorithm: { MD5: 'md5' } },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    vozColaLock_: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }),
    esAdminPrincipal_: a => !!(a && a.principal),
    vozWebAdmin_: ses => (ses && ses.email === JUAN.email ? JUAN : ses && ses.email === GABY.email ? GABY : null),
    CFG: { MODELO_CLASIFICADOR: 'modelo-rapido' },
    claude_: (modelo, max, sys, user) => { dobles.llamadas++; const t = dobles.titulos.filter(x => x[0].test(user))[0]; return t ? t[1] : ''; },
    escalarEntregas_: () => dobles.escalar, microFilas_: () => dobles.micros,
    MICRO_ESTADOS_: { trabajo: 'en trabajo', pregunta: 'Claude pregunta', listo: 'listo para unir', unido: 'unido', cerrado: 'cerrado' }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'orbita.js'), 'utf8'), ctx, { filename: 'orbita.js' });
  return { ctx, dobles, pasa: ms => { ahora += ms; }, ahora: () => ahora, limpiarCacheDesarrollo: () => Object.keys(cache).filter(k => /_d$/.test(k)).forEach(k => delete cache[k]) };
}

/* 1. La lista y la clasificación */
{
  const { ctx, dobles, ahora } = caja();
  dobles.titulos = [[/pagos de Amalfi/, 'Pagos de Amalfi'], [/limpieza/, 'Aviso a limpieza'], [/ocupación/, 'Reporte de ocupación']];
  const a = ctx.orbitaEmpieza_(JUAN.email, 'Alma, revisa los pagos de Amalfi de octubre', 'segundo_plano', 'En fila');
  const b = ctx.orbitaEmpieza_(JUAN.email, 'Escríbele al equipo de limpieza que mañana llegan temprano', 'segundo_plano');
  ctx.orbitaEmpieza_(GABY.email, 'Lo de Gabriel', 'segundo_plano');
  dobles.micros = [
    { id: 'mp1', nombre: 'Reporte de ocupación', estado: 'en trabajo', quien: JUAN.email, creado: ahora() - 3600000, actualizado: ahora() - 600000, ajustes: [{ ts: ahora() - 3600000, de: 'juan', texto: 'Hazme el reporte de ocupación del mes por edificio' }] },
    { id: 'mp2', nombre: 'Viejo sin noticias', estado: 'en trabajo', quien: JUAN.email, creado: ahora() - 3 * 86400000, actualizado: ahora() - 2 * 86400000, ajustes: [] },
    { id: 'mp3', nombre: 'Cerrado a mano', estado: 'cerrado', quien: JUAN.email, creado: ahora() - 3600000, actualizado: ahora() - 60000, ajustes: [{ ts: ahora() - 3600000, de: 'juan', texto: 'x' }] },
    { id: 'mp4', nombre: 'Escalado', estado: 'en trabajo', quien: JUAN.email, creado: ahora() - 600000, actualizado: ahora() - 600000, ajustes: [] }
  ];
  dobles.escalar = [{ id: 'esc1', micro: 'mp4', nombre: 'Contactos de recepción', email: JUAN.email, estado: 'publicando', t: ahora() - 1800000 }];
  const r = ctx.orbitaApi_({ email: JUAN.email }), l = r.pedidos, por = id => l.filter(x => x.id === id)[0];
  ok(r.ok && l.length === 4, 'Juan ve sus 4 pedidos en curso (2 de segundo plano, 1 a Claude, 1 escalado), no los de Gabriel ni los viejos: ' + l.map(x => x.nombre).join(' · '));
  ok(por(a) && por(a).tipo === 'rapido' && por(b).tipo === 'rapido', 'Lo de segundo plano va en la órbita cercana (rapido)');
  ok(l.filter(x => x.tipo === 'largo').length === 2, 'Lo de desarrollo va en la órbita lejana (largo)');
  ok(por(a).nombre === 'Pagos de Amalfi' && por(a).paso === 'En fila', 'Título corto del pedido («' + por(a).nombre + '») y su paso');
  ok(!l.some(x => /Viejo|Cerrado a mano/.test(x.nombre)), 'Un pedido a Claude sin noticias en 24 h o cerrado a mano no orbita');
  const esc = l.filter(x => x.nombre === 'Contactos de recepción')[0];
  ok(esc && esc.paso === 'Publicando' && l.filter(x => x.nombre === 'Escalado').length === 0, 'Lo que Alma escaló sale una vez, con su paso («Publicando»), no también como pedido a Claude');
  ok(!l.some(x => 'porcentaje' in x || 'progreso' in x || /%/.test(x.paso)), 'Sin porcentajes');
  const g = ctx.orbitaApi_({ email: GABY.email }).pedidos;
  ok(g.length === 1 && g[0].tipo === 'rapido', 'Gabriel ve solo lo suyo y nada de desarrollo (solo el principal)');
  ok(ctx.orbitaApi_(null).ok === false && ctx.orbitaApi_({ email: 'otro@x.com' }).ok === false, 'Sin sesión de administrador no devuelve nada');
}

/* 2. El paso */
{
  const { ctx } = caja();
  const id = ctx.orbitaEmpieza_(JUAN.email, 'Mándale a la huésped el código', 'segundo_plano');
  const paso = () => ctx.orbitaLista_(JUAN)[0].paso;
  ctx.ORBITA_ACTUAL_ = { email: JUAN.email, ids: [id] };
  ctx.orbitaPaso_('buscar_reservas'); const p1 = paso();
  ctx.orbitaPaso_('enviar_a_huesped'); const p2 = paso();
  ctx.orbitaPaso_('crear_evento'); const p3 = paso();
  ctx.orbitaPaso_('crear_tarea'); const p4 = paso();
  ctx.ORBITA_ACTUAL_ = null; ctx.orbitaPaso_('ver_agenda');
  ok(p1 === 'Revisando' && p2 === 'Redactando' && p3 === 'Agendando' && p4 === 'Actualizando' && paso() === 'Actualizando', 'El paso sigue a la herramienta: ' + [p1, p2, p3, p4].join(' → ') + ' (y fuera del segundo plano no cambia)');
}

/* 3. Terminado → listo y se va */
{
  const { ctx, pasa } = caja();
  const a = ctx.orbitaEmpieza_(JUAN.email, 'Revisa los pagos', 'segundo_plano'), b = ctx.orbitaEmpieza_(JUAN.email, 'Otra cosa', 'segundo_plano');
  pasa(90000); ctx.orbitaTermina_(JUAN.email, [a]); ctx.orbitaTermina_(JUAN.email, [b], 'error');
  let l = ctx.orbitaLista_(JUAN), x = l.filter(o => o.id === a)[0], y = l.filter(o => o.id === b)[0];
  ok(x && x.estado === 'listo' && x.fin > 0 && x.paso === 'Listo', 'Al terminar queda «listo» con su hora (la app pone el check)');
  ok(y && y.estado === 'fallo', 'Si falló, «fallo»');
  pasa(9 * 60000); ok(ctx.orbitaLista_(JUAN).length === 2, 'Sigue viniendo los primeros 10 min (por si la app estaba cerrada)');
  pasa(2 * 60000); ok(ctx.orbitaLista_(JUAN).length === 0, 'A los 10 min ya no viene');
  const c = ctx.orbitaEmpieza_(JUAN.email, 'Se cayó a medias', 'segundo_plano');
  pasa(16 * 60000); ok(!ctx.orbitaLista_(JUAN).some(o => o.id === c), 'Un «en curso» de hace más de 15 min ya no viene (Apps Script corta a los 6 min)');
}
{
  const { ctx, dobles, ahora } = caja();
  dobles.micros = [{ id: 'mp9', nombre: 'Uber con Alma', estado: 'listo para unir', quien: JUAN.email, creado: ahora() - 3600000, actualizado: ahora() - 120000, ajustes: [{ ts: ahora() - 120000, de: 'claude', texto: 'PR' }] }];
  dobles.escalar = [{ id: 'esc2', nombre: 'Contactos', email: JUAN.email, estado: 'entregada', t: ahora() - 7200000, fin: ahora() - 60000 }];
  const l = ctx.orbitaLista_(JUAN);
  ok(l.length === 2 && l.every(x => x.estado === 'listo' && x.tipo === 'largo'), 'Desarrollo: Claude respondió o Alma entregó hace poco → listo en la órbita lejana (' + l.map(x => x.paso).join(', ') + ')');
}

/* 4. Nunca datos sensibles */
{
  const { ctx } = caja();
  ctx.orbitaEmpieza_(JUAN.email, 'Mándale a ana.perez@correo.com y al +502 5555 1234 el código 4821 https://hub.spacioam.com/x?t=abc', 'segundo_plano');
  ctx.orbitaEmpieza_(JUAN.email, 'Llámale al 50255551234 por la reserva HMABCDE12345', 'segundo_plano');
  const s = JSON.stringify(ctx.orbitaApi_({ email: JUAN.email }));
  ok(!/@|https?:|5555|1234|4821|50255551234/.test(s), 'Ni correos, ni teléfonos, ni enlaces, ni códigos en lo que va a la app: ' + s.slice(0, 160));
  const campos = new Set(); ctx.orbitaLista_(JUAN).forEach(x => Object.keys(x).forEach(k => campos.add(k)));
  ok([...campos].every(k => ['id', 'nombre', 'paso', 'tipo', 'estado', 'desde', 'fin'].indexOf(k) >= 0), 'Solo id, nombre, paso, tipo, estado, desde y fin (nunca el pedido completo): ' + [...campos].join(', '));
  ok(ctx.orbitaLista_(JUAN).every(x => x.nombre.length <= 40), 'El nombre es corto');
}

/* 5. Los ganchos */
{
  const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
  const fn = (src, nombre) => { const i = src.indexOf('function ' + nombre + '('); if (i < 0) return ''; const j = src.indexOf('\nfunction ', i + 10); return src.slice(i, j < 0 ? undefined : j); };
  const voz = leer('voz.js'), ret = leer('retomar.js'), ag = leer('agente.js'), cod = leer('Código.js'), cupo = leer('cupo.js');
  ok(/orbitaEmpieza_\(/.test(fn(voz, 'vozSecEncolar_')) && /x\.orb = orb/.test(fn(voz, 'vozSecEncolar_')), 'vozSecEncolar_ anota el anillo y lo guarda con el pedido');
  ok(/ORBITA_ACTUAL_ = \{/.test(fn(voz, 'vozSecProcesar_')) && /orbitaTermina_\(/.test(fn(voz, 'vozSecProcesar_')), 'vozSecProcesar_ pone el paso y lo cierra al terminar');
  ok(/orbitaEmpieza_\(/.test(fn(ret, 'vozSeguirGuardar_')) && /orbitaTermina_\(/.test(fn(ret, 'vozSeguirPronto')), 'Lo que la llamada o el Modo calle dejan en segundo plano también orbita y se cierra');
  ok(/orbitaPaso_\(u\.name\)/.test(fn(ag, 'opAgenteBucle_')), 'El bucle del agente pone el paso antes de cada herramienta');
  ok(/case 'pedidosOrbita': return json_\(orbitaApi_\(ses\)\)/.test(cod) && /\bpedidosOrbita\b/.test(cupo), 'La acción pedidosOrbita existe con sesión y cuenta en el canal «inicio»');
}

/* 7. Título de 2 o 3 palabras */
{
  const { ctx, dobles, ahora, limpiarCacheDesarrollo } = caja();
  dobles.titulos = [[/orbitan la roca/, 'Títulos en órbita'], [/mensajes programados/, 'Claro, aquí tienes un buen título para este pedido']];
  const pedido = 'En las notificaciones que orbitan la roca, generar y mostrar un título corto de dos o tres palabras como máximo en lugar del texto completo';
  dobles.micros = [{ id: 'mp7', nombre: 'En las notificaciones que orbitan', estado: 'en trabajo', quien: JUAN.email, creado: ahora() - 60000, actualizado: ahora() - 60000,
    ajustes: [{ ts: ahora() - 60000, de: 'juan', texto: pedido }] }];
  const id = ctx.orbitaEmpieza_(JUAN.email, 'Revisa los mensajes programados de mañana para recepción', 'segundo_plano');
  let l = ctx.orbitaLista_(JUAN), m = l.filter(x => x.id === 'mpmp7')[0], s2 = l.filter(x => x.id === id)[0];
  ok(m && m.nombre === 'Títulos en órbita', 'Pedido a Claude: título del modelo hecho con el pedido completo («' + (m && m.nombre) + '»), no «En las notificaciones que orbitan»');
  ok(s2 && s2.nombre === 'Revisa los mensajes programados'.split(' ').slice(0, 3).join(' ') && s2.nombre.split(' ').length <= 3, 'Si el modelo responde algo largo, las primeras 3 palabras («' + (s2 && s2.nombre) + '»)');
  const n = dobles.llamadas; limpiarCacheDesarrollo(); ctx.orbitaLista_(JUAN); ctx.orbitaLista_(JUAN);
  ok(n === 2 && dobles.llamadas === 2, 'El título se pide una vez por pedido y queda guardado (' + dobles.llamadas + ' llamadas)');
  for (let i = 0; i < 6; i++) ctx.orbitaEmpieza_(JUAN.email, 'Pedido distinto número ' + 'abcdef'[i], 'segundo_plano');
  const antes = dobles.llamadas; ctx.orbitaLista_(JUAN);
  ok(dobles.llamadas - antes === 3, 'Máximo 3 títulos nuevos por consulta (la app no espera de más): ' + (dobles.llamadas - antes));
  ok(ctx.orbitaLista_(JUAN).every(x => x.nombre.split(/\s+/).length <= 3), 'Todos los nombres tienen 3 palabras o menos');
  const sinModelo = caja(); delete sinModelo.ctx.claude_;
  sinModelo.ctx.orbitaEmpieza_(JUAN.email, 'Alma, revisa los pagos de Amalfi de octubre', 'segundo_plano');
  ok(sinModelo.ctx.orbitaLista_(JUAN)[0].nombre === 'Revisa los pagos', 'Sin modelo: las primeras 3 palabras («' + sinModelo.ctx.orbitaLista_(JUAN)[0].nombre + '»)');
}

/* 6. La pantalla */
{
  const h = fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8');
  ok(/id="pob"/.test(h) && /window\.AlmaOrbita\s*=/.test(h) && /hub\("pedidosOrbita"\)/.test(h), 'El inicio tiene la órbita y le pregunta al Hub con pedidosOrbita');
  ok(/pob-orb cerca/.test(h) && /pob-orb lejos/.test(h) && /tipo === "largo"/.test(h), 'Dos órbitas: cercana (rápido) y lejana (largo)');
  ok(/SALE_MS = 8000/.test(h) && /MARCA\[/.test(h), 'Al terminar: check y se va a los 8 s');
  ok(/classList\.contains\("tvb-on"\)[^\n]*return "contador"/.test(h), 'Con el tablero abierto, un contador junto a la roca');
  const rm = (h.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.pob-s[^}]*animation: none;/) || [])[0] || '';
  ok(/\.pob-s \.resp/.test(rm) && /svg\.arco/.test(rm) && /angulo\(x, now\) \{ return RM \? x\.a0/.test(h), 'prefers-reduced-motion: sin giro, sin pulso y los anillos quietos en su lugar');
  ok(/x\.a0 \+ 2 \* Math\.PI \* \(\(now - x\.nace\) \/ x\.per\)/.test(h), 'Los anillos giran conforme a las agujas del reloj (el ángulo sube; en pantalla la «y» va hacia abajo)');
  ok(/AV\.a0 \+ 2 \* Math\.PI \* \(\(now - AV\.nace\) \/ AV\.per\)/.test(h), 'El avión de «Tu viaje» gira en el mismo sentido que los pedidos (a favor de las agujas del reloj)');
  ok(/dataset\.orbita = !vs\.length \? "" : proximo\(vs\) \? "cerca" : "lejos"/.test(h) && /o === "lejos" \? "largo" : "rapido"/.test(h) && /andar: andar/.test(h),
    'El avión de «Tu viaje» orbita: viaje por venir o en curso en la cercana, ya pasado en la lejana');
  const ini = h.indexOf('Pedidos en órbita (#509 T3, Juan'), mod = h.slice(ini, h.indexOf('window.AlmaOrbita', ini));   // el bloque del avión también nombra AlmaOrbita, antes
  ok(mod.length > 1000 && !/\+ ?"%"|"%"|progreso|porcentaje\s*[:=]/.test(mod.replace(/\/\*[\s\S]*?\*\//g, '')), 'La pantalla no inventa porcentajes (el arco gira, indeterminado)');
}

/* 7. Explicar: qué pasó, qué se hizo y en qué estado va */
{
  const { ctx, dobles, pasa, ahora } = caja();
  const a = ctx.orbitaEmpieza_(JUAN.email, 'Alma, revisa los pagos de Amalfi de octubre y avísale a Lucky', 'segundo_plano');
  ctx.orbitaEmpieza_(JUAN.email, 'Agenda la visita de Grow del lunes', 'segundo_plano');
  ctx.ORBITA_ACTUAL_ = { email: JUAN.email, ids: [a] };
  ctx.orbitaPaso_('buscar_reservas'); ctx.orbitaPaso_('escribir_a_equipo'); ctx.ORBITA_ACTUAL_ = null;
  pasa(60000);
  ctx.orbitaTermina_(JUAN.email, [a], '', { respuesta: 'Revisé los pagos: octubre está completo. Le escribí a Lucky.', hechas: [{ tipo: 'mensaje', resumen: 'Mensaje al equipo · Lucky' }] });
  let r = ctx.orbitaExplicar_(JUAN, 'Revisa los pagos de Amalfi'), x = r.pedidos[0];
  ok(r.ok && r.pedidos.length === 1 && x.nombre === 'Revisa los pagos de Amalfi', 'Busca el anillo por su nombre (el que se ve) y trae solo ese');
  ok(/pagos de Amalfi/.test(x.que_pidio) && x.pasos_que_dio.join() === 'Revisando,Redactando' && /Lucky/.test(x.lo_que_hizo[0]) && /octubre está completo/.test(x.lo_que_respondio),
    'Qué pasó (lo que pidió), qué se hizo (pasos y lo hecho) y lo que respondió');
  ok(x.estado === 'terminado' && x.que_falta === 'Nada' && x.termino, 'En qué estado va y qué falta');
  ok(/qué pasó.*qué se hizo.*estado/.test(r.nota), 'Le dice a Alma el orden para explicarlo');
  const app = JSON.stringify(ctx.orbitaApi_({ email: JUAN.email }));
  ok(!/pagos de Amalfi de octubre|Lucky|completo|Revisando,Redactando/.test(app), 'El detalle se queda en el Hub: la lista de la app sigue con nombre y paso nada más');
  pasa(30 * 60000);
  ok(ctx.orbitaLista_(JUAN).length === 0 && ctx.orbitaExplicar_(JUAN, 'pagos amalfi').pedidos.length === 1, 'Ya no orbita (10 min) pero se puede preguntar por él unas horas más');
  const v = ctx.orbitaExplicar_(JUAN, 'visita de Grow').pedidos[0];
  ok(v && v.estado === 'se quedó a medias' && /de nuevo/.test(v.que_falta), 'Un «en curso» que se cortó no se cuenta como si siguiera: «se quedó a medias»');
  ok(ctx.orbitaExplicar_(JUAN, '').pedidos.length === 2, 'Sin nombre: todos los de hoy');
  ok(ctx.orbitaExplicar_(GABY, 'pagos').pedidos.length === 0, 'Gabriel no ve lo de Juan');
  const f = ctx.orbitaEmpieza_(JUAN.email, 'Manda el reporte', 'segundo_plano'); ctx.orbitaTermina_(JUAN.email, [f], 'sin conexión', { respuesta: 'No pude.' });
  const y = ctx.orbitaExplicar_(JUAN, 'Manda el reporte').pedidos[0];
  ok(y.estado === 'no se pudo' && y.por_que_fallo === 'sin conexión' && /intenta de nuevo/.test(y.que_falta), 'Si falló: por qué y qué falta');
  dobles.micros = [{ id: 'mp7', nombre: 'Mensajes con fecha', estado: 'listo para unir', quien: JUAN.email, pr: 'https://github.com/x/y/pull/9', creado: ahora() - 7200000, actualizado: ahora() - 3600000,
    ajustes: [{ ts: ahora() - 7200000, de: 'juan', texto: 'Que los mensajes lleven la fecha' }, { ts: ahora() - 3600000, de: 'claude', texto: 'Listo: cada mensaje lleva su fecha.' }] }];
  const z = ctx.orbitaExplicar_(JUAN, 'mensajes con fecha').pedidos[0];
  ok(z && /desarrollo/.test(z.tipo) && /lleven la fecha/.test(z.que_pidio) && /lleva su fecha/.test(z.claude.claude_respondio) && /una/.test(z.que_falta),
    'Desarrollo de hace 1 h: lo que pidió, lo que respondió Claude y que falta unirlo');
}
{
  const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
  const ag = leer('agente.js'), rap = leer('rapido.js'), h = fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8'), nav = fs.readFileSync(path.join(RAIZ, 'js', 'sa-nav.js'), 'utf8');
  ok(/T\('pedidos_en_orbita'/.test(ag) && /case 'pedidos_en_orbita': return orbitaExplicar_\(adm, inp\.nombre\)/.test(ag) && /'pedidos_en_orbita'\]/.test(rap), 'Alma tiene la herramienta pedidos_en_orbita (también en el camino rápido de la llamada)');
  ok(/orbitaTermina_\(adm\.email, orbs, r\.fallo, r\)/.test(leer('voz.js')) && /orbitaTermina_\(adm\.email, \[o\.orb\], r\.fallo, r\)/.test(leer('retomar.js')), 'Al terminar se guarda lo que respondió (para explicarlo)');
  ok(/SANav\.chat\(\{ texto: pregunta\(x\) \}\)/.test(h) && /addEventListener\("click", toca\)/.test(h) && /\.pob\.orbita \.pob-s:not\(\.sale\) \.an/.test(h), 'Tocar un anillo abre el chat y le pregunta a Alma por ese pedido');
  ok(/if \(o\.texto\) chatEnviar\(o\.texto\)/.test(nav), 'SANav.chat({ texto }) manda la pregunta al abrir el chat');
}

process.exit(fallo);
