/* Spacio AM · Tutoriales compartidos (oct 2026)
   ---------------------------------------------------------------------------
   Lo carga solo el menú compartido (js/sa-nav.js) en todas las apps del equipo:
     · La primera vez, el video del botón roca sale en pantalla completa.
     · «Tutoriales» del menú abre el centro de tutoriales (las apps que ya tienen
       el suyo, como Epi, abren el propio y usan SATutoriales.play(id) para el video).

   API
     SATutoriales.primeraVez(app)   → muestra los tutoriales obligatorios aún no vistos
     SATutoriales.centro({app})     → abre el centro de tutoriales
     SATutoriales.play(id)          → abre un tutorial de video en pantalla completa
     SATutoriales.registrar([...])  → una app agrega sus propios tutoriales al centro
     SATutoriales.lista(app)        → los tutoriales que ve esa app

   «Visto» se guarda en una cookie de .spacioam.com (vale para todas las apps del
   mismo teléfono o computadora) y en localStorage como respaldo.
   --------------------------------------------------------------------------- */
(function (w, d) {
  "use strict";
  if (w.SATutoriales) return;
  var HUB = "https://hub.spacioam.com";
  var BASE = /(^|\.)hub\.spacioam\.com$/.test(location.hostname) || location.hostname === "localhost" || location.protocol === "file:" ? "" : HUB + "/";
  var A = function (p) { return (BASE ? BASE : "") + p; };

  /* ── Catálogo ── apps: ["*"] = todas · obligatorio: sale solo la primera vez */
  var CATALOGO = [
    {
      id: "boton-roca", tipo: "Primeros pasos", apps: ["*"], obligatorio: true, version: 1,
      titulo: "Cómo usar el botón roca",
      resumen: "Mover la piedra, un toque, doble toque, el abanico de apps y cómo hablar con Alma por voz.",
      video: "assets/tutoriales/boton-roca.mp4", poster: "assets/tutoriales/boton-roca.jpg", duracion: "1:50",
      pasos: ["Mantén la piedra y arrástrala a cualquiera de los ocho puntos.", "Un toque abre las pantallas de la app; doble toque, el abanico de apps.",
              "Desliza la piedra hacia el centro para hablar con Alma.", "Triple toque: Alma sin salir de la pantalla."]
    }
  ];
  var extra = [];

  /* ── Vistos ── */
  var CK = "sa_tut_vistos";
  function leerVistos() {
    var v = {};
    try { var m = d.cookie.match(/(?:^|; )sa_tut_vistos=([^;]*)/); if (m) decodeURIComponent(m[1]).split(",").forEach(function (x) { if (x) v[x] = 1; }); } catch (e) {}
    try { (localStorage.getItem(CK) || "").split(",").forEach(function (x) { if (x) v[x] = 1; }); } catch (e) {}
    return v;
  }
  function marcarVisto(t) {
    var v = leerVistos(); v[t.id + "@" + (t.version || 1)] = 1;
    var s = Object.keys(v).join(",");
    var dom = /\.spacioam\.com$/.test(location.hostname) ? "; domain=.spacioam.com" : "";
    try { d.cookie = CK + "=" + encodeURIComponent(s) + "; path=/; max-age=" + 60 * 60 * 24 * 400 + dom + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch (e) {}
    try { localStorage.setItem(CK, s); } catch (e) {}
  }
  function visto(t) { return !!leerVistos()[t.id + "@" + (t.version || 1)]; }
  /* «Ahora no»: vuelve a salir al día siguiente */
  function pospuesto(t) { try { var x = +localStorage.getItem("sa_tut_luego_" + t.id) || 0; return Date.now() - x < 20 * 3600 * 1000; } catch (e) { return false; } }
  function posponer(t) { try { localStorage.setItem("sa_tut_luego_" + t.id, String(Date.now())); } catch (e) {} }

  function lista(app) {
    return CATALOGO.concat(extra).filter(function (t) { return !t.apps || t.apps.indexOf("*") >= 0 || t.apps.indexOf(app) >= 0; });
  }
  function porId(id) { var all = CATALOGO.concat(extra); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }

  /* ── Estilos ── */
  var css = [
    ".sat{position:fixed;inset:0;z-index:2147483000;font-family:Montserrat,system-ui,-apple-system,sans-serif;color:#3E3F3F;-webkit-tap-highlight-color:transparent}",
    ".sat *{box-sizing:border-box}",
    ".sat-fade{opacity:0;transition:opacity .45s cubic-bezier(.22,.61,.36,1)}.sat-fade.on{opacity:1}",
    /* reproductor a pantalla completa */
    ".sat-player{background:#FAFAFA;display:flex;flex-direction:column}",
    ".sat-top{display:flex;align-items:center;gap:12px;padding:calc(14px + env(safe-area-inset-top)) 18px 10px}",
    ".sat-kick{font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#938B8A;display:flex;align-items:center;gap:8px;flex:1;min-width:0}",
    ".sat-kick i{width:7px;height:7px;border-radius:50%;background:#E9826A;flex-shrink:0}",
    ".sat-x{width:40px;height:40px;border-radius:50%;border:0;background:#F5F3F0;color:#938B8A;font-size:17px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}",
    ".sat-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:4px 16px;position:relative}",
    ".sat-frame{position:relative;height:100%;max-height:100%;aspect-ratio:9/16;max-width:100%;border-radius:26px;overflow:hidden;background:#F5F3F0;box-shadow:0 30px 60px -24px rgba(90,70,60,.35),0 2px 6px rgba(90,70,60,.08)}",
    ".sat-frame video{width:100%;height:100%;object-fit:cover;display:block;background:#F5F3F0}",
    ".sat-play{position:absolute;inset:0;border:0;padding:0;margin:0;background:linear-gradient(180deg,rgba(250,250,250,0) 55%,rgba(62,63,63,.28));cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding-bottom:12%}",
    ".sat-play span{display:flex;align-items:center;gap:12px;background:#FFFFFF;color:#3E3F3F;border-radius:999px;padding:14px 24px 14px 16px;font:600 14px/1 Montserrat,system-ui,sans-serif;letter-spacing:.02em;box-shadow:0 14px 30px -10px rgba(90,70,60,.45)}",
    ".sat-play b{width:34px;height:34px;border-radius:50%;background:#E9826A;display:flex;align-items:center;justify-content:center}",
    ".sat-play b:after{content:'';border-left:11px solid #fff;border-top:7px solid transparent;border-bottom:7px solid transparent;margin-left:3px}",
    ".sat-bottom{padding:12px 18px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:10px}",
    ".sat-tit{font-family:'Valky','Cormorant Garamond',Georgia,serif;font-size:24px;line-height:1.15;text-align:center;color:#3E3F3F}",
    ".sat-acc{display:flex;gap:10px;width:100%;max-width:420px}",
    ".sat-btn{flex:1;min-height:48px;border-radius:999px;font:600 13px/1 Montserrat,system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;border:1.5px solid #D8D4CE;background:#FFFFFF;color:#938B8A}",
    ".sat-btn.pri{border:0;background:#3E3F3F;color:#FFFFFF}",
    ".sat-bar{width:100%;max-width:420px;height:3px;border-radius:3px;background:#EDEAE6;overflow:hidden}.sat-bar i{display:block;height:100%;width:0;background:#E9826A;transition:width .25s linear}",
    /* centro de tutoriales */
    ".sat-hub{background:rgba(62,63,63,.5);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);display:flex;align-items:flex-end;justify-content:center}",
    "@media (min-width:700px){.sat-hub{align-items:center;padding:16px}}",
    ".sat-sheet{width:100%;max-width:480px;max-height:92vh;overflow:auto;background:#FFFFFF;border-radius:28px 28px 0 0;box-shadow:0 -20px 60px rgba(62,63,63,.18);transform:translateY(30px);transition:transform .5s cubic-bezier(.3,1.25,.55,1)}",
    "@media (min-width:700px){.sat-sheet{border-radius:28px}}",
    ".sat-fade.on .sat-sheet{transform:none}",
    ".sat-hero{position:relative;height:128px;background:#F5F3F0;overflow:hidden}",
    ".sat-hero:before{content:'';position:absolute;width:300px;height:300px;border-radius:50%;right:-70px;top:-150px;background:#FAFAFA}",
    ".sat-hero:after{content:'';position:absolute;width:190px;height:190px;border-radius:50%;left:-60px;bottom:-120px;background:#EDE9E4}",
    ".sat-hero .sat-stone{position:absolute;left:50%;top:50%;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:50%;z-index:1;background:radial-gradient(circle at 40% 34%,#F7F5F2 0%,#EFECE8 42%,#E3DFDA 78%,#D3CEC8 100%);box-shadow:0 0 0 2px rgba(233,130,106,.35),0 0 26px 6px rgba(233,130,106,.45),0 10px 18px -6px rgba(90,70,60,.35)}",
    ".sat-hero .sat-x{position:absolute;top:12px;right:12px;z-index:2;background:rgba(255,255,255,.85)}",
    ".sat-body{padding:18px 22px 26px}",
    ".sat-h1{font-family:'Valky','Cormorant Garamond',Georgia,serif;font-size:26px;line-height:1.15;margin:6px 0 2px;color:#3E3F3F}",
    ".sat-sub{font-size:12.5px;line-height:1.6;color:#938B8A;margin:0}",
    ".sat-grp{margin-top:20px}",
    ".sat-grp h3{font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#938B8A;margin:0 0 9px}",
    ".sat-item{width:100%;display:flex;gap:13px;align-items:center;text-align:left;background:#F5F3F0;border:1px solid #EDEAE6;border-radius:16px;padding:10px 12px 10px 10px;cursor:pointer;font-family:inherit;color:inherit;margin-bottom:8px}",
    ".sat-thumb{position:relative;flex-shrink:0;width:58px;height:78px;border-radius:12px;overflow:hidden;background:#EDE9E4 center/cover no-repeat}",
    ".sat-thumb:after{content:'';position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(233,130,106,.92)}",
    ".sat-thumb:before{content:'';position:absolute;z-index:1;left:50%;top:50%;margin:-6px 0 0 -3px;border-left:9px solid #fff;border-top:6px solid transparent;border-bottom:6px solid transparent}",
    ".sat-it-t{display:block;font-size:14px;font-weight:600;color:#3E3F3F;line-height:1.3}",
    ".sat-it-r{display:block;font-size:11.5px;color:#938B8A;line-height:1.45;margin-top:3px}",
    ".sat-it-m{display:inline-block;margin-top:6px;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#B4553C;background:#FCEDE8;border:1px solid #E9826A;border-radius:999px;padding:2px 8px}",
    ".sat-pronto{margin-top:18px;padding:13px 14px;border-radius:14px;border:1px dashed #D8D4CE;font-size:12px;line-height:1.55;color:#938B8A}",
    "@media (prefers-reduced-motion:reduce){.sat-fade,.sat-sheet{transition:none}}"
  ].join("\n");
  function estilos() { if (d.getElementById("sat-css")) return; var s = d.createElement("style"); s.id = "sat-css"; s.textContent = css; (d.head || d.documentElement).appendChild(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function capa(cls, html) {
    estilos(); var el = d.createElement("div"); el.className = "sat sat-fade " + cls; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.innerHTML = html;
    d.body.appendChild(el); requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    return el;
  }
  function quitar(el, cb) { if (!el || !el.parentNode) return; el.classList.remove("on"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); if (cb) cb(); }, 420); }
  function menu(cerrar) { try { if (w.SANav && w.SANav.close) w.SANav.close(); } catch (e) {} }

  /* ── Reproductor a pantalla completa ── */
  var abierto = null;
  function play(id, opts) {
    var t = typeof id === "object" ? id : porId(id); if (!t || !t.video || abierto) return false;
    opts = opts || {}; var forzado = !!opts.forzado; menu();
    var el = capa("sat-player",
      '<div class="sat-top"><div class="sat-kick"><i></i><span>' + (forzado ? "Bienvenida · " : "Tutorial · ") + esc(t.duracion || "") + '</span></div>' +
      '<button type="button" class="sat-x" aria-label="Cerrar">✕</button></div>' +
      '<div class="sat-stage"><div class="sat-frame"><video playsinline preload="metadata" poster="' + esc(A(t.poster || "")) + '" src="' + esc(A(t.video)) + '"></video>' +
      '<button type="button" class="sat-play" aria-label="Reproducir el tutorial"><span><b></b>Ver tutorial</span></button></div></div>' +
      '<div class="sat-bottom"><div class="sat-tit">' + esc(t.titulo) + '</div><div class="sat-bar"><i></i></div>' +
      '<div class="sat-acc">' + (forzado ? '<button type="button" class="sat-btn" data-a="luego">Ahora no</button>' : "") +
      '<button type="button" class="sat-btn pri" data-a="listo">' + (forzado ? "Ya lo vi" : "Listo") + '</button></div></div>');
    abierto = el;
    var v = el.querySelector("video"), pb = el.querySelector(".sat-play"), bar = el.querySelector(".sat-bar i"), pri = el.querySelector('[data-a="listo"]');
    function cerrar(marcar) {
      try { v.pause(); } catch (e) {}
      if (marcar) marcarVisto(t); d.removeEventListener("keydown", tecla);
      quitar(el, function () { abierto = null; if (opts.alCerrar) opts.alCerrar(); });
    }
    function tecla(e) { if (e.key === "Escape") cerrar(!forzado || v.currentTime > 5); }
    d.addEventListener("keydown", tecla);
    pb.addEventListener("click", function () { var p = v.play(); pb.style.display = "none"; v.controls = true; if (p && p.catch) p.catch(function () { pb.style.display = ""; v.controls = false; }); });
    v.addEventListener("timeupdate", function () { if (v.duration) { bar.style.width = (100 * v.currentTime / v.duration).toFixed(1) + "%"; if (v.currentTime / v.duration > .85) marcarVisto(t); } });
    v.addEventListener("ended", function () { marcarVisto(t); pri.textContent = "Listo"; try { if (d.fullscreenElement) d.exitFullscreen(); } catch (e) {} });
    el.querySelector(".sat-x").addEventListener("click", function () { if (forzado && v.currentTime < 5) { posponer(t); cerrar(false); } else cerrar(true); });
    pri.addEventListener("click", function () { cerrar(true); });
    var lu = el.querySelector('[data-a="luego"]'); if (lu) lu.addEventListener("click", function () { posponer(t); cerrar(false); });
    return true;
  }

  /* ── Primera vez: los obligatorios que falten, uno tras otro ── */
  var yaPreguntado = false;
  function primeraVez(app) {
    if (yaPreguntado) return; yaPreguntado = true;
    var cola = lista(app || "").filter(function (t) { return t.obligatorio && t.video && !visto(t) && !pospuesto(t); });
    (function sig() { var t = cola.shift(); if (t) play(t, { forzado: true, alCerrar: sig }); })();
  }

  /* ── Centro de tutoriales ── */
  function centro(o) {
    o = o || {}; var app = o.app || ""; menu();
    var ts = lista(app), orden = [], grupos = {};
    ts.forEach(function (t) { var g = t.tipo || "Tutoriales"; if (!grupos[g]) { grupos[g] = []; orden.push(g); } grupos[g].push(t); });
    var html = '<div class="sat-sheet"><div class="sat-hero"><div class="sat-stone"></div><button type="button" class="sat-x" aria-label="Cerrar">✕</button></div><div class="sat-body">' +
      '<div class="sat-kick"><i></i><span>Centro de tutoriales</span></div><div class="sat-h1">¿Cómo se hace?</div>' +
      '<p class="sat-sub">Videos cortos para moverte por las apps de Spacio AM.</p>';
    orden.forEach(function (g) {
      html += '<div class="sat-grp"><h3>' + esc(g) + "</h3>";
      grupos[g].forEach(function (t) {
        html += '<button type="button" class="sat-item" data-id="' + esc(t.id) + '"><span class="sat-thumb" style="background-image:url(\'' + esc(A(t.poster || "")) + '\')"></span>' +
          '<span style="min-width:0"><span class="sat-it-t">' + esc(t.titulo) + '</span><span class="sat-it-r">' + esc(t.resumen || "") + "</span>" +
          (visto(t) ? '<span class="sat-it-r" style="margin-top:6px">Visto · ' + esc(t.duracion || "") + "</span>" : '<span class="sat-it-m">Nuevo · ' + esc(t.duracion || "") + "</span>") + "</span></button>";
      });
      html += "</div>";
    });
    html += '<div class="sat-pronto">Pronto llegarán aquí los tutoriales propios de esta app.</div></div></div>';
    var el = capa("sat-hub", html);
    function cerrar(cb) { d.removeEventListener("keydown", tecla); quitar(el, cb); }
    function tecla(e) { if (e.key === "Escape") cerrar(); }
    d.addEventListener("keydown", tecla);
    el.addEventListener("click", function (e) { if (e.target === el) cerrar(); });
    el.querySelector(".sat-x").addEventListener("click", function () { cerrar(); });
    Array.prototype.forEach.call(el.querySelectorAll(".sat-item"), function (b) {
      b.addEventListener("click", function () { var id = b.getAttribute("data-id"); cerrar(function () { play(id, { alCerrar: function () { centro(o); } }); }); });
    });
    return true;
  }

  w.SATutoriales = {
    primeraVez: primeraVez, centro: centro, play: function (id) { return play(id); }, lista: lista,
    registrar: function (arr) { (arr || []).forEach(function (t) { if (t && t.id && !porId(t.id)) extra.push(t); }); },
    visto: function (id) { var t = porId(id); return !!(t && visto(t)); }
  };
  try { w.dispatchEvent(new Event("satutoriales")); } catch (e) {}
})(window, document);
