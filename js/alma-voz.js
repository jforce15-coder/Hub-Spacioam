/* Spacio AM · Alma por voz dentro del Hub (proveedor del menú compartido, js/sa-nav.js)
   Al deslizar el botón del menú hacia el centro, el menú llama a SAAlmaVoz.start().
   Rápido y liviano:
   - SDK propio de ElevenLabs solo con websocket (js/vendor/eleven-ws.js, ~60 KB) en vez de 650 KB con WebRTC desde un CDN.
   - El agente pide autenticación (apps-script/vozacceso.js): se conecta SIEMPRE con una URL firmada que da el Hub a
     un administrador con sesión, nunca con solo el agent_id. Para no sumar espera, la URL se pide por adelantado (al
     abrir la página, al volver a ella, al tocarla si ya venció, al empezar a jalar el botón y con cada ficha) y se
     guarda 9 min, una sola vez.
   - La ficha del administrador (quién es, saludo) se guarda en el teléfono y se renueva en segundo plano;
     solo la primera vez se espera al Hub.
   - Si la conexión falla por la red, reintenta una vez sola.
   - Hablar con Claudio (#550): si Juan (el administrador principal) pide hablar con Claudio, Alma dice su frase y usa
     hablar_con_claudio; aquí se espera a que termine de hablar, se cierra su conversación y se abre la de Claudio (otro
     agente, otra voz, acción vozClaudio del Hub) en ~1 s, con el halo de la roca todo naranja. Claudio usa volver_con_alma
     y regresa Alma con su voz y su halo. El halo es una variable de CSS (--san-halo) que lee la roca de sa-nav e inicio.
   - Panel de Claudio (apps-script/claudiopanel.js): con Claudio, avisa a la página («sa-voz-claudio») cuándo entra, cuándo
     contesta una herramienta suya (claudio_…) y cuándo se va; la página pide el panel al Hub. Lo que Juan responde tocando
     el panel le llega a Claudio como contexto («sa-claudio-contexto»). */
