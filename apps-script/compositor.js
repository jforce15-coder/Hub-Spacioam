/* ═══ EL NUEVO CHAT DE ALMA · lo del servidor (issue #304) ════════════════════════════════════════════════════════
   El compositor (js/sa-compositor.js) usa dos acciones:
     · dictar      → el micrófono del cuadro: llega el audio en base64 y vuelve el texto (transcribir_), para que la
                     persona lo revise en el cuadro antes de enviarlo. Nunca se envía solo.
     · plantillas  → las plantillas PERSONALES del «+»: cada quien ve y borra solo las suyas (su correo de sesión).
                     Hoja ALMA_PLANTILLAS: id · email · nombre · texto · creada. Tocar una la pone en el cuadro (no la envía). */

var COMP_PLANT_CAB_ = ['id', 'email', 'nombre', 'texto', 'creada'];

function compDictar_(ses, b) {
  if (!b.audio || String(b.audio).length > 12000000) return { ok: false, error: 'La grabación está vacía o es muy larga.' };
  var mime = String(b.mime || 'audio/mp4').split(';')[0];
  if (!/^audio\/(mp4|webm|ogg|mpeg|wav|x-m4a|aac)$/.test(mime)) mime = 'audio/mp4';
  var t = '';
  try { t = transcribir_(Utilities.newBlob(Utilities.base64Decode(String(b.audio)), mime, 'dictado')); } catch (e) { console.error('compDictar_: ' + e); }
  t = String(t || '').trim();
  return t ? { ok: true, texto: t } : { ok: false, error: 'No te entendí. ¿Lo dices otra vez o lo escribes?' };
}

function compPlantHoja_() {
  var ss = ssAlma_(), sh = ss.getSheetByName('ALMA_PLANTILLAS');
  if (!sh) { sh = ss.insertSheet('ALMA_PLANTILLAS'); sh.getRange(1, 1, 1, COMP_PLANT_CAB_.length).setValues([COMP_PLANT_CAB_]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function compPlantLeer_(sh) {
  return sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, COMP_PLANT_CAB_.length).getValues();
}

function compPlantillas_(ses, b) {
  var email = String((ses && ses.email) || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Entra con tu cuenta de Spacio AM para usar tus plantillas.' };
  var sh = compPlantHoja_(), que = String(b.que || 'listar');
  if (que === 'guardar') {
    var texto = String(b.texto || '').trim().slice(0, 4000);
    if (!texto) return { ok: false, error: 'Escribe el texto primero.' };
    var nombre = String(b.nombre || '').trim().slice(0, 60) || texto.replace(/\s+/g, ' ').slice(0, 40) + (texto.length > 40 ? '…' : '');
    var mias = compPlantLeer_(sh).filter(function (r) { return String(r[1]).toLowerCase() === email; });
    if (mias.length >= 60) return { ok: false, error: 'Ya tienes 60 plantillas: borra alguna para guardar otra.' };
    if (mias.some(function (r) { return String(r[3]).trim() === texto; })) return compPlantLista_(sh, email, 'Esa plantilla ya estaba guardada.');
    sh.appendRow(['p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), email, nombre, texto, new Date()]);
    return compPlantLista_(sh, email, 'Guardada.');
  }
  if (que === 'borrar') {
    var id = String(b.id || ''), v = compPlantLeer_(sh);
    for (var i = v.length - 1; i >= 0; i--) {
      if (String(v[i][0]) === id && String(v[i][1]).toLowerCase() === email) { sh.deleteRow(i + 2); break; }   // solo las tuyas
    }
    return compPlantLista_(sh, email, 'Borrada.');
  }
  return compPlantLista_(sh, email, '');
}
function compPlantLista_(sh, email, nota) {
  var lista = compPlantLeer_(sh).filter(function (r) { return String(r[1]).toLowerCase() === email; })
    .map(function (r) { return { id: String(r[0]), nombre: String(r[2]), texto: String(r[3]) }; }).reverse();
  return { ok: true, plantillas: lista, nota: nota };
}
