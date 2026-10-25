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
   La posición se comparte entre apps (cookie .spacioam.com). Los huéspedes no lo ven:
   solo lo montan las pantallas del equipo.
   --------------------------------------------------------------------------- */
(function (w, d) {
  "use strict";
  if (w.SANav) return;

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
  var STONE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.018' numOctaves='3' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 .62 0 0 0 0 .55 0 0 0 0 .50 0 0 0 .16 -.03'/%3E%3C/filter%3E%3Crect width='150' height='150' filter='url(%23m)'/%3E%3C/svg%3E\")," + GRAIN;
  var GRAD = "linear-gradient(100deg,#E64E37 0%,#EE7552 45%,#F59D68 100%)";
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
    ".san-scope .san-btn:focus-visible{outline:2px solid #E9826A;outline-offset:6px}",
    ".san-scope .san-badge{position:absolute;top:-4px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#E9826A;color:#fff;font:600 9.5px/18px Montserrat,system-ui,sans-serif;text-align:center;z-index:2;box-shadow:0 0 0 2.5px #EDE9E4,0 2px 4px rgba(200,90,60,.25)}",
    ".san-scope .san-fanb .san-btn{left:-30px;top:-30px;width:60px;height:60px;gap:3px;box-shadow:0 12px 18px -6px rgba(90,70,60,.32),0 3px 5px rgba(90,70,60,.14),inset 0 2px 4px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.10)}",
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
        ".san-scope .san-face{position:absolute;left:-37px;top:-37px;width:74px;height:74px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;color:var(--san-ink);touch-action:none;-webkit-tap-highlight-color:transparent;outline:none;" +
      "background:radial-gradient(100% 100% at 50% 38%,#F5F2EE 0%,#EDE9E4 55%,#E2DCD5 100%);box-shadow:0 16px 24px -8px rgba(150,90,64,.36),0 4px 7px rgba(96,76,66,.16),inset 0 -6px 12px rgba(110,90,80,.12),inset 0 4px 8px rgba(255,255,255,.35);transition:box-shadow .35s}",
    ".san-scope .san-stone{position:absolute;inset:0;border-radius:50%;overflow:hidden;-webkit-mask-image:-webkit-radial-gradient(white,black);transform:translateZ(0);pointer-events:none}",
    ".san-scope .san-stone::before{content:'';position:absolute;inset:0;border-radius:50%;opacity:.9;background-image:" + STONE + ";background-size:150px 150px,120px 120px;background-position:center}",
    ".san-scope .san-lit{position:absolute;inset:0;border-radius:50%;background:" + GRAD + ";-webkit-mask:radial-gradient(closest-side,rgba(0,0,0,.55) 0%,rgba(0,0,0,.8) 70%,#000 100%);mask:radial-gradient(closest-side,rgba(0,0,0,.55) 0%,rgba(0,0,0,.8) 70%,#000 100%);opacity:.06;transition:opacity .8s cubic-bezier(.45,0,.55,1)}",
    ".san-scope .san-lit::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit;opacity:0;animation:san-lit 3.6s ease-in-out infinite}",
    ".san-scope .san-face[data-mode='home'] .san-lit{opacity:.13}.san-scope .san-face[data-mode='close'] .san-lit{opacity:.2}",
    ".san-scope .san-face.charge .san-lit,.san-scope .san-face.lift .san-lit{opacity:.34;transition-duration:.6s}",
    ".san-scope .san-body.pressed{transform:scale(.93);transition:transform .12s ease-out}",
    ".san-scope .san-face.pressed{transition:box-shadow .12s;box-shadow:0 5px 9px -4px rgba(150,90,64,.3),inset 0 4px 9px rgba(100,80,70,.18),inset 0 -3px 6px rgba(255,255,255,.3)}",
    ".san-scope .san-body.pressed.charge{transform:scale(1);transition:transform .28s cubic-bezier(.3,1.2,.55,1)}",
    ".san-scope .san-body.lift{transform:scale(1.07)}",
    ".san-scope .san-face.lift{box-shadow:0 26px 32px -10px rgba(150,90,64,.34),0 4px 8px rgba(96,76,66,.12),inset 0 -6px 12px rgba(110,90,80,.12),inset 0 4px 8px rgba(255,255,255,.35)}",
    ".san-scope .san-face:focus-visible{outline:2px solid #E9826A;outline-offset:13px}",
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
    "@media (prefers-reduced-motion:reduce){.san-scope .san-core,.san-scope .san-glow,.san-scope .san-lit::after{animation:none}.san-scope .san-glow{opacity:.5}.san-scope .san-scrim{transition:none}.san-scope .san-btn,.san-scope .san-face,.san-scope .san-g,.san-scope .san-body,.san-scope .san-lit{transition-duration:.01s!important}.san-scope .san-core.surge .san-glow{animation:none}}",
    /* Alma por voz */
    ".san-scope .san-glowb{opacity:calc(.9*var(--pull,0))}.san-scope .san-lit{opacity:calc(.06 + .3*var(--pull,0))}",
    ".san-scope .san-core.alma-live .san-glowb{opacity:calc(.3 + .6*var(--voice,0))}.san-scope .san-core.alma-live .san-lit{opacity:calc(.14 + .35*var(--voice,0) + .3*var(--pull,0))}",
    ".san-scope .san-ph{position:fixed;z-index:calc(var(--san-z) + 12);white-space:nowrap;font:600 11px Montserrat,system-ui,sans-serif;letter-spacing:.04em;color:#3E3F3F;background:rgba(243,240,236,.94);padding:8px 13px;border-radius:999px;box-shadow:0 8px 16px -8px rgba(96,76,66,.3);transform:translate(-50%,-50%) scale(.9);opacity:0;pointer-events:none;transition:opacity .25s,transform .4s cubic-bezier(.3,1.3,.55,1)}",
    ".san-scope .san-ph.on{opacity:1;transform:translate(-50%,-50%) scale(1)}",
    ".san-scope .san-ov{position:fixed;inset:0;z-index:calc(var(--san-z) + 10);pointer-events:none;font-family:Montserrat,system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}.san-scope .san-ov.on{pointer-events:auto}",
    ".san-scope .san-ov-bg{position:absolute;inset:0;opacity:0;transition:opacity .7s cubic-bezier(.45,0,.55,1);background:radial-gradient(circle at 50% 50%,rgba(34,32,31,.62) 0px,rgba(34,32,31,.52) 170px,rgba(34,32,31,.34) 330px,rgba(34,32,31,.16) 480px,rgba(34,32,31,.06) 640px),rgba(250,250,250,.18)}",
    ".san-scope .san-ov.on .san-ov-bg{opacity:1}.san-scope .san-ov.min .san-ov-bg{opacity:.4}",
    ".san-scope .san-rock{position:absolute;left:0;top:0;width:0;height:0;border-radius:50%;visibility:hidden;will-change:transform;touch-action:none;cursor:pointer;pointer-events:auto;--halo:.5;--lit:.06;box-shadow:0 30px 44px -18px rgba(70,50,40,.45),0 8px 14px -6px rgba(70,50,40,.18)}",
    ".san-scope .san-st-ring,.san-scope .san-st-glow{position:absolute;border-radius:50%;pointer-events:none;background:" + GRAD + "}",
    ".san-scope .san-st-ring{inset:-9px;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%);mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%)}",
    ".san-scope .san-st-glow{inset:-96px;opacity:var(--halo);-webkit-mask:radial-gradient(closest-side,transparent calc(100% - 104px),rgba(0,0,0,.9) calc(100% - 88px),rgba(0,0,0,.55) calc(100% - 60px),rgba(0,0,0,.2) calc(100% - 30px),transparent 100%);mask:radial-gradient(closest-side,transparent calc(100% - 104px),rgba(0,0,0,.9) calc(100% - 88px),rgba(0,0,0,.55) calc(100% - 60px),rgba(0,0,0,.2) calc(100% - 30px),transparent 100%)}",
    ".san-scope .san-st-body{position:absolute;inset:0;border-radius:50%;overflow:hidden;-webkit-mask-image:-webkit-radial-gradient(white,black);transform:translateZ(0);background:radial-gradient(circle at 40% 34%,#F7F5F2 0%,#EFECE8 42%,#E3DFDA 78%,#D3CEC8 100%)}",
    ".san-scope .san-st-body::before{content:'';position:absolute;inset:-6%;background-image:" + STONE + ";background-size:150px 150px,120px 120px;background-position:center;opacity:.85}",
    ".san-scope .san-st-lit{position:absolute;inset:0;border-radius:50%;background:linear-gradient(100deg,#F2A07E 0%,#F6B696 50%,#FAD0B6 100%);-webkit-mask:radial-gradient(closest-side,rgba(0,0,0,.55) 0%,rgba(0,0,0,.8) 70%,#000 100%);mask:radial-gradient(closest-side,rgba(0,0,0,.55) 0%,rgba(0,0,0,.8) 70%,#000 100%);opacity:calc(var(--lit)*.42)}",
    ".san-scope .san-st-rim{position:absolute;inset:0;border-radius:50%;box-shadow:inset -16px -22px 40px rgba(90,80,70,.22),inset 14px 16px 30px rgba(255,255,255,.45)}",
    ".san-scope .san-st-spark{position:absolute;inset:0;display:grid;place-items:center;color:#CBC4BC;pointer-events:none}.san-scope .san-st-spark svg{width:22%;height:22%;filter:drop-shadow(0 1px 0 rgba(255,255,255,.8)) drop-shadow(0 -.8px 0 rgba(80,70,60,.32))}",
    ".san-scope .san-ov-ui{position:absolute;left:50%;top:calc(44% + min(33vw,20vh,135px) + 34px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:16px;width:min(320px,calc(100% - 32px));opacity:0;scale:.96;transition:opacity .16s ease,scale .2s ease}",
    ".san-scope .san-ov.on .san-ov-ui{opacity:1;scale:1;transition:opacity 1.1s cubic-bezier(.45,0,.55,1) .55s,scale 1.3s cubic-bezier(.22,.61,.36,1) .55s}",
    ".san-scope .san-ov.chat .san-ov-ui,.san-scope .san-ov.min .san-ov-ui{opacity:0;pointer-events:none;transition:opacity .16s ease}.san-scope .san-ov.ending .san-ov-ui{opacity:.25;transition:opacity .2s ease}",
    ".san-scope .san-ov-st{font:600 10.5px Montserrat,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#F5F1EC;text-shadow:0 1px 6px rgba(40,30,25,.35)}",
    ".san-scope .san-ov-cap{font:500 15px/1.45 Montserrat,system-ui,sans-serif;color:#FFFDFB;text-align:center;min-height:44px;max-height:30vh;overflow:auto;text-shadow:0 1px 8px rgba(40,30,25,.45);text-wrap:balance;transition:opacity .9s cubic-bezier(.45,0,.55,1),scale 1.1s cubic-bezier(.22,.61,.36,1)}",
    ".san-scope .san-ov-cap.in{opacity:0;scale:.97;transition:none}",
    ".san-scope .san-ov-btns{display:flex;gap:22px}",
    ".san-scope .san-ob{position:relative;width:56px;height:56px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;color:var(--san-ink);background:radial-gradient(120% 120% at 50% 20%,#F4F1EE 0%,#ECE8E3 55%,#E3DED8 100%);box-shadow:0 12px 18px -6px rgba(40,30,25,.4),0 3px 5px rgba(40,30,25,.16),inset 0 2px 4px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.10);transition:transform .45s cubic-bezier(.3,1.35,.55,1)}",
    ".san-scope .san-ob:active{transform:scale(.92);transition-duration:.1s}.san-scope .san-ob.end svg{color:#D9583A}.san-scope .san-ob:focus-visible{outline:2px solid #E9826A;outline-offset:4px}",
    ".san-scope .san-ob span{position:absolute;top:62px;left:50%;transform:translateX(-50%);font:600 9.5px Montserrat,system-ui,sans-serif;letter-spacing:.06em;color:#F5F1EC;white-space:nowrap;text-shadow:0 1px 6px rgba(40,30,25,.4)}",
    ".san-scope .san-ov-tip{font:500 10.5px Montserrat,system-ui,sans-serif;letter-spacing:.04em;color:rgba(245,241,236,.8);text-align:center;text-shadow:0 1px 6px rgba(40,30,25,.4)}",
    ".san-scope .san-chat{position:absolute;left:50%;bottom:0;width:min(520px,100%);height:min(70vh,560px);transform:translate(-50%,105%);background:#FAF8F6;border-radius:28px 28px 0 0;box-shadow:0 -20px 40px -20px rgba(40,30,25,.35);display:flex;flex-direction:column;transition:transform .6s cubic-bezier(.3,1.15,.55,1);padding-bottom:env(safe-area-inset-bottom,0px)}",
    ".san-scope .san-ov.chat .san-chat{transform:translate(-50%,0)}",
    ".san-scope .san-chat header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px}.san-scope .san-chat header b{font-family:Valky,Georgia,serif;font-weight:400;font-size:22px;color:#3E3F3F}",
    ".san-scope .san-msgs{flex:1;overflow:auto;padding:8px 18px;display:flex;flex-direction:column;gap:10px}",
    ".san-scope .san-m{max-width:80%;padding:10px 14px;border-radius:18px;font-size:13.5px;line-height:1.45;-webkit-user-select:text;user-select:text}",
    ".san-scope .san-m.a{background:#EFEAE4;color:#3E3F3F;border-bottom-left-radius:6px;align-self:flex-start}.san-scope .san-m.u{background:#3E3F3F;color:#FAFAFA;border-bottom-right-radius:6px;align-self:flex-end}",
    ".san-scope .san-chat form{display:flex;gap:8px;padding:10px 14px 14px}",
    ".san-scope .san-in{flex:1;min-width:0;border:0;border-radius:999px;background:#EFEAE4;padding:13px 16px;font:500 16px Montserrat,system-ui,sans-serif;color:#3E3F3F;outline:none}.san-scope .san-in:focus-visible{box-shadow:0 0 0 2px #E9826A}",
    ".san-scope .san-send,.san-scope .san-tovoice{width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;background:#ECE8E3;color:var(--san-ink);box-shadow:0 6px 10px -5px rgba(40,30,25,.3),inset 0 2px 3px rgba(255,255,255,.6)}.san-scope .san-send{background:#3E3F3F;color:#FAFAFA}",
    "body.san-docked [data-sa-dock]{visibility:hidden!important}[data-sa-dock].san-hosting{position:relative!important;overflow:visible!important}",
    "[data-sa-slot]{transition:padding-right .55s cubic-bezier(.34,1.45,.6,1)}[data-sa-slot].san-slotted{position:relative;padding-right:var(--san-slot-w)!important}",
    ".san-slothost{position:absolute;top:50%;width:0;height:0;visibility:visible;z-index:5;pointer-events:none}.san-slothost .san-nav{position:absolute!important;left:0!important;top:0!important;bottom:auto!important;pointer-events:auto}",
    "@media (prefers-reduced-motion:reduce){[data-sa-slot]{transition:none}}",
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
    if (items.length > 4) { shown = items.slice(0, 3).concat([{ k: "__more", l: "Más", icon: "more", badge: items.slice(3).reduce(function (a, it) { return a + (it.badge || 0); }, 0) }]); overflow = items.slice(3); }
    else { shown = items.slice(); overflow = []; }
    E.items.innerHTML = ""; itemEls = [];
    springs = springs.filter(function (s) { return navP.indexOf(s) < 0; }); navP = [];
    shown.forEach(function (it) {
      var el = d.createElement("div"); el.className = "san-abs san-item"; el.innerHTML = btnHtml(it.l, it.icon, it.badge);
      pressable(el.firstChild, function () { if (it.k === "__more") openFan("more"); else go(it.k); });
      E.items.appendChild(el); itemEls.push(el); navP.push(S(st.S === 2 || st.S === 4 ? 1 : 0));
    });
    markCurrent(); fitLabels();
  }
  function buildFan(mode) {
    st.fan = mode;
    if (mode === "more") fanList = overflow.map(function (it) { return { label: it.l, icon: it.icon, badge: it.badge, k: it.k, tap: function () { go(it.k); } }; });
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
     a su tamaño, y un toque hace lo de ese botón. Mantener presionado lo saca a uno de los 8 puntos y vuelve a ser menú. */
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
  function setCoreLbl() {
    var lt = !onHome() ? cfg.home.l : (cfg.app !== "hub" ? "Hub" : "Cerrar"); if (E.lbl.textContent !== lt) E.lbl.textContent = lt;
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
    if (st.S === 3 || st.S === 4) setS(2);
    if (k !== cfg.current) { cfg.current = k; markCurrent(); setCoreLbl(); }
    activity();
    try { cfg.onNavigate && cfg.onNavigate(k); } catch (e) { console.error(e); }
  }
  function goHub() {
    /* Las apps se abren desde el Hub en otra pestaña: si esta pestaña la abrió el Hub, se cierra y vuelve a él. */
    var closed = false;
    try { if (w.opener && !w.opener.closed) { w.close(); closed = w.closed; } } catch (e) {}
    setTimeout(function () { if (!w.closed && !closed) location.href = HUB; }, 160);
  }
  function goHome() {
    if (!onHome()) { surge(); go(cfg.home.k); return; }
    if (cfg.app !== "hub") { goHub(); return; }
    setS(1);
  }
  function openApp(a) {
    setS(1);
    if (cfg.app === "hub") { var win = null; try { win = w.open(a.url, "_blank"); } catch (e) {} if (!win) location.href = a.url; }
    else location.href = a.url;
  }
  function nope() { E.body.animate && E.body.animate([{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "-2px 0" }, { translate: "0 0" }], { duration: 420, easing: "ease-out" }); }
  function multi() { return APPS.filter(function (a) { return a.k !== cfg.app && (!allowed || allowed.indexOf(a.k) >= 0); }).length > 0; }
  function onSingle() { if (dock.on) { try { dock.el.click(); } catch (e) {} surge(); return; } activity(); if (st.S === 1) setS(2); else if (st.S === 2) goHome(); else if (st.S === 3) setS(1); else setS(2); }
  function onDouble() {
    activity();
    if (!multi()) { nope(); return; }
    if (st.S === 1) openFan("apps"); else if (st.S === 2) openFan("apps"); else if (st.S === 3) setS(1); else setS(2);
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
      /* Triple toque (botón en reposo o encajado): Alma por voz ahí mismo, sin abrir la piedra al centro. */
      var trio = almaOk() && !AL.on && !AL.min && (dock.on || st.S === 1);
      if (trio) {
        taps++; clearTimeout(tapT);
        tapT = setTimeout(function () { var n = taps; taps = 0; tapT = null; if (n >= 3) almaMini(); else if (n === 2 && !dock.on && multi()) onDouble(); else onSingle(); }, TAP_MS);
        return;
      }
      if (dock.on || !multi() || st.S === 3 || st.S === 4) { onSingle(); return; }
      if (tapT) { clearTimeout(tapT); tapT = null; onDouble(); } else tapT = setTimeout(function () { tapT = null; onSingle(); }, TAP_MS);
    }
    f.addEventListener("pointerup", function () { up(false); });
    f.addEventListener("pointercancel", function () { up(true); });
    f.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); });
    ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup"].forEach(function (ev) { f.addEventListener(ev, function (e) { if (hosted) e.stopPropagation(); }, { passive: true }); });
    f.addEventListener("dblclick", function (e) { e.preventDefault(); });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.shiftKey ? onDouble() : onSingle(); }
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
    moveTo(to, vx, vy);
    if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
  }
  function moveTo(a, vx, vy) {
    if (dock.on || dock.el) { dock.out = true; setDocked(false); }
    zoom.to(K(), .5, .8);
    st.anchor = a; setCk("sa_nav_pos", a);
    var p = anchorPt(a); px.to(p.x, .46, .78, vx); py.to(p.y, .46, .78, vy); placeScrim();
    if (p.slot) { var sl = slotFor(a); if (sl) slotPush(sl.el); } else slotPull();
    setTimeout(dockSchedule, 700);
    setTimeout(function () { if (E.scrim) E.scrim.classList.remove("moving"); }, 250);
    var back = (prevS === 2 || prevS === 4) ? 2 : 1; prevS = 1;
    setTimeout(function () { if (!root) return; st.S = 0; setS(back); }, 170);
  }
  function onResize() { if (!root) return; insetCache = null; measureBottom(); if (dock.on) { dockSchedule(); return; } if (dragging) return; zoom.x = zoom.t = K(); var p = anchorPt(st.anchor); px.x = px.t = p.x; py.x = py.t = p.y; geo = fanGeo(st.anchor, fanEls.length, st.S === 2 || st.S === 4); kick(); }

  /* El pulso (luz y tamaño) son animaciones CSS con la misma duración, montadas en el mismo instante: corren en el
     compositor, sin trabajo de JavaScript por cuadro, y siguen sincronizadas. */

  /* ================= guía de primera vez ================= */
  function hideHint() { if (E.hint && E.hint.classList.contains("on")) { E.hint.classList.remove("on"); setCk("sa_nav_hint", "1"); } }
  function showHint() {
    if (!root || root.hidden || getCk("sa_nav_hint")) return;
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
      '<div class="san-chat"><header><b>Alma</b><button type="button" class="san-tovoice" aria-label="Volver a voz">' + svg('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 20) + '</button></header><div class="san-msgs"></div>' +
      '<form><input class="san-in" placeholder="Escríbele a Alma" autocomplete="off" aria-label="Mensaje para Alma"><button type="submit" class="san-send" aria-label="Enviar">' + svg('<path d="M5 12h13M13 6l6 6-6 6"/>', 20) + '</button></form></div>';
    root.appendChild(ov);
    E.ov = ov; E.stone = ov.querySelector(".san-rock"); E.ost = ov.querySelector(".san-ov-st"); E.cap = ov.querySelector(".san-ov-cap"); E.msgs = ov.querySelector(".san-msgs");
    aX = S(0, true); aY = S(0, true); aS = S(0, true); aSq = S(0); aDX = S(0, true); aDY = S(0, true); aL = S(.06); aH = S(.5);
    ov.querySelector('[data-a="end"]').onclick = function () { almaEnd(false); };
    ov.querySelector('[data-a="chat"]').onclick = function () { almaChat(true); };
    ov.querySelector(".san-tovoice").onclick = function () { almaChat(false); };
    ov.querySelector("form").onsubmit = function (e) {
      e.preventDefault(); var i = ov.querySelector(".san-in"), v = i.value.trim(); if (!v) return; i.value = ""; addMsg(v, "u");
      if (AL.ses && AL.ses.sendText) { try { AL.ses.sendText(v); } catch (x) {} }
    };
    ov.querySelector(".san-ov-bg").onclick = function () { if (!AL.chat && !stoneDrag) almaEnd(false); };
    bindStone();
  }
  function stoneTarget() { return AL.chat ? { x: VW() / 2, y: Math.max(70, VH() - Math.min(VH() * .7, 560) - 60), s: 78 } : { x: VW() / 2, y: VH() * .42, s: Math.min(VW() * .66, VH() * .4, 270) }; }
  function faceD() { return 74 * zoom.x; }
  function stoneRender() {
    var dx = aDX.x, dy = aDY.x, dd = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), st2 = Math.min(.05, dd / 1100);
    var D = Math.max(0, aS.x * (1 - .035 * aSq.x) * (AL.on ? 1 + .02 * J.p + J.v : 1));
    var s = E.stone.style; s.width = s.height = D + "px"; s.marginLeft = s.marginTop = (-D / 2) + "px";
    var jw = AL.on ? J.w : 0;
    s.transform = "translate(" + (aX.x + dx) + "px," + (aY.x + dy) + "px) rotate(" + ang + "rad) scale(" + (1 + st2) + "," + (1 - st2 * .6) + ") rotate(" + (-ang) + "rad)" +
      (jw ? " rotate(" + J.ang.toFixed(3) + "rad) scale(" + (1 + jw).toFixed(4) + "," + (1 - jw * .85).toFixed(4) + ") rotate(" + (-J.ang).toFixed(3) + "rad)" : "");
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
  function showStone(on) { AL.vis = on; E.stone.style.visibility = on ? "visible" : "hidden"; if (on) almaLoopOn(); }
  function hideCore(h) { E.face.style.visibility = h ? "hidden" : ""; E.core.querySelector(".san-led").style.opacity = h ? "0" : ""; }
  function status(t) { if (E.ost) E.ost.textContent = t || ""; }
  function caption(t) { t = String(t).replace(/\[[^\]\n]{1,40}\]/g, "").replace(/\s{2,}/g, " ").trim(); if (!t) return; E.cap.classList.add("in"); E.cap.textContent = t; void E.cap.offsetWidth; E.cap.classList.remove("in"); }
  function addMsg(t, who) { var m = d.createElement("div"); m.className = "san-m " + who; m.textContent = t; E.msgs.appendChild(m); E.msgs.scrollTop = E.msgs.scrollHeight; }

  function almaOpen() {
    if (AL.on) return; almaBuild(); var resume = AL.min;
    AL.on = true; AL.min = false; AL.chat = false; E.ov.classList.remove("chat"); setS(1); E.core.classList.remove("alma-live");
    pullClear(); E.body.style.scale = ""; pullS.x = pullS.t = 0;
    var r = E.face.getBoundingClientRect();
    aX.x = aX.t = r.left + r.width / 2; aY.x = aY.t = r.top + r.height / 2; aS.x = aS.t = r.width; aSq.x = aSq.t = 0; aDX.x = aDX.t = aDY.x = aDY.t = 0;
    /* el mismo objeto: el botón se oculta en el mismo cuadro en que la piedra toma su lugar */
    aL.x = aL.t = .36; aH.x = aH.t = 1; showStone(true); stoneRender(); hideCore(true);
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
      message: function (src, x) { if (!x || (!AL.on && !AL.min)) return; if (src === "ai") { x = String(x).replace(/\[[^\]\n]{1,40}\]/g, "").replace(/\s{2,}/g, " ").trim(); if (!x) return; if (!AL.chat) caption(x); addMsg(x, "a"); } else addMsg(x, "u"); },
      ended: function () { if (AL.on || AL.min) almaEnd(true); },
      error: function (m) { status("No pude conectar con Alma"); E.cap.textContent = m || ""; if (AL.min && !AL.on) phMini(m || "No pude conectar con Alma"); setTimeout(function () { if (AL.on || AL.min) almaEnd(true); }, 2600); }
    };
    almaSesion.dicho = 0;
    AL.ses = null;
    var pr; try { pr = cfg.alma.start(h); } catch (x) { pr = Promise.reject(x); }
    Promise.resolve(pr).then(function (s) {
      if (!AL.on && !AL.min) { try { s && s.end && s.end(); } catch (x) {} return; }
      AL.ses = s || null;
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
    var wasMin = AL.min, s = AL.ses; AL.on = false; AL.min = false; AL.ses = null; AL.breath = 0; jReset();
    if (s && !remote) { try { s.end(); } catch (x) {} }
    E.core.classList.remove("alma-live"); E.core.style.setProperty("--voice", "0"); E.body.style.scale = "";
    if (!E.ov) return;
    if (wasMin) { phMini("Llamada con Alma terminada"); if (navigator.vibrate) try { navigator.vibrate([8, 40, 8]); } catch (x) {} return; }
    var r = E.face.getBoundingClientRect(); E.ov.classList.remove("on", "chat", "min", "ending");
    aX.to(r.left + r.width / 2, .62, .86); aY.to(r.top + r.height / 2, .62, .86); aS.to(r.width, .62, .86); aL.to(.06, .62, 1); aH.to(1, .62, .5);
    E.scrim.style.opacity = dock.on ? "0" : "";
    setTimeout(function () { if (AL.on || AL.min) return; hideCore(false); showStone(false); }, 660);
  }
  function almaChat(on) {
    AL.chat = on; E.ov.classList.toggle("chat", on);
    if (AL.ses && AL.ses.chat) { try { AL.ses.chat(on); } catch (x) {} }
    var t = stoneTarget(); aX.to(t.x, .6, .78); aY.to(t.y, .6, .78); aS.to(t.s, .6, on ? .76 : .7);
    if (on) setTimeout(function () { var i = E.ov.querySelector(".san-in"); if (i) try { i.focus(); } catch (x) {} }, 400);
  }
  /* piedra pesada: cede poco, se estira poco, rebote corto · mantener = minimizar · deslizar abajo = terminar */
  var stoneDrag = false, sHist = [], sDown = null, sLp = null, sEnd = false;
  function bindStone() {
    var el = E.stone;
    el.addEventListener("pointerdown", function (e) {
      e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {}
      sDown = [e.clientX, e.clientY, aX.x, aY.x]; aSq.to(1, .22, 1); clearTimeout(sLp); if (!AL.chat) sLp = setTimeout(startStoneDrag, LONG_MS);
    });
    el.addEventListener("pointermove", function (e) {
      if (!sDown) return; var dx = e.clientX - sDown[0], dy = e.clientY - sDown[1];
      if (stoneDrag) { aX.x = aX.t = sDown[2] + dx; aY.x = aY.t = sDown[3] + dy; aX.v = aY.v = 0; sHist.push({ x: aX.x, y: aY.x, t: performance.now() }); if (sHist.length > 8) sHist.shift(); markNear(aX.x, aY.x); kick(); return; }
      var dd = Math.hypot(dx, dy) || 1; if (dd > 10) clearTimeout(sLp);
      var r = rubber(dd, 22); aDX.x = aDX.t = dx / dd * r; aDY.x = aDY.t = dy / dd * r;
      sEnd = !AL.chat && dy > 80 && Math.abs(dx) < dy * .8; E.ov.classList.toggle("ending", sEnd);
      if (sEnd) phShow("Suelta para terminar", VW() / 2, aY.x + aS.x / 2 + 60); else E.ph.classList.remove("on");
    });
    function up() {
      if (!sDown) return; sDown = null; clearTimeout(sLp);
      if (stoneDrag) { endStoneDrag(); return; }
      aSq.to(0, .5, .55); aDX.to(0, .55, .6); aDY.to(0, .55, .6);
      if (sEnd) { sEnd = false; E.ov.classList.remove("ending"); E.ph.classList.remove("on"); almaEnd(false); }
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
    var an = nearest(aX.x + project(vx), aY.x + project(vy), true); st.anchor = an; setCk("sa_nav_pos", an);
    if (dock.on || dock.el) { dock.out = true; setDocked(false); }
    var p = anchorPt(an, true); px.x = px.t = p.x; py.x = py.t = p.y; zoom.x = zoom.t = K(); arms = armsFor(an); placeScrim(); kick();
    aX.to(p.x, .55, .8, vx); aY.to(p.y, .55, .8, vy); aS.to(74 * K(), .55, .8); aL.to(.2, .55, .6); aH.to(1, .55, .45);
    E.ov.classList.remove("on", "chat", "min"); AL.on = false; AL.min = true; AL.chat = false; E.scrim.style.opacity = "";
    if (AL.ses && AL.ses.chat) { try { AL.ses.chat(false); } catch (x) {} }
    setTimeout(function () {
      if (!AL.min) return; hideCore(false); showStone(false); E.core.classList.add("alma-live"); almaLoopOn();
      var v = inward(st.anchor); phShow("Hacia el centro: Alma · hacia el borde: terminar", px.t + v[0] * 92, py.t + v[1] * 92, 3400);
    }, 600);
  }

  /* ================= API ================= */
  w.SANav = {
    mount: function (c) {
      if (root) { this.update(c); return; }
      cfg = Object.assign({ items: [], current: c && c.home ? c.home.k : "" }, c);
      build();
      var sv = getCk("sa_nav_pos"); if (sv && ANCH.indexOf(sv) >= 0) st.anchor = sv;
      try { var ss = JSON.parse(sessionStorage.getItem("sa_nav_state") || "null"); if (ss && ss.S === 2 && Date.now() - ss.t < IDLE_MS) st.S = 2; } catch (e) {}
      var p0 = anchorPt(st.anchor); px = S(p0.x, true); py = S(p0.y, true); arm = [S(0, true), S(0, true)]; barS = S(1); zoom = S(K()); pullS = S(0, true);
      arms = armsFor(st.anchor);
      loadAllowed(); buildItems(); buildFan("apps"); placeScrim(); placeDots();
      if (cfg.hidden) root.hidden = true;
      w.addEventListener("resize", onResize); d.addEventListener("keydown", onKey); dockWatch();
      /* en la app de inicio de iPhone el alto real llega tarde: se recoloca al cargar */
      w.addEventListener("load", onResize); setTimeout(onResize, 400); setTimeout(onResize, 1200);
      var s0 = st.S; st.S = 1; applyState(1); if (s0 === 2) setS(2);
      render(); kick();
      setTimeout(showHint, 1200);
    },
    update: function (c) {
      if (!root) { this.mount(c); return; }
      var rebuild = c.items && JSON.stringify(c.items) !== JSON.stringify(cfg.items);
      Object.assign(cfg, c);
      if (c.apps) allowed = c.apps.slice();
      if (c.appBadges && st.fan === "apps" && st.S !== 3 && st.S !== 4 && JSON.stringify(c.appBadges) !== root._ab) { root._ab = JSON.stringify(c.appBadges); buildFan("apps"); }
      if ("hidden" in c) { root.hidden = !!c.hidden; if (c.hidden && st.S !== 1) setS(1); }
      if (rebuild) { buildItems(); if (st.fan === "more") buildFan("more"); applyState(0); }
      else markCurrent();
      setCoreLbl();
    },
    hide: function (h) { if (root) this.update({ hidden: h !== false }); },
    close: function () { if (root) setS(1); },
    unmount: function () {
      if (!root) return;
      w.removeEventListener("resize", onResize); d.removeEventListener("keydown", onKey); if (dockMO) dockMO.disconnect(); if (dockRO) dockRO.disconnect();
      clearTimeout(idleT); root.remove(); root = null; springs = []; pend = []; running = false; cfg = null; E = {};
    },
    icons: Object.keys(P)
  };
})(window, document);
