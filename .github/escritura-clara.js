/* Prueba con dobles de la Escritura clara (apps-script/escrituraclara.js; Juan, 20-nov-2026, truco 1 del video de Andrej
   Karpathy: lo que Alma escribe, al 80 % de ASD-STE100). Sin Google ni IA. Revisa:
   1. la revisión marca frase larga, voz pasiva y palabra «Evitar» del glosario (y en inglés no marca «staff»);
   2. un mensaje claro pasa sin tocar y sin llamar al modelo;
   3. la reescritura se usa solo si conserva números, enlaces y nombres y queda más clara; si pierde o agrega un número o
      un enlace, se descarta y sale el original;
   4. la voz no pasa (calle, voz, llamada) y ESCRITURA_CLARA = no la apaga;
   5. el cableado: chat y WhatsApp en opProcesar_ (fuera de la calle) y la respuesta al huésped; la voz nunca la llama;
   6. cada palabra «Evitar» de la revisión sigue en docs/GLOSARIO.md.
   node .github/escritura-clara.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const EC = leer('escrituraclara.js'), COD = leer('Código.js');

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), llamadas = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, Error,
    CFG: { TZ: 'America/Guatemala' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: { formatDate: d => new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10) },
    creatorEscalonModelo_: i => 'modelo-' + ['basico', 'medio', 'avanzado'][i],
    claude_: (modelo, max, system, user) => { llamadas.push({ modelo, system, user }); return typeof o.modelo === 'function' ? o.modelo(user) : (o.modelo || ''); }
  };
  vm.createContext(ctx); vm.runInContext(EC, ctx);
  return { ctx, props, llamadas, sale: (t, op) => { const det = {}; const s = ctx.escrituraClara_(t, Object.assign({ detalle: det }, op || {})); return { s, det }; } };
}
/* Datos de mentira: ningún huésped real. */
const LARGO = 'Te escribo para contarte que la reserva de Mónaco B2 fue confirmada por el equipo el martes y que el código de la puerta 4821 fue enviado por correo a la persona que va a llegar con su familia el viernes en la tarde, así que todo está listo para que entren sin problema y sin esperar a nadie en la recepción del edificio. Además el pago fue registrado en el sistema y el recibo fue generado con el monto de 1,250 quetzales. Aquí está el enlace: https://hub.spacioam.com/ejemplo?id=7 .';
const CLARO = 'Listo, quedó confirmada la reserva de Mónaco B2 para el viernes. El código de la puerta es 4821. El pago de 1,250 quetzales ya está anotado. Te mando el enlace del recibo: https://hub.spacioam.com/ejemplo?id=7';
const BUENA = 'Listo: el equipo confirmó la reserva de Mónaco B2 el martes. Mandamos por correo el código de la puerta, 4821, a quien llega el viernes en la tarde con su familia. Pueden entrar sin esperar a nadie en la recepción del edificio. Anotamos el pago de 1,250 quetzales y el recibo ya está hecho. Aquí está el enlace: https://hub.spacioam.com/ejemplo?id=7 .';

