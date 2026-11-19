/* Bento vivo (#810; Juan eligió la opción A, 19-nov-2026): en el iPad y la computadora, el inicio de Alma pone el bento
   del Hub alrededor de la roca y, cuando Alma habla de algo (una reserva, un apartamento, un socio, Claudio…), las tarjetas
   cambian a ese tema.
   · La roca no se mueve ni se achica: queda al centro con su tamaño de siempre (sa-nav: 270 px). Las tarjetas le dejan un
     hueco en el cruce (la columna del centro, de arriba hasta debajo de «Chat» y «Llamada»), así nada la tapa y la roca
     no tapa nada. Los rieles laterales (#788) quedan libres: el bento empieza a 112 px de cada borde.
   · Los subtítulos de Alma van en ese hueco, con su fondo oscuro (alma/inicio.html, html.bv-on): nunca encima de una foto.
   · Regla fija: siempre 1 imagen y 1 GIF, nunca un cuadro vacío; lo demás es información. Lo que falta no se pinta y los
     demás crecen.
   · El GIF del tema: 7 por tema (catálogo del Hub, acción gifTemas, apps-script/gif.js), pedido una vez y guardado 12 h en
     el dispositivo; rota sin repetir hasta agotar los 7. La broma (mostrar_gif, js/alma-gif.js) lo tapa unos segundos.
   · Sin otra llamada a la IA ni a Hospitable: el tema son los cuadros que ya manda la tarjeta de la llamada
     (apps-script/tarjeta.js) y el reposo sale de lo que el inicio ya trae (Pendientes, Notificaciones y las áreas).
   · Solo administradores (sin datos de Pendientes o de las áreas no se arma) y solo en pantalla ancha: el teléfono no cambia.
   · Se esconde con las esferas y sus niveles (#831), las hojas, el chat, Pendientes y Notificaciones.
   API: AlmaBento.iniciar({ hacer, abrir }) · ancho() · tema(t, { cuadro, claudio }) · reposo() · datos() · areas(r)
        · gifCuadro() (para la broma) · el() · enTema() · geo() (para las pruebas) */
