/* Recorte del prompt de voz (Juan, 21-nov-2026: «las tres partes de una vez, con prueba de calidad en cada parte»).
   Ninguna regla se borró: se movió al código o a la ficha de la llamada (apps-script/vozficha.js). Este check cuida que
   cada regla movida siga viva donde quedó, y que no vuelva al prompt general (sin red, con dobles de Google):
   A · guardas y `decir` de las herramientas (lookup_reservation, property_info, secretaria) y la ficha por número;
   B · lo de la app (B1) solo en la ficha de la app y lo de Juan (B2 + su formato) solo en la ficha de Juan (y Claudio);
   C · la lista de herramientas del prompt es solo su cabecera y cada herramienta de voz trae su descripción en el código.
   node .github/recorte-voz.js [carpeta apps-script] */
const path = require('path'), vm = require('vm');
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', 'apps-script'));
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const p = require('./prompts-armados.js').armar(DIR), ctx = p._ctx, R = c => vm.runInContext(c, ctx);
const sinFicha = (() => { const o = JSON.parse(p.voz[0]); delete o.ficha_de_quien_llama; return JSON.stringify(o); })();

/* ── El prompt general ya no trae lo que se movió ── */
['MÚSICA (solo caller_type juan', 'MOSTRAR EN EL CHAT (solo si', 'MANOS DE ALMA', 'ATAJOS DE iOS', 'MEJORAS DEL SISTEMA', 'DERIVAR A CLAUDIO',
  'AVÍSAME CUANDO', 'NUNCA lookup_reservation NI hospitable_router CON EL EQUIPO', 'Si secretaria devuelve ok:false', 'Nunca mandes un pedido en primer plano',
  'Si secretaria falla, no lo reintentes', 'Hay dos códigos distintos', 'lookup_reservation: Valida la reserva'].forEach(t =>
  ok(sinFicha.indexOf(t) < 0, 'el prompt de voz ya no trae «' + t + '» (vive en el código o en la ficha)'));

/* ── Dobles: quién llama, sin hojas ── */
const PPAL = { email: 'p@x', nombre: 'Juan', principal: true, tels: ['50200000001'] }, ADM = { email: 'a@x', nombre: 'Ana', principal: false, tels: ['50200000002'] };
let actual = {};
Object.assign(ctx, { contextoReciente_: () => null, mfBloque_: () => '', amanoFicha_: () => '', encargoAbierto_: () => null, vozMarcaPara_: () => '',
  fichaVozBloque_: () => '', paraClaudeNovedades_: () => '', opFilas_: () => [], adminsOp_: () => [PPAL, ADM], claudioResumen_: () => '', personalidadFicha_: () => null,
  adminPorTel_: t => [PPAL, ADM].find(a => a.tels[0] === String(t)) || null, normTel_: t => String(t || '').replace(/\D/g, ''), vozLookup_: () => actual });
const ficha = (r, tel) => { actual = r; return R('vozInicio_')({ caller_id: tel || '50299999999' }).dynamic_variables.quien_llama; };
const fJuan = ficha({ caller_type: 'juan', caller_name: 'Juan' }, '50200000001'), fAdm = ficha({ caller_type: 'equipo', caller_name: 'Ana' }, '50200000002');
const fTec = ficha({ caller_type: 'equipo', caller_name: 'Pedro' }), fDesc = ficha({ caller_type: 'externo' });
const fHues = ficha({ caller_type: 'externo', verified: true, code: 'X1', guest_name: 'A B', property: 'Z', check_in: '2026-11-26', check_out: '2026-11-29', today: '2026-11-21', stay: 'antes_del_checkin', momento: R('vozMomento_')('antes_del_checkin', '2026-11-26', '2026-11-29') });
ok(/SOLO CON JUAN/.test(fJuan) && /MEJORAS DEL SISTEMA/.test(fJuan) && /AVÍSAME CUANDO/.test(fJuan) && /DERIVAR A CLAUDIO/.test(fJuan), 'B2 · la ficha de Juan trae mejoras, derivar a Claudio y avísame cuando');
ok(/FORMATO CON JUAN/.test(fJuan) && /UNA decisión a la vez/.test(fJuan), 'formato de Juan · en su ficha (esfera y proyecto, una decisión a la vez)');
ok(/NUNCA lookup_reservation NI hospitable_router/.test(fJuan) && /NUNCA lookup_reservation NI hospitable_router/.test(fAdm), 'A1 · la ficha de un administrador prohíbe lookup_reservation y hospitable_router');
ok(!/SOLO CON JUAN/.test(fAdm) && !/FORMATO CON JUAN/.test(fAdm), 'B2 · otro administrador no recibe lo de Juan');
ok(!/CON UN ADMINISTRADOR/.test(fTec), 'A1 · alguien del equipo que no es administrador no recibe la regla de administrador');
ok(/PRIMERA acción/.test(fDesc) && /reconoces su número/.test(fDesc), 'A2 · número desconocido: lookup_reservation primero y para «¿reconoces mi número?»');
ok(/NO llames lookup_reservation/.test(fHues) && /Momento: Aún no llega/.test(fHues), 'A2 y A10 · huésped validado: ya identificado y su momento de la estadía');
const web = app => R('vozFichaWeb_')(PPAL, 'Juan', app, fJuan), wApp = web(true), wHub = web(false);
ok(/MÚSICA:/.test(wApp) && /MOSTRAR EN EL CHAT/.test(wApp) && /MANOS DE ALMA/.test(wApp) && /ATAJOS DE iOS/.test(wApp), 'B1 · en la app de Alma la ficha trae música, mostrar en el chat, manos y atajos');
ok(!/MOSTRAR EN EL CHAT/.test(wHub) && !/MANOS DE ALMA/.test(wHub), 'B1 · fuera de la app no van');
ok(wApp.split('CON UN ADMINISTRADOR').length === 2 && wApp.split('SOLO CON JUAN').length === 2, 'la ficha web no repite A1 ni B2');
const wAna = R('vozFichaWeb_')(ADM, 'Ana', true, fAdm);
ok(!/MÚSICA:/.test(wAna) && /MOSTRAR EN EL CHAT/.test(wAna), 'B1 · música solo con Juan; lo demás de la app, con cualquier administrador');
ok(/FORMATO CON JUAN/.test(R('claudioFicha_')(PPAL, 'Juan', '')), 'formato de Juan · también en la ficha de Claudio');

