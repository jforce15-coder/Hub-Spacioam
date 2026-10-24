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
  var KEY = "sa_alma_voz_ficha", VIGENCIA = 12 * 3600e3;
  var mod = null, modP = null, idP = null, idT = 0, ctx = null, ctxKey = "", vivo = null;
  /* Conversación abierta en pantalla (la pone el Hub): si Juan dice «escríbele…» sin decir a quién, es esta. */
  function ctxTexto(c) {
    if (!c) return "EN PANTALLA: no hay una conversación de huésped abierta. Si mencionan una reserva, un huésped o un apartamento, búscalo como siempre con secretaria.";
    var d = [c.huesped, c.propiedad, c.fechas].filter(Boolean).join(" · ");
    return "EN PANTALLA: " + (c.nombre || "Juan") + " tiene abierta en el Hub la conversación de la reserva " + (c.codigo || c.conv_id || "") + (d ? " (" + d + ")" : "") + ". " +
      "Si te pide algo sobre «la reserva», «el huésped», «esta conversación», «escríbele», «mándale», «respóndele», o cualquier cosa de una reserva sin decir cuál, es ESTA: no preguntes cuál ni la busques, pásale a secretaria el pedido completo incluyendo el código " + (c.codigo || c.conv_id || "") + (c.huesped ? " y el nombre " + c.huesped : "") + ". " +
      "Solo si nombra otra reserva, otro huésped u otro apartamento distinto, búscala y resuelve como siempre.";
  }
  function setContexto(c) {
    var k = c ? String(c.codigo || c.conv_id || "") : "";
    if (k === ctxKey) { ctx = c; return; }
    ctx = c; ctxKey = k;
    if (vivo && vivo.sendContextualUpdate) { try { vivo.sendContextualUpdate("Cambió la pantalla. " + ctxTexto(c)); } catch (e) {} }
  }
  function loadSdk() { if (mod) return Promise.resolve(mod); if (!modP) modP = import(SDK).then(function (m) { mod = m; return m; }, function (e) { modP = null; throw e; }); return modP; }
  function leerFicha() { try { var j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && j.agent_id && Date.now() - j.t < VIGENCIA ? j : null; } catch (e) { return null; } }
  function guardarFicha(j) { try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), agent_id: j.agent_id, dynamic_variables: j.dynamic_variables || {}, first_message: j.first_message || "" })); } catch (e) {} }
  /* Pide la ficha al Hub (como mucho una vez cada 20 s). */
  function renovar() {
    if (idP && Date.now() - idT < 20000) return idP;
    idT = Date.now();
    idP = (w.ALMA && w.ALMA.vozWeb ? w.ALMA.vozWeb(true) : Promise.resolve({ ok: false, error: "ALMA no disponible" })).then(function (j) {
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
  function conCtx(dv) { var o = {}; for (var k in dv) o[k] = dv[k]; o.quien_llama = (o.quien_llama || "") + "\n\n" + ctxTexto(ctx); return o; }
  function start(h) {
    unlockAudio();
    var enChat = false;
    function abrir(f, m) {
      var opt = {
        agentId: f.agent_id, connectionType: "websocket", dynamicVariables: conCtx(f.dynamic_variables || {}),
        onConnect: function (x) { h.status("Te escucho"); if (x && x.conversationId && w.ALMA && w.ALMA.vozWebVincular) w.ALMA.vozWebVincular(x.conversationId); },
        onMessage: function (x) { if (!x) return; var t = x.source === "ai" ? limpiar(x.message) : x.message; if (t) h.message(x.source, t); },
        onModeChange: function (x) { if (!enChat && x) h.status(x.mode === "speaking" ? "Alma habla" : "Te escucho"); },
        onDisconnect: function () { vivo = null; h.ended(); },
        onError: function (e) { h.error(typeof e === "string" ? e : (e && e.message) || "Se perdió la conexión"); }
      };
      if (f.first_message) opt.overrides = { agent: { firstMessage: f.first_message } };
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
        end: function () { vivo = null; try { conv.endSession(); } catch (e) {} },
        level: function () { try { return conv.getOutputVolume(); } catch (e) { return 0; } },
        sendText: function (t) { try { conv.sendUserMessage(t); } catch (e) {} },
        chat: function (on) { enChat = on; try { conv.setMicMuted(on); conv.setVolume({ volume: on ? 0 : 1 }); } catch (e) {} if (!on) h.status("Te escucho"); }
      };
    });
  }
  w.SAAlmaVoz = { prepare: prepare, start: start, limpiar: limpiar, setContexto: setContexto };
})(window);
