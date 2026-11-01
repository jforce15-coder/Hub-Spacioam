/* Spacio AM — piezas del chat estilo A (issue #317).
   Funciones puras (sin DOM) que leen un mensaje de Alma y dicen qué pintar debajo:
   · SAChat.opciones(texto): una pregunta seguida de 2 a 5 opciones → tarjeta de acción.
   · SAChat.enlaces(texto): códigos de reserva y enlaces https → filas con «›».
   Se usan en el Hub (index.html) y en el chat de la roca. */
(function (raiz) {
  "use strict";

  /* Una línea de lista: «• x», «- x», «* x», «1. x» o «1) x». */
  var VINETA = /^\s*(?:[•\-*–]|\d{1,2}[.)])\s+(.+?)\s*$/;
  var MIN = 2, MAX = 5, LARGO_MAX = 90;

  /* «Título — detalle» (raya, semirraya o guion con espacios) separa el subtítulo de la opción. */
  var opcion = function (t) {
    t = String(t || "").replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
    if (!t) return null;
    var m = t.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    var o = { titulo: (m ? m[1] : t).replace(/[.;,]$/, "").trim() };
    if (m) o.detalle = m[2].trim();
    return o.titulo ? o : null;
  };

  var limpiar = function (lineas) { return lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim(); };

  /* Bloque explícito: [[opciones]] a | b | c [[/opciones]] (Alma lo puede mandar así cuando quiere botones). */
  var deBloque = function (texto) {
    var m = texto.match(/\[\[opciones\]\]([\s\S]*?)\[\[\/opciones\]\]/i);
    if (!m) return null;
    var ops = m[1].split(/\||\n/).map(opcion).filter(Boolean);
    if (ops.length < MIN || ops.length > MAX) return null;
    var resto = (texto.slice(0, m.index) + "\n" + texto.slice(m.index + m[0].length)).split("\n");
    return { texto: limpiar(resto), opciones: ops };
  };

  /* Pregunta + lista: la línea con «?» justo antes (se permiten líneas en blanco) de 2 a 5 viñetas cortas. */
  var deLista = function (texto) {
    var L = texto.split("\n");
    for (var i = 0; i < L.length; i++) {
      if (!/\?\s*:?\s*$/.test(L[i])) continue;
      var j = i + 1; while (j < L.length && !L[j].trim()) j++;
      var ops = [], k = j;
      for (; k < L.length; k++) {
        var mv = L[k].match(VINETA);
        if (!mv) break;
        ops.push(mv[1]);
      }
      if (ops.length < MIN || ops.length > MAX) continue;
      if (ops.some(function (x) { return x.length > LARGO_MAX; })) continue;
      /* Si la lista sigue (más viñetas tras una línea en blanco), no son opciones: es una lista larga. */
      var k2 = k; while (k2 < L.length && !L[k2].trim()) k2++;
      if (k2 < L.length && VINETA.test(L[k2])) continue;
      var lista = ops.map(opcion).filter(Boolean);
      if (lista.length < MIN) continue;
      return { texto: limpiar(L.slice(0, i + 1).concat(L.slice(k))), opciones: lista };
    }
    return null;
  };

  var opciones = function (texto) {
    texto = String(texto == null ? "" : texto).replace(/\r\n?/g, "\n");
    if (!texto.trim()) return null;
    return deBloque(texto) || deLista(texto);
  };

  /* Códigos de reserva de Hospitable (HM + 8 letras o números) y enlaces https: una fila por cada uno, sin repetir. */
  var enlaces = function (texto) {
    texto = String(texto == null ? "" : texto);
    var filas = [], visto = {};
    var urls = texto.match(/https:\/\/[^\s<>"'`]+/g) || [];
    var sinUrls = texto.replace(/https:\/\/[^\s<>"'`]+/g, " ");
    (sinUrls.match(/\bHM[A-Z0-9]{8}\b/g) || []).forEach(function (c) {
      if (visto[c]) return; visto[c] = 1;
      filas.push({ tipo: "reserva", codigo: c, titulo: "Ver reserva " + c });
    });
    urls.forEach(function (u) {
      u = u.replace(/[.,;:!?)\]}»”]+$/, "");
      if (visto[u] || u.length < 12) return; visto[u] = 1;
      var host = u.replace(/^https:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "");
      filas.push({ tipo: "url", url: u, titulo: "Abrir " + host });
    });
    return filas.slice(0, 4);
  };

  var SAChat = { opciones: opciones, enlaces: enlaces };
  if (typeof module !== "undefined" && module.exports) module.exports = SAChat;
  raiz.SAChat = SAChat;
})(typeof window !== "undefined" ? window : globalThis);
