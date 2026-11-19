/* Bento vivo (#810; Juan eligió la opción A, 19-nov-2026): en el iPad y la computadora, el inicio de Alma pone el bento
   del Hub alrededor de la roca y, cuando Alma habla de algo (una reserva, un apartamento, un socio, Claudio…), las tarjetas
   cambian a ese tema.
   · La roca no se mueve ni se achica: queda al centro con su tamaño de siempre (sa-nav: 270 px). Las tarjetas le dejan un
     hueco en el cruce (la columna del centro, de arriba hasta debajo de «Chat» y «Llamada»), así nada la tapa y la roca
     no tapa nada. Los rieles laterales (#788) quedan libres: el bento empieza a 112 px de cada borde.
   · Los subtítulos de Alma van en ese hueco, con su fondo oscuro (alma/inicio.html, html.bv-on): nunca encima de una foto.
   · Regla fija: siempre 1 imagen, nunca un cuadro vacío; lo demás es información (el GIF va en su ventana). Lo que falta no se pinta y los
     demás crecen.
   · La ventana del GIF (Juan, 19-nov-2026: «GIFs de memes, de esos que son mini fragmentos de video, no emojis… un tono
     gris oscuro, translúcido, frosted, y SIEMPRE encima de la roca, tanto en el iPad como en el teléfono»): un vidrio gris
     oscuro arriba de la roca, en el teléfono, el iPad y la computadora (sigue a la roca: al centro o en la esquina del
     tablero). Pasa un GIF y después otro (cada 8 s, con fundido) del tema de lo que se habla: 7 por tema (catálogo del Hub,
     acción gifTemas, apps-script/gif.js), pedido una vez y guardado 12 h; sin repetir hasta agotar los 7. Nunca un emoji:
     sin catálogo todavía, la ventana no sale. La broma (mostrar_gif, js/alma-gif.js) la tapa unos segundos.
   · Sin otra llamada a la IA ni a Hospitable: el tema son los cuadros que ya manda la tarjeta de la llamada
     (apps-script/tarjeta.js) y el reposo sale de lo que el inicio ya trae (Pendientes, Notificaciones y las áreas).
   · Solo administradores (sin datos de Pendientes o de las áreas no se arma) y solo en pantalla ancha: el teléfono no cambia.
   · Se esconde con las esferas y sus niveles (#831), las hojas, el chat, Pendientes y Notificaciones.
   API: AlmaBento.iniciar({ hacer, abrir }) · ancho() · tema(t, { cuadro, claudio }) · reposo() · datos() · areas(r)
        · gifTema(t) (el tema del GIF en el teléfono) · gifCuadro() (para la broma) · el() · enTema() · geo() (pruebas) */
