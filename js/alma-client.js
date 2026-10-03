/* Spacio AM · Cliente del hub para ALMA (asistente nocturno de huéspedes).
   Hoja de ALMA: ALMA_CONTROL · ALMA_COLA · ALMA_LOG · ALMA_INSTRUCCIONES
   Lectura: gviz CSV directo de la hoja. Escritura y IA: el Apps Script de ALMA
   (alma-hub-api.gs) vía POST text/plain {hub:1, action, token, ...}.        */
(function (global) {
  var CFG = {
    sheetId: '1K8_MUCmJ4_Ks4DMKLSCbua1qC7X6QuilRaMvCquZ7kk',
    url: 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec',                 // URL /exec del Apps Script de ALMA (pendiente)
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
  function readTab(name, sheetId) {
    var u = 'https://docs.google.com/spreadsheets/d/' + (sheetId || CFG.sheetId) + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(name);
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
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
  function call(action, payload) {
    if (!CFG.url) return Promise.resolve({ ok: false, error: 'no_url' });
    return fetch(CFG.url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ hub: 1, action: action, token: CFG.token }, payload || {}))
    }).then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: 'no_url', detail: String(e) }; });
  }
  global.ALMA = {
    SHEET: CFG.sheetId,
    configure: function (url, token) { CFG.url = url; if (token) CFG.token = token; },
    hasApi: function () { return !!CFG.url; },
    readAll: function () {
      var reservas = readTab('Reservas', CFG.webappSheetId).catch(function () { return []; });
      return Promise.all(['ALMA_CONTROL', 'ALMA_COLA', 'ALMA_LOG', 'ALMA_INSTRUCCIONES'].map(function (t) { return readTab(t); }).concat([reservas]))
        .then(function (r) { return { control: r[0], cola: r[1], log: r[2], instrucciones: r[3], reservas: r[4] }; });
    },
    setControl: function (valores) { return call('setControl', { valores: valores }); },
    setPrompt: function (clave, prompt, nota) { return call('setPrompt', { clave: clave, prompt: prompt, nota: nota }); },
    setBorrador: function (fila, borrador) { return call('setBorrador', { fila: fila, borrador: borrador }); },
    enviarAhora: function (fila) { return call('enviarAhora', { fila: fila }); },
    retener: function (fila) { return call('retener', { fila: fila }); },
    proponerMejora: function (clave, prompt, pedido) { return call('proponerMejora', { clave: clave, prompt: prompt, pedido: pedido }); },
    ajustarBorrador: function (borrador, ajuste, contexto) { return call('ajustarBorrador', { borrador: borrador, ajuste: ajuste, contexto: contexto }); }
  };
})(window);
