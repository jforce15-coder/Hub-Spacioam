/* Prueba de la guardia del «me encargo» (apps-script/guardia.js y su enganche en voz.js, #879) con dobles: sin internet, sin
   Google y sin IA. Repite lo que pasó el 19-nov: Juan dictó unos 3 min para el manifiesto y pidió buscar un anuncio; la voz
   dijo cuatro veces «Me encargo / Voy a buscar ese anuncio… y te mando opciones» y nunca llamó a su sistema.
   Revisa:
   1. esa llamada (sin ninguna secretaria) → se pide en segundo plano con las palabras de Juan, TODAS y tal cual (no el
      resumen de la voz), y le llega a Pendientes «Esto no había salido…, ya lo mandé» con su dictado;
   2. con la secretaria llamada y con resultado en ese tramo → nada (ni pedido ni aviso);
   3. la secretaria contestó con error (ok: false) → cuenta como no pedido;
   4. lo que ya salió antes por la secretaria no se repite: solo van las palabras de después;
   5. frases de espera («Déjame revisar…») y una charla sin compromisos → nada; sin administrador → nada;
   6. si no se pudo encolar → el aviso pide su atención y trae sus palabras;
   8. (parte 2, 19-nov 20:29) «Listo, se lo paso a Claudio» sin secretaria y después una secretaria de OTRO tema → sí se
      pide, solo con las palabras de ese turno (lo del otro tema ya salió); si Juan solo asiente («ok») el tramo sigue
      abierto, y una secretaria más tarde con sus palabras lo respalda;
   9. (guardia 20-nov-2026) en una Guía de camino (guiar_camino) «Sigue guiándome», «dónde queda», «te aviso» no cuentan:
      la cumple la app; otro tema en la misma llamada sí se revisa;
   7. vozPostCall_ llama a la guardia con un administrador, y un pedido largo pasa completo por la caché (vozSecEncolar_ →
      vozSecProcesar_).
   node .github/guardia.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const ADM = { email: 'juan@prueba', nombre: 'Juan Prueba', tels: ['50255550100'], principal: true };
function caja(o) {
  o = o || {};
  const cola = [], pend = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date,
    vozSecEncolar_: (tel, pedido, conf) => { if (o.encolarFalla) throw new Error('sin cola'); cola.push({ tel, pedido, conf }); return { ok: true, en_proceso: true }; },
    pendAvisar_: (adm, t, x) => { pend.push({ t, x }); return true; }
  };
  vm.createContext(ctx);
  vm.runInContext(leer('guardia.js'), ctx, { filename: 'guardia.js' });
  return { X: ctx, cola, pend };
}
const U = (s, m) => ({ role: 'user', time_in_call_secs: s, message: m });
const A = (s, m, extra) => Object.assign({ role: 'agent', time_in_call_secs: s, message: m }, extra || {});
const SEC = (ok, extra) => ({ tool_results: [{ tool_name: 'secretaria', is_error: false, result_value: JSON.stringify(Object.assign({ ok, resultado: ok ? 'Recibido.' : undefined, error: ok ? undefined : 'NO SE HIZO NADA' }, extra || {})) }] });

/* El dictado de prueba (inventado; largo como el de 79 s del 19-nov). */
const DICTADO = 'Para el manifiesto: creemos que cada casa cuenta una historia y que quien llega debe sentirse esperado. '.repeat(30).trim();
const LLAMADA = [
  A(0, '¡Hola Juan! ¿En qué te ayudo?'),
  U(5, 'Alma, te voy a dictar el texto del manifiesto, apúntalo completo.'),
  A(12, 'Claro, dime.'),
  U(20, DICTADO),
  A(94, 'Me encargo, lo guardo completo para el manifiesto.'),
  U(110, 'Y busca el anuncio Think Different de Apple para usarlo de referencia.'),
  A(274, 'Voy a buscar ese anuncio y te mando opciones.'),
  A(287, 'Voy a buscar ese anuncio y te mando opciones.'),
  U(300, 'Perfecto, gracias.'),
  A(309, 'Me encargo.'),
  A(329, 'Me encargo, te aviso.')
];

