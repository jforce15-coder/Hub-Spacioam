/* ═══ EL SOCIO DE UN APARTAMENTO (Mi, Control de usuarios, contactos y el chat de Juan) ═══════════════════════════
   13-nov: Juan le pidió a Alma escribirle «al socio de Narama 633» y «al de Rue 301». Alma no los encontró y le pidió
   el número tres veces (también al día siguiente, aunque Juan ya se lo había escrito): buscaba solo por nombre
   (agPersona_), entre socios que ya tenían teléfono, y el nombre parecido la llevó a otro apartamento del edificio.
   Pero Mi sí sabe de quién es cada apartamento: su pestaña SETUP une el apartamento con el correo del socio, y el
   Control de usuarios une ese correo con su nombre y su teléfono. El número se busca así, en orden:
     1. Control de usuarios: el teléfono del usuario que Mi tiene para ese apartamento;
     2. ALMA_CONTACTOS: una ficha de socio con ese apartamento;
     3. lo que un administrador ya escribió en su chat con Alma («Teléfono de socio: …» junto al apartamento): se anota
        solo en la ficha de contacto (dato de hecho) para no volver a buscarlo.
   Si nada lo tiene, Alma ya sabe quién es (el correo que tiene Mi) y pide solo el número, una vez. Con el número, la
   ficha queda guardada como socio de ese apartamento. Solo lee Mi y el Control de usuarios; escribe solo ALMA_CONTACTOS. */

var SOCIO_MI_PALABRAS_ = /\b(socio|socia|socios|socias|due[ñn]o|due[ñn]a|due[ñn]os|due[ñn]as|propietari[oa]s?|owner)\b/i;

function socioNorm_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
/* «Z13 - Narama - 633» → ['narama', '633'] (sin la zona). */
function socioClaveProp_(p) { return socioNorm_(String(p || '').replace(/^\s*z\s*\d+\s*-?\s*/i, '')).split(' ').filter(Boolean); }
/* Las propiedades cuyo nombre está completo en el texto («escríbele al socio de Narama 633» → Z13 - Narama - 633).
   Si el texto trae un número, el número tiene que coincidir: Narama 633 nunca es Narama 623. */
function socioPropsEnTexto_(texto, nombres) {
  var t = ' ' + socioNorm_(texto) + ' ', nums = (t.match(/\b\d{2,5}\b/g) || []);
  var hits = (nombres || []).filter(function (p) {
    var k = socioClaveProp_(p); if (!k.length) return false;
    if (!k.every(function (w) { return t.indexOf(' ' + w + ' ') >= 0; })) return false;
    var kn = k.filter(function (w) { return /^\d+$/.test(w); });
    return !nums.length || kn.some(function (w) { return nums.indexOf(w) >= 0; });
  });
  /* «Narama 633» también aparece dentro de un nombre más largo: se queda el más específico. */
  return hits.filter(function (p) { var k = socioClaveProp_(p).join(' '); return !hits.some(function (q) { return q !== p && socioClaveProp_(q).join(' ').indexOf(k + ' ') === 0; }); });
}

/* SETUP de Mi: [{ propiedad, emails }]. Cacheado 30 min. */
function socioMiSetup_() {
  var c = CacheService.getScriptCache(), hit = c.get('socmi_setup'); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var out = [];
  var sh = SpreadsheetApp.openById(RMES_HOJA_).getSheetByName('SETUP'); if (!sh) return out;
  var v = sh.getDataRange().getDisplayValues(); if (v.length < 2) return out;
  var cab = v[0].map(function (h) { return socioNorm_(h); });
  var cp = cab.indexOf('property name'), ce = cab.filter(function (h) { return /^(user email|email|correo|secondary user email)$/.test(h); }).map(function (h) { return cab.indexOf(h); });
  if (cp < 0) return out;
  var por = {};
  v.slice(1).forEach(function (r) {
    var p = String(r[cp] || '').trim(); if (!p) return;
    var o = por[p] = por[p] || { propiedad: p, emails: [] };
    ce.forEach(function (i) { String(r[i] || '').split(/[,;\s]+/).forEach(function (e) { e = e.trim().toLowerCase(); if (/@/.test(e) && o.emails.indexOf(e) < 0) o.emails.push(e); }); });
  });
  out = Object.keys(por).map(function (k) { return por[k]; });
  try { c.put('socmi_setup', JSON.stringify(out), 1800); } catch (e) {}
  return out;
}
/* Control de usuarios: { correo: { nombre, tel } } (también por el correo alterno). Cacheado 30 min. */
function socioMiUsuarios_() {
  var c = CacheService.getScriptCache(), hit = c.get('socmi_usr'); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var out = {};
  SpreadsheetApp.openById(SHEET_ACCESOS_ID).getSheets().forEach(function (sh) {
    var v = sh.getDataRange().getDisplayValues(); if (v.length < 2) return;
    var cab = v[0].map(function (h) { return socioNorm_(h).replace(/ /g, '_'); }), col = function (re) { return cab.findIndex(function (h) { return re.test(h); }); };
    var ce = col(/^(email|correo|mail)$/), ca = col(/^(email_alterno|correo_alterno)$/), ct = col(/^(telefono|telefonos|tel|celular|whatsapp|phone|movil)$/);
    var cn = col(/^(nombre|name)$/), cpn = col(/^primer_nombre$/), cpa = col(/^primer_apellido$/);
    if (ce < 0) return;
    v.slice(1).forEach(function (r) {
      var nom = String(cn >= 0 ? r[cn] : '').trim();
      if (!nom || /^socio_\d+$/i.test(nom) || /@/.test(nom)) nom = [cpn >= 0 ? r[cpn] : '', cpa >= 0 ? r[cpa] : ''].join(' ').trim();
      var o = { nombre: nom, tel: ct >= 0 ? (telsDe_(r[ct])[0] || '') : '' };
      [ce, ca].forEach(function (i) { var e = i >= 0 ? String(r[i] || '').trim().toLowerCase() : ''; if (/@/.test(e) && !(out[e] && out[e].tel)) out[e] = o; });
    });
  });
  try { c.put('socmi_usr', JSON.stringify(out), 1800); } catch (e) {}
  return out;
}