/* 1 · la revisión marca */
{
  const c = caja();
  const r = c.ctx.ecRevisar_(LARGO);
  ok(r.muyLargas + r.largas >= 1, 'marca la frase larga (más de 25 palabras)');
  ok(r.pasivas >= 3, 'marca la voz pasiva («fue confirmada», «fue enviado», «fue registrado»…): ' + r.pasivas);
  ok(r.falla, 'un mensaje largo y en pasiva falla de forma clara (' + r.puntos + ' puntos)');
  const e = c.ctx.ecRevisar_('Hola, ya revisé el inbox y el staff de limpieza confirmó todo para mañana a las nueve de la mañana sin falta.');
  ok(e.evitar.indexOf('inbox') >= 0 && e.evitar.indexOf('staff') >= 0, 'marca las palabras «Evitar» del glosario (inbox, staff)');
  const en = c.ctx.ecRevisar_('Hi! Our staff will be happy to help you with the check-in. The code was sent to your email and you can use it from 3 pm.');
  ok(en.idioma === 'en' && en.evitar.length === 0, 'en un mensaje en inglés «staff» es correcto: no se marca');
  ok(c.ctx.ecRevisar_('Son bienvenidos a las nueve. Gracias por avisar.').pasivas === 0, '«son bienvenidos» no cuenta como pasiva');
}
/* 2 · lo claro pasa sin tocar */
{
  const c = caja({ modelo: 'no debería llamarse' });
  const r = c.sale(CLARO, { canal: 'whatsapp' });
  ok(r.s === CLARO && c.llamadas.length === 0, 'un mensaje claro pasa sin tocar y sin llamar al modelo (' + r.det.motivo + ')');
  ok(c.sale('Listo, anotado.', { canal: 'hub' }).s === 'Listo, anotado.' && c.llamadas.length === 0, 'un mensaje corto no se revisa');
  const una = 'Hoy llegan tres huéspedes y todos tienen su código listo desde la mañana, así que recepción solo tiene que darles la bienvenida en la puerta del edificio. Mañana no hay llegadas.';
  ok(c.sale(una, { canal: 'hub' }).s === una && c.llamadas.length === 0, 'una sola frase algo larga no alcanza el umbral (prudente)');
}
/* 3 · la reescritura */
{
  const c = caja({ modelo: BUENA });
  const r = c.sale(LARGO, { canal: 'whatsapp' });
  ok(r.s === BUENA && r.det.motivo === 'reescrita', 'la reescritura que conserva todo y queda más clara se usa (' + r.det.motivo + ')');
  ok(c.llamadas.length === 1 && c.llamadas[0].modelo === 'modelo-basico', 'una sola llamada, con el modelo básico');
  const pr = JSON.parse(c.llamadas[0].system);
  ok(pr.rol && pr.tarea && pr.contexto && pr.pasos && pr.restricciones && pr.formato_de_respuesta && /mismo idioma/.test(pr.tarea) && /enlaces/.test(pr.restricciones.join(' ')), 'la instrucción va en JSON: 80 % de ASD-STE100, mismo idioma, sin cambiar datos, enlaces ni nombres');
  ok(JSON.parse(c.props.ESCRITURA_CLARA_CUENTA).reescritos === 1, 'la cuenta del día suma el reescrito');
  const sinNumero = caja({ modelo: BUENA.replace('4821', 'de siempre') }).sale(LARGO, { canal: 'hub' });
  ok(sinNumero.s === LARGO && /perdió el número 4821/.test(sinNumero.det.motivo), 'si pierde un número, se descarta y sale el original (' + sinNumero.det.motivo + ')');
  const sinEnlace = caja({ modelo: BUENA.replace('https://hub.spacioam.com/ejemplo?id=7', 'el Hub') }).sale(LARGO, { canal: 'hub' });
  ok(sinEnlace.s === LARGO && /enlace/.test(sinEnlace.det.motivo), 'si pierde el enlace, se descarta (' + sinEnlace.det.motivo + ')');
  const inventa = caja({ modelo: BUENA.replace('el martes', 'el martes 24') }).sale(LARGO, { canal: 'hub' });
  ok(inventa.s === LARGO && /agregó el número 24/.test(inventa.det.motivo), 'si agrega un número, se descarta (' + inventa.det.motivo + ')');
  const sinNombre = caja({ modelo: BUENA.replace(/Mónaco/g, 'el apartamento') }).sale(LARGO, { canal: 'hub' });
  ok(sinNombre.s === LARGO && /nombre/.test(sinNombre.det.motivo), 'si pierde un nombre, se descarta (' + sinNombre.det.motivo + ')');
  const vacia = caja({ modelo: '' }).sale(LARGO, { canal: 'hub' });
  ok(vacia.s === LARGO, 'sin respuesta del modelo sale el original');
  const igual = caja({ modelo: LARGO.replace('Te escribo', 'Te cuento') }).sale(LARGO, { canal: 'hub' });
  ok(igual.s === LARGO && /no quedó más clara/.test(igual.det.motivo), 'si no queda más clara, sale el original');
  const desc = caja({ modelo: BUENA.replace('4821', 'X') }); desc.sale(LARGO, { canal: 'hub' });
  ok(JSON.parse(desc.props.ESCRITURA_CLARA_CUENTA).descartados === 1, 'la cuenta del día suma el descartado');
}
/* 4 · la voz no pasa; el interruptor */
{
  ['calle', 'voz', 'llamada'].forEach(k => {
    const c = caja({ modelo: BUENA });
    ok(c.sale(LARGO, { canal: k }).s === LARGO && c.llamadas.length === 0, 'la voz no pasa por la revisión: ' + k);
  });
  const c = caja({ modelo: BUENA, props: { ESCRITURA_CLARA: 'no' } });
  ok(c.sale(LARGO, { canal: 'whatsapp' }).s === LARGO && c.llamadas.length === 0, 'ESCRITURA_CLARA = no la apaga');
  const rb = caja({ modelo: BUENA }); const out = rb.ctx.escrituraClaraRobot_({ texto: LARGO });
  ok(out.cambio && out.sale === BUENA && !rb.props.ESCRITURA_CLARA_CUENTA, 'el robot prueba un texto sin mandar nada y sin sumar a la cuenta');
}
/* 5 · cableado */
{
  const op = COD.slice(COD.indexOf('function opProcesar_('), COD.indexOf('function opAgruparSeg_('));
  ok(/if \(canal === 'calle'\)[^\n]*\n\s*else if \(turno\.texto\) \{ try \{ turno\.texto = escrituraClara_\(turno\.texto, \{ canal: canal \}\)/.test(op), 'opProcesar_: chat y WhatsApp pasan por la Escritura clara; la calle (voz) no');
  ok(op.indexOf('escrituraClara_') < op.indexOf('formatearMensaje_(turno.texto'), 'se revisa antes de dar formato (los párrafos salen del texto ya claro)');
  ok(/red\.ok && red\.texto\) \{ try \{ red\.texto = escrituraClara_\(red\.texto, \{ canal: 'huesped' \}\)/.test(COD), 'la respuesta al huésped pasa después del control de calidad (solo si salió bien)');
  const voz = fs.readdirSync(DIR).filter(f => /^(voz|calle|claudio|rapido|maricarmen|conferencia)\w*\.js$/.test(f)).filter(f => /escrituraClara_\(/.test(leer(f)));
  ok(!voz.length, 'ningún archivo de voz la llama' + (voz.length ? ': ' + voz.join(', ') : ''));
  ok(/ecReescribir_: 'Escritura clara · reescribir'/.test(COD), 'la reescritura queda en IA_USO con su nombre (el Gasto de Alma la cuenta)');
  ok(/JSON\.stringify\(EC_PROMPT_\), String\(texto\), null\)/.test(EC) && /temp === null \? \{ output_config: \{ effort: 'low' \} \}/.test(COD), 'la reescritura va sin temperature (el modelo básico la rechaza con 400) y con esfuerzo bajo');
  ok(/case 'escritura_clara': return json_\(escrituraClaraRobot_\(body\)\)/.test(COD), 'robot escritura_clara');
}
/* 6 · las palabras «Evitar» siguen en el glosario */
{
  const glos = fs.readFileSync(path.join(DIR, '..', 'docs', 'GLOSARIO.md'), 'utf8');
  const filas = glos.split('\n').filter(l => /^\|/.test(l)).map(l => l.split('|').slice(-2, -1)[0] || '').join(' | ').toLowerCase()
    + ' ' + (glos.match(/Evitar:[^\n]*/g) || []).join(' ').toLowerCase();
  const c = caja(); const faltan = c.ctx.EC_EVITAR_.filter(w => filas.indexOf(w.toLowerCase()) < 0);
  ok(!faltan.length, 'cada palabra «Evitar» de la revisión está en el glosario' + (faltan.length ? '; faltan: ' + faltan.join(', ') : ''));
  ok(/\*\*Escritura clara\*\*/.test(glos), 'el glosario define «Escritura clara»');
}
process.exit(fallo);
