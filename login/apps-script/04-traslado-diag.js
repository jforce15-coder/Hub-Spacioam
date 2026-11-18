/* ═══ TRASLADO · prueba de humo del login (docs/specs/traslado-workspace.md) ═══
   Para comparar el login viejo con el de alma@ sin ver ninguna llave: el robot pide { action: "diagTraslado", robot }
   y recibe huellas (los primeros 12 caracteres de un SHA-256 con prefijo fijo) de SESSION_SECRET y AUTH_TOKEN, cuántas
   Propiedades hay (y cuántas llaves de Face ID), si abre las hojas que usa y cuántos correos le quedan hoy.
   Misma huella de SESSION_SECRET = una sesión firmada por un login pasa en el otro. Solo lee: no crea SESSION_SECRET
   si falta (responde huella vacía). */
function _huellaTraslado(v){
  if(!v) return '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'sa-traslado-huella|'+v, Utilities.Charset.UTF_8)
    .map(function(b){ return ('0'+(b&0xff).toString(16)).slice(-2); }).join('').slice(0,12);
}
function _diagTraslado(token){
  if(!_diagLector(token).ok) return {ok:false, error:'token'};
  var sp=PropertiesService.getScriptProperties(), todas=sp.getProperties(), n=0, face=0, abre={}, cuenta='', correos=null, proyecto='';
  Object.keys(todas).forEach(function(k){ n++; if(k.indexOf('face_')===0) face++; });
  try{ abre.control=!!SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheetByName(SHEET_TAB); }catch(e){ abre.control=false; }
  try{ abre.mi_setup=!!SpreadsheetApp.openById(MI_SETUP_ID).getSheetByName('SETUP'); }catch(e){ abre.mi_setup=false; }
  try{ cuenta=Session.getEffectiveUser().getEmail(); }catch(e){}
  try{ correos=MailApp.getRemainingDailyQuota(); }catch(e){}
  try{ proyecto=ScriptApp.getScriptId(); }catch(e){}
  return {ok:true, proyecto:proyecto, cuenta:cuenta, propiedades:n, face:face, abre:abre, correos_hoy:correos,
    huellas:{ SESSION_SECRET:_huellaTraslado(todas.SESSION_SECRET), AUTH_TOKEN:_huellaTraslado(todas.AUTH_TOKEN), GOOGLE_CLIENT_IDS:_huellaTraslado(todas.GOOGLE_CLIENT_IDS) }};
}
