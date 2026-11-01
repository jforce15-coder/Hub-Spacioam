/* ═══ Foto de perfil de ALMA que rota sola ═══════════════════════════════════
   Las fotos viven en el Hub (hub.spacioam.com/alma/fotos/01.jpg … NN.jpg, cuadradas).
   Cada FOTO_CADA_HORAS (4 por defecto) se sube la siguiente al perfil de WhatsApp Business.
   Orden barajado sin repetir hasta usarlas todas.
   Propiedades opcionales: FOTO_ROTAR=0 (pausa) · FOTO_CADA_HORAS (4) · FOTO_TOTAL. */
const FOTO_BASE_ = 'https://hub.spacioam.com/alma/fotos/';
const FOTO_TOTAL_DEF_ = 15;

function fotoProcesar_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('FOTO_ROTAR') === '0') return;
  const cadaH = Math.max(1, Number(p.getProperty('FOTO_CADA_HORAS') || 4));
  const ult = Date.parse(p.getProperty('FOTO_CAMBIADA') || '') || 0;
  if (Date.now() - ult < cadaH * 3600000 - 60000) return;
  // Si falla (por ejemplo, la foto aún no está publicada) reintenta cada 30 min, no cada minuto.
  const intento = Number(p.getProperty('FOTO_INTENTO') || 0);
  if (Date.now() - intento < 30 * 60000) return;
  p.setProperty('FOTO_INTENTO', String(Date.now()));
  try { fotoCambiar_(); }
  catch (e) { p.setProperty('FOTO_ERROR', String(e).slice(0, 400)); console.warn('fotoCambiar_: ' + e); }
}

function fotoSiguiente_(p) {
  const total = Number(p.getProperty('FOTO_TOTAL') || FOTO_TOTAL_DEF_);
  let cola = [];
  try { cola = JSON.parse(p.getProperty('FOTO_COLA') || '[]'); } catch (e) {}
  cola = cola.filter(n => n >= 1 && n <= total);
  if (!cola.length) {
    for (let i = 1; i <= total; i++) cola.push(i);
    for (let i = cola.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = cola[i]; cola[i] = cola[j]; cola[j] = t; }
    const actual = Number(p.getProperty('FOTO_ACTUAL') || 0);
    if (cola.length > 1 && cola[0] === actual) cola.push(cola.shift());
  }
  const n = cola.shift();
  p.setProperty('FOTO_COLA', JSON.stringify(cola));
  return n;
}

function fotoAppId_(p, token) {
  let id = p.getProperty('WA_APP_ID');
  if (id) return id;
  let r = JSON.parse(uf_('https://graph.facebook.com/v21.0/app?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true }).getContentText() || '{}');
  id = r && r.id;
  if (!id) {
    r = JSON.parse(uf_('https://graph.facebook.com/v21.0/debug_token?input_token=' + encodeURIComponent(token) + '&access_token=' + encodeURIComponent(token), { muteHttpExceptions: true }).getContentText() || '{}');
    id = r && r.data && r.data.app_id;
  }
  if (!id) throw new Error('No se pudo saber el ID de la app de Meta: ' + JSON.stringify(r).slice(0, 200));
  p.setProperty('WA_APP_ID', String(id));
  return String(id);
}

/* Cambia la foto ya (n = número de foto, opcional). */
function fotoCambiar_(n) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('WA_TOKEN'), phoneId = p.getProperty('WA_PHONE_ID');
  if (!token || !phoneId) throw new Error('Falta WA_TOKEN o WA_PHONE_ID');
  if (!n) n = fotoSiguiente_(p);
  const url = FOTO_BASE_ + ('0' + n).slice(-2) + '.jpg';
  const img = uf_(url, { muteHttpExceptions: true });
  if (img.getResponseCode() !== 200) throw new Error('No se pudo bajar ' + url + ' (' + img.getResponseCode() + ')');
  const bytes = img.getBlob().getBytes();
  const appId = fotoAppId_(p, token);
  // 1) sesión de subida
  const s1 = JSON.parse(uf_('https://graph.facebook.com/v21.0/' + appId + '/uploads?file_name=alma.jpg&file_length=' + bytes.length + '&file_type=image%2Fjpeg', {
    method: 'post', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }).getContentText() || '{}');
  if (!s1.id) throw new Error('Subida (sesión): ' + JSON.stringify(s1).slice(0, 300));
  // 2) bytes de la imagen
  const s2 = JSON.parse(uf_('https://graph.facebook.com/v21.0/' + s1.id, {
    method: 'post', headers: { Authorization: 'OAuth ' + token, file_offset: '0' }, contentType: 'image/jpeg', payload: bytes, muteHttpExceptions: true }).getContentText() || '{}');
  if (!s2.h) throw new Error('Subida (archivo): ' + JSON.stringify(s2).slice(0, 300));
  // 3) se pone como foto del perfil
  const s3 = JSON.parse(uf_('https://graph.facebook.com/v21.0/' + phoneId + '/whatsapp_business_profile', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: s2.h }), muteHttpExceptions: true }).getContentText() || '{}');
  if (!s3.success) throw new Error('Perfil: ' + JSON.stringify(s3).slice(0, 300));
  p.setProperty('FOTO_ACTUAL', String(n));
  p.setProperty('FOTO_CAMBIADA', new Date().toISOString());
  p.deleteProperty('FOTO_ERROR');
  return { ok: true, foto: n };
}

function fotoEstado_() {
  const p = PropertiesService.getScriptProperties();
  return { ok: true, rotar: p.getProperty('FOTO_ROTAR') !== '0', actual: Number(p.getProperty('FOTO_ACTUAL') || 0),
    cambiada: p.getProperty('FOTO_CAMBIADA') || '', cadaHoras: Number(p.getProperty('FOTO_CADA_HORAS') || 4),
    total: Number(p.getProperty('FOTO_TOTAL') || FOTO_TOTAL_DEF_), error: p.getProperty('FOTO_ERROR') || '' };
}

function fotoConfig_(b) {
  const p = PropertiesService.getScriptProperties();
  if (b.rotar != null) p.setProperty('FOTO_ROTAR', b.rotar ? '1' : '0');
  if (b.cadaHoras) p.setProperty('FOTO_CADA_HORAS', String(Math.max(1, Number(b.cadaHoras))));
  if (b.total) { p.setProperty('FOTO_TOTAL', String(Number(b.total))); p.deleteProperty('FOTO_COLA'); }
  return fotoEstado_();
}
