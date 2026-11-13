/* ═══ LLAVES (Ajustes → Llaves, app de Alma) ═════════════════════════════════════════════════════════════════
   La pantalla de Propiedades del script ya no deja agregar más (tope de ~50). Juan eligió (13-nov-2026, opción A) guardarlas
   desde Ajustes: el administrador principal, con su sesión verificada, pega la llave y el Hub la guarda con setProperty.
   - Solo los nombres de LLAVES_PERMITIDAS_ (este es el único lugar): nada de guardar cualquier propiedad por su nombre.
   - Nunca con la llave vieja del Hub (HUB_TOKEN) ni con un robot: sin sesión verificada, no.
   - El valor nunca se devuelve ni se registra: solo si está, cuándo se guardó y sus 4 últimas letras.
   - Queda la huella en ALMA_LOG (quién y cuándo, sin el valor), como los cambios de ALMA_CONTROL. */
var LLAVES_PERMITIDAS_ = [
  { nombre: 'JEV_KEY', para: 'Jev (TypeSafe): el camino rápido de la voz' }   // #498 T5
];
var LLAVES_META_ = 'LLAVES_GUARDADAS';   // { NOMBRE: { t, por } }: cuándo y quién, nunca el valor

/* El administrador principal con sesión verificada (sesionLogin_ en hubApi_). Sin sesión no hay nadie: la llave vieja
   del Hub llega con ses = null y vozWebAdmin_(null) devolvería al principal, por eso no se usa aquí sin correo. */
function llavesAdmin_(ses) {
  if (!ses || typeof ses !== 'object' || !String(ses.email || '').trim()) return null;
  var adm = paraClaudePrincipalSes_(ses);   // paraclaude.js: también con su correo alterno
  return adm && adm.principal ? adm : null;
}
function llavePermitida_(nombre) {
  nombre = String(nombre || '').trim();
  return LLAVES_PERMITIDAS_.filter(function (l) { return l.nombre === nombre; })[0] || null;
}
function llavesMeta_(p) { try { return JSON.parse(p.getProperty(LLAVES_META_) || '{}') || {}; } catch (e) { return {}; } }
function llaveFecha_(t) { return t ? Utilities.formatDate(new Date(Number(t)), CFG.TZ, 'yyyy-MM-dd HH:mm') : ''; }
/* Lo único que sale de una llave: si está, cuándo se guardó y sus 4 últimas letras. */
function llaveResumen_(p, meta, l) {
  var v = String(p.getProperty(l.nombre) || ''), m = meta[l.nombre] || {};
  return { nombre: l.nombre, para: l.para, guardada: !!v, termina_en: v ? v.slice(-4) : '', guardada_el: v ? llaveFecha_(m.t) : '' };
}

/* Acción llaveEstado: por cada nombre permitido, si está guardada y sus 4 últimas letras. */
function llaveEstadoApi_(ses) {
  if (!llavesAdmin_(ses)) return { ok: false, error: 'Solo el administrador principal ve las llaves.' };
  var p = PropertiesService.getScriptProperties(), meta = llavesMeta_(p);
  return { ok: true, llaves: LLAVES_PERMITIDAS_.map(function (l) { return llaveResumen_(p, meta, l); }) };
}

/* Acción llaveGuardar { nombre, valor }: guarda y responde solo { ok, nombre, guardada_el, termina_en }. */
function llaveGuardarApi_(ses, nombre, valor) {
  var adm = llavesAdmin_(ses);
  if (!adm) return { ok: false, error: 'Solo el administrador principal guarda llaves.' };
  var l = llavePermitida_(nombre);
  if (!l) return { ok: false, error: 'Esa llave no se guarda desde aquí.' };
  var v = String(valor == null ? '' : valor).trim();
  if (!v) return { ok: false, error: 'Pega la llave.' };
  if (/\s/.test(v)) return { ok: false, error: 'La llave va sin espacios.' };
  if (v.length < 16 || v.length > 512) return { ok: false, error: 'Esa no parece una llave: tiene entre 16 y 512 letras.' };
  if (!/^[\x21-\x7E]+$/.test(v)) return { ok: false, error: 'Esa no parece una llave: solo letras, números y signos, sin acentos.' };
  var p = PropertiesService.getScriptProperties(), meta = llavesMeta_(p), t = Date.now();
  p.setProperty(l.nombre, v);
  meta[l.nombre] = { t: t, por: adm.nombre || adm.email };
  p.setProperty(LLAVES_META_, JSON.stringify(meta));
  try {
    hoja_(CFG.TAB_LOG).appendRow([Utilities.formatDate(new Date(t), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), '', '', 'LLAVE', 'Llave guardada desde Ajustes', '', '', '', '',
      'llave: ' + l.nombre + ' · por ' + (adm.nombre || adm.email)]);
  } catch (e) { console.error('log llave: ' + e); }
  return { ok: true, nombre: l.nombre, guardada_el: llaveFecha_(t), termina_en: v.slice(-4) };
}
