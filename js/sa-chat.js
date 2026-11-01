/* Spacio AM — piezas del chat estilo A (issue #317).
   Funciones puras (sin DOM) que leen un mensaje de Alma y dicen qué pintar debajo:
   · SAChat.opciones(texto): una pregunta seguida de 2 a 5 opciones → tarjeta de acción.
   · SAChat.enlaces(texto): códigos de reserva y enlaces https → filas con «›».
   · SAChat.pintor(contenedor, o): pinta el hilo con esas piezas (chat de la roca y «Alma aquí»).
   Se usan en el Hub (index.html), en el chat de la roca (js/sa-nav.js) y en «Alma aquí» (alma/index.html). */
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

  /* Ícono de cada opción por lo que dice (las mismas reglas que iconoOpcion del Hub). */
  var iconoOpcion = function (t) {
    t = String(t || "").toLowerCase();
    return /cancel|descart|no,|^no$|^no\b|borra|quita/.test(t) ? "x" : /agend|mañana|hoy|lunes|martes|miércoles|jueves|viernes|sábado|domingo|fecha|hora|\d{1,2}:\d\d/.test(t) ? "calendar"
      : /tarea|hecho|listo|^s[ií]\b|confirm|aprueb/.test(t) ? "check" : /edit|cambi|ajust|corrig/.test(t) ? "pencil" : /nota|guard|document|archivo/.test(t) ? "file"
      : /espera|luego|después|recuérd/.test(t) ? "clock" : /envi|mand|escrib|respond|mensaje/.test(t) ? "chat" : "arrowUpRight";
  };

  /* ── Pintor (DOM): el hilo del chat de la roca (js/sa-nav.js) y de «Alma aquí» (alma/index.html), con las clases de
     ds/chat.css. El Hub pinta con su propia plantilla. Agrupa: etiqueta arriba del grupo, avatar solo en la última burbuja
     de Alma, 4 px dentro del grupo y 14 entre grupos (.sa-chat-hilo). ── */
  var ICONOS = {
    chat: '<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9.5L5 20.5V6a1 1 0 0 1 1-1z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    arrowUpRight: '<path d="M7 17L17 7M9 7h8v8"/>'
  };
  var CHEVRON = '<svg class="sa-chat-chevron" viewBox="0 0 12 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3l5 5-5 5"/></svg>';
  var svgIcono = function (n) { return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONOS[n] || ICONOS.arrowUpRight) + "</svg>"; };
  var norm = function (t) { return String(t || "").toLowerCase().replace(/\s+/g, " ").replace(/[.!¡¿?]+$/, "").trim(); };
  var hora = function (t) { try { return new Date(t).toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

  /* o = { alElegir(titulo): envía la opción como tu mensaje · alAbrir(fila): abre una fila con «›» (si falta: la URL en
     pestaña nueva y la reserva en el Hub con ?conv=) · alPintar(): después de cada cambio (si falta, baja al final) }. */
  var pintor = function (cont, o) {
    o = o || {};
    var doc = cont.ownerDocument, ult = null, pens = null;
    cont.classList.add("sa-chat-hilo");
    var el = function (tag, cls, html) { var x = doc.createElement(tag); if (cls) x.className = cls; if (html) x.innerHTML = html; return x; };
    var listo = function () { if (o.alPintar) o.alPintar(); else cont.scrollTop = cont.scrollHeight; };
    var poner = function (x) { cont.insertBefore(x, pens && pens.parentNode === cont ? pens : null); };
    var avatar = function () { var a = el("span", "sa-chat-avatar sa-chat-avatar--alma"); a.setAttribute("aria-hidden", "true"); return a; };
    /* Un mensaje nuevo: sigue el grupo si es del mismo lado y llegó en menos de 5 min. */
    var mensaje = function (de, t) {
      var junto = !!ult && ult.de === de && ult.el.parentNode === cont && Math.abs(t - ult.t) < 300000;
      var m = el("div", "sa-chat-msg sa-chat-msg--" + (de === "alma" ? "otro" : "mia") + (junto ? " sa-chat-msg--sigue" : ""));
      if (!junto) { var e = el("span", "sa-chat-etiqueta"); e.textContent = (de === "alma" ? "Alma · " : "") + hora(t); m.appendChild(e); }
      var fila = el("div", "sa-chat-fila"), cuerpo = el("div", "sa-chat-cuerpo");
      if (de === "alma") {
        var slot = el("span", "sa-chat-slot"), av = junto && ult.el.querySelector(".sa-chat-avatar");
        if (av) av.style.visibility = ""; slot.appendChild(av || avatar()); fila.appendChild(slot);
      }
      fila.appendChild(cuerpo); m.appendChild(fila); poner(m);
      ult = { de: de, t: t, el: m };
      return cuerpo;
    };
    var burbuja = function (cuerpo, texto, cls) { var b = el("div", "sa-chat-burbuja " + cls); b.textContent = texto; cuerpo.appendChild(b); return b; };
    var filaOpcion = function (op, tag) {
      var b = el(tag, "sa-chat-opcion" + (tag === "div" ? " sa-chat-opcion--fija" : ""), '<span class="sa-chat-icono">' + svgIcono(iconoOpcion(op.titulo)) + '</span><span class="sa-chat-opcion-texto"><span class="sa-chat-opcion-titulo"></span></span>');
      b.querySelector(".sa-chat-opcion-titulo").textContent = op.titulo;
      if (op.detalle) { var dd = el("span", "sa-chat-opcion-detalle"); dd.textContent = op.detalle; b.querySelector(".sa-chat-opcion-texto").appendChild(dd); }
      return b;
    };
    var abrir = function (f) {
      if (o.alAbrir) { o.alAbrir(f); return; }
      if (f.tipo === "url") window.open(f.url, "_blank", "noopener");
      else window.open("https://hub.spacioam.com/?conv=" + encodeURIComponent(f.codigo), "_blank", "noopener");
    };
    var api = {
      /* Lo que dice Alma: burbuja, su tarjeta de acción (si trae opciones) y sus filas con «›» (reservas y enlaces). */
      alma: function (texto, ts) {
        api.pensando(false);
        texto = String(texto == null ? "" : texto).trim(); if (!texto) return;
        var op = opciones(texto), cuerpoTxt = op ? op.texto : texto, cuerpo = mensaje("alma", ts || Date.now());
        if (cuerpoTxt) burbuja(cuerpo, cuerpoTxt, "sa-chat-burbuja--otro");
        if (op) {
          var tj = el("div", "sa-chat-tarjeta"); tj.setAttribute("role", "group"); tj.setAttribute("aria-label", "Opciones de Alma");
          op.opciones.forEach(function (x) {
            var b = filaOpcion(x, "button"); b.type = "button"; b._op = x;
            b.onclick = function () { if (b.disabled) return; if (o.alElegir) o.alElegir(x.titulo); };
            tj.appendChild(b);
          });
          cuerpo.appendChild(tj);
        }
        var fs = enlaces(cuerpoTxt);
        if (fs.length) {
          var te = el("div", "sa-chat-tarjeta sa-chat-enlaces");
          fs.forEach(function (f) { var b = el("button", "sa-chat-enlace", "<span></span>" + CHEVRON); b.type = "button"; b.firstChild.textContent = f.titulo; b.onclick = function () { abrir(f); }; te.appendChild(b); });
          cuerpo.appendChild(te);
        }
        listo();
      },
      /* Lo tuyo. Si es una de las opciones abiertas, se pinta como la tarjeta elegida; desde aquí las opciones de antes se apagan. */
      yo: function (texto, ts) {
        texto = String(texto == null ? "" : texto).trim(); if (!texto) return;
        var abiertas = cont.querySelectorAll(".sa-chat-opcion:not(:disabled)"), elegida = null;
        Array.prototype.forEach.call(abiertas, function (b) { if (!elegida && b._op && norm(b._op.titulo) === norm(texto)) elegida = b._op; b.disabled = true; });
        var cuerpo = mensaje("yo", ts || Date.now());
        if (elegida) { var tj = el("div", "sa-chat-tarjeta sa-chat-tarjeta--elegida"); tj.appendChild(filaOpcion(elegida, "div")); cuerpo.appendChild(tj); }
        else burbuja(cuerpo, texto, "sa-chat-burbuja--mia");
        listo();
      },
      /* Una foto tuya (data: o URL). */
      foto: function (src, ts) { var cuerpo = mensaje("yo", ts || Date.now()), f = el("div", "sa-chat-foto"), im = el("img"); im.src = src; im.alt = "Foto"; f.appendChild(im); cuerpo.appendChild(f); listo(); },
      /* Una línea al centro (avisos: «No pude mandar la foto»). */
      nota: function (texto) { var n = el("div", "sa-chat-nota"); n.textContent = texto; poner(n); ult = null; listo(); return n; },
      /* «Pensando»: la burbuja con las 2 barras que brillan, mientras Alma responde. Lleva el avatar del grupo. */
      pensando: function (on) {
        if (!on) {
          if (pens) { if (pens.parentNode) pens.parentNode.removeChild(pens); pens = null; var av = ult && ult.el.parentNode === cont && ult.el.querySelector(".sa-chat-avatar"); if (av) av.style.visibility = ""; }
          return;
        }
        if (pens && pens.parentNode === cont) return;
        var junto = !!ult && ult.de === "alma" && ult.el.parentNode === cont && Date.now() - ult.t < 300000;
        pens = el("div", "sa-chat-msg sa-chat-msg--otro" + (junto ? " sa-chat-msg--sigue" : ""), '<div class="sa-chat-fila"><span class="sa-chat-slot"></span><div class="sa-chat-pensando"><span class="sa-chat-barra"></span><span class="sa-chat-barra"></span></div></div>');
        pens.setAttribute("role", "status"); pens.setAttribute("aria-label", "Alma está pensando");
        pens.querySelector(".sa-chat-slot").appendChild(avatar());
        if (junto) { var a0 = ult.el.querySelector(".sa-chat-avatar"); if (a0) a0.style.visibility = "hidden"; }
        cont.appendChild(pens); listo();
      },
      vaciar: function () { cont.innerHTML = ""; ult = null; pens = null; }
    };
    return api;
  };

  var SAChat = { opciones: opciones, enlaces: enlaces, iconoOpcion: iconoOpcion, pintor: pintor };
  if (typeof module !== "undefined" && module.exports) module.exports = SAChat;
  raiz.SAChat = SAChat;
})(typeof window !== "undefined" ? window : globalThis);
