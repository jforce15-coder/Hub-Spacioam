/* Spacio AM · Menú de navegación compartido (oct 2026)
   ---------------------------------------------------------------------------
   UN solo archivo para todas las apps del equipo. Se carga desde el Hub:
       <script src="https://hub.spacioam.com/js/sa-nav.js"></script>
   y cada app lo monta con sus propias pantallas:

     SANav.mount({
       app: "epi",                                   // hub | hola | epi | grow | mi | docs
       home: { k: "dash", l: "Dashboard" },          // pantalla principal de la app (botón central)
       items: [ { k: "form", l: "Formulario", icon: "edit", badge: 0 }, … ],   // 4 caben; más → «Más»
       current: "dash",                              // pantalla actual
       onNavigate: function (k) { … },               // la app cambia de pantalla
       apps: ["hub","epi"] | null,                   // apps permitidas; null = las lee de la sesión
       appBadges: { hola: 2 }                        // opcional; si no, lee las cookies sa_noti_<app>
     });
     SANav.update({ current: "sched", items: [...] });   // al cambiar de pantalla o de contadores
     SANav.hide(true|false);  SANav.unmount();

   Estados: 1 círculo · 2 barra con las pantallas · 3 abanico de apps · 4 barra + abanico.
   1 toque abre/va al inicio · 2 toques abre las apps · mantener lo mueve a 8 posiciones.
   Tutoriales (js/sa-tutoriales.js): el video del botón roca se reproduce solo, en pantalla completa, hasta que
   se ve; después queda en el «?» flotante del costado. cfg.tutoriales: función (centro propio, sin «?») o false.
   La posición se comparte entre apps (cookie .spacioam.com). Los huéspedes no lo ven:
   solo lo montan las pantallas del equipo.
   --------------------------------------------------------------------------- */
