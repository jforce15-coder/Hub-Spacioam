/* Spacio AM · Cliente del hub para ALMA (asistente nocturno de huéspedes).
   Hoja de ALMA: ALMA_CONTROL · ALMA_COLA · ALMA_LOG · ALMA_INSTRUCCIONES
   Lectura: gviz CSV directo de la hoja. Escritura y IA: el Apps Script de ALMA
   (alma-hub-api.gs) vía POST text/plain {hub:1, action, token, ...}.        */
(function (global) {
  var CFG = {
    sheetId: '1K8_MUCmJ4_Ks4DMKLSCbua1qC7X6QuilRaMvCquZ7kk',
    url: 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec',   // URL /exec del Apps Script de ALMA
    webappSheetId: '12TF-FO6vld2VkzDr9YlUnHlNjh4d1u9Ss6qWz3F3KeQ',   // hoja de hola.spacioam.com (solo lectura: Reservas)
    token: 'SpacioAM2026!'
  };
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  /* ALMA_CONTROL se lee por POSICIÓN (A = clave, B = valor): una cabecera dañada no puede "apagar" nada.
     Celdas con varias líneas (filas fusionadas) se desarman línea por línea. */
  function readControl() {
    var u = 'https://docs.google.com/spreadsheets/d/' + CFG.sheetId + '/gviz/tq?tqx=out:csv&sheet=ALMA_CONTROL&_=' + Date.now();
    return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var out = [], vistos = {};
      parseCsv(t).forEach(function (r, fi) {
        /* Celda fusionada: gviz entrega "CLAVE TOGGLE MODO HORARIO" / "valor ON AUTO OFF" (separado por espacios o saltos). Las claves nunca llevan espacios. */
        var ka = String(r[0] || '').trim().split(/\s+/), vb = String(r[1] || '').trim().split(/\s+/);
        ka.forEach(function (k, i) {
          var K = k.trim().toUpperCase(); if (!K || K === 'CLAVE') return;
          var v = ka.length === 1 ? String(r[1] || '').trim() : (vb[i] != null ? vb[i] : '').trim();
          if (/^VALOR$/i.test(v)) v = '';
          if (vistos[K] && !v) return;
          vistos[K] = 1; out.push({ _fila: fi + 1, clave: K, valor: v });
        });
      });
      return out;
    });
  }
  function readTab(name, sheetId) {
    var u = 'https://docs.google.com/spreadsheets/d/' + (sheetId || CFG.sheetId) + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(name) + '&_=' + Date.now();
    return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var rows = parseCsv(t).filter(function (r) { return r.some(function (c) { return c && c.trim(); }); });
      if (!rows.length) return [];
      var head = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
      return rows.slice(1).map(function (r, i) {
        var o = { _fila: i + 2 };
        head.forEach(function (k, j) { o[k] = r[j] == null ? '' : r[j]; });
        return o;
      });
    });
  }
  /* Cada llamada tiene tiempo máximo: en iPhone una petición cortada al pasar a segundo plano nunca responde
     y dejaba el hub sin actualizar hasta cerrarlo. */
  var LENTAS = { cola: 1, redactarHub: 1, ajustarBorrador: 1, proponerMejora: 1, responder: 1, hilo: 1, probarPush: 1 };
  function call(action, payload) {
    if (!CFG.url) return Promise.resolve({ ok: false, error: 'no_url' });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var reloj = setTimeout(function () { if (ctl) ctl.abort(); }, LENTAS[action] ? 60000 : 25000);
    return fetch(CFG.url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, cache: 'no-store', signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify(Object.assign({ hub: 1, action: action, token: CFG.token }, payload || {}))
    }).then(function (r) { return r.json(); })
      .then(function (j) { clearTimeout(reloj); return j; })
      .catch(function (e) { clearTimeout(reloj); return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'no_url', detail: String(e) }; });
  }
  global.ALMA = {
    SHEET: CFG.sheetId,
    configure: function (url, token) { CFG.url = url; if (token) CFG.token = token; },
    hasApi: function () { return !!CFG.url; },
    /* Solo lo vivo (cola, log reciente, bandeja) desde el Apps Script: lo que cambia minuto a minuto. */
    probarPush: function (email) { return call('probarPush', { email: email }); },
    readLive: function () { return CFG.url ? call('cola', {}) : Promise.resolve(null); },
    readAll: function () {
      /* gviz devuelve la PRIMERA pestaña si el nombre no existe: se valida una columna esperada. */
      var opc = function (t, id, col) { return readTab(t, id).then(function (rows) { return rows.length && !(col in rows[0]) ? [] : rows; }).catch(function () { return []; }); };
      return Promise.all([readControl()].concat(['ALMA_COLA', 'ALMA_LOG', 'ALMA_INSTRUCCIONES'].map(function (t) { return readTab(t); }))
        .concat([opc('Reservas', CFG.webappSheetId, 'code'), opc('ALMA_AUTOMEJORA', null, 'borrador_ia'), opc('ALMA_CONOCIMIENTO', null, 'tema'), opc('PropiedadesInfo', CFG.webappSheetId, 'property_name'), opc('ALMA_CORREOS', null, 'asunto'), opc('ALMA_RESUELTAS', null, 'res_key'), opc('ALMA_ESCALAMIENTO', null, 'email')])
        )
        /* Lo vivo (cola/log/bandeja) lo trae readLive en paralelo: el hub no espera al Apps Script para pintar. */
        .then(function (r) { return { control: r[0], cola: r[1], log: r[2], instrucciones: r[3], reservas: r[4], automejora: r[5], conocimiento: r[6], propiedades: r[7], correos: r[8], resueltas: r[9], escalamiento: r[10] }; });
    },
    setControl: function (valores) { return call('setControl', { valores: valores }); },
    setEscalamiento: function (lista) { return call('setEscalamiento', { lista: lista }); },
    setPrompt: function (clave, prompt, nota) { return call('setPrompt', { clave: clave, prompt: prompt, nota: nota }); },
    setBorrador: function (fila, borrador) { return call('setBorrador', { fila: fila, borrador: borrador }); },
    enviarAhora: function (fila) { return call('enviarAhora', { fila: fila }); },
    retener: function (fila) { return call('retener', { fila: fila }); },
    resolver: function (key, estado, quien) { return call('resolver', { key: key, estado: estado, quien: quien || '' }); },
    programados: function (resId) { return call('programados', { resId: resId }); },
    adelantar: function (resId, id, texto) { return call('adelantar', { resId: resId, id: id, texto: texto || '' }); },
    foto: function (url) { return call('foto', { url: url }); },
    cancelarProg: function (resId, id) { return call('cancelarProg', { resId: resId, id: id }); },
    editarProg: function (resId, id, texto, quien) { return call('editarProg', { resId: resId, id: id, texto: texto, quien: quien || '' }); },
    proponerMejora: function (clave, prompt, pedido) { return call('proponerMejora', { clave: clave, prompt: prompt, pedido: pedido }); },
    ajustarBorrador: function (borrador, ajuste, contexto) { return call('ajustarBorrador', { borrador: borrador, ajuste: ajuste, contexto: contexto }); },
    automejora: function (fila, estado, cambios, nota) { return call('automejora', { fila: fila, estado: estado, cambios: cambios, nota: nota }); },
    setConocimiento: function (fila, tema, contenido, aplica, activo) { return call('setConocimiento', { fila: fila, tema: tema, contenido: contenido, aplica: aplica, activo: activo }); },
    setPropiedadDato: function (propiedad, campo, valor) { return call('setPropiedadDato', { propiedad: propiedad, campo: campo, valor: valor }); },
    hilo: function (resId) { return call('hilo', { resId: resId }); },
    redactarHub: function (resId, texto) { return call('redactarHub', { resId: resId, texto: texto }); },
    responder: function (resId, texto, quien) { return call('responder', { resId: resId, texto: texto, quien: quien || '' }); },
    votar: function (fila, voto) { return call('votar', { fila: fila, voto: voto }); }
  };
})(window);
