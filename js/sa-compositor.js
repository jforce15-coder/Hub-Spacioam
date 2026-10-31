/* ═══ EL NUEVO CHAT DE ALMA · piezas compartidas del compositor (issue #304) ══════════════════════════════════════
   Copiado de WhatsApp. El cuadro tiene dos estados:
     · inactivo (vacío): «+» · cuadro · roca · micrófono
     · activo (desde la primera letra): «+» · cuadro · roca · enviar
   La roca: 1 toque = Mejorar (o Redactar con Alma si está vacío y hay huésped) · 2 toques = hablar con Alma.
   Enter nunca envía: solo el botón. El único hint es «Mejorar», encima de la roca (js/sa-nav.js).

   Este archivo no pinta el cuadro (cada pantalla lo tiene): da las dos piezas que se repiten.
     SAComp.dictar({ caja, onTexto, onFin })  → el micrófono: graba con la onda donde va el texto; ✓ lo pasa a texto
                                                (ALMA.dictar) y onTexto(texto) lo pone en el cuadro. × cancela.
     SAComp.mas({ ancla, texto, poner, extras }) → el menú del «+»: plantillas personales (ALMA.plantillas), «Guardar
                                                este texto como plantilla» y lo que la pantalla agregue (p. ej. Foto).
   Necesita js/alma-client.js (window.ALMA). */
