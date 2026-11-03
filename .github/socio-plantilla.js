/* Prueba de la plantilla para socios (apps-script/socios.js) con dobles de la API de Meta (Graph): sin internet ni
   Google. Corre socios.js en una caja con Propiedades, uf_ y avisos de mentira, y revisa:
   1. crear: manda estado_cuenta_socio a Meta, primero en inglés (en_US) y después en español, como Utilidad;
   2. aprobada: llena WA_PLANTILLA_SOCIO y sus idiomas y avisa a Juan una vez que ya puede escribirle a Jorge;
   3. recategorizada a Marketing: avisa una sola vez con el motivo, apaga ese idioma y no la vuelve a mandar;
   4. el mensaje lleva las 4 variables con datos reales (propiedad, periodo, detalle) y un +1 va en inglés;
   5. actualizacion_cuenta_socio (la vieja, Marketing) no va a un +1; a los demás sí, solo mientras la nueva no esté aprobada.
   node .github/socio-plantilla.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JORGE = '17865550123';   // número de prueba (+1), no es el real
const LUCIA = '50255550123';   // socia de prueba de Guatemala (+502)
function caja() {
  const props = { WA_WABA_ID: 'waba1', WA_TOKEN: 'prueba', WA_PLANTILLA_SOCIO: 'actualizacion_cuenta_socio' };
  const meta = { plantillas: [], posts: [], gets: 0 };   // lo que «Meta» tiene
  const avisos = [];
  const resp = (code, o) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(o) });
  const ctx = {
    console, JSON, Date, Math, String, Number, Object, Array, RegExp,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    uf_: (url, o) => {
      if (o && o.method === 'post') {
        const b = JSON.parse(o.payload); meta.posts.push(b);
        meta.plantillas.push({ name: b.name, language: b.language, status: 'PENDING', category: b.category });
        return resp(200, { id: 'tpl' + meta.posts.length, status: 'PENDING', category: b.category });
      }
      meta.gets++; return resp(200, { data: meta.plantillas.map(t => Object.assign({}, t)) });
    },
    waCfg_: () => ({ token: props.WA_TOKEN, phoneId: 'tel1' }),
    adminsOp_: () => [{ email: 'juan@x', principal: true }],
    vozAvisoPoner_: (adm, txt, id, o) => avisos.push({ txt, nivel: o && o.nivel }),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8),
    normTel_: x => String(x || '').replace(/\D/g, ''),
    adminPorTel_: () => null,
    accesosPorRol_: () => ({ socios: [{ tel: JORGE, nombre: 'Jorge Marroquín', propiedad: 'Brunelo 705' }, { tel: LUCIA, nombre: 'Lucía Pérez', propiedad: 'apartamento 1508' }] }),
    waPropietarios_: () => [], contactoFicha_: () => null, waHilo_: () => [], idiomaDe_: () => 'es',
    hojaEnc_: () => ({ getLastRow: () => 2, getRange: () => ({ getValues: () => [['en1', new Date().toISOString(), 'juan@x', '', 'Jorge Marroquín', JORGE, 'ESPERA SU RESPUESTA', 'abierto', '', '']] }) }),
    ENC_CAB_: ['id', 'creado', 'solicitante', 'solicitante_tel', 'persona', 'tel', 'objetivo', 'estado', 'resumen', 'cerrado']
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'socios.js'), 'utf8'), ctx, { filename: 'socios.js' });
  return { ctx, props, meta, avisos };
}

/* 5 · La vieja no se usa aunque siga puesta. */
let C = caja();
let pl = C.ctx.socioPlantillaPayload_(JORGE, { nombre: 'Jorge Marroquín', propiedad: 'Brunelo 705', texto: 'Hola Jorge, tu estado de cuenta de octubre está listo.' });
ok(pl.error && /estado_cuenta_socio/.test(pl.error), 'actualizacion_cuenta_socio no va a un +1: sin la nueva aprobada, no sale nada y lo dice');
pl = C.ctx.socioPlantillaPayload_(LUCIA, { nombre: 'Lucía Pérez', propiedad: 'apartamento 1508', texto: 'Hola Lucía, tu pago quedó registrado.' });
ok(pl.payload && pl.payload.template.name === 'actualizacion_cuenta_socio' && pl.payload.template.language.code === 'es' &&
  JSON.stringify(pl.payload.template.components[0].parameters.map(x => x.text)) === '["Lucía","apartamento 1508"]', 'sin +1 y sin la nueva aprobada, va la vieja (Marketing sí llega) con sus 2 variables');
