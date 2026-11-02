/* ═══ UBER (issue #406, microproyecto «Uber Bozeman llegada») ═══════════════════════════════════════════════
   Mientras llega la integración completa con Uber, Alma deja el viaje listo para que la persona solo confirme:
   arma un enlace de Uber con el origen y el destino ya puestos y las dos direcciones en texto para pegarlas a mano.
   · El enlace es el universal de Uber (https://m.uber.com/ul/…): en WhatsApp sí se puede tocar y, si la app de Uber
     está instalada, la abre con la ruta lista (si no, abre Uber en el navegador). El esquema uber:// no se puede tocar
     en WhatsApp, por eso va solo como «enlace_app» (para la app de iPhone).
   · Origen «mi ubicación» (o vacío) = donde esté el teléfono al abrir Uber.
   · Las direcciones se vuelven coordenadas con el geocodificador de Google que trae Apps Script (Maps, sin llave);
     si no la encuentra, el enlace va solo con el texto y Uber la busca.
   · Si falta el destino (p. ej. el hospedaje no está en el correo ni en el proyecto), NO se inventa: el enlace va
     con solo el origen y la respuesta lo dice claro para que la persona lo escriba en Uber. */

var UBER_MI_UBICACION_ = /^\s*(mi ubicaci[oó]n|aqu[ií]|donde estoy|ubicaci[oó]n actual|my location|current location)?\s*$/i;

/* Dirección → { direccion, lat?, lng? }. Sin coordenadas si Google no la encuentra. */
function uberLugar_(texto) {
  var t = String(texto || '').trim(), out = { direccion: t };
  try {
    var r = Maps.newGeocoder().setLanguage('es').geocode(t), g = r && r.status === 'OK' && r.results && r.results[0];
    if (g && g.geometry && g.geometry.location) {
      out.direccion = g.formatted_address || t; out.lat = g.geometry.location.lat; out.lng = g.geometry.location.lng; out.nombre = t.split(',')[0];
    }
  } catch (e) { console.error('uberLugar_: ' + e); }
  return out;
}

/* Parámetros de un punto (pickup / dropoff) para el enlace. Corchetes codificados para que WhatsApp no corte el enlace. */
function uberParams_(clave, l) {
  var p = [], k = function (c, v) { p.push(encodeURIComponent(clave + '[' + c + ']') + '=' + encodeURIComponent(String(v))); };
  if (l.lat != null) { k('latitude', l.lat); k('longitude', l.lng); }
  k('nickname', l.nombre || String(l.direccion).split(',')[0]); k('formatted_address', l.direccion);
  return p;
}

/* Texto para pegar en Uber: el nombre del lugar delante si la dirección no lo trae. */
function uberTexto_(l) { return l.nombre && String(l.direccion).indexOf(l.nombre) < 0 ? l.nombre + ', ' + l.direccion : l.direccion; }

/* Herramienta preparar_uber: { origen?, destino? } → { ok, origen, destino, enlace, enlace_app, texto_whatsapp, falta_destino? } */
function uberPreparar_(inp) {
  inp = inp || {};
  var aqui = UBER_MI_UBICACION_.test(String(inp.origen || '')), destTxt = String(inp.destino || '').trim();
  if (aqui && !destTxt) return { ok: false, error: 'Necesito al menos el origen o el destino del viaje.' };
  var o = aqui ? null : uberLugar_(inp.origen), d = destTxt ? uberLugar_(destTxt) : null;
  var q = ['action=setPickup'].concat(o ? uberParams_('pickup', o) : ['pickup=my_location']).concat(d ? uberParams_('dropoff', d) : []).join('&');
  var origenTxt = o ? uberTexto_(o) : 'tu ubicación actual';
  var texto = 'Tu Uber listo: toca este enlace y confirma en Uber.\n' + 'https://m.uber.com/ul/?' + q + '\n\n' +
    'Origen: ' + origenTxt + '\n' + (d ? 'Destino: ' + uberTexto_(d) : 'Destino: no lo tengo. Escríbelo en Uber antes de confirmar.');
  var out = { ok: true, origen: origenTxt, destino: d ? uberTexto_(d) : '', enlace: 'https://m.uber.com/ul/?' + q, enlace_app: 'uber://?' + q, texto_whatsapp: texto,
    como_usarlo: 'Manda texto_whatsapp tal cual (enlace y las dos direcciones, para pegarlas si el enlace no abre). Di «Toca este enlace y confirma en Uber».' };
  if (!d) out.falta_destino = 'No tengo la dirección del destino: díselo claro a la persona para que la escriba en Uber.';
  if ((o && o.lat == null) || (d && d.lat == null)) out.aviso = 'No encontré en el mapa alguna de las direcciones; va como texto y Uber la busca. Pide a la persona revisar el punto antes de confirmar.';
  return out;
}

/* Para Alma: arma el viaje y, si enviar = true (llamada o app), lo manda al WhatsApp de quien habla. */
function uberHerramienta_(adm, inp) {
  var r = uberPreparar_(inp); if (!r.ok || !inp.enviar) return r;
  var tel = (adm && adm.tels || [])[0]; if (!tel) return Object.assign(r, { enviado: false, error_envio: 'No tengo tu WhatsApp registrado.' });
  var w = waEnviar_(tel, r.texto_whatsapp);
  return Object.assign(r, { enviado: !!w.ok, error_envio: w.ok ? undefined : (w.error || 'no salió') });
}
