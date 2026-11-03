/* ═══ PLANTILLA PARA SOCIOS ═══════════════════════════════════════════════════════════════════════════════
   A un socio o propietario que no ha escrito en 24 h no se le puede mandar texto libre: hace falta una plantilla.
   Las que había (contacto_alma, WA_PLANTILLA) Meta las trata como marketing, y a los números de EE. UU. (+1) Meta no
   les entrega marketing: el socio nunca recibía el mensaje. La plantilla para socios es de categoría Utilidad (habla de
   su cuenta) y Juan la crea en WhatsApp Manager:
     WA_PLANTILLA_SOCIO          nombre de la plantilla aprobada (sugerido: actualizacion_cuenta_socio)
     WA_PLANTILLA_SOCIO_IDIOMA   código del idioma en español (por defecto es)
     WA_PLANTILLA_SOCIO_IDIOMA_EN  opcional: código en inglés; sin él, siempre va la de español
   Parámetros: {{1}} = primer nombre · {{2}} = la propiedad o el apartamento.
   Quién es socio: el Control de usuarios (es_dueno / es_socio, rol socio o propietario, o solo acceso a Mi), la hoja
   SHEET_PROPIETARIOS_ID, los números sueltos de WA_PROPIETARIOS y las fichas de contacto con tipo socio. Un potencial
   socio no cuenta: todavía no tiene cuenta, y la plantilla habla de su cuenta.
   Solo el administrador principal puede escribirle a un socio desde Alma. */

var SOCIO_PLANTILLA_SUGERIDA_ = 'actualizacion_cuenta_socio';

function socioPlantillaCfg_() {
  var p = PropertiesService.getScriptProperties();
  return { nombre: String(p.getProperty('WA_PLANTILLA_SOCIO') || '').trim(), idES: String(p.getProperty('WA_PLANTILLA_SOCIO_IDIOMA') || 'es').trim(),
    idEN: String(p.getProperty('WA_PLANTILLA_SOCIO_IDIOMA_EN') || '').trim() };
}
function socioPlantillaFalta_() {
  return 'Falta la plantilla para socios: créala en WhatsApp Manager con el nombre ' + SOCIO_PLANTILLA_SUGERIDA_ + ' y ponla en WA_PLANTILLA_SOCIO.';
}

/* El socio de ese número ({ wa, nombre, propiedad }) o null. Un administrador nunca cuenta como socio. */
function socioDe_(wa) {
  var k = fin8_(wa); if (!k) return null;
  try { if (adminPorTel_(wa)) return null; } catch (e) {}
  var fila = null; try { fila = (accesosPorRol_().socios || []).filter(function (s) { return fin8_(s.tel) === k; })[0] || null; } catch (e) {}
  var esProp = !!fila; if (!esProp) { try { esProp = waPropietarios_().some(function (x) { return fin8_(x) === k; }); } catch (e) {} }
  var f = null; try { f = contactoFicha_(wa); } catch (e) {}
  var esFicha = !!f && String(f.tipo || '') === 'socio';
  if (!esProp && !esFicha) return null;
  var prop = String((esFicha && f.propiedades) || (fila && fila.propiedad) || (f && f.propiedades) || '').split(/[,;\n]/)[0].trim();
  return { wa: normTel_(wa), nombre: String((fila && fila.nombre) || (f && f.nombre) || '').trim(), propiedad: prop };
}
function socioSeguro_(wa) { try { return socioDe_(wa); } catch (e) { return null; } }

/* Desde Alma, solo el administrador principal le escribe a un socio. '' si puede; si no, el motivo. */
function socioSoloPrincipal_(adm, tel) {
  if (!socioSeguro_(tel)) return '';
  var ok = false; try { ok = esAdminPrincipal_(adm); } catch (e) {}
  return ok ? '' : 'Solo el administrador principal puede escribirle a un socio. Si hace falta, se lo paso a Juan.';
}

/* Meta no acepta parámetros vacíos, con saltos de línea ni con 4 espacios seguidos. */
function socioParam_(v) { return String(v || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 60); }

/* El mensaje de la plantilla para socios, listo para la API de Meta. { payload, nombre } o { error }. */
function socioPlantillaPayload_(wa, o) {
  o = o || {};
  var cfg = socioPlantillaCfg_(); if (!cfg.nombre) return { error: socioPlantillaFalta_() };
  var propiedad = socioParam_(o.propiedad);
  if (!propiedad) return { error: 'No sé de qué propiedad es ' + (socioParam_(o.nombre) || 'este socio') + ': dime el apartamento para la plantilla para socios.' };
  var idioma = String(o.idioma || '');
  if (!idioma) { try { idioma = idiomaDe_((waHilo_('wa:' + normTel_(wa)).filter(function (m) { return m.tipo === 'guest'; }).pop() || {}).texto || ''); } catch (e) {} }
  var en = idioma.slice(0, 2) === 'en' && !!cfg.idEN;
  var nom = String(o.nombre || '').replace(/\(.*?\)/g, ' ').trim(), primer = /^[+\d]/.test(nom) ? '' : socioParam_(nom.split(/\s+/)[0]);
  return { nombre: cfg.nombre, payload: { messaging_product: 'whatsapp', to: normTel_(wa), type: 'template', template: { name: cfg.nombre, language: { code: en ? cfg.idEN : cfg.idES },
    components: [{ type: 'body', parameters: [{ type: 'text', text: primer || (en ? 'there' : 'qué tal') }, { type: 'text', text: propiedad }] }] } } };
}

/* El error de Meta en palabras claras, con su propio mensaje. A un +1 que no es socio se le explica por qué no llega. */
function waErrorMeta_(code, cuerpo, wa, esSocio) {
  var j = cuerpo; if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { j = { error: { message: String(cuerpo).slice(0, 200) } }; } }
  var e = (j && j.error) || {}, c = Number(e.code) || 0;
  var msg = String(e.error_user_msg || (e.error_data && e.error_data.details) || e.message || ('HTTP ' + code)).slice(0, 240);
  var masUno = /^1\d{10}$/.test(String(normTel_(wa) || ''));
  return 'Meta rechazó la plantilla' + (c ? ' (código ' + c + ')' : '') + ': ' + msg +
    (masUno && !esSocio ? ' · Es un número de EE. UU. o Canadá (+1): ahí Meta no entrega plantillas de marketing. Si es socio, regístralo como socio y uso la plantilla para socios.' : '');
}