/* Lo que un administrador ya escribió en su chat con Alma: el número que viene junto al apartamento. El tramo va desde
   que nombra el apartamento hasta que nombra otro (o 300 letras). { tel, nombre, fecha } o null. */
function socioTelEnTexto_(texto, propiedad, otras) {
  var t = String(texto || ''), k = socioClaveProp_(propiedad); if (k.length < 2) return null;
  var re = function (kk) { return new RegExp(kk.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('[^a-z0-9\\n]{1,6}'), 'i'); };
  var plano = t.normalize('NFD').replace(/[̀-ͯ]/g, ''), m = re(k).exec(plano); if (!m) return null;
  var desde = m.index + m[0].length, hasta = Math.min(plano.length, desde + 300);
  (otras || []).forEach(function (o) { var ko = socioClaveProp_(o); if (ko.join(' ') === k.join(' ') || ko.length < 2) return; var mo = re(ko).exec(plano.slice(desde)); if (mo && desde + mo.index < hasta) hasta = desde + mo.index; });
  var tramo = plano.slice(desde, hasta), tels = telsEnTexto_(tramo); if (!tels.length) return null;
  var nm = /nombre\s*:\s*([^\n*]{2,60})/i.exec(tramo);
  return { tel: tels[0], nombre: nm ? nm[1].trim() : '' };
}
function socioTelEnChat_(propiedad, otras) {
  var adms = []; try { adms = adminsOp_(); } catch (e) {}
  var lim = Date.now() - 60 * 86400000, mejor = null;
  adms.forEach(function (a) {
    var filas = []; try { filas = opFilas_(a.email, 400); } catch (e) {}
    filas.forEach(function (f) {
      if (f.de !== 'yo' || !(Date.parse(f.ts) > lim)) return;
      var r = socioTelEnTexto_(f.texto, propiedad, otras); if (!r) return;
      try { if (adminPorTel_(r.tel)) return; } catch (e) {}
      if (!mejor || f.ts > mejor.fecha) mejor = { tel: r.tel, nombre: r.nombre, fecha: f.ts, quien: a.nombre || '' };
    });
  });
  return mejor;
}

/* El socio (o los socios) del apartamento que nombra el texto. { propiedad, socios: [{ nombre, tel, email, fuente }] }
   · { opciones } si el texto nombra varios apartamentos · null si no nombra ninguno de Mi. */