(function (w, d) {
  "use strict";
  if (w.SAComp) return;

  var CSS = [
    ".sac-rec{position:absolute;inset:0;z-index:3;display:flex;align-items:center;gap:6px;padding:0 4px;border-radius:inherit;background:#FFFFFF;font-family:Montserrat,system-ui,sans-serif;animation:sac-in .18s cubic-bezier(.22,.61,.36,1)}",
    "@keyframes sac-in{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}",
    ".sac-rec button{flex-shrink:0;width:40px;height:40px;border-radius:50%;border:none;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .1s,background .18s}",
    ".sac-rec button:active{transform:scale(.92)}",
    ".sac-rec .x{background:transparent;color:#6F6867}.sac-rec .x:hover{background:#F5F3F0}",
    ".sac-rec .ok{background:#3E3F3F;color:#FAFAFA}",
    ".sac-rec .ok[disabled]{opacity:.45}",
    ".sac-rec .pt{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:#E9826A;animation:sac-lat 1.1s ease-in-out infinite}",
    "@keyframes sac-lat{0%,100%{opacity:1}50%{opacity:.25}}",
    ".sac-rec .tm{flex-shrink:0;font-size:12px;color:#6F6867;font-variant-numeric:tabular-nums;min-width:32px}",
    ".sac-rec .onda{flex:1;min-width:0;height:28px;display:flex;align-items:center;justify-content:flex-end;gap:2px;overflow:hidden}",
    ".sac-rec .onda i{flex:0 0 3px;height:4px;border-radius:2px;background:#3E3F3F;opacity:.75;transition:height .09s linear}",
    ".sac-rec .msg{flex:1;min-width:0;font-size:13px;color:#6F6867;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sac-mas-velo{position:fixed;inset:0;z-index:2147483000}",
    ".sac-mas{position:fixed;z-index:2147483001;width:min(320px,calc(100vw - 24px));max-height:min(60vh,440px);overflow:auto;padding:6px;background:#FFFFFF;border:1px solid rgba(62,63,63,.08);border-radius:16px;box-shadow:0 12px 40px rgba(62,63,63,.12),0 1px 2px rgba(62,63,63,.06);font-family:Montserrat,system-ui,sans-serif;animation:sac-in .18s cubic-bezier(.22,.61,.36,1)}",
    ".sac-mas h4{margin:8px 10px 4px;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#6F6867}",
    ".sac-mas .it{width:100%;display:flex;align-items:center;gap:10px;min-height:44px;padding:0 10px;border:none;border-radius:10px;background:transparent;color:#3E3F3F;font:500 13px/1.3 Montserrat,system-ui,sans-serif;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".sac-mas .it:hover{background:#F5F3F0}",
    ".sac-mas .pl{display:flex;align-items:center;gap:2px}",
    ".sac-mas .pl .it{flex:1;min-width:0}",
    ".sac-mas .pl .it span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".sac-mas .pl .it small{display:block;font-size:11.5px;font-weight:400;color:#6F6867;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".sac-mas .bo{flex-shrink:0;width:36px;height:36px;border:none;border-radius:50%;background:transparent;color:#938B8A;cursor:pointer;display:grid;place-items:center}",
    ".sac-mas .bo:hover{background:#F5F3F0;color:#B54D36}",
    ".sac-mas .nota{margin:6px 10px 8px;font-size:12px;line-height:1.45;color:#6F6867}",
    ".sac-mas hr{border:none;height:1px;background:#EEEAE5;margin:4px 6px}"
  ].join("");
  function estilos() { if (d.getElementById("sac-css")) return; var s = d.createElement("style"); s.id = "sac-css"; s.textContent = CSS; d.head.appendChild(s); }

  var SVG = {
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ok: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    guardar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    plantilla: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 6h14M5 12h14M5 18h9"/></svg>',
    borrar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  SVG.mic = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  SVG.mas = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  /* ── El micrófono ───────────────────────────────────────────────────────────────────────────────────────────── */
  var actual = null;   // una grabación a la vez
  function dictar(o) {
    estilos();
    o = o || {};
    var caja = o.caja; if (!caja) return;
    if (actual) { actual.cancelar(); }
    var api = w.ALMA && w.ALMA.dictar && (!w.ALMA.hasApi || w.ALMA.hasApi());
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !w.MediaRecorder || !api) { aviso(caja, "Aquí no puedo grabar; escríbelo."); return; }
    if (getComputedStyle(caja).position === "static") caja.style.position = "relative";
    var ui = d.createElement("div"); ui.className = "sac-rec"; ui.setAttribute("role", "group"); ui.setAttribute("aria-label", "Dictado");
    var bx = d.createElement("button"); bx.type = "button"; bx.className = "x"; bx.innerHTML = SVG.x; bx.setAttribute("aria-label", "Cancelar");
    var pt = d.createElement("span"); pt.className = "pt";
    var tm = d.createElement("span"); tm.className = "tm"; tm.textContent = "0:00";
    var onda = d.createElement("span"); onda.className = "onda"; onda.setAttribute("aria-hidden", "true");
    var bok = d.createElement("button"); bok.type = "button"; bok.className = "ok"; bok.innerHTML = SVG.ok; bok.setAttribute("aria-label", "Listo: pasar a texto");
    ui.appendChild(bx); ui.appendChild(pt); ui.appendChild(tm); ui.appendChild(onda); ui.appendChild(bok);
    caja.appendChild(ui);
    var N = Math.max(12, Math.floor((caja.clientWidth - 150) / 5)), barras = [];
    for (var i = 0; i < N; i++) { var b = d.createElement("i"); onda.appendChild(b); barras.push(b); }

    var flujo = null, rec = null, partes = [], t0 = 0, reloj = 0, raf = 0, ctx = null, an = null, cancelado = false, fin = false;
    function limpiar() {
      fin = true; clearInterval(reloj); cancelAnimationFrame(raf);
      try { if (flujo) flujo.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { if (ctx) ctx.close(); } catch (e) {}
      if (actual === yo) actual = null;
    }
    function cerrar() { limpiar(); if (ui.parentNode) ui.parentNode.removeChild(ui); try { o.onFin && o.onFin(); } catch (e) {} }
    function mostrar(txt, quedarse) {
      pt.remove(); tm.remove(); onda.remove(); bok.disabled = true;
      var m = ui.querySelector(".msg") || d.createElement("span"); m.className = "msg"; m.textContent = txt; ui.insertBefore(m, bok);
      if (!quedarse) setTimeout(cerrar, 2600);
    }
    var yo = { cancelar: function () { cancelado = true; try { if (rec && rec.state !== "inactive") rec.stop(); } catch (e) {} cerrar(); } };
    actual = yo;
    bx.onclick = function () { yo.cancelar(); };
    bok.onclick = function () { if (rec && rec.state !== "inactive") { bok.disabled = true; rec.stop(); } };

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (f) {
      if (fin) { f.getTracks().forEach(function (t) { t.stop(); }); return; }
      flujo = f;
      var tipo = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
      rec = new MediaRecorder(f, tipo ? { mimeType: tipo } : undefined);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) partes.push(e.data); };
      rec.onstop = function () {
        var mime = rec.mimeType || tipo || "audio/mp4";
        limpiar();
        if (cancelado) return;
        if (!partes.length || Date.now() - t0 < 600) { mostrar("No se grabó nada."); return; }
        mostrar("Pasando a texto…", true);
        var fr = new FileReader();
        fr.onload = function () {
          Promise.resolve(w.ALMA.dictar({ audio: String(fr.result).split(",")[1], mime: mime })).then(function (r) {
            if (r && r.ok && r.texto) { cerrar(); try { o.onTexto && o.onTexto(r.texto); } catch (e) {} }
            else mostrar((r && r.error) || "No te entendí. ¿Otra vez?");
          }, function () { mostrar("No se pudo. ¿Otra vez?"); });
        };
        fr.readAsDataURL(new Blob(partes, { type: mime }));
      };
      rec.start(250); t0 = Date.now();
      reloj = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000); tm.textContent = Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2); if (s >= 300) bok.click(); }, 250);
      /* La onda: el volumen del micrófono, corriendo de derecha a izquierda como en WhatsApp. */
      try {
        var AC = w.AudioContext || w.webkitAudioContext; ctx = new AC(); an = ctx.createAnalyser(); an.fftSize = 512;
        ctx.createMediaStreamSource(f).connect(an);
        var buf = new Uint8Array(an.fftSize), ult = 0;
        (function paso(ts) {
          if (fin) return; raf = requestAnimationFrame(paso);
          if (ts - ult < 70) return; ult = ts;
          an.getByteTimeDomainData(buf); var s = 0; for (var k = 0; k < buf.length; k++) { var v = (buf[k] - 128) / 128; s += v * v; }
          var nivel = Math.min(1, Math.sqrt(s / buf.length) * 4);
          for (var j = 0; j < barras.length - 1; j++) barras[j].style.height = barras[j + 1].style.height || "4px";
          barras[barras.length - 1].style.height = Math.round(4 + nivel * 22) + "px";
        })(0);
      } catch (e) {}
    }, function () { mostrar("Sin permiso del micrófono; escríbelo."); });
    return yo;
  }
  function aviso(caja, txt) {
    if (getComputedStyle(caja).position === "static") caja.style.position = "relative";
    var ui = d.createElement("div"); ui.className = "sac-rec"; ui.innerHTML = '<span class="msg"></span>'; ui.firstChild.textContent = txt;
    caja.appendChild(ui); setTimeout(function () { if (ui.parentNode) ui.parentNode.removeChild(ui); }, 2600);
  }

  /* ── El «+» ─────────────────────────────────────────────────────────────────────────────────────────────────── */
  var cache = null;   // las plantillas de esta persona (se leen una vez por página y se refrescan al abrir)
  function mas(o) {
    estilos();
    o = o || {};
    var velo = d.createElement("div"); velo.className = "sac-mas-velo";
    var hoja = d.createElement("div"); hoja.className = "sac-mas"; hoja.setAttribute("role", "menu");
    function cerrar() { if (velo.parentNode) velo.parentNode.removeChild(velo); if (hoja.parentNode) hoja.parentNode.removeChild(hoja); d.removeEventListener("keydown", tecla, true); }
    function tecla(e) { if (e.key === "Escape") { e.stopPropagation(); cerrar(); } }
    velo.onclick = cerrar; d.addEventListener("keydown", tecla, true);
    var api = w.ALMA && w.ALMA.plantillas && (!w.ALMA.hasApi || w.ALMA.hasApi());
    var nota = "";
    function item(icono, txt, fn, sub) {
      var b = d.createElement("button"); b.type = "button"; b.className = "it"; b.setAttribute("role", "menuitem");
      b.innerHTML = icono + '<div style="min-width:0;flex:1"><span></span>' + (sub != null ? "<small></small>" : "") + "</div>";
      b.querySelector("span").textContent = txt; if (sub != null) b.querySelector("small").textContent = sub;
      b.onclick = fn; return b;
    }
    function pintar(lista, cargando) {
      hoja.innerHTML = "";
      (o.extras || []).forEach(function (x) { hoja.appendChild(item(x.icono || "", x.txt, function () { cerrar(); x.fn(); })); });
      if ((o.extras || []).length) hoja.appendChild(d.createElement("hr"));
      var h = d.createElement("h4"); h.textContent = "Mis plantillas"; hoja.appendChild(h);
      if (cargando) { var c = d.createElement("p"); c.className = "nota"; c.textContent = "Cargando…"; hoja.appendChild(c); }
      (lista || []).forEach(function (p) {
        var fila = d.createElement("div"); fila.className = "pl";
        fila.appendChild(item(SVG.plantilla, p.nombre, function () { cerrar(); o.poner && o.poner(p.texto); }, p.texto.replace(/\s+/g, " ")));
        var bo = d.createElement("button"); bo.type = "button"; bo.className = "bo"; bo.innerHTML = SVG.borrar; bo.setAttribute("aria-label", "Borrar la plantilla «" + p.nombre + "»");
        bo.onclick = function () { pedir({ que: "borrar", id: p.id }); };
        fila.appendChild(bo); hoja.appendChild(fila);
      });
      if (!cargando && !(lista || []).length) { var v = d.createElement("p"); v.className = "nota"; v.textContent = "Todavía no tienes plantillas. Escribe un mensaje que repites y guárdalo aquí."; hoja.appendChild(v); }
      var t = String((o.texto && o.texto()) || "").trim();
      if (t) { hoja.appendChild(d.createElement("hr")); hoja.appendChild(item(SVG.guardar, "Guardar este texto como plantilla", function () { pedir({ que: "guardar", texto: t }); })); }
      if (nota) { var n = d.createElement("p"); n.className = "nota"; n.textContent = nota; hoja.appendChild(n); }
      colocar();
    }
    function pedir(q) {
      if (!api) { nota = "Conecta el Apps Script para usar plantillas."; pintar(cache || []); return; }
      if (q.que !== "listar") pintar(cache || [], true);
      Promise.resolve(w.ALMA.plantillas(q)).then(function (r) {
        if (r && r.ok) { cache = r.plantillas || []; nota = r.nota || ""; } else nota = (r && r.error) || "No se pudo. Intenta de nuevo.";
        pintar(cache || []);
      }, function () { nota = "No se pudo. Revisa la conexión."; pintar(cache || []); });
    }
    function colocar() {
      var r = o.ancla ? o.ancla.getBoundingClientRect() : { left: 12, top: w.innerHeight - 80, bottom: w.innerHeight - 40 };
      var W = hoja.offsetWidth, H = hoja.offsetHeight;
      hoja.style.left = Math.max(12, Math.min(r.left, w.innerWidth - W - 12)) + "px";
      var arriba = r.top - H - 8;
      hoja.style.top = (arriba >= 12 ? arriba : Math.min(r.bottom + 8, w.innerHeight - H - 12)) + "px";
    }
    d.body.appendChild(velo); d.body.appendChild(hoja);
    pintar(cache || [], !cache);
    pedir({ que: "listar" });
    return { cerrar: cerrar };
  }

  w.SAComp = { dictar: dictar, mas: mas, SVG: SVG };
})(window, document);
