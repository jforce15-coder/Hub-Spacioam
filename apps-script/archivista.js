/* ═══ DEPARTAMENTO DE ARCHIVO ══════════════════════════════════════════════════════════════════════════════
   Uno de los agentes detrás de Alma (agentes.js, tipo «archivo»; no confundir con archivo.js, que guarda lo viejo en la memoria larga). Su único propósito: que todo esté ordenado.
   En cada ronda (mañana y noche):
     1 · Clasifica lo nuevo: conversaciones con Alma, encargos personales y proyectos (lo mismo que hace la app al abrir
         las áreas, pero sin esperar a que la abras).
     2 · Revisa lo que quedó «sin clasificar», ahora con más contexto (la conversación completa y lo que se habló antes y
         después) y le da un lugar: un área o un cajón (Ideas, Interés, Ocio). Si de verdad no se entiende, va a Ocio:
         nada se queda sin lugar.
     3 · Marca el tipo de lo que no lo tiene: proceso (se resuelve y termina) o permanente (está para quedarse).
     4 · Deja su informe. Si encontró ideas nuevas (proyectos en potencia), Alma se las cuenta a Juan.
   No cambia nada afuera: solo ordena la hoja ALMA_AREAS. Lo que tú moviste a mano («manual») no lo toca. */

function archivoRonda_(a, adm, origen, pedido) {
  var t0 = Date.now(), r = { nuevas: 0, revisadas: 0, a_ocio: 0, tipos: 0, ideas: [] };
  var antes = areasFilas_();
  /* 1 · lo nuevo (areas_ clasifica lo pendiente de una vez) */
  try { areas_({ email: adm.email }); } catch (e) { console.error('archivo areas_: ' + e); }
  var filas = areasFilas_();
  r.nuevas = Object.keys(filas).filter(function (k) { return !antes[k]; }).length;
  /* 2 · lo que quedó sin clasificar, con más contexto */
  var sesiones = []; try { sesiones = areasSesiones_(adm); } catch (e) {}
  var porClave = {}; sesiones.forEach(function (c, i) { c.i = i; porClave[c.clave] = c; });
  var sinLugar = Object.keys(filas).filter(function (k) { var f = filas[k]; return f.como !== 'manual' && !areasLugar_(f); }).slice(0, 10);
  if (sinLugar.length) {
    var vecino = function (i) { var c = sesiones[i], f = c && filas[c.clave]; return c ? (f && f.titulo ? f.titulo : '(sin título)') + ' — ' + c.texto.slice(0, 120) : ''; };
    var lista = sinLugar.map(function (k, i) {
      var f = filas[k], c = porClave[k];
      return '### ' + (i + 1) + ' · ' + (f.fuente || '') + ' · ' + String(f.ts || '').slice(0, 10) + '\n' +
        (c ? c.muestra : (f.titulo || '') + ' — ' + (f.texto || '')) +
        (c ? '\n(Lo que se habló justo antes: ' + (vecino(c.i + 1) || 'nada') + ' · justo después: ' + (vecino(c.i - 1) || 'nada') + ')' : '');
    }).join('\n\n');
    var sys = 'Eres el departamento de Archivo de Juan (fundador de Spacio AM, apartamentos de estadía corta en Guatemala). Estas conversaciones quedaron SIN CLASIFICAR. ' +
      'Míralas con calma y con el contexto de lo que se habló antes y después, y dale a cada una su lugar: un área de vida (proposito, relaciones, finanzas, health, comunidad, espiritualidad) ' +
      'o un cajón (ideas, interes, ocio). ' + AREAS_ARCHIVO_REGLAS_.replace(/Si de verdad no se entiende[^.]*\.\s*/, '') +
      'Aquí no se vale dejarla vacía: si de verdad no se entiende, va a c = "ocio". Dale también un título de 2 a 5 palabras. ' +
      'Responde SOLO un JSON: {"1":{"a":"","c":"ideas","tipo":"permanente","t":"App de reservas para vecinos"},…}.';
    var txt = ''; try { txt = claude_(CFG.MODELO_REDACTOR, 900, sys, lista, 0, []); } catch (e) { console.error('archivo revisar: ' + e); }
    var j = {}; try { j = JSON.parse(String(txt || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
    sinLugar.forEach(function (k, i) {
      var o = j[String(i + 1)]; if (!o) return;
      var ar = String(o.a || '').toLowerCase(), cj = String(o.c || '').toLowerCase(), tp = String(o.tipo || '').toLowerCase();
      if (!areaOk_(ar) && !cajonOk_(cj)) cj = 'ocio';
      areasGuardar_(filas, { clave: k, area: areaOk_(ar) ? ar : '', cajon: cajonOk_(cj) ? cj : '', tipo: tipoOk_(tp) ? tp : '', como: 'archivo',
        titulo: String(o.t || '').replace(/["«»]/g, '').slice(0, 80) });
      r.revisadas++; if (cj === 'ocio') r.a_ocio++;
    });
  }
  /* 3 · el tipo de lo que no lo tiene (lo clasificado antes de que existiera) */
  var sinTipo = Object.keys(filas).filter(function (k) { return !tipoOk_(filas[k].tipo) && areasLugar_(filas[k]); }).slice(0, 25);
  if (sinTipo.length) {
    var sysT = 'Para cada tema de Juan, di si es "proceso" (algo que se está resolviendo y termina: una gestión, una coordinación, un pendiente) ' +
      'o "permanente" (está para quedarse: una decisión, un dato, una idea, una referencia, algo que vale guardar). Responde SOLO un JSON: {"1":"proceso","2":"permanente",…}.';
    var lt = sinTipo.map(function (k, i) { var f = filas[k]; return (i + 1) + '. ' + (f.titulo || '') + ' — ' + String(f.texto || '').slice(0, 160); }).join('\n');
    var tt = ''; try { tt = claude_(CFG.MODELO_CLASIFICADOR, 400, sysT, lt, 0, []); } catch (e) { console.error('archivo tipos: ' + e); }
    var jt = {}; try { jt = JSON.parse(String(tt || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
    sinTipo.forEach(function (k, i) { var tp = String(jt[String(i + 1)] || '').toLowerCase(); if (tipoOk_(tp)) { areasGuardar_(filas, { clave: k, tipo: tp }); r.tipos++; } });
  }
  /* 4 · ideas que Juan todavía no conoce (proyectos en potencia): se avisan una sola vez */
  var P = PropertiesService.getScriptProperties(), avisadas = []; try { avisadas = JSON.parse(P.getProperty('ARCHIVO_IDEAS_AVISADAS') || '[]'); } catch (e) {}
  var nuevasIdeas = Object.keys(filas).filter(function (k) { return filas[k].cajon === 'ideas' && avisadas.indexOf(k) < 0; });
  r.ideas = nuevasIdeas.map(function (k) { return filas[k].titulo || 'Idea'; });
  if (nuevasIdeas.length) P.setProperty('ARCHIVO_IDEAS_AVISADAS', JSON.stringify(avisadas.concat(nuevasIdeas).slice(-300)));
  var informe = r.nuevas + ' cosa(s) nueva(s) clasificada(s) · ' + r.revisadas + ' sin clasificar revisada(s)' + (r.a_ocio ? ' (' + r.a_ocio + ' a Ocio)' : '') +
    ' · ' + r.tipos + ' con tipo.' + (r.ideas.length ? '\nIdeas nuevas (proyectos en potencia): ' + r.ideas.join(' · ') + '.' : '') +
    (pedido ? '\nPedido: ' + pedido : '');
  a.ultima = new Date().toISOString(); agGuardar_(hojaAg_(), AG_CAB_, a);
  agGuardar_(hojaAgT_(), AGT_CAB_, { id: 'agt' + Date.now(), agente: a.id, creado: new Date(t0).toISOString(), origen: origen, pedido: pedido || '', estado: 'hecha',
    informe: informe, propuestas: 0, costo_usd: 0, terminado: a.ultima });
  if (r.ideas.length) {
    try { opGuardar_(adm, 'alma', 'hub', 'Archivo encontró ' + (r.ideas.length === 1 ? 'una idea nueva' : r.ideas.length + ' ideas nuevas') + ' y las guardó en el cajón Ideas (proyectos en potencia): ' + r.ideas.join(' · ') + '. Cuando quieras convertir una en proyecto, dime.',
      [{ tipo: 'agente', resumen: 'Archivo · ideas' }]); } catch (e) {}
  }
  return { ok: true, agente: a.nombre, informe: informe, propuestas: [], costo_usd: 0 };
}
