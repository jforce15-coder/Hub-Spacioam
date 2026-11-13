/* Prueba del reintento a números +1 cuando Meta avisa 131049 (apps-script/masuno.js), con dobles de la API de Meta:
   sin internet ni Google. Revisa:
   1. socio registrado (+1): se reintenta con la plantilla para socios, una sola vez;
   2. nuevo o potencial socio (+1): se reintenta con seguimiento_socio en inglés, con el detalle del mensaje real;
   3. si la que falló ya era la plantilla para socios, o la de seguimiento no está aprobada: no hay reintento (aviso normal);
   4. un número que no es +1 no se reintenta;
   5. seguimiento_socio se crea sola como Utilidad (en_US y es) y avisa a Juan una vez al aprobarse.
   node .github/masuno-reintento.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JORGE = '17865550123';   // socio de prueba (+1)
const ANA = '13055550188';     // potencial socia de prueba (+1), sin cuenta
const LUCIA = '50255550123';   // número de prueba de Guatemala
function caja(aprobadas) {
  const props = { WA_WABA_ID: 'waba1', WA_TOKEN: 'prueba', WA_PLANTILLA_SOCIO: 'estado_cuenta_socio', WA_PLANTILLA_SOCIO_IDIOMA: 'es', WA_PLANTILLA_SOCIO_IDIOMA_EN: 'en_US' };
  const meta = { plantillas: (aprobadas || []).map(lg => ({ name: 'seguimiento_socio', language: lg, status: 'APPROVED', category: 'UTILITY' })), envios: [], creadas: [] };
  const cache = {}, avisos = [], hilo = [];
  const resp = (code, o) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(o) });
  const ctx = {
    console: { log() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    uf_: (url, o) => {
      if (/\/messages$/.test(url)) { const b = JSON.parse(o.payload); meta.envios.push(b); return resp(200, { messages: [{ id: 'wamid.' + meta.envios.length }] }); }
      if (o && o.method === 'post') { const b = JSON.parse(o.payload); meta.creadas.push(b); meta.plantillas.push({ name: b.name, language: b.language, status: 'PENDING', category: b.category }); return resp(200, { status: 'PENDING', category: b.category }); }
      return resp(200, { data: meta.plantillas.map(t => Object.assign({}, t)) });
    },
    waCfg_: () => ({ token: 'prueba', phoneId: 'tel1' }),
    adminsOp_: () => [{ email: 'juan@x', principal: true }],
    vozAvisoPoner_: (adm, txt) => avisos.push(txt),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8),
    normTel_: x => String(x || '').replace(/\D/g, ''),
    adminPorTel_: () => null,
    accesosPorRol_: () => ({ socios: [{ tel: JORGE, nombre: 'Jorge Marroquín', propiedad: 'Brunelo 705' }] }),
    waPropietarios_: () => [], waHilo_: () => [], idiomaDe_: () => 'es',
    contactoFicha_: wa => (String(wa).endsWith('55550188') ? { nombre: 'Ana Ríos', tipo: 'contacto', propiedades: 'Brunelo 1102' } : null),
    contactoRegistrar_: (wa, n, t) => hilo.push(t)
  };
  vm.createContext(ctx);
  for (const f of ['socios.js', 'masuno.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
  const pendiente = (wa, texto) => { const m = JSON.parse(props.WA_PEND || '{}'); m[ctx.fin8_(wa)] = [{ texto, ts: Date.now(), nombre: '' }]; props.WA_PEND = JSON.stringify(m); };
  return { ctx, props, meta, cache, avisos, hilo, pendiente };
}
const vars = e => e.template.components[0].parameters.map(x => x.text);

/* 1 · Socio registrado. */
let C = caja(['en_US', 'es']);
C.pendiente(JORGE, 'Hola Jorge, tu estado de cuenta de octubre está listo. Te lo mando en PDF.');
ok(C.ctx.waReintentoMasUno_(JORGE, 'wamid.x') === true && C.meta.envios.length === 1 && C.meta.envios[0].template.name === 'estado_cuenta_socio' &&
  C.meta.envios[0].template.language.code === 'en_US', 'socio +1 con 131049: reintento con la plantilla para socios, en inglés');
ok(C.ctx.waReintentoMasUno_(JORGE, 'wamid.1') === false && C.meta.envios.length === 1, 'una sola vez por número (si vuelve a fallar, aviso normal)');
ok(/131049/.test(C.hilo[0]) && JSON.parse(C.props.WA_PEND)[C.ctx.fin8_(JORGE)].length === 1, 'queda escrito en su conversación y el mensaje completo sigue guardado');

/* 2 · Nuevo o potencial socio. */
C.pendiente(ANA, 'Hola Ana, la propuesta de administración que pediste está lista. ¿La revisamos el lunes?');
ok(C.ctx.waReintentoMasUno_(ANA, 'wamid.y') === true && C.meta.envios[1].template.name === 'seguimiento_socio' && C.meta.envios[1].template.language.code === 'en_US',
  'potencial socia +1: reintento con seguimiento_socio en inglés');
ok(JSON.stringify(vars(C.meta.envios[1])) === '["Ana","Brunelo 1102","la propuesta de administración que pediste está lista"]', 'con su nombre, la propiedad de su ficha y el detalle real: ' + JSON.stringify(vars(C.meta.envios[1])));

/* 3 · Sin reintento cuando no sirve. */
C = caja(['en_US']);
C.pendiente(JORGE, 'Hola Jorge, tu pago quedó registrado.');
C.cache['wa_tpl_wamid.s'] = 'socio';
ok(C.ctx.waReintentoMasUno_(JORGE, 'wamid.s') === false && C.meta.envios.length === 0, 'si lo que falló ya era la plantilla para socios, no se repite');
C = caja([]);
C.pendiente(ANA, 'Hola Ana, la propuesta está lista.');
ok(C.ctx.waReintentoMasUno_(ANA, 'wamid.z') === false && C.meta.envios.length === 0, 'sin seguimiento_socio aprobada: no se manda nada (Alma avisa como hoy)');

/* 4 · Solo +1. */
C = caja(['en_US', 'es']);
C.pendiente(LUCIA, 'Hola Lucía, tu pago quedó registrado.');
ok(C.ctx.waReintentoMasUno_(LUCIA, 'wamid.l') === false && C.meta.envios.length === 0, 'un número que no es +1 no se reintenta');

/* 5 · Crear y aprobar. */
C = caja([]);
let r = C.ctx.seguimPlantillaAsegurar_(true);
ok(C.meta.creadas.length === 2 && C.meta.creadas.every(b => b.category === 'UTILITY' && b.name === 'seguimiento_socio') && C.meta.creadas[0].language === 'en_US', 'crea seguimiento_socio como Utilidad: en_US primero, luego es');
ok(!C.meta.creadas.some(b => /owner account|cuenta de propietario/i.test(JSON.stringify(b))), 'el texto no habla de «cuenta de propietario» (un potencial socio no la tiene)');
C.meta.plantillas.forEach(t => { t.status = 'APPROVED'; });
C.ctx.seguimPlantillaAsegurar_(true); C.ctx.seguimPlantillaAsegurar_(true);
ok(C.avisos.length === 2 && C.avisos.every(t => /aprobó la plantilla de seguimiento/.test(t)), 'avisa a Juan una vez por idioma al aprobarse (no se repite)');
C.ctx.seguimPlantillaAsegurar_(true);
ok(C.meta.creadas.length === 2, 'no la vuelve a mandar si ya existe');

process.exit(fallo);
