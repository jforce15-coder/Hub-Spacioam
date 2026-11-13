/* ═══ NOTIFICACIONES HUMANAS (#509 T2) ════════════════════════════════════════════════════════════════════════════
   Juan, 13-nov-2026: «hacer las notificaciones más humanas, como parte de una conversación… que tenga toda la información
   pero como un humano diciéndolo; estructurada cuando sea texto». Las notificaciones que nacen en el Hub con un texto fijo
   (sin IA) salen de aquí, todas con la misma forma:
     · texto: UNA frase de entrada, como Alma se lo contaría en una conversación: qué pasó y qué necesita de él, en simple
       («Revisé lo que me pediste de «X» y tengo una duda antes de seguir; necesito tu respuesta.»). Hasta 120 letras, que
       es lo que la app muestra arriba cuando hay datos. Sin su nombre: la frase hablada lo pone (avisoHablarDe_, calle.js).
     · datos: debajo, hasta 3 líneas «Qué: valor» con lo concreto (el pedido, la causa, qué falta y dónde); la app las pone
       con viñetas, como las líneas de una tarjeta de Pendientes (vozAvisoPoner_ con o.datos).
     · titulo: 2 a 4 palabras para el título de la notificación («Alma · Cambio por unir»).
     · voz (si hace falta): el detalle que la frase hablada agrega después de la entrada, para que al oído también vaya
       toda la información («El motivo: no se considera seguro borrar sin respaldo.»; si es una pregunta, cierra la frase).
   Nunca teléfonos, correos ni códigos (avisoSinDatos_); nunca «Claudio» ni lo interno («PR», «secretaria»): el resultado,
   ya hecho. Las que escribe la IA (Pendientes, temas por retomar) siguen la misma regla en su prompt. Check con dobles:
   .github/avisos-humanos.js. */
var AVISO_ENTRADA_MAX_ = 120;
/* Quita lo que no puede ir en una notificación: correos, teléfonos, números largos (códigos de acceso, PIN, tarjetas) y
   llaves. Los enlaces se quedan: la app los quita al decirlo y en el texto sirven (el enlace de un cambio por unir). */
