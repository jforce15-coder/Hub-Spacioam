/* Mini estudio · revisión de cada toma (Juan, 19-nov-2026: «que ahí mismo detecte los decibeles y diga si está bien o mal
   o si hay que corregir algo… y si hay un problema con la grabación que lo indique para regrabar esa parte»).
   Funciones puras, sin navegador: las usa alma/estudio.html y las prueba .github/estudio-calidad.js con señales sintéticas.
     · analizarToma(muestras, hz, opciones) → { estado: verde|amarillo|rojo, problemas: [{nivel, clave, texto, arreglo}], m }
     · analizarSala(muestras, hz)          → lo mismo para los 10 s de silencio del cuarto (ruido de fondo)
     · wav24(muestras, hz)                 → los bytes de un WAV PCM mono de 24 bit (sin compresión)
   Los umbrales viven aquí, una sola vez (UMBRAL), con su porqué. dBFS: 0 es el máximo digital; todo lo demás es negativo. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.EstudioCalidad = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var UMBRAL = {
    recorte: 0.989,          // |x| ≥ −0,1 dBFS: el convertidor ya no da más
    recorteSeguidas: 3,      // 3 muestras seguidas ahí = recorte de verdad (una sola puede ser un pico limpio)
    picoAlto: -1,            // pico sobre −1 dBFS: no recortó, pero casi
    picoObjetivo: [-12, -6], // lo que se pide: la voz normal pica entre −12 y −6
    picoBajo: -18,           // bajo pero usable (se sube después, con algo más de ruido)
    picoMuyBajo: -26,        // tan bajo que el ruido del micrófono pesa: regrabar subiendo la ganancia
    snrBien: 35,             // dB entre la voz y el ruido: 35+ es limpio para afinar una voz
    snrMal: 25,              // bajo 25 el modelo aprende el ruido del cuarto
    salaBien: -60,           // ruido del cuarto (RMS) en dBFS: −60 o menos, cuarto bueno
    salaMal: -50,            // sobre −50 se oye: apagar ventilador, refri, cerrar ventana
    inicioMin: 0.25,         // s de silencio antes de hablar (si no, la primera sílaba se corta)
    finMin: 0.3,             // s de silencio después de la última palabra
    silencioLargo: 5,        // s sin voz en medio de una toma
    vozMin: 0.6,             // s de voz: menos es que no se dijo nada
    cortaRoja: 0.45,         // la voz dura menos del 45 % de lo esperado → faltó texto
    cortaAmarilla: 0.65,
    largaVeces: 2.2,         // más del doble (+3 s) de lo esperado → probablemente se repitió algo
    dc: 0.02,                // desbalance de corriente continua (cable o adaptador)
    ruidoNuevo: 10           // el piso de ruido de la toma sube 10 dB sobre el del cuarto → entró un ruido
  };
  var VENTANA = 0.02;        // análisis en ventanas de 20 ms

  function db(x) { return x > 1e-10 ? 20 * Math.log10(x) : -200; }
  function redondo(x, d) { var p = Math.pow(10, d == null ? 1 : d); return Math.round(x * p) / p; }
  function percentil(lista, p) {
    if (!lista.length) return -200;
    var c = lista.slice().sort(function (a, b) { return a - b; });
    return c[Math.min(c.length - 1, Math.max(0, Math.floor(p * (c.length - 1))))];
  }

  /* Ventanas de 20 ms: su RMS en dB. Y de paso pico, recortes y DC de toda la señal. */
  function medir(x, hz) {
    var n = x.length, w = Math.max(1, Math.round(hz * VENTANA)), ventanas = [];
    var pico = 0, recortes = 0, seguidas = 0, suma = 0, suma2 = 0;
    for (var i = 0; i < n; i += w) {
      var s2 = 0, fin = Math.min(n, i + w);
      for (var j = i; j < fin; j++) {
        var v = x[j], a = v < 0 ? -v : v;
        if (a > pico) pico = a;
        if (a >= UMBRAL.recorte) { seguidas++; if (seguidas === UMBRAL.recorteSeguidas) recortes++; } else seguidas = 0;
        s2 += v * v; suma += v;
      }
      suma2 += s2;
      ventanas.push(db(Math.sqrt(s2 / (fin - i))));
    }
    return { ventanas: ventanas, pico: db(pico), rms: db(Math.sqrt(suma2 / Math.max(1, n))), recortes: recortes, dc: n ? suma / n : 0, dur: n / hz };
  }

  /* ¿Dónde hay voz? Una ventana es voz si pasa el piso de ruido por 12 dB (y −55 dBFS); se rellenan huecos de 150 ms. */
  function voz(ventanas, piso) {
    var umbral = Math.max(piso + 12, -55), marca = ventanas.map(function (v) { return v > umbral; });
    var hueco = Math.round(0.15 / VENTANA), ult = -1;
    for (var i = 0; i < marca.length; i++) {
      if (!marca[i]) continue;
      if (ult >= 0 && i - ult > 1 && i - ult <= hueco + 1) for (var k = ult + 1; k < i; k++) marca[k] = true;
      ult = i;
    }
    return marca;
  }

  function problema(nivel, clave, texto, arreglo) { return { nivel: nivel, clave: clave, texto: texto, arreglo: arreglo || '' }; }
  function estadoDe(ps) { return ps.some(function (p) { return p.nivel === 'rojo'; }) ? 'rojo' : ps.some(function (p) { return p.nivel === 'amarillo'; }) ? 'amarillo' : 'verde'; }

  function nivelProblemas(m, ps) {
    if (m.recortes > 0) ps.push(problema('rojo', 'recorte', 'Se saturó: la voz llegó al rojo ' + m.recortes + (m.recortes === 1 ? ' vez' : ' veces') + '.', 'Baja un poco la ganancia del receptor o aléjate 2 cm, y regraba.'));
    else if (m.pico > UMBRAL.picoAlto) ps.push(problema('amarillo', 'casi', 'Muy cerca del rojo (pico ' + redondo(m.pico) + ' dBFS).', 'Si en esta escena subes la emoción, baja un poquito la ganancia.'));
    if (m.pico < UMBRAL.picoMuyBajo) ps.push(problema('rojo', 'bajo', 'Muy bajo (pico ' + redondo(m.pico) + ' dBFS).', 'Sube la ganancia del receptor o acerca el micrófono, y regraba.'));
    else if (m.pico < UMBRAL.picoBajo) ps.push(problema('amarillo', 'bajo', 'Un poco bajo (pico ' + redondo(m.pico) + ' dBFS; lo ideal es entre −12 y −6).', 'Sube un poco la ganancia en la próxima toma.'));
  }

  /* Los 10 s de silencio del cuarto. */
  function analizarSala(x, hz) {
    var m = medir(x, hz), ps = [];
    var ruido = percentil(m.ventanas, 0.5), alto = m.ventanas.filter(function (v) { return v > ruido + 15; }).length * VENTANA;
    m.ruido = ruido;
    if (m.dur < 8) ps.push(problema('rojo', 'corta', 'El silencio duró ' + redondo(m.dur) + ' s; hacen falta 10.', 'Graba de nuevo y espera a que termine la cuenta.'));
    if (ruido > UMBRAL.salaMal) ps.push(problema('rojo', 'ruido', 'El cuarto tiene mucho ruido de fondo (' + redondo(ruido) + ' dBFS).', 'Apaga ventilador, aire, refri o compu ruidosa; cierra la ventana; prueba otro cuarto con cosas blandas.'));
    else if (ruido > UMBRAL.salaBien) ps.push(problema('amarillo', 'ruido', 'Se oye un poco de ruido de fondo (' + redondo(ruido) + ' dBFS; lo ideal es −60 o menos).', 'Si puedes, apaga lo que zumba. Si no, sirve, pero cuida que no aumente.'));
    if (alto > 0.3) ps.push(problema('amarillo', 'golpe', 'Hubo un ruido durante el silencio (un movimiento, un carro, un golpe).', 'Quédate quieta y graba el silencio otra vez.'));
    if (m.recortes > 0 || m.pico > -10) ps.push(problema('amarillo', 'voz', 'Se oyó algo fuerte durante el silencio.', 'Graba el silencio otra vez, sin hablar ni moverte.'));
    return { estado: estadoDe(ps), problemas: ps, m: limpio(m) };
  }

  /* Una toma. opciones: { ruidoSala (dBFS del silencio del cuarto), esperado (s que debería durar la lectura) } */
  function analizarToma(x, hz, o) {
    o = o || {};
    var m = medir(x, hz), ps = [];
    /* El ruido se mide en la propia toma (sus ventanas más bajas: el silencio del inicio, del final y de las pausas); el
       del cuarto solo sirve para notar un ruido que entró después. */
    var pisoToma = percentil(m.ventanas, 0.05), piso = pisoToma;
    var marca = voz(m.ventanas, piso), primera = marca.indexOf(true), ultima = marca.lastIndexOf(true);
    var pot = 0, nv = 0, silMax = 0, sil = 0;
    for (var i = 0; i < marca.length; i++) {
      if (marca[i]) { pot += Math.pow(10, m.ventanas[i] / 10); nv++; if (sil > silMax) silMax = sil; sil = 0; }
      else if (i > primera && primera >= 0) sil++;
    }
    m.ruido = pisoToma;
    m.vozDb = nv ? 10 * Math.log10(pot / nv) : -200;
    m.snr = m.vozDb - Math.max(piso, -120);
    m.voz = nv * VENTANA;
    m.inicio = primera < 0 ? m.dur : primera * VENTANA;
    m.fin = ultima < 0 ? 0 : m.dur - (ultima + 1) * VENTANA;
    m.habla = primera < 0 ? 0 : (ultima - primera + 1) * VENTANA;
    m.silencioMax = silMax * VENTANA;
    if (m.voz < UMBRAL.vozMin) {
      ps.push(problema('rojo', 'sinvoz', 'No escuché voz en la toma.', 'Revisa que el micrófono esté conectado y elegido arriba, y regraba.'));
      return { estado: 'rojo', problemas: ps, m: limpio(m) };
    }
    nivelProblemas(m, ps);
    if (m.snr < UMBRAL.snrMal) ps.push(problema('rojo', 'snr', 'Mucho ruido junto a la voz (la voz pasa al ruido por ' + redondo(m.snr, 0) + ' dB).', 'Busca qué hace ruido (ventilador, calle, compu), acércate al micrófono o sube la ganancia, y regraba.'));
    else if (m.snr < UMBRAL.snrBien) ps.push(problema('amarillo', 'snr', 'Algo de ruido de fondo (la voz pasa al ruido por ' + redondo(m.snr, 0) + ' dB; lo ideal es 35 o más).', 'Sirve, pero si puedes, quita el ruido antes de seguir.'));
    if (o.ruidoSala != null && isFinite(o.ruidoSala) && pisoToma > o.ruidoSala + UMBRAL.ruidoNuevo)
      ps.push(problema('amarillo', 'ruidonuevo', 'Entró un ruido que no estaba en el silencio del cuarto.', 'Escucha la toma: si se oye un carro, un perro o un roce, regrábala.'));
    if (m.inicio < UMBRAL.inicioMin) ps.push(problema('amarillo', 'inicio', 'Empezaste a hablar muy pronto: se pudo cortar la primera sílaba.', 'Espera a que el teleprompter diga «Habla».'));
    if (m.fin < UMBRAL.finMin) ps.push(problema('amarillo', 'fin', 'Paraste muy pronto: se pudo cortar la última palabra.', 'Al terminar, quédate un segundo en silencio antes de parar.'));
    if (m.silencioMax > UMBRAL.silencioLargo) ps.push(problema('amarillo', 'hueco', 'Hubo un silencio de ' + redondo(m.silencioMax, 0) + ' s en medio.', 'Si te perdiste, regrábala de corrido.'));
    if (Math.abs(m.dc) > UMBRAL.dc) ps.push(problema('amarillo', 'dc', 'La señal viene desbalanceada (DC).', 'Revisa el cable o el adaptador del receptor.'));
    var esp = Number(o.esperado) || 0;
    if (esp > 0) {
      if (m.habla < esp * UMBRAL.cortaRoja) ps.push(problema('rojo', 'corta', 'Toma demasiado corta (' + redondo(m.habla) + ' s de unos ' + redondo(esp, 0) + '): parece que faltó texto.', 'Lee el texto completo y regraba.'));
      else if (m.habla < esp * UMBRAL.cortaAmarilla) ps.push(problema('amarillo', 'corta', 'Más corta de lo esperado: ¿leíste muy rápido o saltaste algo?', 'Si fue rápido, prueba más despacio: Alma es serena.'));
      else if (m.habla > esp * UMBRAL.largaVeces + 3) ps.push(problema('amarillo', 'larga', 'Mucho más larga de lo esperado: ¿se repitió algo?', 'Si repetiste una parte, regrábala de corrido.'));
    }
    return { estado: estadoDe(ps), problemas: ps, m: limpio(m) };
  }

  function limpio(m) {
    var o = {};
    ['pico', 'rms', 'ruido', 'vozDb', 'snr', 'voz', 'inicio', 'fin', 'habla', 'silencioMax', 'dur'].forEach(function (k) { if (m[k] != null) o[k] = redondo(m[k], 2); });
    o.recortes = m.recortes; o.dc = redondo(m.dc, 4);
    return o;
  }

  /* WAV PCM mono de 24 bit: lo que se guarda, sin compresión ni efectos. */
  function wav24(x, hz) {
    var n = x.length, datos = n * 3, b = new Uint8Array(44 + datos), v = new DataView(b.buffer);
    function txt(p, s) { for (var i = 0; i < s.length; i++) b[p + i] = s.charCodeAt(i); }
    txt(0, 'RIFF'); v.setUint32(4, 36 + datos, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, hz, true);
    v.setUint32(28, hz * 3, true); v.setUint16(32, 3, true); v.setUint16(34, 24, true); txt(36, 'data'); v.setUint32(40, datos, true);
    for (var i = 0, p = 44; i < n; i++, p += 3) {
      var s = x[i]; s = s > 1 ? 1 : s < -1 ? -1 : s;
      var e = s < 0 ? Math.round(s * 8388608) : Math.round(s * 8388607);
      if (e < 0) e += 16777216;
      b[p] = e & 255; b[p + 1] = (e >> 8) & 255; b[p + 2] = (e >> 16) & 255;
    }
    return b;
  }

  /* Zona del medidor en vivo para un pico en dBFS: rojo (≥ −3), amarillo (−6…−3 o bajo −18), verde (−18…−6). */
  function zona(picoDb) { return picoDb >= -3 ? 'rojo' : picoDb > -6 ? 'amarillo' : picoDb >= UMBRAL.picoBajo ? 'verde' : 'amarillo'; }

  return { UMBRAL: UMBRAL, analizarToma: analizarToma, analizarSala: analizarSala, wav24: wav24, zona: zona, db: db };
}));
