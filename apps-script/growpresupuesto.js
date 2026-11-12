/* ═══ GROW · PRESUPUESTO EN PDF, TAMBIÉN POR APARTAMENTO (herramienta grow_presupuesto_pdf) ═══════════════════════
   Pedido de Juan (6-nov-2026): el equipamiento de agosto de MONACO, de su hoja «Presupuesto edificio Mónaco Fase 2»,
   como un presupuesto por apartamento (B5, A4, A1, B1, A3, B3) y los PDF para mandarlos a Casa Sol en un correo.
   · Sin aptos ni hoja: el PDF del presupuesto activo del proyecto, como antes.
   · Con aptos: un PDF por cada presupuesto de esos apartamentos (alcance «apto» en Grow).
   · Con hoja y aptos: primero Grow copia la plantilla de esa hoja como un presupuesto por apartamento («Equipamiento B5»…;
     op presupuesto_importar, que no duplica y guarda con la versión), y después saca sus PDF.
   · Con consolidado: además uno con todos (un renglón por apartamento y el total).
   Grow arma un PDF por llamada: cada conversión tarda unos segundos y una llamada a internet corta al minuto. Cada PDF
   le llega a Juan por WhatsApp y vuelve su enlace y su drive_id (sirve para adjuntarlo con responder_correo). El PDF
   nunca entra a la conversación con el modelo: solo su enlace. Solo el administrador principal. */
var GROW_PRES_WA_MAX_ = 10;   // a lo mucho tantos archivos seguidos al WhatsApp de Juan

function growDriveId_(r) { var m = String((r && r.url) || '').match(/\/d\/([\w-]{10,})/); return (r && r.file_id) || (m ? m[1] : ''); }