(function (w, d) {
  "use strict";
  if (w.AlmaBento) return;
  var B = { el: null, t: null, id: "", cfg: {}, areas: null, gifs: null, gifsP: null, tema: "", ultimo: {}, pintado: "", timer: 0 };
  var QUIETO = false; try { QUIETO = w.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest/";
  /* Mientras llega el catálogo (o si no llega): 7 emojis animados por tema, los mismos que el Hub usa sin GIPHY. */
  var EMOJIS = {
    huesped: ["1f6ec", "2708_fe0f", "1f44b", "1f917", "1f60a", "1f970", "1f31f"], salida: ["1f44b", "1f697", "1f6eb", "1f64c", "2728", "1f60c", "1f4ab"],
    limpieza: ["1f9f9", "2728", "1f4aa", "1f31f", "1f44d", "1f64c", "1f4af"], mantenimiento: ["1f6e0_fe0f", "1f4a7", "1f914", "1f440", "1f4aa", "1f6a8", "1f4a1"],
    cobro: ["1f4b8", "1f911", "1f4c8", "1f44d", "1f389", "1f929", "1f4af"], socio: ["1f91d", "1f4c8", "1f44d", "1f60e", "1f4aa", "2728", "1f64c"],
    buena_noticia: ["1f389", "1f973", "1f929", "1f64c", "1f44f", "1f3c6", "1f308"], reserva_nueva: ["1f389", "1f680", "1f929", "1f4c8", "1f44f", "2728", "1f973"],
    apartamento: ["1f3e0", "2728", "1f60a", "1f31f", "1f4f8", "1f440", "1f44d"], datos: ["1f4c8", "1f9e0", "1f914", "1f440", "1f4aa", "1f680", "1f4a1"],
    claudio: ["1f916", "1f9e0", "1f680", "1f4bb", "1f914", "2728", "1f44d"], reposo: ["2615", "2728", "1f31b", "1f60a", "1f44b", "1f31f", "1f4ab"]
  };
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
    var hw = (X1 - X0 - gap) / 2;
    return { W: W, H: H, chat: cw, cx: X0 + (X1 - X0) / 2, cy: H / 2, hueco: { x: X0, y: Y0, w: 0, h: 0 }, L: { x: X0, y: Y0, w: hw, h: Y1 - Y0 }, R: { x: X0 + hw + gap, y: Y0, w: hw, h: Y1 - Y0 }, B: null, modoChat: true };
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
    var c = leer("alma_bento_gifs"); if (c && c.t && Date.now() - c.t < 12 * 3600e3 && c.temas) { B.gifs = c.temas; return; }
    var dst = w.ALMA && w.ALMA.destino ? w.ALMA.destino() : null, ses = w.SAAuth && w.SAAuth.session ? w.SAAuth.session() : null;
    if (!dst || !dst.url || !ses) return;
    B.gifsP = fetch(dst.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, cache: "no-store",
      body: JSON.stringify({ hub: 1, action: "gifTemas", token: dst.token, session: ses }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        B.gifsP = null; if (!j || !j.ok || !j.temas) return;
        B.gifs = j.temas; guardar("alma_bento_gifs", { t: Date.now(), temas: j.temas });
      }, function () { B.gifsP = null; });
  }
  function seguro_url(u) { return /^https:\/\/[^\s"'<>]+$/.test(String(u || "")) ? String(u) : ""; }
  /* El siguiente GIF del tema: un mazo barajado por tema en el dispositivo; no se repite hasta agotar los 7. */
  function gifDel(tema) {
    var c = B.gifs && B.gifs[tema], lista = c && c.gifs && c.gifs.length ? c.gifs : (EMOJIS[tema] || EMOJIS.reposo).map(function (k) { return { url: NOTO + k + "/512.webp", alt: tema }; });
    var fuente = c && c.fuente === "giphy" ? "giphy" : "emoji", firma = lista.map(function (x) { return x.url; }).join("|").length + ":" + lista.length;
    var m = leer("alma_bento_mazo_" + tema) || {};
    if (m.f !== firma || !Array.isArray(m.q) || !m.q.length) {
      var q = lista.map(function (x, i) { return i; });
      for (var i = q.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = q[i]; q[i] = q[j]; q[j] = x; }
      if (q.length > 1 && q[0] === m.u) q.push(q.shift());   // el primero de la vuelta nueva no es el último de la anterior
      m = { f: firma, q: q };
    }
    var k = m.q.shift(); m.u = k; guardar("alma_bento_mazo_" + tema, m);
    var g = lista[k] || lista[0];
    return { url: seguro_url(g.url), alt: g.alt || tema, fuente: fuente, credito: fuente === "giphy" ? "GIPHY" : "Noto Emoji" };
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
  function piezaGif(tema) {
    var g = gifDel(tema), c = el("div", "tvb-t bv-gif" + (g.fuente === "emoji" ? " bv-emoji" : ""));
    c.setAttribute("role", "img"); c.setAttribute("aria-label", "GIF: " + (g.alt || tema));
    if (g.url) { var i = el("img"); i.alt = ""; i.decoding = "async"; i.referrerPolicy = "no-referrer"; i.src = g.url; i.onerror = function () { i.remove(); c.classList.add("bv-emoji"); c.appendChild(el("span", "bv-gif-alt", "✨")); }; c.appendChild(i); }
    c.appendChild(el("small", "bv-cred", g.credito));
    return c;
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
    return { img: img, gif: piezaGif(temaGif(t)), info: info };
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
      gif: piezaGif("reposo"), info: info };
  }

  /* ── Acomodar: cada región es una columna de tarjetas (la altura según su peso); el hueco del centro queda libre. ── */
  function region(r, items, cls) {
    var c = el("div", "bv-reg" + (cls ? " " + cls : "")); c.style.left = r.x + "px"; c.style.top = r.y + "px"; c.style.width = r.w + "px"; c.style.height = r.h + "px";
    items.forEach(function (it) { var s = el("div", "bv-c"); s.style.flex = (it.peso || 2) + " 1 0"; s.appendChild(it.el); c.appendChild(s); });
    return c;
  }
  function repartir(pz, g) {
    var info = pz.info.slice(), I = { el: pz.img, peso: 5 }, G = { el: pz.gif, peso: 2.4 }, L = [], R = [], Bt = [];
    if (g.modoChat) {   // con el chat: imagen (y GIF, si va en el bento) a la izquierda; la información a la derecha
      L = [I].concat(pz.gif ? [{ el: pz.gif, peso: 2.4 }] : []); R = info.splice(0, 3);
      if (!R.length && pz.gif) { R = [L.pop()]; }
      return { L: L, R: R, B: [] };
    }
    if (!g.vertical) {
      R = info.splice(0, 3);
      L = [I].concat(info.splice(0, g.B ? 2 : 1));
      if (g.B) Bt = [G]; else if (R.length) L.push(G); else R = [G];
      if (!R.length) R = [G], Bt = [];
    } else {
      /* iPad vertical: las columnas de los lados son angostas (el GIF y, si hay, la galería o el mapa); abajo, a lo ancho,
         la imagen con su nombre y dos tarjetas de información a su lado. */
      var k = -1; info.forEach(function (x, i) { if (k < 0 && /^(galeria|mapa)$/.test(x.tipo || "")) k = i; });
      L = [G]; R = k >= 0 ? info.splice(k, 1) : []; Bt = [I].concat(info.splice(0, 2));
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
    B.t = null; B.id = ""; B.render = null;
    var f = firmaReposo(); if (B.pintado === f && geo()) return;
    var pz = piezasReposo(); if (!pz) { quitar(); return; }
    /* el reposo ya a la vista: llegó un dato nuevo (Pendientes, avisos, áreas): se cambia en su lugar, sin volver a entrar */
    var ya = !B.eraTema && B.capa && B.capa.parentNode ? B.capa : null, gif = ya && ya.querySelector(".bv-gif");
    if (gif) pz.gif = gif;   // y el mismo GIF: no cambia por un dato nuevo
    pintar(pz, f, ya ? false : animar); B.eraTema = false;
  }
  function tema(t, r) {
    if (!t) return reposo();
    gifsCargar();
    if (B.t && B.id === t.id && B.pintado === "t:" + t.id) return true;
    B.t = t; B.id = t.id || ""; B.render = r; B.eraTema = true;
    return pintar(piezasTema(t, r), "t:" + B.id);
  }
  /* Cambió el tamaño o se giró el iPad: se vuelve a acomodar sin animar (el mismo GIF no cambia: se mueve la misma pieza). */
  function reacomodar() {
    clearTimeout(B.timer);
    B.timer = setTimeout(function () {
      if (!geo()) { quitar(); return; }
      var cur = B.el && B.el.querySelector(".bv-capa:not(.sale)");
      B.pintado = "";
      if (B.t && B.render) { var pz = piezasTema(B.t, B.render); var gif = cur && cur.querySelector(".bv-gif"); if (gif) pz.gif = gif; pintar(pz, "t:" + B.id, false); }
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
    iniciar: function (o) { B.cfg = Object.assign(B.cfg, o || {}); chatEnvolver(); gifsCargar(); if (!B.t) reposo(); },
    ancho: ancho,
    geo: geo,
    tema: tema,
    reposo: function () { reposo(); },
    datos: function () { if (!B.t) reposo(); },
    areas: function (r) { if (r && r.ok) { B.areas = r; if (!B.t) reposo(); } },
    el: function () { return B.el; },
    enTema: function () { return !!B.t && d.documentElement.classList.contains("bv-on"); },
    /* La broma (js/alma-gif.js): el cuadro del GIF del tema, si está a la vista. */
    gifCuadro: function () { var g = B.el && B.el.querySelector(".bv-capa.on:not(.sale) .bv-gif"); return g && g.offsetParent !== null && d.documentElement.classList.contains("bv-on") ? g : null; },
    /* Para las pruebas: el tema del GIF de una tarjeta */
    temaGif: temaGif,
    siguienteGif: gifDel
  };
})(window, document);