(function (w, d) {
  "use strict";
  if (w.SANav) return;
  /* Llegada desde otra app con Alma (#sa_portal=<posición>): la pantalla se cubre ya con el color de la página
     (el mismo blanco de carga) y se quita el parámetro de la URL; el resto lo hace llegada() al montar el menú. */
  var LLEGADA = null;
  try {
    var mh = location.hash.match(/(^#|&)sa_portal=([a-z]{2})(?=&|$)/);
    if (mh) {
      LLEGADA = { a: mh[2] };
      var nh = location.hash.replace(/(^#|&)sa_portal=[a-z]{2}(?=&|$)/, "$1").replace(/^#&/, "#").replace(/&&/, "&").replace(/&$/, "");
      try { history.replaceState(history.state, "", location.pathname + location.search + (nh === "#" ? "" : nh)); } catch (e) {}
      var cs0 = d.createElement("style"); cs0.textContent = 'html.san-llegando::after{content:"";position:fixed;inset:0;z-index:2147483500;background:#FAFAFA;transition:opacity .4s ease}html.san-llegando.san-fin::after{opacity:0}';
      (d.head || d.documentElement).appendChild(cs0); d.documentElement.classList.add("san-llegando");
      setTimeout(function () { var h = d.documentElement; if (h.classList.contains("san-llegando")) { h.classList.add("san-fin"); setTimeout(function () { h.classList.remove("san-llegando", "san-fin"); }, 420); } }, 4000);   // si el menú no llega a montarse
    }
  } catch (e) {}

  var HUB = "https://hub.spacioam.com";
  var APPS = [
    { k: "hub", n: "Hub", desc: "Centro", url: "https://hub.spacioam.com" },
    { k: "hola", n: "Hola", desc: "Huéspedes", url: "https://hola.spacioam.com" },
    { k: "epi", n: "Epi", desc: "Operación", url: "https://epi.spacioam.com" },
    { k: "grow", n: "Grow", desc: "Proyectos", url: "https://grow.spacioam.com" },
    { k: "mi", n: "Mi", desc: "Finanzas", url: "https://mi.spacioam.com" },
    { k: "docs", n: "Docs", desc: "Contratos", url: "https://docs.spacioam.com" }
  ];
  var P = {
    edit: '<path d="M14 4h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M17.5 3.5l3 3L12 15l-4 1 1-4z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
    coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.6"/><path d="M3.5 7v4c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V7"/><path d="M9.5 16.2c.9 1.3 3 2.2 5.5 2.2 3 0 5.5-1.2 5.5-2.6v-4c0-1.2-1.8-2.2-4.3-2.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4A8 8 0 1 1 20 12z"/>',
    check: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.4 2.4 4.8-5"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3"/>',
    home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z"/>',
    dash: '<rect x="3.5" y="3.5" width="7" height="9" rx="2"/><rect x="13.5" y="3.5" width="7" height="5" rx="2"/><rect x="3.5" y="15.5" width="7" height="5" rx="2"/><rect x="13.5" y="11.5" width="7" height="9" rx="2"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6"/><circle cx="12" cy="16.9" r=".7"/>',
    more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    review: '<path d="M4 5.5h16v10H9l-5 4z"/><path d="M12 8l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
    door: '<path d="M6 20.5V4.5l9-1.5v18"/><path d="M15 4.5h3.5v16H4"/><circle cx="12" cy="12.5" r=".8"/>',
    task: '<path d="M9 5h10M9 12h10M9 19h10"/><path d="M3.8 5.2l1.3 1.3 2.2-2.4M3.8 12.2l1.3 1.3 2.2-2.4M3.8 19.2l1.3 1.3 2.2-2.4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    doc: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16.5 6.5l2.5 2.5"/>',
    users: '<circle cx="9" cy="8.5" r="3.4"/><path d="M2.8 19.5c1-3.2 3.4-4.8 6.2-4.8s5.2 1.6 6.2 4.8"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6.1M17.6 14.9c1.8.6 3.1 2.1 3.6 4.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>'
  };
  var SPARK = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2.5c.4 4.6 1.6 6.2 7 7.5-5.4 1.3-6.6 2.9-7 9.5-.4-6.6-1.6-8.2-7-9.5 5.4-1.3 6.6-2.9 7-7.5z"/></svg>';
  function svg(p, sz) { return '<svg viewBox="0 0 24 24" width="' + (sz || 19) + '" height="' + (sz || 19) + '" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function icon(i) { return i && i.indexOf("<") >= 0 ? i : svg(P[i] || P.grid); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ================= estilos (todo bajo #sa-nav-root, prefijo san-) ================= */
  var GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .38 0 0 0 0 .34 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";
  var MAPA = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.018' numOctaves='3' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .22 -.07'/%3E%3C/filter%3E%3Crect width='150' height='150' filter='url(%23m)'/%3E%3C/svg%3E\")";
  var STONE = MAPA + "," + GRAIN;
  /* Luz desde adentro (como alabastro iluminado): núcleo cálido claro y el tono del halo; se ve igual en grande y en pequeño. */
  var LUZ = "radial-gradient(closest-side,rgba(255,248,236,.95) 0%,rgba(255,246,232,.6) 36%,rgba(255,244,228,0) 80%),linear-gradient(100deg,var(--san-t4,#F2A07E) 0%,var(--san-t5,#F6B696) 50%,var(--san-t6,#FAD0B6) 100%)";
  var LUZ_MASK = "radial-gradient(closest-side,#000 0%,#000 55%,rgba(0,0,0,.78) 100%)";
  /* Color del halo y del brillo interno. Por defecto el del Hub; una app puede teñirlo con SANav.update({ tint: "#4B6A94" })
     (null vuelve al del Hub). Se aplica con variables CSS en <html> y cambia con un fundido suave. */
  var GRAD = "linear-gradient(100deg,var(--san-t1,#E64E37) 0%,var(--san-t2,#EE7552) 45%,var(--san-t3,#F59D68) 100%)";
  var TINT0 = ["#E64E37", "#EE7552", "#F59D68", "#F2A07E", "#F6B696", "#FAD0B6"];
  var tintNow = TINT0.map(hexRgb), tintRaf = 0, tintKey = "";
  function hexRgb(h) { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); var n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? [233, 130, 106] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mixRgb(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * t; }); }
  function rgbCss(c) { return "rgb(" + c.map(Math.round).join(",") + ")"; }
  function tintStops(hex) {
    if (!hex) return TINT0.map(hexRgb);
    var b = hexRgb(hex), K0 = [0, 0, 0], W = [255, 255, 255];
    return [mixRgb(b, K0, .12), b, mixRgb(b, W, .28), mixRgb(b, W, .36), mixRgb(b, W, .5), mixRgb(b, W, .64)];
  }
  function setTint(hex) {
    var k = String(hex || ""); if (k === tintKey) return; tintKey = k;
    var from = tintNow.map(function (c) { return c.slice(); }), to = tintStops(hex), t0 = 0, el = d.documentElement;
    cancelAnimationFrame(tintRaf);
    (function step(t) {
      if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 700), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      tintNow = from.map(function (c, i) { return mixRgb(c, to[i], e); });
      tintNow.forEach(function (c, i) { el.style.setProperty("--san-t" + (i + 1), rgbCss(c)); });
      el.style.setProperty("--san-acc", rgbCss(tintNow[1]));
      if (p < 1) tintRaf = requestAnimationFrame(step);
    })(performance.now());
  }
  function scrimCss(e, g) { return ".san-scope .san-scrim[data-e='" + e + "']{background:" + g + "}"; }
  /* El fade mide 140 px más por cada lado que la pantalla: con las barras flotantes de Safari (que aparecen y se esconden
     al hacer scroll) nunca se ve su borde cortado. Los degradados se corren esos 140 px para verse igual. */
  var SX = 140;
  var LIN = function (dir) { return "linear-gradient(to " + dir + ",rgba(38,36,35,.26) 0px,rgba(38,36,35,.26) " + SX + "px,rgba(38,36,35,.18) " + (SX + 110) + "px,rgba(38,36,35,.05) " + (SX + 210) + "px,rgba(38,36,35,0) " + (SX + 290) + "px)"; };
  var RAD = function (at) {
    var p = at.split(" ").map(function (v) { return v === "0%" ? SX + "px" : "calc(100% - " + SX + "px)"; }).join(" ");
    return "radial-gradient(circle at " + p + ",rgba(38,36,35,.26) 0px,rgba(38,36,35,.17) 160px,rgba(38,36,35,.05) 280px,rgba(38,36,35,0) 380px)";
  };
  var CSS = [
    ".san-scope{--san-ink:#9C928A;--san-spark:#C9C1B8;--san-z:880;font-family:Montserrat,system-ui,-apple-system,sans-serif}",
    "#sa-nav-root[hidden]{display:none!important}",
    ".san-scope .san-scrim{position:fixed;inset:-140px;pointer-events:none;z-index:var(--san-z);opacity:.35;transition:opacity .6s cubic-bezier(.45,0,.55,1)}",
    ".san-scope .san-scrim[data-s='2']{opacity:.7}.san-scope .san-scrim[data-s='3']{opacity:.82}.san-scope .san-scrim[data-s='4']{opacity:1}.san-scope .san-scrim.moving{opacity:.2}",
    scrimCss("b", LIN("top")), scrimCss("t", LIN("bottom")), scrimCss("l", LIN("right")), scrimCss("r", LIN("left")),
    scrimCss("bl", RAD("0% 100%")), scrimCss("br", RAD("100% 100%")), scrimCss("tl", RAD("0% 0%")), scrimCss("tr", RAD("100% 0%")),
    ".san-scope .san-probe{position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none}",
    ".san-scope .san-catch{position:fixed;inset:0;z-index:calc(var(--san-z) + 1);display:none}.san-scope .san-catch.on{display:block}",
    ".san-scope .san-dots{position:fixed;inset:0;pointer-events:none;z-index:calc(var(--san-z) + 2)}",
    ".san-scope .san-dot{position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:#EEEBE7;box-shadow:inset 0 3px 5px rgba(110,90,80,.18),inset 0 -2px 3px rgba(255,255,255,.7);opacity:0;transition:opacity .35s ease,transform .5s cubic-bezier(.3,1.3,.55,1),box-shadow .25s}",
    ".san-scope .san-dots.on .san-dot{opacity:1}.san-scope .san-dot.near{transform:scale(1.4);box-shadow:inset 0 3px 5px rgba(110,90,80,.18),0 0 0 2px rgba(236,112,80,.85),0 0 14px rgba(236,112,80,.35)}",
    ".san-scope .san-nav{position:fixed;left:0;top:0;width:0;height:0;z-index:calc(var(--san-z) + 3);touch-action:none;-webkit-tap-highlight-color:transparent}",
    ".san-scope .san-nav,.san-scope .san-nav *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;box-sizing:border-box}",
    "body.san-dragging{-webkit-user-select:none;user-select:none;cursor:grabbing}",
    ".san-scope .san-abs{position:absolute;left:0;top:0;will-change:transform,opacity}",
    ".san-scope .san-grain::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background-image:" + GRAIN + "}",
    ".san-scope .san-arms{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}",
    ".san-scope .san-arm{position:absolute;border-radius:999px;background:#E9E4DE;box-shadow:0 14px 22px -6px rgba(60,45,38,.30),0 3px 6px rgba(60,45,38,.12),inset 0 3px 5px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.10)}",
    ".san-scope .san-item{width:0;height:0}.san-scope .san-items{position:absolute;left:0;top:0;width:0;height:0}",
    ".san-scope .san-btn{position:absolute;left:-29px;top:-29px;width:58px;height:58px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;color:var(--san-ink);font:inherit;" +
      "background:radial-gradient(120% 120% at 50% 20%,#F4F1EE 0%,#ECE8E3 55%,#E3DED8 100%);--lx:0;--ly:0;--la:0;" +
      "box-shadow:inset calc(var(--lx)*1px) calc(var(--ly)*1px) 10px rgba(238,116,82,var(--la)),0 7px 12px -5px rgba(96,76,66,.24),0 1px 3px rgba(96,76,66,.10),inset 0 2px 4px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.09);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:transform .55s cubic-bezier(.3,1.25,.55,1),box-shadow .4s ease,background .3s;-webkit-tap-highlight-color:transparent}",
    ".san-scope .san-btn svg{position:relative;z-index:1;transition:color .25s;filter:drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 -.6px 0 rgba(90,70,60,.30))}",
    ".san-scope .san-btn .san-t{position:relative;z-index:1;font:600 8.6px/1 Montserrat,system-ui,sans-serif;letter-spacing:.01em;white-space:nowrap;color:var(--san-ink);text-shadow:0 1px 0 rgba(255,255,255,.75)}",
    ".san-scope .san-btn.pressed,.san-scope .san-btn[aria-current='page']{transform:scale(.94);transition:transform .12s ease-out,box-shadow .14s ease-out;background:radial-gradient(120% 120% at 50% 80%,#EFEBE7 0%,#E6E1DB 60%,#DED8D1 100%);" +
      "box-shadow:inset calc(var(--lx)*1px) calc(var(--ly)*1px) 9px rgba(238,116,82,var(--la)),inset 0 3px 6px rgba(100,80,70,.22),inset 0 -1px 2px rgba(255,255,255,.5)}",
    ".san-scope .san-btn[aria-current='page'] svg{color:#E0613F}",
    ".san-scope .san-btn:focus-visible{outline:2px solid var(--san-acc,#E9826A);outline-offset:6px}",
    ".san-scope .san-badge{position:absolute;top:-4px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#E9826A;color:#fff;font:600 9.5px/18px Montserrat,system-ui,sans-serif;text-align:center;z-index:2;box-shadow:0 0 0 2.5px #EDE9E4,0 2px 4px rgba(200,90,60,.25)}",
    ".san-scope .san-fanb .san-btn{left:-30px;top:-30px;width:60px;height:60px;gap:3px;box-shadow:0 12px 18px -6px rgba(90,70,60,.32),0 3px 5px rgba(90,70,60,.14),inset 0 2px 4px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.10)}",
    ".san-scope .san-btn.san-foco{outline:2.5px solid var(--san-acc,#E9826A);outline-offset:3px;transform:scale(1.08)}",
    ".san-scope .san-fanb .san-btn.pressed{box-shadow:inset 0 3px 6px rgba(100,80,70,.22),inset 0 -1px 2px rgba(255,255,255,.5)}",
    ".san-scope .san-fanb img{width:21px;height:21px;object-fit:contain;position:relative;z-index:1;pointer-events:none;filter:drop-shadow(0 1px 0 rgba(255,255,255,.75))}",
    ".san-scope .san-core{width:0;height:0;animation:san-core 3.6s ease-in-out infinite}",
    "@keyframes san-core{0%,100%{scale:1}50%{scale:.97}}@keyframes san-glow{0%,100%{opacity:.32;transform:scale(.99)}50%{opacity:.68;transform:scale(1.01)}}@keyframes san-lit{0%,100%{opacity:0}50%{opacity:.8}}",
    ".san-scope .san-body{position:absolute;left:0;top:0;width:0;height:0;transition:transform .55s cubic-bezier(.3,1.25,.55,1)}",
    ".san-scope .san-led{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}",
    ".san-scope .san-ring,.san-scope .san-glow,.san-scope .san-glowb{position:absolute;left:-46px;top:-46px;width:92px;height:92px;border-radius:50%;pointer-events:none;background:" + GRAD + "}",
    ".san-scope .san-ring{-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%);mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%)}",
    ".san-scope .san-glow{left:-64px;top:-64px;width:128px;height:128px;-webkit-mask:radial-gradient(closest-side,transparent 56%,rgba(0,0,0,.7) 71%,rgba(0,0,0,.18) 83%,transparent 97%);mask:radial-gradient(closest-side,transparent 56%,rgba(0,0,0,.7) 71%,rgba(0,0,0,.18) 83%,transparent 97%);" +
      "animation:san-glow 3.6s ease-in-out infinite;will-change:opacity,transform}",
    ".san-scope .san-glowb{left:-64px;top:-64px;width:128px;height:128px;opacity:0;transition:opacity .35s ease;-webkit-mask:radial-gradient(closest-side,transparent 56%,rgba(0,0,0,.7) 71%,rgba(0,0,0,.18) 83%,transparent 97%);mask:radial-gradient(closest-side,transparent 56%,rgba(0,0,0,.7) 71%,rgba(0,0,0,.18) 83%,transparent 97%)}",
    "@keyframes san-surge{0%{opacity:.75;transform:scale(1.04)}100%{opacity:0;transform:scale(1)}}",
    ".san-scope .san-core.hot .san-glowb{opacity:.55;transition-duration:.12s}",
    ".san-scope .san-core.charge .san-glowb{opacity:.85;transform:scale(1.04);transition:opacity .28s ease,transform .28s ease}",
    ".san-scope .san-core.surge .san-glowb{animation:san-surge 1.1s cubic-bezier(.22,.61,.36,1)}",
        ".san-scope .san-face{--sombra:.6;position:absolute;left:-37px;top:-37px;width:74px;height:74px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;color:var(--san-ink);touch-action:none;-webkit-tap-highlight-color:transparent;outline:none;" +
      "background:radial-gradient(100% 100% at 50% 38%,#F5F2EE 0%,#EDE9E4 55%,#E2DCD5 100%);box-shadow:inset 0 4px 8px rgba(255,255,255,.35);transition:box-shadow .35s}",
    /* Sombras de la roca (como la esfera de referencia): solo negro, por fuera y por dentro, y respiran con el brillo. */
    ".san-scope .san-face::before{content:'';position:absolute;inset:0;border-radius:50%;pointer-events:none;box-shadow:0 16px 24px -8px rgba(0,0,0,.30),0 4px 7px rgba(0,0,0,.14);animation:san-sombra 3.6s ease-in-out infinite;transition:box-shadow .35s}",
    ".san-scope .san-stone::after{content:'';position:absolute;inset:0;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 36% 30%,rgba(0,0,0,0) 46%,rgba(0,0,0,.045) 74%,rgba(0,0,0,.10) 100%)" + "," + MAPA + ";background-size:100% 100%;background-repeat:no-repeat;animation:san-sombra 3.6s ease-in-out infinite}",
    ".san-scope .san-face::before,.san-scope .san-stone::after,.san-scope .san-st-rim{opacity:var(--sombra,1)}",
    "@keyframes san-sombra{0%,100%{opacity:calc(.7*var(--sombra,1))}50%{opacity:var(--sombra,1)}}",
    ".san-scope .san-stone{position:absolute;inset:0;border-radius:50%;overflow:hidden;-webkit-mask-image:-webkit-radial-gradient(white,black);transform:translateZ(0);pointer-events:none}",
    ".san-scope .san-stone::before{content:'';position:absolute;inset:0;border-radius:50%;opacity:.9;background-image:" + GRAIN + ";background-size:120px 120px}",
    ".san-scope .san-lit{position:absolute;inset:0;border-radius:50%;background:" + LUZ + ";-webkit-mask:" + LUZ_MASK + ";mask:" + LUZ_MASK + ";opacity:.06;transition:opacity .8s cubic-bezier(.45,0,.55,1)}",
    ".san-scope .san-lit::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit;opacity:0;animation:san-lit 3.6s ease-in-out infinite}",
    ".san-scope .san-face[data-mode='home'] .san-lit{opacity:.13}.san-scope .san-face[data-mode='close'] .san-lit{opacity:.2}",
    ".san-scope .san-face.charge .san-lit,.san-scope .san-face.lift .san-lit{opacity:.34;transition-duration:.6s}",
    ".san-scope .san-body.pressed{transform:scale(.93);transition:transform .12s ease-out}",
    ".san-scope .san-face.pressed{transition:box-shadow .12s;box-shadow:inset 0 4px 9px rgba(0,0,0,.16),inset 0 -3px 6px rgba(255,255,255,.3)}.san-scope .san-face.pressed::before{transition:box-shadow .12s;box-shadow:0 5px 9px -4px rgba(0,0,0,.28)}",
    ".san-scope .san-body.pressed.charge{transform:scale(1);transition:transform .28s cubic-bezier(.3,1.2,.55,1)}",
    ".san-scope .san-body.lift{transform:scale(1.07)}",
    ".san-scope .san-face.lift::before{box-shadow:0 26px 32px -10px rgba(0,0,0,.30),0 4px 8px rgba(0,0,0,.12)}",
    ".san-scope .san-face:focus-visible{outline:2px solid var(--san-acc,#E9826A);outline-offset:13px}",
    ".san-scope .san-g{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;z-index:1;transition:opacity .4s ease,transform .6s cubic-bezier(.3,1.25,.55,1),filter .4s ease}",
    ".san-scope .san-g svg{filter:drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 -.6px 0 rgba(90,70,60,.30))}",
    ".san-scope .san-g .san-t{font:600 8.8px/1 Montserrat,system-ui,sans-serif;letter-spacing:.03em;color:var(--san-ink);text-shadow:0 1px 0 rgba(255,255,255,.7)}",
    ".san-scope .san-g-spark{color:var(--san-spark)}",
    ".san-scope .san-face[data-mode='idle'] .san-g-home,.san-scope .san-face[data-mode='idle'] .san-g-x,.san-scope .san-face[data-mode='home'] .san-g-spark,.san-scope .san-face[data-mode='home'] .san-g-x,.san-scope .san-face[data-mode='close'] .san-g-spark,.san-scope .san-face[data-mode='close'] .san-g-home{opacity:0;transform:scale(.75);filter:blur(4px)}",
    ".san-scope .san-face[data-mode='close'] .san-g-x{color:#D9583A}.san-scope .san-face[data-mode='close'] .san-g-x svg{transform:rotate(45deg)}",
    ".san-scope .san-hint{position:fixed;z-index:calc(var(--san-z) + 4);max-width:min(300px,calc(100vw - 32px));font:500 11.5px/1.45 Montserrat,system-ui,sans-serif;color:#3E3F3F;background:#F3F0EC;padding:10px 14px;border-radius:16px;box-shadow:0 10px 18px -8px rgba(96,76,66,.28),inset 0 2px 3px rgba(255,255,255,.6);opacity:0;pointer-events:none;transform:translate(-50%,-100%) translateY(8px);transition:opacity .45s ease,transform .6s cubic-bezier(.3,1.25,.55,1);text-align:center}",
    ".san-scope .san-hint b{font-weight:600}.san-scope .san-hint span{display:block;white-space:nowrap}",
    ".san-scope .san-hint[data-side='down']{transform:translate(-50%,0) translateY(-8px)}.san-scope .san-hint[data-side='right']{transform:translate(0,-50%) translateX(-8px)}.san-scope .san-hint[data-side='left']{transform:translate(-100%,-50%) translateX(8px)}",
    ".san-scope .san-hint.on{opacity:1;transform:translate(-50%,-100%)}.san-scope .san-hint.on[data-side='down']{transform:translate(-50%,0)}.san-scope .san-hint.on[data-side='right']{transform:translate(0,-50%)}.san-scope .san-hint.on[data-side='left']{transform:translate(-100%,-50%)}",
    "@media (prefers-reduced-motion:reduce){.san-scope .san-core,.san-scope .san-glow,.san-scope .san-lit::after,.san-scope .san-face::before,.san-scope .san-stone::after,.san-scope .san-st-rim{animation:none}.san-scope .san-glow{opacity:.5}.san-scope .san-scrim{transition:none}.san-scope .san-btn,.san-scope .san-face,.san-scope .san-g,.san-scope .san-body,.san-scope .san-lit{transition-duration:.01s!important}.san-scope .san-core.surge .san-glow{animation:none}}",
    /* Alma por voz */
    ".san-scope .san-glowb{opacity:calc(.9*var(--pull,0))}.san-scope .san-lit{opacity:calc(.06 + .3*var(--pull,0))}",
    ".san-scope .san-core.alma-live .san-glowb{opacity:calc(.3 + .6*var(--voice,0))}.san-scope .san-core.alma-live .san-lit{opacity:calc(.14 + .35*var(--voice,0) + .3*var(--pull,0))}",
    ".san-scope .san-ph{position:fixed;z-index:calc(var(--san-z) + 12);white-space:nowrap;font:600 11px Montserrat,system-ui,sans-serif;letter-spacing:.04em;color:#3E3F3F;background:rgba(243,240,236,.94);padding:8px 13px;border-radius:999px;box-shadow:0 8px 16px -8px rgba(96,76,66,.3);transform:translate(-50%,-50%) scale(.9);opacity:0;pointer-events:none;transition:opacity .25s,transform .4s cubic-bezier(.3,1.3,.55,1)}",
    ".san-scope .san-ph.on{opacity:1;transform:translate(-50%,-50%) scale(1)}",
    ".san-scope .san-ov{position:fixed;inset:0;z-index:calc(var(--san-z) + 10);pointer-events:none;font-family:Montserrat,system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}.san-scope .san-ov.on{pointer-events:auto}",
    ".san-scope .san-ov-bg{position:absolute;inset:0;opacity:0;transition:opacity .7s cubic-bezier(.45,0,.55,1);background:radial-gradient(circle at 50% 50%,rgba(34,32,31,.62) 0px,rgba(34,32,31,.52) 170px,rgba(34,32,31,.34) 330px,rgba(34,32,31,.16) 480px,rgba(34,32,31,.06) 640px),rgba(250,250,250,.18)}",
    ".san-scope .san-ov.on .san-ov-bg{opacity:1}.san-scope .san-ov.min .san-ov-bg{opacity:.4}",
    /* escena (inicio de la app de Alma): solo la piedra con sus botones sobre el fondo de la página */
    ".san-scope.san-escena>:not(.san-ov):not(.san-ph){display:none!important}",
    ".san-scope .san-ov.escena .san-ov-bg{background:radial-gradient(circle at 50% 62%,rgba(40,30,32,.2) 0px,rgba(40,30,32,.08) 260px,rgba(40,30,32,0) 520px)}",
    ".san-scope .san-ov.escena .san-ov-tip{display:none}.san-scope .san-ov.quieta .san-ob.end{opacity:.38;pointer-events:none}",
    ".san-scope .san-rock{position:absolute;left:0;top:0;width:0;height:0;border-radius:50%;visibility:hidden;will-change:transform;touch-action:none;cursor:pointer;pointer-events:auto;--halo:.5;--lit:.06;box-shadow:0 30px 44px -18px rgba(70,50,40,.45),0 8px 14px -6px rgba(70,50,40,.18)}",
    ".san-scope .san-st-ring,.san-scope .san-st-glow{position:absolute;border-radius:50%;pointer-events:none;background:var(--san-halo," + GRAD + ")}",
    ".san-scope .san-st-ring{inset:-9px;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%);mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%)}",
    ".san-scope .san-st-glow{inset:-96px;opacity:var(--halo);-webkit-mask:radial-gradient(closest-side,transparent calc(100% - 104px),rgba(0,0,0,.9) calc(100% - 88px),rgba(0,0,0,.55) calc(100% - 60px),rgba(0,0,0,.2) calc(100% - 30px),transparent 100%);mask:radial-gradient(closest-side,transparent calc(100% - 104px),rgba(0,0,0,.9) calc(100% - 88px),rgba(0,0,0,.55) calc(100% - 60px),rgba(0,0,0,.2) calc(100% - 30px),transparent 100%)}",
    ".san-scope .san-st-body{position:absolute;inset:0;border-radius:50%;overflow:hidden;-webkit-mask-image:-webkit-radial-gradient(white,black);transform:translateZ(0);background:radial-gradient(circle at 40% 34%,#F7F5F2 0%,#EFECE8 42%,#E3DFDA 78%,#D3CEC8 100%)}",
    ".san-scope .san-st-body::before{content:'';position:absolute;inset:0;background-image:" + GRAIN + ";background-size:120px 120px;opacity:.9}",
    ".san-scope .san-st-lit{position:absolute;inset:0;border-radius:50%;background:" + LUZ + ";-webkit-mask:" + LUZ_MASK + ";mask:" + LUZ_MASK + ";opacity:calc(var(--lit)*.5)}",
    ".san-scope .san-st-rim{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 36% 30%,rgba(255,255,255,.28) 0%,rgba(255,255,255,0) 40%,rgba(0,0,0,0) 46%,rgba(0,0,0,.045) 74%,rgba(0,0,0,.10) 100%)," + MAPA + ";background-size:100% 100%;background-repeat:no-repeat;animation:san-sombra 3.6s ease-in-out infinite}",
    ".san-scope .san-st-spark{position:absolute;inset:0;display:grid;place-items:center;color:#CBC4BC;pointer-events:none}.san-scope .san-st-spark svg{width:22%;height:22%;filter:drop-shadow(0 1px 0 rgba(255,255,255,.8)) drop-shadow(0 -.8px 0 rgba(80,70,60,.32))}",
    ".san-scope .san-ov-ui{position:absolute;left:50%;top:calc(44% + min(33vw,20vh,135px) + 34px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:16px;width:min(320px,calc(100% - 32px));opacity:0;scale:.96;transition:opacity .16s ease,scale .2s ease}",
    ".san-scope .san-ov.on .san-ov-ui{opacity:1;scale:1;transition:opacity 1.1s cubic-bezier(.45,0,.55,1) .55s,scale 1.3s cubic-bezier(.22,.61,.36,1) .55s}",
    ".san-scope .san-ov.chat .san-ov-ui,.san-scope .san-ov.min .san-ov-ui{opacity:0;pointer-events:none;transition:opacity .16s ease}.san-scope .san-ov.ending .san-ov-ui{opacity:.25;transition:opacity .2s ease}",
    ".san-scope .san-ov-st{font:600 10.5px Montserrat,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#F5F1EC;text-shadow:0 1px 6px rgba(40,30,25,.35)}",
    ".san-scope .san-ov-cap{font:500 15px/1.45 Montserrat,system-ui,sans-serif;color:#FFFDFB;text-align:center;min-height:44px;max-height:30vh;overflow:auto;text-shadow:0 1px 8px rgba(40,30,25,.45);text-wrap:balance;transition:opacity .9s cubic-bezier(.45,0,.55,1),scale 1.1s cubic-bezier(.22,.61,.36,1)}",
    ".san-scope .san-ov-cap.in{opacity:0;scale:.97;transition:none}",
    ".san-scope .san-ov-btns{display:flex;gap:22px}",
    ".san-scope .san-ob{position:relative;width:56px;height:56px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;color:var(--san-ink);background:radial-gradient(120% 120% at 50% 20%,#F4F1EE 0%,#ECE8E3 55%,#E3DED8 100%);box-shadow:0 12px 18px -6px rgba(40,30,25,.4),0 3px 5px rgba(40,30,25,.16),inset 0 2px 4px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.10);transition:transform .45s cubic-bezier(.3,1.35,.55,1)}",
    ".san-scope .san-ob:active{transform:scale(.92);transition-duration:.1s}.san-scope .san-ob.end svg{color:#D9583A}.san-scope .san-ob:focus-visible{outline:2px solid var(--san-acc,#E9826A);outline-offset:4px}",
    ".san-scope .san-ob span{position:absolute;top:62px;left:50%;transform:translateX(-50%);font:600 9.5px Montserrat,system-ui,sans-serif;letter-spacing:.06em;color:#F5F1EC;white-space:nowrap;text-shadow:0 1px 6px rgba(40,30,25,.4)}",
    ".san-scope .san-ov-tip{font:500 10.5px Montserrat,system-ui,sans-serif;letter-spacing:.04em;color:rgba(245,241,236,.8);text-align:center;text-shadow:0 1px 6px rgba(40,30,25,.4)}",
    /* Chat: un lienzo alabastro de pantalla completa. Alma sube a la cabecera en «modo texto»; las secciones se separan con sombras amplias y difusas. */
    ".san-scope .san-chat{position:absolute;inset:0;z-index:2;background:#FAF8F6;display:flex;flex-direction:column;opacity:0;transform:translateY(24px);pointer-events:none;transition:opacity .45s cubic-bezier(.45,0,.55,1),transform .6s cubic-bezier(.3,1.15,.55,1);padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}",
    ".san-scope .san-ov.chat .san-chat{opacity:1;transform:none;pointer-events:auto}.san-scope .san-ov.chat .san-rock{z-index:3;pointer-events:none}.san-scope .san-ov.chat .san-st-glow{opacity:.28;transition:opacity .6s ease}",
    /* En el chat la roca toma el peach del Hub (#E9826A) */
    ".san-scope .san-ov.chat .san-st-body{background:radial-gradient(circle at 40% 34%,#F2A08B 0%,#E9826A 55%,#DB6F57 100%)}.san-scope .san-ov.chat .san-st-spark{color:#fff}.san-scope .san-ov.chat .san-st-ring,.san-scope .san-ov.chat .san-st-glow{background:#E9826A}",
    ".san-scope .san-chat header{position:relative;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px 16px 10px;min-height:64px;box-sizing:border-box;touch-action:none}.san-scope .san-chat header .asa{position:absolute;top:8px;left:50%;width:36px;height:5px;margin-left:-18px;border-radius:3px;background:rgba(62,63,63,.14)}.san-scope .san-chat header .t{flex:1;min-width:0}",
    ".san-scope .san-chat header b{display:block;font:400 27px/1 Valky,Georgia,serif;color:#3E3F3F}.san-scope .san-chat header small{display:block;margin-top:5px;font:600 10px Montserrat,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#A39B93}",
    ".san-scope .san-hb{width:42px;height:42px;flex:none;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;background:#fff;color:var(--san-ink);box-shadow:0 12px 26px -14px rgba(60,45,35,.4),0 1px 3px rgba(60,45,35,.06)}.san-scope .san-hb:active{transform:scale(.92)}",
    ".san-scope .san-msgs{flex:1;overflow:auto;padding:18px 18px 26px;display:flex;flex-direction:column;gap:16px;-webkit-overflow-scrolling:touch}",
    ".san-scope .san-m{max-width:82%;padding:13px 17px;border-radius:22px;font:500 15px/1.5 Montserrat,system-ui,sans-serif;-webkit-user-select:text;user-select:text;white-space:pre-wrap;overflow-wrap:anywhere;animation:sanMsg .5s cubic-bezier(.22,.61,.36,1) both}",
    ".san-scope .san-m.a{background:#fff;color:#3E3F3F;border-bottom-left-radius:8px;align-self:flex-start;box-shadow:0 24px 50px -24px rgba(70,50,40,.3),0 2px 6px -2px rgba(70,50,40,.06)}",
    ".san-scope .san-m.u{background:#3E3F3F;color:#FAF8F6;border-bottom-right-radius:8px;align-self:flex-end;box-shadow:0 22px 44px -24px rgba(30,25,20,.55)}",
    ".san-scope .san-m.foto{padding:6px}.san-scope .san-m.foto img{display:block;max-width:220px;max-height:280px;border-radius:17px}.san-scope .san-m.info{align-self:center;background:none;box-shadow:none;padding:2px 8px;font-size:12px;color:#A39B93}",
    "@keyframes sanMsg{from{opacity:0;transform:translateY(8px)}}",
    ".san-scope .san-vacio{padding:0 18px 16px;display:flex;flex-direction:column;gap:14px}.san-scope .san-chat:has(.san-m.u) .san-vacio{display:none}",
    ".san-scope .san-vacio h3{margin:0;font:400 32px/1.1 Valky,Georgia,serif;color:#3E3F3F}.san-scope .san-vacio p{margin:0;font:500 13px/1.5 Montserrat,system-ui,sans-serif;color:#8A8580}",
    ".san-scope .san-sug{display:flex;flex-wrap:wrap;gap:10px}.san-scope .san-sug button{border:0;cursor:pointer;padding:11px 16px;border-radius:999px;background:#fff;color:#3E3F3F;font:500 13.5px Montserrat,system-ui,sans-serif;box-shadow:0 18px 38px -20px rgba(70,50,40,.36),0 1px 3px rgba(70,50,40,.05)}.san-scope .san-sug button:active{transform:scale(.96)}",
    ".san-scope .san-chat form{position:relative;margin:0 12px 12px;display:flex;align-items:flex-end;gap:6px;padding:7px;border-radius:30px;background:#fff;box-shadow:0 30px 64px -28px rgba(70,50,40,.42),0 4px 12px -6px rgba(70,50,40,.1)}",
    ".san-scope .san-in{flex:1;min-width:0;border:0;background:transparent;padding:12px 6px;font:500 16px/1.4 Montserrat,system-ui,sans-serif;color:#3E3F3F;outline:none;resize:none;height:46px;max-height:140px;box-sizing:border-box}.san-scope .san-in::placeholder{color:#B2AAA2}",
    ".san-scope .san-clip{width:46px;height:46px;flex:none;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;background:#F3EFEA;color:var(--san-ink)}.san-scope .san-clip[hidden]{display:none}",
    /* el botón roca: 1 toque envía · mantener graba una nota de voz · 2 toques, una foto */
    ".san-scope .san-send{width:46px;height:46px;flex:none;border-radius:50%;border:0;padding:0;cursor:pointer;position:relative;display:grid;place-items:center;color:#B36A57;touch-action:none;-webkit-user-select:none;user-select:none;background:transparent;border-radius:50%}",
    ".san-scope .san-send.graba{animation:sanGraba 1.2s ease-in-out infinite}@keyframes sanGraba{50%{box-shadow:0 0 0 14px rgba(233,130,106,.2)}}",
    ".san-scope .san-tips{position:absolute;right:4px;bottom:64px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none;opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .45s cubic-bezier(.3,1.3,.55,1)}.san-scope .san-tips.on{opacity:1;transform:none}",
    ".san-scope .san-tips span{padding:8px 13px;border-radius:999px;background:#3E3F3F;color:#FAF8F6;font:500 11.5px Montserrat,system-ui,sans-serif;white-space:nowrap;box-shadow:0 16px 32px -14px rgba(30,25,20,.6)}.san-scope .san-tips b{color:#F2B4A2;font-weight:600;margin-right:6px}",
    ".san-scope .san-graba{position:absolute;left:62px;right:62px;top:50%;transform:translateY(-50%);font:500 14px Montserrat,system-ui,sans-serif;color:#B36A57;display:none}.san-scope form.grabando .san-graba{display:block}.san-scope form.grabando .san-in{visibility:hidden}",
    "body.san-docked [data-sa-dock]{visibility:hidden!important}[data-sa-dock].san-hosting{position:relative!important;overflow:visible!important}",
    "[data-sa-slot]{transition:padding-right .55s cubic-bezier(.34,1.45,.6,1)}[data-sa-slot].san-slotted{position:relative;padding-right:var(--san-slot-w)!important}",
    ".san-slothost{position:absolute;top:50%;width:0;height:0;visibility:visible;z-index:5;pointer-events:none}.san-slothost .san-nav{position:absolute!important;left:0!important;top:0!important;bottom:auto!important;pointer-events:auto}",
    "@media (prefers-reduced-motion:reduce){[data-sa-slot]{transition:none}}",
    /* portal: la piedra de Alma cubre la pantalla al irse a otra página y la recibe al llegar */
    ".san-scope.san-portal{position:fixed;inset:0;z-index:2147483600;overflow:hidden;pointer-events:auto;touch-action:none}",
    ".san-scope .san-rock.san-pp{width:140px;height:140px;margin:-70px 0 0 -70px;visibility:visible;--halo:.9;--lit:.55;--sombra:.6;pointer-events:none}",
    ".san-scope .san-pw{position:absolute;inset:-1px;border-radius:50%;background:#FAFAFA;opacity:0;pointer-events:none}",
    ".san-scope .san-pcap{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:min(320px,82vw);text-align:center;font:500 15px/1.5 Montserrat,system-ui,sans-serif;letter-spacing:.04em;color:#6F6867;opacity:0;pointer-events:none}",
    ".san-dockhost{position:absolute;left:50%;top:50%;width:0;height:0;visibility:visible;z-index:2;pointer-events:none}.san-dockhost .san-nav{position:absolute!important;left:0!important;top:0!important;bottom:auto!important;pointer-events:auto}",
    ".san-scope.docked .san-hint{display:none}",
    "@media print{#sa-nav-root{display:none!important}}"
  ].join("\n");

  /* ================= geometría ================= */
  var T = 84, SLOT = [84, 160], ARM_L = 202, IDLE_MS = 6000, TAP_MS = 320, LONG_MS = 420, PULSE = 3600;
  var ANCH = ["tl", "tc", "tr", "ml", "mr", "bl", "bc", "br"];
  var RM = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function VW() { return d.documentElement.clientWidth || w.innerWidth; }
  function VH() { return (w.visualViewport && w.visualViewport.height) || d.documentElement.clientHeight || w.innerHeight; }
  function K() { return Math.min(1, (Math.min(VW(), VH()) - 20) / (2 * ARM_L)); }
  var insetCache = null;
  function insets() {
    if (insetCache) return insetCache;
    var p = d.createElement("div"); p.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    d.body.appendChild(p); var c = getComputedStyle(p);
    insetCache = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
    p.remove(); return insetCache;
  }
  /* Ranuras: en algunas pantallas una de las 8 posiciones no es la esquina de la pantalla sino un lugar de la página.
     · La del botón de Alma del editor (data-sa-dock) reemplaza a la posición más cercana: soltar ahí = volver a encajarlo.
     · Un contenedor con data-sa-slot="tr" (p. ej. los botones del encabezado del Resumen) es la esquina superior derecha:
       el botón se acomoda al final de ese contenedor, a su tamaño normal, y empuja hacia la izquierda lo que había ahí. */
  var ptsCache = null;
  function anchorPt(a, raw) {
    if (!raw) {
      if (ptsCache && ptsCache[a]) return ptsCache[a];
      var da = dockAnchor(); if (da && da.a === a) return { x: da.x, y: da.y, dock: true };
      var sl = slotFor(a); if (sl) return { x: sl.r.right - slotW() / 2, y: sl.r.top + sl.r.height / 2, slot: true };
    }
    var W = VW(), H = VH(), i = insets(), m = 60 * K();
    var x = a[1] === "l" ? m + i.l : a[1] === "r" ? W - m - i.r : W / 2, y = a[0] === "t" ? m + i.t : a[0] === "b" ? H - m - i.b : H / 2;
    if (a === "ml") x = m + i.l; if (a === "mr") x = W - m - i.r;
    return { x: x, y: y };
  }
  function dockAnchor() {
    if (!dock.el || !root) return null;
    var t = dockTarget(); if (!t) return null;
    var cx = t.r.left + t.r.width / 2, cy = t.r.top + t.r.height / 2, b = null, bd = 1e9;
    ANCH.forEach(function (a) { var p = anchorPt(a, true), dd = Math.hypot(p.x - cx, p.y - cy); if (dd < bd) { bd = dd; b = a; } });
    return b ? { a: b, x: cx, y: cy } : null;
  }
  function slotW() { return Math.round(74 * K()) + 10; }
  function slotFor(a) {
    var els = d.querySelectorAll('[data-sa-slot="' + a + '"]'), lim = Math.max(w.innerHeight, d.documentElement.clientHeight || 0);
    for (var i = 0; i < els.length; i++) { var r = els[i].getBoundingClientRect(); if (r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < lim && dockShown(els[i], r)) return { el: els[i], r: r }; }
    return null;
  }
  var slotEl = null;
  function slotPush(el) {
    if (slotEl === el) return; slotPull();
    if (!el) return; slotEl = el; el.style.setProperty("--san-slot-w", slotW() + "px"); el.classList.add("san-slotted");
  }
  function slotPull() { if (slotEl) { slotEl.classList.remove("san-slotted"); slotEl = null; } }
  function armsFor(a) {
    if (a === "tc" || a === "bc") return [[-1, 0], [1, 0]];
    if (a === "ml" || a === "mr") return [[0, -1], [0, 1]];
    return [a[0] === "t" ? [0, 1] : [0, -1], a[1] === "l" ? [1, 0] : [-1, 0]];
  }
  function inward(a) { var x = a[1] === "l" ? 1 : a[1] === "r" ? -1 : 0, y = a[0] === "t" ? 1 : a[0] === "b" ? -1 : 0; if (a === "ml") { x = 1; y = 0; } if (a === "mr") { x = -1; y = 0; } var l = Math.hypot(x, y); return [x / l, y / l]; }
  function isCorner(a) { return a[0] !== "m" && a[1] !== "c"; }
  function fanGeo(a, n, armsOpen) {
    var v = inward(a), th = Math.atan2(v[1], v[0]), gap = 70, half, R, off = armsOpen ? 54 : 0;
    if (isCorner(a)) { gap = 76; if (armsOpen) off = 82; half = 46 * Math.PI / 180; R = Math.max(104, (n - 1) * gap / (2 * half)); }
    else { half = 72 * Math.PI / 180; R = Math.max(98, (n - 1) * gap / (2 * half)); }
    var pol = []; for (var j = 0; j < n; j++) { var t = n === 1 ? th : th - half + 2 * half * j / (n - 1); pol.push({ a: t, c: th, r: R, ox: v[0] * off, oy: v[1] * off }); }
    return { pol: pol, R: R };
  }

  /* ================= resortes ================= */
  function Spring(v) { this.x = v; this.v = 0; this.t = v; this.k = 200; this.c = 28; }
  Spring.prototype.to = function (t, resp, damp, vel) { if (RM) { resp = .2; damp = 1; } this.t = t; var wn = 2 * Math.PI / (resp || .42); this.k = wn * wn; this.c = 2 * (damp == null ? .75 : damp) * wn; if (vel != null) this.v = vel; kick(); };
  Spring.prototype.step = function (dt) { var f = -this.k * (this.x - this.t) - this.c * this.v; this.v += f * dt; this.x += this.v * dt; };
  Spring.prototype.rest = function (e) { return Math.abs(this.x - this.t) < e && Math.abs(this.v) < e * 8; };
  var springs = [], pend = [], running = false, last = 0;
  function S(v, big) { var s = new Spring(v); s.big = !!big; springs.push(s); return s; }
  function later(sp, t, ms, resp, damp) { pend.push({ sp: sp, t: t, at: performance.now() + ms, r: resp, d: damp }); kick(); }
  function cancelPend(list) { pend = pend.filter(function (p) { return list.indexOf(p.sp) < 0; }); }
  function kick() { if (!running && root) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
  function tick(now) {
    if (!root) { running = false; return; }
    var dt = Math.min(.05, (now - last) / 1000); last = now;
    pend = pend.filter(function (p) { if (now >= p.at) { p.sp.to(p.t, p.r, p.d); return false; } return true; });
    var n = Math.max(1, Math.round(dt / (1 / 240))), h = dt / n; for (var i = 0; i < n; i++) springs.forEach(function (s) { s.step(h); });
    render();
    var busy = pend.length || springs.some(function (s) { return !s.rest(s.big ? .05 : .0008); });
    if (busy || dragging) requestAnimationFrame(tick); else { springs.forEach(function (s) { s.x = s.t; s.v = 0; }); render(); running = false; }
  }

  /* ================= almacenamiento compartido ================= */
  function dom() { return /(^|\.)spacioam\.com$/i.test(location.hostname) ? "; domain=.spacioam.com" : ""; }
  function getCk(k) { var m = d.cookie.match(new RegExp("(?:^|;\\s*)" + k + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; }
  function setCk(k, v) { try { d.cookie = k + "=" + encodeURIComponent(v) + dom() + "; path=/; max-age=" + (365 * 86400) + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch (e) {} }
  function appBadge(k) { if (cfg && cfg.appBadges && typeof cfg.appBadges[k] === "number") return cfg.appBadges[k]; var m = d.cookie.match(new RegExp("(?:^|;\\s*)sa_noti_" + k + "=([^;]*)")); var n = m ? parseInt(String(m[1]).split(".")[0], 10) : 0; return isNaN(n) ? 0 : n; }

  /* ================= estado ================= */
  var cfg = null, root = null, st = { S: 1, anchor: "bc", fan: "apps" };
  var px, py, arm, barS, zoom, navP = [], fanP = [], arms, geo = { pol: [], R: 0 };
  var E = {}, itemEls = [], fanEls = [], fanList = [], shown = [], overflow = [];
  var allowed = null, dragging = false;

  function build() {
    if (!d.getElementById("sa-nav-css")) { var s = d.createElement("style"); s.id = "sa-nav-css"; s.textContent = CSS; d.head.appendChild(s); }
    root = d.createElement("div"); root.id = "sa-nav-root"; root.className = "san-scope";
    root.innerHTML = '<div class="san-probe"></div><div class="san-scrim" aria-hidden="true"></div><div class="san-catch"></div><div class="san-dots" aria-hidden="true"></div>' +
      '<nav class="san-nav" aria-label="Navegación"><div class="san-arms"><div class="san-arm san-grain"></div><div class="san-arm san-grain"></div></div><div class="san-fan"></div><div class="san-items"></div>' +
      '<div class="san-abs san-core"><span class="san-body"><span class="san-led"><span class="san-glow"></span><span class="san-glowb"></span><span class="san-ring"></span></span>' +
      '<button type="button" class="san-face" data-mode="idle" aria-label="Abrir menú" aria-expanded="false"><span class="san-stone"><span class="san-lit"></span></span>' +
      '<span class="san-g san-g-spark">' + SPARK + '</span><span class="san-g san-g-home">' + svg(P.home, 22) + '<span class="san-t"></span></span><span class="san-g san-g-x">' + SPARK + '<span class="san-t">Cerrar</span></span></button></span></div></nav>' +
      '<div class="san-ph" role="status"></div><div class="san-hint" role="note"><span><b>Toca</b> · pantallas</span><span><b>Doble toque</b> · apps</span><span><b>Mantén</b> · mover</span></div>';
    d.body.appendChild(root);
    E.scrim = root.querySelector(".san-scrim"); E.probe = root.querySelector(".san-probe"); E.catch = root.querySelector(".san-catch"); E.dots = root.querySelector(".san-dots");
    E.nav = root.querySelector(".san-nav"); E.arms = root.querySelectorAll(".san-arm"); E.armsBox = root.querySelector(".san-arms"); E.fan = root.querySelector(".san-fan"); E.items = root.querySelector(".san-items");
    E.core = root.querySelector(".san-core"); E.face = root.querySelector(".san-face"); E.body = root.querySelector(".san-body"); E.lbl = root.querySelector(".san-g-home .san-t"); E.hint = root.querySelector(".san-hint"); E.ph = root.querySelector(".san-ph");
    ANCH.forEach(function (a) { var s = d.createElement("span"); s.className = "san-dot"; s.dataset.a = a; E.dots.appendChild(s); });
    E.nav.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    E.nav.addEventListener("selectstart", function (e) { e.preventDefault(); });
    E.catch.addEventListener("pointerdown", function () { if (st.S === 3) setS(1); else if (st.S === 4) setS(2); });
    bindCore();
  }

  /* ================= botones ================= */
  function pressable(btn, fn) {
    btn.addEventListener("pointerdown", function () { btn.classList.add("pressed"); activity(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { btn.addEventListener(ev, function () { btn.classList.remove("pressed"); }); });
    btn.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
  }
  function btnHtml(label, ic, badge, img) {
    return '<button type="button" class="san-btn san-grain" aria-label="' + esc(label) + (badge ? " · " + badge : "") + '">' + (img ? '<img alt="" src="' + img + '">' : icon(ic)) +
      '<span class="san-t">' + esc(label) + '</span>' + (badge ? '<span class="san-badge" aria-hidden="true">' + (badge > 99 ? "99+" : badge) + "</span>" : "") + "</button>";
  }
  function buildItems() {
    var items = cfg.items || [];
    /* hasta 4 directos; con más, 3 + «Más». La app puede fijar cuántos van directos (cfg.masDesde) */
    var lim = typeof cfg.masDesde === "number" ? cfg.masDesde : (items.length > 4 ? 3 : 4);
    if (items.length > lim) { shown = items.slice(0, lim).concat([{ k: "__more", l: "Más", icon: "more", badge: items.slice(lim).reduce(function (a, it) { return a + (it.badge || 0); }, 0) }]); overflow = items.slice(lim); }
    else { shown = items.slice(); overflow = []; }
    E.items.innerHTML = ""; itemEls = [];
    springs = springs.filter(function (s) { return navP.indexOf(s) < 0; }); navP = [];
    shown.forEach(function (it) {
      var el = d.createElement("div"); el.className = "san-abs san-item"; el.innerHTML = btnHtml(it.l, it.icon, it.badge);
      pressable(el.firstChild, function () { if (Date.now() - (el.firstChild._sub || 0) < 700) return; if (it.k === "__more") openFan("more"); else go(it.k); });
      subGesto(el.firstChild, it.k);
      E.items.appendChild(el); itemEls.push(el); navP.push(S(st.S === 2 || st.S === 4 ? 1 : 0));
    });
    markCurrent(); fitLabels();
  }
  /* ── Opciones de adentro (estado 2) ──
     Cada pantalla de la barra puede traer sus propias opciones: cfg.items[i].sub = [{ k, l, icon, badge }].
     Se abren en abanico, con la misma animación que las apps: doble toque (anillo sobre la opción, o la roca con el
     menú abierto) o, con el dedo, mantener la opción y deslizar hacia el centro de la pantalla. Las apps (Epi, Grow…)
     solo se abren desde el estado 1. */
  function subDe(k) { var it = (cfg.items || []).filter(function (x) { return x.k === k; })[0]; return it && it.sub && it.sub.length ? it : null; }
  function openSub(k) {
    activity();
    if (k === "__more") { openFan("more"); return true; }
    if (!subDe(k)) { nope(); return false; }
    if (st.S !== 2 && st.S !== 4) setS(2);
    openFan("sub:" + k);
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {}
    return true;
  }
  function subGesto(btn, k) {
    var p0 = null, hecho = false;
    btn.addEventListener("pointerdown", function (e) { p0 = [e.clientX, e.clientY]; hecho = false; try { btn.setPointerCapture(e.pointerId); } catch (x) {} });
    btn.addEventListener("pointermove", function (e) {
      if (!p0 || hecho) return;
      var v = inward(st.anchor), dx = e.clientX - p0[0], dy = e.clientY - p0[1], al = dx * v[0] + dy * v[1], cruz = Math.abs(dx * v[1] - dy * v[0]);
      if (al > 34 && cruz < al) { hecho = true; btn._sub = Date.now(); btn.classList.remove("pressed"); openSub(k); }
    });
    ["pointerup", "pointercancel"].forEach(function (ev) { btn.addEventListener(ev, function () { p0 = null; }); });
  }
  function buildFan(mode) {
    st.fan = mode;
    if (/^sub:/.test(mode)) {
      var padre = subDe(mode.slice(4)) || { sub: [] };
      fanList = padre.sub.map(function (o) { return { label: o.l, icon: o.icon || padre.icon, badge: o.badge, k: o.k, tap: function () { go(o.k); } }; });
    } else if (mode === "more") fanList = overflow.map(function (it) { return { label: it.l, icon: it.icon, badge: it.badge, k: it.k, tap: function () { go(it.k); } }; });
    else fanList = APPS.filter(function (a) { return a.k !== cfg.app && (!allowed || allowed.indexOf(a.k) >= 0); })
      .map(function (a) { return { label: a.n, img: HUB + "/assets/apps/glyph-" + a.k + ".webp", badge: appBadge(a.k), tap: function () { openApp(a); }, aria: "Abrir " + a.n + " · " + a.desc }; });
    E.fan.innerHTML = ""; fanEls = [];
    springs = springs.filter(function (s) { return fanP.indexOf(s) < 0; }); fanP = [];
    fanList.forEach(function (f) {
      var el = d.createElement("div"); el.className = "san-abs san-item san-fanb"; el.innerHTML = btnHtml(f.label, f.icon, f.badge, f.img);
      if (f.aria) el.firstChild.setAttribute("aria-label", f.aria);
      if (f.k && f.k === cfg.current) el.firstChild.setAttribute("aria-current", "page");
      pressable(el.firstChild, f.tap); E.fan.appendChild(el); fanEls.push(el); fanP.push(S(0));
    });
    fitLabels();
  }
  function markCurrent() {
    var inOverflow = overflow.some(function (it) { return it.k === cfg.current; });
    itemEls.forEach(function (el, i) { var on = shown[i].k === cfg.current || (shown[i].k === "__more" && inOverflow); if (on) el.firstChild.setAttribute("aria-current", "page"); else el.firstChild.removeAttribute("aria-current"); });
  }
  /* una etiqueta larga se achica hasta caber dentro del círculo */
  function fitLabels() {
    if (!root) return;
    root.querySelectorAll(".san-btn .san-t").forEach(function (t) { t.style.fontSize = ""; var room = t.closest(".san-fanb") ? 46 : 43, wd = t.scrollWidth; if (wd > room) t.style.fontSize = Math.max(6.6, 8.6 * room / wd).toFixed(2) + "px"; });
  }

  /* ================= render ================= */
  function slotOf(i) { var a = i < 2 ? 0 : 1, s = i === 0 || i === 3 ? SLOT[1] : SLOT[0]; return { d: arms[a], s: s }; }
  /* Los botones de abajo se pintan contados desde el borde inferior (bottom:0): cuando la barra de Safari aparece o se
     esconde al hacer scroll, el navegador los mueve en el mismo cuadro, sin esperar a JavaScript. */
  var fbTop = 0, fbOn = false;
  function measureBottom() { if (E.probe) { var t = E.probe.getBoundingClientRect().top; if (t > 0) fbTop = t; } return fbTop; }
  function render() {
    if (!root) return;
    if (hosted) E.nav.style.transform = "scale(" + zoom.x.toFixed(4) + ")";
    else {
      if (!fbTop) measureBottom();
      var fb = fbTop > 0 && py.t > fbTop / 2;
      if (fb !== fbOn) { fbOn = fb; E.nav.style.top = fb ? "auto" : ""; E.nav.style.bottom = fb ? "0" : ""; }
      E.nav.style.transform = "translate(" + px.x + "px," + (fb ? py.x - fbTop : py.x) + "px) scale(" + zoom.x.toFixed(4) + ")";
    }
    if (pullS && (pullS.x || pulling)) pullRender(); else if (pullS) pullClear();
    var bs = "scale(" + barS.x.toFixed(4) + ")"; E.armsBox.style.transform = bs; E.items.style.transform = bs;
    var h = T / 2, A0 = arms[0], A1 = arms[1], L0 = clamp(arm[0].x, h, ARM_L), L1 = clamp(arm[1].x, h, ARM_L), op = clamp(Math.max(arm[0].x, arm[1].x) / 24, 0, 1);
    if (A0[0] === -A1[0] && A0[1] === -A1[1]) {
      E.arms[0].style.cssText = A0[0] !== 0 ? "left:" + (-L0) + "px;top:" + (-h) + "px;width:" + (L0 + L1) + "px;height:" + T + "px;opacity:" + op
        : "left:" + (-h) + "px;top:" + (-L0) + "px;width:" + T + "px;height:" + (L0 + L1) + "px;opacity:" + op;
      E.arms[1].style.cssText = "display:none";
    } else for (var a = 0; a < 2; a++) {
      var L = a ? L1 : L0, dd = arms[a], l, t, wd, hh;
      if (dd[0] !== 0) { wd = L + h; hh = T; t = -h; l = dd[0] > 0 ? -h : -L; } else { wd = T; hh = L + h; l = -h; t = dd[1] > 0 ? -h : -L; }
      E.arms[a].style.cssText = "left:" + l + "px;top:" + t + "px;width:" + wd + "px;height:" + hh + "px;opacity:" + clamp(arm[a].x / 24, 0, 1);
    }
    itemEls.forEach(function (el, i) {
      var p = navP[i].x, o = slotOf(i), x = o.d[0] * o.s * p, y = o.d[1] * o.s * p;
      el.style.transform = "translate(" + x + "px," + y + "px) scale(" + (.45 + .55 * p) + ")"; el.style.opacity = clamp(p * 1.6 - .3, 0, 1);
      var dist = Math.max(1, Math.hypot(x, y)), b = el.firstChild;
      b.style.setProperty("--lx", (x / dist * 5).toFixed(2)); b.style.setProperty("--ly", (y / dist * 5).toFixed(2)); b.style.setProperty("--la", (clamp(1 - (dist - 70) / 130, 0, 1) * .32).toFixed(3));
      el.style.pointerEvents = p > .6 ? "auto" : "none";
    });
    fanEls.forEach(function (el, j) {
      var q = fanP[j].x, pl = geo.pol[j]; if (!pl) return;
      var u = clamp(q, 0, 1.2), ang = pl.c + (pl.a - pl.c) * clamp(u * u * (3 - 2 * Math.min(u, 1)), 0, 1.1), r = pl.r * q;
      el.style.transform = "translate(" + (pl.ox * q + Math.cos(ang) * r) + "px," + (pl.oy * q + Math.sin(ang) * r) + "px) scale(" + (.4 + .6 * q) + ")";
      el.style.opacity = clamp(q * 1.5 - .2, 0, 1); el.style.pointerEvents = q > .6 ? "auto" : "none";
    });
  }

  /* ================= estados ================= */
  /* ================= encaje en el campo de texto =================
     Si la pantalla tiene un botón marcado con data-sa-dock (p. ej. «Mejorar con ALMA» del Hub), el menú se encaja ahí,
     a su tamaño. Mantener presionado lo saca a uno de los 8 puntos y vuelve a ser menú.
     Encajado: 1 toque envía (el botón data-sa-dock-enviar del mismo editor; si no hay texto, hace lo del botón encajado),
     2 toques hacen lo del botón encajado (Mejorar / Redactar con ALMA) y 3 toques llaman a Alma o cuelgan. */
  var dock = { on: false, el: null, out: false, gone: 0, ox: 0, oy: 0 };
  /* ¿Se ve de verdad? El Hub pinta la conversación anterior y la siguiente justo fuera del área visible (paginador
     vertical): su botón tiene tamaño y cae dentro de la pantalla, pero queda recortado por el contenedor. Se descarta
     cualquier botón cuyo centro quede fuera de un contenedor que recorta, o dentro de algo oculto o transparente. */
  function dockShown(el, r) {
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var p = el.parentElement; p && p !== d.body && p !== d.documentElement; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (cs.display === "none" || parseFloat(cs.opacity) < .05) return false;
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        var pr = p.getBoundingClientRect();
        if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom) return false;
      }
    }
    return true;
  }
  function dockTarget() {
    var els = d.querySelectorAll("[data-sa-dock]");
    var lim = Math.max(w.innerHeight, d.documentElement.clientHeight || 0);
    for (var i = 0; i < els.length; i++) { var r = els[i].getBoundingClientRect(); if (r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < lim && dockShown(els[i], r)) return { el: els[i], r: r }; }
    return null;
  }
  /* El botón encajado vive DENTRO del botón real de la página: el navegador lo mantiene en su lugar al abrir una
     conversación, al hacer scroll o con el teclado, sin cálculos de coordenadas (en iPhone a veces quedaba arriba). */
  var hosted = false, hostKind = "";
  function hostIn() {
    if (hosted || !dock.on || !dock.el || !d.body.contains(dock.el)) return;
    var h = d.createElement("span"); h.className = "san-scope san-dockhost"; h.setAttribute("data-no-swipe", "1"); h.setAttribute("aria-hidden", "false");
    dock.el.classList.add("san-hosting"); dock.el.appendChild(h); h.appendChild(E.nav); dock.host = h; hosted = true; hostKind = "dock"; render();
  }
  /* En la ranura del encabezado: el botón vive dentro del contenedor (se mueve con la página, a su tamaño normal). */
  function slotIn(el) {
    if (hosted || !el || !d.body.contains(el)) return;
    var h = d.createElement("span"); h.className = "san-scope san-slothost"; h.setAttribute("data-no-swipe", "1"); h.style.right = (slotW() / 2) + "px";
    el.appendChild(h); h.appendChild(E.nav); dock.host = h; dock.hostEl = null; hosted = true; hostKind = "slot"; render();
  }
  function hostOut() {
    if (!hosted) return; hosted = false;
    var fr = E.face.getBoundingClientRect(), live = fr.width > 0 && d.body.contains(E.nav);
    root.appendChild(E.nav); fbOn = null;
    if (dock.host && dock.host.parentNode) dock.host.parentNode.removeChild(dock.host);
    if (dock.hostEl) dock.hostEl.classList.remove("san-hosting");
    dock.host = null; hostKind = "";
    if (live) { px.x = px.t = fr.left + fr.width / 2; py.x = py.t = fr.top + fr.height / 2; px.v = py.v = 0; }
    render(); kick();
  }
  function setDocked(on) {
    if (dock.on === on) return; if (!on) hostOut(); dock.on = on;
    d.body.classList.toggle("san-docked", on); root.classList.toggle("docked", on);
    if (on) { setS(1); E.scrim.style.opacity = "0"; } else { E.scrim.style.opacity = ""; var p = anchorPt(st.anchor); px.to(p.x, .55, .8); py.to(p.y, .55, .8); zoom.to(K(), .55, .8); }
  }
  function dockCheck() {
    if (!root) return;
    if (hosted && (!dock.host || !d.body.contains(dock.host))) { hosted = false; root.appendChild(E.nav); fbOn = null; dock.host = null; if (dock.hostEl) dock.hostEl.classList.remove("san-hosting"); var t0 = dockTarget(); if (t0) { px.x = px.t = t0.r.left + t0.r.width / 2; py.x = py.t = t0.r.top + t0.r.height / 2; } render(); }
    var t = (!root.hidden && !dragging) ? dockTarget() : null;
    slotCheck(t);
    if (!t) { if (dock.el && !dragging) { if (!dock.gone) dock.gone = Date.now(); if (Date.now() - dock.gone > 1500) { dock.el = null; dock.out = false; } } if (dock.on && !dragging) setDocked(false); }
    else {
      dock.gone = 0;
      if (t.el !== dock.el) { if (hostKind === "dock") hostOut(); dock.el = t.el; if (dockRO) { dockRO.disconnect(); dockRO.observe(t.el); } }
      if (hosted && hostKind === "dock") { if (!dock.out) return; hostOut(); }
      if (!dock.out) {
        var cx = t.r.left + t.r.width / 2 + dock.ox, cy = t.r.top + t.r.height / 2 + dock.oy, z = Math.min(t.r.width, t.r.height) / 92;
        if (!dock.on) { setDocked(true); px.to(cx, .4, .82); py.to(cy, .4, .82); zoom.to(z, .4, .8); }
        else if (Math.abs(px.t - cx) > .5 || Math.abs(py.t - cy) > .5 || Math.abs(zoom.t - z) > .01) { px.x = px.t = cx; py.x = py.t = cy; zoom.x = zoom.t = z; kick(); }
        else if (!pulling && !dragging && !AL.on && px.rest(.5) && py.rest(.5) && zoom.rest(.01)) { dock.hostEl = dock.el; hostIn(); }
        else if (false) {
          /* comprobación real: si el botón pintado no quedó sobre el destino (capas fijas desplazadas en iPhone), se corrige */
          var fr = E.face.getBoundingClientRect(), ex = cx - dock.ox - (fr.left + fr.width / 2), ey = cy - dock.oy - (fr.top + fr.height / 2);
          if (fr.width && (Math.abs(ex) > 4 || Math.abs(ey) > 4)) { dock.ox += ex; dock.oy += ey; px.x = px.t = px.t + ex; py.x = py.t = py.t + ey; kick(); }
        }
      }
    }
  }
  function slotCheck(t) {
    if (dragging || pulling || AL.on || root.hidden) return;
    var sl = (!t || dock.out) && !dock.on ? slotFor(st.anchor) : null;
    if (!sl) { if (hosted && hostKind === "slot") { hostOut(); var p = anchorPt(st.anchor); px.to(p.x, .5, .8); py.to(p.y, .5, .8); } if (slotEl) slotPull(); return; }
    slotPush(sl.el);
    if (hosted) { if (hostKind === "slot" && dock.host && dock.host.parentNode !== sl.el) hostOut(); return; }
    var cx = sl.r.right - slotW() / 2, cy = sl.r.top + sl.r.height / 2;
    if (Math.abs(px.t - cx) > .5 || Math.abs(py.t - cy) > .5) { px.to(cx, .45, .8); py.to(cy, .45, .8); }
    else if (px.rest(.5) && py.rest(.5) && zoom.rest(.01)) slotIn(sl.el);
  }
  var dockLast = 0, dockT = null, dockRaf = 0, dockMO = null, dockRO = null;
  /* a lo sumo una revisión cada 120 ms, leída dentro de un cuadro (no fuerza diseño extra) */
  var dockRafAt = 0;
  function dockSchedule() {
    if (dockRaf && Date.now() - dockRafAt > 700) { cancelAnimationFrame(dockRaf); dockRaf = 0; }   /* un cuadro que nunca llegó (app en segundo plano) */
    if (dockRaf || dockT) return;
    var wait = Math.max(0, 120 - (Date.now() - dockLast));
    dockT = setTimeout(function () { dockT = null; dockRafAt = Date.now(); dockRaf = requestAnimationFrame(function () { dockRaf = 0; dockLast = Date.now(); dockCheck(); }); }, wait);
  }
  function dockWatch() {
    if (w.MutationObserver) { dockMO = new MutationObserver(dockSchedule); dockMO.observe(d.body, { childList: true, subtree: true }); }
    if (w.ResizeObserver) dockRO = new ResizeObserver(dockSchedule);
    w.addEventListener("scroll", dockSchedule, { capture: true, passive: true });
    if (w.visualViewport) { w.visualViewport.addEventListener("resize", onResize); w.visualViewport.addEventListener("scroll", dockSchedule); }
    (function slow() { if (!root) return; dockSchedule(); setTimeout(slow, 1500); })();
    var back = function () { if (!root) return; if (dragging && !downAt) { dragging = false; } onResize(); dockSchedule(); };
    d.addEventListener("visibilitychange", function () { if (d.visibilityState === "visible") back(); });
    w.addEventListener("pageshow", back);
    d.addEventListener("focusin", function () { setTimeout(dockSchedule, 350); }); d.addEventListener("focusout", function () { setTimeout(back, 350); });
  }
  function placeScrim() { var a = st.anchor; E.scrim.dataset.e = isCorner(a) ? a : a === "bc" ? "b" : a === "tc" ? "t" : a === "ml" ? "l" : "r"; }
  function onHome() { return cfg.current === cfg.home.k; }
  /* ¿la app es de Spacio AM? (otras, como The Gentle Stoic Parent, usan el menú sin ir al Hub) */
  function spacio() { return APPS.some(function (a) { return a.k === cfg.app; }); }
  function setCoreLbl() {
    var lt = !onHome() ? cfg.home.l : (cfg.app !== "hub" && spacio() ? "Hub" : "Cerrar"); if (E.lbl.textContent !== lt) E.lbl.textContent = lt;
    var m = E.face.dataset.mode;
    E.face.setAttribute("aria-label", m === "home" ? "Ir a " + E.lbl.textContent : m === "close" ? "Cerrar" : "Abrir menú");
  }
  var surgeT = null;
  function surge() { E.core.classList.remove("surge"); void E.core.offsetWidth; E.core.classList.add("surge"); clearTimeout(surgeT); surgeT = setTimeout(function () { if (E.core) E.core.classList.remove("surge"); }, 1100); }
  function applyState(prev) {
    var s = st.S, open = s === 2 || s === 4, fan = s === 3 || s === 4;
    E.scrim.dataset.s = s;
    cancelPend(navP.concat(fanP, arm));
    arms = armsFor(st.anchor);
    arm.forEach(function (sp) { open ? sp.to(ARM_L, .78, .84) : sp.to(0, .62, 1); });
    /* la barra respira con el cambio: crece mientras se abre y se asienta con un rebote, como el botón central */
    var wasOpen = prev === 2 || prev === 4;
    if (prev && open !== wasOpen) { barS.x = 1; barS.to(1, .62, .42, open ? .95 : -.55); }
    navP.forEach(function (sp, i) { var near = (i === 1 || i === 2) ? 0 : 1; open ? later(sp, 1, 90 + near * 80, .7, .82) : later(sp, 0, (1 - near) * 60, .5, 1); });
    geo = fanGeo(st.anchor, fanEls.length, open);
    if (fan) fanP.forEach(function (sp, j) { later(sp, 1, 60 + j * 55, .72, .82); });
    else fanP.forEach(function (sp, j) { later(sp, 0, (fanP.length - 1 - j) * 35, .5, 1); });
    E.face.dataset.mode = fan ? "close" : open ? "home" : "idle"; setCoreLbl();
    if (prev !== s && prev) surge();
    E.face.setAttribute("aria-expanded", open || fan ? "true" : "false");
    E.catch.classList.toggle("on", fan);
    try { sessionStorage.setItem("sa_nav_state", JSON.stringify({ S: open ? 2 : 1, t: Date.now() })); } catch (e) {}
    armIdle();
  }
  function setS(n) { var p = st.S; if (p === n) return; st.S = n; applyState(p); }
  function openFan(mode) { var same = mode === st.fan && fanEls.length; if (!same) buildFan(mode); var t = (st.S === 2 || st.S === 4) ? 4 : 3; if (st.S !== t) setS(t); else if (!same) applyState(0); }
  var idleT = null;
  function armIdle() { clearTimeout(idleT); if (st.S === 1) return; idleT = setTimeout(function () { if (!dragging) setS(1); }, st.S === 2 ? IDLE_MS : IDLE_MS + 4000); }
  function activity() { armIdle(); try { sessionStorage.setItem("sa_nav_state", JSON.stringify({ S: st.S === 2 || st.S === 4 ? 2 : 1, t: Date.now() })); } catch (e) {} }

  /* ================= acciones ================= */
  function go(k) {
    if (k === "__tut") { setS(1); activity(); abrirTutoriales(); return; }
    var esSub = /^sub:/.test(st.fan || "") && (st.S === 3 || st.S === 4), base = String(k).split(":")[0];
    if (st.S === 3 || st.S === 4) setS(esSub ? 1 : 2);
    if (base !== cfg.current) { cfg.current = base; markCurrent(); setCoreLbl(); }
    activity();
    try { cfg.onNavigate && cfg.onNavigate(k); } catch (e) { console.error(e); }
  }
  /* ── Tutoriales (js/sa-tutoriales.js): se carga solo cuando hace falta ── */
  var tutCb = [], tutCargando = false, tutPrimera = false;
  function conTutoriales(cb) {
    if (w.SATutoriales) { cb(); return; }
    tutCb.push(cb); if (tutCargando) return; tutCargando = true;
    var s = d.createElement("script"); s.async = true; s.src = HUB + "/js/sa-tutoriales.js?v=2026-10-28a";
    s.onload = function () { var l = tutCb; tutCb = []; l.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); };
    s.onerror = function () { tutCargando = false; tutCb = []; };
    (d.head || d.documentElement).appendChild(s);
  }
  function abrirTutoriales() {
    if (typeof cfg.tutoriales === "function") { try { cfg.tutoriales(); } catch (e) { console.error(e); } return; }
    conTutoriales(function () { w.SATutoriales.centro({ app: cfg.app }); });
  }
  /* Cuando el menú se ve: el «?» flotante (si la app no tiene centro propio) y el video del botón roca
     en pantalla completa hasta que la persona lo haya visto. */
  function tutBoton(on) {
    if (typeof cfg.tutoriales === "function" || cfg.tutoriales === false) return;
    if (on) conTutoriales(function () { if (root && !root.hidden) w.SATutoriales.boton(true, cfg.app); });
    else if (w.SATutoriales) w.SATutoriales.boton(false);
  }
  function bienvenida() {
    if (!root || root.hidden) return;
    tutBoton(true);
    if (tutPrimera || cfg.bienvenida === false || cfg.tutoriales === false) return; tutPrimera = true;
    setTimeout(function () { if (root && !root.hidden) conTutoriales(function () { w.SATutoriales.primeraVez(cfg.app); }); else tutPrimera = false; }, 1600);
  }
  function goHub() {
    /* Las apps se abren desde el Hub en otra pestaña: si esta pestaña la abrió el Hub, se cierra y vuelve a él. */
    var closed = false;
    try { if (w.opener && !w.opener.closed) { w.close(); closed = w.closed; } } catch (e) {}
    setTimeout(function () { if (!w.closed && !closed) irA(HUB, false); }, 160);
  }
  function goHome() {
    if (!onHome()) { surge(); go(cfg.home.k); return; }
    if (cfg.app !== "hub" && spacio()) { goHub(); return; }
    setS(1);
  }
  function openApp(a) {
    setS(1);
    if (cfg.abrirApp) { try { if (cfg.abrirApp(a.url, a.k) !== false) return; } catch (e) {} }   // la app decide (p. ej. el panel del Hub)
    irA(a.url, cfg.app === "hub");
  }
  function nope() { E.body.animate && E.body.animate([{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "-2px 0" }, { translate: "0 0" }], { duration: 420, easing: "ease-out" }); }
  function multi() { return APPS.filter(function (a) { return a.k !== cfg.app && (!allowed || allowed.indexOf(a.k) >= 0); }).length > 0; }
  /* El enviar del mismo editor: el más cercano subiendo desde el botón encajado (el Hub pinta otras conversaciones al lado). */
  function dockEnviar() {
    for (var p = dock.el && dock.el.parentElement; p && p !== d.body; p = p.parentElement) { var b = p.querySelector("[data-sa-dock-enviar]"); if (b) return b; }
    return null;
  }
  function onDock(n) {
    activity();
    if (n >= 3) { if (AL.min || AL.on) almaEnd(false); else if (almaOk()) almaMini(); else nope(); return; }
    var b = (n === 1 && dockEnviar()) || dock.el;
    try { b.click(); } catch (e) {} surge();
  }
  function onSingle() { if (dock.on) { onDock(1); return; } activity(); if (st.S === 1) setS(2); else if (st.S === 2) goHome(); else if (st.S === 3) setS(1); else setS(2); }
  function onDouble() {
    activity();
    if (st.S === 2) { openSub(cfg.current); return; }   // estado 2: lo de adentro de la pantalla actual
    if (st.S === 3) { setS(1); return; } if (st.S === 4) { setS(2); return; }
    if (!multi()) { nope(); return; }
    openFan("apps");                                     // las apps, solo desde el estado 1
  }

  /* ================= gestos del botón central ================= */
  var pid = null, taps = 0, downAt = null, lpT = null, tapT = null, chT = null, grab = [0, 0], hist = [], prevS = 1, moved = false;
  function unCharge() { clearTimeout(chT); E.core.classList.remove("charge"); E.face.classList.remove("charge"); E.body.classList.remove("charge"); }
  function release() { clearTimeout(lpT); unCharge(); E.face.classList.remove("pressed"); E.body.classList.remove("pressed"); E.core.classList.remove("hot"); }
  function bindCore() {
    var f = E.face;
    f.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return; e.preventDefault();
      try { f.setPointerCapture(e.pointerId); } catch (x) {} pid = e.pointerId;
      f.classList.add("pressed"); E.body.classList.add("pressed"); E.core.classList.add("hot"); moved = false;
      if (hosted) { var fr0 = E.face.getBoundingClientRect(); px.x = px.t = fr0.left + fr0.width / 2; py.x = py.t = fr0.top + fr0.height / 2; px.v = py.v = 0; }
      downAt = [e.clientX, e.clientY]; grab = [e.clientX - px.x, e.clientY - py.x];
      clearTimeout(lpT); lpT = setTimeout(startDrag, LONG_MS);
      clearTimeout(chT); chT = setTimeout(function () { if (downAt && !moved) { E.core.classList.add("charge"); f.classList.add("charge"); E.body.classList.add("charge"); } }, 170);
      activity(); hideHint();
    });
    f.addEventListener("pointermove", function (e) {
      if (!downAt) return;
      if (dragging) { var x = e.clientX - grab[0], y = e.clientY - grab[1]; px.x = px.t = x; py.x = py.t = y; px.v = py.v = 0; hist.push({ x: x, y: y, t: performance.now() }); if (hist.length > 8) hist.shift(); markNear(x, y); kick(); return; }
      if ((pulling || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 10) && pullMove(e)) return;
      if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 10) { moved = true; release(); }
    });
    function up(cancel) {
      if (!downAt) return; release(); downAt = null;
      if (pulling) { pullEnd(); return; }
      if (dragging) { endDrag(); return; }
      if (cancel || moved) return;
      /* Encajado en el editor: 1 envía · 2 mejora · 3 llama o cuelga (también con la llamada en curso). */
      if (dock.on) {
        taps++; clearTimeout(tapT);
        tapT = setTimeout(function () { var n = taps; taps = 0; tapT = null; onDock(n); }, TAP_MS);
        return;
      }
      /* Triple toque (botón en reposo): Alma por voz ahí mismo, sin abrir la piedra al centro. */
      var trio = almaOk() && !AL.on && !AL.min && st.S === 1;
      if (trio) {
        taps++; clearTimeout(tapT);
        tapT = setTimeout(function () { var n = taps; taps = 0; tapT = null; if (n >= 3) almaMini(); else if (n === 2 && multi()) onDouble(); else onSingle(); }, TAP_MS);
        return;
      }
      if (dock.on || (!multi() && st.S !== 2) || st.S === 3 || st.S === 4) { onSingle(); return; }
      if (tapT) { clearTimeout(tapT); tapT = null; onDouble(); } else tapT = setTimeout(function () { tapT = null; onSingle(); }, TAP_MS);
    }
    f.addEventListener("pointerup", function () { up(false); });
    f.addEventListener("pointercancel", function () { up(true); });
    f.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); });
    ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup"].forEach(function (ev) { f.addEventListener(ev, function (e) { if (hosted) e.stopPropagation(); }, { passive: true }); });
    f.addEventListener("dblclick", function (e) { e.preventDefault(); });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (dock.on) onDock(e.shiftKey ? 2 : 1); else e.shiftKey ? onDouble() : onSingle(); }
      else if (e.altKey && /^Arrow/.test(e.key)) {
        e.preventDefault(); var r = st.anchor[0], c = st.anchor[1];
        if (e.key === "ArrowUp") r = r === "b" ? "m" : "t"; if (e.key === "ArrowDown") r = r === "t" ? "m" : "b";
        if (e.key === "ArrowLeft") c = c === "r" ? "c" : "l"; if (e.key === "ArrowRight") c = c === "l" ? "c" : "r";
        var a = r + c; if (a === "mc") return; if (r === "m") a = c === "l" ? "ml" : c === "r" ? "mr" : a; prevS = st.S; moveTo(a, 0, 0);
      }
    });
  }
  function onKey(e) { if (e.key !== "Escape" || !root) return; if (AL.on) almaEnd(false); else if (st.S !== 1) setS(1); }
  function placeDots() { E.dots.querySelectorAll(".san-dot").forEach(function (s) { var p = anchorPt(s.dataset.a); s.style.left = p.x + "px"; s.style.top = p.y + "px"; }); }
  function startDrag() {
    /* sacarlo del botón de la página mueve el nodo y el navegador suelta la captura del dedo: se vuelve a capturar */
    var was = hosted; hostOut(); if (was && pid != null) { try { E.face.setPointerCapture(pid); } catch (x) {} }
    unCharge(); E.scrim.classList.add("moving"); dragging = true; prevS = st.S; zoom.to(K(), .45, .85);
    E.face.classList.remove("pressed"); E.face.classList.add("lift"); E.body.classList.remove("pressed", "charge"); E.body.classList.add("lift"); E.core.classList.add("lifted"); d.body.classList.add("san-dragging");
    try { getSelection().removeAllRanges(); } catch (e) {}
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    st.S = 1; cancelPend(navP.concat(fanP, arm));
    arm.forEach(function (s) { s.to(0, .26, 1); }); navP.forEach(function (s) { s.to(0, .2, 1); }); fanP.forEach(function (s) { s.to(0, .2, 1); });
    E.face.dataset.mode = "idle"; E.catch.classList.remove("on");
    ptsCache = null; var pc = {}; ANCH.forEach(function (a) { pc[a] = anchorPt(a); }); ptsCache = pc;
    placeDots(); E.dots.classList.add("on"); hist = [{ x: px.x, y: py.x, t: performance.now() }]; kick();
  }
  function project(v) { var dd = .99; return (v / 1000) * dd / (1 - dd); }
  function nearest(x, y, raw) { var b = null, bd = 1e9; ANCH.forEach(function (a) { var p = anchorPt(a, raw), dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; b = a; } }); return b; }
  function markNear(x, y) {
    var n = nearest(x, y); E.dots.querySelectorAll(".san-dot").forEach(function (s) { s.classList.toggle("near", s.dataset.a === n); });
    /* acercarlo a la ranura del encabezado ya va abriendo espacio */
    var p = ptsCache && ptsCache[n]; if (p && p.slot) { var sl = slotFor(n); if (sl) slotPush(sl.el); } else if (slotEl) slotPull();
  }
  function endDrag() {
    dragging = false; E.face.classList.remove("lift"); E.body.classList.remove("lift"); E.core.classList.remove("lifted", "hot"); d.body.classList.remove("san-dragging"); E.dots.classList.remove("on");
    var a = hist[0], b = hist[hist.length - 1], dt = Math.max(16, b.t - a.t), vx = (b.x - a.x) / dt * 1000, vy = (b.y - a.y) / dt * 1000;
    if (performance.now() - b.t > 90) vx = vy = 0;
    var to = nearest(px.x + project(vx), py.x + project(vy)), pt = ptsCache && ptsCache[to]; ptsCache = null;
    if (pt && pt.dock) { E.scrim.classList.remove("moving"); redock(); if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {} return; }
    moveTo(to, vx, vy, true);
    if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
  }
  function moveTo(a, vx, vy, abrir) {
    if (dock.on || dock.el) { dock.out = true; setDocked(false); }
    zoom.to(K(), .5, .8);
    st.anchor = a; setCk("sa_nav_pos", a);
    var p = anchorPt(a); px.to(p.x, .46, .78, vx); py.to(p.y, .46, .78, vy); placeScrim();
    if (p.slot) { var sl = slotFor(a); if (sl) slotPush(sl.el); } else slotPull();
    setTimeout(dockSchedule, 700);
    setTimeout(function () { if (E.scrim) E.scrim.classList.remove("moving"); }, 250);
    var back = abrir || prevS === 2 || prevS === 4 ? 2 : 1; prevS = 1;   /* al soltarla en una de las 8 posiciones se abre el navegador */
    setTimeout(function () { if (!root) return; st.S = 0; setS(back); }, 170);
  }
  var vvRaf = 0, vvH = 0;
  function onVV() {
    if (vvRaf) return;
    vvRaf = requestAnimationFrame(function () {
      vvRaf = 0; var h = VH(); if (Math.abs(h - vvH) < 2) return; vvH = h;
      if (!root || dragging || dock.on || AL.on || pulling) return;
      insetCache = null; measureBottom(); var p = anchorPt(st.anchor); px.t = p.x; py.t = p.y; geo = fanGeo(st.anchor, fanEls.length, st.S === 2 || st.S === 4); kick();
    });
  }
  function onResize() { if (!root) return; insetCache = null;
    if (AL.vis && (AL.on || AL.esc) && !stoneDrag) { var tg = stoneTarget(); aX.to(tg.x, .5, .8); aY.to(tg.y, .5, .8); aS.to(tg.s, .5, .8); } measureBottom(); if (dock.on) { dockSchedule(); return; } if (dragging) return; zoom.x = zoom.t = K(); var p = anchorPt(st.anchor); px.x = px.t = p.x; py.x = py.t = p.y; geo = fanGeo(st.anchor, fanEls.length, st.S === 2 || st.S === 4); kick(); }

  /* El pulso (luz y tamaño) son animaciones CSS con la misma duración, montadas en el mismo instante: corren en el
     compositor, sin trabajo de JavaScript por cuadro, y siguen sincronizadas. */

  /* ================= guía de primera vez ================= */
  function hideHint() { if (E.hint && E.hint.classList.contains("on")) { E.hint.classList.remove("on"); setCk("sa_nav_hint", "1"); } }
  function showHint() {
    if (!root || root.hidden || AL.esc || getCk("sa_nav_hint")) return;
    var dt = E.hint.children[1]; if (dt) dt.style.display = multi() ? "" : "none";   /* app sin otras apps: no hay doble toque */
    var v = inward(st.anchor); E.hint.style.left = (px.t + v[0] * 76) + "px"; E.hint.style.top = (py.t + v[1] * 76) + "px";
    E.hint.dataset.side = v[1] < 0 ? "up" : v[1] > 0 ? "down" : v[0] > 0 ? "right" : "left";
    E.hint.classList.add("on"); setTimeout(hideHint, 6500);
  }

  /* ================= apps permitidas ================= */
  function loadAllowed() {
    if (cfg.apps) { allowed = cfg.apps.slice(); return; }
    allowed = [cfg.app];
    var v = w.SASesion && w.SASesion.verificar ? w.SASesion.verificar() : null;
    if (v && v.then) v.then(function (prof) {
      if (!prof || !root) return;
      var ap = prof.apps || {}, no = /^(no|0|false|-|—|ninguno|sin acceso)?$/i;
      if (typeof ap === "string") ap = ap.split(/[\s,;]+/);
      allowed = Array.isArray(ap) ? ap.map(function (k) { return String(k).toLowerCase(); }) : Object.keys(ap).filter(function (k) { return !no.test(String(ap[k] == null ? "" : ap[k]).trim()); });
      if (/admin/i.test(String(prof.rol || prof.role || ""))) allowed = APPS.map(function (a) { return a.k; });
      if (allowed.indexOf(cfg.app) < 0) allowed.push(cfg.app);
      if (st.fan === "apps") buildFan("apps");
    });
  }

  /* ================= Alma por voz =================
     Presiona el botón y deslízalo hacia el centro (antes de que se active mover): el mismo botón sube al centro
     convertido en la piedra y empieza la conversación de voz. La app da el proveedor en cfg.alma:
       { prepare(): adelanta la conexión, start(h): Promise<{ end(), level(), sendText(t), chat(on) }> }
     h = { status(texto), message(origen 'ai'|'user', texto), ended(), error(texto) }. */
  var AL = { on: false, min: false, chat: false, ses: null, vis: false, built: false, breath: 0, loop: false };
  /* Gelatina de la voz: J.v tamaño extra (resorte poco amortiguado que sigue la envolvente de la voz),
     J.w deformación (bamboleo) que se dispara en cada pico o subida brusca de la voz. */
  var J = { env: 0, slow: 0, v: 0, vv: 0, w: 0, wv: 0, ang: 0, lt: 0, pk: 0, p: 0 };
  function jReset() { J.env = J.slow = J.v = J.vv = J.w = J.wv = 0; J.lt = 0; }
  function jStep(t, lv) {
    var dt = J.lt ? Math.min(.05, (t - J.lt) / 1000) : .016; J.lt = t;
    var pe = J.env;
    J.env += (lv - J.env) * (lv > J.env ? .55 : .1);          /* sube rápido, baja suave */
    J.slow += (lv - J.slow) * .04;
    if (lv - J.slow > .16 && t - J.pk > 150) {                  /* pico: golpe de rebote + bamboleo */
      var g = Math.min(1, lv - J.slow); J.pk = t;
      J.vv += 1.7 * g; J.wv += (Math.random() < .5 ? -1 : 1) * 3.2 * g; J.ang = Math.random() * Math.PI;
    }
    J.wv += (J.env - pe) * 9;                                   /* las subidas también estiran */
    var wn = 2 * Math.PI / .34, k = wn * wn, c = 2 * .36 * wn;  /* tamaño: gelatina con rebote */
    J.vv += (-k * (J.v - J.env * .15) - c * J.vv) * dt; J.v += J.vv * dt;
    var wn2 = 2 * Math.PI / .24, k2 = wn2 * wn2, c2 = 2 * .22 * wn2;
    J.wv += (-k2 * J.w - c2 * J.wv) * dt; J.w += J.wv * dt;
    if (J.v > .2) { J.v = .2; if (J.vv > 0) J.vv *= -.3; }
    if (J.v < -.025) { J.v = -.025; if (J.vv < 0) J.vv *= -.4; }     /* nunca más chica que su tamaño en reposo */
    J.w = clamp(J.w, -.09, .09);
    J.p = (1 - Math.cos(2 * Math.PI * ((t % PULSE) / PULSE))) / 2;
  }
  var PULL_MIN = 14, PULL_GO = 88, PULL_END = 70, pulling = 0, pullAlong = 0, pullS = null;
  var aX, aY, aS, aSq, aDX, aDY, aL, aH;

  /* ================= anillo (QRing / Colmi en modo «Touch Control») =================
     El anillo no tiene un botón que la página pueda leer: se comporta como un dedo invisible que toca SIEMPRE el mismo
     punto de la pantalla. Un dedo nunca cae dos veces en el mismo píxel; el anillo sí. Se aprende ese punto solo (tres
     toques idénticos seguidos) y desde entonces los toques en ese punto son del anillo: no tocan la página y controlan
     a Alma. Por app y por equipo (localStorage). SANav.anillo(false) lo olvida; SANav.anillo(true) vuelve a aprender.
       sin llamada ....... 1 toque: menú · 2 toques: apps · 3 toques: Alma por voz minimizada · deslizar: 8 posiciones
       menú abierto ...... ↑↓ marcan una opción (dan la vuelta, no salen) · 2 toques: abre sus opciones o entra · 1 toque: cierra
       opciones abiertas . ↑↓ marcan (dan la vuelta) · 2 toques: abre la marcada · 1 toque: vuelve a la barra
       Alma minimizada ... deslizar ↑: al centro (luego ↑↓ la mueven) · 1 toque: al centro · 2 toques: termina
       Alma al centro .... deslizar ↓: termina · deslizar ↑: se minimiza arriba · 1 toque: pausa el micrófono */
  var RING = { pt: null, prev: [], taps: 0, tT: null, on: false, aprender: false };
  function anilloCargar() { try { var v = JSON.parse(localStorage.getItem("sa_anillo") || "null"); if (v && v.fx >= 0 && v.fy >= 0) RING.pt = v; } catch (x) {} }
  function anilloPunto() { return RING.pt ? { x: RING.pt.fx * VW(), y: RING.pt.fy * VH() } : null; }
  function anilloEs(t) { var p = anilloPunto(); return !!p && Math.abs(t.clientX - p.x) <= 4 && Math.abs(t.clientY - p.y) <= 4; }
  /* Al deslizar, el anillo empieza en la misma columna exacta pero puede caer unos píxeles más arriba o abajo. */
  function anilloInicio(t) { var p = anilloPunto(); return !!p && Math.abs(t.clientX - p.x) <= 1.5 && Math.abs(t.clientY - p.y) <= 40; }
  /* Recorrido de las 8 posiciones con el anillo, como lo pensó Juan: «arriba» sube por los lados y en el borde de arriba
     va y viene entre el centro y la esquina izquierda; «abajo» baja por los lados y en el borde de abajo va y viene entre
     el centro y la esquina derecha. Ej.: esquina sup. derecha ↑ centro sup. ↑ esquina sup. izq.; ahí ↓ baja y ↑ vuelve
     a la derecha. */
  var RING_SUBE = { tl: "tc", tc: "tl", tr: "tc", ml: "tl", mr: "tr", bl: "ml", bc: "bl", br: "mr" };
  var RING_BAJA = { tl: "ml", tc: "tr", tr: "mr", ml: "bl", mr: "br", bl: "bc", bc: "br", br: "bc" };
  /* Recorrido alrededor de la pantalla: ↓ en el sentido del reloj, ↑ en contra. */
  var RING_RELOJ = ["tl", "tc", "tr", "mr", "br", "bc", "bl", "ml"];
  function anilloMover(dir) {
    activity();
    var i = RING_RELOJ.indexOf(st.anchor); if (i < 0) i = 5;
    var a = RING_RELOJ[(i + (dir === "down" ? 1 : RING_RELOJ.length - 1)) % RING_RELOJ.length];
    prevS = st.S; if (st.S !== 1) setS(1); moveTo(a, 0, 0);
    if (AL.min) { var v = inward(a), p = anchorPt(a); phShow("Alma sigue contigo aquí", p.x + v[0] * 90, p.y + v[1] * 90, 1600); }
  }
  function anilloAprende(t) {
    var n = performance.now(); RING.prev.push({ x: t.clientX, y: t.clientY, t: n }); RING.prev = RING.prev.filter(function (q) { return n - q.t < 5000; }).slice(-3);
    if (RING.prev.length < 3) return false;
    var a = RING.prev[0], ok = RING.prev.every(function (q) { return Math.abs(q.x - a.x) <= .6 && Math.abs(q.y - a.y) <= .6; });
    if (!ok) return false;
    RING.pt = { fx: a.x / VW(), fy: a.y / VH() }; RING.prev = []; RING.aprender = false;
    try { localStorage.setItem("sa_anillo", JSON.stringify(RING.pt)); } catch (x) {}
    if (navigator.vibrate) try { navigator.vibrate([6, 40, 6]); } catch (x) {}
    phShow("Anillo listo · 1 toque: menú · 3 toques: Alma", VW() / 2, Math.max(60, a.y - 70), 3600);
    return true;
  }
  /* Toques: 1 = menú · 2 = apps · 3 = Alma por voz minimizada. En llamada al centro, 1 toque pausa el micrófono;
     con Alma minimizada, 1 toque la trae al centro y 2 terminan. */
  /* ── Navegar dentro del menú con el anillo (jerarquía: barra de pantallas → «Más» / apps) ──
     ↑ / ↓ cambian la opción marcada · 1 toque entra (abre la pantalla o despliega «Más») · 2 toques regresan un nivel ·
     doble ↓ (dos deslizar hacia abajo seguidos) vuelve siempre al estado 1. */
  function anilloNivel() { return st.S === 3 || st.S === 4 ? "fan" : st.S === 2 ? "bar" : ""; }
  function anilloLista() { return anilloNivel() === "fan" ? fanEls : anilloNivel() === "bar" ? itemEls : []; }
  function anilloFoco(i) {
    root.querySelectorAll(".san-foco").forEach(function (b) { b.classList.remove("san-foco"); });
    if (i < 0) { RING.foco = -1; RING.nivel = ""; return; }
    var L = anilloLista(); if (!L.length) { RING.foco = -1; return; }
    RING.foco = ((i % L.length) + L.length) % L.length; RING.nivel = anilloNivel();
    var b = L[RING.foco] && L[RING.foco].firstChild; if (b) b.classList.add("san-foco");
  }
  function anilloFocoInicial() {
    var i = 0;
    if (anilloNivel() === "bar") shown.forEach(function (it, j) { if (it.k === cfg.current) i = j; });
    setTimeout(function () { anilloFoco(i); }, 30);
  }
  function anilloMenuMover(dir) { activity(); if (RING.nivel !== anilloNivel()) { anilloFocoInicial(); return; } var n = anilloLista().length || 1; anilloFoco(((RING.foco < 0 ? 0 : RING.foco) + (dir === "down" ? 1 : -1) + n) % n); }   // da la vuelta en los dos sentidos
  function anilloMenuEntrar() {
    activity(); var nv = anilloNivel(), i = RING.foco < 0 ? 0 : RING.foco;
    if (nv === "bar") {
      var it = shown[i]; if (!it) return;
      if (it.k === "__more") { openFan("more"); anilloFocoInicial(); return; }
      go(it.k); setS(1); anilloFoco(-1); return;
    }
    if (nv === "fan") { var f = fanList[i]; if (!f) return; var wasMore = st.fan === "more"; f.tap(); if (wasMore && st.S !== 1) setS(1); anilloFoco(-1); }
  }
  /* Estado 2 con el anillo: doble toque sobre la opción marcada abre sus opciones en abanico (sin opciones: se sacude). */
  function anilloSub() {
    var i = RING.nivel === "bar" && RING.foco >= 0 ? RING.foco : -1, it = i >= 0 ? shown[i] : null, k = it ? it.k : cfg.current;
    if (k !== "__more" && !subDe(k)) { go(k); setS(1); anilloFoco(-1); return; }   // sin opciones de adentro: entra directo
    if (openSub(k)) anilloFocoInicial();
  }
  function anilloMenuAtras() {
    activity();
    if (st.S === 4) { setS(2); anilloFocoInicial(); return; }
    setS(1); anilloFoco(-1);
  }
  function anilloAccion(n) {
    activity();
    /* Menú abierto con el anillo: 2 toques abren (en la barra, las opciones de adentro; en un abanico, la opción marcada),
       1 toque cierra (el abanico vuelve a la barra; la barra, al reposo). */
    if (!AL.on && !AL.min && st.S !== 1) { if (n >= 2) { if (st.S === 2) anilloSub(); else anilloMenuEntrar(); } else anilloMenuAtras(); return; }
    if (AL.on && !AL.chat) {
      if (n !== 1) return;
      AL.mudo = !AL.mudo; if (AL.ses && AL.ses.mute) { try { AL.ses.mute(AL.mudo); } catch (x) {} }
      status(AL.mudo ? "Micrófono en pausa · toca el anillo para seguir" : "Te escucho"); surge(); return;
    }
    if (AL.on && AL.chat) { if (n === 1) almaChat(false); return; }
    if (dock.on) { onDock(n); return; }   // encajado en el editor: los mismos 1 · 2 · 3 toques que con el dedo
    if (AL.min) { if (n === 1) { RING.rotar = false; almaOpen(); } else if (n === 2) almaEnd(false); return; }
    if (n >= 3) { if (almaOk()) { RING.rotar = false; almaMini(); } return; }
    if (n === 2) { onDouble(); anilloFocoInicial(); } else { onSingle(); anilloFocoInicial(); }
  }
  /* Deslizar: con Alma al centro, abajo termina y arriba la minimiza arriba (al centro superior) para seguir moviéndola;
     con Alma recién minimizada (triple toque), arriba la lleva al centro; en lo demás, mueve el botón por las 8 posiciones. */
  function anilloSwipe(dir) {
    activity();
    /* Con un menú abierto: ↑ / ↓ cambian la opción y dan la vuelta dentro de las que hay; nunca salen del menú. */
    if (!AL.on && !AL.min && st.S !== 1) { anilloMenuMover(dir); return; }
    if (AL.on) { if (dir === "down") almaEnd(false); else { RING.rotar = true; minimizarEn("tc", 0, 0, false); } return; }
    if (AL.min && !RING.rotar && dir === "up") { almaOpen(); return; }
    anilloMover(dir);
  }
  /* Firma del anillo medida en el iPhone de Juan: su «dedo» es ancho (pointer width ~93 px, radio ~47; un dedo ~24 / 12).
     Un toque baja y sube en el mismo punto; al deslizar no hay arrastre: baja en un punto y SUBE ~140 px más arriba (↑) o
     más abajo (↓). Se reconoce por eso (o por el punto aprendido, de respaldo) y nunca llega a la página. */
  function anilloAncho(e) { return e.pointerType === "touch" && (e.width || 0) >= 60; }
  function anilloBind() {
    if (RING.on) return; RING.on = true; anilloCargar();
    var tapa = function (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); };
    w.addEventListener("pointerdown", function (e) {
      if (!root || RING.aprender) return;
      if (anilloAncho(e) || (RING.pt && e.pointerType === "touch" && anilloInicio(e))) { tapa(e); RING.dentro = true; RING.y0 = e.clientY; RING.pid = e.pointerId; }
    }, true);
    w.addEventListener("pointermove", function (e) { if (RING.dentro && e.pointerId === RING.pid) tapa(e); }, true);
    ["pointerup", "pointercancel"].forEach(function (ev) {
      w.addEventListener(ev, function (e) {
        if (!RING.dentro || e.pointerId !== RING.pid) return; tapa(e); RING.dentro = false; RING.hasta = Date.now() + 600;
        if (ev === "pointercancel") return;
        var dy = e.clientY - RING.y0;
        /* Deslizar: mueve la roca (o entra / sale de Alma); nunca hace scroll en la página. */
        if (Math.abs(dy) > 50) { clearTimeout(RING.tT); RING.taps = 0; anilloSwipe(dy > 0 ? "down" : "up"); return; }
        RING.taps++; clearTimeout(RING.tT);
        RING.tT = setTimeout(function () { var n = RING.taps; RING.taps = 0; anilloAccion(n); }, 380);
      }, true);
    });
    ["touchstart", "touchmove", "touchend"].forEach(function (ev) {
      d.addEventListener(ev, function (e) {
        var t = (e.changedTouches || e.touches || [])[0];
        if (RING.dentro || (t && (t.radiusX || 0) >= 30) || Date.now() < (RING.hasta || 0)) { tapa(e); return; }
        if (ev === "touchstart" && root && e.touches.length === 1) anilloAprende(e.touches[0]);
      }, { capture: true, passive: false });
    });
    /* Por si el navegador igual manda el clic del toque del anillo. */
    d.addEventListener("click", function (e) { if (Date.now() < (RING.hasta || 0)) tapa(e); }, true);
  }
  function almaOk() { return !!(cfg && cfg.alma && cfg.alma.start); }
  /* hacia dónde queda «el centro» desde donde está el botón (encajado puede estar en cualquier lado) */
  function towardCenter() { if (!dock.on) return inward(st.anchor); var dx = VW() / 2 - px.x, dy = VH() * .42 - py.x, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
  /* ¿se puede volver a encajar? hay botón de Alma en pantalla y el menú está fuera */
  function canRedock() { return !!(dock.el && dock.out && !dock.on && !AL.min && !AL.on); }
  var pv = [0, -1], pullT0 = 0;
  function rubber(x, lim) { return lim * (1 - Math.exp(-x / lim)); }
  function pullRender() {
    var v = pv, x = pullS.x, a = Math.abs(x), t = (x < 0 ? -1 : 1) * rubber(a, 26), lim = x < 0 ? PULL_END : PULL_GO;
    E.core.style.translate = (v[0] * t).toFixed(2) + "px " + (v[1] * t).toFixed(2) + "px";
    var ax = Math.abs(v[0]), ay = Math.abs(v[1]), s = .045 * clamp(a / lim, 0, 1.3);
    E.body.style.scale = (1 + s * ax - s * .45 * ay).toFixed(4) + " " + (1 + s * ay - s * .45 * ax).toFixed(4);
    E.core.style.setProperty("--pull", (x > 0 ? clamp(x / PULL_GO, 0, 1.2) : 0).toFixed(3));
  }
  function pullClear() { if (E.core.style.translate) { E.core.style.translate = ""; if (!AL.min) E.body.style.scale = ""; E.core.style.setProperty("--pull", "0"); } }
  function phShow(txt, x, y, ms) {
    E.ph.textContent = txt; var hw = (E.ph.offsetWidth || 240) / 2 + 10; E.ph.style.left = clamp(x, hw, VW() - hw) + "px"; E.ph.style.top = clamp(y, 30, VH() - 30) + "px"; E.ph.classList.add("on");
    clearTimeout(E.ph._t); if (ms) E.ph._t = setTimeout(function () { if (!pulling) E.ph.classList.remove("on"); }, ms);
  }
  function pullMove(e) {
    var dx = e.clientX - downAt[0], dy = e.clientY - downAt[1];
    if (pulling === 2 || (!pulling && canRedock())) {
      /* menú → volver a encajarlo en el botón de Alma: lanzarlo hacia abajo (o hacia su borde) */
      var vi = inward(st.anchor), aw = -(dx * vi[0] + dy * vi[1]), down = st.anchor[0] !== "t" && dy > 0 && Math.abs(dx) < dy * .9;
      var mag = down ? dy : (aw > 0 && Math.abs(dx * vi[1] - dy * vi[0]) < aw * .9 ? aw : 0);
      if (!pulling) { if (mag > PULL_MIN) { pulling = 2; pullT0 = performance.now(); release(); clearTimeout(tapT); tapT = null; } else if (!almaOk() || !(dx * vi[0] + dy * vi[1] > 0)) return false; }
      if (pulling === 2) {
        var l = Math.hypot(dx, dy) || 1; pv = [dx / l, dy / l]; pullAlong = l; pullS.x = pullS.t = l; pullS.v = 0;
        var fast = l > 26 && l / Math.max(1, performance.now() - pullT0) > .55, go = l >= 64 || fast;
        if (go) phShow("Suelta para volver al botón de Alma", px.x + pv[0] * 90, py.x + pv[1] * 90); else E.ph.classList.remove("on");
        kick(); return true;
      }
    }
    if (!almaOk() && !AL.min) return false;
    var v = towardCenter(), along = dx * v[0] + dy * v[1], perp = Math.abs(dx * v[1] - dy * v[0]);
    if (!pulling) {
      if (along > PULL_MIN && perp < along * .9) pulling = 1;
      else if (AL.min && along < -PULL_MIN && perp < -along * .9) pulling = -1;
      else return false;
      pv = v;
      release(); clearTimeout(tapT); tapT = null;
      if (pulling > 0 && !AL.min && cfg.alma.prepare) { try { cfg.alma.prepare(); } catch (x) {} }
    }
    pullAlong = along; pullS.x = pullS.t = pulling > 0 ? Math.max(0, along) : Math.min(0, along); pullS.v = 0;
    var go = pulling > 0 ? along >= PULL_GO : along <= -PULL_END, k = pulling > 0 ? 96 : -90;
    if (go) phShow(pulling > 0 ? (AL.min ? "Suelta para volver con Alma" : "Suelta para hablar con Alma") : "Suelta para terminar con Alma", px.x + v[0] * k, py.x + v[1] * k);
    else E.ph.classList.remove("on");
    if (go && !pullMove.buzz) { pullMove.buzz = 1; if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) {} } if (!go) pullMove.buzz = 0;
    kick(); return true;
  }
  function pullEnd() {
    var dir = pulling, go = dir === 2 ? (pullAlong >= 64 || (pullAlong > 26 && pullAlong / Math.max(1, performance.now() - pullT0) > .55)) : dir > 0 ? pullAlong >= PULL_GO : pullAlong <= -PULL_END;
    pulling = 0; pullAlong = 0; E.ph.classList.remove("on"); pullS.to(0, .5, .62); moved = true;
    if (go && dir === 2) redock();
    else if (go && dir > 0) almaOpen(); else if (go && dir < 0) almaEnd(false);
  }
  function redock() {
    dock.out = false; dock.gone = 0; setS(1);
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {}
    dockCheck(); if (!dock.on) dockSchedule();
  }

  function almaBuild() {
    if (AL.built) return; AL.built = true;
    var ov = d.createElement("div"); ov.className = "san-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Alma");
    ov.innerHTML = '<div class="san-ov-bg"></div><div class="san-rock" aria-label="Alma"><span class="san-st-glow"></span><span class="san-st-ring"></span><div class="san-st-body"><div class="san-st-lit"></div></div><div class="san-st-rim"></div><div class="san-st-spark">' + SPARK + '</div></div>' +
      '<div class="san-ov-ui"><div class="san-ov-st"></div><div class="san-ov-cap" aria-live="polite"></div><div class="san-ov-btns">' +
      '<button type="button" class="san-ob" data-a="chat" aria-label="Pasar a chat">' + svg(P.chat, 21) + '<span>Chat</span></button>' +
      '<button type="button" class="san-ob end" data-a="end" aria-label="Terminar">' + svg('<path d="M6 6l12 12M18 6L6 18"/>', 21) + '<span>Terminar</span></button></div>' +
      '<div class="san-ov-tip">Mantén la piedra para minimizarla · desliza hacia abajo para terminar</div></div>' +
      '<div class="san-chat"><header><div class="asa"></div><div class="t"><b>Alma</b><small>Modo texto · te leo</small></div></header><div class="san-msgs"></div>' +
      '<div class="san-vacio"><h3>¿En qué te ayudo?</h3><p>Escríbeme, mándame una foto o una nota de voz.</p><div class="san-sug">' +
      '<button type="button" data-s="¿Qué hay hoy?" data-y="1">¿Qué hay hoy?</button><button type="button" data-s="Crea una tarea para ">Crea una tarea</button>' +
      '<button type="button" data-s="Escríbele a ">Escríbele a alguien</button><button type="button" data-s="Dile a Claude que ">Mejorar el sistema</button></div></div>' +
      '<form><button type="button" class="san-clip" aria-label="Mandar una foto">' + svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/>', 20) + '</button>' +
      '<textarea class="san-in" rows="1" placeholder="Escríbele a Alma…" autocomplete="off" aria-label="Mensaje para Alma"></textarea><span class="san-graba">Te escucho… suelta para enviar</span>' +
      '<button type="button" class="san-send" aria-label="Alma · un toque envía, mantén para una nota de voz, dos toques para una foto, tres para hablar"></button>' +
      '<div class="san-tips" aria-hidden="true"><span><b>1 toque</b>enviar</span><span><b>mantén</b>nota de voz</span><span><b>2 toques</b>foto</span><span><b>3 toques</b>hablar</span></div>' +
      '<input type="file" accept="image/*" hidden class="san-file"></form></div>';
    root.appendChild(ov);
    E.ov = ov; E.stone = ov.querySelector(".san-rock"); E.ost = ov.querySelector(".san-ov-st"); E.cap = ov.querySelector(".san-ov-cap"); E.msgs = ov.querySelector(".san-msgs");
    aX = S(0, true); aY = S(0, true); aS = S(0, true); aSq = S(0); aDX = S(0, true); aDY = S(0, true); aL = S(.06); aH = S(.5);
    ov.querySelector('[data-a="end"]').onclick = function () { almaEnd(false); };
    ov.querySelector('[data-a="chat"]').onclick = function () { if (AL.esc && !AL.on) escActivar(true); else almaChat(true); };
    chatBind(ov);
    ov.querySelector(".san-ov-bg").onclick = function () { if (!AL.chat && !stoneDrag && !AL.esc) almaEnd(false); };
    bindStone();
  }
  /* El chat: textarea que crece, sugerencias, foto y el botón roca (1 toque envía · mantener = nota de voz · 2 toques = foto). */
  /* Chat sin actividad CHAT_INACTIVO_MS (3 min): la conversación termina sola (Alma no se queda preguntando «¿sigues ahí?»). */
  var CHAT_INACTIVO_MS = 180000, chatT = 0;
  function chatQuieto() { clearTimeout(chatT); if (AL.chat) chatT = setTimeout(function () { if (AL.chat && (AL.on || AL.min)) almaEnd(false); }, CHAT_INACTIVO_MS); }
  function chatEnviar(v) {
    v = String(v || "").trim(); if (!v) return false; addMsg(v, "u"); chatQuieto();
    if (AL.ses && AL.ses.sendText) { try { AL.ses.sendText(v); } catch (x) {} } else AL.cola = v;   // aún conectando: va en cuanto conecte
    return true;
  }
  function chatBind(ov) {
    var f = ov.querySelector("form"), i = ov.querySelector(".san-in"), b = ov.querySelector(".san-send"), tips = ov.querySelector(".san-tips"), file = ov.querySelector(".san-file"), clip = ov.querySelector(".san-clip");
    var fotoOk = !!(w.ALMA && w.ALMA.almaFoto); clip.hidden = !fotoOk;
    var crecer = function () { i.style.height = "46px"; i.style.height = Math.min(140, i.scrollHeight) + "px"; };
    var enviar = function () { if (chatEnviar(i.value)) { i.value = ""; crecer(); } else verTips(); };
    var tipT = 0, verTips = function (ms) { tips.classList.add("on"); clearTimeout(tipT); tipT = setTimeout(function () { tips.classList.remove("on"); }, ms || 2600); };
    i.addEventListener("input", crecer);
    i.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !/iPhone|iPad|Android/.test(navigator.userAgent)) { e.preventDefault(); enviar(); } });
    i.addEventListener("focus", function () { var n = 0; try { n = +localStorage.getItem("san_tips") || 0; localStorage.setItem("san_tips", n + 1); } catch (x) {} if (n < 3) verTips(3200); });
    f.onsubmit = function (e) { e.preventDefault(); enviar(); };
    /* deslizar la cabecera hacia abajo cierra el chat */
    var hd = ov.querySelector(".san-chat header"), y0 = null;
    hd.addEventListener("pointerdown", function (e) { y0 = e.clientY; });
    hd.addEventListener("pointerup", function (e) { if (y0 != null && e.clientY - y0 > 70) almaEnd(false); y0 = null; });
    /* la roca sigue al lugar de enviar (teclado que sube, texto que crece) */
    var fija = function () { if (!AL.chat) return; var t = stoneTarget(); aX.to(t.x, .25, 1); aY.to(t.y, .25, 1); aS.to(t.s, .25, 1); };
    if (w.visualViewport) { w.visualViewport.addEventListener("resize", fija); w.visualViewport.addEventListener("scroll", fija); }
    i.addEventListener("input", function () { setTimeout(fija, 0); });
    i.addEventListener("focus", function () { setTimeout(fija, 350); });
    Array.prototype.forEach.call(ov.querySelectorAll(".san-sug button"), function (x) {
      x.onclick = function () { var t = x.getAttribute("data-s"); if (x.getAttribute("data-y")) { chatEnviar(t); return; } i.value = t; crecer(); try { i.focus(); i.setSelectionRange(t.length, t.length); } catch (e) {} };
    });
    /* nota de voz: mientras mantienes la roca, Alma te escucha (el micrófono de la conversación); al soltar, responde por escrito */
    var hold = 0, grabando = false, toques = 0, toqT = 0;
    var empezar = function () { grabando = true; f.classList.add("grabando"); b.classList.add("graba"); tips.classList.remove("on"); if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {}
      if (AL.ses && AL.ses.nota) { try { AL.ses.nota(true); } catch (x) {} } };
    var parar = function () { grabando = false; f.classList.remove("grabando"); b.classList.remove("graba");
      setTimeout(function () { if (AL.ses && AL.ses.nota) { try { AL.ses.nota(false); } catch (x) {} } }, 700); };
    b.addEventListener("pointerdown", function (e) { e.preventDefault(); clearTimeout(hold); aSq.to(1, .22, 1); hold = setTimeout(empezar, 380); });
    b.addEventListener("pointerup", function (e) {
      e.preventDefault(); clearTimeout(hold); aSq.to(0, .5, .55); if (grabando) { parar(); return; }
      toques++; clearTimeout(toqT);
      toqT = setTimeout(function () { var n = toques; toques = 0;
        if (n >= 3) almaChat(false); else if (n === 2) { if (fotoOk) file.click(); else verTips(); } else enviar(); }, 300);
    });
    b.addEventListener("pointercancel", function () { clearTimeout(hold); aSq.to(0, .5, .55); if (grabando) parar(); });
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    clip.onclick = function () { file.click(); };
    file.onchange = function () { var x = file.files && file.files[0]; file.value = ""; if (x) chatFoto(x, i); };
  }
  function chatFoto(archivo, i) {
    var r = new FileReader();
    r.onload = function () {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = d.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); var du = c.toDataURL("image/jpeg", .8);
        var m = d.createElement("div"); m.className = "san-m u foto"; var img = d.createElement("img"); img.src = du; img.alt = "Foto"; m.appendChild(img); E.msgs.appendChild(m);
        var nota = i.value.trim(); if (nota) { i.value = ""; addMsg(nota, "u"); }
        var info = d.createElement("div"); info.className = "san-m info"; info.textContent = "Alma está viendo la foto…"; E.msgs.appendChild(info); E.msgs.scrollTop = E.msgs.scrollHeight;
        w.ALMA.almaFoto(du).then(function (j) {
          info.remove();
          var desc = j && j.ok && j.texto ? j.texto : "";
          var t = "[Te mando una foto" + (desc ? ". Lo que se ve: " + desc : ", pero no pude describirla") + "]" + (nota ? " " + nota : "");
          if (AL.ses && AL.ses.sendText) { try { AL.ses.sendText(t); } catch (x) {} } else AL.cola = t;
        }, function () { info.textContent = "No pude mandar la foto. Intenta de nuevo."; });
      };
      im.src = r.result;
    };
    r.readAsDataURL(archivo);
  }
  function stoneTarget() { var eo = AL.esc ? AL.escO : null; if (AL.chat) { var sb = E.ov && E.ov.querySelector(".san-send"), rb = sb && sb.getBoundingClientRect(); if (rb && rb.width) return { x: rb.left + rb.width / 2, y: rb.top + rb.height / 2, s: 46 }; return { x: VW() - 40, y: VH() - 44, s: 46 }; }
    return { x: VW() / 2, y: VH() * (eo && eo.y || .42), s: Math.min(VW() * .66, VH() * .4, eo && eo.s || 270) }; }
  function faceD() { return 74 * zoom.x; }
  function stoneRender() {
    var dx = aDX.x, dy = aDY.x, dd = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), st2 = Math.min(.05, dd / 1100);
    var D = Math.max(0, aS.x * (1 - .035 * aSq.x) * (AL.on ? 1 + .02 * J.p + J.v : 1));
    /* Tamaño: mientras crece o se encoge se cambia el tamaño real (anillo y halo quedan exactos); quieta, la respiración
       va por transform (sin recalcular el diseño ni repintar las máscaras en cada cuadro). */
    var s = E.stone.style, Ds = E.stone._D || 0;
    if (!Ds || Math.abs(aS.v) > 4 || Math.abs(D - Ds) / Ds > .08) { Ds = E.stone._D = D; s.width = s.height = D + "px"; s.marginLeft = s.marginTop = (-D / 2) + "px"; }
    var kD = D / Ds;
    var jw = AL.on ? J.w : 0;
    s.transform = "translate(" + (aX.x + dx) + "px," + (aY.x + dy) + "px) rotate(" + ang + "rad) scale(" + (1 + st2) + "," + (1 - st2 * .6) + ") rotate(" + (-ang) + "rad)" +
      (jw ? " rotate(" + J.ang.toFixed(3) + "rad) scale(" + (1 + jw).toFixed(4) + "," + (1 - jw * .85).toFixed(4) + ") rotate(" + (-J.ang).toFixed(3) + "rad)" : "") +
      (Math.abs(kD - 1) > .0005 ? " scale(" + kD.toFixed(4) + ")" : "");
    /* Sombras según el tamaño: en el menú (74 px) más claras, en grande (voz, ~270 px) completas; cambian suave con la piedra. */
    E.stone.style.setProperty("--sombra", clamp(.6 + .4 * (D - 74) / 196, .6, 1).toFixed(3));
    E.stone.style.setProperty("--lit", (aL.x + .3 * AL.bth + aSq.x * .15 + (AL.on ? J.v * 1.6 : 0)).toFixed(3));
    E.stone.style.setProperty("--halo", clamp(aH.x * (.72 + .3 * AL.bth + (AL.on ? J.v * 2.2 : 0)), 0, 1.5).toFixed(3));
  }
  /* respiración de la piedra: el mismo ciclo del menú más el volumen real de la voz de Alma (solo mientras hay llamada) */
  function almaLoop(t) {
    if (!AL.vis && !AL.min) { AL.loop = false; return; }
    var lv = 0; if (AL.ses && AL.ses.level) { try { lv = clamp((AL.ses.level() || 0) * 2.6, 0, 1); } catch (x) {} }
    jStep(t, lv); AL.breath = J.env;
    AL.bth = .55 * J.p + J.env * .7;
    if (AL.vis) stoneRender();
    if (AL.min) { E.core.style.setProperty("--voice", AL.breath.toFixed(3)); if (!pulling && !pullS.x) { var bs = 1 + .015 * J.p + J.v * .75; E.body.style.scale = (bs + J.w * .8).toFixed(4) + " " + (bs - J.w * .7).toFixed(4); } }
    requestAnimationFrame(almaLoop);
  }
  function almaLoopOn() { if (!AL.loop) { AL.loop = true; AL.bth = 0; jReset(); requestAnimationFrame(almaLoop); } }
  /* Brillo interno que tiene el botón ahora (la piedra arranca y termina con el mismo, sin salto al cambiar de objeto). */
  function litFace() { try { return (+getComputedStyle(E.face.querySelector(".san-lit")).opacity || .06) / .5; } catch (x) { return .12; } }
  /* El cambio piedra → botón se hace cuando la piedra ya terminó su rebote (no a un tiempo fijo, que cortaba el rebote). */
  function alReposo(list, cb, max) {
    var t0 = performance.now();
    (function chk() {
      if (list.every(function (sp) { return Math.abs(sp.x - sp.t) < .6 && Math.abs(sp.v) < 25; }) || performance.now() - t0 > (max || 1500)) cb();
      else requestAnimationFrame(chk);
    })();
  }
  /* La respiración deja el botón a otra escala: vuelve a 1 con un rebote corto en vez de saltar. */
  function suelta(el) {
    if (!el || !el.style.scale) return;
    el.style.transition = "transform .55s cubic-bezier(.3,1.25,.55,1),scale .5s cubic-bezier(.3,1.35,.55,1)"; el.style.scale = "";
    clearTimeout(el._sT); el._sT = setTimeout(function () { el.style.transition = ""; }, 560);
  }
  function showStone(on) { AL.vis = on; E.stone.style.visibility = on ? "visible" : "hidden"; if (on) almaLoopOn(); }
  function hideCore(h) { E.face.style.visibility = h ? "hidden" : ""; E.core.querySelector(".san-led").style.opacity = h ? "0" : ""; }
  function status(t) { if (E.ost) E.ost.textContent = t || ""; }
  function caption(t) { t = String(t).replace(/\[[^\]\n]{1,40}\]/g, "").replace(/\s{2,}/g, " ").trim(); if (!t) return; E.cap.classList.add("in"); E.cap.textContent = t; void E.cap.offsetWidth; E.cap.classList.remove("in"); }
  function addMsg(t, who) { var m = d.createElement("div"); m.className = "san-m " + who; m.textContent = t; E.msgs.appendChild(m); E.msgs.scrollTop = E.msgs.scrollHeight; }

  function almaOpen() {
    if (AL.on) return; almaBuild(); var resume = AL.min;
    AL.on = true; AL.min = false; AL.chat = false; AL.mudo = false; E.ov.classList.remove("chat"); setS(1); E.core.classList.remove("alma-live");
    pullClear(); E.body.style.scale = ""; pullS.x = pullS.t = 0;
    var r = E.face.getBoundingClientRect();
    aX.x = aX.t = r.left + r.width / 2; aY.x = aY.t = r.top + r.height / 2; aS.x = aS.t = r.width; aSq.x = aSq.t = 0; aDX.x = aDX.t = aDY.x = aDY.t = 0;
    /* el mismo objeto: el botón se oculta en el mismo cuadro en que la piedra toma su lugar */
    aL.x = aL.t = litFace(); aH.x = aH.t = 1; showStone(true); stoneRender(); hideCore(true);
    E.ov.classList.add("on"); var t = stoneTarget();
    aX.to(t.x, .74, .72); aY.to(t.y, .74, .72); aS.to(t.s, .74, .66);
    aL.to(.5, .74, .32, 1.2); aH.to(.85, .74, .32, 1.4);
    E.scrim.style.opacity = "0"; clearTimeout(idleT);
    if (resume) { status("Te escucho"); return; }
    status("Conectando…"); E.cap.textContent = ""; E.msgs.innerHTML = "";
    almaSesion();
  }
  /* Conversación de voz (la misma para la piedra al centro y para el modo en el botón). */
  function almaSesion() {
    var h = {
      status: function (x) { if (AL.on || AL.min) status(x); if (AL.min && !AL.on && x === "Te escucho" && !almaSesion.dicho) { almaSesion.dicho = 1; phMini("Alma te escucha"); } },
      message: function (src, x) { if (!x || (!AL.on && !AL.min)) return;
        if (src !== "ai" && /^[\s.…]*$/.test(x)) return;   // «…»: la señal de silencio del agente, no algo que dijo la persona
        if (src !== "ai") chatQuieto();
        if (src === "ai") { x = String(x).replace(/\[[^\]\n]{1,40}\]/g, "").replace(/\s{2,}/g, " ").trim(); if (!x) return; if (!AL.chat) caption(x); addMsg(x, "a"); } else addMsg(x, "u"); },
      ended: function () { if (AL.on || AL.min) almaEnd(true); },
      error: function (m) { status("No pude conectar con Alma"); E.cap.textContent = m || ""; if (AL.min && !AL.on) phMini(m || "No pude conectar con Alma"); setTimeout(function () { if (AL.on || AL.min) almaEnd(true); }, 2600); }
    };
    almaSesion.dicho = 0;
    AL.ses = null;
    var pr; try { pr = cfg.alma.start(h); } catch (x) { pr = Promise.reject(x); }
    Promise.resolve(pr).then(function (s) {
      if (!AL.on && !AL.min) { try { s && s.end && s.end(); } catch (x) {} return; }
      AL.ses = s || null;
      if (s && AL.chat && s.chat) { try { s.chat(true); } catch (x) {} }
      if (s && AL.cola && s.sendText) { try { s.sendText(AL.cola); } catch (x) {} } AL.cola = null;
    }).catch(function (e) { h.error(String((e && e.message) || e || "")); });
  }
  function phMini(t) { var v = towardCenter(), fr = E.face.getBoundingClientRect(), cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2; phShow(t, cx + v[0] * 80, cy + v[1] * 80, 2600); }
  /* Triple toque: la llamada empieza en el botón, minimizada (respira con la voz). Deslizar al centro la abre en grande;
     hacia el borde la termina. */
  function almaMini() {
    if (AL.on || AL.min || !almaOk()) return;
    almaBuild(); setS(1); clearTimeout(idleT);
    AL.min = true; AL.on = false; AL.chat = false; E.cap.textContent = ""; E.msgs.innerHTML = "";
    E.core.classList.add("alma-live"); almaLoopOn(); surge();
    if (navigator.vibrate) try { navigator.vibrate([6, 30, 6]); } catch (x) {}
    phMini("Conectando con Alma…");
    almaSesion();
  }
  function almaEnd(remote) {
    if (AL.esc && E.ov) {
      var se = AL.ses; AL.on = false; AL.ses = null; AL.breath = 0; AL.cola = null; jReset();
      if (se && !remote) { try { se.end(); } catch (x) {} }
      if (AL.chat) almaChat(false); escQuieta(); return;
    }
    var wasMin = AL.min, s = AL.ses; AL.on = false; AL.min = false; AL.ses = null; AL.breath = 0; jReset();
    if (s && !remote) { try { s.end(); } catch (x) {} }
    E.core.classList.remove("alma-live"); E.core.style.setProperty("--voice", "0"); suelta(E.body);
    if (!E.ov) return;
    if (wasMin) { phMini("Llamada con Alma terminada"); if (navigator.vibrate) try { navigator.vibrate([8, 40, 8]); } catch (x) {} return; }
    var r = E.face.getBoundingClientRect(); E.ov.classList.remove("on", "chat", "min", "ending");
    aX.to(r.left + r.width / 2, .62, .82); aY.to(r.top + r.height / 2, .62, .82); aS.to(r.width, .62, .8); aL.to(litFace(), .62, 1); aH.to(1, .62, .5);
    E.scrim.style.opacity = dock.on ? "0" : "";
    alReposo([aX, aY, aS], function () { if (AL.on || AL.min) return; hideCore(false); showStone(false); });
  }
  function almaChat(on) {
    AL.chat = on; E.ov.classList.toggle("chat", on); if (on) chatQuieto(); else clearTimeout(chatT);
    if (AL.ses && AL.ses.chat) { try { AL.ses.chat(on); } catch (x) {} }
    var t = stoneTarget(); aX.to(t.x, .6, .78); aY.to(t.y, .6, .78); aS.to(t.s, .6, on ? .76 : .7);
    if (on) setTimeout(function () { var i = E.ov.querySelector(".san-in"); if (i) try { i.focus(); } catch (x) {} E.msgs.scrollTop = E.msgs.scrollHeight; }, 400);
  }
  /* Escena (inicio de la app de Alma): la piedra grande al centro, quieta hasta que se toca; tocarla (o Chat) abre la
     conversación. Terminar la deja quieta en su lugar: no vuelve a un botón. */
  /* o = { y: centro en fracción del alto, s: diámetro máximo } (p. ej. más arriba y más chica mientras se entra).
     Si la escena ya está, la piedra va a su nuevo lugar con su resorte. */
  function escena(o) {
    if (!root) return false;
    if (AL.esc) { AL.escO = o || null; var tn = stoneTarget(); aX.to(tn.x, .7, .8); aY.to(tn.y, .7, .8); aS.to(tn.s, .7, .72); return { x: tn.x, y: tn.y, s: tn.s / PB }; }
    AL.escO = o || null;
    almaBuild(); AL.esc = true; root.classList.add("san-escena"); E.ov.classList.add("escena"); setS(1); clearTimeout(idleT); E.hint.classList.remove("on");
    var t = stoneTarget();
    aX.x = aX.t = t.x; aY.x = aY.t = t.y; aS.x = aS.t = t.s; aSq.x = aSq.t = 0; aDX.x = aDX.t = aDY.x = aDY.t = 0; aL.x = aL.t = .2; aH.x = aH.t = .5;
    showStone(true); stoneRender(); E.ov.classList.add("on"); escQuieta();
    return { x: t.x, y: t.y, s: t.s / PB };   // dónde quedó la piedra (para que el portal de entrada termine justo ahí)
  }
  function escQuieta() { E.ov.classList.add("quieta"); status("Toca a Alma"); E.cap.textContent = ""; aL.to(.2, .8, .9); aH.to(.5, .8, .9); }
  function escActivar(chat) {
    if (AL.on || !almaOk()) return;
    AL.on = true; AL.chat = false; AL.mudo = false; E.ov.classList.remove("quieta", "chat");
    aSq.x = 1; aSq.to(0, .5, .55); aL.to(.5, .74, .32, 1.2); aH.to(.85, .74, .32, 1.4);
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {}
    status("Conectando…"); E.cap.textContent = ""; E.msgs.innerHTML = "";
    almaSesion(); if (chat) almaChat(true);
  }
  /* piedra pesada: cede poco, se estira poco, rebote corto · mantener = minimizar · deslizar abajo = terminar */
  var stoneDrag = false, sHist = [], sDown = null, sLp = null, sEnd = false, sMov = 0;
  function bindStone() {
    var el = E.stone;
    el.addEventListener("pointerdown", function (e) {
      e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {}
      sDown = [e.clientX, e.clientY, aX.x, aY.x]; sMov = 0; aSq.to(1, .22, 1); clearTimeout(sLp); if (!AL.chat && !AL.esc) sLp = setTimeout(startStoneDrag, LONG_MS);
    });
    el.addEventListener("pointermove", function (e) {
      if (!sDown) return; var dx = e.clientX - sDown[0], dy = e.clientY - sDown[1];
      if (stoneDrag) { aX.x = aX.t = sDown[2] + dx; aY.x = aY.t = sDown[3] + dy; aX.v = aY.v = 0; sHist.push({ x: aX.x, y: aY.x, t: performance.now() }); if (sHist.length > 8) sHist.shift(); markNear(aX.x, aY.x); kick(); return; }
      var dd = Math.hypot(dx, dy) || 1; if (dd > 10) clearTimeout(sLp); sMov = Math.max(sMov, dd);
      var r = rubber(dd, 22); aDX.x = aDX.t = dx / dd * r; aDY.x = aDY.t = dy / dd * r;
      sEnd = !AL.chat && (AL.on || !AL.esc) && dy > 80 && Math.abs(dx) < dy * .8; E.ov.classList.toggle("ending", sEnd);
      if (sEnd) phShow("Suelta para terminar", VW() / 2, aY.x + aS.x / 2 + 60); else E.ph.classList.remove("on");
    });
    function up() {
      if (!sDown) return; sDown = null; clearTimeout(sLp);
      if (stoneDrag) { endStoneDrag(); return; }
      aSq.to(0, .5, .55); aDX.to(0, .55, .6); aDY.to(0, .55, .6);
      if (sEnd) { sEnd = false; E.ov.classList.remove("ending"); E.ph.classList.remove("on"); almaEnd(false); }
      else if (AL.esc && sMov < 12) { if (!AL.on) escActivar(false); else if (AL.chat) almaChat(false); }
    }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }
  function startStoneDrag() {
    stoneDrag = true; sHist = []; aSq.to(0, .3, 1); aDX.x = aDX.t = aDY.x = aDY.t = 0; aS.to(Math.max(110, faceD() * 1.6), .4, .85); E.ov.classList.add("min");
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {}
    var pc = {}; ANCH.forEach(function (a) { pc[a] = anchorPt(a, true); }); ptsCache = pc; placeDots(); E.dots.classList.add("on");
  }
  function endStoneDrag() {
    stoneDrag = false; E.dots.classList.remove("on"); ptsCache = null;
    var a = sHist[0] || { x: aX.x, y: aY.x, t: 0 }, b = sHist[sHist.length - 1] || a, dt = Math.max(16, b.t - a.t), vx = (b.x - a.x) / dt * 1000, vy = (b.y - a.y) / dt * 1000;
    if (performance.now() - b.t > 90) vx = vy = 0;
    minimizarEn(nearest(aX.x + project(vx), aY.x + project(vy), true), vx, vy, true);
  }
  /* Alma (piedra al centro) se minimiza a una de las 8 posiciones y sigue la llamada en el botón. */
  function minimizarEn(an, vx, vy, ayuda) {
    st.anchor = an; setCk("sa_nav_pos", an);
    if (dock.on || dock.el) { dock.out = true; setDocked(false); }
    var p = anchorPt(an, true); px.x = px.t = p.x; py.x = py.t = p.y; zoom.x = zoom.t = K(); arms = armsFor(an); placeScrim(); kick();
    aX.to(p.x, .55, .8, vx); aY.to(p.y, .55, .8, vy); aS.to(74 * K(), .55, .8); aL.to(.28, .55, .8); aH.to(1, .55, .45);
    E.ov.classList.remove("on", "chat", "min"); AL.on = false; AL.min = true; AL.chat = false; E.scrim.style.opacity = "";
    if (AL.ses && AL.ses.chat) { try { AL.ses.chat(false); } catch (x) {} }
    alReposo([aX, aY, aS], function () {
      if (!AL.min) return; hideCore(false); showStone(false); E.core.classList.add("alma-live"); almaLoopOn();
      if (ayuda) { var v = inward(st.anchor); phShow("Hacia el centro: Alma · hacia el borde: terminar", px.t + v[0] * 92, py.t + v[1] * 92, 3400); }
    });
  }

  /* ================= portal =================
     SANav.portal("out", { texto }) → la piedra sale del botón, sube y crece hasta cubrir la pantalla (como si Alma te
     llevara a otro lado). Resuelve con una función para deshacerlo si al final no se salió de la página.
     SANav.portal("in", { texto }) → la pantalla empieza cubierta por la piedra y Alma vuelve a su lugar en el botón.
     o.desde / o.hacia = { x, y, s } (s = diámetro / 140): de dónde sale la piedra y adónde vuelve, si no es el botón
     (p. ej. el video del tutorial termina la transición donde está la piedra dentro del video). */
  var PB = 140;
  function portalPt() {
    if (root && !root.hidden && E.face) { var r = E.face.getBoundingClientRect(); if (r.width > 4) return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / PB }; }
    var p = anchorPt(st.anchor || "bc", true); return { x: p.x, y: p.y, s: 74 * K() / PB };
  }
  function portal(dir, o) {
    o = o || {};
    if (!d.getElementById("sa-nav-css")) { var cs = d.createElement("style"); cs.id = "sa-nav-css"; cs.textContent = CSS; d.head.appendChild(cs); }
    /* blanco: la piedra se vuelve del color de la página (cambio de app: el blanco de carga del navegador queda «pintado» por Alma) */
    var bl = !!o.blanco, fondo = o.fondo || (bl ? (function () { try { var c = getComputedStyle(d.body).backgroundColor; return c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) ? c : "#FAFAFA"; } catch (e) { return "#FAFAFA"; } })() : "");
    var DO = o.rapido ? 760 : 1150, DI = o.rapido ? 900 : 1250;
    portalBarrer(true);   // nunca dos piedras: si quedó un portal anterior (animación que el teléfono pausó), se quita
    var pv = d.createElement("div"); pv.className = "san-scope san-portal"; pv.setAttribute("aria-hidden", "true"); pv._t = Date.now(); pv._dir = dir;
    pv.innerHTML = '<div class="san-rock san-pp"><span class="san-st-glow"></span><span class="san-st-ring"></span><div class="san-st-body"><div class="san-st-lit"></div></div><div class="san-st-rim"></div><div class="san-st-spark">' + SPARK + '</div><div class="san-pw"></div></div><div class="san-pcap"></div>';
    d.body.appendChild(pv);
    var rk = pv.firstChild, li = rk.querySelector(".san-st-lit"), lf = tengo0() ? Math.min(.6, litFace() * .5) : .06, sp = rk.querySelector(".san-st-spark"), pw = rk.querySelector(".san-pw"), gl = rk.querySelector(".san-st-glow"), cap = pv.lastChild; cap.textContent = o.texto || "";
    if (bl) pw.style.background = fondo;
    var b = portalPt(), bI = o.hacia || b, bO = o.desde || b, cx = VW() / 2, cy = VH() * .45, sC = Math.hypot(VW(), VH()) * 1.2 / PB;
    var T = function (x, y, k) { return "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + k.toFixed(4) + ")"; };
    var tengo = !!(root && E.face); if (tengo) hideCore(true);
    var fin = function () { if (pv._fin === null) return; pv._fin = null; if (pv.parentNode) pv.remove(); if (tengo && root) { hideCore(false); surge(); } };
    pv._fin = fin;
    /* Red de seguridad: si el navegador pausó la animación (pestaña en segundo plano, iPhone bloqueado) y nunca terminó,
       la piedra del portal se queda pegada encima del botón y se ven dos. Al llegar, se quita sola. */
    if (dir === "in") setTimeout(fin, DI + (o.espera != null ? o.espera : 450) + 900);
    var recibir = function (ok, espera) {
      if (RM || !rk.animate) { pv.animate ? pv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260 }).onfinish = function () { fin(); ok(); } : (fin(), ok()); return; }
      setTimeout(function () {
        cap.animate([{ opacity: +getComputedStyle(cap).opacity }, { opacity: 0 }], { duration: 260, fill: "forwards" });
        sp.animate([{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1 }], { duration: DI, fill: "forwards" });
        li.animate([{ opacity: .275 }, { opacity: .275, offset: .5 }, { opacity: lf }], { duration: DI, fill: "forwards", easing: "cubic-bezier(.4,0,.2,1)" });
        if (bl) { pw.animate([{ opacity: 1 }, { opacity: 1, offset: .3 }, { opacity: 0, offset: .82 }, { opacity: 0 }], { duration: DI, fill: "forwards" });
          gl.animate([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }], { duration: DI, fill: "forwards" }); }
        var a = rk.animate([
          { transform: T(cx, cy, sC) },
          { transform: T(cx, cy, bI.s * 2.3), offset: .45, easing: "cubic-bezier(.4,0,.2,1)" },
          { transform: T(bI.x, bI.y - 12, bI.s * 1.1), offset: .8, easing: "cubic-bezier(.3,0,.2,1)" },
          { transform: T(bI.x, bI.y + 2, bI.s * .95), offset: .91 },
          { transform: T(bI.x, bI.y, bI.s) }
        ], { duration: DI, fill: "forwards", easing: "linear" });
        a.onfinish = function () { fin(); ok(); };
      }, espera);
    };
    return new Promise(function (ok) {
      if (dir === "in") {
        rk.style.transform = T(cx, cy, sC); sp.style.opacity = 0; if (o.texto) cap.style.opacity = 1;
        if (bl) { pw.style.opacity = 1; gl.style.opacity = 0; }
        recibir(ok, o.espera != null ? o.espera : 450); return;
      }
      var deshacer = function () { return new Promise(function (ok2) { recibir(ok2, 0); }); };
      if (RM || !rk.animate) { rk.style.transform = T(cx, cy, sC); if (bl) pw.style.opacity = 1; cap.style.opacity = o.texto ? 1 : 0; pv.animate && pv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); setTimeout(function () { ok(deshacer); }, 240); return; }
      sp.animate([{ opacity: 1 }, { opacity: 1, offset: .45 }, { opacity: 0 }], { duration: DO, fill: "forwards" });
      li.animate([{ opacity: lf }, { opacity: .275, offset: .35 }, { opacity: .275 }], { duration: DO, fill: "forwards", easing: "cubic-bezier(.4,0,.2,1)" });
      if (bl) { pw.animate([{ opacity: 0 }, { opacity: 0, offset: .38 }, { opacity: 1, offset: .9 }, { opacity: 1 }], { duration: DO, fill: "forwards" });
        gl.animate([{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: 0, offset: .85 }, { opacity: 0 }], { duration: DO, fill: "forwards" }); }
      var a = rk.animate([
        { transform: T(bO.x, bO.y, bO.s) },
        { transform: T(bO.x, bO.y + 4, bO.s * .86), offset: .1 },
        { transform: T(bO.x, bO.y - 16, bO.s * 1.18), offset: .24, easing: "cubic-bezier(.3,0,.2,1)" },
        { transform: T(cx, cy, bO.s * 2.2), offset: .56, easing: "cubic-bezier(.6,0,.85,.3)" },
        { transform: T(cx, cy, sC) }
      ], { duration: DO, fill: "forwards", easing: "linear" });
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {}
      a.onfinish = function () {
        if (!o.texto) { ok(deshacer); return; }
        cap.animate([{ opacity: 0, transform: "translate(-50%,-40%)" }, { opacity: 1, transform: "translate(-50%,-50%)" }], { duration: 380, fill: "forwards", easing: "cubic-bezier(.2,.8,.2,1)" });
        setTimeout(function () { ok(deshacer); }, 420);
      };
    });
  }
  /* Cambio de app (Hub → Epi, Epi → Hub…): Alma pinta la pantalla del color de la página y se va; la otra app la recibe
     en la MISMA posición (#sa_portal=<posición>) y Alma vuelve al botón destapando la pantalla nueva. */
  function tengo0() { return !!(root && E.face); }
  /* Quita portales que quedaron colgados. todos = también los de salida (al volver con «atrás» o crear uno nuevo). */
  function portalBarrer(todos, edad) {
    var L = d.querySelectorAll(".san-portal"), ahora = Date.now();
    for (var i = 0; i < L.length; i++) {
      var pv = L[i];
      if (!todos && pv._dir !== "in") continue;
      if (edad && ahora - (pv._t || 0) < edad) continue;
      if (typeof pv._fin === "function") pv._fin(); else pv.remove();
    }
    if (!d.querySelector(".san-portal") && root && E.face) hideCore(false);
  }
  d.addEventListener("visibilitychange", function () { if (!d.hidden) setTimeout(function () { portalBarrer(false, 2500); }, 300); });
  /* Volver con «atrás»: el portal de salida se deshace solo (irA); si su animación no terminó, se quita igual. */
  w.addEventListener("pageshow", function (e) { if (e.persisted) setTimeout(function () { portalBarrer(true, 2000); }, 2500); });
  function irA(url, nueva) {
    var u = String(url || ""); if (!u) return;
    u += (u.indexOf("#") >= 0 ? "&" : "#") + "sa_portal=" + (st.anchor || "bc");
    if (nueva) { var win = null; try { win = w.open(u, "_blank"); } catch (e) {} if (win) return; }
    if (RM) { location.href = u; return; }
    portal("out", { blanco: true, rapido: true }).then(function (deshacer) {
      w.addEventListener("pageshow", function (e) { if (e.persisted) deshacer(); }, { once: true });   // volvió con «atrás»
      location.href = u;
    });
  }
  /* Llegada: la pantalla empieza del color de la página y Alma la destapa en cuanto el menú se monta. */
  function llegadaFin() { var h = d.documentElement; if (!h.classList.contains("san-llegando")) return; h.classList.add("san-fin"); setTimeout(function () { h.classList.remove("san-llegando", "san-fin"); }, 420); }
  function llegada() {
    if (!LLEGADA) return; var a = LLEGADA.a; LLEGADA = null;
    if (!root || root.hidden || RM) { llegadaFin(); return; }
    portal("in", { blanco: true, rapido: true, espera: 140 });
    requestAnimationFrame(function () { d.documentElement.classList.remove("san-llegando", "san-fin"); });
  }

  /* ================= API ================= */
  w.SANav = {
    mount: function (c) {
      if (root) { this.update(c); return; }
      /* Una sola piedra por página: si otro script dejó un menú montado, se quita antes de construir el nuevo. */
      var viejos = d.querySelectorAll("#sa-nav-root"); for (var vi = 0; vi < viejos.length; vi++) viejos[vi].remove();
      cfg = Object.assign({ items: [], current: c && c.home ? c.home.k : "" }, c);
      build();
      /* posición: la que el usuario eligió (mantener y mover) o la inicial de la app (abajo al centro por defecto) */
      var sv = getCk("sa_nav_pos"); st.anchor = sv && ANCH.indexOf(sv) >= 0 ? sv : (cfg.pos && ANCH.indexOf(cfg.pos) >= 0 ? cfg.pos : "bc");
      if (LLEGADA && ANCH.indexOf(LLEGADA.a) >= 0) { st.anchor = LLEGADA.a; setCk("sa_nav_pos", st.anchor); }   // donde estaba en la otra app
      try { var ss = JSON.parse(sessionStorage.getItem("sa_nav_state") || "null"); if (ss && ss.S === 2 && Date.now() - ss.t < IDLE_MS) st.S = 2; } catch (e) {}
      var p0 = anchorPt(st.anchor); px = S(p0.x, true); py = S(p0.y, true); arm = [S(0, true), S(0, true)]; barS = S(1); zoom = S(K()); pullS = S(0, true);
      arms = armsFor(st.anchor);
      loadAllowed(); buildItems(); buildFan("apps"); placeScrim(); placeDots();
      if (cfg.hidden) root.hidden = true;
      if (cfg.tint) setTint(cfg.tint);
      w.addEventListener("resize", onResize); d.addEventListener("keydown", onKey); dockWatch(); anilloBind();
      /* Safari esconde y muestra sus barras al hacer scroll sin avisar con resize: se reacomoda con el visor visible. */
      if (w.visualViewport) w.visualViewport.addEventListener("resize", onVV);
      /* en la app de inicio de iPhone el alto real llega tarde: se recoloca al cargar */
      w.addEventListener("load", onResize); setTimeout(onResize, 400); setTimeout(onResize, 1200); setTimeout(onResize, 2600);
      var s0 = st.S; st.S = 1; applyState(1); if (s0 === 2) setS(2);
      render(); kick();
      if (LLEGADA) requestAnimationFrame(llegada);
      setTimeout(showHint, 1200);
      bienvenida();
    },
    update: function (c) {
      if (!root) { this.mount(c); return; }
      var rebuild = c.items && JSON.stringify(c.items) !== JSON.stringify(cfg.items);
      Object.assign(cfg, c);
      if (c.apps) allowed = c.apps.slice();
      if (c.appBadges && st.fan === "apps" && st.S !== 3 && st.S !== 4 && JSON.stringify(c.appBadges) !== root._ab) { root._ab = JSON.stringify(c.appBadges); buildFan("apps"); }
      if ("tint" in c) setTint(c.tint);
      if ("hidden" in c) { root.hidden = !!c.hidden; if (c.hidden && st.S !== 1) setS(1); if (!c.hidden) bienvenida(); else tutBoton(false); }
      if (rebuild) { buildItems(); if (st.fan === "more") buildFan("more"); applyState(0); }
      else markCurrent();
      setCoreLbl();
    },
    /* Abre a Alma al centro desde la app (un botón de la pantalla), igual que deslizar el botón hacia el centro. */
    alma: function () { if (!root || root.hidden || !almaOk()) return false; if (AL.esc) { escActivar(false); return true; } almaOpen(); return true; },
    /* Inicio de la app de Alma: la piedra grande al centro (quieta hasta tocarla) en vez del menú.
       Devuelve { x, y, s } de la piedra, para SANav.portal("in", { hacia }). */
    escena: function (o) { return escena(o); },
    anillo: function (on) { if (on === false) { RING.pt = null; try { localStorage.removeItem("sa_anillo"); } catch (x) {} return false; } if (on === true) { RING.aprender = true; RING.prev = []; phShow("Toca el anillo 3 veces", VW() / 2, VH() * .4, 4000); return true; } return !!RING.pt; },
    portal: portal,
    ir: function (url, nueva) { irA(url, nueva); },
    hide: function (h) { if (root) this.update({ hidden: h !== false }); },
    close: function () { if (root) setS(1); },
    tutoriales: function () { if (root) abrirTutoriales(); },
    unmount: function () {
      if (!root) return;
      w.removeEventListener("resize", onResize); d.removeEventListener("keydown", onKey); if (w.visualViewport) w.visualViewport.removeEventListener("resize", onVV); if (dockMO) dockMO.disconnect(); if (dockRO) dockRO.disconnect();
      tutBoton(false); clearTimeout(idleT); root.remove(); root = null; springs = []; pend = []; running = false; cfg = null; E = {};
    },
    icons: Object.keys(P)
  };
})(window, document);