(function (w) {
  "use strict";
  var SDK = new URL("vendor/eleven-ws.js?v=1.27.0a", (document.currentScript && document.currentScript.src) || location.href).href;
  var mod = null, modP = null;
  function loadSdk() { if (mod) return Promise.resolve(mod); if (!modP) modP = import(SDK).then(function (m) { mod = m; return m; }, function (e) { modP = null; throw e; }); return modP; }
  /* Proveedor de voz para el menú compartido. El Hub usa el de siempre (SAAlmaVoz); otra app crea el suyo con
     SAAlmaVoz.crear({
       clave: "gsp_alma_ficha",              ficha guardada en el teléfono (cada app la suya)
       ficha: () => Promise<{ ok, agent_id, dynamic_variables, first_message, signed_url }>,   quién habla (lo da la app)
       firma: () => Promise<{ ok, signed_url }>,   solo la URL firmada, sin la ficha (opcional: si falta, se pide la ficha)
       vincular: (conversationId) => Promise, liga la llamada en su servidor (opcional)
       contexto: (c) => texto,                qué hay en pantalla (opcional)
       campoContexto: "en_pantalla",          variable del agente donde va ese texto (opcional)
       primerMensaje: () => texto,            saludo de esta llamada según desde dónde se abrió (opcional)
       herramientas: { nombre: fn(params) },  herramientas del lado de la app (client tools de ElevenLabs)
       alMensaje: (origen, texto) => {},      para guardar la conversación donde corresponda (opcional)
       alTerminar: () => {}
     }) */
  function crear(o) {
  o = o || {};
  var KEY = o.clave || "sa_alma_voz_ficha", VIGENCIA = 12 * 3600e3, FIRMA_VIGENCIA = 9 * 60e3;
  var idP = null, idT = 0, ctx = null, ctxKey = "", vivo = null, firmaP = null;
  /* Conversación abierta en pantalla (la pone el Hub): si Juan dice «escríbele…» sin decir a quién, es esta. */
  function ctxTexto(c) {
    if (o.contexto) return o.contexto(c);
    if (!c) return "EN PANTALLA: no hay una conversación de huésped abierta. Si mencionan una reserva, un huésped o un apartamento, búscalo como siempre con secretaria.";
    var d = [c.huesped, c.propiedad, c.fechas].filter(Boolean).join(" · ");
    if (c.vista) return "EN PANTALLA: " + (c.nombre || "Juan") + " está en la sección «" + c.vista + "» del Hub" + (c.detalle ? " (" + c.detalle + ")" : "") + ". Úsalo como contexto de lo que pregunte; si menciona una reserva, persona o apartamento, búscalo con secretaria.";
    if (c.whatsapp) { var tel = String(c.conv_id || "").replace(/^wa:/, "").replace(/\D/g, ""); return "EN PANTALLA: " + (c.nombre || "Juan") + " tiene abierta la conversación de WhatsApp con " + (c.huesped || "un contacto") + (c.propiedad ? " (" + c.propiedad + ")" : "") + (c.codigo ? " · reserva " + c.codigo : "") + (tel ? " · número +" + tel : "") + ". Si dice «escríbele», «mándale», «respóndele», «pásale el código» o pregunta por esa persona sin nombrar a otra, es ESTA conversación: pásale a secretaria el nombre " + (c.huesped || "") + (tel ? ", el número +" + tel : "") + " y la conversación " + (c.conv_id || "") + " (para leerla: ver_conversacion con " + (c.conv_id || "") + "; para escribirle: escribir_a_equipo con ese número si es del equipo o un contacto de trabajo, o enviar_a_huesped por WhatsApp si es huésped). Solo si nombra a otra persona o reserva, búscala."; }
    if (false) return "EN PANTALLA: " + (c.nombre || "Juan") + " tiene abierta la conversación de WhatsApp con " + (c.huesped || "un contacto") + (c.codigo ? " (reserva " + c.codigo + ")" : "") + ". Si dice «escríbele», «respóndele», «mándale» o pregunta por esa persona sin decir otra, es ESTA conversación: pásale a secretaria el nombre " + (c.huesped || "") + (c.conv_id ? " y la conversación " + c.conv_id : "") + ". Solo si nombra a otra persona o reserva, búscala.";
    return "EN PANTALLA: " + (c.nombre || "Juan") + " tiene abierta en el Hub la conversación de la reserva " + (c.codigo || c.conv_id || "") + (d ? " (" + d + ")" : "") + ". " +
      "Si te pide algo sobre «la reserva», «el huésped», «esta conversación», «escríbele», «mándale», «respóndele», o cualquier cosa de una reserva sin decir cuál, es ESTA: no preguntes cuál ni la busques, pásale a secretaria el pedido completo incluyendo el código " + (c.codigo || c.conv_id || "") + (c.huesped ? " y el nombre " + c.huesped : "") + ". " +
      "Solo si nombra otra reserva, otro huésped u otro apartamento distinto, búscala y resuelve como siempre.";
  }
  function setContexto(c) {
    var k = c ? String(c.codigo || c.conv_id || ("vista:" + (c.vista || ""))) : "";
    if (k === ctxKey) { ctx = c; return; }
    ctx = c; ctxKey = k;
    if (vivo && vivo.sendContextualUpdate) { try { vivo.sendContextualUpdate("Cambió la pantalla. " + ctxTexto(c)); } catch (e) {} }
  }
  function leerFicha() { try { var j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && j.agent_id && Date.now() - j.t < VIGENCIA ? j : null; } catch (e) { return null; } }
  function guardarFicha(j) { try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), agent_id: j.agent_id, dynamic_variables: j.dynamic_variables || {}, first_message: j.first_message || "", language: j.language || "" })); } catch (e) {} }
  /* La URL firmada guardada: vale FIRMA_VIGENCIA (ElevenLabs da 15 min para conectarse) y se usa una sola vez. */
  var FKEY = KEY + ":firma";   // «:» para que se borre con la ficha al cerrar sesión (index.html, copiasBorrar)
  function leerFirma() { try { var j = JSON.parse(localStorage.getItem(FKEY) || "null"); return j && j.u && Date.now() - j.t < FIRMA_VIGENCIA ? j : null; } catch (e) { return null; } }
  function guardarFirma(u) { if (u) { try { localStorage.setItem(FKEY, JSON.stringify({ t: Date.now(), u: u })); } catch (e) {} } }
  function tomarFirma() { var f = leerFirma(); try { localStorage.removeItem(FKEY); } catch (e) {} return f ? f.u : ""; }
  /* Pide la ficha al Hub (como mucho una vez cada 20 s). Trae también una URL firmada: queda para la próxima llamada. */
  function renovar() {
    if (idP && Date.now() - idT < 20000) return idP;
    idT = Date.now();
    idP = (o.ficha ? Promise.resolve().then(o.ficha) : w.ALMA && w.ALMA.vozWeb ? w.ALMA.vozWeb() : Promise.resolve({ ok: false, error: "ALMA no disponible" })).then(function (j) {
      if (j && j.ok && j.agent_id) { guardarFicha(j); if (j.signed_url && !leerFirma()) guardarFirma(j.signed_url); }
      else idP = null;
      return j;
    }, function (e) { idP = null; throw e; });
    return idP;
  }
  /* Solo la URL firmada (acción vozFirma, liviana). Si el Hub no la da (versión anterior, error), la trae la ficha. */
  function pedirFirma() {
    if (firmaP) return firmaP;
    var pedir = o.firma ? Promise.resolve().then(o.firma) : o.ficha ? Promise.resolve(null) : w.ALMA && w.ALMA.vozFirma ? w.ALMA.vozFirma() : Promise.resolve(null);
    firmaP = pedir.then(function (j) {
      if (j && j.ok && j.signed_url) return j.signed_url;
      idP = null;   // sin la liviana: la ficha completa también trae la URL firmada
      return renovar().then(function (f) { if (f && f.ok && f.signed_url) { var g = leerFirma(); if (g && g.u === f.signed_url) tomarFirma(); return f.signed_url; } throw new Error((f && f.error === "timeout") ? "El Hub tardó en responder. Intenta de nuevo." : ((f && f.error) || "No pude abrir la sesión de voz")); });
    }).then(function (u) { firmaP = null; return u; }, function (e) { firmaP = null; throw e; });
    return firmaP;
  }
  /* La URL para esta llamada: la guardada si sigue vigente; si no, se pide (la llamada espera solo en ese caso). */
  function firma() { var u = tomarFirma(); return u ? Promise.resolve(u) : pedirFirma(); }
  /* Por adelantado: si no hay una URL vigente, se pide una y se guarda. Solo en un teléfono que ya habló con Alma
     (tiene su ficha), para no llamar al Hub en cada página de quien nunca usa la voz. */
  function precalentar() {
    if (leerFirma() || firmaP || !leerFicha()) return;
    pedirFirma().then(function (u) { if (!leerFirma()) guardarFirma(u); }, function () {});
  }
  try {
    setTimeout(precalentar, 1500);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") precalentar(); });
    w.addEventListener("focus", precalentar);
    /* Con el Hub abierto mucho rato: al tocar o teclear se renueva si ya venció (como mucho una vez cada 9 min). */
    document.addEventListener("pointerdown", precalentar, { capture: true, passive: true });
    document.addEventListener("keydown", precalentar, { capture: true, passive: true });
  } catch (e) {}
  /* Se adelanta mientras el dedo todavía jala: SDK + ficha fresca + URL firmada. */
  function prepare() { loadSdk().catch(function () {}); renovar().catch(function () {}); precalentar(); }
  /* iPhone: el audio solo arranca si se "despierta" dentro del gesto del usuario. */
  function unlockAudio() {
    try {
      var C = w.AudioContext || w.webkitAudioContext; if (!C) return;
      var c = new C(), b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0); if (c.resume) c.resume();
      setTimeout(function () { try { c.close(); } catch (e) {} }, 800);
    } catch (e) {}
  }
  /* Mismo par de sonidos que el modo anillo (app Alma): inicio al activarse, despedida al terminar. Solo en voz, no en el chat de texto. */
  var SONIDOS = "https://hub.spacioam.com/assets/alma/sonidos/";
  /* En la app de Alma la señal de despedida la toca la app (suena aunque la página aún tenga el micrófono); en el navegador,
     la página. La de inicio la toca SIEMPRE la página: pedírsela a la app justo cuando la página abre el micrófono y el
     audio de la llamada (31-oct) coincidía con llamadas web que conectaban sin sonido y sin micrófono (0 s de audio en
     ElevenLabs). Así queda como funcionaba el 29-oct. */
  /* El halo de la roca según quién habla: Claudio, todo naranja (Juan, 16-nov-2026); Alma, el de cada página. Es la misma
     variable que ya usan la roca de sa-nav y el inicio (--san-halo): no hay movimiento nuevo, solo cambia el color. La app
     de iPhone lo pide igual cuando su voz nativa cambia de agente (inicio.html, AlmaVoz.evento «agente»). */
  var HALO_CLAUDIO = "linear-gradient(180deg,#FFB25E 0%,#FF9A3C 34%,#F5821F 66%,#E66A0E 100%)";
  /* Espera de Alma (Juan, 17-nov-2026): «el typing es el sonido mientras se procesa la solicitud; el eco es el sonido de
     espera, como el de las operadoras: avisa que va a tardar unos segundos». Mientras corre una herramienta suena primero
     el tecleo de ElevenLabs (viene en la voz del agente; Alma, Claudio y cualquier agente lo tienen). Si pasa de 2,5 s
     (CORO.umbral), el tecleo se baja (la voz del agente a 0,12 mientras dura la espera; vuelve al terminar o cuando Alma
     habla) y entra el coro de Juan (assets/alma/sonidos/alma-trabaja.wav: loop sin costura de 39 s, 48 kHz mono, −24 LUFS):
     entra en 1,2 s y sale en 1,2 s con curva coseno (ease in / ease out: Juan, 19-nov-2026, «que no entre ni se corte de
     golpe»); −10 dB si Alma habla (250 ms, vuelve en 600 ms) y −6 dB si habla Juan. Cuenta las herramientas y para con la
     última; interrupción o colgar lo bajan en 0,35 s con la misma curva (ya no en seco). Las de fondo (enviar_confirmado, claudio_pedido) y
     las que no esperan respuesta nunca lo tocan. Igual que la app de iPhone (CoroTrabajoReglas.swift). En el navegador lo
     toca Web Audio; dentro de la app de Alma, la app, por el puente («coro»). Por teléfono no hay coro: tecleo. */
  var CORO = { url: SONIDOS + "alma-trabaja.wav", umbral: 2500, entra: 1.2, sale: 1.2, corte: 0.35, baja: 0.25, sube: 0.6, tope: 75e3, tecleo: 0.12, almaReciente: 8000,
    sinEspera: { nivel_weebo: 1, mostrar_gif: 1, hablar_con_claudio: 1, volver_con_alma: 1, pasar_a_maricarmen: 1, mostrar_tarjeta_club: 1, mostrar_en_chat: 1, skip_turn: 1, end_call: 1,
      enviar_confirmado: 1, claudio_pedido: 1 } };
  /* Reglas puras (las prueba .github/espera-coro.js): ¿cuenta esta herramienta?, ¿suena ya? y a qué volumen. */
  var coroReglas = {
    cuenta: function (nombre) { return !!nombre && !CORO.sinEspera[nombre]; },
    debe: function (activas, ahora) { var m = Infinity; for (var k in activas) m = Math.min(m, activas[k]); return m !== Infinity && ahora - m >= CORO.umbral; },
    objetivo: function (alma, juan) { return Math.pow(10, (alma ? -10 : juan ? -6 : 0) / 20); },
    rampa: function (desde, hacia) { return hacia === 0 ? CORO.sale : desde === 0 ? CORO.entra : hacia < desde ? CORO.baja : CORO.sube; },
    /* La curva ease-in/ease-out (coseno): arranca y termina con velocidad cero. Igual que CoroReglas.curva en la app. */
    curva: function (p) { var x = Math.max(0, Math.min(1, p)); return (1 - Math.cos(Math.PI * x)) / 2; },
    /* Los puntos de una rampa de `desde` a `hacia` para setValueCurveAtTime. */
    puntos: function (desde, hacia, n) { var a = new Float32Array(n); for (var i = 0; i < n; i++) a[i] = desde + (hacia - desde) * coroReglas.curva(i / (n - 1)); return a; }
  };
  var coroCtx = null, coroBuf = null, coroBufP = null;
  function enApp() { try { return !!(w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.alma); } catch (e) { return false; } }
  /* Dentro del gesto que abre la llamada (iPhone solo deja sonar audio que se despertó en un toque): el contexto y el archivo. */
  function coroPreparar() {
    if (enApp()) return;
    try { var C = w.AudioContext || w.webkitAudioContext; if (!C) return; if (!coroCtx) coroCtx = new C(); if (coroCtx.resume) coroCtx.resume(); } catch (e) { return; }
    if (coroBuf || coroBufP) return;
    coroBufP = fetch(CORO.url).then(function (r) { if (!r.ok) throw new Error("coro " + r.status); return r.arrayBuffer(); })
      .then(function (a) { return new Promise(function (ok, no) { coroCtx.decodeAudioData(a, ok, no); }); })
      .then(function (b) { coroBuf = b; }, function () { coroBufP = null; });
  }
  /* almaHabla / juanHabla: quién habla ahora. tecleo(v): el volumen de la voz del agente (ahí viene el tecleo). */
  function crearCoro(almaHabla, juanHabla, tecleo) {
    var activas = {}, reloj = 0, permitido = false, sonando = false, objetivo = 0, paraEn = 0, src = null, gan = null, bajo = false;
    function hay() { for (var k in activas) return true; return false; }
    function poner(v, t) {
      if (enApp()) { try { w.webkit.messageHandlers.alma.postMessage({ accion: "voz", que: "coro", v: v, t: t }); } catch (e) {} return; }
      if (!gan || !coroCtx) return;
      try {
        var g = gan.gain, a = coroCtx.currentTime, d = g.value;
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(a); else g.cancelScheduledValues(a);
        g.setValueAtTime(d, a);
        if (t > 0.02) g.setValueCurveAtTime(coroReglas.puntos(d, v, 64), a, t); else g.setValueAtTime(v, a);
      } catch (e) { try { g.cancelScheduledValues(a); g.setValueAtTime(v, a); } catch (e2) {} }
    }
    function bajarTecleo(on) { if (on === bajo) return; bajo = on; try { tecleo(on ? CORO.tecleo : 1); } catch (e) {} }
    function arrancar() {
      if (!enApp()) {
        if (!coroCtx || !coroBuf) return false;
        try {
          gan = coroCtx.createGain(); gan.gain.value = 0; gan.connect(coroCtx.destination);
          src = coroCtx.createBufferSource(); src.buffer = coroBuf; src.loop = true; src.connect(gan); src.start();
        } catch (e) { return false; }
      }
      sonando = true; objetivo = 0; return true;
    }
    function soltar(tras) {
      var s = src, g = gan;
      src = null; gan = null; sonando = false; objetivo = 0;
      if (!s) return;
      function fin() { try { s.stop(); } catch (e) {} try { s.disconnect(); g.disconnect(); } catch (e) {} }
      if (tras) setTimeout(fin, tras); else fin();
    }
    function tick() {
      var ahora = Date.now();
      for (var k in activas) if (ahora - activas[k] > CORO.tope) delete activas[k];   // una respuesta que nunca llegó
      var debe = permitido && coroReglas.debe(activas, ahora);
      if (debe && !sonando && !arrancar()) return;
      if (!sonando) { if (!hay()) { clearInterval(reloj); reloj = 0; } return; }
      var alma = almaHabla(), nuevo = debe ? coroReglas.objetivo(alma, juanHabla()) : 0;
      bajarTecleo(debe && !alma);   // el tecleo se baja mientras suena la espera; Alma hablando se oye completa
      if (nuevo !== objetivo) {
        var t = coroReglas.rampa(objetivo, nuevo);
        poner(nuevo, t); objetivo = nuevo; if (nuevo === 0) paraEn = ahora + t * 1000 + 60;
      }
      if (!debe && objetivo === 0 && ahora >= paraEn) { soltar(); if (!hay()) { clearInterval(reloj); reloj = 0; } }
    }
    return {
      permitir: function (on) { permitido = !!on; if (!on) this.corta(); },
      empieza: function (id, nombre) {
        if (!permitido || !id || !coroReglas.cuenta(nombre) || activas[id]) return;
        activas[id] = Date.now(); if (!reloj) reloj = setInterval(tick, 25);
      },
      termina: function (id) { if (id) delete activas[id]; if (!hay()) bajarTecleo(false); },
      corta: function () { activas = {}; bajarTecleo(false); if (reloj) { clearInterval(reloj); reloj = 0; } if (sonando) { poner(0, CORO.corte); soltar(CORO.corte * 1000 + 60); } }
    };
  }
  function agenteHalo(a) {
    try {
      var r = document.documentElement;
      if (a === "claudio") { r.setAttribute("data-voz-agente", "claudio"); r.style.setProperty("--san-halo", HALO_CLAUDIO); }
      else { r.removeAttribute("data-voz-agente"); r.style.removeProperty("--san-halo"); }
      w.dispatchEvent(new CustomEvent("sa-voz-agente", { detail: { agente: a === "claudio" ? "claudio" : "alma" } }));
    } catch (e) {}
  }
  /* Panel de Claudio: la página (alma/inicio.html) lo pide al Hub con la conversación de Claudio. */
  function avisoClaudio(que, conv) { try { w.dispatchEvent(new CustomEvent("sa-voz-claudio", { detail: { que: que, conv: conv || "" } })); } catch (e) {} }
  function sonido(n, pagina) { try { if (!pagina && w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.alma) { w.webkit.messageHandlers.alma.postMessage({ accion: "voz", que: "sonido", n: n }); return; } } catch (e) {}
    try { var a = new Audio(SONIDOS + n + ".wav"); a.volume = 0.9; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  /* Notas de actuación del modelo de voz ([warm], [softly], [laughs]…): se oyen como tono, no se leen. */
  function limpiar(t) { return String(t || "").replace(/\[[^\]\n]{1,40}\]/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?…])/g, "$1").trim(); }
  function ficha() {
    var f = leerFicha();
    if (f) { renovar().catch(function () {}); return Promise.resolve(f); }
    return renovar().then(function (j) {
      if (!j || !j.ok || !j.agent_id) throw new Error((j && j.error === "timeout") ? "El Hub tardó en responder. Intenta de nuevo." : ((j && j.error) || "No pude abrir la sesión de voz"));
      return j;
    });
  }
  /* Bento vivo (#810, js/alma-bento.js): en la computadora (pantalla ancha) la llamada web también muestra la tarjeta del
     tema en el bento. La llamada se liga como «expandida» (el Hub solo arma tarjetas ahí o en la app: tvPermitida_) y,
     cuando contesta la secretaria, se pide la tarjeta UNA vez (vozTarjeta, sin IA ni Hospitable). La página la recibe con
     el evento «sa-voz-tarjeta» ({ tarjeta } o { fin: true }). */
  function bvActivo() { try { return !o.vincular && !!(w.AlmaBento && w.AlmaBento.ancho()); } catch (e) { return false; } }
  function hubPost(action, extra) {
    var dst = w.ALMA && w.ALMA.destino ? w.ALMA.destino() : null, ses = w.SAAuth && w.SAAuth.session ? w.SAAuth.session() : null;
    if (!dst || !dst.url) return Promise.resolve(null);
    return fetch(dst.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, cache: "no-store",
      body: JSON.stringify(Object.assign({ hub: 1, action: action, token: dst.token, session: ses }, extra || {})) })
      .then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  var tvConv = "", tvUltima = "";
  function tvAvisar(d) { try { w.dispatchEvent(new CustomEvent("sa-voz-tarjeta", { detail: d })); } catch (e) {} }
  function tvPedir() {
    if (!tvConv || !bvActivo()) return;
    hubPost("vozTarjeta", { conv_id: tvConv }).then(function (j) {
      var t = j && j.ok && j.tarjeta; if (!t || !t.id || t.id === tvUltima) return;
      tvUltima = t.id; tvAvisar({ tarjeta: t });
    });
  }
  /* Liga la llamada al administrador en el Hub; si falla (red, Hub dormido), reintenta. */
  function vincular(id, n) {
    var fn = o.vincular || (w.ALMA && w.ALMA.vozWebVincular); if (!fn) return;
    if (bvActivo()) fn = function (x) { return hubPost("vozWebVincular", { conv_id: x, expandida: 1 }); };
    Promise.resolve().then(function () { return fn(id); }).then(function (r) { if ((!r || !r.ok) && n < 3) setTimeout(function () { vincular(id, n + 1); }, 1500 * (n + 1)); },
      function () { if (n < 3) setTimeout(function () { vincular(id, n + 1); }, 1500 * (n + 1)); });
  }
  /* El contexto de pantalla va en una variable del agente: en el Hub se suma a quien_llama; otra app puede usar la suya (o.campoContexto). */
  function conCtx(dv) { var r = {}; for (var k in dv) r[k] = dv[k]; if (o.campoContexto) r[o.campoContexto] = ctxTexto(ctx); else r.quien_llama = (r.quien_llama || "") + "\n\n" + ctxTexto(ctx); return r; }
  var CANAL_CHAT = 'CANAL: CHAT DE TEXTO. La persona está en el chat de la app: te escribe y también puede seguir hablándote (el micrófono sigue abierto). Tu respuesta se ve escrita en la pantalla y también se oye con tu voz: responde breve y claro, con frases que suenen bien al leerse en voz alta (puedes usar saltos de línea). No digas «llamada», no ofrezcas colgar ni «te dejo continuar». Si no llega un mensaje nuevo, NO preguntes si sigue ahí: el silencio es normal en un chat (está leyendo o escribiendo); usa skip_turn y espera en silencio. Si mandas algo a segundo plano, di que se lo confirmas aquí en el chat o por WhatsApp. Cuando le ofrezcas elegir entre caminos o acciones, escribe la pregunta terminada en «?» y debajo de 2 a 5 opciones, una por línea, empezando con «• » y de 6 palabras como mucho (si hace falta aclarar, después de « — »): la app las muestra como botones. No uses «• » para otras listas.';
  var CANAL_VOZ = 'CANAL: VOZ. La persona volvió a hablar contigo en voz alta: es una conversación hablada.';
  var CANAL_NOTA = 'CANAL: CHAT · NOTA DE VOZ. La persona te está grabando una nota de voz dentro del chat. Espera a que termine y responde por escrito, como en el chat.';
  /* Lo que Alma dice al volver de Claudio (Juan no la llamó: ya estaba en la llamada). */
  var VUELTA = "Aquí estoy de nuevo. ¿Qué más hacemos?";
  function start(h) {
    unlockAudio(); coroPreparar();
    var enChat = false, sono = true;
    /* Hablar con Claudio: quién habla ahora, si está hablando (para no cortarle la frase) y la serie de la conversación
       vigente (la que se cierra al cambiar de agente no termina la llamada). */
    var agente = "alma", habla = false, callada = 0, serie = 0, cambio = false, mod = null, colgo = false, convClaudio = "";
    /* Alma habla de verdad (no solo el tecleo, que también llega como su voz): está sonando y dijo algo hace poco. */
    var textoAlma = 0;
    var coro = crearCoro(function () { return habla && Date.now() - textoAlma < CORO.almaReciente; },
      function () { try { return !!vivo && vivo.getInputVolume() > 0.08; } catch (e) { return false; } },
      function (v) { try { if (vivo) vivo.setVolume({ volume: v }); } catch (e) {} });
    /* Lo que Juan respondió tocando el Panel de Claudio: Claudio lo sabe en esta misma conversación. */
    function alContexto(e) { var t = e && e.detail && e.detail.texto; if (!t || agente !== "claudio" || !vivo) return; try { vivo.sendContextualUpdate(String(t).slice(0, 600)); } catch (x) {} }
    w.addEventListener("sa-claudio-contexto", alContexto);
    function saleClaudio() { if (convClaudio || agente === "claudio") { convClaudio = ""; avisoClaudio("sale"); } }
    agenteHalo("alma");
    sonido("alma-inicio", true);
    function despedida() { if (sono) { sono = false; if (!enChat) sonido("alma-fin"); } }
    function terminada() { if (tvConv) { tvConv = ""; tvUltima = ""; tvAvisar({ fin: true }); } coro.permitir(false); vivo = null; saleClaudio(); w.removeEventListener("sa-claudio-contexto", alContexto); agenteHalo("alma"); despedida(); h.ended(); if (o.alTerminar) { try { o.alTerminar(); } catch (e) {} } }
    function abrir(f, m, u) {
      var yo = serie, claudio = agente === "claudio";
      var opt = {
        signedUrl: u, connectionType: "websocket", dynamicVariables: claudio ? (f.dynamic_variables || {}) : conCtx(f.dynamic_variables || {}),
        onConnect: function (x) { if (yo !== serie) return; h.status("Te escucho"); if (!claudio && x && x.conversationId) { tvConv = x.conversationId; vincular(x.conversationId, 0); }
          if (claudio && x && x.conversationId) { convClaudio = x.conversationId; avisoClaudio("entra", convClaudio); } },   // Panel de Claudio: la lista al entrar
        onAgentToolRequest: function (r) { if (yo !== serie || !r) return; coro.empieza(r.tool_call_id, String(r.tool_name || "")); },
        onInterruption: function () { if (yo !== serie) return; coro.corta(); },
        onAgentToolResponse: function (r) { if (yo !== serie || !r) return; coro.termina(r.tool_call_id);
          if (!claudio && String(r.tool_name || "") === "secretaria") tvPedir();
          if (!claudio || !convClaudio || !/^claudio_/.test(String(r.tool_name || ""))) return; avisoClaudio("herramienta", convClaudio); },
        onMessage: function (x) { if (!x || yo !== serie) return; if (x.source === "ai") textoAlma = Date.now(); var t = x.source === "ai" ? limpiar(x.message) : x.message; if (t) { h.message(x.source, t); if (o.alMensaje) { try { o.alMensaje(x.source, t); } catch (e) {} } } },
        onModeChange: function (x) { if (yo !== serie || !x) return; habla = x.mode === "speaking"; if (!habla) callada = Date.now(); if (!enChat) h.status(habla ? (claudio ? "Claudio habla" : "Alma habla") : "Te escucho"); },
        onDisconnect: function () { if (yo !== serie) return; terminada(); },
        onError: function (e) { if (yo !== serie) return; h.error(typeof e === "string" ? e : (e && e.message) || "Se perdió la conexión"); }
      };
      /* mostrar_en_chat (#381): la app de iPhone la atiende en su voz nativa. Aquí, si la página no trae la suya
         (o.herramientas, p. ej. «Alma aquí»), se contesta enseguida que no se pudo: Alma lo dice por voz y nunca espera. */
      var ht = { mostrar_en_chat: function () { return "Aquí no hay chat a la vista: no se mostró. Díselo por voz, en corto, solo lo más importante."; },
        nivel_weebo: function () {},   // medidor de la app de iPhone (#410): aquí no se muestra; no espera respuesta
        mostrar_gif: function (p) { if (bvActivo()) { try { w.dispatchEvent(new CustomEvent("sa-voz-gif", { detail: { idea: p && p.idea } })); } catch (e) {} } },   // el GIF de la broma: en el Bento vivo de la computadora (js/alma-gif.js); en otra página, nada
        // las tarjetas de clubes viven solo en el iPhone (voz.js, vozMostrarTarjetaClub_): aquí no hay ninguna
        mostrar_tarjeta_club: function () { return "Las tarjetas de clubes se guardan y se muestran solo en la app de Alma del iPhone: aquí no se pueden poner en pantalla. Díselo en una frase."; } };
      if (o.herramientas) for (var k in o.herramientas) ht[k] = o.herramientas[k];
      /* Hablar con Claudio: solo el proveedor del Hub (ALMA.vozClaudio) sabe abrirlo; las demás apps no lo ofrecen. */
      if (puedeClaudio()) {
        if (claudio) ht = { volver_con_alma: function () { cambiarA("alma"); } };
        else ht.hablar_con_claudio = function (p) { cambiarA("claudio", p && p.motivo); };
      }
      opt.clientTools = ht;
      var fm = f.first_message; if (!claudio && f.first_message !== VUELTA && o.primerMensaje) { try { fm = o.primerMensaje() || fm; } catch (e) {} }
      if (fm || f.language) { opt.overrides = { agent: {} }; if (fm) opt.overrides.agent.firstMessage = fm; if (f.language) opt.overrides.agent.language = f.language; }
      coro.corta(); coro.permitir(true);   // la conversación nueva (también al pasar a Claudio) empieza sin herramientas en curso
      return m.Conversation.startSession(opt);
    }
    /* Cambiar de agente (Hablar con Claudio y volver con Alma): se pide la conversación nueva mientras termina la frase de
       quien habla (como mucho 6 s), se cierra la de antes sin colgar la llamada y se abre la nueva. Si no se puede, quien
       estaba sigue y lo dice; si ya se había cerrado, la llamada termina con el error. */
    function cambiarA(nuevo, motivo) {
      if (cambio || !vivo || nuevo === agente) return;
      cambio = true;
      var pedir = nuevo === "claudio" ? w.ALMA.vozClaudio(String(motivo || "").slice(0, 300)).then(function (j) {
        if (!j || !j.ok || !j.signed_url) throw new Error((j && j.error) || "No pude abrir a Claudio");
        return [{ dynamic_variables: j.dynamic_variables || {}, first_message: j.first_message || "" }, j.signed_url];
      }) : ficha().then(function (f) { return firma().then(function (u) { return [Object.assign({}, f, { first_message: VUELTA }), u]; }); });
      var t0 = Date.now(), termina = new Promise(function (ok) { (function mira() { if ((!habla && Date.now() - callada > 350) || Date.now() - t0 > 6000) ok(); else setTimeout(mira, 120); })(); });
      var cerrada = false;
      Promise.all([pedir, termina, mod ? Promise.resolve(mod) : loadSdk()]).then(function (r) {
        if (colgo || !vivo) return;   // Juan colgó mientras tanto: no se abre nada
        var viejo = vivo; serie++; cerrada = true; vivo = null; habla = false;
        if (nuevo !== "claudio") saleClaudio();   // vuelve Alma: el Panel de Claudio se quita
        try { viejo.endSession(); } catch (e) {}
        agente = nuevo; agenteHalo(nuevo); h.status("Conectando…");
        return abrir(r[0][0], r[2], r[0][1]).then(function (c) { vivo = c; });
      }).catch(function (e) {
        var msg = (e && e.message) || "No se pudo cambiar";
        if (!cerrada && vivo) { try { vivo.sendContextualUpdate("No se pudo " + (nuevo === "claudio" ? "pasar con Claudio" : "volver con Alma") + ": " + msg + ". Díselo a Juan en una frase y sigue tú."); } catch (x) {} return; }
        agente = "alma"; h.error(msg); terminada();
      }).then(function () { cambio = false; });
    }
    /* La ficha primero: la primera vez (sin ficha guardada) trae también la URL firmada y no hace falta otra vuelta al Hub. */
    return Promise.all([ficha().then(function (f) { return firma().then(function (u) { return [f, u]; }); }), loadSdk()]).then(function (r) {
      var f = r[0][0], u = r[0][1], m = r[1]; mod = m;
      return abrir(f, m, u).catch(function (e) {
        if (e && (e.name === "NotAllowedError" || e.name === "SecurityError" || e.name === "NotFoundError")) throw e;
        /* Reintento con otra URL firmada (cada una se usa una vez). */
        return new Promise(function (ok) { setTimeout(ok, 600); }).then(firma).then(function (u2) { return abrir(f, m, u2); });
      });
    }).catch(function (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) throw new Error("Permite el micrófono para hablar con Alma.");
      if (e && e.name === "NotFoundError") throw new Error("No encontré un micrófono.");
      throw e;
    }).then(function (conv) {
      vivo = conv;
      /* Todo va a la conversación vigente (la de Alma o la de Claudio). */
      return {
        end: function () { var c = vivo; colgo = true; vivo = null; coro.permitir(false); saleClaudio(); agenteHalo("alma"); despedida(); try { c && c.endSession(); } catch (e) {} },
        level: function () { try { return vivo ? vivo.getOutputVolume() : 0; } catch (e) { return 0; } },
        sendText: function (t) { try { vivo.sendUserMessage(t); } catch (e) {} },
        mute: function (on) { try { vivo.setMicMuted(!!on); } catch (e) {} },
        /* Alma sabe por dónde le hablan. Modo chat de la llamada (#333, #334): el micrófono sigue (Alma te oye) y su
           respuesta se ve escrita en el hilo y también suena con su voz (Juan, #561: antes quedaba en volumen 0). */
        chat: function (on) { enChat = on; try { vivo.setVolume({ volume: 1 }); } catch (e) {} if (!on) h.status("Te escucho");
          try { vivo.sendContextualUpdate(on ? CANAL_CHAT : CANAL_VOZ); } catch (e) {} },
        /* nota de voz dentro del chat: Alma responde por escrito. El micrófono ya sigue abierto en el chat: al soltar no se apaga. */
        nota: function (on) { if (on) { try { vivo.setMicMuted(false); vivo.sendContextualUpdate(CANAL_NOTA); } catch (e) {} } }
      };
    });
  }
  /* Solo el Hub (sin ficha propia) abre a Claudio: con la acción vozClaudio, que el Hub da solo al principal. */
  function puedeClaudio() { return !o.ficha && !!(w.ALMA && w.ALMA.vozClaudio); }
  return { prepare: prepare, start: start, limpiar: limpiar, setContexto: setContexto, agente: agenteHalo, coroReglas: coroReglas };
  }
  w.SAAlmaVoz = crear({});
  w.SAAlmaVoz.crear = crear;
})(window);