function socioDelApartamento_(texto) {
  var setup = socioMiSetup_(), nombres = setup.map(function (s) { return s.propiedad; });
  var props = socioPropsEnTexto_(texto, nombres); if (!props.length) return null;
  if (props.length > 1) return { opciones: props.slice(0, 5) };
  var prop = props[0], fila = setup.filter(function (s) { return s.propiedad === prop; })[0] || { emails: [] };
  var usr = {}; try { usr = socioMiUsuarios_(); } catch (e) { console.error('socioMiUsuarios_: ' + e); }
  var socios = [], k = socioClaveProp_(prop).join(' ');
  var add = function (o) { if (o.tel && socios.some(function (x) { return fin8_(x.tel) === fin8_(o.tel); })) return; socios.push(o); };
  fila.emails.forEach(function (e) { var u = usr[e] || {}; add({ nombre: u.nombre || '', tel: normTel_(u.tel || ''), email: e, fuente: u.tel ? 'Control de usuarios' : '' }); });
  try {
    contactosTodos_().forEach(function (o) {
      if (String(o.tipo) !== 'socio' || !normTel_(o.tel)) return;
      var ps = String(o.propiedades || '').split(/[,;\n]/).map(function (x) { return socioClaveProp_(x).join(' '); });
      if (ps.indexOf(k) < 0) return;
      var sinTel = socios.filter(function (x) { return !x.tel; })[0];
      if (sinTel) { sinTel.tel = normTel_(o.tel); sinTel.nombre = sinTel.nombre || o.nombre; sinTel.fuente = 'ficha de contacto'; }
      else add({ nombre: o.nombre, tel: normTel_(o.tel), email: '', fuente: 'ficha de contacto' });
    });
  } catch (e) { console.error('socio ficha: ' + e); }
  if (!socios.some(function (x) { return x.tel; })) {
    var ch = null; try { ch = socioTelEnChat_(prop, nombres); } catch (e) { console.error('socioTelEnChat_: ' + e); }
    if (ch) {
      var s0 = socios[0] || {}; if (!socios.length) socios.push(s0);
      s0.tel = ch.tel; s0.nombre = s0.nombre || ch.nombre; s0.fuente = 'lo escribió ' + (ch.quien || 'el administrador') + ' en su chat el ' + String(ch.fecha).slice(0, 10);
      socioGuardarFicha_(ch.tel, s0.nombre, prop, s0.fuente);
    }
  }
  return { propiedad: prop, socios: socios };
}
/* El número de un socio queda en su ficha de contacto: socio de ese apartamento (dato de hecho; datoshecho.js). */
function socioGuardarFicha_(tel, nombre, propiedad, fuente) {
  tel = normTel_(tel); if (!tel) return;
  try { if (adminPorTel_(tel)) return; } catch (e) {}
  var f = null; try { f = contactoFicha_(tel); } catch (e) {}
  var props = String((f && f.propiedades) || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (propiedad && props.indexOf(propiedad) < 0) props.push(propiedad);
  if (f && String(f.tipo) === 'socio' && props.join(', ') === String(f.propiedades || '')) return;
  contactoGuardar_(tel, { nombre: (f && f.nombre) || nombre || '', tipo: 'socio', rol: (f && f.rol) || ('Socio de ' + propiedad), propiedades: props.join(', '), origen: (f && f.origen) || 'socio de Mi' });
  try { hojaCrear_('ALMA_DATOS_HECHO', DATO_HECHO_CAB_).appendRow([new Date().toISOString(), 'Alma', 'contacto', tel, nombre || propiedad, 'propiedades', celdaTexto_((f && f.propiedades) || ''), celdaTexto_(props.join(', ')), celdaTexto_(fuente || 'socio de Mi')]); } catch (e) {}
}
/* Para escribir_a_equipo, programar_mensaje y buscar_contacto: «el socio de Narama 633». { nombre, tel, propiedad, fuente }
   · { error } con lo que falta (dice quién es según Mi) · null si el texto no nombra un apartamento de Mi. */
function socioParaEscribir_(persona, propiedad) {
  var txt = [persona, propiedad].filter(Boolean).join(' ');
  if (!SOCIO_MI_PALABRAS_.test(String(persona || ''))) return null;   // solo si piden al socio: «Recepción Ignacio» con su apartamento no es el socio
  var r = null; try { r = socioDelApartamento_(txt); } catch (e) { console.error('socioDelApartamento_: ' + e); return null; }
  if (!r) return null;
  if (r.opciones) return { error: 'Ese texto nombra varios apartamentos: ' + r.opciones.join(' · ') + '. ¿De cuál es el socio?' };
  var con = r.socios.filter(function (s) { return s.tel; });
  if (con.length) return { nombre: con[0].nombre || ('Socio de ' + r.propiedad), tel: con[0].tel, propiedad: r.propiedad, fuente: con[0].fuente, otros: con.slice(1).map(function (s) { return s.nombre || ('+' + s.tel); }) };
  var quien = r.socios.map(function (s) { return s.nombre || s.email; }).filter(Boolean).join(', ');
  return { error: 'En Mi, ' + r.propiedad + ' es de ' + (quien || 'un socio sin datos') + ', pero no tengo su número de WhatsApp (ni en el Control de usuarios, ni en contactos, ni en tu chat). Pídeselo a Juan UNA vez; cuando lo dé, vuelve a llamar con numero y propiedad y queda guardado.', propiedad: r.propiedad, sin_numero: true };
}
/* El apartamento de un socio por su número (Control de usuarios → correo → SETUP de Mi): la plantilla para socios lo
   necesita ({{2}}) y antes, sin columna de propiedad en el Control de usuarios, el mensaje no salía. '' si no se sabe. */
function socioPropDeTel_(wa) {
  var k = fin8_(wa); if (!k) return '';
  var usr = socioMiUsuarios_(), emails = Object.keys(usr).filter(function (e) { return fin8_(usr[e].tel) === k; });
  if (!emails.length) return '';
  return socioMiSetup_().filter(function (s) { return s.emails.some(function (e) { return emails.indexOf(e) >= 0; }); }).map(function (s) { return s.propiedad; })[0] || '';
}
