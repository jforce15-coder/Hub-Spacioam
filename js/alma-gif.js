/* GIF de la broma (Juan, 16-nov-2026): «si estamos viendo información y hace una broma, tal vez solo uno de los cuadros del
   bento se convierte en GIF y el resto se queda como información; la broma pasa y el GIF se quita. En la pantalla general,
   tal vez se muestra en el chat.»
   La app (VozNativa.swift · GifBroma.swift) cuenta AlmaVoz.evento({ tipo: "gif", idea }) cuando Alma llama a mostrar_gif
   (solo con Juan y con la pantalla a la vista). Aquí se pide el GIF al Hub (acción gif, apps-script/gif.js: GIPHY rating g,
   nunca un emoji) y se pone:
   · con la ventana del GIF arriba de la roca a la vista (js/alma-bento.js, 19-nov-2026; teléfono, iPad y computadora):
     encima del GIF que está pasando, unos segundos, y después sigue la rotación;
   · con el tablero bento a la vista: encima de UN cuadro (el dato más grande; nunca la foto ni el mapa), unos segundos, y se
     quita con un fundido: el cuadro vuelve a su información;
   · sin tablero, con el chat de la llamada a la vista: como una burbuja de Alma en el chat (se queda, como lo demás del chat);
   · con el Bento vivo (iPad y computadora, #810): encima del GIF del tema, unos segundos, y vuelve el del tema;
   · si no hay nada a la vista, no se muestra.
   Uno a la vez: si ya hay un GIF en pantalla, el siguiente se ignora. Sin dependencias; no toca sa-nav.js ni alma-client.js. */