/* 1 · La llamada del 19-nov */
{ const { X, cola, pend } = caja();
  ok(X.guardiaAlColgar_(ADM, '50255550100', LLAMADA, 'conv_prueba1') === true, 'la llamada del 19-nov (cuatro «me encargo», ninguna secretaria) → se pide');
  ok(cola.length === 1 && cola[0].tel === '50255550100' && cola[0].conf === false, 'un solo pedido en segundo plano, al número de Juan');
  const p = (cola[0] || {}).pedido || '';
  ok(p.indexOf(DICTADO) >= 0 && /Think Different/.test(p) && /apúntalo completo/.test(p), 'el pedido lleva TODAS sus palabras, tal cual (el dictado completo y el anuncio)');
  ok(!/Voy a buscar ese anuncio y te mando opciones\.\n/.test(p) && p.split('Me encargo').length <= 2, 'el pedido no usa lo que dijo la voz como si fueran sus palabras');
  ok(pend.length === 1 && /^Esto no había salido de la llamada/.test(pend[0].t) && /Ya lo mandé/.test(pend[0].t) && pend[0].t.indexOf(DICTADO) >= 0, 'a Pendientes: «Esto no había salido…, ya lo mandé» con su dictado');
  ok(pend[0] && pend[0].x.tipo === 'aviso' && /conv_prueba1/.test(pend[0].x.pedido), 'el aviso es informativo y dice de qué llamada');
}

/* 2 · Con la secretaria llamada y con resultado en ese tramo: nada */
{ const { X, cola, pend } = caja();
  const t = [U(5, 'Busca el anuncio Think Different de Apple.'), A(8, '', SEC(true)), A(10, 'Listo, me encargo y te mando opciones.')];
  ok(X.guardiaAlColgar_(ADM, '50255550100', t, 'c2') === false && !cola.length && !pend.length, 'con la secretaria y su resultado → nada');
  const t2 = [U(5, 'Busca el anuncio.'), A(8, 'Me encargo.'), A(9, '', SEC(true))];
  ok(caja().X.guardiaSinPedir_(t2) === null, '«me encargo» dicho justo antes de que vuelva la secretaria (mismo tramo) → respaldado');
  const t3 = [U(5, 'Busca el anuncio.'), A(8, '', { tool_results: [{ tool_name: 'enviar_confirmado', result_value: '{"ok":true,"en_camino":true}' }] }), A(9, 'Lo estoy enviando, te aviso.')];
  ok(caja().X.guardiaSinPedir_(t3) === null, 'enviar_confirmado con resultado también respalda');
}

/* 3 · La secretaria contestó con error: no quedó pedido */
{ const { X, cola } = caja();
  const t = [U(5, 'Busca el anuncio Think Different.'), A(8, '', SEC(false)), A(10, 'Me encargo.')];
  ok(X.guardiaAlColgar_(ADM, '50255550100', t, 'c3') === true && cola.length === 1, 'la secretaria con ok:false no respalda → se pide');
  const t2 = [U(5, 'Busca el anuncio.'), A(8, '', { tool_results: [{ tool_name: 'lookup_reservation', result_value: '{"ok":true}' }] }), A(10, 'Me encargo.')];
  ok(caja().X.guardiaSinPedir_(t2) !== null, 'otra herramienta (buscar una reserva) no cuenta como pedirlo');
}

/* 4 · Lo que ya salió no se repite */
{ const { X } = caja();
  const t = [U(5, 'Mándale a recepción que llego tarde.'), A(8, '', SEC(true)), A(9, 'Listo, quedó.'), U(20, 'Y busca el anuncio Think Different.'), A(25, 'Voy a buscar ese anuncio y te mando opciones.')];
  const g = X.guardiaSinPedir_(t);
  ok(g && /Think Different/.test(g.palabras) && !/recepción/.test(g.palabras), 'solo van las palabras de después de lo que ya salió');
  ok(g && g.dichos.length === 1 && g.dichos[0].seg === 25, 'cuenta el compromiso y su segundo');
}

/* 5 · Frases de espera, charla y sin administrador */
{ const { X, cola, pend } = caja();
  ok(X.guardiaSinPedir_([U(5, '¿Cuántas llegadas hay hoy?'), A(6, 'Déjame revisar…'), A(7, 'Dame un segundo.')]) === null, 'frases de espera («Déjame revisar…») → nada');
  ok(X.guardiaSinPedir_([U(5, 'Hola Alma, ¿cómo estás?'), A(6, '¡Muy bien! ¿Y tú?'), U(8, 'Bien, gracias, adiós.'), A(9, 'Que te vaya bien.')]) === null, 'charla sin compromisos → nada');
  ok(X.guardiaAlColgar_(null, '50255550100', LLAMADA, 'c5') === false && X.guardiaAlColgar_(ADM, '', LLAMADA, 'c5') === false && !cola.length && !pend.length, 'sin administrador o sin número → nada');
  ok(X.guardiaSinPedir_([A(0, 'Hola, me encargo de todo.')]) === null, 'sin nada dicho por Juan no hay pedido que mandar');
}