(function (w, d) {
  "use strict";
  if (w.AlmaBento) return;
  var B = { el: null, t: null, id: "", cfg: {}, areas: null, gifs: null, gifsP: null, tema: "", ultimo: {}, pintado: "", timer: 0 };
  var QUIETO = false; try { QUIETO = w.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var NOMBRE = { reserva: "Huésped", conversacion: "Conversación", apartamento: "Apartamento", consulta: "Consulta", edificio: "Edificio", claudio: "Claudio",
    socio: "Socio", recepcion: "Recepción", proyecto: "Proyecto", datos: "Datos", limpieza: "Limpieza" };
  function el(tag, cls, txt) { var x = d.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function leer(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }

  /* ── Dónde va todo: la roca (como la pone sa-nav: 50 % · 42 %, min(66 % del ancho, 40 % del alto, 270 px)), el hueco del
     centro y las regiones del bento. null si la pantalla no alcanza (el teléfono y las ventanas angostas). ── */
  var SAFE = null;
  function seguro() {
    if (SAFE) return SAFE;
    var p = el("div"); p.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    d.body.appendChild(p); var c = getComputedStyle(p); SAFE = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 }; p.remove(); return SAFE;
  }
  /* Con el chat escrito abierto (Juan, 19-nov-2026: «Bento en el chat escrito, sí»): en pantalla ancha el chat va en una
     columna a la derecha (chatW) y el bento ocupa lo demás, en dos columnas (la imagen y el GIF a la izquierda; la
     información a la derecha). La roca está en el botón de enviar del chat (sa-nav). Si no queda espacio (el iPad
     vertical), el chat va como siempre y el bento se esconde. */
  function chatAbierto() { var o = ov(); return !!(o && /(^|\s)chat(\s|$)/.test(o.className)); }
  function chatW(W) { return Math.round(Math.max(400, Math.min(520, W * .4))); }
  function geoChat() {
    var W = d.documentElement.clientWidth || w.innerWidth, H = (w.visualViewport && w.visualViewport.height) || w.innerHeight;
    if (!geoNormal()) return null;
    var s = seguro(), cw = chatW(W), gap = 16, X0 = 112 + s.l, X1 = W - cw - 24, Y0 = Math.max(20, s.t + 14), Y1 = H - Math.max(20, s.b + 14);
    if (X1 - X0 < 560) return null;
    var hw = (X1 - X0 - gap) / 2, gh = Math.round(Math.min(220, hw / 1.5));   // arriba de la columna izquierda, la ventana del GIF
    return { W: W, H: H, chat: cw, cx: X0 + (X1 - X0) / 2, cy: H / 2, hueco: { x: X0, y: Y0, w: 0, h: 0 }, L: { x: X0, y: Y0 + gh + gap, w: hw, h: Y1 - Y0 - gh - gap }, R: { x: X0 + hw + gap, y: Y0, w: hw, h: Y1 - Y0 }, B: null, modoChat: true,
      gifv: { x: Math.round(X0), y: Math.round(Y0), w: Math.round(hw), h: gh } };
  }
  function geo() { return chatAbierto() ? geoChat() : geoNormal(); }
  function geoNormal() {
    var W = d.documentElement.clientWidth || w.innerWidth, H = (w.visualViewport && w.visualViewport.height) || w.innerHeight;
    if (W < 900 || H < 600) return null;
    var s = seguro(), D = Math.min(W * .66, H * .4, 270), R = D / 2, cx = W / 2, cy = H * .42, gap = 16;
    /* lo de debajo de la roca: el estado, el subtítulo (2 líneas) y «Chat» · «Llamada» (sa-nav .san-ov-ui) */
    var ui = d.querySelector("#sa-nav-root .san-ov-ui"), uiTop = H * .44 + Math.min(W * .33, H * .2, 135) + 34;
    var uiH = Math.max(196, Math.min(250, ui && ui.offsetHeight > 40 ? ui.offsetHeight + 40 : 0));
    var holeB = uiTop + uiH, holeW = Math.max(D + 2 * Math.max(48, R * .42) + 40, 460);   // la órbita lejana de los anillos (#509) cabe en el hueco
    var X0 = 112 + s.l, X1 = W - 112 - s.r, Y0 = Math.max(20, s.t + 14), Y1 = H - Math.max(20, s.b + 14);
    var hl = cx - holeW / 2, hr = cx + holeW / 2, vert = H > W * 1.05, g = { W: W, H: H, D: D, cx: cx, cy: cy, hueco: { x: hl, y: Y0, w: holeW, h: holeB - Y0 }, vertical: vert };
    if (!vert) {
      var lw = hl - gap - X0; if (lw < 200) return null;
      g.L = { x: X0, y: Y0, w: lw, h: Y1 - Y0 }; g.R = { x: hr + gap, y: Y0, w: X1 - hr - gap, h: Y1 - Y0 };
      g.B = Y1 - holeB - gap >= 110 ? { x: hl, y: holeB + gap, w: holeW, h: Y1 - holeB - gap } : null;
    } else {
      var sw = hl - gap - X0; if (sw < 120 || Y1 - holeB - gap < 200) return null;
      g.L = { x: X0, y: Y0, w: sw, h: holeB - Y0 }; g.R = { x: hr + gap, y: Y0, w: X1 - hr - gap, h: holeB - Y0 };
      g.B = { x: X0, y: holeB + gap, w: X1 - X0, h: Y1 - holeB - gap };
    }
    return g;
  }
  function ancho() { return !!geoNormal(); }

  /* ── El GIF del tema ── */
  function gifsCargar() {
    if (B.gifs || B.gifsP) return;
    /* lo guardado sirve 12 h, salvo que traiga emojis (el catálogo de antes): entonces se pide otra vez */
    var c = leer("alma_bento_gifs"); if (c && c.t && Date.now() - c.t < 12 * 3600e3 && c.temas && conGifs(c.temas)) { B.gifs = c.temas; return; }
    var dst = w.ALMA && w.ALMA.destino ? w.ALMA.destino() : null, ses = w.SAAuth && w.SAAuth.session ? w.SAAuth.session() : null;
    if (!dst || !dst.url || !ses) return;
    B.gifsP = fetch(dst.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, cache: "no-store",
      body: JSON.stringify({ hub: 1, action: "gifTemas", token: dst.token, session: ses }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        B.gifsP = null; if (!j || !j.ok || !j.temas) return;
        B.gifs = j.temas; guardar("alma_bento_gifs", { t: Date.now(), temas: j.temas }); ventana();
      }, function () { B.gifsP = null; });
  }
  /* ¿El catálogo trae GIFs de verdad? (de GIPHY; nunca emojis) */
  function gifsDe(c) { return (c && c.fuente === "giphy" && Array.isArray(c.gifs) ? c.gifs : []).filter(function (x) { return x && /^https:\/\/(media\d?|i)\.giphy\.com\//.test(String(x.url || "")); }); }
  function conGifs(temas) { return Object.keys(temas || {}).some(function (k) { return gifsDe(temas[k]).length; }); }
  function seguro_url(u) { return /^https:\/\/[^\s"'<>]+$/.test(String(u || "")) ? String(u) : ""; }
  /* El siguiente GIF del tema: un mazo barajado por tema en el dispositivo; no se repite hasta agotar los 7. Un tema sin
     GIFs usa los del reposo (o los de cualquier tema). null si todavía no hay catálogo: nunca un emoji. */
  function gifDel(tema) {
    var T = B.gifs || {}, lista = gifsDe(T[tema]);
    if (!lista.length) { tema = "reposo"; lista = gifsDe(T.reposo); }
    if (!lista.length) Object.keys(T).some(function (k) { lista = gifsDe(T[k]); tema = k; return lista.length; });
    if (!lista.length) return null;
    var firma = lista.map(function (x) { return x.url; }).join("|").length + ":" + lista.length;
    var m = leer("alma_bento_mazo_" + tema) || {};
    if (m.f !== firma || !Array.isArray(m.q) || !m.q.length) {
      var q = lista.map(function (x, i) { return i; });
      for (var i = q.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = q[i]; q[i] = q[j]; q[j] = x; }
      if (q.length > 1 && q[0] === m.u) q.push(q.shift());   // el primero de la vuelta nueva no es el último de la anterior
      m = { f: firma, q: q };
    }
    var k = m.q.shift(); m.u = k; guardar("alma_bento_mazo_" + tema, m);
    var g = lista[k] || lista[0];
    return { url: seguro_url(g.url), alt: g.alt || tema, fuente: "giphy", credito: "GIPHY" };
  }
  /* El tema del GIF según lo que se habla (sin IA: el tipo de la tarjeta y unas palabras de lo que ya trae). */
  function temaGif(t) {
    if (!t) return "reposo";
    var tipo = t.tipo || "", txt = "";
    try { txt = JSON.stringify([t.titulo, t.cabeza, t.chip, t.sub, t.etiqueta, (t.cuadros || []).map(function (c) { return [c.k, c.chip, c.v, c.texto, c.problema]; }), t.destacado && t.destacado.texto]).toLowerCase(); } catch (e) {}
    if (tipo === "claudio") return "claudio";
    if (tipo === "socio") return "socio";
    if (tipo === "datos" || tipo === "proyecto") return "datos";
    if (tipo === "limpieza" || /limpi/.test(txt)) return "limpieza";
    if (/fuga|no funciona|no sirve|repar|t[eé]cnico|mantenim|da[nñ]ad|gotera|agua caliente/.test(txt)) return "mantenimiento";
    if (tipo === "consulta" || /por aprobar|solicitud|nueva reserva/.test(txt)) return "reserva_nueva";
    if (/cobr|pag[oa]|dep[oó]sito|saldo|factura/.test(txt) && !/pagado/.test(txt)) return "cobro";
    if (/5 estrellas|felicit|excelente|le encant/.test(txt)) return "buena_noticia";
    if (/sale hoy|salida|check-?out/.test(txt)) return "salida";
    if (tipo === "apartamento" || tipo === "edificio") return "apartamento";
    return "huesped";
  }
  /* ── La imagen: la foto del tema (con la del huésped encima, como el tablero) o la galería; sin foto, la de la marca. ── */
  function piezaImagenMarca(t, sub) {
    var c = el("div", "tvb-t tvb-foto bv-marca"), i = el("img"); i.alt = ""; i.decoding = "async"; i.src = "../assets/hub-hoy-v2.jpg"; c.appendChild(i);
    return conTitulo(c, t, sub);
  }
  function conTitulo(c, tit, sub) {
    if (!tit && !sub) return c;
    var p = el("div", "bv-pie" + (c.querySelector(".tvb-av") ? " con-av" : "")); if (tit) p.appendChild(el("b", "", tit)); if (sub) p.appendChild(el("small", "", sub)); c.appendChild(p);
    return c;
  }

  /* ── Las piezas de un tema (los cuadros de la tarjeta) ── */
  var PESO = { mensaje: 4, lista: 4, foco: 4, linea: 4, animo: 3, termometro: 3, mapa: 3, galeria: 3, barras: 3, semana: 2, cifras: 2, resumen: 2, dato: 2, numero: 2 };
  function piezasTema(t, r) {
    var cs = (t.cuadros || []).filter(function (c) { return c && c.tipo; }).slice().sort(function (a, b) { return (a.prioridad || 9) - (b.prioridad || 9); });
    var foto = cs.filter(function (c) { return c.tipo === "foto" && (c.fondo || c.avatar || c.iniciales); })[0], gal = cs.filter(function (c) { return c.tipo === "galeria" && (c.fotos || []).length; })[0];
    var img = null, tit = t.titulo || t.cabeza || "", sub = t.sub || "";
    if (r.claudio) { img = piezaImagenMarca("Claudio", t.sub || "Lo que está haciendo"); }
    else if (foto && (foto.fondo || foto.avatar)) img = conTitulo(r.cuadro(foto), tit, sub);
    else if (gal) { img = conTitulo(r.cuadro(gal), tit, sub); gal = null; }
    else img = piezaImagenMarca(tit, sub);
    /* Datos chicos (tam s, tipo dato): se juntan en una tarjeta de dos o tres renglones, como «Registro y pago» del prototipo. */
    var info = [], chicos = [];
    cs.forEach(function (c) {
      if (c === foto || c.tipo === "foto" || (c.tipo === "galeria" && c !== gal)) return;
      if (c.tipo === "dato" && c.tam === "s" && !c.foto) { chicos.push(c); return; }
      info.push({ el: r.cuadro(c), peso: PESO[c.tipo] || 2, tipo: c.tipo, p: c.prioridad || 9 });
    });
    if (chicos.length) {
      var g = el("div", "tvb-t bv-datos"); g.appendChild(el("small", "tvb-k", chicos.length > 1 ? "La estadía" : (chicos[0].k || "Dato")));
      chicos.slice(0, 4).forEach(function (c) { var f = el("div", "bv-fila"); f.appendChild(el("span", "", c.k || "")); var v = el("b", "", c.v || "–"); f.appendChild(v); if (c.d) f.appendChild(el("small", "", c.d)); g.appendChild(f); });
      info.push({ el: g, peso: 2 + Math.min(2, chicos.length - 1) * .5, tipo: "datos", p: Math.min.apply(null, chicos.map(function (c) { return c.prioridad || 9; })) });
    }
    if (r.claudio) info.unshift({ el: r.claudio, peso: 6, tipo: "claudio", p: 0 });
    /* Lo que no es cuadro pero viene en la tarjeta de siempre (la app de antes): la conversación y las promesas. */
    if (!info.length) {
      (t.mensajes || []).slice(-2).forEach(function (m) { var c = el("div", "tvb-t tvb-msg"); c.appendChild(el("small", "tvb-k", m.quien || "Mensaje")); c.appendChild(el("q", "", m.texto || "")); info.push({ el: c, peso: 3, p: 5 }); });
      (t.datos || []).length && info.push({ el: (function () { var c = el("div", "tvb-t"); c.appendChild(el("small", "tvb-k", "Datos")); var u = el("ul", "tvb-l"); t.datos.slice(0, 4).forEach(function (x) { var li = el("li"); li.appendChild(el("span", "tvb-tx", x)); u.appendChild(li); }); c.appendChild(u); return c; })(), peso: 2, p: 6 });
    }
    info.sort(function (a, b) { return a.p - b.p; });
    return { img: img, info: info };
  }

  /* ── El reposo: el bento del Hub con lo que el inicio ya trae ── */
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"], MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function datosReposo() {
    var s = null; try { s = w.SANav && w.SANav.datos ? w.SANav.datos() : null; } catch (e) {}
    return { pend: s && s.pend, noti: s && s.noti, areas: B.areas };
  }
  function lista(k, items, vacio, abrir) {
    var c = el("div", "tvb-t bv-lista"); var kf = el("div", "tvb-kf"); kf.appendChild(el("small", "tvb-k", k)); c.appendChild(kf);
    if (!items.length) { c.appendChild(el("b", "tvb-v bv-nada", vacio)); }
    else {
      var n = el("b", "tvb-v", String(items.length)); c.appendChild(n);
      var u = el("ul", "tvb-l"); items.slice(0, 4).forEach(function (x) { var li = el("li"); if (x.b) li.appendChild(el("b", "", x.b)); li.appendChild(el("span", "tvb-tx", x.t)); u.appendChild(li); });
      if (items.length > 4) u.appendChild(el("li", "mas", "y " + (items.length - 4) + " más"));
      c.appendChild(u);
    }
    if (abrir) { c.setAttribute("role", "button"); c.tabIndex = 0; c.onclick = function (e) { e.stopPropagation(); abrir(); };
      c.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } }; }
    return c;
  }
  function piezasReposo() {
    var x = datosReposo(), info = [], ab = B.cfg.abrir || function () {};
    var nombreArea = {}; ((x.areas && x.areas.areas) || []).forEach(function (a) { nombreArea[a.k] = a.n; });
    if (x.pend) {
      var at = [].concat(x.pend.atencion || []);
      info.push({ el: lista("Necesita tu sí", at.map(function (p) { return { t: p.titulo || p.resumen || "", b: nombreArea[p.area] || "" }; }), "Todo al día", function () { ab("pend"); }), peso: at.length ? 4 : 2, p: 1 });
    }
    if (x.noti) {
      var nl = [].concat(x.noti.items || x.noti.lista || []);
      info.push({ el: lista("Avisos", nl.map(function (n) { return { t: n.titulo || n.texto || "" }; }), "Sin avisos nuevos", function () { ab("noti"); }), peso: nl.length ? 3 : 2, p: 2 });
    }
    if (x.areas && (x.areas.areas || []).length) {
      var c = el("div", "tvb-t bv-areas"); c.appendChild(el("small", "tvb-k", "Tus áreas"));
      var u = el("ul", "bv-ar"); x.areas.areas.slice(0, 6).forEach(function (a) { var li = el("li"); li.setAttribute("data-k", a.k || ""); li.appendChild(el("span", "", a.n || "")); li.appendChild(el("b", "", String((a.proyectos || []).length))); u.appendChild(li); });
      c.appendChild(u); c.setAttribute("role", "button"); c.tabIndex = 0; c.onclick = function (e) { e.stopPropagation(); ab("areas"); };
      info.push({ el: c, peso: 3, p: 3 });
    }
    if (!info.length) return null;   // sin datos de administrador: no hay bento (el inicio de siempre)
    var h = new Date();
    return { img: piezaImagenMarca(DIAS[h.getDay()].charAt(0).toUpperCase() + DIAS[h.getDay()].slice(1) + " " + h.getDate() + " de " + MESES[h.getMonth()], "Spacio AM · hoy"),
      info: info };
  }

  /* ── La ventana del GIF: un vidrio gris oscuro arriba de la roca, en todas las pantallas. Sigue a la roca (al centro o en
     la esquina del tablero del teléfono) sin tapar su halo, el saludo, el tema del bento ni los botones de arriba. Si no
     cabe con el saludo, el saludo se va (la ventana toma su lugar); si ni así cabe (la roca arriba), no sale. ── */
  var V = { el: null, tema: "reposo", url: "", pide: false, fallos: 0 }, CADA = 8000;
  function gifTema(t) { var n = t ? temaGif(t) : "reposo"; if (n === V.tema) return; V.tema = n; ventana(true); }
  function rocaRect() {
    var r = d.querySelector("#sa-nav-root .san-ov .san-rock"); if (!r) return null;
    var b = r.getBoundingClientRect(); return b.width > 20 && b.height > 20 ? b : null;
  }
  function visto(e) {
    if (!e || !e.getBoundingClientRect) return null; var b = e.getBoundingClientRect(); if (!b.width || !b.height) return null;
    var cs = getComputedStyle(e); return +cs.opacity > .05 && cs.visibility !== "hidden" && cs.display !== "none" ? b : null;
  }
  /* El saludo «Hola, Juan»: su lugar aunque esté escondido por la ventana (html.gv-sin-hola); null si otra cosa lo esconde. */
  function holaRect() {
    var h = d.getElementById("hola"), R = d.documentElement, bo = d.body;
    if (!h || !h.classList.contains("on") || !h.textContent || R.classList.contains("bv-tema-on") || R.classList.contains("tvb-on") ||
      bo.classList.contains("orbita-on") || bo.classList.contains("vv-arriba")) return null;
    var b = h.getBoundingClientRect(); return b.width && b.height ? b : null;
  }
  function lugar() {
    /* con el chat escrito abierto la roca está en su botón de enviar: en pantalla ancha la ventana va arriba de la columna
       de la imagen (geoChat); en el teléfono el chat ocupa la pantalla y la ventana se esconde */
    if (chatAbierto()) { var gc = geoChat(); return gc && gc.gifv ? { x: gc.gifv.x, y: gc.gifv.y, w: gc.gifv.w, h: gc.gifv.h, sinHola: false } : null; }
    var rb = rocaRect(); if (!rb) return null;
    var W = d.documentElement.clientWidth || w.innerWidth, H = (w.visualViewport && w.visualViewport.height) || w.innerHeight, s = seguro();
    var chico = rb.width < 140, ancha = W >= 700 && H >= 500, cx = rb.left + rb.width / 2;
    var abajo = rb.top - Math.max(8, rb.width * .07) - (chico ? 8 : 12);   // el halo de la roca queda libre
    var hmax = chico ? 96 : ancha ? 200 : 132, wmax = ancha ? 340 : Math.min(W - 32, 260);
    var tope = function (conHola) {
      var t = Math.max(16, s.t + 12), obs = [].slice.call(d.querySelectorAll(".bv-capa.on:not(.sale) .bv-tema:not([hidden])"));
      if (conHola) { var hb = holaRect(); if (hb && hb.bottom <= abajo) t = Math.max(t, hb.bottom + 10); }
      if (!ancha) [].push.apply(obs, d.querySelectorAll("#sa-nav-root .san-pendb, #b-ajustes, #b-arch, #b-nav"));
      obs.forEach(function (e) { var b = visto(e); if (b && b.bottom <= abajo && b.right > cx - wmax / 2 && b.left < cx + wmax / 2) t = Math.max(t, b.bottom + 10); });
      return t;
    };
    var top = tope(true), sinHola = false;
    if (abajo - top < 84 && !chico) { var t2 = tope(false); if (t2 < top) { top = t2; sinHola = true; } }
    var h = Math.min(hmax, abajo - top); if (h < 64) return null;
    var wv = Math.min(wmax, Math.round(h * 1.5)), x = Math.max(16 + s.l, Math.min(W - 16 - s.r - wv, cx - wv / 2));
    return { x: Math.round(x), y: Math.round(abajo - h), w: wv, h: Math.round(h), sinHola: sinHola };
  }
  function siguiente() {
    if (!V.el || V.pide) return;
    var g = gifDel(V.tema); if (!g || !g.url) return;
    var imgs = V.el.querySelectorAll(".gv-marco > img"), act = V.el.querySelector(".gv-marco > img.on"), otra = act === imgs[0] ? imgs[1] : imgs[0];
    var pre = new Image(); V.pide = true; pre.referrerPolicy = "no-referrer"; pre.decoding = "async";
    pre.onload = function () {
      V.pide = false; V.fallos = 0; V.url = g.url; otra.src = g.url; V.el.setAttribute("aria-label", "GIF: " + g.alt);
      otra.classList.add("on"); if (act && act !== otra) act.classList.remove("on"); V.el.classList.add("listo");
    };
    pre.onerror = function () { V.pide = false; if (++V.fallos < 4) siguiente(); };
    pre.src = g.url;
  }
  function ventana(nuevo) {
    gifsCargar();
    var r = capaRaiz(); if (!r) return;
    if (!V.el) {
      V.el = el("div", "gv"); V.el.setAttribute("role", "img"); V.el.setAttribute("aria-label", "GIF");
      var m = el("div", "gv-marco"); [0, 1].forEach(function () { var i = el("img"); i.alt = ""; i.decoding = "async"; i.referrerPolicy = "no-referrer"; m.appendChild(i); });
      V.el.appendChild(m); V.el.appendChild(el("small", "gv-cred", "GIPHY"));
    }
    if (V.el.parentNode !== r) r.appendChild(V.el);
    var p = B.gifs ? lugar() : null, raiz = d.documentElement;
    if (!p) { V.el.classList.remove("on"); raiz.classList.remove("gv-sin-hola"); return; }
    var st = V.el.style; st.left = p.x + "px"; st.top = p.y + "px"; st.width = p.w + "px"; st.height = p.h + "px";
    raiz.classList.toggle("gv-sin-hola", p.sinHola);
    if (!V.url || nuevo) siguiente();
    V.el.classList.add("on");
  }
  /* la roca se mueve (al centro, a la esquina, crece con la voz) y la página cambia: la ventana la sigue */
  setInterval(function () { if (d.visibilityState !== "hidden") ventana(); }, 500);
  /* uno y después otro, como en el reposo: cada 8 s, salvo con la broma encima */
  setInterval(function () { if (V.el && V.el.classList.contains("on") && d.visibilityState !== "hidden" && !V.el.querySelector(".gifb")) siguiente(); }, CADA);

  /* ── Acomodar: cada región es una columna de tarjetas (la altura según su peso); el hueco del centro queda libre. ── */
  function region(r, items, cls) {
    var c = el("div", "bv-reg" + (cls ? " " + cls : "")); c.style.left = r.x + "px"; c.style.top = r.y + "px"; c.style.width = r.w + "px"; c.style.height = r.h + "px";
    items.forEach(function (it) { var s = el("div", "bv-c"); s.style.flex = (it.peso || 2) + " 1 0"; s.appendChild(it.el); c.appendChild(s); });
    return c;
  }
  function repartir(pz, g) {
    var info = pz.info.slice(), I = { el: pz.img, peso: 5 }, L = [], R = [], Bt = [];
    if (g.modoChat) {   // con el chat: la imagen a la izquierda (debajo de la ventana del GIF); la información a la derecha
      L = [I]; R = info.splice(0, 3);
      return { L: L, R: R, B: [] };
    }
    if (!g.vertical) {
      R = info.splice(0, 3);
      L = [I].concat(info.splice(0, 1));
      if (g.B) Bt = info.splice(0, 2); else L = L.concat(info.splice(0, 1));
    } else {
      /* iPad vertical: las columnas de los lados son angostas (la galería o el mapa y otra tarjeta); abajo, a lo ancho,
         la imagen con su nombre y dos tarjetas de información a su lado. */
      var k = -1; info.forEach(function (x, i) { if (k < 0 && /^(galeria|mapa)$/.test(x.tipo || "")) k = i; });
      L = k >= 0 ? info.splice(k, 1) : []; Bt = [I].concat(info.splice(0, 2)); R = info.splice(0, 1);
    }
    return { L: L, R: R, B: Bt };
  }
  function construir(pz, g, nuevo) {
    var capa = el("div", "bv-capa"), rep = repartir(pz, g);
    if (rep.L.length) capa.appendChild(region(g.L, rep.L, "izq" + (g.vertical ? " lado" : ""))); if (rep.R.length) capa.appendChild(region(g.R, rep.R, "der" + (g.vertical ? " lado" : "")));
    if (g.B && rep.B.length) capa.appendChild(region(g.B, rep.B, g.vertical ? "abajo dos" : "abajo"));
    /* entrada: desde la roca, en orden por distancia a ella */
    var k = 0, cs = [].slice.call(capa.querySelectorAll(".bv-c")).map(function (c) { var reg = c.parentNode; return { c: c, dd: Math.hypot(parseFloat(reg.style.left) + parseFloat(reg.style.width) / 2 - g.cx, parseFloat(reg.style.top) + c.offsetTop - g.cy) }; });
    cs.sort(function (a, b) { return a.dd - b.dd; }).forEach(function (x) { x.c.style.setProperty("--i", k++); var dx = parseFloat(x.c.parentNode.style.left) + parseFloat(x.c.parentNode.style.width) / 2 < g.cx ? 1 : -1; x.c.style.setProperty("--dx", (dx * 18) + "px"); });
    if (nuevo === false) capa.classList.add("ya");
    return capa;
  }

  /* ── La capa: dentro de la llamada de la roca (sa-nav .san-ov), sobre el atardecer y debajo de la roca y sus botones ── */
  function ov() { return d.querySelector("#sa-nav-root .san-ov"); }
  function capaRaiz() {
    var o = ov(); if (!o) return null;
    if (!B.el) { B.el = el("div", "bv"); B.el.setAttribute("role", "region"); B.el.setAttribute("aria-label", "Bento vivo"); B.el.addEventListener("pointerdown", function () { if (B.t && B.cfg.hacer) B.cfg.hacer("toque"); }, { passive: true }); }
    if (B.el.parentNode !== o) { var bg = o.querySelector(".san-ov-bg"); o.insertBefore(B.el, bg ? bg.nextSibling : o.firstChild); }
    /* se abre o se cierra el chat: el bento se vuelve a acomodar (columna del chat a la derecha, o el hueco de la roca) */
    if (B.obs !== o && w.MutationObserver) { B.obs = o; var era = chatAbierto(); new MutationObserver(function () { var y = chatAbierto(); if (y !== era) { era = y; reacomodar(); } }).observe(o, { attributes: true, attributeFilter: ["class"] }); }
    return B.el;
  }
  function pintar(pz, firma, animar) {
    var g = geo(), raiz = d.documentElement;
    if (!g || !pz) { quitar(); return false; }
    var r = capaRaiz(); if (!r) return false;
    var cab = B.t ? (NOMBRE[B.t.tipo] || "Alma encontró") + (B.t.titulo || B.t.cabeza ? " · " + (B.t.titulo || B.t.cabeza) : "") : "";
    var viejas = [].slice.call(r.querySelectorAll(".bv-capa:not(.sale)")), nueva = construir(pz, g, animar);
    B.capa = nueva;   // la única que vale: una que esperaba para entrar y ya no es la última, no entra
    var tp = el("div", "bv-tema"); if (cab) { tp.appendChild(el("i")); tp.appendChild(d.createTextNode(cab)); } else tp.hidden = true; tp.style.top = g.hueco.y + "px";
    nueva.appendChild(tp);
    viejas.forEach(function (v) { if (animar === false) { v.parentNode.removeChild(v); return; } v.classList.add("sale"); setTimeout(function () { if (v.parentNode) v.parentNode.removeChild(v); }, QUIETO ? 0 : 260); });
    var entra = function () { if (B.capa !== nueva) return; [].forEach.call(r.querySelectorAll(".bv-capa:not(.sale)"), function (v) { v.parentNode.removeChild(v); }); r.appendChild(nueva); requestAnimationFrame(function () { requestAnimationFrame(function () { nueva.classList.add("on"); }); }); };
    if (viejas.length && animar !== false && !QUIETO) setTimeout(entra, 180); else entra();
    raiz.classList.add("bv-on"); raiz.classList.toggle("bv-tema-on", !!B.t); raiz.classList.toggle("bv-chat", !!g.modoChat);
    if (g.modoChat) raiz.style.setProperty("--bv-chat-w", g.chat + "px");
    B.pintado = firma; return true;
  }
  function quitar() {
    d.documentElement.classList.remove("bv-on", "bv-tema-on", "bv-chat");
    B.capa = null;
    if (B.el) [].forEach.call(B.el.querySelectorAll(".bv-capa"), function (v) { v.classList.add("sale"); setTimeout(function () { if (v.parentNode) v.parentNode.removeChild(v); }, 260); });
    B.pintado = "";
  }
  function firmaReposo() { var x = datosReposo(); try { return "r:" + JSON.stringify([x.pend && (x.pend.atencion || []).map(function (p) { return p.id || p.titulo; }), x.noti && (x.noti.items || x.noti.lista || []).length, x.areas && (x.areas.areas || []).map(function (a) { return (a.proyectos || []).length; })]); } catch (e) { return "r"; } }
  function reposo(animar) {
    B.t = null; B.id = ""; B.render = null; gifTema(null);
    var f = firmaReposo(); if (B.pintado === f && geo()) return;
    var pz = piezasReposo(); if (!pz) { quitar(); return; }
    /* el reposo ya a la vista: llegó un dato nuevo (Pendientes, avisos, áreas): se cambia en su lugar, sin volver a entrar */
    var ya = !B.eraTema && B.capa && B.capa.parentNode ? B.capa : null;
    pintar(pz, f, ya ? false : animar); B.eraTema = false;
  }
  function tema(t, r) {
    if (!t) return reposo();
    gifsCargar();
    if (B.t && B.id === t.id && B.pintado === "t:" + t.id) return true;
    B.t = t; B.id = t.id || ""; B.render = r; B.eraTema = true; gifTema(t);
    return pintar(piezasTema(t, r), "t:" + B.id);
  }
  /* Cambió el tamaño o se giró el iPad: se vuelve a acomodar sin animar (el mismo GIF no cambia: se mueve la misma pieza). */
  function reacomodar() {
    clearTimeout(B.timer);
    B.timer = setTimeout(function () {
      ventana();
      if (!geo()) { quitar(); return; }
      B.pintado = "";
      if (B.t && B.render) pintar(piezasTema(B.t, B.render), "t:" + B.id, false);
      else reposo(false);
    }, 160);
  }
  w.addEventListener("resize", reacomodar);
  /* El chat escrito (Juan, 19-nov-2026: «Bento en el chat escrito, sí»): en pantalla ancha, cada mensaje a Alma pide que
     la respuesta traiga la tarjeta del tema (bento: 1; apps-script/tarjeta.js, tvDelChat_). Va en la misma respuesta: no
     hay llamada nueva. La página la recibe con el evento «sa-chat-tarjeta». */
  function chatEnvolver() {
    var A = w.ALMA; if (!A || !A.opEnviar || A.opEnviar._bv) return;
    var orig = A.opEnviar;
    A.opEnviar = function (a, texto) {
      var o = a && typeof a === "object" ? a : null;
      if (o && ancho()) a = Object.assign({}, o, { bento: 1 });
      var p = orig.call(A, a, texto);
      return p && p.then ? p.then(function (r) {
        if (r && r.ok && r.tarjeta && r.tarjeta.id) { try { w.dispatchEvent(new CustomEvent("sa-chat-tarjeta", { detail: { tarjeta: r.tarjeta } })); } catch (e) {} }
        return r;
      }) : p;
    };
    A.opEnviar._bv = true;
  }
  w.addEventListener("orientationchange", reacomodar);

  w.AlmaBento = {
    iniciar: function (o) { B.cfg = Object.assign(B.cfg, o || {}); chatEnvolver(); gifsCargar(); if (!B.t) reposo(); ventana(); },
    ancho: ancho,
    geo: geo,
    tema: tema,
    reposo: function () { reposo(); },
    datos: function () { if (!B.t) reposo(); },
    areas: function (r) { if (r && r.ok) { B.areas = r; if (!B.t) reposo(); } },
    el: function () { return B.el; },
    enTema: function () { return !!B.t && d.documentElement.classList.contains("bv-on"); },
    /* El tema del GIF en el teléfono (sin bento vivo): la tarjeta de la llamada, o null para el reposo. */
    gifTema: function (t) { gifTema(t || null); },
    /* La broma (js/alma-gif.js): el marco de la ventana del GIF, si está a la vista. */
    gifCuadro: function () { var g = V.el && V.el.classList.contains("on") ? V.el.querySelector(".gv-marco") : null; return g && g.getClientRects().length && +getComputedStyle(B.el).opacity > .05 ? g : null; },
    /* Para las pruebas y las capturas: dónde está la ventana (null si no sale) */
    ventana: function () { ventana(); var b = V.el && V.el.classList.contains("on") ? V.el.getBoundingClientRect() : null; return b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null; },
    /* Para las pruebas: el tema del GIF de una tarjeta */
    temaGif: temaGif,
    siguienteGif: gifDel
  };
})(window, document);
