/* ═══ DATOS DE HECHO: Alma los anota sola y le avisa a Juan después (Juan, 3-nov-2026) ═══════════════════════════
   «Alma tiene que poder recopilar información y actualizar sin mi permiso (por ejemplo el número de apartamento).»
   Un dato de hecho es algo que la persona dice o que sale de una fuente confiable, sin decidir nada:
     · Grow, proyecto: apto, edificio, zona.   · Grow, dueño: nombre, teléfono, correo.
     · ALMA_CONTACTOS: nombre, rol, empresa, apartamentos (propiedades).
   Se anota sin preguntar y se avisa en una línea: «Anoté en Grow: Amalfi · apto 1203 (lo dijo Inés)». Si había otro
   valor, se cambia y el aviso dice «antes decía X». Si el valor suena dudoso («creo que…», un correo sin @), no se
   anota: se le pregunta a Juan. Dinero, etapa, contratos, accesos, borrar y mensajes a terceros siguen pidiendo su sí:
   no están en la lista y el código los rechaza aunque el modelo lo intente.
   Historial: hoja ALMA_DATOS_HECHO (quién, cuándo, antes, ahora, fuente). 31_ESTADO_PROYECTO de Grow guarda solo la
   versión vigente del proyecto, no el valor de antes, así que no sirve de historial. */

var DATO_HECHO_CAB_ = ['fecha', 'quien', 'donde', 'id', 'registro', 'campo', 'antes', 'ahora', 'fuente'];
var DATO_HECHO_CAMPOS_ = { grow_proyecto: ['apto', 'edificio', 'zona'], grow_dueno: ['nombre', 'telefono', 'email'], contacto: ['nombre', 'rol', 'empresa', 'propiedades'] };
var DATO_HECHO_PALABRA_ = { apto: 'apto', edificio: 'edificio', zona: 'zona', nombre: 'nombre', telefono: 'teléfono', email: 'correo', rol: 'rol', empresa: 'empresa', propiedades: 'apartamentos' };

/* Administrador de verdad (Control de usuarios): adminPorEmail_ también devuelve una ficha para cualquier correo. */
function esAdminOp_(adm) {
  var e = String((adm && adm.email) || '').trim().toLowerCase();
  return !!e && adminsOp_().some(function (a) { return a.email === e; });
}

