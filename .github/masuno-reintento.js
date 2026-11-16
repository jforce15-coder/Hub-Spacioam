/* Números +1 (EE. UU. y Canadá): la plantilla que sí les llega (apps-script/masuno.js, #497) con dobles: sin Meta ni Google.
   Juan, 12-nov: «cuando falle el envío de WhatsApp a números de Estados Unidos por bloqueo de marketing de Meta, que se
   use automáticamente la plantilla aprobada que usamos para números de EE. UU., como la de los socios de Brunelo 705»;
   «la misma plantilla o una similar alternativa» para nuevos o potenciales socios. #505 se cerró sin unir y faltaba.
   1. Reintento: un 131049 a un +1 se reintenta una vez con la plantilla para socios (socio) o la de seguimiento (los
      demás), con su nombre, su propiedad y el detalle del mensaje real; el mensaje completo queda para cuando responda y
      la conversación lo dice; Alma no avisa el fallo.
   2. Sin bucles: una vez por número cada 6 h; si lo que falló ya era esa plantilla, o no hay ninguna aprobada, o no es
      +1, o no hay mensaje que reintentar, no se manda nada y Alma avisa como siempre.
   3. Antes de mandar: a un +1 que no es socio, fuera de 24 h, sale la de seguimiento (si está aprobada) en vez de la de
      primer contacto (Marketing, Meta no se la entrega); sin aprobar, lo de siempre. A los que no son +1, nada cambia.
   4. La plantilla de seguimiento se crea sola como Utilidad (inglés primero), sin «cuenta de propietario», avisa a Juan
      una vez cuando Meta decide y no vuelve a ir a internet antes de tiempo.
   node .github/masuno-reintento.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const COD = leer('Código.js');

/* Números de prueba, no reales. */
const JUAN = '50255550100', SOCIO_US = '17865550201', NUEVO_US = '17865550202', GT = '50255550203';
const APROBADA = { estado: 'APPROVED', cat: 'UTILITY', motivo: '' };

