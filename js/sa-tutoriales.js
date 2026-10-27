/* Spacio AM · Tutoriales compartidos (oct 2026)
   ---------------------------------------------------------------------------
   Lo carga solo el menú compartido (js/sa-nav.js) en todas las apps del equipo:
     · El video del botón roca se reproduce solo, en pantalla completa, hasta que la
       persona lo haya visto de verdad (≥ 85 % reproducido). «Ver más tarde» lo cierra
       y vuelve a salir la próxima vez que entre (retoma donde se quedó).
     · Una vez visto no vuelve a salir: queda guardado en el botón «?» flotante del
       costado, que abre el centro de tutoriales. Las apps con centro propio (Epi)
       no muestran este botón y usan SATutoriales.play(id) para el video.

   API
     SATutoriales.primeraVez(app)   → reproduce los tutoriales obligatorios que falten
     SATutoriales.centro({app})     → abre el centro de tutoriales
     SATutoriales.play(id)          → reproduce un tutorial (desde un toque: con sonido)
     SATutoriales.boton(true|false) → muestra u oculta el «?» flotante
     SATutoriales.registrar([...])  → una app agrega sus propios tutoriales al centro
     SATutoriales.progreso(id)      → { visto, max } de la persona en este equipo

   El avance se guarda por persona (correo de la sesión compartida) en una cookie de
   .spacioam.com —vale para todas las apps del mismo teléfono o computadora— y en
   localStorage como respaldo.
   --------------------------------------------------------------------------- */
