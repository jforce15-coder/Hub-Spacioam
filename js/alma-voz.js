/* Spacio AM · Alma por voz dentro del Hub (proveedor del menú compartido, js/sa-nav.js)
   Al deslizar el botón del menú hacia el centro, el menú llama a SAAlmaVoz.start(): pide al Apps Script una
   URL firmada de ElevenLabs para el administrador con sesión iniciada y abre la conversación con el mismo
   agente de las llamadas. Alma lo reconoce como administrador (voz.js · vozWeb*). */
(function (w) {
  "use strict";
  var SDK = "https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.27.0/+esm";
  var mod = null, prep = null;
  function loadSdk() { return mod ? Promise.resolve(mod) : import(SDK).then(function (m) { mod = m; return m; }); }
  /* Se adelanta mientras el dedo todavía jala: SDK + URL firmada (de un solo uso, ~15 min). */
  function prepare() {
    if (prep && Date.now() - prep.t < 60000) return prep.p;
    var p = Promise.all([loadSdk(), w.ALMA && w.ALMA.vozWeb ? w.ALMA.vozWeb() : Promise.resolve({ ok: false, error: "ALMA no disponible" })]);
    prep = { t: Date.now(), p: p }; p.catch(function () { prep = null; });
    return p;
  }
  /* iPhone: el audio solo arranca si se "despierta" dentro del gesto del usuario. */
  function unlockAudio() {
    try {
      var C = w.AudioContext || w.webkitAudioContext; if (!C) return;
      var c = new C(), b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0); if (c.resume) c.resume();
      setTimeout(function () { try { c.close(); } catch (e) {} }, 800);
    } catch (e) {}
  }
  function start(h) {
    unlockAudio();
    var mic = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? navigator.mediaDevices.getUserMedia({ audio: true }) : Promise.resolve(null);
    var conv = null, enChat = false;
    return Promise.all([prepare(), mic]).then(function (r) {
      var m = r[0][0], cfg = r[0][1], st = r[1]; prep = null;
      if (st) st.getTracks().forEach(function (t) { t.stop(); });
      if (!cfg || !cfg.ok) throw new Error((cfg && cfg.error) || "No pude abrir la sesión de voz");
      return m.Conversation.startSession({
        signedUrl: cfg.signed_url, connectionType: "websocket", dynamicVariables: cfg.dynamic_variables || {},
        onConnect: function (x) { h.status("Te escucho"); if (x && x.conversationId && w.ALMA.vozWebVincular) w.ALMA.vozWebVincular(x.conversationId); },
        onMessage: function (x) { if (x) h.message(x.source, x.message); },
        onModeChange: function (x) { if (!enChat && x) h.status(x.mode === "speaking" ? "Alma habla" : "Te escucho"); },
        onDisconnect: function () { h.ended(); },
        onError: function (e) { h.error(typeof e === "string" ? e : (e && e.message) || "Se perdió la conexión"); }
      });
    }).catch(function (e) {
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) throw new Error("Permite el micrófono para hablar con Alma.");
      throw e;
    }).then(function (c) {
      conv = c;
      return {
        end: function () { try { conv.endSession(); } catch (e) {} },
        level: function () { try { return conv.getOutputVolume(); } catch (e) { return 0; } },
        sendText: function (t) { try { conv.sendUserMessage(t); } catch (e) {} },
        chat: function (on) { enChat = on; try { conv.setMicMuted(on); conv.setVolume({ volume: on ? 0 : 1 }); } catch (e) {} if (!on) h.status("Te escucho"); }
      };
    });
  }
  w.SAAlmaVoz = { prepare: prepare, start: start };
})(window);