/* '' si el valor se ve bien; si no, por qué suena dudoso. */
function datoHechoDudoso_(campo, valor) {
  var v = String(valor == null ? '' : valor).trim();
  if (!v) return 'viene vacío';
  if (/\?|\b(creo|tal vez|quiz[aá]s?|no s[eé]|probablemente|parece|maybe)\b/i.test(v)) return 'no suena seguro';
  if (v.length > 80) return 'es demasiado largo';
  if (campo === 'email' && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return 'no parece un correo';
  if (campo === 'telefono' && !/^\+?[\d\s().-]{8,20}$/.test(v)) return 'no parece un teléfono';
  if (campo === 'apto' && !/^[\w#.\- ]{1,12}$/.test(v)) return 'no parece un número de apartamento';
  return '';
}

/* Anota un dato de hecho. o = { donde, id, campo, valor, fuente, solo_si_vacio }. adm = quien lo pidió (o el
   administrador del encargo, cuando sale de una respuesta). Devuelve { ok, aviso, antes, ahora } o { ok:false, error }. */
function datoHechoAnotar_(adm, o) {
  o = o || {};
  if (!esAdminOp_(adm)) return { ok: false, error: 'Solo un administrador puede cambiar datos de Grow o de los contactos.' };
  var donde = String(o.donde || ''), campo = String(o.campo || ''), valor = String(o.valor == null ? '' : o.valor).trim(), id = String(o.id || '').trim();
  var lista = DATO_HECHO_CAMPOS_[donde];
  if (!lista || lista.indexOf(campo) < 0) return { ok: false, permiso: true, error: '«' + campo + '» no es un dato de hecho (dinero, etapa, contrato, accesos o borrar): necesita el sí de Juan. Pregúntale en una frase.' };
  var duda = datoHechoDudoso_(campo, valor);
  if (duda) return { ok: false, dudoso: true, error: 'No lo anoté: «' + valor + '» ' + duda + '. Pregúntale a Juan antes.' };
  if (!id) return { ok: false, error: 'Falta el id (p… o D… de grow_proyectos, o el número del contacto).' };
  var fuente = String(o.fuente || '').trim().slice(0, 120) || 'sin fuente', r;
  if (donde === 'contacto') {
    var f = contactoFicha_(id); if (!f) return { ok: false, error: 'No encontré ese contacto. Búscalo con buscar_contacto y usa su número.' };
    var antesC = String(f[campo] || '').trim();
    if (antesC.toLowerCase() === valor.toLowerCase()) r = { ok: true, sin_cambio: true, registro: f.nombre || '+' + f.tel, antes: antesC, ahora: antesC };
    else { var cambio = {}; cambio[campo] = valor; contactoGuardar_(id, cambio); r = { ok: true, registro: f.nombre || '+' + f.tel, antes: antesC, ahora: valor }; }
  } else {
    r = growApi_('dato', { tipo: donde === 'grow_dueno' ? 'dueno' : 'proyecto', id: id, campo: campo, valor: valor, fuente: fuente, por: (adm && adm.nombre) || '', solo_si_vacio: !!o.solo_si_vacio });
    if (!r || !r.ok) return r || { ok: false, error: 'Grow no respondió.' };
  }
  if (r.sin_cambio) return { ok: true, sin_cambio: true, antes: r.antes, nota: 'Ya decía eso (o ya tenía un valor y solo se llenaba si estaba vacío): no cambié nada.' };
  try { hojaCrear_('ALMA_DATOS_HECHO', DATO_HECHO_CAB_).appendRow([new Date().toISOString(), (adm && adm.nombre) || 'Alma', donde, id, r.registro || '', campo, celdaTexto_(r.antes || ''), celdaTexto_(r.ahora), celdaTexto_(fuente)]); } catch (e) { console.error('ALMA_DATOS_HECHO: ' + e); }
  var aviso = 'Anoté en ' + (donde === 'contacto' ? 'contactos' : 'Grow') + ': ' + (r.registro || id) + ' · ' + DATO_HECHO_PALABRA_[campo] + ' ' + r.ahora + ' (' + fuente + (r.antes ? '; antes decía ' + r.antes : '') + ')';
  return { ok: true, antes: r.antes || '', ahora: r.ahora, aviso: aviso };
}

/* ── Respuestas de un socio o contacto (encargoEntrante_, personalEntrante_) ──
   Si la persona es dueña de un proyecto de Grow y en su mensaje da un dato de hecho («es el 1203»), se anota solo y
   vuelven las líneas de aviso para el administrador del encargo. Su teléfono de WhatsApp llena el del dueño solo si
   estaba vacío. Nunca frena la respuesta: cualquier error se queda en el registro. */
function datosHechoDeRespuesta_(wa, quien, texto, adm) {
  var avisos = [];
  try {
    /* Nombre y apellido: con un solo nombre («Lucky») el parecido con un dueño de Grow sería adivinar. */
    if (!esAdminOp_(adm) || String(quien || '').trim().split(/\s+/).length < 2 || /^\+?\d/.test(String(quien))) return avisos;
    var ficha = contactoFicha_(wa); if (ficha && ficha.tipo === 'familia') return avisos;
    var proy = datoHechoProyectoDe_(wa, quien); if (!proy) return avisos;
    var primer = String(quien).split(' ')[0], fuente = 'lo dijo ' + primer;
    if (proy.varios) {
      if (datoHechoPareceDato_(texto)) avisos.push(primer + ' dio datos, pero tiene ' + proy.varios + ' proyectos en Grow y no sé en cuál anotarlos. ¿En cuál?');
      return avisos;
    }
    var c = CacheService.getScriptCache(), kt = 'dh_tel_' + fin8_(wa);
    if (!c.get(kt)) {
      var tel = datoHechoAnotar_(adm, { donde: 'grow_dueno', id: proy.id, campo: 'telefono', valor: '+' + normTel_(wa), fuente: 'su WhatsApp', solo_si_vacio: true });
      if (tel.ok) { c.put(kt, '1', 21600); if (tel.aviso) avisos.push(tel.aviso); }
    }
    if (!datoHechoPareceDato_(texto)) return avisos;
    datoHechoExtraer_(texto, proy).forEach(function (d) {
      var donde = DATO_HECHO_CAMPOS_.grow_proyecto.indexOf(d.campo) >= 0 ? 'grow_proyecto' : 'grow_dueno';
      if (d.dudoso || datoHechoDudoso_(d.campo, d.valor)) { avisos.push(primer + ' dijo «' + d.valor + '» como ' + DATO_HECHO_PALABRA_[d.campo] + ' de ' + proy.nombre + ', pero no suena seguro. ¿Lo anoto?'); return; }
      var r = datoHechoAnotar_(adm, { donde: donde, id: proy.id, campo: d.campo, valor: d.valor, fuente: fuente });
      if (r.ok && r.aviso) avisos.push(r.aviso);
      else if (!r.ok) console.error('dato de hecho ' + d.campo + ': ' + r.error);
    });
  } catch (e) { console.error('datosHechoDeRespuesta_: ' + e); }
  return avisos;
}

/* Algo con forma de dato: un número, un correo o las palabras de un apartamento. Evita gastar el modelo en «gracias». */
function datoHechoPareceDato_(texto) {
  return /\d|@|\b(apto|apartamento|edificio|torre|zona|nivel|correo|me llamo|mi nombre|se escribe)\b/i.test(String(texto || ''));
}

/* El proyecto de Grow del que esta persona es dueña (por su nombre). { id, nombre } · { varios: n } · null. 6 h en caché. */
function datoHechoProyectoDe_(wa, quien) {
  var c = CacheService.getScriptCache(), k = 'dh_proy_' + fin8_(wa), hit = c.get(k);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var g = growApi_('resumen', { q: quien }); if (!g || !g.ok) return null;
  var suyos = (g.proyectos || []).filter(function (p) { return p.dueno && bqPuntaje_(quien, p.dueno).todas; });
  var out = !suyos.length ? null : suyos.length > 1 ? { varios: suyos.length } : { id: suyos[0].id, nombre: suyos[0].nombre, apto: suyos[0].apto, edificio: suyos[0].edificio, zona: suyos[0].zona };
  try { c.put(k, JSON.stringify(out), 21600); } catch (e) {}
  return out;
}

/* El modelo de siempre (clasificador) saca solo los campos permitidos; el código vuelve a filtrar. */
function datoHechoExtraer_(texto, proy) {
  var sys = 'Sacas datos de hecho del mensaje de un dueño de apartamento sobre SU proyecto. Responde SOLO JSON: {"datos":[{"campo":"apto|edificio|zona|nombre|email","valor":"…","dudoso":true|false}]}. ' +
    'Solo lo que la persona afirma en este mensaje (apto = número o nombre de su apartamento; nombre = su nombre completo o cómo se escribe). dudoso = true si duda («creo», «tal vez»). Nada de precios, fechas ni opiniones. Si no hay, {"datos":[]}.';
  var usr = 'PROYECTO: ' + proy.nombre + ' (apto ' + (proy.apto || 'sin dato') + ', edificio ' + (proy.edificio || 'sin dato') + ', zona ' + (proy.zona || 'sin dato') + ')\nMENSAJE: ' + String(texto).slice(0, 1500);
  var j = {}; try { var raw = String(claude_(CFG.MODELO_CLASIFICADOR, 300, sys, usr, 0) || ''); j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { return []; }
  var ok = DATO_HECHO_CAMPOS_.grow_proyecto.concat(DATO_HECHO_CAMPOS_.grow_dueno);
  return (Array.isArray(j.datos) ? j.datos : []).filter(function (d) { return d && ok.indexOf(d.campo) >= 0 && String(d.valor || '').trim(); }).slice(0, 4)
    .map(function (d) { return { campo: d.campo, valor: String(d.valor).trim(), dudoso: d.dudoso === true }; });
}