/* 6 · No se pudo encolar */
{ const { X, pend } = caja({ encolarFalla: true });
  ok(X.guardiaAlColgar_(ADM, '50255550100', LLAMADA, 'c6') === false && pend.length === 1 && pend[0].x.tipo === 'atencion' && /Tampoco pude mandarlo/.test(pend[0].t) && pend[0].t.indexOf(DICTADO) >= 0, 'sin cola → aviso de atención con sus palabras para pedirlo otra vez');
}

/* 8 · Parte 2: el respaldo es por tema (llamada del 19-nov 20:29) */
{ const SECP = (ok, args) => ({ tool_calls: [{ request_id: 'r' + args.length, tool_name: 'secretaria', params_as_json: JSON.stringify({ pedido: args }) }], tool_results: [{ request_id: 'r' + args.length, tool_name: 'secretaria', is_error: false, result_value: JSON.stringify({ ok }) }] });
  const GROW = 'Oye, ese problema de la app de Grow que no carga las fotos, necesito que se lo pases a Claudio.';
  const t = [A(0, '¡Hola Juan!'), U(6, GROW), A(11, 'Listo, se lo paso a Claudio para que lo revise.'),
    U(40, 'Otra cosa: el candado de Narama 1012 no abre, el código no funciona.'), U(70, 'Pide que lo revisen hoy.'),
    A(82, '', SECP(true, 'El candado de Narama 1012 no abre, el código no funciona; que lo revisen hoy.')), A(95, 'Listo, ya quedó pedido lo del candado.')];
  const { X, cola } = caja();
  const g = X.guardiaSinPedir_(t);
  ok(g && g.dichos.length === 1 && g.dichos[0].seg === 11, 'una secretaria de OTRO tema más tarde no respalda «se lo paso a Claudio» (dichos=1, seg 11)');
  ok(g && g.palabras === GROW, 'van solo las palabras del seg 6 (lo del candado ya salió y no se repite)');
  ok(X.guardiaAlColgar_(ADM, '50255550100', t, 'conv_grow') === true && cola.length === 1 && cola[0].pedido.indexOf(GROW) >= 0 && !/Narama/.test(cola[0].pedido), 'al colgar se pide lo de Grow, sin lo del candado');
  const t2 = [U(6, GROW), A(11, 'Listo, se lo paso a Claudio.'), U(14, 'Ok, gracias.'), A(16, '', SECP(true, 'Para Claudio: la app de Grow no carga las fotos.'))];
  ok(X.guardiaSinPedir_(t2) === null, 'si Juan solo asiente («Ok, gracias») y la secretaria vuelve después, sigue en su tramo → respaldado');
  const t3 = [U(6, GROW), A(11, 'Listo, se lo paso a Claudio.'), U(30, '¿Cuántas llegadas hay hoy?'), A(35, 'Hoy hay tres llegadas.'), A(50, '', SECP(true, 'Claudio: revisa por qué la app de Grow no carga las fotos.'))];
  ok(X.guardiaSinPedir_(t3) === null, 'si lo pidió más tarde con sus palabras (Grow, fotos) → respaldado');
  const t4 = [U(6, GROW), A(11, 'Listo, se lo paso a Claudio.'), U(30, 'Y el candado.'), A(50, '', SECP(false, 'Claudio: la app de Grow no carga las fotos.'))];
  ok(X.guardiaSinPedir_(t4) !== null, 'si esa secretaria volvió con error → no respalda');
}