function caja(o) {
  o = o || {};
  const props = Object.assign({ WA_WABA_ID: 'waba', WA_PLANTILLA_SOCIO: 'estado_cuenta_socio', WA_PLANTILLA_SOCIO_IDIOMA: 'es', WA_PLANTILLA_SOCIO_IDIOMA_EN: 'en_US' }, o.props || {});
  if (o.seguim !== false) props.SEGUIM_TPL_EST = JSON.stringify({ en_US: APROBADA, es: APROBADA, fin: 1, rev: Date.now() });
  const cache = {}, posts = [], filas = [], avisos = [], fallos = [], creadas = [], lecturas = [];
  const fichas = [{ tel: SOCIO_US, nombre: 'Jorge Prueba', tipo: 'socio', propiedades: 'Brunelo 705' }, { tel: NUEVO_US, nombre: 'Ana Prueba', tipo: 'potencial socio', propiedades: 'Narama 633' }];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getUserLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: { sleep() {}, formatDate: d => new Date(d).toISOString().slice(0, 16) },
    CFG: { TZ: 'America/Guatemala', WHATSAPP_JUAN: JUAN },
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8), s_: v => (v == null || typeof v === 'object') ? '' : String(v),
    acortarEnTexto_: t => t, idiomaDe_: () => 'es', waHilo_: () => [],
    adminsOp_: () => [{ nombre: 'Juan Prueba', email: 'juan@prueba', tels: [JUAN], principal: true }], adminPorTel_: () => null, adminPorEmail_: () => null,
    accesosPorRol_: () => ({ socios: [] }), waPropietarios_: () => [], socioPropDeTel_: () => '',
    contactoFicha_: w => fichas.filter(f => ctx.fin8_(f.tel) === ctx.fin8_(w))[0] || null,
    hojaWA_: () => ({ appendRow: r => filas.push(r) }), waCfg_: () => ({ token: 't', phoneId: 'p' }), waVentana_: () => false,
    waEnviar_: (n, t) => { posts.push({ a: n, texto: t }); return { ok: true, id: 'wamid.t' + posts.length }; },
    personalDe_: () => null, personalPlantillaOk_: () => false, encargoAbierto_: () => null, opGuardar_() {},
    pendAvisar_: (adm, t) => { fallos.push(t); return true; }, vozAvisoPoner_: (adm, t) => { avisos.push(t); },
    uf_: (url, op) => {
      if (/message_templates/.test(url)) {
        if (op && op.method === 'post') { const b = JSON.parse(op.payload); creadas.push(b); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ status: 'PENDING', category: 'UTILITY' }) }; }
        lecturas.push(url);
        if (/name=seguimiento_socio/.test(url)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ data: o.metaSeguim || [] }) };
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ data: [{ name: 'contacto_alma', status: 'APPROVED' }] }) };
      }
      const b = JSON.parse(op.payload), t = b.template || {};
      posts.push({ a: b.to, plantilla: t.name, idioma: t.language && t.language.code, params: t.components ? t.components[0].parameters.map(x => x.text) : [] });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ messages: [{ id: 'wamid.p' + posts.length }] }) };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(['normTel_'].map(n => sacar(COD, n)).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  ['socios.js', 'contacto.js', 'entrega.js', 'masuno.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  return { ctx, props, cache, posts, filas, avisos, fallos, creadas, lecturas };
}
/* Lo que avisa Meta por el webhook. */
const estado = (wa, id, code, seg) => ({ recipient_id: wa, id, status: 'failed', timestamp: String(Math.floor(Date.now() / 1000) + (seg || 0)), errors: [{ code, title: 'x' }] });
const pendDe = (c, wa) => (JSON.parse(c.props.WA_PEND || '{}')[c.ctx.fin8_(wa)] || []);

/* 1 y 3 · un +1 que no es socio, fuera de 24 h: sale la de seguimiento, no la de primer contacto */
{
  const c = caja(), r = c.ctx.waEnviarAlguien_(NUEVO_US, 'Hola Ana, la propuesta para tu apartamento ya está lista. Te mando el detalle.', { nombre: 'Ana Prueba' });
  const p = c.posts[0] || {};
  ok(r.ok && p.plantilla === 'seguimiento_socio' && p.idioma === 'en_US' && c.posts.every(x => x.plantilla !== 'contacto_alma'),
    '+1 que no es socio: sale la plantilla de seguimiento en inglés, no la de primer contacto (Marketing)');
  ok(p.params[0] === 'Ana' && p.params[1] === 'Narama 633' && /propuesta para tu apartamento/.test(p.params[2]) && r.plantilla === 'plantilla de seguimiento',
    'con su nombre, la propiedad de su ficha y el detalle del mensaje real');
  ok(pendDe(c, NUEVO_US).length === 1, 'el mensaje completo queda guardado para cuando responda');
  /* si Meta igual lo bloquea, no se reintenta con la misma */
  c.ctx.waEntregaGuardar_(estado(NUEVO_US, r.id, 131049));
  ok(c.posts.length === 1 && c.fallos.length === 1 && /no le llegó|No le llegó/.test(c.fallos[0]), 'si Meta bloquea la de seguimiento, no se repite: Alma avisa como siempre');
}
{
  const c = caja({ seguim: false }); c.ctx.waEnviarAlguien_(NUEVO_US, 'Hola Ana, te escribo por la propuesta.', { nombre: 'Ana Prueba' });
  ok(c.posts[0] && c.posts[0].plantilla === 'contacto_alma', 'sin la de seguimiento aprobada, lo de siempre (primer contacto)');
  const g = caja(); g.ctx.waEnviarAlguien_(GT, 'Hola, te escribo por la propuesta.', { nombre: 'Luis Prueba' });
  ok(g.posts[0] && g.posts[0].plantilla === 'contacto_alma', 'a un número que no es +1 nada cambia');
}

/* 1 · el reintento cuando Meta avisa 131049 */
{
  const c = caja({ seguim: false });
  c.ctx.waEnviarAlguien_(NUEVO_US, 'Hola Ana, la propuesta ya está lista.', { nombre: 'Ana Prueba' });   // salió la de primer contacto
  c.props.SEGUIM_TPL_EST = JSON.stringify({ en_US: APROBADA, es: APROBADA, fin: 1, rev: Date.now() });   // Meta la aprobó después
  c.ctx.waEntregaGuardar_(estado(NUEVO_US, 'wamid.p1', 131049));
  const re = c.posts[1] || {};
  ok(re.plantilla === 'seguimiento_socio' && /propuesta ya está lista/.test(re.params[2]) && !c.fallos.length,
    '131049 a un +1 que no es socio: reintento con la de seguimiento y sin aviso de fallo');
  ok(pendDe(c, NUEVO_US).length === 1 && c.filas.some(f => /reintento con la plantilla de seguimiento/.test(f[4])), 'el mensaje completo sigue guardado (una vez) y la conversación dice el reintento');
  c.ctx.waEntregaGuardar_(estado(NUEVO_US, 'wamid.p2', 131049, 30));   // Meta avisa unos segundos después
  ok(c.posts.length === 2 && c.fallos.length === 1, 'si el reintento también falla, no hay otro: Alma avisa');
}
{
  /* un socio +1 al que le salió otra plantilla (p. ej. la personal) que Meta bloqueó: la para socios */
  const c = caja(), k = c.ctx.fin8_(SOCIO_US);
  c.props.WA_PEND = JSON.stringify({ [k]: [{ texto: 'Hola Jorge, tu estado de cuenta de octubre está listo.', ts: Date.now(), nombre: 'Jorge Prueba' }] });
  c.ctx.waEntregaGuardar_(estado(SOCIO_US, 'wamid.otro', 131049));
  const re = c.posts[0] || {};
  ok(re.plantilla === 'estado_cuenta_socio' && re.idioma === 'en_US' && re.params[0] === 'Jorge' && re.params[1] === 'Brunelo 705' && /estado de cuenta de octubre/.test(re.params[3]) && !c.fallos.length,
    '131049 a un socio +1: reintento con la plantilla para socios (como Brunelo 705), en inglés');
  /* si lo que falló ya era la para socios, no se repite */
  const d = caja(), r = d.ctx.waEnviarAlguien_(SOCIO_US, 'Hola Jorge, tu estado de cuenta está listo.', { nombre: 'Jorge Prueba' });
  d.ctx.waEntregaGuardar_(estado(SOCIO_US, r.id, 131049));
  ok(r.plantilla === 'plantilla para socios' && d.posts.length === 1 && d.fallos.length === 1, 'si lo que falló ya era la plantilla para socios, no se repite: aviso normal');
}
{
  /* 2 · sin bucles ni reintentos de más */
  const c = caja(), k = c.ctx.fin8_(GT);
  c.props.WA_PEND = JSON.stringify({ [k]: [{ texto: 'Hola', ts: Date.now() }] });
  c.ctx.waEntregaGuardar_(estado(GT, 'wamid.gt', 131049));
  ok(!c.posts.length && c.fallos.length === 1 && !/Estados Unidos/.test(c.fallos[0]), 'un número que no es +1 no se reintenta (y el aviso no habla de Estados Unidos)');
  const v = caja(); v.ctx.waEntregaGuardar_(estado(NUEVO_US, 'wamid.x', 131049));
  ok(!v.posts.length && v.fallos.length === 1, 'sin mensaje que reintentar, no se manda nada: aviso normal');
  const s = caja({ seguim: false }), ks = s.ctx.fin8_(NUEVO_US);
  s.props.WA_PEND = JSON.stringify({ [ks]: [{ texto: 'Hola Ana', ts: Date.now() }] });
  s.ctx.waEntregaGuardar_(estado(NUEVO_US, 'wamid.y', 131049));
  ok(!s.posts.length && s.fallos.length === 1, 'sin la de seguimiento aprobada, no se manda nada: aviso normal');
  const t = caja(), kt = t.ctx.fin8_(NUEVO_US);
  t.props.WA_PEND = JSON.stringify({ [kt]: [{ texto: 'Hola Ana', ts: Date.now() }] });
  t.ctx.waEntregaGuardar_(estado(NUEVO_US, 'wamid.a', 131026));
  ok(!t.posts.length && t.fallos.length === 1, 'otro motivo (131026, sin WhatsApp) no se reintenta');
}

/* 4 · la plantilla de seguimiento se crea sola */
{
  const c = caja({ seguim: false });
  const r = c.ctx.seguimPlantillaAsegurar_(false);
  ok(r.ok && c.creadas.length === 2 && c.creadas[0].language === 'en_US' && c.creadas.every(x => x.category === 'UTILITY' && x.name === 'seguimiento_socio'),
    'se crea como Utilidad, inglés primero y luego español');
  ok(c.creadas.every(x => !/cuenta de propietario|owner account/i.test(x.components[0].text)), 'el texto no habla de «cuenta de propietario» (un potencial socio no la tiene)');
  const n = c.lecturas.length; c.ctx.seguimPlantillaAsegurar_(false);
  ok(c.lecturas.length === n, 'antes de 30 min no vuelve a ir a internet');
  const a = caja({ seguim: false, metaSeguim: [{ name: 'seguimiento_socio', language: 'en_US', status: 'APPROVED', category: 'UTILITY' }, { name: 'seguimiento_socio', language: 'es', status: 'APPROVED', category: 'MARKETING' }] });
  a.ctx.seguimPlantillaAsegurar_(true); a.ctx.seguimPlantillaAsegurar_(true);
  ok(a.avisos.length === 2 && a.avisos.some(x => /aprobó .* en inglés/.test(x)) && a.avisos.some(x => /pasó a Marketing .* en español/.test(x)), 'avisa a Juan una vez por idioma (aprobada en inglés, Marketing en español)');
  const ok1 = a.ctx.seguimPlantillaOk_(); ok(ok1.en_US && !ok1.es, 'solo el idioma aprobado como Utilidad se usa');
}
/* el Hub la revisa sola y por el robot */
{
  ok(/cupoFuncion_\('seguimPlantillaAsegurar_'\); try \{ seguimPlantillaAsegurar_\(false\)/.test(COD) && /case 'seguim_plantilla': return json_\(seguimPlantillaAsegurar_\(true\)\)/.test(COD),
    'procesarCola la revisa (con su nombre para «Uso») y el robot la puede forzar');
}
process.exit(fallo);
