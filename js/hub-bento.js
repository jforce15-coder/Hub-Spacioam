/* Bento del inicio y Pantalla de reposo del Hub (Juan, 19-nov-2026, #898: «integrar en el Hub el modelo y diseño de bento box
   para la pantalla de inicio y reposo»). El mismo modelo del reposo del Bento vivo de Alma (js/alma-bento.js), en el Hub:
   · Inicio (hub.spacioam.com, vista «Inicio»): debajo del saludo, una banda con el atardecer de Alma y las tarjetas de
     vidrio líquido del reposo: la imagen de hoy (con la fecha), Necesita tu sí, Tu agenda, Familia, Avisos y Tus áreas.
     En el teléfono van solo la imagen, Necesita tu sí, Tu agenda y Familia (lo mismo que el bento vivo deja donde caben
     menos). Lo que no llega no se pinta y los demás crecen; sin ningún dato, no hay banda (el inicio de siempre).
   · Pantalla de reposo (iPad y computadora, 900 × 600 o más): si el inicio queda 3 min sin tocar, el atardecer ocupa la
     pantalla con la hora grande, la fecha y las mismas tarjetas. Cualquier toque, tecla o movimiento la quita (ese primer
     toque no abre nada). No sale con Alma abierta, escribiendo, con la pestaña escondida ni con «reducir movimiento» se
     anima: solo aparece y se va.
   · Los datos: Pendientes, Notificaciones y las áreas (que traen la vida personal: apps-script/vidahoy.js), pedidos JUNTOS
     al abrir (ds/velocidad.md, regla 7) y otra vez cada 5 min. Sin otra llamada a la IA ni a Hospitable. Nada se guarda
     en el dispositivo.
   · Tocar una tarjeta abre lo suyo: Necesita tu sí, Avisos y Tus áreas en el inicio de Alma; Familia, la app de la familia.
   API: HubBento.montar(el) (lo hace solo con #hub-bento) · HubBento.reposo(on) · HubBento.datos() (pruebas) */
