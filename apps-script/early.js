/* ═══ EARLY CHECK-IN · REVISIÓN DE LAS 21:00 ═══════════════════════════════════════════════════════════════
   Cuando no hay salida el mismo día, ALMA ofrece tres opciones: early check-in (sujeto a confirmación a las 21:00 del
   día previo), guardar maletas o noche adicional. Si el huésped elige el early check-in, queda registrado aquí (lo
   detecta el [[SEGUIMIENTO: …]] del redactor). La noche anterior, desde las 21:15 hora de Guatemala, ALMA revisa la
   ocupación con disponibilidad_():
     · libre (sin salida el mismo día ni noche anterior ocupada) → le escribe la buena noticia;
     · ocupado → le avisa con calidez que no será posible y le ofrece guardar maletas desde las 12:00.
   Hoja ALMA_EARLY. Propiedad EARLY_AUTO = 0 apaga los envíos (solo registra). */
var EARLY_CAB_ = ['id', 'creado', 'res_id', 'codigo', 'huesped', 'propiedad', 'checkin', 'idioma', 'canal', 'wa', 'estado', 'resultado', 'enviado'];
function hojaEarly_() { return hojaCrear_('ALMA_EARLY', EARLY_CAB_); }

/* Desde avisarSeguimiento_: ¿lo que eligió el huésped es el early check-in? */
function earlyRegistrar_(c) {
  if (!c || !c.seguimiento || !c.resId || !c.checkin) return;
  if (!/early|temprano|antes de (las )?(3|15)|21:00|9 ?p\.? ?m/i.test(c.seguimiento)) return;
  if (/maleta|equipaje|luggage|bags?/i.test(c.seguimiento) && !/early|ingres|entrar/i.test(c.seguimiento)) return;
  var sh = hojaEarly_(), n = sh.getLastRow();
  if (n >= 2 && sh.getRange(2, 3, n - 1, 9).getValues().some(function (v) { return String(v[0]) === String(c.resId) && String(v[7]) === 'pendiente'; })) return;
  sh.appendRow(['ec' + Date.now(), new Date().toISOString(), c.resId, c.codigo || '', c.huesped || '', c.propiedad || '', fecha_(c.checkin), c.idioma || '', c.canal || 'hospitable', c.wa || '', 'pendiente', '', '']);
}