function growPresupuestoPdf_(adm, inp, ctx) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal saca el presupuesto en PDF.' };
  inp = inp || {};
  var por = (adm && adm.nombre) || '', pid = inp.proyecto_id, aptos = String(inp.aptos || '').trim(), imp = null, hechas = (ctx && ctx.hechas) || [];
  if (inp.hoja) {
    if (!aptos) return { ok: false, error: 'Para copiar la plantilla dime en qué apartamentos (aptos).' };
    imp = growApi_('presupuesto_importar', { proyecto_id: pid, aptos: aptos, hoja: inp.hoja, pestana: inp.pestana || '', nombre: inp.nombre || '', por: por });
    if (!imp || !imp.ok) return imp || { ok: false, error: 'Grow no respondió.' };
    pid = imp.id || pid;
    if ((imp.creados || []).length) hechas.push({ tipo: 'grow', resumen: 'Grow · ' + imp.creados.length + ' presupuestos por apartamento en ' + imp.proyecto + ' · ' + imp.por_apto + ' c/u' });
  }
  /* Qué PDF pedir: los presupuestos recién importados (o que ya estaban), los de cada apartamento o el activo. */
  var pedidos = imp ? (imp.presupuesto_ids || []).map(function (id) { return { presupuesto_ids: id }; })
    : aptos ? aptos.split(/[,;\n]+|\s+y\s+/).map(function (a) { return a.trim(); }).filter(Boolean).map(function (a) { return { aptos: a }; }) : [];
  var pdfs = [], errores = [], proyecto = imp ? imp.proyecto : '';
  if (!pedidos.length) {
    var r1 = growApi_('presupuesto_pdf', { proyecto_id: pid, por: por });
    if (!r1 || !r1.ok) return r1 || { ok: false, error: 'Grow no respondió.' };
    proyecto = r1.proyecto; pid = r1.id || pid;
    pdfs.push({ presupuesto: r1.presupuesto || '', apto: '', total: r1.total, nombre: r1.nombre, url: r1.url, compartido: r1.compartido, drive_id: growDriveId_(r1), b64: r1.pdf_b64, items: r1.items, resumen: r1.resumen, estado: r1.estado });
  } else pedidos.forEach(function (q) {
    var r = growApi_('presupuesto_pdf', Object.assign({ proyecto_id: pid, por: por }, q));
    if (!r || !r.ok) { errores.push((q.aptos || q.presupuesto_ids) + ': ' + ((r && r.error) || 'Grow no respondió')); return; }
    proyecto = r.proyecto; pid = r.id || pid;
    (r.pdfs || []).forEach(function (x) { pdfs.push({ id: x.presupuesto_id, presupuesto: x.presupuesto, apto: x.apto, total: x.total, nombre: x.nombre, url: x.url, compartido: x.compartido, drive_id: growDriveId_(x), b64: x.pdf_b64 }); });
  });
  if (!pdfs.length) return { ok: false, error: 'No salió ningún PDF. ' + errores.join(' · ') };
  var cons = null;
  if (inp.consolidado && pdfs.length > 1) {
    var rc = growApi_('presupuesto_pdf', { proyecto_id: pid, presupuesto_ids: pdfs.map(function (x) { return x.id; }).filter(Boolean), solo_consolidado: true, por: por });
    if (rc && rc.ok && rc.consolidado) cons = { presupuesto: 'Consolidado' + (rc.consolidado.fase ? ' ' + rc.consolidado.fase : ''), total: rc.consolidado.total, nombre: rc.consolidado.nombre,
      url: rc.consolidado.url, compartido: rc.consolidado.compartido, drive_id: growDriveId_(rc.consolidado), b64: rc.consolidado.pdf_b64 };
    else errores.push('consolidado: ' + ((rc && rc.error) || 'Grow no respondió'));
  }
  /* A WhatsApp, uno tras otro; si la ventana de 24 h está cerrada, no se insiste con los demás. */
  var todos = pdfs.concat(cons ? [cons] : []), wa = 'no', enviados = 0;
  if (inp.whatsapp !== false) {
    var tel = ((adm && adm.tels) || [])[0];
    if (!tel) wa = 'No tengo su WhatsApp registrado.';
    else for (var i = 0; i < todos.length && i < GROW_PRES_WA_MAX_; i++) {
      var x = todos[i]; if (!x.b64) continue;
      var w = waEnviarDocumento_(tel, Utilities.newBlob(Utilities.base64Decode(x.b64), 'application/pdf', x.nombre || 'Presupuesto.pdf'),
        'Presupuesto · ' + proyecto + (x.presupuesto ? ' · ' + x.presupuesto : '') + ' · ' + x.total);
      if (w && w.ok) enviados++; else { wa = (w && (w.detalle || w.error)) || 'no salió'; break; }
    }
    if (enviados) wa = enviados === todos.length ? 'enviado' + (enviados > 1 ? 's los ' + enviados : '') : 'enviados ' + enviados + ' de ' + todos.length + (wa !== 'no' ? ' (' + wa + ')' : '');
  }
  if (!todos.some(function (x) { return x.url; }) && !enviados) return { ok: false, error: 'Armé el PDF pero no pude guardarlo en Drive ni mandarlo por WhatsApp: ' + wa };
  /* El enlace que vuelve al modelo ya es corto (hub.spacioam.com/<código>, enlaces.js): así sale igual en el chat, el
     WhatsApp o el correo. El drive_id sigue siendo el del archivo (para adjuntarlo). */
  var corto = function (u) { return u ? acortar_(u, 'grow_presupuesto_pdf') : u; };
  var limpio = function (x) { var o = { presupuesto: x.presupuesto || undefined, apto: x.apto || undefined, total: x.total, url: corto(x.url), drive_id: x.drive_id || undefined }; return o; };
  hechas.push({ tipo: 'grow', resumen: 'Grow · ' + (todos.length > 1 ? todos.length + ' PDF de presupuesto ' : 'presupuesto en PDF ') + proyecto + ' · ' + (cons ? cons.total : todos[0].total) + (enviados ? ' · por WhatsApp' : '') });
  var res = { ok: true, proyecto: proyecto, whatsapp: wa };
  if (!pedidos.length) {   // como antes
    var u = todos[0];
    Object.assign(res, { presupuesto: u.presupuesto || undefined, items: u.items, total: u.total, estado: u.estado, resumen: u.resumen, nombre: u.nombre, url: corto(u.url), drive_id: u.drive_id, compartido: u.compartido });
  } else {
    res.pdfs = pdfs.map(limpio);
    if (cons) res.consolidado = limpio(cons);
  }
  if (imp) res.importados = { creados: (imp.creados || []).map(function (x) { return x.nombre + ' ' + x.total; }), ya_existian: (imp.ya_existian || []).map(function (x) { return x.nombre; }),
    por_apto: imp.por_apto, total_creados: imp.total_creados, plantilla: imp.plantilla, avisos: (imp.avisos || []).length ? imp.avisos : undefined };
  if (errores.length) res.errores = errores;
  if (todos.some(function (x) { return x.url && !x.compartido; })) res.nota = 'Algún enlace es privado (el Drive no deja compartir con enlace): para alguien de afuera reenvía el archivo de WhatsApp o adjúntalo.';
  if (todos.length > 1 || inp.hoja) res.para_correo = 'Para mandarlos en un correo: responder_correo con adjuntos = los drive_id.';
  return res;
}
