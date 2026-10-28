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
  var LENTAS = { cola: 1, redactarHub: 1, ajustarBorrador: 1, apelacionReview: 1, respuestaReview: 1, reviewHuesped: 1, guestReview: 1, enviarReview: 1, publicarRespuesta: 1, proponerMejora: 1, responder: 1, hilo: 1, reservaInfo: 1, probarPush: 1, opEnviar: 1, opHilo: 1, opLista: 1, almaFoto: 1 };
  var SALEN = { responder: 1, responderWa: 1 };
  function call(action, payload) {
    if (!CFG.url) return Promise.resolve({ ok: false, error: 'no_url' });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var reloj = setTimeout(function () { if (ctl) ctl.abort(); }, LENTAS[action] ? 60000 : 25000);
    /* Enviar un mensaje: keepalive hace que el pedido termine de salir aunque se cierre la pestaña o se cambie de app;
       el servidor lo envía igual y avisa a quien lo escribió si no salió (apps-script/envio.js). */
    var seguir = SALEN[action] === 1;
    return fetch(CFG.url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, cache: 'no-store', keepalive: seguir, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify(Object.assign({ hub: 1, action: action, token: CFG.token, session: global.SAAuth && SAAuth.session ? SAAuth.session() : null }, payload || {}))
    }).then(function (r) { if (!r.ok) return { ok: false, error: 'HTTP ' + r.status }; return r.json().catch(function () { return { ok: false, error: 'respuesta inválida del Apps Script' }; }); })
      .then(function (j) { clearTimeout(reloj); if (global.SAAuth && SAAuth.checkResponse) SAAuth.checkResponse(j); return j; })
      .catch(function (e) { clearTimeout(reloj); return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'red', detail: String(e) }; });
  }
  global.ALMA = {
    SHEET: CFG.sheetId,
    configure: function (url, token) { CFG.url = url; if (token) CFG.token = token; },
    hasApi: function () { return !!CFG.url; },
    /* Para la voz nativa de la app (Alma con el teléfono bloqueado): a dónde y con qué llave pedir la ficha. */
    destino: function () { return { url: CFG.url, token: CFG.token }; },
    /* Solo lo vivo (cola, log reciente, bandeja) desde el Apps Script: lo que cambia minuto a minuto. */
    probarPush: function (email) { return call('probarPush', { email: email }); },
    pushLog: function (horas) { return call('pushLog', { horas: horas || 48 }); },
    readLive: function (horas, hash) { return CFG.url ? call('cola', { horas: horas || 48, hash: hash || '' }) : Promise.resolve(null); },
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
    vozWeb: function (ligero) { return call('vozWeb', ligero ? { ligero: 1 } : {}); },
    vozWebVincular: function (convId) { return call('vozWebVincular', { conv_id: convId }); },
    setEscalamiento: function (lista) { return call('setEscalamiento', { lista: lista }); },
    setPrompt: function (clave, prompt, nota, meta) { return call('setPrompt', { clave: clave, prompt: prompt, nota: nota, meta: meta || null }); },
    mejoras: function () { return call('mejoras', {}); },
    acciones: function () { return call('acciones', {}); },
    accionHecha: function (id) { return call('accionHecha', { id: id }); },
    usoIA: function (dias) { return call('usoIA', { dias: dias || 30 }); },
    mejoraEditar: function (id, cambios, resumen) { return call('mejoraEditar', { id: id, cambios: cambios, resumen: resumen }); },
    mejoraEliminar: function (id) { return call('mejoraEliminar', { id: id }); },
    mejoraVerificar: function (id) { return call('mejoraVerificar', { id: id }); },
    prompts: function () { return call('prompts', {}); },
    programar: function (resId, texto, envio, quien) { return call('programar', { resId: resId, texto: texto, envio: envio, quien: quien }); },
    setAuto: function (resId, on, quien) { return call('setAuto', { resId: resId, on: !!on, quien: quien }); },
    setBorrador: function (fila, borrador) { return call('setBorrador', { fila: fila, borrador: borrador }); },
    enviarAhora: function (fila) { return call('enviarAhora', { fila: fila }); },
    retener: function (fila) { return call('retener', { fila: fila }); },
    resolver: function (key, estado, quien, ts) { return call('resolver', { key: key, estado: estado, quien: quien || '', ts: ts || 0 }); },
    reservaInfo: function (resId) { return call('reservaInfo', { resId: resId }); },
    programados: function (resId) { return call('programados', { resId: resId }); },
    adelantar: function (resId, id, texto) { return call('adelantar', { resId: resId, id: id, texto: texto || '' }); },
    foto: function (url) { return call('foto', { url: url }); },
    cancelarProg: function (resId, id) { return call('cancelarProg', { resId: resId, id: id }); },
    editarProg: function (resId, id, texto, quien) { return call('editarProg', { resId: resId, id: id, texto: texto, quien: quien || '' }); },
    proponerMejora: function (clave, prompt, pedido) { return call('proponerMejora', { clave: clave, prompt: prompt, pedido: pedido }); },
    guestReview: function (resId) { return call('guestReview', { resId: resId }); },
    enviarReview: function (resId, texto, recomendar, privado, delay) { return call('enviarReview', { resId: resId, texto: texto, recomendar: recomendar, privado: privado || '', delay: !!delay }); },
    reviewHuesped: function (resId, recomendar, contexto, ajuste, previo) { return call('reviewHuesped', { resId: resId, recomendar: recomendar, contexto: contexto || '', ajuste: ajuste || '', previo: previo || '' }); },
    respuestaReview: function (review, contexto, ajuste, previo) { return call('respuestaReview', { review: review, contexto: contexto || '', ajuste: ajuste || '', previo: previo || '' }); },
    publicarRespuesta: function (uuid, texto) { return call('publicarRespuesta', { uuid: uuid, texto: texto }); },
    apelacion: function (review, contexto, ajuste, previo) { return call('apelacionReview', { review: review, contexto: contexto || '', ajuste: ajuste || '', previo: previo || '' }); },
    ajustarBorrador: function (borrador, ajuste, contexto) { return call('ajustarBorrador', { borrador: borrador, ajuste: ajuste, contexto: contexto }); },
    automejora: function (fila, estado, cambios, nota, fecha) { return call('automejora', { fila: fila, estado: estado, cambios: cambios, nota: nota, fecha: fecha }); },
    setConocimiento: function (fila, tema, contenido, aplica, activo, meta) { return call('setConocimiento', { fila: fila, tema: tema, contenido: contenido, aplica: aplica, activo: activo, meta: meta || null }); },
    setPropiedadDato: function (propiedad, campo, valor, meta) { return call('setPropiedadDato', { propiedad: propiedad, campo: campo, valor: valor, meta: meta || null }); },
    hilo: function (resId) { return call('hilo', { resId: resId }); },
    redactarHub: function (resId, texto, hilo) { return call('redactarHub', { resId: resId, texto: texto, hilo: hilo || [] }); },
    responder: function (resId, texto, quien, canal) { return call('responder', { resId: resId, texto: texto, quien: quien || '', canal: canal || '' }); },
    responderWa: function (resId, texto, quien, wa) { return call('responderWa', { resId: resId, texto: texto, quien: quien || '', wa: wa || '' }); },
    waNumeros: function (resId) { return call('waNumeros', { resId: resId }); },
    limpiezas: function (codigo) { return call('limpiezas', { codigo: codigo }); },
    pasos: function (ids) { return call('pasos', { ids: ids }); },
    promesas: function (todas) { return call('promesas', { todas: !!todas }); },
    promesaCerrar: function (id, quien) { return call('promesaCerrar', { id: id, quien: quien || '' }); },
    votar: function (fila, voto) { return call('votar', { fila: fila, voto: voto }); },
    opHilo: function (email, de) { return call('opHilo', { email: email, de: de || '' }); },
    /* foto del chat de Alma: el Hub la describe (IA con visión) para que Alma sepa qué se ve */
    almaFoto: function (dataUrl) { return call('almaFoto', { foto: dataUrl }); },
    opEnviar: function (email, texto) { return call('opEnviar', { email: email, texto: texto }); },
    opLista: function (email) { return call('opLista', { email: email }); }
  };
})(window);