C.props.WA_PLANTILLA_SOCIO = '';
pl = C.ctx.socioPlantillaPayload_(LUCIA, { nombre: 'Lucía Pérez', propiedad: 'apartamento 1508', texto: 'x' });
ok(pl.payload && pl.payload.template.name === 'actualizacion_cuenta_socio', 'también si WA_PLANTILLA_SOCIO está vacía');
C.props.WA_PLANTILLA_SOCIO = 'actualizacion_cuenta_socio';

/* 1 · Crear. */
let r = C.ctx.socioPlantillaAsegurar_(true);
ok(C.meta.posts.length === 2 && C.meta.posts[0].language === 'en_US' && C.meta.posts[1].language === 'es', 'crea en inglés (en_US) primero y luego en español');
ok(C.meta.posts.every(b => b.name === 'estado_cuenta_socio' && b.category === 'UTILITY'), 'nombre estado_cuenta_socio y categoría Utilidad');
const cuerpo = C.meta.posts[0].components.find(c => c.type === 'BODY');
ok((cuerpo.text.match(/\{\{\d\}\}/g) || []).length === 4 && cuerpo.example.body_text[0].length === 4, 'el cuerpo tiene 4 variables y 4 ejemplos');
ok(!/^\{\{|\}\}$/.test(cuerpo.text.trim()), 'el cuerpo no empieza ni termina con una variable (Meta lo rechaza)');
ok(C.meta.posts[0].components.some(c => c.type === 'BUTTONS' && c.buttons[0].type === 'QUICK_REPLY'), 'lleva un botón de respuesta rápida');
ok(!C.avisos.length && C.props.WA_PLANTILLA_SOCIO === 'actualizacion_cuenta_socio', 'en revisión: no avisa ni activa nada');
r = C.ctx.socioPlantillaAsegurar_(false);
ok(r.espera && C.meta.gets === 1, 'sin forzar, espera 30 min antes de volver a preguntar');
C.ctx.socioPlantillaAsegurar_(true);
ok(C.meta.posts.length === 2, 'si ya existe en Meta, no la vuelve a crear');

/* 2 · Aprobada. */
C.meta.plantillas.forEach(t => { t.status = 'APPROVED'; });
C.ctx.socioPlantillaAsegurar_(true);
ok(C.props.WA_PLANTILLA_SOCIO === 'estado_cuenta_socio' && C.props.WA_PLANTILLA_SOCIO_IDIOMA === 'es' && C.props.WA_PLANTILLA_SOCIO_IDIOMA_EN === 'en_US', 'aprobada: llena WA_PLANTILLA_SOCIO, es y en_US');
ok(C.avisos.length === 1 && /Ya puedes escribirle a Jorge Marroquín \(Brunelo 705\)/.test(C.avisos[0].txt), 'avisa a Juan: «ya puedes escribirle a Jorge»');
C.ctx.socioPlantillaAsegurar_(true);
ok(C.avisos.length === 1, 'el aviso de aprobada sale una sola vez');

/* 4 · El mensaje, con datos reales. */
pl = C.ctx.socioPlantillaPayload_(JORGE, { nombre: 'Jorge Marroquín', propiedad: 'Brunelo 705', texto: 'Hola Jorge, tu estado de cuenta de octubre está listo. Te lo mando en PDF.' });
const ps = pl.payload && pl.payload.template.components[0].parameters.map(x => x.text);
ok(pl.payload && pl.payload.template.language.code === 'en_US', 'a un +1 sin ficha en español le va en inglés');
ok(ps && ps.length === 4 && ps[0] === 'Jorge' && ps[1] === 'Brunelo 705' && /^[A-Z][a-z]+ \d{4}$/.test(ps[2]) && ps[3] === 'tu estado de cuenta de octubre está listo', 'llena nombre, propiedad, periodo y detalle del mensaje real: ' + JSON.stringify(ps));
C.ctx.contactoFicha_ = () => ({ resumen: 'Habla español', rol: 'socio' });
pl = C.ctx.socioPlantillaPayload_(JORGE, { nombre: 'Jorge Marroquín', propiedad: 'Brunelo 705', texto: 'Registramos tu pago de noviembre' });
ok(pl.payload.template.language.code === 'es' && / de \d{4}$/.test(pl.payload.template.components[0].parameters[2].text), 'si su ficha dice español, va en español con «noviembre de 2026»');
C.ctx.contactoFicha_ = () => null;
pl = C.ctx.socioPlantillaPayload_(LUCIA, { nombre: 'Lucía Pérez', propiedad: 'apartamento 1508', texto: 'Hola Lucía, registramos tu pago de noviembre.' });
ok(pl.payload.template.name === 'estado_cuenta_socio' && pl.payload.template.components[0].parameters.length === 4, 'aprobada la nueva, también a los que no son +1 les va la nueva');
ok(C.ctx.socioDetalle_('', false) && C.ctx.socioDetalle_('x'.repeat(300), false).length <= 101, 'el detalle nunca va vacío ni pasa de 100 letras');