/* procesarCola: la noche anterior a la llegada, desde las 21:15 (hora de Guatemala). */
function earlyRevisar_() {
  var ahora = new Date(), hm = Utilities.formatDate(ahora, CFG.TZ, 'HH:mm');
  if (hm < '21:15') return;
  var c = CacheService.getScriptCache(); if (c.get('early_rev')) return; c.put('early_rev', '1', 300);
  var sh = hojaEarly_(), n = sh.getLastRow(); if (n < 2) return;
  var hoy = Utilities.formatDate(ahora, CFG.TZ, 'yyyy-MM-dd'), manana = sumarDias_(hoy, 1), auto = PropertiesService.getScriptProperties().getProperty('EARLY_AUTO') !== '0';
  var v = sh.getRange(2, 1, n - 1, EARLY_CAB_.length).getValues(), col = function (k) { return EARLY_CAB_.indexOf(k); };
  v.forEach(function (r, i) {
    if (r[col('estado')] !== 'pendiente') return;
    var ci = fecha_(r[col('checkin')]);
    if (ci < manana) { sh.getRange(i + 2, col('estado') + 1, 1, 2).setValues([['vencido', 'la revisión no corrió a tiempo']]); return; }
    if (ci !== manana) return;
    var d = null; try { d = disponibilidad_(String(r[col('propiedad')]), ci, '', String(r[col('codigo')])); } catch (e) {}
    if (!d) { sh.getRange(i + 2, col('estado') + 1, 1, 2).setValues([['sin_datos', 'no se pudo leer la ocupación: lo confirma el equipo']]); try { notificar_(CFG.WHATSAPP_JUAN, 'ALMA · early check-in sin datos', 'No pude revisar la ocupación de ' + r[col('propiedad')] + ' para el early check-in de ' + r[col('huesped')] + ' (' + r[col('codigo')] + '). Confírmalo tú, por favor.'); } catch (e) {} return; }
    var libre = !d.salidaMismoDia && !d.nocheAnteriorOcupada, en = String(r[col('idioma')]) === 'en';
    var nom = String(r[col('huesped')] || '').trim().split(/\s+/)[0];
    var texto = libre
      ? (en ? 'Hi' + (nom ? ' ' + nom : '') + '! Good news: we checked and you can arrive before check-in tomorrow. Your space will be ready for you early.\n\nJust message us here when you are on your way and we will coordinate your arrival.'
            : '¡Hola' + (nom ? ' ' + nom : '') + '! Qué buena noticia: revisamos y mañana sí puedes llegar antes del check-in. Tu espacio estará listo para recibirte temprano.\n\nEscríbenos por aquí cuando vengas en camino y coordinamos tu ingreso.')
      : (en ? 'Hi' + (nom ? ' ' + nom : '') + ', we checked availability for tomorrow and this time an early arrival won\'t be possible. We are happy to store your luggage from 12:00 so you can explore the area without carrying anything, and your space will be ready at 15:00.\n\nLet us know here when you are arriving and the team will welcome you.'
            : 'Hola' + (nom ? ' ' + nom : '') + ', revisamos la disponibilidad para mañana y esta vez no será posible el ingreso antes de las 15:00. Con gusto guardamos tus maletas desde las 12:00 para que recorras la zona sin cargar nada, y tu espacio estará listo a las 15:00.\n\nAvísanos por aquí cuando estés llegando y el equipo te recibe.');
    if (!auto) { sh.getRange(i + 2, col('estado') + 1, 1, 2).setValues([[libre ? 'libre_sin_enviar' : 'ocupado_sin_enviar', 'EARLY_AUTO=0']]); return; }
    var res = { ok: false };
    try {
      res = String(r[col('canal')]) === 'whatsapp' ? hubResponderWa_(String(r[col('res_id')]), texto, 'ALMA · early check-in', String(r[col('wa')] || ''))
                                                  : hubResponder_(String(r[col('res_id')]), texto, 'ALMA · early check-in', 'plataforma');
    } catch (e) { res = { ok: false, error: String(e) }; }
    sh.getRange(i + 2, col('estado') + 1, 1, 3).setValues([[res && res.ok ? (libre ? 'confirmado' : 'no_disponible') : 'error', res && res.ok ? (libre ? 'buena noticia enviada' : 'alternativa de maletas enviada') : String((res && res.error) || 'no salió').slice(0, 200), new Date().toISOString()]]);
    if (!(res && res.ok)) { try { notificar_(CFG.WHATSAPP_JUAN, 'ALMA · early check-in no enviado', 'No pude avisarle a ' + r[col('huesped')] + ' (' + r[col('codigo')] + ') el resultado del early check-in (' + (libre ? 'sí se puede' : 'no se puede') + '). Escríbele desde el Hub.'); } catch (e) {} }
  });
}

/* Robot: reemplaza el texto de una mejora aprobada (y su línea en el prompt) buscándola por un fragmento. */
function mejoraReemplazar_(buscar, nuevo) {
  var b = normL_(buscar); if (!b || !String(nuevo || '').trim()) return { ok: false, error: 'faltan buscar / nuevo' };
  var hechas = [];
  mejorasFilas_().filter(function (m) { return m.estado === 'activa' && m.tipo === 'prompt' && m.cambiosL.some(function (c) { return normL_(c.despues).indexOf(b) >= 0; }); }).forEach(function (m) {
    var cambios = m.cambiosL.map(function (c) { return normL_(c.despues).indexOf(b) >= 0 ? String(nuevo).trim() : s_(c.despues); });
    var r = hubMejoraEditar_(m.id, cambios, m.resumen); hechas.push({ id: m.id, ok: r.ok, error: r.error || '' });
  });
  return { ok: true, editadas: hechas };
}
