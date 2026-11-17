/* ═══ TRASLADO · entregar las Propiedades del script al Mudador (spec docs/specs/traslado-workspace.md) ═══
   Este archivo es IGUAL en cada app que se muda (se copia como apps-script/traslado.js; el original vive en
   Hub-Spacioam/traslado/entregar.js y el check .github/traslado.js lo prueba con dobles). Corre en el proyecto VIEJO
   (cuenta Gmail de Juan) y solo hace una cosa: cuando el Mudador lo pide, le entrega las Propiedades del script.
   Quién puede pedirlas: solo la cuenta TRASLADO_DESTINO_, probada con un token de identidad de Google (OpenID) que se
   revisa AQUÍ, sin llamar a internet (17-nov-2026: el cupo diario de UrlFetch de la cuenta vieja se agotó y la entrega
   fallaba con «interno»): firma RS256 con las llaves PÚBLICAS de Google (la propiedad GOOGLE_LLAVES si existe, o las de
   TRASLADO_LLAVES_), emisor Google, correo verificado y sin vencer. Llave desconocida o firma mala: no entrega.
   La primera vez queda fijada la app que lo pidió (aud, el Mudador): otra app de esa cuenta ya no puede. Máximo TRASLADO_MAX_DIA_ entregas al día.
   Nunca escribe un valor en el registro: solo cuántas y cuándo.
   En doPost, antes de revisar el token de la app:   var __mud = trasladoEntregar_(p); if (__mud) return __mud; */

var TRASLADO_DESTINO_ = 'alma@spacioam.com';
var TRASLADO_MAX_DIA_ = 6;
var TRASLADO_PROPIAS_ = ['TRASLADO_AUD', 'TRASLADO_DIA'];   // las de este archivo no se entregan

function trasladoEntregar_(p) {
  if (!p || p.traslado !== 'entregar') return null;
  var r;
  try { r = trasladoEntregarDatos_(String(p.id_token || '')); }
  catch (e) { r = { ok: false, error: trasladoCausa_(e) }; }
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

  var t = trasladoTokenLocal_(idToken);
  if (!t.ok) return { ok: false, error: 'identidad (' + t.por + ')' };
  t = t.t;
  var correoOk = String(t.email || '').toLowerCase() === TRASLADO_DESTINO_ && String(t.email_verified) === 'true';
  if (!correoOk) return { ok: false, error: 'identidad (otro correo o sin verificar)' };
  if (!(Number(t.exp) * 1000 > Date.now())) return { ok: false, error: 'identidad (token vencido)' };
  if (!t.aud) return { ok: false, error: 'identidad (sin app)' };
  var aud = sp.getProperty('TRASLADO_AUD');
  if (aud && aud !== String(t.aud)) return { ok: false, error: 'otra_app' };
  if (!aud) sp.setProperty('TRASLADO_AUD', String(t.aud));

  var todas = sp.getProperties(), salida = {};
  Object.keys(todas).forEach(function (k) { if (TRASLADO_PROPIAS_.indexOf(k) < 0) salida[k] = todas[k]; });
  console.log('Traslado: entregadas ' + Object.keys(salida).length + ' propiedades a ' + TRASLADO_DESTINO_);
  return { ok: true, propiedades: salida };
}

/* La causa real de un error inesperado (sin valores: solo el tipo de falla). */
function trasladoCausa_(e) {
  var m = String((e && e.message) || e || '');
  if (/too many times|demasiadas veces|cuota|quota/i.test(m)) return 'sin cupo de Google (' + m.slice(0, 80) + ')';
  return 'interno (' + m.slice(0, 80) + ')';
}

/* ── El token de identidad, revisado sin internet (RS256 con las llaves públicas de Google, googleapis.com/oauth2/v3/certs).
   Igual que el login (Hub-Spacioam login/apps-script/03-auth-endpoint.js). Si Google cambia sus llaves: actualizar
   TRASLADO_LLAVES_ o guardar { keys: [{kid, n, e}] } en la propiedad GOOGLE_LLAVES. ── */