/* 3 · Meta la pasa a Marketing (como a la anterior). */
C.meta.plantillas.find(t => t.language === 'en_US').category = 'MARKETING';
C.meta.plantillas.find(t => t.language === 'en_US').rejected_reason = 'NONE';
C.ctx.socioPlantillaAsegurar_(true);
ok(C.props.WA_PLANTILLA_SOCIO_IDIOMA_EN === 'no' && C.props.WA_PLANTILLA_SOCIO_IDIOMA === 'es', 'Marketing en inglés: apaga el inglés y deja el español');
ok(C.avisos.length === 2 && /Marketing/.test(C.avisos[1].txt) && /inglés/.test(C.avisos[1].txt) && /No la vuelvo a mandar/.test(C.avisos[1].txt), 'avisa a Juan con el motivo: ' + (C.avisos[1] || {}).txt);
const posts = C.meta.posts.length;
C.ctx.socioPlantillaAsegurar_(true); C.ctx.socioPlantillaAsegurar_(true);
ok(C.avisos.length === 2 && C.meta.posts.length === posts, 'no repite el aviso ni la vuelve a crear en bucle');
pl = C.ctx.socioPlantillaPayload_(JORGE, { nombre: 'Jorge', propiedad: 'Brunelo 705', texto: 'Tu pago quedó registrado' });
ok(pl.payload && pl.payload.template.language.code === 'es', 'con el inglés apagado, a un +1 le va la de español (Utilidad)');
C.meta.plantillas.find(t => t.language === 'es').category = 'MARKETING';
C.ctx.socioPlantillaAsegurar_(true);
pl = C.ctx.socioPlantillaPayload_(JORGE, { nombre: 'Jorge', propiedad: 'Brunelo 705', texto: 'x' });
ok(pl.error && C.avisos.length === 3, 'si los dos idiomas pasan a Marketing, a un +1 no le manda nada y avisa una vez más (español)');
pl = C.ctx.socioPlantillaPayload_(LUCIA, { nombre: 'Lucía Pérez', propiedad: 'apartamento 1508', texto: 'x' });
ok(pl.payload && pl.payload.template.name === 'actualizacion_cuenta_socio', 'y a los que no son +1 les vuelve a ir la vieja');
r = C.ctx.socioPlantillaAsegurar_(false);
ok(r.espera, 'ya decidido cada idioma, revisa solo una vez al día');

/* Un error al crearla no se repite solo. */
C = caja();
C.ctx.uf_ = (url, o) => o && o.method === 'post' ? { getResponseCode: () => 400, getContentText: () => JSON.stringify({ error: { message: 'Invalid parameter', error_user_msg: 'Too many variables for the length' } }) }
  : { getResponseCode: () => 200, getContentText: () => '{"data":[]}' };
let n = 0; const uf0 = C.ctx.uf_; C.ctx.uf_ = (u, o) => { if (o && o.method === 'post') n++; return uf0(u, o); };
C.ctx.socioPlantillaAsegurar_(true);
C.props.SOCIO_TPL_REV = '0';
C.ctx.socioPlantillaAsegurar_(false);
ok(n === 2 && C.avisos.length === 2 && /Too many variables/.test(C.avisos[0].txt), 'si Meta no la acepta al crearla, avisa con el motivo y no la reintenta sola');

process.exit(fallo);