(function (w, d) {
  "use strict";
  if (w.SATutoriales) return;
  var HUB = "https://hub.spacioam.com";
  var LOCAL = /(^|\.)hub\.spacioam\.com$/.test(location.hostname) || location.hostname === "localhost" || location.protocol === "file:";
  var A = function (p) { return (LOCAL ? "" : HUB + "/") + p; };
  var VISTO_PCT = 0.85;

  /* ── Catálogo ── apps: ["*"] = todas · obligatorio: se reproduce solo hasta que se vea */
  var CATALOGO = [
    {
      id: "boton-roca", tipo: "Primeros pasos", apps: ["*"], obligatorio: true, version: 1,
      titulo: "Cómo usar el botón roca",
      resumen: "Mover la piedra, un toque, doble toque, el abanico de apps y cómo hablar con Alma por voz.",
      video: "assets/tutoriales/boton-roca.mp4", poster: "assets/tutoriales/boton-roca.jpg", duracion: "1:50"
    }
  ];
  var extra = [];
  function lista(app) { return CATALOGO.concat(extra).filter(function (t) { return !t.apps || t.apps.indexOf("*") >= 0 || t.apps.indexOf(app) >= 0; }); }
  function porId(id) { var all = CATALOGO.concat(extra); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }

  /* ── Avance por persona ── { "<correo>|<id>@<v>": { v: 1 visto, m: % máximo alcanzado (0-100) } } */
  var CK = "sa_tut";
  /* Sesión firmada del login (sa_auth): de ahí sale quién es, y el Hub la comprueba antes de guardar. */
  function sesion() {
    var s = null;
    try { var m = d.cookie.match(/(?:^|;\s*)sa_auth=([^;]*)/); if (m && m[1]) s = decodeURIComponent(m[1]); } catch (e) {}
    if (!s) { try { s = localStorage.getItem("sa_auth"); } catch (e) {} }
    return s || null;
  }
  function quien() {
    try {
      var s0 = sesion();
      if (s0 && s0.lastIndexOf(".") > 0) {
        var c = s0.slice(0, s0.lastIndexOf(".")).replace(/-/g, "+").replace(/_/g, "/"); while (c.length % 4) c += "=";
        var dj = JSON.parse(decodeURIComponent(escape(atob(c)))); if (dj && dj.p && dj.p.email) return String(dj.p.email).toLowerCase();
      }
    } catch (e) {}
    try {
      var m = d.cookie.match(/(?:^|; )sa_session=([^;]*)/), tk = m ? decodeURIComponent(m[1]) : (localStorage.getItem("sa_session") || "");
      if (tk) { var s = tk.replace(/-/g, "+").replace(/_/g, "/"); var j = JSON.parse(decodeURIComponent(escape(atob(s)))); if (j && j.email) return String(j.email).toLowerCase(); }
    } catch (e) {}
    return "anon";
  }
  function clave(t) { return quien() + "|" + t.id + "@" + (t.version || 1); }
  function leerTodo() {
    var o = {};
    try { var m = d.cookie.match(/(?:^|; )sa_tut=([^;]*)/); if (m) o = JSON.parse(decodeURIComponent(m[1])) || {}; } catch (e) {}
    try { var l = JSON.parse(localStorage.getItem(CK) || "{}") || {}; for (var k in l) { var a = o[k] || {}, b = l[k]; o[k] = { v: a.v || b.v ? 1 : 0, m: Math.max(a.m || 0, b.m || 0) }; } } catch (e) {}
    return o;
  }
  function guardar(t, m, visto) {
    var o = leerTodo(), k = clave(t), a = o[k] || { v: 0, m: 0 };
    a.m = Math.max(a.m || 0, Math.round(m)); if (visto || a.m >= VISTO_PCT * 100) a.v = 1;
    o[k] = a; var s = JSON.stringify(o);
    var dom = /\.spacioam\.com$/.test(location.hostname) ? "; domain=.spacioam.com" : "";
    try { d.cookie = CK + "=" + encodeURIComponent(s) + "; path=/; max-age=" + 60 * 60 * 24 * 400 + dom + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch (e) {}
    try { localStorage.setItem(CK, s); } catch (e) {}
    return a;
  }
  /* ── Servidor (Apps Script del Hub, hoja TUTORIALES): el avance vale en todos los equipos de la persona ── */
  var API = "https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec";
  function servidor(datos, ms) {
    var s = sesion(); if (!s || !w.fetch) return Promise.resolve(null);
    var cuerpo = JSON.stringify(Object.assign({ tutorial: 1, session: s }, datos));
    var pet = fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: cuerpo, keepalive: cuerpo.length < 60000 })
      .then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j : null; }).catch(function () { return null; });
    if (!ms) return pet;
    return Promise.race([pet, new Promise(function (ok) { setTimeout(function () { ok(null); }, ms); })]);
  }
  /* Trae lo que la persona ya vio en otros equipos y lo junta con lo de este. */
  function sincronizar(ms) {
    return servidor({ accion: "leer" }, ms).then(function (j) {
      if (!j || !j.avance) return;
      var yo = quien();
      CATALOGO.concat(extra).forEach(function (t) { var a = j.avance[t.id + "@" + (t.version || 1)]; if (a) guardar(t, a.m || 0, !!a.v); });
      return yo;
    });
  }
  var enviado = {};
  function avisar(t, pct, evento) {
    var k = t.id + "@" + (t.version || 1), paso = evento === "avance" ? Math.floor(pct / 25) : -1;
    if (evento === "avance") { if (enviado[k] != null && enviado[k] >= paso) return; enviado[k] = paso; }
    servidor({ accion: "guardar", id: t.id, version: t.version || 1, pct: Math.round(pct), evento: evento, app: appActual });
  }
  function progreso(t) { var a = leerTodo()[clave(t)]; return { visto: !!(a && a.v), max: (a && a.m) || 0 }; }
  /* «Ver más tarde» vuelve a salir en la siguiente entrada, no en cada cambio de pantalla de esta misma visita. */
  function yaSalioEstaVisita(t) { try { return sessionStorage.getItem("sa_tut_sesion_" + t.id) === "1"; } catch (e) { return false; } }
  function marcarVisita(t) { try { sessionStorage.setItem("sa_tut_sesion_" + t.id, "1"); } catch (e) {} }

  /* ── Estilos ── */
  var css = [
    ".sat{position:fixed;inset:0;z-index:2147483000;font-family:Montserrat,system-ui,-apple-system,sans-serif;color:#3E3F3F;-webkit-tap-highlight-color:transparent}",
    ".sat *{box-sizing:border-box}",
    ".sat-fade{opacity:0;transition:opacity .45s cubic-bezier(.22,.61,.36,1)}.sat-fade.on{opacity:1}",
    /* reproductor: pantalla completa, el video ocupa todo (su fondo es el mismo alabastro) */
    /* reproductor: pantalla completa, sin fundidos propios (los hace la piedra de Alma, SANav.portal) */
    ".sat-player{background:#FAFAFA}",
    ".sat-player.tapado{opacity:0;pointer-events:none}",
    ".sat-player video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#FAFAFA}",
    "@media (max-aspect-ratio:9/16){.sat-player video{object-fit:cover}}",
    ".sat-tap{position:absolute;inset:0;border:0;background:transparent;padding:0;margin:0;cursor:pointer;touch-action:none}",
    ".sat-later{position:absolute;top:calc(14px + env(safe-area-inset-top));right:14px;display:flex;align-items:center;gap:8px;border:1px solid #EDEAE6;border-radius:999px;padding:11px 16px;min-height:44px;background:#FFFFFF;box-shadow:0 8px 22px -10px rgba(90,70,60,.35);font:600 12.5px/1 Montserrat,system-ui,sans-serif;letter-spacing:.02em;color:#3E3F3F;cursor:pointer}",
    ".sat-later i{width:7px;height:7px;border-radius:50%;background:#E9826A}",
    /* aviso grande al centro: «Toca para escuchar» (sonando en silencio) o «Ver tutorial» (el teléfono no dejó arrancar) */
    ".sat-cta{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;flex-direction:column;align-items:center;gap:14px;border:0;background:transparent;padding:0;cursor:pointer;font-family:Montserrat,system-ui,sans-serif}",
    ".sat-cta.on{display:flex}",
    ".sat-cta b{position:relative;width:92px;height:92px;border-radius:50%;background:#E9826A;display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px -14px rgba(233,130,106,.75)}",
    ".sat-cta b:before{content:'';position:absolute;inset:-10px;border-radius:50%;border:2px solid rgba(233,130,106,.55);animation:satPulso 1.8s cubic-bezier(.22,.61,.36,1) infinite}",
    ".sat-cta svg{width:38px;height:38px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}",
    ".sat-cta span{background:#3E3F3F;color:#fff;border-radius:999px;padding:11px 18px;font-size:13.5px;font-weight:600;letter-spacing:.01em;white-space:nowrap;box-shadow:0 12px 26px -10px rgba(40,30,25,.5)}",
    "@keyframes satPulso{0%{transform:scale(.92);opacity:1}100%{transform:scale(1.35);opacity:0}}",
    ".sat-paused{position:absolute;left:50%;top:50%;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;background:#FFFFFF;box-shadow:0 14px 30px -12px rgba(90,70,60,.45);display:none;pointer-events:none}",
    ".sat-paused:after{content:'';position:absolute;left:31px;top:24px;border-left:20px solid #E9826A;border-top:14px solid transparent;border-bottom:14px solid transparent}",
    ".sat-player.pausa .sat-paused{display:block}",
    ".sat-bar{position:absolute;left:18px;right:18px;bottom:calc(22px + env(safe-area-inset-bottom));height:3px;border-radius:3px;background:rgba(62,63,63,.12);overflow:hidden;pointer-events:none}",
    ".sat-bar i{display:block;height:100%;width:0;background:#E9826A;transition:width .25s linear}",
    /* «?» flotante del costado */
    ".sat-fab{position:fixed;right:0;top:62%;z-index:870;width:40px;height:48px;border:1.5px solid #E9826A;border-right:0;border-radius:24px 0 0 24px;background:#FFFFFF;color:#3E3F3F;display:flex;align-items:center;justify-content:center;padding:0 0 0 3px;cursor:pointer;font:400 23px/1 'Valky','Cormorant Garamond',Georgia,serif;box-shadow:-6px 10px 26px -12px rgba(90,70,60,.35);transform:translateX(0);transition:transform .45s cubic-bezier(.3,1.25,.55,1),opacity .3s}",
    ".sat-fab.fuera{transform:translateX(110%);opacity:0;pointer-events:none}",
    ".sat-fab.llega{animation:satLlega 1.6s cubic-bezier(.3,1.25,.55,1)}",
    "@keyframes satLlega{0%{transform:translateX(110%)}35%{transform:translateX(-6px) scale(1.12)}55%{transform:translateX(0) scale(1)}70%{box-shadow:0 0 0 0 rgba(233,130,106,.55)}100%{box-shadow:0 0 0 14px rgba(233,130,106,0)}}",
    ".sat-toast{position:fixed;right:52px;top:62%;margin-top:4px;z-index:871;background:#3E3F3F;color:#fff;border-radius:14px;padding:10px 13px;font:500 12px/1.4 Montserrat,system-ui,sans-serif;max-width:220px;box-shadow:0 12px 26px -12px rgba(40,30,25,.5);opacity:0;transform:translateX(8px);transition:opacity .35s,transform .35s}",
    ".sat-toast.on{opacity:1;transform:none}",
    /* centro de tutoriales */
    ".sat-hub{background:rgba(62,63,63,.5);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);display:flex;align-items:flex-end;justify-content:center}",
    "@media (min-width:700px){.sat-hub{align-items:center;padding:16px}}",
    ".sat-sheet{width:100%;max-width:480px;max-height:92vh;overflow:auto;background:#FFFFFF;border-radius:28px 28px 0 0;box-shadow:0 -20px 60px rgba(62,63,63,.18);transform:translateY(30px);transition:transform .5s cubic-bezier(.3,1.25,.55,1)}",
    "@media (min-width:700px){.sat-sheet{border-radius:28px}}",
    ".sat-fade.on .sat-sheet{transform:none}",
    ".sat-x{width:40px;height:40px;border-radius:50%;border:0;background:#F5F3F0;color:#938B8A;font-size:17px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}",
    ".sat-kick{font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#938B8A;display:flex;align-items:center;gap:8px}",
    ".sat-kick i{width:7px;height:7px;border-radius:50%;background:#E9826A;flex-shrink:0}",
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
    ".sat-rep-res{display:flex;gap:8px;margin-top:14px}.sat-rep-res div{flex:1;background:#F5F3F0;border-radius:16px;padding:12px 14px}.sat-rep-res b{display:block;font:400 26px/1 'Valky','Cormorant Garamond',Georgia,serif;color:#3E3F3F}.sat-rep-res span{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#938B8A}",
    ".sat-per{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #EDEAE6}.sat-per:last-child{border-bottom:0}",
    ".sat-per .ini{width:36px;height:36px;border-radius:50%;background:#F5F3F0;display:flex;align-items:center;justify-content:center;font:400 15px/1 'Valky','Cormorant Garamond',Georgia,serif;color:#938B8A;flex-shrink:0}",
    ".sat-per .n{font-size:13.5px;font-weight:600;color:#3E3F3F}.sat-per .s{font-size:11.5px;color:#938B8A;margin-top:2px}",
    ".sat-pill{margin-left:auto;flex-shrink:0;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:3px 9px}",
    ".sat-pill.ok{background:#EEF3EC;color:#4F6B47;border:1px solid #B9CDB2}.sat-pill.no{background:#FCEDE8;color:#B4553C;border:1px solid #E9826A}",
    "@media (prefers-reduced-motion:reduce){.sat-fade,.sat-sheet,.sat-fab,.sat-cta b:before{transition:none;animation:none}}"
  ].join("\n");
  function estilos() { if (d.getElementById("sat-css")) return; var s = d.createElement("style"); s.id = "sat-css"; s.textContent = css; (d.head || d.documentElement).appendChild(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function capa(cls, html) {
    estilos(); var el = d.createElement("div"); el.className = "sat sat-fade " + cls; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.innerHTML = html;
    d.body.appendChild(el); requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    return el;
  }
  function quitar(el, cb, ms) { if (!el || !el.parentNode) return; el.classList.remove("on"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); if (cb) cb(); }, ms || 420); }
  function cerrarMenu() { try { if (w.SANav && w.SANav.close) w.SANav.close(); } catch (e) {} }

  /* ── «?» flotante ── */
  var fab = null, fabOn = false;
  function boton(on) {
    fabOn = on !== false; estilos();
    if (!fab) {
      fab = d.createElement("button"); fab.type = "button"; fab.className = "sat-fab fuera"; fab.textContent = "?";
      fab.setAttribute("aria-label", "Tutoriales"); fab.title = "Tutoriales";
      fab.addEventListener("click", function () { centro({ app: appActual }); });
      d.body.appendChild(fab);
    }
    var mostrar = fabOn && !abierto;
    if (mostrar) requestAnimationFrame(function () { fab.classList.remove("fuera"); }); else fab.classList.add("fuera");
  }
  function fabLlega(texto) {
    if (!fab || !fabOn) return;
    fab.classList.remove("fuera"); fab.classList.remove("llega"); void fab.offsetWidth; fab.classList.add("llega");
    if (!texto) return;
    var t = d.createElement("div"); t.className = "sat-toast"; t.textContent = texto; d.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("on"); });
    setTimeout(function () { t.classList.remove("on"); setTimeout(function () { t.remove(); }, 400); }, 4200);
  }

  /* ── Deslizar hacia abajo para cerrar (video y hojas) ──
     zona: donde empieza el gesto · obj: lo que se mueve con el dedo · puede(): si se permite empezar (p. ej. hoja sin scroll)
     Cierra al bajar más de 120 px o con un movimiento rápido; si no, vuelve con rebote. Devuelve true si el último
     gesto fue un arrastre (para no tomarlo como toque). */
  function deslizarAbajo(zona, obj, alCerrar, puede) {
    var y0 = null, x0 = 0, t0 = 0, dy = 0, activo = false, arrastre = false;
    function ini(x, y) { if (puede && !puede()) return; y0 = y; x0 = x; t0 = Date.now(); dy = 0; activo = false; arrastre = false; obj.style.transition = "none"; }
    function mov(x, y, e) {
      if (y0 == null) return;
      var ddy = y - y0, ddx = x - x0;
      if (!activo) { if (Math.abs(ddy) < 8 && Math.abs(ddx) < 8) return; if (ddy <= 0 || Math.abs(ddx) > ddy) { y0 = null; return; } activo = true; arrastre = true; }
      if (e && e.cancelable) e.preventDefault();
      dy = Math.max(0, ddy);
      obj.style.transform = "translateY(" + dy.toFixed(1) + "px) scale(" + (1 - Math.min(dy, 400) / 4000).toFixed(4) + ")";
    }
    function fin() {
      if (y0 == null) return; y0 = null; if (!activo) return;
      var vel = dy / Math.max(1, Date.now() - t0);
      if (dy > 120 || (dy > 40 && vel > .55)) { alCerrar(); return; }
      obj.style.transition = "transform .5s cubic-bezier(.3,1.35,.5,1)"; obj.style.transform = "";
    }
    zona.addEventListener("touchstart", function (e) { var p = e.touches[0]; ini(p.clientX, p.clientY); }, { passive: true });
    zona.addEventListener("touchmove", function (e) { var p = e.touches[0]; mov(p.clientX, p.clientY, e); }, { passive: false });
    zona.addEventListener("touchend", fin); zona.addEventListener("touchcancel", fin);
    zona.addEventListener("mousedown", function (e) { ini(e.clientX, e.clientY); var mm = function (e2) { mov(e2.clientX, e2.clientY, e2); }, mu = function () { d.removeEventListener("mousemove", mm); d.removeEventListener("mouseup", mu); fin(); }; d.addEventListener("mousemove", mm); d.addEventListener("mouseup", mu); });
    return function () { var a = arrastre; arrastre = false; return a; };
  }

  /* ── Reproductor a pantalla completa ──
     Entrada y salida con la piedra de Alma (SANav.portal, la misma transición de cambiar de app): la piedra sale del
     botón y cubre la pantalla, debajo se prepara el video, y Alma vuelve a su lugar destapándolo. Al terminar, igual.
     El video se arranca en el mismo toque (si lo hubo) para que el navegador lo deje sonar. */
  var abierto = null, appActual = "";
  var ICO_SON = '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  var ICO_PLAY = '<svg viewBox="0 0 24 24" style="margin-left:5px"><path d="M7 4.5v15l12-7.5z" fill="#fff" stroke="none"/></svg>';
  /* Dónde queda la piedra dentro del video (abajo al centro, x 540 · y 1600 · Ø 115 en el cuadro de 1080×1920),
     según cómo se ajusta el video a la pantalla. La transición de Alma termina (y empieza al cerrar) justo ahí. */
  function piedraDelVideo() {
    var W = w.innerWidth, H = w.innerHeight, k = W / H <= 9 / 16 ? Math.max(W / 1080, H / 1920) : Math.min(W / 1080, H / 1920);
    return { x: W / 2, y: H / 2 + (1600 - 960) * k, s: 115 * k / 140 };
  }
  function cubrir(o) {
    if (w.SANav && w.SANav.portal && !(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      try { return w.SANav.portal("out", Object.assign({ blanco: true, fondo: "#FAFAFA" }, o || {})).then(function (deshacer) { return deshacer; }, function () { return null; }); } catch (e) {}
    }
    return Promise.resolve(null);
  }
  function play(id, opts) {
    var t = typeof id === "object" ? id : porId(id); if (!t || !t.video || abierto) return false;
    opts = opts || {}; var forzado = !!opts.forzado; cerrarMenu();
    var pr = progreso(t);
    estilos();
    var el = d.createElement("div"); el.className = "sat sat-player tapado"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", t.titulo);
    el.innerHTML = '<video playsinline webkit-playsinline preload="auto" poster="' + esc(A(t.poster || "")) + '" src="' + esc(A(t.video)) + '"></video>' +
      '<button type="button" class="sat-tap" aria-label="Pausar o seguir"></button><div class="sat-paused"></div>' +
      '<button type="button" class="sat-cta" aria-live="polite"><b></b><span></span></button>' +
      '<button type="button" class="sat-later">' + (forzado && !pr.visto ? "<i></i>Ver más tarde" : "Cerrar") + '</button>' +
      '<div class="sat-bar"><i></i></div>';
    d.body.appendChild(el);
    abierto = el; if (fab) fab.classList.add("fuera");
    var v = el.querySelector("video"), bar = el.querySelector(".sat-bar i"), cta = el.querySelector(".sat-cta");
    var inicio = forzado && !pr.visto && pr.max > 12 && pr.max < 95 ? pr.max : 0;
    var maxPct = pr.max || 0, ultimo = 0, listo = false, cerrando = false;
    function ctaMostrar(modo) {
      if (!modo) { cta.classList.remove("on"); return; }
      cta.querySelector("b").innerHTML = modo === "sonido" ? ICO_SON : ICO_PLAY;
      cta.querySelector("span").textContent = modo === "sonido" ? "Toca para escuchar a Alma" : "Ver el tutorial";
      cta.setAttribute("data-modo", modo); cta.classList.add("on");
    }
    function irAlInicio() { if (inicio && v.duration) { try { v.currentTime = Math.max(0, v.duration * inicio / 100 - 3); } catch (e) {} inicio = 0; } }
    v.addEventListener("loadedmetadata", function () { if (listo) irAlInicio(); });
    v.addEventListener("timeupdate", function () {
      if (!v.duration || !listo) return;
      var pct = 100 * v.currentTime / v.duration; bar.style.width = pct.toFixed(1) + "%";
      if (v.currentTime - ultimo < 1.6 && pct > maxPct) { maxPct = pct; if (Math.floor(pct) % 5 === 0) guardar(t, maxPct); if (pct >= 25) avisar(t, pct, "avance"); }
      ultimo = v.currentTime;
    });
    /* Con sonido si el navegador deja; si no, en silencio con «Toca para escuchar»; si ni así, «Ver el tutorial». */
    function sonar() {
      el.classList.remove("pausa");
      v.muted = false; v.removeAttribute("muted");
      var p = v.play();
      if (!p || !p.then) { ctaMostrar(null); return; }
      p.then(function () { ctaMostrar(null); }, function (er) {
        if (er && er.name === "AbortError") return;
        v.muted = true; v.setAttribute("muted", "");
        v.play().then(function () { ctaMostrar("sonido"); }, function () { ctaMostrar("play"); });
      });
    }
    function conSonido() { ctaMostrar(null); el.classList.remove("pausa"); v.muted = false; v.removeAttribute("muted"); var p = v.play(); if (p && p.catch) p.catch(function () { ctaMostrar("play"); }); }
    cta.addEventListener("click", function (e) { e.stopPropagation(); conSonido(); });
    /* Deslizar hacia abajo cierra el video (cuenta como «Ver más tarde» si aún no lo termina). */
    var fueArrastre = deslizarAbajo(el.querySelector(".sat-tap"), el, function () { cerrar(false); });
    el.querySelector(".sat-tap").addEventListener("click", function () {
      if (fueArrastre()) return;
      if (cta.classList.contains("on") || v.muted) { conSonido(); return; }
      if (v.paused) { v.play(); el.classList.remove("pausa"); } else { v.pause(); el.classList.add("pausa"); }
    });
    /* En el mismo toque (o al cargar): desbloquea el video; se pausa mientras Alma cubre la pantalla. */
    var desbloqueo = null;
    try { v.muted = false; desbloqueo = v.play(); if (desbloqueo && desbloqueo.then) desbloqueo.then(function () { if (!listo) v.pause(); }, function () {}); } catch (e) {}
    function destapar(deshacer) {
      if (cerrando) return;
      listo = true; el.classList.remove("tapado");
      try { if (inicio) { if (v.readyState >= 1) irAlInicio(); } else v.currentTime = 0; } catch (e) {}
      sonar();
      if (deshacer) deshacer();
    }
    /* Alma cubre la pantalla; el video se destapa cuando ya puede arrancar (máx. 2,5 s esperando). */
    cubrir({ hacia: piedraDelVideo() }).then(function (deshacer) {
      var hecho = false, go = function () { if (hecho) return; hecho = true; destapar(deshacer); };
      if (v.readyState >= 3) go(); else { v.addEventListener("canplay", go, { once: true }); setTimeout(go, 2500); }
    });
    function cerrar(fin) {
      if (cerrando) return; cerrando = true;
      try { v.pause(); } catch (e) {}
      var a = guardar(t, fin ? 100 : maxPct, fin);
      avisar(t, fin ? 100 : maxPct, fin ? "fin" : (forzado && !a.v ? "mas_tarde" : "cerrar"));
      d.removeEventListener("keydown", tecla);
      var fuera = function (deshacer) {
        if (el.parentNode) el.parentNode.removeChild(el); abierto = null;
        var luego = function () {
          if (fabOn) fabLlega(forzado ? (a.v ? "Aquí queda guardado. Tócalo cuando quieras volver a verlo." : "Lo verás la próxima vez que entres. También está aquí.") : "");
          if (opts.alCerrar) opts.alCerrar(a);
        };
        if (deshacer) { var r = deshacer(); if (r && r.then) r.then(luego); else setTimeout(luego, 900); } else luego();
      };
      if (w.SANav && w.SANav.portal) cubrir({ desde: piedraDelVideo() }).then(fuera);
      else { el.style.transition = "opacity .4s"; el.style.opacity = "0"; setTimeout(function () { fuera(null); }, 420); }
    }
    function tecla(e) { if (e.key === "Escape") cerrar(false); else if (e.key === " ") { e.preventDefault(); el.querySelector(".sat-tap").click(); } }
    d.addEventListener("keydown", tecla);
    v.addEventListener("ended", function () { cerrar(true); });
    el.querySelector(".sat-later").addEventListener("click", function (e) { e.stopPropagation(); cerrar(false); });
    return true;
  }

  /* ── Obligatorios: se reproducen solos hasta que se vean ── */
  var yaPreguntado = false;
  function primeraVez(app) {
    appActual = app || appActual;
    if (yaPreguntado) return; yaPreguntado = true;
    /* Primero pregunta al Hub (máx. 4 s): si ya lo vio en otro equipo, no sale. Sin red, decide lo de este equipo. */
    sincronizar(4000).then(function () { arrancarCola(); }, function () { arrancarCola(); });
  }
  function arrancarCola() {
    var cola = lista(appActual).filter(function (t) { return t.obligatorio && t.video && !progreso(t).visto && !yaSalioEstaVisita(t); });
    (function sig() { var t = cola.shift(); if (!t) return; marcarVisita(t); play(t, { forzado: true, alCerrar: sig }); })();
  }

  /* ── Centro de tutoriales ── */
  function centro(o) {
    o = o || {}; var app = o.app || appActual; cerrarMenu();
    var ts = lista(app), orden = [], grupos = {};
    ts.forEach(function (t) { var g = t.tipo || "Tutoriales"; if (!grupos[g]) { grupos[g] = []; orden.push(g); } grupos[g].push(t); });
    var html = '<div class="sat-sheet"><div class="sat-hero"><div class="sat-stone"></div><button type="button" class="sat-x" aria-label="Cerrar">✕</button></div><div class="sat-body">' +
      '<div class="sat-kick"><i></i><span>Centro de tutoriales</span></div><div class="sat-h1">¿Cómo se hace?</div>' +
      '<p class="sat-sub">Videos cortos para moverte por las apps de Spacio AM.</p>';
    orden.forEach(function (g) {
      html += '<div class="sat-grp"><h3>' + esc(g) + "</h3>";
      grupos[g].forEach(function (t) {
        var p = progreso(t);
        html += '<button type="button" class="sat-item" data-id="' + esc(t.id) + '"><span class="sat-thumb" style="background-image:url(\'' + esc(A(t.poster || "")) + '\')"></span>' +
          '<span style="min-width:0"><span class="sat-it-t">' + esc(t.titulo) + '</span><span class="sat-it-r">' + esc(t.resumen || "") + "</span>" +
          (p.visto ? '<span class="sat-it-r" style="margin-top:6px">Visto · ' + esc(t.duracion || "") + "</span>" : '<span class="sat-it-m">' + (p.max > 3 ? "Vas en " + p.max + " %" : "Nuevo") + " · " + esc(t.duracion || "") + "</span>") + "</span></button>";
      });
      html += "</div>";
    });
    html += '<div class="sat-pronto">Pronto llegarán aquí los tutoriales propios de esta app.</div></div></div>';
    var el = capa("sat-hub", html);
    var hoja = el.querySelector(".sat-sheet"); deslizarAbajo(hoja, hoja, function () { cerrar(); }, function () { return hoja.scrollTop <= 0; });
    function cerrar(cb) { d.removeEventListener("keydown", tecla); quitar(el, cb); }
    function tecla(e) { if (e.key === "Escape") cerrar(); }
    d.addEventListener("keydown", tecla);
    el.addEventListener("click", function (e) { if (e.target === el) cerrar(); });
    el.querySelector(".sat-x").addEventListener("click", function () { cerrar(); });
    Array.prototype.forEach.call(el.querySelectorAll(".sat-item"), function (b) {
      /* Desde un toque el navegador sí deja sonar: se reproduce en el mismo gesto. */
      b.addEventListener("click", function () { var id = b.getAttribute("data-id"); quitar(el); d.removeEventListener("keydown", tecla); play(id); });
    });
    return true;
  }

  /* ── Hub · administradores: quién vio cada tutorial (hoja TUTORIALES del Apps Script del Hub) ── */
  function reporte() {
    cerrarMenu();
    var el = capa("sat-hub", '<div class="sat-sheet"><div class="sat-hero"><div class="sat-stone"></div><button type="button" class="sat-x" aria-label="Cerrar">✕</button></div>' +
      '<div class="sat-body"><div class="sat-kick"><i></i><span>Tutoriales · equipo</span></div><div class="sat-h1">¿Quién ya los vio?</div>' +
      '<p class="sat-sub">Cuenta como visto al llegar al 85 % del video. Solo aparece quien ya lo abrió al menos una vez.</p><div class="sat-rep"><p class="sat-sub" style="margin-top:18px">Cargando…</p></div></div></div>');
    function cerrar() { quitar(el); d.removeEventListener("keydown", tecla); }
    function tecla(e) { if (e.key === "Escape") cerrar(); }
    d.addEventListener("keydown", tecla);
    el.addEventListener("click", function (e) { if (e.target === el) cerrar(); });
    el.querySelector(".sat-x").addEventListener("click", cerrar);
    var hoja = el.querySelector(".sat-sheet"); deslizarAbajo(hoja, hoja, cerrar, function () { return hoja.scrollTop <= 0; });
    var caja = el.querySelector(".sat-rep"), s = sesion();
    fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ hub: 1, action: "tutoriales", session: s }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || "sin respuesta");
        var fecha = function (x) { var t = new Date(x); return isNaN(t) ? "" : t.toLocaleDateString("es-GT", { day: "numeric", month: "short" }); };
        var html = "";
        CATALOGO.concat(extra).forEach(function (t) {
          var fs = j.filas.filter(function (f) { return f.tutorial === t.id && f.version === (t.version || 1); })
            .sort(function (a, b) { return (a.visto - b.visto) || String(a.nombre || a.email).localeCompare(String(b.nombre || b.email)); });
          var vistos = fs.filter(function (f) { return f.visto; }).length;
          html += '<div class="sat-grp"><h3>' + esc(t.titulo) + '</h3><div class="sat-rep-res"><div><b>' + vistos + '</b><span>Lo vieron</span></div><div><b>' + (fs.length - vistos) + '</b><span>Pendientes</span></div></div>';
          fs.forEach(function (f) {
            var nom = f.nombre || f.email, ini = String(nom).trim().charAt(0).toUpperCase();
            var sub = f.visto ? "Visto el " + fecha(f.vistoEl) + (f.app ? " · " + f.app : "") : "Va en " + f.pct + " %" + (f.masTarde ? " · «más tarde» " + f.masTarde + (f.masTarde === 1 ? " vez" : " veces") : "") + " · " + fecha(f.ultima);
            html += '<div class="sat-per"><span class="ini">' + esc(ini) + '</span><span style="min-width:0"><div class="n">' + esc(nom) + (f.rol ? ' <span style="font-weight:500;color:#938B8A">· ' + esc(f.rol) + "</span>" : "") + '</div><div class="s">' + esc(sub) + '</div></span><span class="sat-pill ' + (f.visto ? "ok" : "no") + '">' + (f.visto ? "Visto" : "Pendiente") + "</span></div>";
          });
          if (!fs.length) html += '<p class="sat-sub" style="margin-top:12px">Nadie lo ha abierto todavía.</p>';
          html += "</div>";
        });
        caja.innerHTML = html;
      }).catch(function (e) { caja.innerHTML = '<p class="sat-sub" style="margin-top:18px">No pude leer el registro (' + esc(e.message) + ').</p>'; });
    return true;
  }

  w.SATutoriales = {
    reporte: reporte,
    primeraVez: primeraVez, centro: centro, play: function (id) { return play(id); }, lista: lista, boton: function (on, app) { if (app) appActual = app; boton(on); },
    registrar: function (arr) { (arr || []).forEach(function (t) { if (t && t.id && !porId(t.id)) extra.push(t); }); },
    progreso: function (id) { var t = porId(id); return t ? progreso(t) : null; }
  };
  try { w.dispatchEvent(new Event("satutoriales")); } catch (e) {}
})(window, document);
