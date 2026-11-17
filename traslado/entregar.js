/* ═══ TRASLADO · entregar las Propiedades del script al Mudador (spec docs/specs/traslado-workspace.md) ═══
   Este archivo es IGUAL en cada app que se muda (se copia como apps-script/traslado.js; el original vive en
   Hub-Spacioam/traslado/entregar.js y el check .github/traslado.js lo prueba con dobles). Corre en el proyecto VIEJO
   (cuenta Gmail de Juan) y solo hace una cosa: cuando el Mudador lo pide, le entrega las Propiedades del script.
   Quién puede pedirlas: solo la cuenta TRASLADO_DESTINO_, probada con un token de identidad de Google (OpenID) que
   Google mismo revisa (tokeninfo): correo verificado, emisor Google y sin vencer. La primera vez queda fijada la app
   que lo pidió (aud, el Mudador): otra app de esa cuenta ya no puede. Máximo TRASLADO_MAX_DIA_ entregas al día.
   Nunca escribe un valor en el registro: solo cuántas y cuándo.
   En doPost, antes de revisar el token de la app:   var __mud = trasladoEntregar_(p); if (__mud) return __mud; */

var TRASLADO_DESTINO_ = 'alma@spacioam.com';
var TRASLADO_MAX_DIA_ = 6;
var TRASLADO_PROPIAS_ = ['TRASLADO_AUD', 'TRASLADO_DIA'];   // las de este archivo no se entregan

function trasladoEntregar_(p) {
  if (!p || p.traslado !== 'entregar') return null;
  var r;
  try { r = trasladoEntregarDatos_(String(p.id_token || '')); } catch (e) { r = { ok: false, error: 'interno' }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function trasladoEntregarDatos_(idToken) {
  var sp = PropertiesService.getScriptProperties();
  var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  var dia = {};
  try { dia = JSON.parse(sp.getProperty('TRASLADO_DIA') || '{}'); } catch (e) {}
  if (dia.d !== hoy) dia = { d: hoy, n: 0 };
  if (dia.n >= TRASLADO_MAX_DIA_) return { ok: false, error: 'tope_del_dia' };
  dia.n++;
  sp.setProperty('TRASLADO_DIA', JSON.stringify(dia));   // cuenta también los intentos fallidos

  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken)) return { ok: false, error: 'identidad' };
  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var o = { muteHttpExceptions: true };
  // Las apps con cupo.js cuentan la llamada; el login no lo tiene.
  var res = typeof uf_ === 'function' ? uf_(url, o, 'traslado') : UrlFetchApp['fetch'](url, o);
  if (res.getResponseCode() !== 200) return { ok: false, error: 'identidad' };
  var t = {};
  try { t = JSON.parse(res.getContentText()); } catch (e) { return { ok: false, error: 'identidad' }; }
  var emisorOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  var correoOk = String(t.email || '').toLowerCase() === TRASLADO_DESTINO_ && String(t.email_verified) === 'true';
  var vigente = Number(t.exp) * 1000 > Date.now();
  if (!emisorOk || !correoOk || !vigente || !t.aud) return { ok: false, error: 'identidad' };
  var aud = sp.getProperty('TRASLADO_AUD');
  if (aud && aud !== String(t.aud)) return { ok: false, error: 'otra_app' };
  if (!aud) sp.setProperty('TRASLADO_AUD', String(t.aud));

  var todas = sp.getProperties(), salida = {};
  Object.keys(todas).forEach(function (k) { if (TRASLADO_PROPIAS_.indexOf(k) < 0) salida[k] = todas[k]; });
  console.log('Traslado: entregadas ' + Object.keys(salida).length + ' propiedades a ' + TRASLADO_DESTINO_);
  return { ok: true, propiedades: salida };
}
