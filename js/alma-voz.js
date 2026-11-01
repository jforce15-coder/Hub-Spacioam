/* Spacio AM · Alma por voz dentro del Hub (proveedor del menú compartido, js/sa-nav.js)
   Al deslizar el botón del menú hacia el centro, el menú llama a SAAlmaVoz.start().
   Rápido y liviano:
   - SDK propio de ElevenLabs solo con websocket (js/vendor/eleven-ws.js, ~60 KB) en vez de 650 KB con WebRTC desde un CDN.
   - Conexión directa al agente con su agent_id: no espera una URL firmada del Apps Script.
   - La ficha del administrador (quién es, saludo) se guarda en el teléfono y se renueva en segundo plano;
     solo la primera vez se espera al Hub.
   - Si la conexión falla por la red, reintenta una vez sola. */
(function (w) {
  "use strict";
  var SDK = new URL("vendor/eleven-ws.js?v=1.27.0a", (document.currentScript && document.currentScript.src) || location.href).href;
  var mod = null, modP = null;
  function loadSdk() { if (mod) return Promise.resolve(mod); if (!modP) modP = import(SDK).then(function (m) { mod = m; return m; }, function (e) { modP = null; throw e; }); return modP; }
  /* Proveedor de voz para el menú compartido. El Hub usa el de siempre (SAAlmaVoz); otra app crea el suyo con
     SAAlmaVoz.crear({
       clave: "gsp_alma_ficha",              ficha guardada en el teléfono (cada app la suya)
       ficha: () => Promise<{ ok, agent_id, dynamic_variables, first_message }>,   quién habla (lo da la app)
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
  var KEY = o.clave || "sa_alma_voz_ficha", VIGENCIA = 12 * 3600e3;
  var idP = null, idT = 0, ctx = null, ctxKey = "", vivo = null;
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
  /* Pide la ficha al Hub (como mucho una vez cada 20 s). */
  function renovar() {
    if (idP && Date.now() - idT < 20000) return idP;
    idT = Date.now();
    idP = (o.ficha ? Promise.resolve().then(o.ficha) : w.ALMA && w.ALMA.vozWeb ? w.ALMA.vozWeb(true) : Promise.resolve({ ok: false, error: "ALMA no disponible" })).then(function (j) {
      if (j && j.ok && j.agent_id) guardarFicha(j);
      else idP = null;
      return j;
    }, function (e) { idP = null; throw e; });
    return idP;
  }
  /* Se adelanta mientras el dedo todavía jala: SDK + ficha fresca. */
  function prepare() { loadSdk().catch(function () {}); renovar().catch(function () {}); }
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
  /* Liga la llamada al administrador en el Hub; si falla (red, Hub dormido), reintenta. */
  function vincular(id, n) {
    var fn = o.vincular || (w.ALMA && w.ALMA.vozWebVincular); if (!fn) return;
    Promise.resolve().then(function () { return fn(id); }).then(function (r) { if ((!r || !r.ok) && n < 3) setTimeout(function () { vincular(id, n + 1); }, 1500 * (n + 1)); },
      function () { if (n < 3) setTimeout(function () { vincular(id, n + 1); }, 1500 * (n + 1)); });
  }
  /* El contexto de pantalla va en una variable del agente: en el Hub se suma a quien_llama; otra app puede usar la suya (o.campoContexto). */
  function conCtx(dv) { var r = {}; for (var k in dv) r[k] = dv[k]; if (o.campoContexto) r[o.campoContexto] = ctxTexto(ctx); else r.quien_llama = (r.quien_llama || "") + "\n\n" + ctxTexto(ctx); return r; }
  var CANAL_CHAT = 'CANAL: CHAT DE TEXTO. La persona te escribe desde el chat de la app; no es una llamada. Responde por escrito, breve y claro (puedes usar saltos de línea). No digas «llamada», no ofrezcas colgar ni «te dejo continuar». Si no llega un mensaje nuevo, NO preguntes si sigue ahí: el silencio es normal en un chat (está leyendo o escribiendo); usa skip_turn y espera en silencio. Si mandas algo a segundo plano, di que se lo confirmas aquí en el chat o por WhatsApp. Cuando le ofrezcas elegir entre caminos o acciones, escribe la pregunta terminada en «?» y debajo de 2 a 5 opciones, una por línea, empezando con «• » y de 6 palabras como mucho (si hace falta aclarar, después de « — »): la app las muestra como botones. No uses «• » para otras listas.';
  var CANAL_VOZ = 'CANAL: VOZ. La persona volvió a hablar contigo en voz alta: es una conversación hablada.';
  var CANAL_NOTA = 'CANAL: CHAT · NOTA DE VOZ. La persona te está grabando una nota de voz dentro del chat. Espera a que termine y responde por escrito, como en el chat.';
  function start(h) {
    unlockAudio();
    var enChat = false, sono = true;
    sonido("alma-inicio", true);
    function despedida() { if (sono) { sono = false; if (!enChat) sonido("alma-fin"); } }
    function abrir(f, m) {
      var opt = {
        agentId: f.agent_id, connectionType: "websocket", dynamicVariables: conCtx(f.dynamic_variables || {}),
        onConnect: function (x) { h.status("Te escucho"); if (x && x.conversationId) vincular(x.conversationId, 0); },
        onMessage: function (x) { if (!x) return; var t = x.source === "ai" ? limpiar(x.message) : x.message; if (t) { h.message(x.source, t); if (o.alMensaje) { try { o.alMensaje(x.source, t); } catch (e) {} } } },
        onModeChange: function (x) { if (!enChat && x) h.status(x.mode === "speaking" ? "Alma habla" : "Te escucho"); },
        onDisconnect: function () { vivo = null; despedida(); h.ended(); if (o.alTerminar) { try { o.alTerminar(); } catch (e) {} } },
        onError: function (e) { h.error(typeof e === "string" ? e : (e && e.message) || "Se perdió la conexión"); }
      };
      if (o.herramientas) opt.clientTools = o.herramientas;
      var fm = f.first_message; if (o.primerMensaje) { try { fm = o.primerMensaje() || fm; } catch (e) {} }
      if (fm || f.language) { opt.overrides = { agent: {} }; if (fm) opt.overrides.agent.firstMessage = fm; if (f.language) opt.overrides.agent.language = f.language; }
      return m.Conversation.startSession(opt);
    }
    return Promise.all([ficha(), loadSdk()]).then(function (r) {
      var f = r[0], m = r[1];
      return abrir(f, m).catch(function (e) {
        if (e && (e.name === "NotAllowedError" || e.name === "SecurityError" || e.name === "NotFoundError")) throw e;
        return new Promise(function (ok) { setTimeout(ok, 600); }).then(function () { return abrir(f, m); });
      });
    }).catch(function (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) throw new Error("Permite el micrófono para hablar con Alma.");
      if (e && e.name === "NotFoundError") throw new Error("No encontré un micrófono.");
      throw e;
    }).then(function (conv) {
      vivo = conv;
      return {
        end: function () { vivo = null; despedida(); try { conv.endSession(); } catch (e) {} },
        level: function () { try { return conv.getOutputVolume(); } catch (e) { return 0; } },
        sendText: function (t) { try { conv.sendUserMessage(t); } catch (e) {} },
        mute: function (on) { try { conv.setMicMuted(!!on); } catch (e) {} },
        /* Alma sabe por dónde le hablan: en el chat escribe (no hay llamada); al volver a la voz, habla. */
        chat: function (on) { enChat = on; try { conv.setMicMuted(on); conv.setVolume({ volume: on ? 0 : 1 }); } catch (e) {} if (!on) h.status("Te escucho");
          try { conv.sendContextualUpdate(on ? CANAL_CHAT : CANAL_VOZ); } catch (e) {} },
        /* nota de voz dentro del chat: mientras se mantiene la roca, el micrófono escucha; Alma responde por escrito */
        nota: function (on) { try { conv.setMicMuted(!on); } catch (e) {} if (on) { try { conv.sendContextualUpdate(CANAL_NOTA); } catch (e) {} } }
      };
    });
  }
  return { prepare: prepare, start: start, limpiar: limpiar, setContexto: setContexto };
  }
  w.SAAlmaVoz = crear({});
  w.SAAlmaVoz.crear = crear;
})(window);
