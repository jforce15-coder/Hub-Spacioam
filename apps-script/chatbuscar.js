/* ═══ BUSCAR EN MI CHAT ═══════════════════════════════════════════════════════════════════════════════
   Alma solo ve las últimas 6 h de su Chat con Alma con quien le habla (agente.js: 24 mensajes) y unos pocos anteriores.
   Lo de ayer o del viernes (un borrador que redactó, lo que se acordó) quedaba fuera y no tenía cómo buscarlo
   (pedido pc1794697915354: el borrador para el socio de Narama 633 que empezaba «Listo con ese cambio. Hola, Axel…»).
   buscar_en_mi_chat lee ALMA_OPERATIVO completo (la hoja viva y el archivo de memoria larga, archivo.js) y devuelve
   los mensajes enteros de ESE chat, sin recortar. Cada quien solo busca en el suyo: el correo sale de la sesión
   (adm), nunca del modelo. Solo lee: no cambia nada. */
var CHATB_MAX_ = 6, CHATB_LARGO_ = 3500;
var CHATB_VACIAS_ = ['que', 'del', 'los', 'las', 'una', 'uno', 'con', 'por', 'para', 'sobre', 'esa', 'ese', 'este', 'esta', 'mensaje', 'borrador'];

function chatBuscar_(adm, inp) {
  var yo = String((adm && adm.email) || '').toLowerCase(); if (!yo) return { error: 'No sé de quién es el chat.' };
  inp = inp || {};
  var frase = norm_(inp.texto).replace(/[«»"“”'‘’…]+/g, ' ').replace(/\.{3,}/g, ' ').replace(/\s+/g, ' ').trim();
  var palabras = frase.split(' ').filter(function (w) { return w.length >= 3 && CHATB_VACIAS_.indexOf(w) < 0; });
  var tz = (typeof CFG !== 'undefined' && CFG.TZ) || 'America/Guatemala';
  var dia = function (ms) { return Utilities.formatDate(new Date(ms), tz, 'yyyy-MM-dd'); };
  var desde = /^\d{4}-\d{2}-\d{2}$/.test(String(inp.desde || '')) ? String(inp.desde) : '';
  var hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(inp.hasta || '')) ? String(inp.hasta) : desde;
  var de = inp.de === 'alma' || inp.de === 'yo' ? inp.de : '';
  if (!palabras.length && !desde) return { error: 'Dime qué buscar (unas palabras del mensaje) o el día (desde, YYYY-MM-DD).' };

  /* El chat de esta persona, en orden, con la hoja viva y el archivo juntos (cerebro_fuentes.js). */
  var chat = cerFilasConArchivo_('ALMA_OPERATIVO').filter(function (r) { return String(r.usuario || '').toLowerCase() === yo && String(r.texto || '').trim(); })
    .map(function (r) { return { ms: cerMs_(r.ts), de: String(r.de || ''), canal: String(r.canal || ''), texto: String(r.texto || ''), id: String(r.id || '') }; })
    .filter(function (m) { return m.ms; }).sort(function (a, b) { return a.ms - b.ms; });

  var hits = [];
  chat.forEach(function (m, i) {
    var d = dia(m.ms); if (desde && (d < desde || d > hasta)) return;
    if (de && m.de !== de) return;
    var t = norm_(m.texto), p = 0;
    if (palabras.length) {
      p = palabras.filter(function (w) { return t.indexOf(w) >= 0; }).length / palabras.length;
      if (frase.length >= 8 && t.indexOf(frase) >= 0) p += 1;   // la frase tal cual pesa más que las palabras sueltas
      if (p < 0.6) return;
    }
    hits.push({ i: i, p: p, ms: m.ms });
  });
  /* Lo que más coincide primero; a igual coincidencia, lo más nuevo. */
  hits.sort(function (a, b) { return b.p - a.p || b.ms - a.ms; });
  var total = hits.length;
  var mensajes = hits.slice(0, CHATB_MAX_).map(function (h) {
    var m = chat[h.i], antes = chat[h.i - 1];
    return { fecha: Utilities.formatDate(new Date(m.ms), tz, 'EEEE yyyy-MM-dd HH:mm'), de: m.de === 'yo' ? 'administrador' : 'Alma',
      canal: m.canal || 'hub', texto: m.texto.slice(0, CHATB_LARGO_) + (m.texto.length > CHATB_LARGO_ ? '…' : ''),
      antes: antes && antes.ms > m.ms - 6 * 3600000 ? (antes.de === 'yo' ? 'administrador' : 'Alma') + ': ' + antes.texto.slice(0, 300) : undefined };
  });
  return { ok: true, encontrados: total, mensajes: mensajes,
    nota: total ? (total > CHATB_MAX_ ? 'Hay ' + total + ' coincidencias; muestro las ' + CHATB_MAX_ + ' que más se parecen. Si no es ninguna, busca con otras palabras o con el día.' : undefined)
      : 'No encontré ese mensaje en tu chat (' + chat.length + ' mensajes revisados). Prueba con otras palabras o solo con el día.' };
}
