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

  /* Las 6 esferas del chat único (#334), con el color y el ícono del inicio de la app (alma/inicio.html, AV_COLOR).
     c3 = el tono oscuro, legible en texto. */
  var ESFERAS = [
    { n: "Propósito", k: "proposito", c: "#E9826A", c3: "#C9705E", i: '<path d="M3.5 16.5h17"/><path d="M7 16.5a5 5 0 0 1 10 0"/><path d="M12 5.5v2.2M5.6 8.6l1.5 1.5M18.4 8.6l-1.5 1.5"/>' },
    { n: "Relaciones", k: "relaciones", c: "#D99AA0", c3: "#B06F7A", i: '<circle cx="9.2" cy="12" r="5"/><circle cx="14.8" cy="12" r="5"/>' },
    { n: "Finanzas", k: "finanzas", c: "#8FB38C", c3: "#5F8A5E", i: '<path d="M6 18.5v-4M12 18.5v-8M18 18.5V5.5"/>' },
    { n: "Health", k: "health", c: "#E3A47F", c3: "#C47E52", i: '<path d="M18.5 5.5C10 5.5 5.5 10 5.5 18.5c8.5 0 13-4.5 13-13z"/><path d="M5.5 18.5l7-7"/>' },
    { n: "Comunidad", k: "comunidad", c: "#8FA5C8", c3: "#5F7BA8", i: '<circle cx="12" cy="7" r="2.8"/><circle cx="6.3" cy="16" r="2.8"/><circle cx="17.7" cy="16" r="2.8"/>' },
    { n: "Esencia", k: "espiritualidad", c: "#A9A4CC", c3: "#7C76A8", i: '<circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="12" r="5"/><path d="M12 3.4a8.6 8.6 0 0 1 8.6 8.6M12 20.6A8.6 8.6 0 0 1 3.4 12"/>' }
  ];
  /* «Finanzas», «finanzas», «Proposito» o «espiritualidad» → su esfera (o null). */
  var esfera = function (n) {
    var t = String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    for (var i = 0; i < ESFERAS.length; i++) { var z = ESFERAS[i]; if (t && (t === z.k || t === z.n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) return z; }
    return null;
  };

  /* Ícono de cada opción por lo que dice (las mismas reglas que iconoOpcion del Hub). */
  var iconoOpcion = function (t) {
    t = String(t || "").toLowerCase();
    return /cancel|descart|no,|^no$|^no\b|borra|quita/.test(t) ? "x" : /agend|mañana|hoy|lunes|martes|miércoles|jueves|viernes|sábado|domingo|fecha|hora|\d{1,2}:\d\d/.test(t) ? "calendar"
      : /tarea|hecho|listo|^s[ií]\b|confirm|aprueb/.test(t) ? "check" : /edit|cambi|ajust|corrig/.test(t) ? "pencil" : /nota|guard|document|archivo/.test(t) ? "file"
      : /espera|luego|después|recuérd/.test(t) ? "clock" : /envi|mand|escrib|respond|mensaje/.test(t) ? "chat" : "arrowUpRight";
  };

  /* ── La fila de esferas (#334): ícono, color y cuántos mensajes de cada una; la elegida en su color y las demás atrás.
     La usan el chat único (abajo) y el chat con Alma del Hub (index.html). Crea los 6 botones una vez; pintar() solo
     cambia números y clases. o = { alElegir(nombre) }: quien la usa decide si filtra o quita el filtro. ── */
  var filaEsferas = function (cont, o) {
    var doc = cont.ownerDocument, botones = {};
    var svg = function (p) { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>"; };
    cont.innerHTML = ""; cont.classList.add("sa-chat-esferas"); cont.setAttribute("role", "toolbar"); cont.setAttribute("aria-label", "Filtrar por esfera");
    ESFERAS.forEach(function (z) {
      var b = doc.createElement("button"); b.type = "button"; b.className = "sa-chat-esf"; b.style.setProperty("--c", z.c);
      b.innerHTML = '<span class="sa-chat-esf-pz">' + svg(z.i) + '<i class="sa-chat-esf-ct"></i></span><span class="sa-chat-esf-nm"></span>';
      b.querySelector(".sa-chat-esf-nm").textContent = z.n;
      b.onclick = function () { if (o && o.alElegir) o.alElegir(z.n); };
      cont.appendChild(b); botones[z.n] = b;
    });
    return {
      /* conteo = { Propósito: 12, … } · activa = la esfera filtrada o "". */
      pintar: function (conteo, activa) {
        cont.classList.toggle("sa-chat-esferas--filtro", !!activa);
        ESFERAS.forEach(function (z) {
          var b = botones[z.n], n = conteo ? Number(conteo[z.n]) || 0 : 0, ct = b.querySelector(".sa-chat-esf-ct"), on = activa === z.n;
          ct.textContent = n > 99 ? "99+" : String(n); ct.hidden = !n;
          b.classList.toggle("sa-chat-esf--vacia", !n); b.classList.toggle("sa-chat-esf--on", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
          b.setAttribute("aria-label", z.n + ": " + n + (n === 1 ? " mensaje" : " mensajes") + (on ? " · toca para ver todas" : ""));
        });
      }
    };
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
    /* Un mensaje nuevo: sigue el grupo si es del mismo lado, de la misma esfera y llegó en menos de 5 min.
       Alma lleva su esfera (chat único, #334): «Alma · Finanzas · 9:05 a. m.» y un punto de su color en el avatar. */
    var mensaje = function (de, t, meta) {
      var z = de === "alma" && meta ? esfera(meta.esfera) : null, sub = z && meta.subcategoria ? String(meta.subcategoria) : "";
      var clave = z ? z.n + "·" + sub : "";
      var junto = !!ult && ult.de === de && ult.el.parentNode === cont && Math.abs(t - ult.t) < 300000 && ult.clave === clave;
      var m = el("div", "sa-chat-msg sa-chat-msg--" + (de === "alma" ? "otro" : "mia") + (junto ? " sa-chat-msg--sigue" : ""));
      if (!junto) {
        var e = el("span", "sa-chat-etiqueta");
        if (de === "alma") {
          e.appendChild(doc.createTextNode("Alma · "));
          if (z) { var ez = el("span", "sa-chat-etiqueta-esfera"); ez.style.color = z.c3; ez.textContent = z.n + (sub ? " · " + sub : ""); e.appendChild(ez); e.appendChild(doc.createTextNode(" · ")); }
          e.appendChild(doc.createTextNode(hora(t)));
        } else e.textContent = hora(t);
        m.appendChild(e);
      }
      var fila = el("div", "sa-chat-fila"), cuerpo = el("div", "sa-chat-cuerpo");
      if (de === "alma") {
        var slot = el("span", "sa-chat-slot"), av = junto && ult.el.querySelector(".sa-chat-avatar"), pt = junto && ult.el.querySelector(".sa-chat-esf-punto");
        if (av) av.style.visibility = ""; slot.appendChild(av || avatar());
        if (pt) { pt.style.visibility = ""; slot.appendChild(pt); } else if (z) { var p = el("i", "sa-chat-esf-punto"); p.style.background = z.c; p.setAttribute("aria-hidden", "true"); slot.appendChild(p); }
        fila.appendChild(slot);
      }
      fila.appendChild(cuerpo); m.appendChild(fila); poner(m);
      ult = { de: de, t: t, el: m, clave: clave };
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
      /* meta = { esfera, subcategoria } del mensaje (opcional). */
      alma: function (texto, ts, meta) {
        api.pensando(false);
        texto = String(texto == null ? "" : texto).trim(); if (!texto) return;
        var op = opciones(texto), cuerpoTxt = op ? op.texto : texto, cuerpo = mensaje("alma", ts || Date.now(), meta);
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
          if (pens) { if (pens.parentNode) pens.parentNode.removeChild(pens); pens = null; if (ult && ult.el.parentNode === cont) Array.prototype.forEach.call(ult.el.querySelectorAll(".sa-chat-avatar,.sa-chat-esf-punto"), function (x) { x.style.visibility = ""; }); }
          return;
        }
        if (pens && pens.parentNode === cont) return;
        var junto = !!ult && ult.de === "alma" && ult.el.parentNode === cont && Date.now() - ult.t < 300000;
        pens = el("div", "sa-chat-msg sa-chat-msg--otro" + (junto ? " sa-chat-msg--sigue" : ""), '<div class="sa-chat-fila"><span class="sa-chat-slot"></span><div class="sa-chat-pensando"><span class="sa-chat-barra"></span><span class="sa-chat-barra"></span></div></div>');
        pens.setAttribute("role", "status"); pens.setAttribute("aria-label", "Alma está pensando");
        pens.querySelector(".sa-chat-slot").appendChild(avatar());
        if (junto) { var a0 = ult.el.querySelector(".sa-chat-avatar"), p0 = ult.el.querySelector(".sa-chat-esf-punto"); if (a0) a0.style.visibility = "hidden"; if (p0) p0.style.visibility = "hidden"; }
        cont.appendChild(pens); listo();
      },
      vaciar: function () { cont.innerHTML = ""; ult = null; pens = null; }
    };
    return api;
  };


  /* ── Chat único con Alma (#334): el mismo chat en la app, en «Alma aquí» y en el Hub, guardado en vivo.
     Abre limpio (con su saludo) y la píldora «Cargar historial» arriba trae la página anterior (opHilo, 40 por vez);
     si hay más, la píldora se queda arriba. La fila de esferas (ícono, color y cuántos mensajes) filtra el hilo: tocar una
     pide al servidor solo esa esfera (o filtra lo que ya está si aún no pediste historial); tocarla otra vez = todas.
     El total va en la insignia del avatar de Alma. La fila aparece cuando hay mensajes.
     o = { hilo: contenedor del hilo, fila: contenedor de la fila de esferas, insignia: el número junto a Alma,
           api: { hilo(params): Promise<{ok, mensajes, conteo, hayMas, antes}>, enviar(texto): Promise<{ok, yo, alma}> },
           saludo: texto para el hilo vacío (opcional), alAbrir(fila), alElegir(titulo) (si falta, la envía),
           alEnviar(), alResponder() (avisos para quien lo usa), limpio(texto) (limpia lo que dice Alma) }. ── */
  var unico = function (o) {
    var doc = o.hilo.ownerDocument;
    var limpio = o.limpio || function (t) { return String(t || "").replace(/\[(?!\[)[^\[\]\n]{1,40}\](?!\])/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim(); };
    var S, pintando = false, esperando = 0;
    var vista = function (e) { return { esfera: e || "", msgs: [], antes: "", hayMas: true, cargado: false, pidiendo: false }; };
    var reiniciar = function () { S = { todas: vista(""), v: null, conteo: null, contando: false, historial: false }; S.v = S.todas; esperando = 0; };
    reiniciar();
    var pt = pintor(o.hilo, {
      alElegir: function (t) { if (o.alElegir) o.alElegir(t); else u.enviar(t); },
      alAbrir: o.alAbrir,
      alPintar: function () { if (!pintando) { o.hilo.scrollTop = o.hilo.scrollHeight; abajo = true; } }
    });
    /* Si estabas al final y el hilo cambia de alto (el encabezado se agranda al soltar el teclado), sigues al final. */
    var abajo = true;
    o.hilo.addEventListener("scroll", function () { if (!pintando) abajo = o.hilo.scrollHeight - o.hilo.scrollTop - o.hilo.clientHeight < 48; }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(function () { if (abajo) o.hilo.scrollTop = o.hilo.scrollHeight; }).observe(o.hilo);
    var tiempo = function (m) { var t = typeof m.ts === "number" ? m.ts : Date.parse(m.ts || ""); return isNaN(t) ? 0 : t; };
    var esDe = function (m, e) { var z = esfera(m.esfera); return (z ? z.n : "Propósito") === e; };
    var svg = function (p, s) { return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>"; };

    /* La fila de esferas y la insignia: solo con mensajes y cuando ya se sabe el conteo. */
    var botones = o.fila ? filaEsferas(o.fila, { alElegir: function (n) { u.filtro(S.v.esfera === n ? "" : n); } }) : null;
    var fila = function () {
      var hay = S.todas.msgs.length > 0 || S.v.msgs.length > 0, C = S.conteo, total = 0;
      if (C) ESFERAS.forEach(function (z) { total += Number(C[z.n]) || 0; });
      if (o.insignia) { o.insignia.hidden = !(C && hay && total > 0); o.insignia.textContent = total > 999 ? "999+" : String(total); o.insignia.setAttribute("aria-label", total + " mensajes en total"); }
      if (!o.fila) return;
      o.fila.hidden = !(C && hay);
      if (!o.fila.hidden) botones.pintar(C, S.v.esfera);
    };
    var contar = function () {
      if (S.conteo || S.contando || !o.api || !o.api.hilo) return;
      S.contando = true;
      Promise.resolve(o.api.hilo({ n: 1 })).then(function (r) { S.contando = false; if (r && r.ok && r.conteo) { S.conteo = r.conteo; fila(); } }, function () { S.contando = false; });
    };

    /* La píldora «Cargar historial» arriba del hilo. */
    var pildora = function () {
      var v = S.v; if (v.cargado && !v.hayMas) return null;
      var b = doc.createElement("button"); b.type = "button"; b.className = "sa-chat-pildora";
      b.innerHTML = svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 14) + "<span></span>";
      b.lastChild.textContent = v.pidiendo ? "Cargando…" : "Cargar historial";
      b.disabled = v.pidiendo; if (v.pidiendo) b.setAttribute("aria-busy", "true");
      b.onclick = function () { u.cargar(); };
      return b;
    };
    var pintaUno = function (m) {
      if (m.foto) pt.foto(m.foto, tiempo(m));
      else if (m.de === "yo") pt.yo(m.texto, tiempo(m));
      else pt.alma(limpio(m.texto), tiempo(m), m);
    };
    /* Repinta la vista (al cargar una página o al cambiar de filtro). quieto: deja a la vista lo que estabas leyendo. */
    var pintar = function (quieto) {
      var h0 = o.hilo.scrollHeight, t0 = o.hilo.scrollTop;
      pintando = true; pt.vaciar();
      var p = pildora(); if (p) o.hilo.appendChild(p);
      var v = S.v;
      if (!v.msgs.length) {
        if (v.esfera && v.cargado) pt.nota("Aún no hay mensajes de " + v.esfera + ".");
        else if (!v.esfera && o.saludo) pt.nota(o.saludo);
      }
      v.msgs.forEach(pintaUno);
      Array.prototype.forEach.call(o.hilo.children, function (c) { c.classList.add("sa-chat-ya"); });   // repintar no anima de nuevo lo que ya estaba
      if (esperando) pt.pensando(true);
      o.hilo.classList.toggle("sa-chat-hilo--historial", S.historial && S.todas.msgs.length > 0);
      pintando = false;
      fila();   // antes de bajar: la fila de esferas que aparece le quita alto al hilo
      /* Página anterior: lo que leías se queda en su lugar. Primera carga (no había nada que leer): al final. */
      if (quieto && h0 > o.hilo.clientHeight + 4) o.hilo.scrollTop = Math.max(0, o.hilo.scrollHeight - h0 + t0); else { o.hilo.scrollTop = o.hilo.scrollHeight; abajo = true; }
    };
    /* Un mensaje nuevo (tuyo, de Alma o de la voz): a todas y, si es de la esfera filtrada (o es tuyo), a la vista. */
    var agregar = function (m, siempre) {
      S.todas.msgs.push(m);
      if (S.v !== S.todas && (siempre || esDe(m, S.v.esfera))) S.v.msgs.push(m);
      fila();
      if (S.v === S.todas || siempre || esDe(m, S.v.esfera)) {
        var nota = o.hilo.querySelector(".sa-chat-nota"); if (nota && !nota._fija) nota.remove();
        pintaUno(m);
      }
    };
    var unir = function (lista, nuevos) {
      var ids = {}; lista.forEach(function (m) { if (m.id) ids[m.id] = 1; });
      var L = nuevos.filter(function (m) { return !(m.id && ids[m.id]); }).concat(lista);
      return L.sort(function (a, b) { return tiempo(a) - tiempo(b); });
    };
    var cursor = function (v) {
      if (v.antes) return v.antes;
      var t = v.msgs.length ? tiempo(v.msgs[0]) : 0; return t ? new Date(t).toISOString() : "";
    };
    var errorTexto = function (r) {
      var e = (r && r.error) || "";
      return e === "session" ? "Tu sesión venció. Entra otra vez al Hub para seguir." : "No pude responder ahora (" + (e || "sin conexión") + "). Intenta de nuevo.";
    };

    var u = {
      /* La página anterior de la vista actual (todas o una esfera). */
      cargar: function () {
        var v = S.v; if (v.pidiendo || !o.api || !o.api.hilo) return Promise.resolve();
        v.pidiendo = true; pintar(true);
        var q = { n: 40 }, c = cursor(v); if (c) q.antes = c; if (v.esfera) q.esfera = v.esfera;
        return Promise.resolve(o.api.hilo(q)).then(function (r) {
          v.pidiendo = false;
          if (!(r && r.ok)) { if (S.v === v) { pintar(true); pt.nota(r && r.error === "session" ? errorTexto(r) : "No pude traer el historial. Intenta de nuevo."); } return; }
          v.cargado = true; v.hayMas = !!r.hayMas; if (r.antes) v.antes = r.antes;
          v.msgs = unir(v.msgs, r.mensajes || []);
          if (r.conteo) S.conteo = r.conteo;
          S.historial = true;   // desde aquí los filtros piden su esfera al servidor
          if (S.v === v) pintar(true);
        }, function () { v.pidiendo = false; if (S.v === v) { pintar(true); pt.nota("No pude traer el historial (sin conexión)."); } });
      },
      /* Filtra por una esfera («Finanzas») o "" = todas. Si ya pediste historial, la esfera se pide al servidor.
         traer: la pide al servidor ya (abrir el chat en una esfera, p. ej. desde una pregunta sin responder en Pendientes). */
      filtro: function (e, traer) {
        var z = esfera(e); e = z ? z.n : "";
        if (e === S.v.esfera) { if (traer && e && !S.v.cargado) u.cargar(); return; }
        if (!e) { S.v = S.todas; pintar(); return; }
        var v = vista(e); v.msgs = S.todas.msgs.filter(function (m) { return esDe(m, e); });
        S.v = v; pintar();
        if (S.historial || traer) u.cargar();
      },
      esfera: function () { return S.v.esfera; },
      /* Lo tuyo, al instante (devuelve el mensaje para mandar() después). */
      yo: function (texto) { var m = { de: "yo", texto: String(texto || "").trim(), ts: Date.now() }; if (!m.texto) return null; agregar(m, true); return m; },
      /* Manda al servidor (texto puede llevar contexto extra que no se pinta). m: tu mensaje ya pintado (o null). */
      mandar: function (m, texto) {
        esperando++; pt.pensando(true); if (o.alEnviar) o.alEnviar();
        var fin = function () { esperando = Math.max(0, esperando - 1); if (o.alResponder) o.alResponder(); };
        return Promise.resolve(o.api.enviar(texto)).then(function (r) {
          fin();
          if (!(r && r.ok && r.alma)) { pt.pensando(false); agregar({ de: "alma", texto: errorTexto(r), ts: Date.now(), local: true }, true); return r; }
          if (m && r.yo) { m.id = r.yo.id; m.ts = r.yo.ts || m.ts; m.esfera = r.yo.esfera || ""; m.subcategoria = r.yo.subcategoria || ""; }
          var a = { de: "alma", texto: r.alma.texto, ts: r.alma.ts || Date.now(), id: r.alma.id, esfera: r.alma.esfera || "", subcategoria: r.alma.subcategoria || "", acciones: r.alma.acciones || [] };
          if (S.conteo) { var z = esfera(a.esfera), k = z ? z.n : "Propósito"; S.conteo[k] = (Number(S.conteo[k]) || 0) + (m ? 2 : 1); }
          agregar(a, true); contar();
          return r;
        }, function () { fin(); pt.pensando(false); agregar({ de: "alma", texto: errorTexto(null), ts: Date.now(), local: true }, true); });
      },
      enviar: function (texto) { var m = u.yo(texto); return m ? u.mandar(m, m.texto) : Promise.resolve(null); },
      /* Lo que se dijo por voz (la llamada se guarda sola como llamada): solo se pinta. */
      voz: function (de, texto) { texto = String(texto || "").trim(); if (texto) agregar({ de: de === "alma" ? "alma" : "yo", texto: texto, ts: Date.now(), local: true }, true); },
      foto: function (du) { agregar({ de: "yo", foto: du, ts: Date.now(), local: true }, true); },
      nota: function (t) { return pt.nota(t); },
      pensando: function (on) { if (!on) esperando = 0; pt.pensando(on); },
      /* Empieza limpio (al abrir de nuevo el chat): saludo y «Cargar historial». */
      vaciar: function () { reiniciar(); pintar(); },
      pintor: pt
    };
    pintar();
    return u;
  };

  var SAChat = { opciones: opciones, enlaces: enlaces, iconoOpcion: iconoOpcion, pintor: pintor, unico: unico, filaEsferas: filaEsferas, ESFERAS: ESFERAS, esfera: esfera };
  if (typeof module !== "undefined" && module.exports) module.exports = SAChat;
  raiz.SAChat = SAChat;
})(typeof window !== "undefined" ? window : globalThis);