var TRASLADO_LLAVES_ = [   // públicas, 17-nov-2026
  {kid:'943a3a5d7d919625a454e489b75c29adab57acba', e:'AQAB', n:'pIpnzA2ezyEERJSxiqpLBmMeIqATH-V6iuBtKIibXEyYovujrx8niqTeO6RIyXT6uDUUv0V2kJ8V_iWYFxzXY1BqK9IfcAmjg0XUDoyTVkoyLsF0gj299LH-zw5vCvy8jmamFIZKAbKcQ5hpHvSittM1vl-6vVL-i2GxyGbMA9aY6Hq15NylS1t7ELTYfQimlnvxcb7_DM0cuS5U1SfbCZMCpKhh0nrSlYds240oxpCJOV2rBahs_Ea5c7tezS1nwVC9W_E-bR9TF6BHkC_fv-E8DcWfkI_6geaJzBhINNxBfjx-w1-WUp2Jz3YYFWEfeQjxMqu-Fg6cGxwk7V16uQ'},
  {kid:'9e7b714e8bfb4ef03bac2570eb322bfb7d686ee9', e:'AQAB', n:'7O_xgke58DhpSDJRmIMm-u4fcgxyybcqhkKLHesjVvRuhcxYWFUDkb4elTCgEZGH35JXHK0BDZzA1IDuNdum6wnHFC9emCtE0j781ZPVdpK40qBB_tCk05iJrBaeL92Ep4AznwgCUI0ETQkZHnRcHDn2u-XDlABu1a9nfi3ZNL-JYZEBioielRWvIST64Q7EADp8VglvLQTTNcIYXYSoySBlI4YLipMwJYlw49Skac2IunodvJB6z8Z8VcZKvM87uC00CZMfi6ZuIN7Qjval66BIgamM4sJ6W6aUHDFfCiDOuEQtsXo5ItWg70fItLeTpss1_pJdxkM0nzfx6ccmQQ'}
];
function trasladoLlaves_() {
  var g = [];
  try { g = JSON.parse(PropertiesService.getScriptProperties().getProperty('GOOGLE_LLAVES') || '{}').keys || []; } catch (e) {}
  return g.concat(TRASLADO_LLAVES_);
}
function trasladoB64_(s) { s = String(s || ''); return Utilities.base64DecodeWebSafe(s + '==='.slice((s.length + 3) % 4)); }
function trasladoHex_(bytes) { return [].slice.call(bytes).map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join(''); }
function trasladoBig_(bytes) { return BigInt('0x' + (trasladoHex_(bytes) || '0')); }
function trasladoRsaOk_(datos, firma, nBytes, eBytes) {
  var n = trasladoBig_(nBytes), e = trasladoBig_(eBytes), s = trasladoBig_(firma), uno = BigInt(1), cero = BigInt(0);
  if (n <= uno || s >= n) return false;
  var r = uno, b = s % n;
  while (e > cero) { if ((e & uno) === uno) r = r * b % n; e = e >> uno; b = b * b % n; }
  var k = Math.ceil(n.toString(16).length / 2), em = r.toString(16);
  while (em.length < 2 * k) em = '0' + em;
  var hash = trasladoHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, datos, Utilities.Charset.UTF_8));
  var relleno = 2 * k - 2 * (3 + 19 + 32); if (relleno < 16) return false;
  var esperado = '0001' + new Array(relleno / 2 + 1).join('ff') + '00' + '3031300d060960864801650304020105000420' + hash;
  if (em.length !== esperado.length) return false;
  var d = 0; for (var i = 0; i < em.length; i++) d |= em.charCodeAt(i) ^ esperado.charCodeAt(i);
  return d === 0;
}
function trasladoTokenLocal_(jwt) {
  var p = String(jwt || '').split('.');
  if (p.length !== 3 || !p.every(function (x) { return /^[A-Za-z0-9_-]+$/.test(x); })) return { ok: false, por: 'no es un token' };
  var h, t;
  try { h = JSON.parse(Utilities.newBlob(trasladoB64_(p[0])).getDataAsString()); } catch (e) { return { ok: false, por: 'no es un token' }; }
  if (!h || h.alg !== 'RS256' || !h.kid) return { ok: false, por: 'no es RS256' };
  var k = trasladoLlaves_().filter(function (x) { return x.kid === h.kid; })[0];
  if (!k) return { ok: false, por: 'llave de Google desconocida: actualizar TRASLADO_LLAVES_' };
  if (!trasladoRsaOk_(p[0] + '.' + p[1], trasladoB64_(p[2]), trasladoB64_(k.n), trasladoB64_(k.e))) return { ok: false, por: 'firma mala' };
  try { t = JSON.parse(Utilities.newBlob(trasladoB64_(p[1])).getDataAsString()); } catch (e) { return { ok: false, por: 'no es un token' }; }
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(String(t.iss)) < 0) return { ok: false, por: 'emisor no es Google' };
  return { ok: true, t: t };
}
