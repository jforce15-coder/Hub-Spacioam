/* Spacio AM · Desliza para actualizar (nov 2026)
   ---------------------------------------------------------------------------
   Estándar de todas las páginas (Juan, 16-nov-2026, Hub #564): en el teléfono y la tablet no hay botón de
   actualizar arriba a la derecha; se actualiza bajando la página desde arriba, como en iOS o Instagram.
   Lo carga sa-sesion.js en todas las apps (Hub, Hola, Epi, Mi, Grow, Docs); no hay que tocar cada app.

   · Pantallas táctiles: los botones de actualizar (aria-label o title «Actualizar», «Actualizar datos»,
     «Refresh», «Refresh data», o con data-sa-actualizar) se esconden. En la computadora se quedan, porque
     con el mouse no se puede deslizar.
   · Al soltar después de bajar lo suficiente: si la página tiene window.saRefrescar(), se usa; si no, se toca
     el botón de actualizar de esa pantalla (el más cercano a donde empezó el dedo); si no hay, se recarga.
   · En la app de iPhone Alma lo hace la app (nativo); aquí no se arma para no hacerlo dos veces.
   · Una página puede apagarlo con <html data-sin-tirar> y una zona con data-sin-tirar.
   --------------------------------------------------------------------------- */
(function (w, d) {
  "use strict";
  if (w.SATirar) return;
  var SEL = 'button[aria-label="Actualizar"],button[title="Actualizar"],button[aria-label="Actualizar datos"],' +
            'button[aria-label="Refresh"],button[title="Refresh"],button[aria-label="Refresh data"],[data-sa-actualizar]';
  var UMBRAL = 72, MAX = 110;
  var tactil = false;
  try { tactil = w.matchMedia("(hover: none) and (pointer: coarse)").matches; } catch (e) {}
  var enApp = !!(w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.almaCampo);

  /* El botón de actualizar de la pantalla donde está `desde` (o cualquiera en una capa visible). */
  function visible(el) { var p = el.parentElement; return !!(p && p.getClientRects().length) && !el.disabled; }
  function boton(desde) {
    var a = desde && desde.nodeType === 1 ? desde : null;
    while (a && a !== d.documentElement) {
      var l = a.querySelectorAll(SEL);
      for (var i = l.length - 1; i >= 0; i--) if (visible(l[i])) return l[i];
      a = a.parentElement;
    }
    var t = d.querySelectorAll(SEL);
    for (var j = t.length - 1; j >= 0; j--) if (visible(t[j])) return t[j];
    return null;
  }
  /* Actualiza la pantalla. Devuelve una promesa que termina cuando ya se puede quitar el indicador. */
  function refrescar(desde) {
    try {
      if (typeof w.saRefrescar === "function") return Promise.resolve(w.saRefrescar()).catch(function () {});
      var b = boton(desde);
      if (b) { b.click(); return new Promise(function (r) { setTimeout(r, 900); }); }
    } catch (e) {}
    location.reload();
    return new Promise(function () {});   // la página se va; el indicador se queda girando hasta entonces
  }
  w.SATirar = { refrescar: refrescar, selector: SEL };

  function css() {
    var s = d.createElement("style"); s.id = "sa-tirar-css";
    s.textContent =
      "@media (hover:none) and (pointer:coarse){" + SEL.split(",").map(function (x) { return x + ":not([data-sa-mostrar])"; }).join(",") + "{display:none!important}}" +
      (enApp ? "" :
      "html.sa-tirar-on,html.sa-tirar-on body{overscroll-behavior-y:contain}" +
      "#sa-tirar{position:fixed;left:50%;top:env(safe-area-inset-top,0px);z-index:2147483000;width:38px;height:38px;margin-left:-19px;border-radius:50%;" +
      "background:#FFFFFF;box-shadow:0 6px 18px rgba(62,63,63,.16);display:grid;place-items:center;pointer-events:none;opacity:0;" +
      "transform:translateY(-48px);color:#3E3F3F}" +
      "#sa-tirar.vuelve{transition:transform .28s cubic-bezier(.22,.61,.36,1),opacity .28s}" +
      "#sa-tirar svg{width:20px;height:20px;transition:color .15s}#sa-tirar.listo svg{color:#E9826A}" +
      "#sa-tirar.gira svg{animation:sa-tirar-g .8s linear infinite;color:#E9826A}" +
      "@keyframes sa-tirar-g{to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion:reduce){#sa-tirar.gira svg{animation:none}}");
    (d.head || d.documentElement).appendChild(s);
  }
  css();
  if (!tactil || enApp || /CriOS|FxiOS/.test(navigator.userAgent)) return;   // Chrome/Firefox de iPhone traen el suyo

  var ind, flecha, y0 = 0, x0 = 0, tira = 0, armado = false, ocupado = false, origen = null;
  function montar() {
    if (ind || !d.body) return;
    d.documentElement.classList.add("sa-tirar-on");
    ind = d.createElement("div"); ind.id = "sa-tirar"; ind.setAttribute("aria-hidden", "true");
    ind.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
    flecha = ind.firstChild;
    d.body.appendChild(ind);
  }
  function poner(px, transicion) {
    if (!ind) return;
    ind.classList.toggle("vuelve", !!transicion);
    var p = Math.min(px / UMBRAL, 1);
    ind.style.opacity = px > 4 ? String(Math.min(1, p * 1.2)) : "0";
    ind.style.transform = "translateY(" + (px - 48 + (px > 0 ? 8 : 0)) + "px)";
    if (!ind.classList.contains("gira")) flecha.style.transform = "rotate(" + Math.round(p * 270) + "deg)";
    ind.classList.toggle("listo", px >= UMBRAL);
  }
  /* ¿Se puede tirar desde aquí? Nada desplazado hacia abajo entre el dedo y la página, y no es un campo,
     un mapa, la roca ni algo que maneja su propio dedo (touch-action:none). */
  function sePuede(t) {
    if (d.documentElement.hasAttribute("data-sin-tirar")) return false;
    if ((w.scrollY || d.documentElement.scrollTop || 0) > 0) return false;
    for (var a = t; a && a.nodeType === 1 && a !== d.body; a = a.parentElement) {
      if (a.hasAttribute("data-sin-tirar") || a.isContentEditable || /^(INPUT|TEXTAREA|SELECT|CANVAS|VIDEO|IFRAME)$/.test(a.tagName)) return false;
      if (a.classList && (a.classList.contains("san-scope"))) return false;
      var cs = w.getComputedStyle(a);
      if (cs.touchAction === "none") return false;
      if (a.scrollTop > 0 && /(auto|scroll)/.test(cs.overflowY)) return false;
    }
    return true;
  }
  d.addEventListener("touchstart", function (e) {
    armado = false; tira = 0;
    if (ocupado || e.touches.length !== 1) return;
    if (!sePuede(e.target)) return;
    montar();
    armado = true; origen = e.target;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
  }, { passive: true });
  d.addEventListener("touchmove", function (e) {
    if (!armado) return;
    var dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if (tira === 0 && (dy <= 0 || dx > dy)) { armado = false; return; }   // va hacia arriba o de lado: no es para nosotros
    if ((w.scrollY || 0) > 0) { armado = false; poner(0, true); return; }
    tira = Math.min(MAX, dy * 0.55);
    poner(tira, false);
  }, { passive: true });
  function soltar() {
    if (!armado) return;
    armado = false;
    if (tira < UMBRAL) { tira = 0; poner(0, true); return; }
    ocupado = true;
    poner(UMBRAL, true);
    ind.classList.add("gira");
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    refrescar(origen).then(function () {
      ind.classList.remove("gira"); poner(0, true); ocupado = false; tira = 0;
    });
  }
  d.addEventListener("touchend", soltar, { passive: true });
  d.addEventListener("touchcancel", function () { if (armado) { armado = false; tira = 0; poner(0, true); } }, { passive: true });
})(window, document);