(function (w, d) {
  "use strict";
  if (w.HubBento) return;
  var REPOSO_MS = 180000, DATOS_MS = 300000;
  var H = { datos: null, pide: null, t: 0, ultimo: Date.now(), rep: null, repDesde: 0, firma: "" };
  var QUIETO = false; try { QUIETO = w.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"], MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var ATARDECER = "assets/alma/atardecer-difuso.jpg", HOY = "assets/hub-hoy-v2.jpg", INICIO_ALMA = "alma/inicio.html";

  /* ── Vidrio líquido (glosario): vidrio claro esmerilado sobre el atardecer, con su filo de luz y su borde fino. Los
     mismos valores de alma/inicio.html (.bv-c > .tvb-t) para que el Hub y Alma se vean iguales. ── */
  var CSS = [
    ".hb{position:relative;margin:0 0 clamp(16px,2.4vh,22px);border-radius:26px;padding:10px;overflow:hidden;background:#B9ABAE url(" + ATARDECER + ") center/cover no-repeat;box-shadow:0 18px 50px -30px rgba(40,30,25,.55);font:500 12px/1.4 Montserrat,system-ui,sans-serif;color:#3E3F3F;animation:hb-in .56s cubic-bezier(.22,.61,.36,1) backwards}",
    "@keyframes hb-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
    ".hb-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(128px,auto);gap:10px;grid-auto-flow:dense}",
    "@media (min-width:780px){.hb{padding:14px}.hb-g{grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(150px,auto);gap:14px}}",
    ".hb-t{position:relative;grid-column:span 2;min-width:0;overflow:hidden;box-sizing:border-box;border-radius:22px;padding:14px 16px;text-align:left;color:#3E3F3F;",
    "background:linear-gradient(150deg,rgba(255,255,255,.9) 0%,rgba(255,253,251,.82) 46%,rgba(255,251,248,.86) 100%);-webkit-backdrop-filter:blur(30px) saturate(185%);backdrop-filter:blur(30px) saturate(185%);",
    "box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 1px 0 0 rgba(255,255,255,.5),inset 0 -1px 0 rgba(255,255,255,.3),inset 0 0 0 1px rgba(255,255,255,.42),0 22px 46px -30px rgba(40,30,25,.55)}",
    ".hb-t::after{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(120% 60% at 0% 0%,rgba(255,255,255,.34),rgba(255,255,255,0) 58%);mix-blend-mode:soft-light}",
    "@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.hb-t{background:rgba(255,253,251,.95)}}",
    "@media (prefers-reduced-transparency:reduce){.hb-t{background:#FFFDFB;-webkit-backdrop-filter:none;backdrop-filter:none}}",
    ".hb-t[role=button]{cursor:pointer;transition:transform .18s cubic-bezier(.22,.61,.36,1)}",
    ".hb-t[role=button]:active{transform:scale(.985)}",
    ".hb-t[role=button]:focus-visible{outline:2px solid #E9826A;outline-offset:2px}",
    ".hb-t.ancha{grid-column:1 / -1}",
    ".hb-foto{padding:0;background:#B9A493;min-height:150px}",
    ".hb-foto::after{background:linear-gradient(150deg,rgba(255,255,255,.18),rgba(255,255,255,0) 40%);mix-blend-mode:normal}",
    ".hb-foto>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
    "@media (min-width:780px){.hb-foto:not(.hb-baja){grid-row:span 2}}",
    "@media (max-width:779px){.hb-t.hb-ancho-solo{display:none}}",
    /* el nombre sobre la foto, con su velo (nunca texto directo sobre la foto) */
    ".hb-pie{position:absolute;left:0;right:0;bottom:0;padding:40px 16px 14px;color:#FFFDFB;background:linear-gradient(to top,rgba(30,22,20,.72),rgba(30,22,20,0))}",
    ".hb-pie b{display:block;font:400 26px/1.05 Valky,'Cormorant Garamond',Georgia,serif;text-wrap:balance}",
    ".hb-pie small{display:block;margin-top:4px;font-size:12px;opacity:.92}",
    ".hb-kf{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}",
    ".hb-k{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#6F6867;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".hb-v{display:block;margin-top:3px;font:400 28px/1.05 Valky,'Cormorant Garamond',Georgia,serif;color:#3E3F3F}",
    ".hb-nada{font-size:22px}",
    ".hb-l{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}",
    ".hb-l li{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px;line-height:1.3}",
    ".hb-l li>b{flex:none;font:600 9.5px Montserrat,system-ui,sans-serif;padding:3px 8px;border-radius:999px;background:#ECEAE7;color:#3E3F3F}",
    ".hb-l li>span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".hb-l li.mas{color:#6F6867;font-size:11.5px}",
    ".hb-frase{display:block;margin-top:8px;quotes:none;font:italic 400 16px/1.3 Valky,'Cormorant Garamond',Georgia,serif;color:#3E3F3F}",
    ".hb-ar{list-style:none;margin:10px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}",
    ".hb-ar li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.62);font-size:12px}",
    ".hb-ar li b{font-variant-numeric:tabular-nums}",
    /* ── Pantalla de reposo: el atardecer ocupa la pantalla; la hora en grande y las tarjetas. Debajo del menú de Alma
       (sa-nav, z 880): la roca sigue a mano. ── */
    ".hb-rep{position:fixed;inset:0;z-index:870;display:flex;flex-direction:column;gap:clamp(18px,3vh,30px);box-sizing:border-box;overflow:hidden;",
    "padding:max(28px,calc(env(safe-area-inset-top) + 18px)) clamp(28px,8vw,112px) max(28px,calc(env(safe-area-inset-bottom) + 18px));",
    "background:linear-gradient(180deg,rgba(34,26,28,.34),rgba(34,26,28,0) 42%),#B9ABAE url(" + ATARDECER + ") center/cover no-repeat;opacity:0;transition:opacity .7s cubic-bezier(.22,.61,.36,1);cursor:default}",
    ".hb-rep.on{opacity:1}",
    ".hb-hora{color:#FFFDFB;text-shadow:0 2px 24px rgba(34,26,28,.35)}",
    ".hb-hora b{display:block;font:300 clamp(64px,10vw,112px)/.95 Valky,'Cormorant Garamond',Georgia,serif;letter-spacing:-.01em;font-variant-numeric:tabular-nums}",
    ".hb-hora small{display:block;margin-top:8px;font:500 13px Montserrat,system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase}",
    ".hb-rep .hb-g{flex:1;min-height:0;overflow:hidden;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(min-content,1fr);gap:16px}",
    ".hb-rep .hb-t{padding:18px 20px}",
    ".hb-rep .hb-foto{padding:0}",
    ".hb-rep .hb-v{font-size:34px}",
    ".hb-rep .hb-l li{font-size:14px}",
    ".hb-volver{align-self:center;padding:8px 16px;border-radius:999px;font:500 11.5px Montserrat,system-ui,sans-serif;letter-spacing:.06em;color:#FFFDFB;background:rgba(34,26,28,.42);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}",
    "@media (prefers-reduced-motion:reduce){.hb{animation:none}.hb-rep{transition:none}.hb-t[role=button]{transition:none}}"
  ].join("");

  function el(tag, cls, txt) { var x = d.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }
  function estilo() { if (d.getElementById("hb-css")) return; var s = el("style"); s.id = "hb-css"; s.textContent = CSS; d.head.appendChild(s); }
  function boton(c, etiqueta, ir) {
    c.setAttribute("role", "button"); c.tabIndex = 0; if (etiqueta) c.setAttribute("aria-label", etiqueta);
    c.onclick = function (e) { e.stopPropagation(); ir(); };
    c.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } };
    return c;
  }
  function irA(u) { try { if (w.SANav && w.SANav.ir) { w.SANav.ir(u); return; } } catch (e) {} w.location.href = u; }
  function abrirFuera(u) { try { w.open(u, "_blank", "noopener"); } catch (e) {} }
  function fechaLarga(h) { var dia = DIAS[h.getDay()]; return dia.charAt(0).toUpperCase() + dia.slice(1) + " " + h.getDate() + " de " + MESES[h.getMonth()]; }

  /* ── Los datos: Pendientes, Notificaciones y las áreas, juntos (nunca en fila) ── */
  function cargar() {
    var A = w.ALMA; if (!A || !A.hasApi || !A.hasApi() || H.pide) return H.pide;
    var uno = function (f) { return f ? Promise.resolve(f()).then(function (r) { return r && r.ok ? r : null; }, function () { return null; }) : Promise.resolve(null); };
    H.pide = Promise.all([uno(A.pendientes), uno(A.notificaciones), uno(A.areas)]).then(function (r) {
      H.pide = null; H.t = Date.now();
      H.datos = { pend: r[0], noti: r[1], areas: r[2] };
      pintarTodo(); return H.datos;
    });
    return H.pide;
  }

  /* ── Las tarjetas (las mismas del reposo del Bento vivo) ── */
  function lista(k, items, vacio) {
    var c = el("div", "hb-t"), kf = el("div", "hb-kf"); kf.appendChild(el("small", "hb-k", k)); c.appendChild(kf);
    if (!items.length) { c.appendChild(el("b", "hb-v hb-nada", vacio)); return c; }
    c.appendChild(el("b", "hb-v", String(items.length)));
    var u = el("ul", "hb-l"); items.slice(0, 4).forEach(function (x) { var li = el("li"); if (x.b) li.appendChild(el("b", "", x.b)); li.appendChild(el("span", "", x.t)); u.appendChild(li); });
    if (items.length > 4) u.appendChild(el("li", "mas", "y " + (items.length - 4) + " más"));
    c.appendChild(u); return c;
  }
  function familia(f) {
    var c = el("div", "hb-t"), kf = el("div", "hb-kf"); kf.appendChild(el("small", "hb-k", "Familia · hoy")); c.appendChild(kf);
    var u = el("ul", "hb-l"), fila = function (b, t) { if (!t) return; var li = el("li"); li.appendChild(el("b", "", b)); li.appendChild(el("span", "", t)); u.appendChild(li); };
    if (f.finde) fila("Hoy", "Fin de semana en familia");
    else { fila("Lleva", f.lleva); fila("En casa", f.casa); fila("Tarde", f.tarde); }
    if (u.children.length) c.appendChild(u);
    if (f.frase) c.appendChild(el("q", "hb-frase", f.frase));
    if (/^https:\/\//.test(String(f.url || ""))) boton(c, "Familia hoy: abrir The Gentle Stoic Parent", function () { abrirFuera(f.url); });
    return c;
  }
  /* Las piezas en su orden (Necesita tu sí, Tu agenda, Familia, Avisos, Tus áreas). null si no hay nada que mostrar. */
  function piezas() {
    var x = H.datos; if (!x) return null;
    var info = [], areas = (x.areas && x.areas.areas) || [], nombreArea = {};
    areas.forEach(function (a) { nombreArea[a.k] = a.n; });
    if (x.pend) {
      var at = [].concat(x.pend.atencion || []);
      info.push(boton(lista("Necesita tu sí", at.map(function (p) { return { t: p.titulo || p.resumen || "", b: nombreArea[p.area] || "" }; }), "Todo al día"), "Necesita tu sí: abrir Pendientes", function () { irA(INICIO_ALMA); }));
    }
    var vida = (x.areas && x.areas.vida) || {};
    if (vida.agenda && vida.agenda.eventos) {
      var ahora = Date.now(), ev = vida.agenda.eventos.filter(function (e) { var f = Date.parse(e.fin || ""); return !f || f > ahora; });
      info.push(lista("Tu agenda", ev.map(function (e) { return { b: (e.dia === "mañana" ? "Mañana" : "Hoy") + (e.h ? " " + e.h : ""), t: e.t || "" }; }), "Agenda libre"));
    }
    if (vida.familia && (vida.familia.lleva || vida.familia.frase || vida.familia.finde)) info.push(familia(vida.familia));
    if (x.noti) {
      var nl = [].concat(x.noti.items || x.noti.lista || []), av = lista("Avisos", nl.map(function (n) { return { t: n.titulo || n.texto || "" }; }), "Sin avisos nuevos");
      av.classList.add("hb-ancho-solo"); info.push(boton(av, "Avisos: abrir Notificaciones", function () { irA(INICIO_ALMA); }));
    }
    if (areas.length) {
      var c = el("div", "hb-t hb-ancho-solo"); c.appendChild(el("small", "hb-k", "Tus áreas"));
      var u = el("ul", "hb-ar"); areas.slice(0, 6).forEach(function (a) { var li = el("li"); li.appendChild(el("span", "", a.n || "")); li.appendChild(el("b", "", String((a.proyectos || []).length))); u.appendChild(li); });
      c.appendChild(u); info.push(boton(c, "Tus áreas: abrir las esferas de Alma", function () { irA(INICIO_ALMA); }));
    }
    return info.length ? info : null;
  }
  /* La imagen de hoy (siempre 1 imagen, nunca un cuadro vacío) y las tarjetas en la cuadrícula. En la pantalla ancha la
     imagen ocupa 2 × 2 y las tarjetas 2 columnas cada una; si el último renglón queda cojo, la última se estira. */
  function cuadricula() {
    var info = piezas(); if (!info) return null;
    var g = el("div", "hb-g"), f = el("div", "hb-t hb-foto"), i = el("img"); i.alt = ""; i.decoding = "async"; i.src = HOY; f.appendChild(i);
    var p = el("div", "hb-pie"); p.appendChild(el("b", "", fechaLarga(new Date()))); p.appendChild(el("small", "", "Spacio AM · hoy")); f.appendChild(p);
    g.appendChild(f); info.forEach(function (c) { g.appendChild(c); });
    /* la imagen ocupa 2 renglones a la derecha de las 2 primeras; después van de a 2 por renglón */
    if (info.length > 2 && (info.length - 2) % 2 === 1) info[info.length - 1].classList.add("ancha");
    if (info.length < 2) f.classList.add("hb-baja");   // con una sola tarjeta la imagen no deja un hueco debajo
    return g;
  }

  /* ── El inicio: la banda debajo del saludo ── */
  function montar(raiz) {
    if (!raiz) return; estilo();
    var g = cuadricula();
    if (!g) { raiz.innerHTML = ""; raiz.setAttribute("data-hb", H.firma); return; }
    var c = el("section", "hb"); c.setAttribute("aria-label", "Tu día"); c.appendChild(g);
    raiz.innerHTML = ""; raiz.appendChild(c); raiz.setAttribute("data-hb", H.firma);
  }
  function pintarTodo() {
    H.firma = String(H.t);
    var r = d.getElementById("hub-bento"); if (r) montar(r);
    if (H.rep) pintarReposo();
  }

  /* ── Pantalla de reposo ── */
  function ancha() { var W = d.documentElement.clientWidth || w.innerWidth, Hh = (w.visualViewport && w.visualViewport.height) || w.innerHeight; return W >= 900 && Hh >= 600; }
  function puedeReposar() {
    var r = d.getElementById("hub-bento");
    if (!r || !r.firstChild || !r.offsetParent || !ancha() || d.visibilityState === "hidden") return false;
    if (d.querySelector("#sa-nav-root .san-ov.on")) return false;   // Alma abierta (llamada o chat)
    var a = d.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || (a && a.isContentEditable)) return false;
    return !d.querySelector('[aria-modal="true"]');
  }
  function reloj() {
    if (!H.rep) return; var h = new Date(), b = H.rep.querySelector(".hb-hora b"), s = H.rep.querySelector(".hb-hora small");
    if (b) b.textContent = h.getHours() + ":" + String(h.getMinutes()).padStart(2, "0");
    if (s) s.textContent = fechaLarga(h);
  }
  function pintarReposo() {
    var g = cuadricula(); if (!g) { reposo(false); return; }
    var vieja = H.rep.querySelector(".hb-g"); if (vieja) vieja.replaceWith(g); else H.rep.insertBefore(g, H.rep.querySelector(".hb-volver"));
    reloj();
  }
  function reposo(on) {
    if (on && !H.rep) {
      estilo();
      var r = el("div", "hb-rep"); r.setAttribute("role", "dialog"); r.setAttribute("aria-label", "Pantalla de reposo");
      var hr = el("div", "hb-hora"); hr.appendChild(el("b")); hr.appendChild(el("small")); r.appendChild(hr);
      r.appendChild(el("div", "hb-volver", "Toca para volver"));
      H.rep = r; H.repDesde = Date.now(); pintarReposo(); if (!H.rep) return;
      d.body.appendChild(r);
      if (QUIETO) r.classList.add("on"); else requestAnimationFrame(function () { requestAnimationFrame(function () { if (H.rep === r) r.classList.add("on"); }); });
      if (Date.now() - H.t > DATOS_MS) cargar();
    } else if (!on && H.rep) {
      var v = H.rep; H.rep = null; v.classList.remove("on");
      setTimeout(function () { v.remove(); }, QUIETO ? 0 : 450);
    }
  }
  /* Cualquier toque, tecla o movimiento cuenta como uso. Con el reposo a la vista, lo quita (y ese toque no abre nada). */
  var TRAGO = 0;
  function uso(e) {
    H.ultimo = Date.now();
    if (e.type === "click" && Date.now() - TRAGO < 700) { e.preventDefault(); e.stopPropagation(); return; }   // el clic del toque que quitó el reposo
    if (!H.rep) return;
    if (e.type === "pointermove" && Date.now() - H.repDesde < 800) return;   // el cursor quieto que el navegador reporta al aparecer
    if (e.type === "pointerdown" || e.type === "click" || e.type === "keydown") { e.preventDefault(); e.stopPropagation(); TRAGO = Date.now(); }
    reposo(false);
  }
  ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "click"].forEach(function (t) { d.addEventListener(t, uso, { capture: true, passive: t !== "pointerdown" && t !== "click" && t !== "keydown" }); });

  /* El inicio del Hub se dibuja con React (index.html): cuando vuelve a la vista, #hub-bento llega vacío y se pinta otra vez. */
  setInterval(function () {
    var r = d.getElementById("hub-bento");
    if (r && (!H.datos || Date.now() - H.t > DATOS_MS) && d.visibilityState !== "hidden") cargar();
    if (r && H.datos && r.getAttribute("data-hb") !== H.firma) montar(r);
    if (H.rep) { reloj(); if (!r || !r.offsetParent) reposo(false); }
    else if (Date.now() - H.ultimo > REPOSO_MS && puedeReposar()) reposo(true);
  }, 1000);

  w.HubBento = { montar: montar, reposo: reposo, datos: function () { return H.datos; }, cargar: cargar, _poner: function (x) { H.datos = x; H.t = Date.now(); pintarTodo(); } };
})(window, document);
