/* Escritorio de Alma en la computadora (Juan, 21-nov-2026, opción A de los prototipos estilo macOS).
   · Dock abajo al centro, solo en pantalla ancha con ratón: las 6 apps (Hub, Hola, Epi, Grow, Mi, Docs) y lo que tú agregues
     (Pregúntale a Alma, Llamar a Alma, Archivos, Compañero, Ajustes). Es editable: clic derecho en el Dock (o el botón del
     final) → quitar con «−», reordenar arrastrando (o con ← →) y «+» para agregar. Se guarda por persona en este navegador.
   · Buscador de Alma: el campo debajo de la roca. Lo que escribes busca apps (aquí mismo) y reservas, huéspedes,
     propiedades y contactos (el Hub, ALMA.buscar → apps-script/buscador.js); la fila «Pregúntale a Alma: <texto>» abre el
     Chat con Alma con esa pregunta ya enviada (SANav.chat). ⌘K o Ctrl+K lo enfoca.
   Lo puro (dock y filas) se prueba en Node: .github/escritorio.js. */
(function (raiz) {
  "use strict";

  var HUB = "https://hub.spacioam.com";
  var I = {
    hub: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    hola: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2M14 8l2 2"/>',
    epi: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3L15 12l-3-3z"/>',
    grow: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><path d="M15 8h3v3"/>',
    mi: '<ellipse cx="9" cy="7" rx="5.5" ry="2.6"/><path d="M3.5 7v4c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V7"/><path d="M9.5 16.2c.9 1.3 3 2.2 5.5 2.2 3 0 5.5-1.2 5.5-2.6v-4c0-1.2-1.8-2.2-4.3-2.5"/>',
    docs: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4A8 8 0 1 1 20 12z"/>',
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    arch: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.2h7.4A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 10.5h18"/>',
    comp: '<rect x="2.5" y="4" width="12" height="16" rx="2"/><rect x="16" y="8.5" width="5.5" height="11.5" rx="1.4"/><path d="M7.5 17h2"/><path d="M18 17.2h1.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    casa: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z"/>',
    llave: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2"/>',
    persona: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3"/>',
    mas: '<path d="M12 5v14M5 12h14"/>', menos: '<path d="M6 12h12"/>', editar: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>'
  };
  /* El catálogo del Dock: las 6 apps (van por defecto) y lo que se puede agregar. */
  var CATALOGO = [
    { k: "hub", n: "Hub", desc: "Centro", c: "#4A4B4B", i: "hub", url: HUB, app: 1 },
    { k: "hola", n: "Hola", desc: "Huéspedes", c: "#E3A47F", i: "hola", url: "https://hola.spacioam.com", app: 1 },
    { k: "epi", n: "Epi", desc: "Operación", c: "#6F9695", i: "epi", url: "https://epi.spacioam.com", app: 1 },
    { k: "grow", n: "Grow", desc: "Proyectos", c: "#8DB088", i: "grow", url: "https://grow.spacioam.com", app: 1 },
    { k: "mi", n: "Mi", desc: "Finanzas", c: "#C4A161", i: "mi", url: "https://mi.spacioam.com", app: 1 },
    { k: "docs", n: "Docs", desc: "Contratos", c: "#A98C93", i: "docs", url: "https://docs.spacioam.com", app: 1 },
    { k: "preguntar", n: "Pregúntale a Alma", desc: "Chat con Alma", c: "#E9826A", i: "chat" },
    { k: "llamar", n: "Llamar a Alma", desc: "Voz", c: "#7FAE7A", i: "tel" },
    { k: "archivos", n: "Archivos", desc: "Lo que le pasaste a Alma", c: "#CDAF8C", i: "arch" },
    { k: "companero", n: "Compañero", desc: "La llamada de tu otro dispositivo", c: "#8FA5C8", i: "comp" },
    { k: "ajustes", n: "Ajustes", desc: "Alma y tu cuenta", c: "#8A8580", i: "gear" }
  ];
  var DEF = ["hub", "hola", "epi", "grow", "mi", "docs"];
  var POR_K = {}; CATALOGO.forEach(function (x) { POR_K[x.k] = x; });

  /* ── Lo puro ── */
  /* Dónde se guarda el Dock de cada persona (en este navegador). */
  function dockClave(correo) { return "sa_dock:" + String(correo || "yo").trim().toLowerCase(); }
  /* La lista guardada → la que se pinta: solo claves del catálogo, sin repetir, y apps que la persona puede abrir.
     Sin nada guardado (o roto): las 6 apps (las permitidas). permitidas: claves de apps (null = todas). */
  function dockNormalizar(lista, permitidas) {
    var ok = function (k) { var x = POR_K[k]; return !!x && (!x.app || !permitidas || permitidas.indexOf(k) >= 0); };
    if (!Array.isArray(lista)) return DEF.filter(ok);
    var visto = {}, out = [];
    lista.forEach(function (k) { k = String(k || ""); if (!visto[k] && ok(k)) { visto[k] = 1; out.push(k); } });
    return out;
  }
  function dockMover(lista, k, paso) {
    var L = lista.slice(), i = L.indexOf(k), j = i + paso; if (i < 0 || j < 0 || j >= L.length) return L;
    L.splice(i, 1); L.splice(j, 0, k); return L;
  }
  function dockPoner(lista, k, antesDe) {
    var L = lista.filter(function (x) { return x !== k; }), j = antesDe ? L.indexOf(antesDe) : -1;
    if (j < 0) L.push(k); else L.splice(j, 0, k); return L;
  }
  function dockQuitar(lista, k) { return lista.filter(function (x) { return x !== k; }); }
  /* Lo que se puede agregar: lo del catálogo que no está (y las apps permitidas). */
  function dockFaltan(lista, permitidas) { return CATALOGO.filter(function (x) { return lista.indexOf(x.k) < 0 && (!x.app || !permitidas || permitidas.indexOf(x.k) >= 0); }); }

  var norm = function (t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); };
  /* Las filas del Buscador de Alma para q. datos = { reservas, propiedades, contactos } del Hub (o null mientras llega).
     Siempre hay una fila «Pregúntale a Alma: q»; va primero salvo que una app se llame exactamente como lo escrito. */
  function filasBuscador(q, datos, permitidas) {
    q = String(q || "").replace(/\s+/g, " ").trim(); if (!q) return [];
    var nq = norm(q), out = [];
    var preg = { tipo: "preguntar", titulo: "Pregúntale a Alma: " + q, pregunta: q, icono: "chat", grupo: "Alma" };
    var apps = CATALOGO.filter(function (x) { return x.app && (!permitidas || permitidas.indexOf(x.k) >= 0) && (norm(x.n).indexOf(nq) === 0 || norm(x.desc).indexOf(nq) >= 0); })
      .map(function (x) { return { tipo: "app", titulo: x.n, detalle: x.desc, url: x.url, k: x.k, icono: x.i, color: x.c, grupo: "Apps", exacta: norm(x.n) === nq }; });
    if (apps.some(function (a) { return a.exacta; })) out = apps.concat([preg]); else out = [preg].concat(apps);
    var D = datos || {};
    (D.reservas || []).forEach(function (r) {
      out.push({ tipo: "reserva", titulo: (r.huesped || r.codigo) + (r.cancelada ? " · cancelada" : ""), detalle: [r.propiedad, fechas(r.entrada, r.salida), r.codigo].filter(Boolean).join(" · "),
        codigo: r.codigo, icono: "llave", grupo: "Reservas y huéspedes" });
    });
    (D.propiedades || []).forEach(function (p) { out.push({ tipo: "propiedad", titulo: p.nombre, detalle: "Propiedad", nombre: p.nombre, icono: "casa", grupo: "Propiedades" }); });
    (D.contactos || []).forEach(function (c) { out.push({ tipo: "contacto", titulo: c.nombre, detalle: [c.tipo, c.empresa].filter(Boolean).join(" · "), nombre: c.nombre, icono: "persona", grupo: "Contactos" }); });
    return out;
  }
  var MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fecha(f) { var m = String(f || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + " " + MES[+m[2] - 1] : ""; }
  function fechas(a, b) { var x = fecha(a), y = fecha(b); return x && y ? x + " – " + y : x || y; }
  /* Qué hace cada fila: { abrir: url } o { chat: texto } (lo pregunta en el Chat con Alma). */
  function accionFila(f) {
    if (!f) return null;
    if (f.tipo === "preguntar") return { chat: f.pregunta };
    if (f.tipo === "app") return { abrir: f.url };
    if (f.tipo === "reserva") return { abrir: HUB + "/?conv=" + encodeURIComponent(f.codigo) };
    if (f.tipo === "propiedad") return { chat: "¿Cómo está " + f.nombre + "?" };
    if (f.tipo === "contacto") return { chat: "¿Qué sabes de " + f.nombre + "?" };
    return null;
  }

  var nucleo = { CATALOGO: CATALOGO, DEF: DEF, dockClave: dockClave, dockNormalizar: dockNormalizar, dockMover: dockMover, dockPoner: dockPoner, dockQuitar: dockQuitar,
    dockFaltan: dockFaltan, filasBuscador: filasBuscador, accionFila: accionFila };
  if (typeof module !== "undefined" && module.exports) module.exports = nucleo;
  if (typeof window === "undefined" || !raiz.document) return;

  /* ── En la página (alma/inicio.html) ── */
  var w = raiz, d = w.document;
  if (w.AlmaEscritorio) return;
  var MQ = w.matchMedia ? w.matchMedia("(min-width: 1100px) and (hover: hover) and (pointer: fine)") : null;
  var RM = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var svg = function (p, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[p] || p) + "</svg>"; };
  var el = function (tag, cls, html) { var x = d.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; };
  var permitidas = null, E = {}, ED = false;

  /* ── Estilo (vidrio claro de Alma sobre el atardecer del inicio) ── */
  var CSS = [
    "html:not(.esc-on) .esc-dock,html:not(.esc-on) .esc-busca,html:not(.esc-on) .esc-agregar-menu{display:none!important}",
    ".esc-dock{position:fixed;left:50%;bottom:10px;translate:-50% 0;z-index:895;display:flex;align-items:flex-end;gap:6px;padding:7px 9px;border-radius:24px;background:rgba(255,253,251,.24);-webkit-backdrop-filter:blur(24px) saturate(180%) brightness(1.06);backdrop-filter:blur(24px) saturate(180%) brightness(1.06);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5),inset 0 1px 0 rgba(255,255,255,.4),0 18px 40px -16px rgba(50,30,40,.35)}",
    ".esc-dock[hidden]{display:none}",
    /* el Dock por encima de todo menos de las hojas: con el chat, Pendientes o las áreas abiertas se esconde */
    "body.san-hoja .esc-dock,body.orbita-on .esc-dock,body.entrando .esc-dock,html.tv-on .esc-dock,html.tvb-on .esc-dock{opacity:0;pointer-events:none;translate:-50% 30px}",
    ".esc-dock{transition:opacity .25s ease,translate .35s cubic-bezier(.22,.61,.36,1)}",
    ".esc-it{position:relative;width:var(--s,52px);height:var(--s,52px);flex:none;display:grid;place-items:center;padding:0;border:0;background:transparent;cursor:pointer;transition:width .12s ease-out,height .12s ease-out;-webkit-tap-highlight-color:transparent}",
    ".esc-it .ico{width:100%;height:100%;border-radius:23%;display:grid;place-items:center;color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--c,#8A8580) 76%,white) 0%,var(--c,#8A8580) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.08),0 4px 10px -4px rgba(40,25,25,.45)}",
    ".esc-it .ico svg{width:52%;height:52%}",
    ".esc-ctl .ico{border-radius:50%;width:78%;height:78%;margin:auto;background:rgba(255,255,255,.22);color:#FFFDFB;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5)}",
    ".esc-div{width:.5px;align-self:stretch;margin:6px 3px;background:rgba(255,255,255,.5);flex:none}",
    ".esc-it .tip{position:absolute;bottom:calc(100% + 12px);left:50%;translate:-50% 0;padding:5px 11px;border-radius:8px;white-space:nowrap;pointer-events:none;background:rgba(40,32,34,.8);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;font:500 12px Montserrat,system-ui,sans-serif;opacity:0;transition:opacity .12s}",
    ".esc-it:hover .tip,.esc-it:focus-visible .tip{opacity:1}.esc-dock.editando .esc-it .tip{display:none}",
    ".esc-it:focus-visible{outline:none}.esc-it:focus-visible .ico{box-shadow:0 0 0 2.5px #FFFDFB,0 0 0 5px rgba(233,130,106,.9)}",
    ".esc-it.salta .ico{animation:esc-salta .9s cubic-bezier(.3,1.35,.55,1)}@keyframes esc-salta{30%{transform:translateY(-14px)}60%{transform:none}75%{transform:translateY(-5px)}}",
    ".esc-dock.editando .esc-it[data-k] .ico{animation:esc-tiembla .32s ease-in-out infinite alternate}.esc-dock.editando .esc-it[data-k]:nth-child(2n) .ico{animation-delay:-.16s}",
    "@keyframes esc-tiembla{from{rotate:-1.6deg}to{rotate:1.6deg}}",
    ".esc-it.arrastra{opacity:.35}",
    ".esc-it .quitar{position:absolute;top:-6px;left:-6px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#5A5555;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}.esc-it .quitar svg{width:12px;height:12px}",
    ".esc-listo{align-self:center;margin:0 4px 0 2px;height:34px;padding:0 16px;border:0;border-radius:17px;background:#FFFDFB;color:#3E3F3F;font:600 13px Montserrat,system-ui,sans-serif;cursor:pointer}",
    ".esc-agregar-menu{position:fixed;left:50%;bottom:92px;translate:-50% 0;z-index:896;width:300px;max-height:60vh;overflow:auto;padding:6px;border-radius:18px;background:rgba(255,253,251,.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 2px 6px rgba(0,0,0,.05),0 20px 50px -14px rgba(50,30,40,.4)}",
    ".esc-agregar-menu[hidden]{display:none}.esc-agregar-menu button{display:flex;align-items:center;gap:12px;width:100%;padding:8px 10px;border:0;border-radius:12px;background:transparent;text-align:left;cursor:pointer;font-family:Montserrat,system-ui,sans-serif}",
    ".esc-agregar-menu button:hover,.esc-agregar-menu button:focus-visible{background:#F3EFEB;outline:none}.esc-agregar-menu .ico{width:34px;height:34px;flex:none;border-radius:9px;display:grid;place-items:center;color:#fff;background:var(--c)}.esc-agregar-menu .ico svg{width:55%;height:55%}",
    ".esc-agregar-menu b{display:block;font-size:14px;font-weight:600;color:#262423}.esc-agregar-menu small{display:block;font-size:12px;color:#8F8883}.esc-agregar-menu .vacio{margin:10px;font:500 13px Montserrat,system-ui,sans-serif;color:#8F8883}",
    /* Buscador de Alma: debajo de la roca (y de «Toca a Alma»), encima de los botones. Solo con la roca quieta. */
    "html.esc-on #sa-nav-root .san-ov-ui{width:min(480px,calc(100% - 48px))}",
    ".esc-busca{position:relative;width:100%;z-index:4}",
    "#sa-nav-root .san-ov:not(.quieta) .esc-busca{display:none}",
    "html.esc-on #sa-nav-root .san-ov.quieta .san-ov-cap:empty{min-height:0}",
    ".esc-busca .res.arriba{top:auto;bottom:calc(100% + 8px)}",
    ".esc-busca .campo{display:flex;align-items:center;gap:10px;height:48px;padding:0 10px 0 16px;box-sizing:border-box;border-radius:24px;background:rgba(255,253,251,.3);-webkit-backdrop-filter:blur(22px) saturate(170%);backdrop-filter:blur(22px) saturate(170%);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.6),0 14px 30px -18px rgba(50,30,40,.45);color:#FFFDFB;cursor:text;transition:background .2s,box-shadow .2s}",
    ".esc-busca .campo:focus-within{background:rgba(255,253,251,.94);color:#3E3F3F;box-shadow:inset 0 0 0 1px rgba(233,130,106,.55),0 18px 40px -18px rgba(50,30,40,.5)}",
    ".esc-busca .campo svg{width:18px;height:18px;flex:none;opacity:.9}",
    ".esc-busca input{flex:1;min-width:0;height:100%;border:0;outline:none;background:transparent;font:500 15px Montserrat,system-ui,sans-serif;color:inherit;-webkit-appearance:none;appearance:none}",
    ".esc-busca input::placeholder{color:rgba(255,253,251,.88)}.esc-busca .campo:focus-within input::placeholder{color:#9A938E}.esc-busca input::-webkit-search-cancel-button{display:none}",
    ".esc-busca kbd{flex:none;font:600 11px Montserrat,system-ui,sans-serif;padding:3px 7px;border-radius:7px;background:rgba(255,255,255,.22);color:inherit;opacity:.85}.esc-busca .campo:focus-within kbd{background:#F1EEEA}",
    ".esc-busca .res{position:absolute;left:0;right:0;top:calc(100% + 8px);max-height:min(52vh,420px);overflow:auto;padding:6px;border-radius:20px;background:rgba(255,253,251,.97);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 2px 6px rgba(0,0,0,.05),0 24px 60px -18px rgba(50,30,40,.5);text-align:left}",
    ".esc-busca .res[hidden]{display:none}",
    ".esc-busca .gr{padding:10px 12px 4px;font:600 10.5px Montserrat,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9A938E}",
    ".esc-busca .fila{display:flex;align-items:center;gap:12px;min-height:48px;padding:6px 10px;border-radius:13px;cursor:pointer}",
    ".esc-busca .fila.sel{background:#F3EFEB}.esc-busca .fila.preguntar.sel{background:#FCEDE8}",
    ".esc-busca .fila .ic{width:34px;height:34px;flex:none;border-radius:10px;display:grid;place-items:center;background:var(--c,#F1EEEA);color:#5A5555}.esc-busca .fila .ic[style] {color:#fff}.esc-busca .fila .ic svg{width:18px;height:18px}",
    ".esc-busca .fila.preguntar .ic{border-radius:50%;background:radial-gradient(circle at 34% 28%,#fff 0 12%,#FCF8F2 30%,#F1E6D8 62%,#DDC6AE 100%);color:#C9705E;box-shadow:0 0 0 1px rgba(62,63,63,.08),0 0 8px 1px rgba(233,130,106,.4)}",
    ".esc-busca .fila .tx{min-width:0;flex:1}.esc-busca .fila b{display:block;font:600 14px/1.25 Montserrat,system-ui,sans-serif;color:#262423;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".esc-busca .fila small{display:block;font:400 12px/1.3 Montserrat,system-ui,sans-serif;color:#8F8883;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".esc-busca .cargando{padding:10px 14px;font:500 12.5px Montserrat,system-ui,sans-serif;color:#9A938E}",
    "@media (prefers-reduced-motion:reduce){.esc-it,.esc-dock{transition:none}.esc-dock.editando .esc-it[data-k] .ico,.esc-it.salta .ico{animation:none}}"
  ].join("\n");
  if (!d.getElementById("esc-css")) { var st0 = d.createElement("style"); st0.id = "esc-css"; st0.textContent = CSS; (d.head || d.documentElement).appendChild(st0); }

  function correo() { try { var p = w.SASesion && w.SASesion.perfilRapido ? w.SASesion.perfilRapido() : null; return (p && p.email) || ""; } catch (e) { return ""; } }
  function dockLeer() { var v = null; try { v = JSON.parse(localStorage.getItem(dockClave(correo())) || "null"); } catch (e) {} return dockNormalizar(v, permitidas); }
  function dockGuardar(L) { try { localStorage.setItem(dockClave(correo()), JSON.stringify(L)); } catch (e) {} }

  function hacer(k) {
    var x = POR_K[k]; if (!x) return;
    if (x.url) { w.open(x.url, "_blank", "noopener"); return; }
    var clic = function (id) { var b = d.getElementById(id); if (b) b.click(); };
    if (k === "preguntar") { if (w.SANav && w.SANav.chat) w.SANav.chat({}); }
    else if (k === "llamar") { if (w.SANav && w.SANav.alma) w.SANav.alma(); }
    else if (k === "archivos") clic("b-arch");
    else if (k === "companero") clic("b-comp");
    else if (k === "ajustes") clic("b-ajustes");
  }

  /* ── Dock ── */
  function dockPintar() {
    var L = dockLeer(), dk = E.dock; dk.innerHTML = "";
    dk.classList.toggle("editando", ED);
    L.forEach(function (k) {
      var x = POR_K[k], it = el("button", "esc-it");
      it.type = "button"; it.dataset.k = k; it.setAttribute("aria-label", ED ? x.n + ": arrástralo para moverlo o usa las flechas" : x.n + (x.app ? " · " + x.desc : ""));
      it.innerHTML = '<span class="ico" style="--c:' + x.c + '">' + svg(x.i) + '</span><span class="tip">' + x.n + (x.app ? " · " + x.desc : "") + "</span>" +
        (ED ? '<span class="quitar" role="button" aria-label="Quitar ' + x.n + ' del Dock">' + svg("menos", 2.6) + "</span>" : "");
      it.draggable = ED;
      dk.appendChild(it);
    });
    dk.appendChild(el("i", "esc-div"));
    if (ED) {
      var mas = el("button", "esc-it esc-ctl esc-agregar", '<span class="ico">' + svg("mas", 2) + '</span><span class="tip">Agregar al Dock</span>'); mas.type = "button"; mas.setAttribute("aria-label", "Agregar al Dock"); mas.setAttribute("aria-haspopup", "menu"); dk.appendChild(mas);
      var listo = el("button", "esc-listo", "Listo"); listo.type = "button"; dk.appendChild(listo);
    } else {
      var ed = el("button", "esc-it esc-ctl esc-editar", '<span class="ico">' + svg("editar", 2) + '</span><span class="tip">Editar el Dock</span>'); ed.type = "button"; ed.setAttribute("aria-label", "Editar el Dock"); dk.appendChild(ed);
    }
    tamanos(null);
  }
  /* Aumento al pasar el ratón, como el Dock de la Mac: los vecinos crecen menos y se abren paso. */
  var BASE = 52, MAX = 1.5, RANGO = 140;
  function tamanos(x) {
    Array.prototype.forEach.call(E.dock.querySelectorAll(".esc-it"), function (it) {
      var s = 1; if (x != null && !RM && !ED) { var r = it.getBoundingClientRect(), dd = Math.abs(x - (r.left + r.width / 2)); s = dd > RANGO ? 1 : 1 + (MAX - 1) * Math.cos(dd / RANGO * Math.PI / 2); }
      it.style.setProperty("--s", Math.round(BASE * s) + "px");
    });
  }
  function editar(on) { ED = !!on; menuAgregar(false); dockPintar(); var f = E.dock.querySelector(on ? ".esc-it" : ".esc-editar"); if (f) try { f.focus(); } catch (e) {} }
  function menuAgregar(on) {
    var m = E.agregar; if (!m) return;
    if (!on) { m.hidden = true; return; }
    var falta = dockFaltan(dockLeer(), permitidas); m.innerHTML = "";
    if (!falta.length) m.appendChild(el("p", "vacio", "Ya está todo en tu Dock."));
    falta.forEach(function (x) {
      var b = el("button", "", '<span class="ico" style="--c:' + x.c + '">' + svg(x.i) + "</span><span><b></b><small></small></span>"); b.type = "button"; b.setAttribute("role", "menuitem");
      b.querySelector("b").textContent = x.n; b.querySelector("small").textContent = x.desc;
      b.onclick = function () { var L = dockPoner(dockLeer(), x.k); dockGuardar(L); dockPintar(); menuAgregar(true); };
      m.appendChild(b);
    });
    m.hidden = false; var p = m.querySelector("button"); if (p) try { p.focus(); } catch (e) {}
  }
  function dockMontar() {
    var dk = E.dock = el("nav", "esc-dock"); dk.setAttribute("aria-label", "Dock");
    var ag = E.agregar = el("div", "esc-agregar-menu"); ag.setAttribute("role", "menu"); ag.setAttribute("aria-label", "Agregar al Dock"); ag.hidden = true;
    d.body.appendChild(dk); d.body.appendChild(ag);
    dk.addEventListener("mousemove", function (e) { tamanos(e.clientX); });
    dk.addEventListener("mouseleave", function () { tamanos(null); });
    dk.addEventListener("contextmenu", function (e) { e.preventDefault(); editar(!ED); });
    dk.addEventListener("click", function (e) {
      var q = e.target.closest(".quitar"), it = e.target.closest(".esc-it");
      if (e.target.closest(".esc-listo")) { editar(false); return; }
      if (q && it) { dockGuardar(dockQuitar(dockLeer(), it.dataset.k)); dockPintar(); return; }
      if (!it) return;
      if (it.classList.contains("esc-editar")) { editar(true); return; }
      if (it.classList.contains("esc-agregar")) { menuAgregar(E.agregar.hidden); return; }
      if (ED) return;
      it.classList.remove("salta"); void it.offsetWidth; if (!RM) it.classList.add("salta");
      hacer(it.dataset.k);
    });
    dk.addEventListener("keydown", function (e) {
      var it = e.target.closest && e.target.closest(".esc-it[data-k]");
      if (e.key === "Escape" && ED) { e.preventDefault(); editar(false); return; }
      if (!ED || !it) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); var k = it.dataset.k; dockGuardar(dockMover(dockLeer(), k, e.key === "ArrowLeft" ? -1 : 1)); dockPintar(); var n = E.dock.querySelector('[data-k="' + k + '"]'); if (n) n.focus(); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); dockGuardar(dockQuitar(dockLeer(), it.dataset.k)); dockPintar(); }
    });
    /* Reordenar arrastrando (en modo editar). */
    var arr = null;
    dk.addEventListener("dragstart", function (e) { var it = e.target.closest(".esc-it[data-k]"); if (!ED || !it) { e.preventDefault(); return; } arr = it.dataset.k; it.classList.add("arrastra"); try { e.dataTransfer.setData("text/plain", arr); e.dataTransfer.effectAllowed = "move"; } catch (x) {} });
    dk.addEventListener("dragover", function (e) { if (arr) e.preventDefault(); });
    dk.addEventListener("drop", function (e) {
      if (!arr) return; e.preventDefault();
      var it = e.target.closest(".esc-it[data-k]"), antes = null;
      if (it && it.dataset.k !== arr) { var r = it.getBoundingClientRect(); if (e.clientX < r.left + r.width / 2) antes = it.dataset.k; else { var sig = it.nextElementSibling; antes = sig && sig.dataset && sig.dataset.k || null; } }
      if (it || e.target === dk) { dockGuardar(dockPoner(dockLeer(), arr, antes === arr ? null : antes)); }
      arr = null; dockPintar();
    });
    dk.addEventListener("dragend", function () { arr = null; Array.prototype.forEach.call(dk.querySelectorAll(".arrastra"), function (x) { x.classList.remove("arrastra"); }); });
    d.addEventListener("click", function (e) { if (E.agregar && !E.agregar.hidden && !E.agregar.contains(e.target) && !e.target.closest(".esc-agregar")) menuAgregar(false); });
    dockPintar();
  }

  /* ── Buscador de Alma ── */
  var B = { q: "", datos: null, filas: [], sel: 0, t: 0, pide: 0 };
  function buscadorMontar(ui) {
    var w0 = E.busca = el("div", "esc-busca"), id = "esc-busca-res";
    w0.innerHTML = '<label class="campo">' + svg("buscar", 2) + '<input type="search" autocomplete="off" spellcheck="false" placeholder="Busca o pregúntale a Alma" aria-label="Busca reservas, huéspedes, propiedades, contactos y apps, o pregúntale a Alma" role="combobox" aria-expanded="false" aria-controls="' + id + '" aria-autocomplete="list"><kbd>⌘K</kbd></label>' +
      '<div class="res" id="' + id + '" role="listbox" aria-label="Resultados" hidden></div>';
    var btns = ui.querySelector(".san-ov-btns"); ui.insertBefore(w0, btns || null);
    var inp = E.inp = w0.querySelector("input"), res = E.res = w0.querySelector(".res");
    if (/Win|Linux/.test(navigator.platform || "")) w0.querySelector("kbd").textContent = "Ctrl K";
    inp.addEventListener("input", function () { buscar(inp.value); });
    inp.addEventListener("focus", function () { if (inp.value.trim()) pintar(); });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!B.filas.length) return; B.sel = (B.sel + (e.key === "ArrowDown" ? 1 : -1) + B.filas.length) % B.filas.length; marcar(); }
      else if (e.key === "Enter") { e.preventDefault(); elegir(B.filas[B.sel]); }
      else if (e.key === "Escape") { if (inp.value) { inp.value = ""; buscar(""); } else inp.blur(); }
    });
    res.addEventListener("mousedown", function (e) { e.preventDefault(); });   // el campo no pierde el foco al hacer clic en una fila
    res.addEventListener("click", function (e) { var f = e.target.closest("[data-i]"); if (f) elegir(B.filas[+f.getAttribute("data-i")]); });
    res.addEventListener("mousemove", function (e) { var f = e.target.closest("[data-i]"); if (f && +f.getAttribute("data-i") !== B.sel) { B.sel = +f.getAttribute("data-i"); marcar(); } });
    inp.addEventListener("blur", function () { setTimeout(function () { if (d.activeElement !== inp) cerrar(); }, 120); });
    d.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K") && activo()) { e.preventDefault(); try { inp.focus(); inp.select(); } catch (x) {} } });
  }
  function buscar(q) {
    B.q = q = String(q || ""); B.datos = null; B.sel = 0; clearTimeout(B.t);
    if (!q.trim()) { cerrar(); return; }
    pintar();
    if (q.trim().length < 2 || !(w.ALMA && w.ALMA.buscar)) return;
    var n = ++B.pide;
    B.t = setTimeout(function () {
      w.ALMA.buscar(q.trim()).then(function (r) { if (n !== B.pide || q !== B.q) return; B.datos = r && r.ok ? r : { reservas: [], propiedades: [], contactos: [] }; pintar(); }, function () { if (n === B.pide) { B.datos = {}; pintar(); } });
    }, 260);
  }
  function pintar() {
    var q = B.q.trim(); B.filas = filasBuscador(q, B.datos, permitidas); if (B.sel >= B.filas.length) B.sel = 0;
    var res = E.res; res.innerHTML = ""; var grupo = "";
    B.filas.forEach(function (f, i) {
      if (f.grupo !== grupo && f.tipo !== "preguntar") { grupo = f.grupo; var g = el("div", "gr"); g.textContent = grupo; g.setAttribute("role", "presentation"); res.appendChild(g); }
      if (f.tipo === "preguntar") grupo = "";
      var r = el("div", "fila" + (f.tipo === "preguntar" ? " preguntar" : ""), '<span class="ic"' + (f.color ? ' style="--c:' + f.color + '"' : "") + ">" + svg(f.icono) + '</span><span class="tx"><b></b><small></small></span>');
      r.setAttribute("role", "option"); r.id = "esc-f" + i; r.setAttribute("data-i", i);
      r.querySelector("b").textContent = f.titulo; r.querySelector("small").textContent = f.detalle || (f.tipo === "preguntar" ? "Abre el chat con tu pregunta ya enviada" : "");
      res.appendChild(r);
    });
    if (B.datos === null && q.length >= 2 && w.ALMA && w.ALMA.buscar) res.appendChild(el("div", "cargando", "Buscando en reservas, propiedades y contactos…"));
    res.hidden = !B.filas.length; E.inp.setAttribute("aria-expanded", res.hidden ? "false" : "true");
    /* Si abajo no cabe (el Dock y el borde), la lista se abre hacia arriba, sobre la roca. */
    var rc = E.busca.getBoundingClientRect(), dk = E.dock && !E.dock.hidden ? E.dock.getBoundingClientRect().top : w.innerHeight;
    res.classList.toggle("arriba", dk - rc.bottom < Math.min(res.scrollHeight + 16, 320) && rc.top > dk - rc.bottom);
    marcar();
  }
  function marcar() {
    Array.prototype.forEach.call(E.res.querySelectorAll(".fila"), function (r) { var on = +r.getAttribute("data-i") === B.sel; r.classList.toggle("sel", on); r.setAttribute("aria-selected", on ? "true" : "false"); if (on && r.scrollIntoView) r.scrollIntoView({ block: "nearest" }); });
    E.inp.setAttribute("aria-activedescendant", B.filas.length ? "esc-f" + B.sel : "");
  }
  function cerrar() { if (!E.res) return; E.res.hidden = true; E.inp.setAttribute("aria-expanded", "false"); }
  function elegir(f) {
    var a = accionFila(f); if (!a) return;
    if (a.abrir) w.open(a.abrir, "_blank", "noopener");
    else if (a.chat && w.SANav && w.SANav.chat) w.SANav.chat({ texto: a.chat });
    E.inp.value = ""; buscar(""); try { E.inp.blur(); } catch (x) {}
  }

  /* ── Encender y apagar con el ancho de la pantalla ── */
  function activo() { return !!(MQ && MQ.matches); }
  function aplicar() {
    var on = activo(); d.documentElement.classList.toggle("esc-on", on);
    if (E.dock) E.dock.hidden = !on;
    if (!on) { cerrar(); if (ED) editar(false); }
  }
  function montar() {
    var ui = d.querySelector("#sa-nav-root .san-ov-ui");
    if (!ui) return false;
    if (!E.busca) buscadorMontar(ui);
    if (!E.dock) dockMontar();
    aplicar(); return true;
  }
  function arrancar() {
    if (montar()) return;
    var n = 0, t = setInterval(function () { if (montar() || ++n > 120) clearInterval(t); }, 250);
  }
  /* Las apps que la persona puede abrir (el perfil de la sesión; administradores, todas). */
  try {
    var v = w.SASesion && w.SASesion.verificar ? w.SASesion.verificar() : null;
    if (v && v.then) v.then(function (prof) {
      if (!prof) return;
      if (/admin/i.test(String(prof.rol || prof.role || ""))) { permitidas = null; }
      else { var ap = prof.apps || {}, no = /^(no|0|false|-|—|ninguno|sin acceso)?$/i; if (typeof ap === "string") ap = ap.split(/[\s,;]+/);
        permitidas = Array.isArray(ap) ? ap.map(function (k) { return String(k).toLowerCase(); }) : Object.keys(ap).filter(function (k) { return !no.test(String(ap[k] == null ? "" : ap[k]).trim()); }); }
      if (E.dock) dockPintar();
    }, function () {});
  } catch (e) {}
  if (MQ) { if (MQ.addEventListener) MQ.addEventListener("change", aplicar); else if (MQ.addListener) MQ.addListener(aplicar); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", arrancar); else arrancar();

  w.AlmaEscritorio = { nucleo: nucleo, dock: dockLeer, editar: editar, buscar: function (q) { if (E.inp) { E.inp.value = q; E.inp.focus(); buscar(q); } }, elegir: function (i) { elegir(B.filas[i || 0]); } };
})(typeof window !== "undefined" ? window : globalThis);
