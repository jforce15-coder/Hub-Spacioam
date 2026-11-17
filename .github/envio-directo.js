/* Prueba del envío directo (apps-script/enviodirecto.js, Juan 17-nov-2026, #633): «cuando Juan dé la instrucción de
   responder o enviar un mensaje, enviarlo directamente, sin preguntar "¿lo envío?"». Con dobles, sin Google.
   1. Las órdenes de Juan («respóndele…», «mándale…», «escríbele a…», «dile a…») salen directo; si pide verlo antes
      («borrador», «muéstrame», «antes de enviar», «no lo mandes»), una pregunta o un «sí», no.
   2. Solo el administrador principal; nunca la familia, una instrucción de una sesión de Claude (para-alma) ni con
      ENVIO_DIRECTO = 0.
   3. Una consulta (consultas.js) con directo sale en la primera llamada; sin directo sigue con borrador y su sí.
   4. agente.js lo usa en los tres envíos (huésped, equipo, correo) y no salta el borrador si Alma adivinó a quién.
   node .github/envio-directo.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

function caja(props) {
  const cache = {};
  const ctx = { console, JSON, String, Number, Object, Array, RegExp, Date, Math,
    AGENTE_TEXTO_: '', AGENTE_CANAL_: 'hub', AGENTE_PERMITIDAS_: null, PARA_ALMA_CANAL_: 'instruccion', CONSULTA_APROBADA_: false, TV_CANAL_: {},
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props || {})[k] || null }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) } };
  vm.createContext(ctx);
  vm.runInContext(leer('enviodirecto.js'), ctx, { filename: 'enviodirecto.js' });
  vm.runInContext(leer('consultas.js').replace(/^var CONSULTA_APROBADA_ = false;$/m, ''), ctx, { filename: 'consultas.js' });
  return ctx;
}

/* ── 1. Qué es una orden de enviar ── */
{
  const c = caja();
  ['Respóndele que sí, que puede llegar a las 3', 'respondele que si', 'Contéstale a la interesada del 725 que está disponible',
    'Mándale a Gabriel que mañana llego tarde', 'Escríbele a recepción de Ignacio que viene un técnico', 'Dile a Flor que ya está el pago',
    'Envíale al huésped de Brunelo 1808 el código de wifi', 'Avísale al socio de Narama 633 que ya quedó', 'Pregúntale a Oscar a qué hora llega',
    'Responde un mensaje a Ana: gracias', 'Mándaselo a Inés', 'Contesta el correo de Casa Sol: recibido, gracias'
  ].forEach(t => ok(c.envioDirectoOrden_(t), 'orden de enviar: «' + t + '»'));
  ['Hazme un borrador para Gabriel', 'Muéstrame qué le dirías a Oscar', 'Escríbele a Gabriel pero antes de enviarlo muéstramelo', 'Redacta una respuesta para Ana',
    'Mándale a Flor que ya pagué, pero no lo mandes todavía', '¿Qué le contesto a la interesada?', '¿Le respondiste a Oscar?', 'sí', '¿Cómo vamos con la ruta?',
    'Ve la conversación de Oscar', 'Dime qué dijo Gabriel', 'Propón un mensaje para el socio', ''
  ].forEach(t => ok(!c.envioDirectoOrden_(t), 'no es orden de enviar ya: «' + t + '»'));
}
/* ── 2. Quién y desde dónde ── */
{
  const juan = { email: 'juan@x.test', principal: true }, otro = { email: 'ines@x.test', principal: false };
  let c = caja(); c.AGENTE_TEXTO_ = 'Mándale a Gabriel que llego tarde';
  ok(c.envioDirecto_(juan), 'Juan (principal) en el chat: directo');
  c.AGENTE_CANAL_ = 'llamada'; ok(c.envioDirecto_(juan), 'Juan en una llamada: directo');
  ok(!c.envioDirecto_(otro), 'otro administrador: sigue con su sí');
  c.AGENTE_PERMITIDAS_ = ['escribir_a_equipo']; ok(!c.envioDirecto_(juan), 'la familia (herramientas limitadas): sigue con el sí');
  c.AGENTE_PERMITIDAS_ = null; c.AGENTE_CANAL_ = 'instruccion'; ok(!c.envioDirecto_(juan), 'una instrucción de una sesión de Claude (para-alma): sigue con el sí');
  c = caja({ ENVIO_DIRECTO: '0' }); c.AGENTE_TEXTO_ = 'Mándale a Gabriel que llego tarde';
  ok(!c.envioDirecto_(juan), 'ENVIO_DIRECTO = 0: todo como antes');
}
/* ── 3. Consulta: directo sale ya; sin directo, borrador ── */
{
  const c = caja(), adm = { email: 'juan@x.test', principal: true }, ficha = { conv_id: 'inq:1', huesped: 'Ana', propiedad: 'Narama 725' };
  c.AGENTE_TEXTO_ = 'Respóndele a la interesada que sí está disponible';
  const r = c.consultaBorrador_(adm, ficha, 'Hola Ana, sí está disponible.', undefined, true);
  ok(r.enviar === true && r.texto === 'Hola Ana, sí está disponible.', 'consulta con directo: sale en la primera llamada');
  const b = c.consultaBorrador_(adm, ficha, 'Hola Ana, sí está disponible.', undefined, false);
  ok(b.falta_confirmar && !b.enviar, 'consulta sin directo: borrador con su sí, como antes');
  c.AGENTE_TEXTO_ = 'Respóndele que sí'; const r2 = c.consultaBorrador_(adm, ficha, 'Otro texto.', undefined, true);
  ok(r2.enviar && !c.consultaPendiente_(adm), 'directo con un borrador viejo de la misma consulta: sale y el borrador viejo se borra');
}
/* ── 4. agente.js lo usa en los tres envíos ── */
{
  const src = leer('agente.js');
  ok(/directoH = typeof envioDirecto_ === 'function' && envioDirecto_\(adm\) && !\(elegida && elegida\.elegida_por\)/.test(src), 'huésped: directo salvo si Alma eligió la reserva por lo reciente');
  ok(/consultaBorrador_\(adm, fichaC, .*, inp\.confirmado, directoH\)/.test(src), 'consulta: pasa directo');
  ok(/if \(directoH && inp\.borrador === true && !porRec\) inp\.borrador = false;/.test(src), 'reserva: la orden de Juan salta el borrador');
  ok(/if \(inp\.borrador === true && !siE && typeof envioDirecto_ === 'function' && envioDirecto_\(adm\)\) inp\.borrador = false;/.test(src), 'equipo: la orden de Juan salta el borrador');
  ok(/correoResponder_\(adm, Object\.assign\(\{\}, inp, \{ directo:/.test(src), 'correo: pasa directo');
  const fuente = leer('almafuente.js');
  ok(/sale de inmediato, sin borrador ni «¿lo envío\?»/.test(fuente), 'alma.json: la regla de cero fricción incluye los mensajes que Juan ordena');
}
process.exit(fallo);