/* 9 · Guardia 20-nov-2026: la Guía de camino la cumple la app (guiar_camino), no la secretaria */
{ const GUIA = (extra) => Object.assign({ tool_calls: [{ request_id: 'g1', tool_name: 'guiar_camino', params_as_json: '{"destino":"Parque Central"}' }], tool_results: [{ request_id: 'g1', tool_name: 'guiar_camino', result_value: '{"ok":true,"primer_paso":"Sal a la 5a Avenida"}' }] }, extra || {});
  const t = [U(3, '¿Cómo llego al Parque Central?'), A(6, '', GUIA()), A(8, 'Te llevo caminando, son 12 minutos. Sal a la 5a Avenida y yo te aviso dónde cruzar.'),
    U(200, 'Sigue guiándome, ¿dónde queda la tienda?'), A(204, 'Sigue recto media cuadra; en la esquina te aviso.'), U(260, 'Ok.'), A(262, 'Voy a buscar la siguiente referencia y te aviso.')];
  const { X, cola, pend } = caja();
  ok(X.guardiaSinPedir_(t) === null && X.guardiaAlColgar_(ADM, '50255550100', t, 'c9') === false && !cola.length && !pend.length, 'Guía de camino («Sigue guiándome», «dónde queda», «te aviso») → nada: la cumple la app');
  const t2 = t.concat([U(300, 'Y mándale a recepción el reporte de limpieza.'), A(303, 'Te mando el reporte en un rato.')]);
  const g2 = X.guardiaSinPedir_(t2);
  ok(g2 && g2.dichos.length === 1 && g2.dichos[0].seg === 303 && /reporte de limpieza/.test(g2.palabras), 'en la misma llamada, un compromiso de otro tema sí se revisa');
  const t3 = [U(3, 'Sigue guiándome, ¿dónde queda la tienda?'), A(6, 'Sigue recto, yo te aviso.')];
  ok(X.guardiaSinPedir_(t3) !== null, 'sin guiar_camino en la llamada, la guardia sigue igual');
  const t4 = [U(3, '¿Cómo llego al Parque Central?'), A(6, '', GUIA()), U(50, 'Pásame la ruta del día de Sucely.'), A(54, 'Te la mando ahorita.')];
  ok(X.guardiaSinPedir_(t4) !== null, '«la ruta del día» (la del equipo) no es la guía: se revisa');
}

/* 7 · El enganche en voz.js */
{ const VOZ = leer('voz.js');
  const pc = (/\nfunction vozPostCall_\([^)]*\) \{[\s\S]*?\n\}/.exec(VOZ) || [''])[0];
  ok(/if \(admC\) \{ try \{ guardiaAlColgar_\(admC, tel, d\.transcript, convEL\)/.test(pc), 'vozPostCall_ corre la guardia con un administrador');
  const enc = (/\nfunction vozSecEncolar_\([^)]*\) \{[\s\S]*?\n\}/.exec(VOZ) || [''])[0], pro = (/\nfunction vozSecProcesar_\([^)]*\) \{[\s\S]*?\n\}/.exec(VOZ) || [''])[0];
  /* Encolar y procesar un pedido largo con dobles: la propiedad lleva 3000 caracteres y la caché el pedido completo. */
  const props = {}, cache = {}, hechos = [];
  const ctx = { console: { log() {}, error() {} }, JSON, Math, String, Number, Object, Array, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = String(v); } }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ after: () => ({ create() {} }) }) }) },
    vozColaLock_: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }), adminPorTel_: () => ADM, orbitaEmpieza_: () => '', vozTrabajando_() {},
    opFilas_: () => [], opGuardar_: () => ({ id: 1 }), opAgente_: (adm, pedido) => { hechos.push(pedido); return { respuesta: 'ok', hechas: [] }; },
    chatTurnoCerrar_: () => ({}), orbitaTermina_() {}, vozEnvioFallo_() {}, vozSecAvisar_() {}, AGENTE_CONF_: false, ORBITA_ACTUAL_: null };
  vm.createContext(ctx); vm.runInContext(enc + pro, ctx);
  const largo = 'Pedido de una llamada: ' + DICTADO + DICTADO;
  ctx.vozSecEncolar_('50255550100', largo, false);
  const enCola = JSON.parse(props.VOZ_SEC_COLA || '[]');
  ok(largo.length > 3000 && enCola.length === 1 && enCola[0].pedido.length === 3000 && enCola[0].largo && cache[enCola[0].largo] === largo, 'un pedido largo: 3000 en la cola y completo en la caché');
  enCola[0].t -= 60000; props.VOZ_SEC_COLA = JSON.stringify(enCola);
  ctx.vozSecProcesar_();
  ok(hechos.length === 1 && hechos[0] === largo, 'la secretaria recibe el pedido completo, no el recorte');
}

if (fallo) { console.log('::error::La guardia del «me encargo» no pasa (apps-script/guardia.js)'); process.exit(1); }
console.log('OK guardia del «me encargo»');
