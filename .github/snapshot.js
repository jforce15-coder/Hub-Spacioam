/* Prueba del snapshot estilo Jarvis (apps-script/snapshot.js; Juan, 16-nov-2026) con dobles: sin Google, sin Hospitable y
   con una IA de mentira que cuenta sus llamadas.
   1. Huésped (reserva): con mensajes guardados, el tablero trae la experiencia con su riesgo y su porqué, lo que le
      molesta y lo que lo tiene feliz, el problema y lo que estamos haciendo, la conversación en dos líneas y lo importante
      arriba (destacado): por lo menos 5 piezas además de la foto. Total con «por noche».
   2. Cupo: la lectura se pide UNA vez; el mismo tablero otra vez no gasta IA; un mensaje nuevo sí. Con la pantalla
      bloqueada (no se va a ver) no se pide; un apartamento solo usa la lectura que ya está en la caché.
   3. Sin inventar: sin mensajes del huésped no hay lectura; si la IA falla o devuelve basura, no hay termómetro ni ánimo
      (salvo señales ciertas del Hub: una promesa vencida baja la experiencia y lo dice). Nunca un código, una clave, un
      teléfono ni un correo, aunque la IA los repita.
   4. Conversación: también es tablero (foto, estadía, mensajes, lo último que dijo y la lectura).
   5. Apartamento y edificio: cifras grandes (ocupación de 30 días, esta noche, movimientos) y lo importante arriba.
   6. Socio: lo importante arriba (lo que espera tu opinión primero).
   7. Recepción: buscar_contacto con UNA recepción → su tablero (llegadas de hoy, si su registro le llegó, lo último que
      escribió, sin su número). Proyecto de Grow: UN proyecto → su tablero (etapa, lo que sigue, el camino, avance).
   8. La app de antes no recibe «recepcion» ni «proyecto» en pantalla (TV_TIPOS_AVISO_), y alma/inicio.html pinta las piezas
      nuevas (termómetro, ánimo, foco, cifras y destacado) con entrada escalonada y sin movimiento si el teléfono lo pide.
   node .github/snapshot.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const HOY = '2026-11-16';
function caja(o) {
  o = o || {};
  const cache = {}, ia = [];
  const fmt = (d, tz, f) => { const g = new Date(d.getTime() - 6 * 3600e3), p = (n) => String(n).padStart(2, '0');
    if (f === 'yyyy-MM-dd') return g.getUTCFullYear() + '-' + p(g.getUTCMonth() + 1) + '-' + p(g.getUTCDate());
    if (f === 'H:mm') return g.getUTCHours() + ':' + p(g.getUTCMinutes()); return g.toISOString(); };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, isFinite,
    Date: class extends Date { constructor(...a) { if (!a.length) super(HOY + 'T16:00:00Z'); else super(...a); } static now() { return Date.parse(HOY + 'T16:00:00Z'); } },
    CFG: { TZ: 'America/Guatemala', TAB_RESERVAS: 'Reservas', MODELO_CLASIFICADOR: 'modelo-de-prueba' },
    Utilities: { formatDate: fmt },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; }, getAll: (ks) => { const r = {}; ks.forEach((k) => { if (k in cache) r[k] = cache[k]; }); return r; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (o.props || {})[k] || null }) },
    s_: (v) => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    norm_: (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(),
    fin8_: (t) => String(t || '').replace(/\D/g, '').slice(-8),
    leerTabla_: () => o.reservas || [], hubInbox_: () => o.inbox || [],
    hubPromesas_: () => ({ ok: true, promesas: o.promesas || [] }),
    temaFilas_: () => o.temas || [],
    hiloCacheGet_: (id, fresco) => (o.hilos || {})[id] || null,
    recepcionEstados_: (codes) => ({ ok: true, estados: o.recep || {} }),
    claude_: (modelo, max, sys, user) => { ia.push({ modelo, user }); return typeof o.ia === 'function' ? o.ia(user) : (o.ia || ''); },
    adminPorTel_: () => null, AGENTE_CANAL_: 'llamada',
    fecha_: (v) => String(v || '').slice(0, 10), canalPlat_: (p) => String(p || '')
  };
  vm.createContext(ctx);
  ['calprops.js', 'episnap.js', 'tarjeta.js', 'fichasocio.js', 'snapshot.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx));
  return { X: ctx, cache, ia };
}
const ids = (t) => (t.cuadros || []).map((c) => c.id);
const de = (t, id) => (t.cuadros || []).filter((c) => c.id === id)[0];
const ver = (t) => JSON.stringify(t, (k, v) => (k === 'clave' ? undefined : v));   // la clave interna no se ve
const SECRETO = /\+?502\s?\d{4}|\b\d{8}\b|@|c[oó]digo \d|clave|wifi/i;
const cual = (t) => { const v = ver(t), i = v.search(SECRETO); return i < 0 ? '' : v.slice(Math.max(0, i - 40), i + 20); };

const RES = { code: 'HMSNAP0001', guest_first_name: 'Lucía', guest_last_name: 'Prado', property_name: 'Z10 - Brunelo - 1203', checkin_date: '2026-11-15', checkout_date: '2026-11-19', status: 'accepted', total: 480, platform: 'airbnb' };
const X0 = { codigo: 'HMSNAP0001', huesped: 'Lucía Prado', propiedad: 'Z10 - Brunelo - 1203', entrada: '2026-11-15', salida: '2026-11-19', huespedes: '2', estado: 'confirmada', registro: 'completo' };
const INB = [{ conv_id: 'r-snap', codigo: 'HMSNAP0001', huesped: 'Lucía Prado', propiedad: 'Z10 - Brunelo - 1203', checkin: '2026-11-15', checkout: '2026-11-19', canal: 'airbnb',
  ultimo_de: 'guest', ultimo_texto: 'El agua caliente sigue sin funcionar', ultimo_ts: '2026-11-16T14:10:00Z', ultimo_guest_ts: '2026-11-16T14:10:00Z' }];
const HILO = [
  { tipo: 'guest', texto: 'Hola, ya llegamos, ¡el apartamento está precioso!', created: '2026-11-15T21:00:00Z' },
  { tipo: 'host', texto: '¡Qué bueno! Bienvenidos.', created: '2026-11-15T21:05:00Z' },
  { tipo: 'guest', texto: 'El agua caliente no funciona en la ducha', created: '2026-11-16T13:00:00Z' },
  { tipo: 'host', texto: 'Gracias por avisarnos, mandamos al técnico hoy a las 3.', created: '2026-11-16T13:10:00Z' },
  { tipo: 'guest', texto: 'El agua caliente sigue sin funcionar', created: '2026-11-16T14:10:00Z' }
];
const LECTURA = JSON.stringify({ resumen: 'Llegaron felices; desde la mañana reclaman el agua caliente y esperan al técnico.', molesta: ['El agua caliente de la ducha', 'Esperar al técnico', 'Su número es +502 5555 0101'],
  feliz: ['El apartamento le encantó', 'La bienvenida'], experiencia: 'regular', riesgo_resena: 'medio', porque: 'Una falla abierta desde la mañana.', problema: 'No hay agua caliente en la ducha.',
  destacado: 'Le encantó el apartamento, pero el agua caliente sigue fallando.' });
const PROM = [{ conv_id: 'r-snap', codigo: 'HMSNAP0001', propiedad: 'Z10 - Brunelo - 1203', que: 'Técnico del agua caliente hoy a las 3', vence: '2026-11-16T21:00:00Z', estado: 'abierta' }];

/* 1 · huésped completo */
{ const { X, ia } = caja({ reservas: [RES], inbox: INB, hilos: { 'r-snap': HILO }, promesas: PROM, ia: 'Aquí va: ' + LECTURA });
  const t = X.tvReserva_(RES, X0, INB);
  const nuevas = ['experiencia', 'foco', 'animo', 'conversacion'];
  ok(nuevas.every((k) => ids(t).includes(k)), '1 · reserva: experiencia, foco, ánimo y conversación: ' + ids(t).join(','));
  ok(ids(t).filter((k) => k !== 'foto').length >= 5, '1 · por lo menos 5 piezas además de la foto (' + (ids(t).length - 1) + ')');
  const e = de(t, 'experiencia');
  ok(e.tipo === 'termometro' && e.v === 'Hay que cuidarla' && e.tono === 'aviso' && e.riesgo === 'Medio' && /falla abierta/.test(e.porque) && e.nivel > 0 && e.nivel < 100, '1 · termómetro: experiencia, riesgo de mala reseña y su porqué');
  const a = de(t, 'animo');
  ok(a.molesta.length === 2 && a.feliz.length === 2 && /agua caliente/.test(a.molesta[0]), '1 · lo que le molesta y lo que lo tiene feliz (sin el punto con un teléfono)');
  const f = de(t, 'foco');
  ok(/agua caliente/.test(f.problema) && f.acciones[0].t === 'Promesa' && /Técnico/.test(f.acciones[0].v), '1 · el problema y lo que estamos haciendo (su promesa)');
  ok(t.destacado && /encantó/.test(t.destacado.texto), '1 · lo importante arriba (destacado)');
  ok(/por noche/.test(de(t, 'pago').d) && de(t, 'pago').d === 'US$ 120 por noche', '1 · total con lo que deja por noche');
  ok(!SECRETO.test(ver(t)), '1 · nada de teléfonos, correos, códigos ni claves en lo que se ve ' + cual(t));
  ok(t.datos.some((d) => /Experiencia: Hay que cuidarla · riesgo de mala reseña medio/.test(d)) && /experiencia\)$/.test(t.resumen), '1 · la app de antes lo ve en sus líneas y la voz sabe que se ve la experiencia');
  ok(ia.length === 1 && ia[0].modelo === 'modelo-de-prueba' && /HUÉSPED/.test(ia[0].user), '1 · una lectura con el modelo del Hub');