(function () {
  "use strict";
  var G = { activo: false };
  var QUIETO = false; try { QUIETO = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function ses() { try { return window.SAAuth && SAAuth.session ? SAAuth.session() : null; } catch (e) { return null; } }
  function hub(idea) {
    var d = window.ALMA && ALMA.destino ? ALMA.destino() : null;
    if (!d || !d.url) return Promise.resolve({ ok: false, error: "no_url" });
    return fetch(d.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, cache: "no-store",
      body: JSON.stringify({ hub: 1, action: "gif", idea: idea, token: d.token, session: ses() }) })
      .then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: "red" }; });
  }
  function visible(x) { return !!(x && x.offsetParent !== null && x.getClientRects().length); }
  function estilo() {
    if (document.getElementById("gifb-css")) return;
    var s = document.createElement("style"); s.id = "gifb-css";
    s.textContent =
      ".gifb{position:absolute;inset:0;z-index:3;border-radius:inherit;overflow:hidden;background:#1F1F1F;opacity:0;transition:opacity .35s ease}" +
      ".gifb.on{opacity:1}.gifb img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".gifb small,.gifb-chat small{position:absolute;right:8px;bottom:6px;font:600 9px/1 Montserrat,system-ui,sans-serif;letter-spacing:.04em;color:rgba(255,255,255,.85);text-shadow:0 1px 2px rgba(0,0,0,.5)}" +
      ".gifb-chat{position:relative;align-self:flex-start;max-width:200px;border-radius:20px;overflow:hidden;background:#F3F3F3}" +
      ".gifb-chat img{display:block;width:100%;height:auto;min-height:60px}" +
      "@media (prefers-reduced-motion: reduce){.gifb{transition:none}}";
    document.head.appendChild(s);
  }
  function imagen(r, alFallar) {
    var i = document.createElement("img"); i.alt = r.alt || "GIF"; i.decoding = "async"; i.referrerPolicy = "no-referrer";
    i.onerror = alFallar; i.src = r.url; return i;
  }
  function credito(r) { var c = document.createElement("small"); c.textContent = r.credito || ""; return c; }
  /* El cuadro que se vuelve GIF: el dato más grande del tablero (un número: lo que menos se extraña unos segundos); sin
     datos, el más chico de los demás. Nunca la foto ni el mapa. */
  function cuadroDelTablero() {
    /* La ventana del GIF (js/alma-bento.js): la broma tapa el GIF del tema unos segundos y después sigue la rotación. */
    var bv = null; try { bv = window.AlmaBento && AlmaBento.gifCuadro ? AlmaBento.gifCuadro() : null; } catch (e) {}
    if (bv) return bv;
    var tabs = Array.prototype.filter.call(document.querySelectorAll(".tvb"), visible); if (!tabs.length) return null;
    var cs = Array.prototype.filter.call(tabs[tabs.length - 1].querySelectorAll(".tvb-t"), function (c) {
      return visible(c) && !/(^|\s)tvb-(foto|mapa)(\s|$)/.test(c.className) && c.offsetWidth >= 80 && c.offsetHeight >= 60;
    });
    if (!cs.length) return null;
    var area = function (c) { return c.offsetWidth * c.offsetHeight; }, datos = cs.filter(function (c) { return /(^|\s)tvb-dato(\s|$)/.test(c.className); });
    return (datos.length ? datos.sort(function (a, b) { return area(b) - area(a); }) : cs.sort(function (a, b) { return area(a) - area(b); }))[0];
  }
  function chatDeLaLlamada() {
    var m = Array.prototype.filter.call(document.querySelectorAll(".san-msgs"), visible); return m.length ? m[0] : null;
  }
  function enCuadro(c, r) {
    var g = document.createElement("div"); g.className = "gifb";
    g.setAttribute("role", "img"); g.setAttribute("aria-label", "GIF: " + (r.alt || ""));
    var fin = function () {
      if (!g.parentNode) return; g.classList.remove("on");
      setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); G.activo = false; }, QUIETO ? 0 : 400);
    };
    g.appendChild(imagen(r, fin)); g.appendChild(credito(r)); c.appendChild(g);
    requestAnimationFrame(function () { g.classList.add("on"); });
    setTimeout(fin, Math.max(3, Math.min(10, +r.segundos || 6)) * 1000);
  }
  function enChat(m, r) {
    var b = document.createElement("div"); b.className = "gifb-chat";
    b.appendChild(imagen(r, function () { if (b.parentNode) b.parentNode.removeChild(b); })); b.appendChild(credito(r));
    m.appendChild(b); m.scrollTop = m.scrollHeight;
    setTimeout(function () { G.activo = false; }, Math.max(3, Math.min(10, +r.segundos || 6)) * 1000);
  }
  function mostrar(idea) {
    if (G.activo || !idea || document.visibilityState === "hidden") return;
    if (!cuadroDelTablero() && !chatDeLaLlamada()) return;   // nada a la vista: no se pide nada
    G.activo = true;
    hub(String(idea).slice(0, 60)).then(function (r) {
      if (!r || !r.ok || !/^https:\/\/[^\s"'<>]+$/.test(String(r.url || ""))) { G.activo = false; return; }
      estilo();
      var c = cuadroDelTablero(); if (c) return enCuadro(c, r);
      var m = chatDeLaLlamada(); if (m) return enChat(m, r);
      G.activo = false;
    });
  }
  /* La llamada web de la computadora con el Bento vivo (js/alma-voz.js, mostrar_gif) */
  window.addEventListener("sa-voz-gif", function (e) { mostrar(e && e.detail && e.detail.idea); });
  window.AlmaGif = {
    evento: function (e) {
      if (!e) return;
      if (e.tipo === "gif") mostrar(e.idea);
      else if (e.tipo === "estado" && e.estado !== "hablando" && e.estado !== "conectando") Array.prototype.forEach.call(document.querySelectorAll(".gifb"), function (g) { g.parentNode.removeChild(g); G.activo = false; });
    },
    /* Para las capturas y las pruebas: muestra un GIF ya resuelto, sin pedirlo al Hub */
    probar: function (r) { estilo(); var c = cuadroDelTablero(); if (c) return enCuadro(c, r); var m = chatDeLaLlamada(); if (m) enChat(m, r); }
  };
})();