/* ── A9, A10, A11 · property_info y lookup_reservation ── */
const cp = R('vozCodigoPuerta_');
ok(/por la plataforma, un día antes/.test(cp('2026-11-26', '2026-11-21')) && !/WhatsApp/.test(cp('2026-11-26', '2026-11-21')), 'A9 · código de la cerradura: llega por la plataforma un día antes');
ok(/WhatsApp a este mismo número/.test(cp('2026-11-21', '2026-11-21')), 'A9 · con entrada hoy: si no lo ve, el equipo se lo envía por WhatsApp');
ok(/edificio/.test(cp('', '')) && /Nunca inventes/.test(cp('', '')), 'A9 · edificio y apartamento no se confunden; nunca inventar');
ctx.leerTabla_ = () => [];
ok(/Sin reserva validada/.test(R('vozPropertyInfo_')({ code: 'NADA' }).decir || ''), 'A11 · property_info sin reserva validada dice qué no se da');
ok(/Nunca coordines mantenimiento/.test(R('vozMomento_')('antes_del_checkin', 'a', 'b')) && /anotado/.test(R('vozMomento_')('despues_del_checkout', 'a', 'b')), 'A10 · momento antes y después de la estadía');
ctx.vozQuien_ = () => ({ tipo: 'juan', nombre: 'Juan', rol: 'admin' }); ctx.vozLookup_ = undefined;
R("delete this.vozLookup_"); vm.runInContext(require('fs').readFileSync(path.join(DIR, 'voz.js'), 'utf8').match(/function vozLookup_\(b\) \{[\s\S]*?\n\}/)[0], ctx);
ok(/NUNCA lookup_reservation/.test(R('vozLookup_')({ caller_id: '50200000001' }).NO_LA_VUELVAS_A_LLAMAR || ''), 'A1 · lookup_reservation con un administrador: «no la vuelvas a llamar»');

/* ── A3, A4–A6, A5 · secretaria ── */
const cache = {}; ctx.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove() {} }) };
ctx.Utilities = Object.assign({}, ctx.Utilities, { computeDigest: (a, t) => Array.from(Buffer.from(String(t))), base64Encode: b => Buffer.from(b).toString('base64') });
let llamadas = 0, encolado = 0; ctx.vozSecretaria_ = b => { llamadas++; if (b.pedido === 'falla') throw new Error('x'); return b.pedido === 'no' ? { ok: false, error: 'No encontré al huésped.' } : { ok: true, resultado: 'Listo.' }; };
ctx.vozSecEncolar_ = () => { encolado++; return {}; }; ctx.vozEsConferencia_ = () => false;
const sec = b => R('vozSecretariaGuardada_')(Object.assign({ caller_id: '50200000001', conv_id: 'c1' }, b));
const largo = 'Escríbele a Gabriel que mañana limpie el 1104 a las nueve';
sec({ pedido: largo }); const r2 = sec({ pedido: largo });
ok(r2.ya_pedido && llamadas === 1, 'A4–A6 · el mismo pedido en la misma llamada sale una sola vez');
sec({ pedido: 'Sí, hazlo' }); sec({ pedido: 'Sí, hazlo' });
ok(llamadas === 3, 'A4–A6 · las respuestas cortas («Sí, hazlo») no se bloquean');
ok(/No pude/.test(sec({ pedido: 'no' }).decir || ''), 'A3 · secretaria con ok:false trae «No pude…» en decir');
const rf = sec({ pedido: 'falla' });
ok(rf.en_proceso && encolado === 1 && /segundo plano/.test(rf.decir), 'A5 · si secretaria se cae, pasa sola a segundo plano');

/* ── C · cada herramienta de voz trae su descripción en el código ── */
const A = require(path.join(DIR, '..', 'playbooks', 'alma.json')).herramientas;
ok(/cada una trae en su descripción/.test(sinFicha) && !/lookup_reservation: Valida/.test(sinFicha), 'C · el prompt dice solo la cabecera de las herramientas');
const defs = R('vozDefHerramientas_("BASE")'), sis = R('VOZ_SISTEMA_DESC_'), aj = R('VOZ_AJUSTES_AJENAS_');
const sinDesc = Object.keys(A.lista).filter(n => { const d = (defs.find(x => x.name === n) || {}).description || sis[n] || (aj[n] || {}).description || ''; return d.length < 80; });
ok(!sinDesc.length, 'C · cada herramienta de voz tiene su descripción completa en el código' + (sinDesc.length ? ' (faltan: ' + sinDesc.join(', ') + ')' : ''));
process.exit(fallo);