/* 2 · cupo */
  X.tvReserva_(RES, X0, INB);
  ok(ia.length === 1, '2 · el mismo tablero otra vez no gasta IA (caché)');
}
{ const hilos = { 'r-snap': HILO.slice() }; const { X, ia } = caja({ reservas: [RES], inbox: INB, hilos, ia: LECTURA });
  X.tvReserva_(RES, X0, INB); hilos['r-snap'] = HILO.concat([{ tipo: 'guest', texto: 'Ya funciona, ¡gracias!', created: '2026-11-16T15:30:00Z' }]); X.tvReserva_(RES, X0, INB);
  ok(ia.length === 2, '2 · un mensaje nuevo sí vuelve a leer');
}
{ const { X, ia } = caja({ reservas: [RES], inbox: INB, hilos: { 'r-snap': HILO }, ia: LECTURA });
  X.TV_SIN_PEDIR_ = true; const t = X.tvReserva_(RES, X0, INB); X.TV_SIN_PEDIR_ = false;
  ok(ia.length === 0 && !ids(t).includes('animo'), '2 · con la pantalla bloqueada (no se va a ver) no se pide IA');
}
/* 3 · sin inventar */
{ const { X, ia } = caja({ reservas: [RES], inbox: [], ia: LECTURA });
  const t = X.tvReserva_(RES, X0, []);
  ok(ia.length === 0 && !['experiencia', 'animo', 'conversacion', 'foco'].some((k) => ids(t).includes(k)), '3 · sin mensajes del huésped: sin lectura ni termómetro');
}
{ const { X } = caja({ reservas: [RES], inbox: INB, hilos: { 'r-snap': HILO }, ia: 'no sé' });
  const t = X.tvReserva_(RES, Object.assign({}, X0), INB.map((x) => Object.assign({}, x, { ultimo_de: 'host' })));
  ok(!ids(t).includes('animo') && !ids(t).includes('experiencia'), '3 · si la IA devuelve basura: nada inventado');
}
{ const { X } = caja({ reservas: [RES], inbox: INB, promesas: [Object.assign({}, PROM[0], { estado: 'vencida' })], ia: '' });
  const t = X.tvReserva_(RES, X0, INB), e = de(t, 'experiencia');
  ok(e && e.tono === 'alerta' && e.riesgo === 'Medio' && /se venció/.test(e.porque) && t.destacado.tono === 'alerta', '3 · sin lectura, una promesa vencida baja la experiencia y lo dice');
}
{ const { X } = caja({ reservas: [RES], inbox: INB, hilos: { 'r-snap': HILO }, ia: JSON.stringify({ resumen: 'Pidió el código 482913 de la puerta y la clave del wifi', molesta: ['Escríbanle a lucia@correo.com'], feliz: ['Llamar al 5555-0101 ya'], experiencia: 'buena', riesgo_resena: 'bajo', problema: 'El wifi: clave Brunelo2026', destacado: 'Su teléfono es 50255550101' }) });
  const t = X.tvReserva_(RES, X0, INB);
  ok(!SECRETO.test(JSON.stringify(t.cuadros)) && !SECRETO.test(JSON.stringify(t.destacado || '')), '3 · aunque la IA repita un código, un correo o un teléfono, no sale');
}
/* 4 · conversación */
{ const { X } = caja({ inbox: INB, hilos: { 'r-snap': HILO }, promesas: PROM, ia: LECTURA });
  const t = X.tvConversacion_('r-snap', HILO, PROM, INB);
  ok(t.cuadros && ['foto', 'fechas', 'mensajes', 'ultimo', 'experiencia', 'animo'].every((k) => ids(t).includes(k)) && t.cabeza === 'Conversación con Lucía Prado', '4 · la conversación es tablero: ' + ids(t).join(','));
  ok(de(t, 'mensajes').v === '5' && /sigue sin funcionar/.test(de(t, 'ultimo').texto) && t.mensajes.length === 3, '4 · cuántos mensajes y lo último que dijo; la app de antes sigue con los mensajes');
}
/* 5 · apartamento y edificio */
const RES2 = { code: 'HMSNAP0002', guest_first_name: 'Tomás', guest_last_name: 'Ríos', property_name: 'Z10 - Brunelo - 1102', checkin_date: '2026-11-16', checkout_date: '2026-11-18', status: 'accepted' };
{ const { X, ia } = caja({ reservas: [RES, RES2], inbox: INB, hilos: { 'r-snap': HILO }, ia: LECTURA });
  const t = X.tvApartamento_('Z10 - Brunelo - 1203', {}, {});
  const c = de(t, 'cifras');
  ok(c && c.tipo === 'cifras' && c.items[0].k === 'Ocupación' && c.items[0].v === '10%' && c.items[2].v === 'Ocupado', '5 · apartamento: cifras (ocupación de 30 días, llegadas, hoy)');
  ok(t.destacado && /Lucía Prado está hoy/.test(t.destacado.texto), '5 · apartamento: lo importante arriba');
  ok(ia.length === 0 && !ids(t).includes('experiencia'), '5 · apartamento: sin lectura en caché no gasta IA');
  X.tvReserva_(RES, X0, INB); const t2 = X.tvApartamento_('Z10 - Brunelo - 1203', {}, {});
  ok(ia.length === 1 && de(t2, 'experiencia') && /Huésped de hoy · Lucía/.test(de(t2, 'experiencia').k), '5 · apartamento: con la lectura ya guardada, la experiencia de su huésped de hoy');
  const ed = X.tvEdificio_({ zona: 'Z10', edificio: 'Brunelo', props: ['Z10 - Brunelo - 1102', 'Z10 - Brunelo - 1203'] });
  const ce = de(ed, 'cifras');
  ok(ce && ce.items[0].k === 'Esta noche' && ce.items[0].v === '100%' && /1 llegan/.test(ce.items[2].d) && ed.destacado && /2 de 2/.test(ed.destacado.texto), '5 · edificio: esta noche, 30 días, movimientos y lo importante arriba');
}
/* 6 · socio */
{ const { X } = caja({});
  const t = { cuadros: [{ id: 'foto', tipo: 'foto' }, { id: 'pedidos', tipo: 'lista', items: [{ t: 'Abierto', v: 'Cambiar la cortina' }, { t: 'Tu opinión', v: 'Subir el precio de diciembre' }] }] };
  X.jvSocio_(t);
  ok(t.destacado && /Espera tu opinión: Subir el precio/.test(t.destacado.texto) && t.destacado.tono === 'aviso' && de(t, 'pedidos').k === 'Lo que estamos atendiendo', '6 · socio: lo que espera tu opinión, arriba');
}
/* 7 · recepción y proyecto */
{ const RES3 = Object.assign({}, RES2, { code: 'HMSNAP0003', guest_first_name: 'Ana', guest_last_name: 'Sol', property_name: 'Z10 - Brunelo - 1203', checkin_date: '2026-11-16', checkout_date: '2026-11-17' });
  const { X } = caja({ reservas: [RES2, RES3], inbox: [{ conv_id: 'wa:50255551234', tipo: 'recepcion', propiedad: 'Recepción · Brunelo', huesped: 'Recepción Brunelo', ultimo_texto: 'Recibido, gracias. Llámenme al 5555-1234', ultimo_ts: '2026-11-16T15:00:00Z' }],
    recep: { HMSNAP0002: { e: 'leido' }, HMSNAP0003: { e: 'no_entregado' } } });
  X.tvCandidataContacto_({}, [{ tipo: 'recepcion', nombre: 'Recepción Brunelo', tel: '50255551234', propiedades: 'Z10 - Brunelo - 1102', estado: 'Sin pendientes', resumen: '· Portería 24 h · Recibe los registros por WhatsApp' }], null);
  const c = X.TV_CANDIDATA_;
  ok(c && c.tipo === 'recepcion', '7 · buscar_contacto con UNA recepción: su tablero');
  const t = c.hacer(), r = de(t, 'registros');
  ok(t.titulo === 'Recepción Brunelo' && r.items.length === 2 && r.items.some((x) => x.t === 'Leído') && r.items.some((x) => x.t === 'No llegó' && x.tono === 'alerta'), '7 · recepción: llegadas de hoy y si su registro le llegó');
  ok(t.destacado.tono === 'alerta' && /no le llegó/.test(t.destacado.texto) && de(t, 'experiencia') && /Lo último que escribió/.test(de(t, 'ultimo').k), '7 · recepción: lo importante arriba, cómo va y lo último que escribió');
  ok(!SECRETO.test(ver(t)), '7 · recepción: nunca su número ' + cual(t));
  const P = { ok: true, proyectos: [{ id: 'p42', edificio: 'Torre Prueba', apto: '804', etapa: 'presupuesto', zona: 'Z14', dueno: 'Marta Prueba +502 5555 0199', visita: { fecha: '2026-11-18', asignado: 'Gabriel Prueba', completa: false } }] };
  X.jvCandidataGrow_(P); const g = X.TV_CANDIDATA_;
  ok(g && g.tipo === 'proyecto', '7 · grow_proyectos con UN proyecto: su tablero');
  const pt = g.hacer();
  ok(pt.titulo === 'Torre Prueba 804' && de(pt, 'etapa').v === 'Presupuesto' && /Visita/.test(de(pt, 'sigue').v) && de(pt, 'camino').items.some((x) => x.h === 'Ahora' && x.t === 'Presupuesto') && /%$/.test(de(pt, 'avance').items[0].v), '7 · proyecto: etapa, lo que sigue, el camino y el avance');
  ok(!SECRETO.test(ver(pt)), '7 · proyecto: sin el teléfono del dueño ' + cual(pt));
  X.TV_CANDIDATA_ = null; X.jvCandidataGrow_({ ok: true, proyectos: [P.proyectos[0], Object.assign({}, P.proyectos[0], { id: 'p43' })] });
  ok(!X.TV_CANDIDATA_, '7 · varios proyectos: ninguno (las listas no son tarjetas)');
  ok(['recepcion', 'proyecto'].every((k) => X.TV_TIPOS_AVISO_.indexOf(k) >= 0) && /recepción/i.test(X.tvLineaChat_(JSON.stringify({ tipo: 'recepcion', titulo: 'Recepción Brunelo' }))), '8 · la app de antes no los recibe en pantalla; el chat los nombra');
}
/* 8 · la página los pinta */
{ const H = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
  ok(['termometro', 'animo', 'foco', 'cifras'].every((k) => new RegExp('c\\.tipo === "' + k + '"').test(H)) && /t\.destacado/.test(H), '8 · inicio pinta termómetro, ánimo, foco, cifras y destacado');
  ok(/\.tvb-term/.test(H) && /\.tvb-cif/.test(H) && /prefers-reduced-motion: reduce\) \{[^}]*\.tvb-term/.test(H), '8 · con su estilo y quietos si el teléfono lo pide');
  ok(/recepcion: "Recepción"/.test(H) && /proyecto: "Proyecto"/.test(H) && /"recepcion", "proyecto"\]/.test(H), '8 · los nombres y el modo compañero conocen recepción y proyecto');
}
if (fallo) process.exit(1);
console.log('Snapshot bien.');
