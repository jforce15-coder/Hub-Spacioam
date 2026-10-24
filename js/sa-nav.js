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
  function scrimCss(e, g) { return "#sa-nav-root .san-scrim[data-e='" + e + "']{background:" + g + "}"; }
  var LIN = function (dir) { return "linear-gradient(to " + dir + ",rgba(38,36,35,.26) 0px,rgba(38,36,35,.18) 110px,rgba(38,36,35,.05) 210px,rgba(38,36,35,0) 290px)"; };
  var RAD = function (at) { return "radial-gradient(circle at " + at + ",rgba(38,36,35,.26) 0px,rgba(38,36,35,.17) 160px,rgba(38,36,35,.05) 280px,rgba(38,36,35,0) 380px)"; };
  var CSS = [
    "#sa-nav-root{--san-ink:#9C928A;--san-spark:#C9C1B8;--san-z:880;font-family:Montserrat,system-ui,-apple-system,sans-serif}",
    "#sa-nav-root[hidden]{display:none!important}",
    "#sa-nav-root .san-scrim{position:fixed;inset:0;pointer-events:none;z-index:var(--san-z);opacity:.5;transition:opacity .6s cubic-bezier(.45,0,.55,1)}",
    "#sa-nav-root .san-scrim.open{opacity:1}#sa-nav-root .san-scrim.moving{opacity:.25}",
    scrimCss("b", LIN("top")), scrimCss("t", LIN("bottom")), scrimCss("l", LIN("right")), scrimCss("r", LIN("left")),
    scrimCss("bl", RAD("0% 100%")), scrimCss("br", RAD("100% 100%")), scrimCss("tl", RAD("0% 0%")), scrimCss("tr", RAD("100% 0%")),
    "#sa-nav-root .san-catch{position:fixed;inset:0;z-index:calc(var(--san-z) + 1);display:none}#sa-nav-root .san-catch.on{display:block}",
    "#sa-nav-root .san-dots{position:fixed;inset:0;pointer-events:none;z-index:calc(var(--san-z) + 2)}",
    "#sa-nav-root .san-dot{position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:#EEEBE7;box-shadow:inset 0 3px 5px rgba(110,90,80,.18),inset 0 -2px 3px rgba(255,255,255,.7);opacity:0;transition:opacity .35s ease,transform .5s cubic-bezier(.3,1.3,.55,1),box-shadow .25s}",
    "#sa-nav-root .san-dots.on .san-dot{opacity:1}#sa-nav-root .san-dot.near{transform:scale(1.4);box-shadow:inset 0 3px 5px rgba(110,90,80,.18),0 0 0 2px rgba(236,112,80,.85),0 0 14px rgba(236,112,80,.35)}",
    "#sa-nav-root .san-nav{position:fixed;left:0;top:0;width:0;height:0;z-index:calc(var(--san-z) + 3);touch-action:none;-webkit-tap-highlight-color:transparent}",
    "#sa-nav-root .san-nav,#sa-nav-root .san-nav *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;box-sizing:border-box}",
    "body.san-dragging{-webkit-user-select:none;user-select:none;cursor:grabbing}",
    "#sa-nav-root .san-abs{position:absolute;left:0;top:0;will-change:transform,opacity}",
    "#sa-nav-root .san-grain::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background-image:" + GRAIN + "}",
    "#sa-nav-root .san-arms{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}",
    "#sa-nav-root .san-arm{position:absolute;border-radius:999px;background:#E9E4DE;box-shadow:0 14px 22px -6px rgba(60,45,38,.30),0 3px 6px rgba(60,45,38,.12),inset 0 3px 5px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.10)}",
    "#sa-nav-root .san-item{width:0;height:0}",
    "#sa-nav-root .san-btn{position:absolute;left:-29px;top:-29px;width:58px;height:58px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;color:var(--san-ink);font:inherit;" +
      "background:radial-gradient(120% 120% at 50% 20%,#F4F1EE 0%,#ECE8E3 55%,#E3DED8 100%);--lx:0;--ly:0;--la:0;" +
      "box-shadow:inset calc(var(--lx)*1px) calc(var(--ly)*1px) 10px rgba(238,116,82,var(--la)),0 7px 12px -5px rgba(96,76,66,.24),0 1px 3px rgba(96,76,66,.10),inset 0 2px 4px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.09);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:transform .55s cubic-bezier(.3,1.25,.55,1),box-shadow .4s ease,background .3s;-webkit-tap-highlight-color:transparent}",
    "#sa-nav-root .san-btn svg{position:relative;z-index:1;transition:color .25s;filter:drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 -.6px 0 rgba(90,70,60,.30))}",
    "#sa-nav-root .san-btn .san-t{position:relative;z-index:1;font:600 8.6px/1 Montserrat,system-ui,sans-serif;letter-spacing:.01em;white-space:nowrap;color:var(--san-ink);text-shadow:0 1px 0 rgba(255,255,255,.75)}",
    "#sa-nav-root .san-btn.pressed,#sa-nav-root .san-btn[aria-current='page']{transform:scale(.94);transition:transform .12s ease-out,box-shadow .14s ease-out;background:radial-gradient(120% 120% at 50% 80%,#EFEBE7 0%,#E6E1DB 60%,#DED8D1 100%);" +
      "box-shadow:inset calc(var(--lx)*1px) calc(var(--ly)*1px) 9px rgba(238,116,82,var(--la)),inset 0 3px 6px rgba(100,80,70,.22),inset 0 -1px 2px rgba(255,255,255,.5)}",
    "#sa-nav-root .san-btn[aria-current='page'] svg{color:#E0613F}",
    "#sa-nav-root .san-btn:focus-visible{outline:2px solid #E9826A;outline-offset:6px}",
    "#sa-nav-root .san-badge{position:absolute;top:-4px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#E9826A;color:#fff;font:600 9.5px/18px Montserrat,system-ui,sans-serif;text-align:center;z-index:2;box-shadow:0 0 0 2.5px #EDE9E4,0 2px 4px rgba(200,90,60,.25)}",
    "#sa-nav-root .san-fanb .san-btn{left:-30px;top:-30px;width:60px;height:60px;gap:3px;box-shadow:0 12px 18px -6px rgba(90,70,60,.32),0 3px 5px rgba(90,70,60,.14),inset 0 2px 4px rgba(255,255,255,.55),inset 0 -4px 7px rgba(110,90,80,.10)}",
    "#sa-nav-root .san-fanb .san-btn.pressed{box-shadow:inset 0 3px 6px rgba(100,80,70,.22),inset 0 -1px 2px rgba(255,255,255,.5)}",
    "#sa-nav-root .san-fanb img{width:21px;height:21px;object-fit:contain;position:relative;z-index:1;pointer-events:none;filter:drop-shadow(0 1px 0 rgba(255,255,255,.75))}",
    "#sa-nav-root .san-core{width:0;height:0;scale:calc(1 - .03*var(--p,0))}",
    "#sa-nav-root .san-led{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;transition:transform .6s cubic-bezier(.3,1.25,.55,1)}",
    "#sa-nav-root .san-ring,#sa-nav-root .san-glow{position:absolute;left:-46px;top:-46px;width:92px;height:92px;border-radius:50%;pointer-events:none;background:" + GRAD + "}",
    "#sa-nav-root .san-ring{-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%);mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px),#000 calc(100% - 3.5px),transparent 100%)}",
    "#sa-nav-root .san-glow{left:-64px;top:-64px;width:128px;height:128px;-webkit-mask:radial-gradient(closest-side,transparent 56%,rgba(0,0,0,.7) 71%,rgba(0,0,0,.18) 83%,transparent 97%);mask:radial-gradient(closest-side,transparent 56%,rgba(0,0,0,.7) 71%,rgba(0,0,0,.18) 83%,transparent 97%);" +
      "opacity:calc(.32 + .36*var(--p,0));transform:scale(calc(.99 + .02*var(--p,0)));transition:opacity .15s linear,transform .15s linear}",
    "@keyframes san-surge{0%{opacity:.95;transform:scale(1.04)}100%{opacity:.4;transform:scale(1)}}",
    "#sa-nav-root .san-core.hot .san-glow{opacity:.9;transform:scale(1.03)}",
    "#sa-nav-root .san-core.charge .san-glow{opacity:1;transform:scale(1.06);transition:opacity .28s ease,transform .28s ease}",
    "#sa-nav-root .san-core.surge .san-glow{animation:san-surge 1.1s cubic-bezier(.22,.61,.36,1)}",
    "#sa-nav-root .san-core.lifted .san-led{transform:scale(1.07)}",
    "#sa-nav-root .san-face{position:absolute;left:-37px;top:-37px;width:74px;height:74px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;color:var(--san-ink);touch-action:none;-webkit-tap-highlight-color:transparent;outline:none;" +
      "background:radial-gradient(100% 100% at 50% 38%,#F5F2EE 0%,#EDE9E4 55%,#E2DCD5 100%);box-shadow:0 16px 24px -8px rgba(150,90,64,.36),0 4px 7px rgba(96,76,66,.16),inset 0 -6px 12px rgba(110,90,80,.12),inset 0 4px 8px rgba(255,255,255,.35);transition:transform .55s cubic-bezier(.3,1.25,.55,1),box-shadow .35s}",
    "#sa-nav-root .san-stone{position:absolute;inset:0;border-radius:50%;overflow:hidden;-webkit-mask-image:-webkit-radial-gradient(white,black);transform:translateZ(0);pointer-events:none}",
    "#sa-nav-root .san-stone::before{content:'';position:absolute;inset:0;border-radius:50%;opacity:.9;background-image:" + STONE + ";background-size:150px 150px,120px 120px;background-position:center}",
    "#sa-nav-root .san-lit{position:absolute;inset:0;border-radius:50%;background:" + GRAD + ";-webkit-mask:radial-gradient(closest-side,rgba(0,0,0,.55) 0%,rgba(0,0,0,.8) 70%,#000 100%);mask:radial-gradient(closest-side,rgba(0,0,0,.55) 0%,rgba(0,0,0,.8) 70%,#000 100%);opacity:.06;transition:opacity .8s cubic-bezier(.45,0,.55,1)}",
    "#sa-nav-root .san-lit::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit;opacity:calc(.8*var(--p,0))}",
    "#sa-nav-root .san-face[data-mode='home'] .san-lit{opacity:.13}#sa-nav-root .san-face[data-mode='close'] .san-lit{opacity:.2}",
    "#sa-nav-root .san-face.pressed .san-lit,#sa-nav-root .san-face.lift .san-lit{opacity:.3;transition-duration:.25s}",
    "#sa-nav-root .san-face.pressed{transform:scale(.93);transition:transform .12s ease-out,box-shadow .12s;box-shadow:0 5px 9px -4px rgba(150,90,64,.3),inset 0 4px 9px rgba(100,80,70,.18),inset 0 -3px 6px rgba(255,255,255,.3)}",
    "#sa-nav-root .san-face.pressed.charge{transform:scale(1);transition:transform .28s cubic-bezier(.3,1.2,.55,1)}",
    "#sa-nav-root .san-face.lift{transform:scale(1.07);box-shadow:0 26px 32px -10px rgba(150,90,64,.34),0 4px 8px rgba(96,76,66,.12),inset 0 -6px 12px rgba(110,90,80,.12),inset 0 4px 8px rgba(255,255,255,.35)}",
    "#sa-nav-root .san-face:focus-visible{outline:2px solid #E9826A;outline-offset:13px}",
    "#sa-nav-root .san-g{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;z-index:1;transition:opacity .4s ease,transform .6s cubic-bezier(.3,1.25,.55,1),filter .4s ease}",
    "#sa-nav-root .san-g svg{filter:drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 -.6px 0 rgba(90,70,60,.30))}",
    "#sa-nav-root .san-g .san-t{font:600 8.8px/1 Montserrat,system-ui,sans-serif;letter-spacing:.03em;color:var(--san-ink);text-shadow:0 1px 0 rgba(255,255,255,.7)}",
    "#sa-nav-root .san-g-spark{color:var(--san-spark)}",
    "#sa-nav-root .san-face[data-mode='idle'] .san-g-home,#sa-nav-root .san-face[data-mode='idle'] .san-g-x,#sa-nav-root .san-face[data-mode='home'] .san-g-spark,#sa-nav-root .san-face[data-mode='home'] .san-g-x,#sa-nav-root .san-face[data-mode='close'] .san-g-spark,#sa-nav-root .san-face[data-mode='close'] .san-g-home{opacity:0;transform:scale(.75);filter:blur(4px)}",
    "#sa-nav-root .san-face[data-mode='close'] .san-g-x{color:#D9583A}#sa-nav-root .san-face[data-mode='close'] .san-g-x svg{transform:rotate(45deg)}",
    "#sa-nav-root .san-hint{position:fixed;z-index:calc(var(--san-z) + 4);max-width:min(300px,calc(100vw - 32px));font:500 11.5px/1.45 Montserrat,system-ui,sans-serif;color:#3E3F3F;background:#F3F0EC;padding:10px 14px;border-radius:16px;box-shadow:0 10px 18px -8px rgba(96,76,66,.28),inset 0 2px 3px rgba(255,255,255,.6);opacity:0;pointer-events:none;transform:translate(-50%,-100%) translateY(8px);transition:opacity .45s ease,transform .6s cubic-bezier(.3,1.25,.55,1);text-align:center}",
    "#sa-nav-root .san-hint b{font-weight:600}#sa-nav-root .san-hint span{display:block;white-space:nowrap}",
    "#sa-nav-root .san-hint[data-side='down']{transform:translate(-50%,0) translateY(-8px)}#sa-nav-root .san-hint[data-side='right']{transform:translate(0,-50%) translateX(-8px)}#sa-nav-root .san-hint[data-side='left']{transform:translate(-100%,-50%) translateX(8px)}",
    "#sa-nav-root .san-hint.on{opacity:1;transform:translate(-50%,-100%)}#sa-nav-root .san-hint.on[data-side='down']{transform:translate(-50%,0)}#sa-nav-root .san-hint.on[data-side='right']{transform:translate(0,-50%)}#sa-nav-root .san-hint.on[data-side='left']{transform:translate(-100%,-50%)}",
    "@media (prefers-reduced-motion:reduce){#sa-nav-root .san-scrim{transition:none}#sa-nav-root .san-btn,#sa-nav-root .san-face,#sa-nav-root .san-g,#sa-nav-root .san-led,#sa-nav-root .san-lit{transition-duration:.01s!important}#sa-nav-root .san-core.surge .san-glow{animation:none}}",
    "@media print{#sa-nav-root{display:none!important}}"
  ].join("\n");

  /* ================= geometría ================= */
  var T = 84, SLOT = [84, 160], ARM_L = 202, IDLE_MS = 6000, TAP_MS = 250, LONG_MS = 420, PULSE = 3600;
  var ANCH = ["tl", "tc", "tr", "ml", "mr", "bl", "bc", "br"];
  var RM = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function K() { return Math.min(1, (Math.min(w.innerWidth, w.innerHeight) - 20) / (2 * ARM_L)); }
  var insetCache = null;
  function insets() {
    if (insetCache) return insetCache;
    var p = d.createElement("div"); p.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    d.body.appendChild(p); var c = getComputedStyle(p);
    insetCache = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
    p.remove(); return insetCache;
  }
  function anchorPt(a) {
    var W = w.innerWidth, H = w.innerHeight, i = insets(), m = 60 * K();
    var x = a[1] === "l" ? m + i.l : a[1] === "r" ? W - m - i.r : W / 2, y = a[0] === "t" ? m + i.t : a[0] === "b" ? H - m - i.b : H / 2;
    if (a === "ml") x = m + i.l; if (a === "mr") x = W - m - i.r;
    return { x: x, y: y };
  }
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
  var px, py, arm, navP = [], fanP = [], arms, geo = { pol: [], R: 0 };
  var E = {}, itemEls = [], fanEls = [], fanList = [], shown = [], overflow = [];
  var allowed = null, dragging = false;

  function build() {
    if (!d.getElementById("sa-nav-css")) { var s = d.createElement("style"); s.id = "sa-nav-css"; s.textContent = CSS; d.head.appendChild(s); }
    root = d.createElement("div"); root.id = "sa-nav-root";
    root.innerHTML = '<div class="san-scrim" aria-hidden="true"></div><div class="san-catch"></div><div class="san-dots" aria-hidden="true"></div>' +
      '<nav class="san-nav" aria-label="Navegación"><div class="san-arms"><div class="san-arm san-grain"></div><div class="san-arm san-grain"></div></div><div class="san-fan"></div><div class="san-items"></div>' +
      '<div class="san-abs san-core"><span class="san-led"><span class="san-glow"></span><span class="san-ring"></span></span>' +
      '<button type="button" class="san-face" data-mode="idle" aria-label="Abrir menú" aria-expanded="false"><span class="san-stone"><span class="san-lit"></span></span>' +
      '<span class="san-g san-g-spark">' + SPARK + '</span><span class="san-g san-g-home">' + svg(P.home, 22) + '<span class="san-t"></span></span><span class="san-g san-g-x">' + SPARK + '<span class="san-t">Cerrar</span></span></button></div></nav>' +
      '<div class="san-hint" role="note"><span><b>Toca</b> · pantallas</span><span><b>Doble toque</b> · apps</span><span><b>Mantén</b> · mover</span></div>';
    d.body.appendChild(root);
    E.scrim = root.querySelector(".san-scrim"); E.catch = root.querySelector(".san-catch"); E.dots = root.querySelector(".san-dots");
    E.nav = root.querySelector(".san-nav"); E.arms = root.querySelectorAll(".san-arm"); E.fan = root.querySelector(".san-fan"); E.items = root.querySelector(".san-items");
    E.core = root.querySelector(".san-core"); E.face = root.querySelector(".san-face"); E.lbl = root.querySelector(".san-g-home .san-t"); E.hint = root.querySelector(".san-hint");
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
  function render() {
    if (!root) return;
    E.nav.style.transform = "translate(" + px.x + "px," + py.x + "px) scale(" + K() + ")";
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
  function placeScrim() { var a = st.anchor; E.scrim.dataset.e = isCorner(a) ? a : a === "bc" ? "b" : a === "tc" ? "t" : a === "ml" ? "l" : "r"; }
  function onHome() { return cfg.current === cfg.home.k; }
  function setCoreLbl() {
    E.lbl.textContent = !onHome() ? cfg.home.l : (cfg.app !== "hub" ? "Hub" : "Cerrar");
    var m = E.face.dataset.mode;
    E.face.setAttribute("aria-label", m === "home" ? "Ir a " + E.lbl.textContent : m === "close" ? "Cerrar" : "Abrir menú");
  }
  var surgeT = null;
  function surge() { E.core.classList.remove("surge"); void E.core.offsetWidth; E.core.classList.add("surge"); clearTimeout(surgeT); surgeT = setTimeout(function () { if (E.core) E.core.classList.remove("surge"); }, 1100); }
  function applyState(prev) {
    var s = st.S, open = s === 2 || s === 4, fan = s === 3 || s === 4;
    E.scrim.classList.toggle("open", s !== 1);
    cancelPend(navP.concat(fanP, arm));
    arms = armsFor(st.anchor);
    arm.forEach(function (sp) { open ? sp.to(ARM_L, .78, .84) : sp.to(0, .62, 1); });
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
  function nope() { E.face.animate && E.face.animate([{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "-2px 0" }, { translate: "0 0" }], { duration: 420, easing: "ease-out" }); }
  function multi() { return APPS.filter(function (a) { return a.k !== cfg.app && (!allowed || allowed.indexOf(a.k) >= 0); }).length > 0; }
  function onSingle() { activity(); if (st.S === 1) setS(2); else if (st.S === 2) goHome(); else if (st.S === 3) setS(1); else setS(2); }
  function onDouble() {
    activity();
    if (!multi()) { nope(); return; }
    if (st.S === 1) openFan("apps"); else if (st.S === 2) openFan("apps"); else if (st.S === 3) setS(1); else setS(2);
  }

  /* ================= gestos del botón central ================= */
  var downAt = null, lpT = null, tapT = null, chT = null, grab = [0, 0], hist = [], prevS = 1, moved = false;
  function unCharge() { clearTimeout(chT); E.core.classList.remove("charge"); E.face.classList.remove("charge"); }
  function release() { clearTimeout(lpT); unCharge(); E.face.classList.remove("pressed"); E.core.classList.remove("hot"); }
  function bindCore() {
    var f = E.face;
    f.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return; e.preventDefault();
      try { f.setPointerCapture(e.pointerId); } catch (x) {}
      f.classList.add("pressed"); E.core.classList.add("hot"); moved = false;
      downAt = [e.clientX, e.clientY]; grab = [e.clientX - px.x, e.clientY - py.x];
      clearTimeout(lpT); lpT = setTimeout(startDrag, LONG_MS);
      clearTimeout(chT); chT = setTimeout(function () { if (downAt && !moved) { E.core.classList.add("charge"); f.classList.add("charge"); } }, 170);
      activity(); hideHint();
    });
    f.addEventListener("pointermove", function (e) {
      if (!downAt) return;
      if (dragging) { var x = e.clientX - grab[0], y = e.clientY - grab[1]; px.x = px.t = x; py.x = py.t = y; px.v = py.v = 0; hist.push({ x: x, y: y, t: performance.now() }); if (hist.length > 8) hist.shift(); markNear(x, y); kick(); return; }
      if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 10) { moved = true; release(); }
    });
    function up(cancel) {
      if (!downAt) return; release(); downAt = null;
      if (dragging) { endDrag(); return; }
      if (cancel || moved) return;
      if (!multi() || st.S === 3 || st.S === 4) { onSingle(); return; }
      if (tapT) { clearTimeout(tapT); tapT = null; onDouble(); } else tapT = setTimeout(function () { tapT = null; onSingle(); }, TAP_MS);
    }
    f.addEventListener("pointerup", function () { up(false); });
    f.addEventListener("pointercancel", function () { up(true); });
    f.addEventListener("click", function (e) { e.preventDefault(); });
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
  function onKey(e) { if (e.key === "Escape" && root && st.S !== 1) setS(1); }
  function placeDots() { E.dots.querySelectorAll(".san-dot").forEach(function (s) { var p = anchorPt(s.dataset.a); s.style.left = p.x + "px"; s.style.top = p.y + "px"; }); }
  function startDrag() {
    unCharge(); E.scrim.classList.add("moving"); dragging = true; prevS = st.S;
    E.face.classList.remove("pressed"); E.face.classList.add("lift"); E.core.classList.add("lifted"); d.body.classList.add("san-dragging");
    try { getSelection().removeAllRanges(); } catch (e) {}
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    st.S = 1; cancelPend(navP.concat(fanP, arm));
    arm.forEach(function (s) { s.to(0, .26, 1); }); navP.forEach(function (s) { s.to(0, .2, 1); }); fanP.forEach(function (s) { s.to(0, .2, 1); });
    E.face.dataset.mode = "idle"; E.catch.classList.remove("on");
    placeDots(); E.dots.classList.add("on"); hist = [{ x: px.x, y: py.x, t: performance.now() }]; kick();
  }
  function project(v) { var dd = .99; return (v / 1000) * dd / (1 - dd); }
  function nearest(x, y) { var b = null, bd = 1e9; ANCH.forEach(function (a) { var p = anchorPt(a), dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; b = a; } }); return b; }
  function markNear(x, y) { var n = nearest(x, y); E.dots.querySelectorAll(".san-dot").forEach(function (s) { s.classList.toggle("near", s.dataset.a === n); }); }
  function endDrag() {
    dragging = false; E.face.classList.remove("lift"); E.core.classList.remove("lifted", "hot"); d.body.classList.remove("san-dragging"); E.dots.classList.remove("on");
    var a = hist[0], b = hist[hist.length - 1], dt = Math.max(16, b.t - a.t), vx = (b.x - a.x) / dt * 1000, vy = (b.y - a.y) / dt * 1000;
    if (performance.now() - b.t > 90) vx = vy = 0;
    moveTo(nearest(px.x + project(vx), py.x + project(vy)), vx, vy);
    if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
  }
  function moveTo(a, vx, vy) {
    st.anchor = a; setCk("sa_nav_pos", a);
    var p = anchorPt(a); px.to(p.x, .46, .78, vx); py.to(p.y, .46, .78, vy); placeScrim();
    setTimeout(function () { if (E.scrim) E.scrim.classList.remove("moving"); }, 250);
    var back = (prevS === 2 || prevS === 4) ? 2 : 1; prevS = 1;
    setTimeout(function () { if (!root) return; st.S = 0; setS(back); }, 170);
  }
  function onResize() { if (!root) return; insetCache = null; var p = anchorPt(st.anchor); px.x = px.t = p.x; py.x = py.t = p.y; geo = fanGeo(st.anchor, fanEls.length, st.S === 2 || st.S === 4); kick(); }

  /* ================= pulso: un solo reloj para luz y tamaño ================= */
  var beatOn = false;
  function beat(t) {
    if (!root) { beatOn = false; return; }
    if (!d.hidden && !root.hidden) E.nav.style.setProperty("--p", ((1 - Math.cos(2 * Math.PI * ((t % PULSE) / PULSE))) / 2).toFixed(3));
    requestAnimationFrame(beat);
  }

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
      var ap = prof.apps || {}; allowed = Object.keys(ap).filter(function (k) { return !!ap[k]; });
      if (/admin/i.test(String(prof.rol || prof.role || ""))) allowed = APPS.map(function (a) { return a.k; });
      if (allowed.indexOf(cfg.app) < 0) allowed.push(cfg.app);
      if (st.fan === "apps") buildFan("apps");
    });
  }

  /* ================= API ================= */
  w.SANav = {
    mount: function (c) {
      if (root) { this.update(c); return; }
      cfg = Object.assign({ items: [], current: c && c.home ? c.home.k : "" }, c);
      build();
      var sv = getCk("sa_nav_pos"); if (sv && ANCH.indexOf(sv) >= 0) st.anchor = sv;
      try { var ss = JSON.parse(sessionStorage.getItem("sa_nav_state") || "null"); if (ss && ss.S === 2 && Date.now() - ss.t < IDLE_MS) st.S = 2; } catch (e) {}
      var p0 = anchorPt(st.anchor); px = S(p0.x, true); py = S(p0.y, true); arm = [S(0, true), S(0, true)];
      arms = armsFor(st.anchor);
      loadAllowed(); buildItems(); buildFan("apps"); placeScrim(); placeDots();
      if (cfg.hidden) root.hidden = true;
      if (RM) E.nav.style.setProperty("--p", ".5"); else if (!beatOn) { beatOn = true; requestAnimationFrame(beat); }
      w.addEventListener("resize", onResize); d.addEventListener("keydown", onKey);
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
      w.removeEventListener("resize", onResize); d.removeEventListener("keydown", onKey);
      clearTimeout(idleT); root.remove(); root = null; springs = []; pend = []; running = false; cfg = null; E = {};
    },
    icons: Object.keys(P)
  };
})(window, document);