function avisoSinDatos_(s) {
  return String(s == null ? '' : s)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '')                                   // correos
    .replace(/(^|[^\w/=.-])(?!\d{4}-\d{2}-\d{2}\b)\+?\d(?:[\s().-]?\d){7,}(?![\w/])/g, '$1')   // teléfonos y números largos (no fechas ni enlaces)
    .replace(/\b(c[oó]digo|pin|clave|contrase[nñ]a)(\s+de acceso)?\s*:?\s*(?=[A-Za-z#*-]*\d)[A-Za-z0-9#*-]{3,}/gi, '$1$2')   // «código 4821#», «PIN: 0912»
    .replace(/\b(sk|xi|key|ghp|github_pat)[-_][A-Za-z0-9_-]{8,}/gi, '')
    .replace(/\(\s*\)/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
/* Lo que el usuario o un sistema escribió, cortado en una línea limpia. */
function avisoCorto_(s, n) {
  s = avisoSinDatos_(String(s == null ? '' : s).replace(/\s+/g, ' ')).replace(/[\s.]+$/, '');
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}
/* El primer nombre de quien escribió un correo (sin la dirección): «Ana Pérez <ana@…>» → «Ana Pérez»; solo correo → ''. */
function avisoQuien_(nombre, de) {
  var n = String(nombre || '').replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
  if (n && !/@/.test(n)) return avisoCorto_(n, 40);
  var m = /<?([\w.+-]+)@([\w-]+)\./.exec(String(de || n || ''));
  return m ? 'alguien de ' + m[2].charAt(0).toUpperCase() + m[2].slice(1) : 'alguien';
}

/* tipo + d → { texto, datos, titulo }. Un tipo que no está aquí devuelve el texto de d.texto, limpio. */
function avisoTexto_(tipo, d) {
  d = d || {};
  var q = function (x) { return '«' + avisoCorto_(x, 44) + '»'; };
  var det = d.detalle ? avisoCorto_(d.detalle, 100) : '';
  var lin = function (k, v) { return v ? k + ': ' + avisoCorto_(v, 104 - k.length) : ''; };
  var out;
  switch (tipo) {
    /* Lo que respondió el desarrollo (paraclaude.js). Sin «Claudio»: lo dice Alma, como trabajo suyo. */
    case 'claude_pregunta': out = { titulo: 'Necesito tu respuesta',
      texto: 'Revisé lo que me pediste de ' + q(d.titulo) + ' y tengo una duda antes de seguir; necesito tu respuesta.',
      datos: [lin('Pedido', d.titulo), lin('La duda', det), 'Dónde: en Pendientes, con las opciones'], voz: det }; break;
    case 'claude_listo': out = { titulo: 'Cambio por unir',
      texto: 'Ya quedó listo el cambio para ' + q(d.titulo) + '; solo falta que lo unas para que se publique.',
      datos: [lin('Pedido', d.titulo), 'Qué falta: que lo unas', 'Dónde: Pendientes → Unir'] }; break;
    case 'claude_fallo': out = { titulo: 'No se pudo',
      texto: 'Intenté ' + q(d.titulo) + ', pero no se pudo terminar; necesito que lo revises para ver cómo seguimos.',
      datos: [lin('Pedido', d.titulo), lin('Qué pasó', det || 'no quedó terminado'), 'Qué falta: que me digas cómo seguir'], voz: det ? 'El motivo: ' + det : '' }; break;
    case 'claude_unido': out = { titulo: 'Cambio unido',
      texto: 'Ya quedó unido el cambio de ' + q(d.titulo) + '; en unos minutos está publicado.',
      datos: [lin('Pedido', d.titulo), 'Estado: unido'] }; break;
    case 'claude_consulta': out = { titulo: 'Ya tengo la respuesta',
      texto: 'Ya tengo la respuesta a lo que preguntaste de ' + q(d.titulo) + '.',
      datos: [lin('Pedido', d.titulo), lin('Respuesta', det), 'Dónde: en tu chat con Alma'], voz: det ? 'En corto: ' + det : '' }; break;
    /* Escalar sola (escalar.js): lo que hizo falta cambiar para cumplir un pedido de Juan. */
    case 'escalar_entregado': out = { titulo: 'Ya está lo que pediste',
      texto: 'Ya está lo que me pediste de ' + q(d.nombre) + ': hizo falta un cambio, lo uní y te dejé el resultado en tu chat.',
      datos: [lin('Pedido', d.nombre), 'Estado: unido y entregado', 'Dónde: en tu chat con Alma'] }; break;
    case 'escalar_no_unido': out = { titulo: 'Cambio por revisar',
      texto: 'No pude unir sola el cambio de ' + q(d.nombre) + ' porque ' + avisoCorto_(d.causa, 50) + '; te lo dejé en Pendientes: ' + d.url,
      datos: [lin('Pedido', d.nombre), lin('Por qué', d.causa), 'Qué falta: que lo revises y lo unas'] }; break;
    case 'escalar_no_publico': out = { titulo: 'Falló la publicación',
      texto: 'Uní el cambio para ' + q(d.nombre) + ', pero falló al publicarse; hay que revisarlo: ' + d.url,
      datos: [lin('Pedido', d.nombre), 'Estado: unido, sin publicar', 'Qué falta: revisar la publicación'] }; break;
    /* Huéspedes (Código.js, promesas.js). */
    case 'huesped_espera': out = { titulo: d.escalado ? 'Huésped escalado' : 'Huésped en rojo',
      texto: 'Hay un huésped' + (d.propiedad ? ' en ' + avisoCorto_(d.propiedad, 40) : '') + ' esperando al equipo' + (d.escalado ? ': su caso está escalado' : ': está en rojo') + '; alguien tiene que responderle ya.',
      datos: [lin('Propiedad', d.propiedad), 'Estado: ' + (d.escalado ? 'escalado' : 'en rojo'), 'Qué falta: que alguien del equipo le responda'] }; break;
    case 'promesa_vencida': out = { titulo: 'Promesa sin cumplir',
      texto: Number(d.n) > 1 ? 'Hay ' + d.n + ' cosas que le prometimos a huéspedes y nadie ha cumplido todavía.' : 'Le prometimos algo a un huésped y nadie lo ha cumplido todavía.',
      datos: [lin(Number(d.n) > 1 ? 'La más reciente' : 'Qué prometimos', d.que), Number(d.n) > 1 ? 'Promesas vencidas: ' + d.n : '', 'Qué falta: que el equipo lo cumpla'] }; break;
    /* Vigilancias (vigilancias.js). */
    case 'vigilancia_paso': out = { titulo: 'Pasó lo que vigilaba',
      texto: 'Ya pasó lo que me pediste vigilar: ' + avisoCorto_(d.resumen, 70) + '.' + (d.avisar ? ' ' + avisoCorto_(d.avisar, 120) + (/[.!?]$/.test(avisoCorto_(d.avisar, 120)) ? '' : '.') : ''),
      datos: [lin('Qué vigilaba', d.resumen), lin('Qué cambió', det)], voz: det }; break;
    case 'vigilancia_error': out = { titulo: 'Dejé de vigilar',
      texto: 'Dejé de vigilar ' + avisoCorto_(d.resumen, 60) + ' porque tres veces seguidas no pude leerlo.',
      datos: [lin('Qué vigilaba', d.resumen), lin('Por qué', d.error)] }; break;
    case 'vigilancia_vencio': out = { titulo: 'Terminé de vigilar',
      texto: 'Terminé de vigilar ' + avisoCorto_(d.resumen, 60) + ': se cumplió el plazo y no cambió nada.',
      datos: [lin('Qué vigilaba', d.resumen), 'Resultado: no pasó nada'] }; break;
    /* Avisos de aterrizaje (avisovuelo.js). d.quienes: «Lucky y Ana». */
    case 'vuelo_sin_hora': out = { titulo: 'Sin hora de llegada',
      texto: 'No supe a qué hora aterrizó tu vuelo ' + d.vuelo + ', así que no le avisé a ' + avisoCorto_(d.quienes, 50) + '.',
      datos: [lin('Vuelo', d.vuelo), lin('A quién', d.quienes), 'Estado: sin avisar'] }; break;
    case 'vuelo_cancelado': out = { titulo: 'Vuelo cancelado',
      texto: 'Ojo, el proveedor dice que se canceló tu vuelo ' + d.vuelo + ' y no le he dicho nada a ' + avisoCorto_(d.quienes, 30) + '; ¿quieres que le escriba?',
      datos: [lin('Vuelo', d.vuelo), 'Estado: cancelado', lin('A quién', d.quienes)] }; break;
    case 'vuelo_aterrizo': out = { titulo: 'Avisé que aterrizaste',
      texto: 'Listo, ya le avisé a ' + avisoCorto_(d.quienes, 50) + ' que aterrizaste en ' + avisoCorto_(d.lugar, 40) + '.',
      datos: [lin('A quién', d.quienes), lin('Dónde', d.lugar), d.esperan ? 'Falta: ' + avisoCorto_(d.esperan, 40) + ' (no ha escrito en 24 h; le llega cuando conteste)' : ''] }; break;
    case 'vuelo_fallo': out = { titulo: 'No pude avisar',
      texto: 'No le pude avisar a ' + avisoCorto_(d.nombre, 40) + ' de tu vuelo ' + d.vuelo + '; ese mensaje no le llegó.',
      datos: [lin('Vuelo', d.vuelo), lin('A quién', d.nombre), lin('Por qué', d.error)] }; break;
    /* Correos (correo.js). Nunca la dirección: el nombre de quien escribió o «alguien de <dominio>». */
    case 'correo_autorizacion': out = { titulo: 'Correo por autorizar',
      texto: 'Te llegó un correo de ' + avisoQuien_(d.de_nombre, d.de) + ' que necesita tu autorización.',
      datos: [lin('Asunto', d.asunto), lin('De', avisoQuien_(d.de_nombre, d.de)), 'Qué falta: tu autorización'] }; break;
    case 'correo_respuesta': out = { titulo: 'Respuesta lista',
      texto: 'Ya te dejé lista la respuesta al correo ' + q(d.asunto) + '; si te parece, la mando con un toque.',
      datos: [lin('Asunto', d.asunto), 'Qué falta: que la revises', 'Dónde: Tus correos'] }; break;
    default: out = { titulo: '', texto: avisoCorto_(d.texto, 400), datos: [] };
  }
  out.texto = avisoSinDatos_(out.texto);
  out.voz = out.voz ? avisoSinDatos_(out.voz).replace(/([^.!?…])$/, '$1.') : '';
  out.datos = (out.datos || []).filter(Boolean).slice(0, 3);
  out.tipo = tipo || '';   // Alma abre (almaabre.js): qué resultado es, por su tipo
  return out;
}
/* Pone la notificación con su forma humana: vozAvisoPoner_ (voz.js) con el texto, los datos y el título. o: lo de siempre
   (nivel, resultado, historial…). Devuelve el texto, para quien lo usa también en otro lado (tema por retomar, chat). */
function avisoPoner_(adm, tipo, d, retId, o) {
  var a = avisoTexto_(tipo, d);
  vozAvisoPoner_(adm, a.texto, retId, Object.assign({}, o || {}, { datos: a.datos, titulo: a.titulo, voz: a.voz, tipo: tipo }));
  return a.texto;
}
