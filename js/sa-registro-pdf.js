/* Spacio AM · PDF del registro de huéspedes (una sola fuente para Hola y el Hub)
   ---------------------------------------------------------------------------
   Se carga desde el Hub:  <script src="https://hub.spacioam.com/js/sa-registro-pdf.js"></script>
   Uso:
     SARegistroPDF.descargar({
       h:   { code, checkin, checkout, maxCapacity, propertyShort, propertyName, apartment, statusForm },
       rec: { booker, contact, guests:[{ name, id, main, docImage, docFileId }], completedAt, acceptedRulesAt, startedAt, completedBy },
       imagen: function (fileId) { return Promise<dataURL|''> },   // trae el documento que falte
       alAvanzar: function (texto) {}                                // opcional: "Cargando documentos 1 de 3…"
     }).then(function (r) { r.ok, r.faltan, r.nombre });
   · Descarga un archivo .pdf de verdad (no abre la ventana de imprimir).
   · Antes de armarlo espera a TODOS los documentos de identidad y reintenta los que fallen;
     si alguno no llega, el PDF lo dice en su página y r.faltan > 0.
   · El mismo código arma el PDF en Hola y en el Hub: salen idénticos. */
(function (w) {
  if (w.SARegistroPDF) return;
  var BASE = (function () {
    try { var s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^/]*$/, ''); } catch (e) {}
    return 'https://hub.spacioam.com/js/';
  })();
  var JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var COL = { negro: [62, 63, 63], tierra: [111, 104, 103], taupe: [147, 139, 138], gris: [216, 212, 206], beige: [245, 243, 240],
    alab: [250, 250, 250], peach: [233, 130, 106], verde: [61, 107, 82], verdeTint: [229, 238, 233], linea: [234, 230, 224] };

  function cargarScript(src) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = function () { ok(); }; s.onerror = function () { mal(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  var _lib = null;
  function lib() {
    if (!_lib) _lib = (w.jspdf && w.jspdf.jsPDF ? Promise.resolve() : cargarScript(JSPDF)).then(function () { return w.jspdf.jsPDF; })
      .catch(function (e) { _lib = null; throw e; });
    return _lib;
  }
  function b64DeBuffer(buf) {
    var b = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
    return btoa(s);
  }
  var _fuente = null;
  function fuente() {
    if (!_fuente) _fuente = fetch(BASE + 'fonts/valky-regular.ttf').then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(b64DeBuffer).catch(function () { _fuente = null; return ''; });
    return _fuente;
  }
  function imagenAUrl(src) {   // carga una imagen (URL o data URL) y la devuelve como <img> lista
    return new Promise(function (ok) {
      if (!src) return ok(null);
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { ok(im.naturalWidth ? im : null); }; im.onerror = function () { ok(null); };
      im.src = src;
    });
  }
  var _sello = null;
  function sello() {
    if (!_sello) _sello = imagenAUrl(BASE.replace(/js\/$/, '') + 'assets/brand/logo-stamp-transparent.png');
    return _sello;
  }

  /* Marca de agua quemada en la imagen (no se puede quitar del PDF): la frase en filas paralelas
     inclinadas, en taupe suave, y el sello de Spacio AM en peach en una esquina. */
  function conMarca(im, selloIm, etiqueta) {
    var max = 1600, esc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    var W = Math.round(im.naturalWidth * esc), H = Math.round(im.naturalHeight * esc);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
    g.drawImage(im, 0, 0, W, H);
    var fs = Math.max(13, Math.round(W / 34)), txt = (etiqueta || 'DOCUMENTACIÓN DE REGISTRO').toUpperCase();
    g.save();
    g.translate(W / 2, H / 2); g.rotate(-22 * Math.PI / 180);
    g.font = '700 ' + fs + 'px Montserrat, Helvetica, Arial, sans-serif';
    g.fillStyle = 'rgba(147,139,138,0.30)'; g.textBaseline = 'middle';
    try { g.letterSpacing = Math.round(fs * 0.2) + 'px'; } catch (e) {}
    var paso = g.measureText(txt + '     ').width, diag = Math.sqrt(W * W + H * H), fila = 0;
    for (var y = -diag / 2; y < diag / 2; y += fs * 3.6, fila++) {
      for (var x = -diag / 2 - (fila % 2 ? paso / 2 : 0); x < diag / 2; x += paso) g.fillText(txt, x, y);
    }
    g.restore();
    if (selloIm) {   // sello peach al 60 % en la esquina inferior derecha
      var s = Math.round(Math.min(W, H) * 0.12), t = document.createElement('canvas'); t.width = s; t.height = s;
      var tg = t.getContext('2d'); tg.drawImage(selloIm, 0, 0, s, s);
      tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#FF6F52'; tg.fillRect(0, 0, s, s);
      g.globalAlpha = 0.6; g.drawImage(t, W - s - Math.round(W * 0.04), H - s - Math.round(H * 0.05)); g.globalAlpha = 1;
    }
    return { url: c.toDataURL('image/jpeg', 0.86), w: W, h: H };
  }

  function tel(p) {
    if (!p) return '';
    if (typeof p === 'string') return p.trim();
    var n = String(p.number || p.num || p.phone || '').trim();
    return n ? ((p.code || p.cc || p.dial || '+502') + ' ' + n) : '';
  }
  function fechaHora(v) {
    if (!v) return '';
    try { var d = new Date(v); if (isNaN(d)) return String(v); return d.toLocaleString('es-GT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala' }); }
    catch (e) { return String(v); }
  }
  function fechaLarga(ymd) {
    if (!ymd) return '';
    var s = String(ymd).slice(0, 10);
    try { var d = new Date(s + 'T12:00:00Z'); if (isNaN(d)) return s; return d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    catch (e) { return s; }
  }
  function noches(a, b) {
    try { var x = new Date(String(a).slice(0, 10) + 'T00:00:00Z'), y = new Date(String(b).slice(0, 10) + 'T00:00:00Z'); var n = Math.round((y - x) / 864e5); return n > 0 ? n : ''; }
    catch (e) { return ''; }
  }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  /* Trae todas las imágenes de documentos que falten. Reintenta dos veces las que fallen. */
  function completarDocs(rec, imagen, alAvanzar) {
    var guests = (rec && rec.guests) || [], faltan = [];
    guests.forEach(function (g, i) { if (g && !g.docImage && g.docFileId) faltan.push(i); });
    var total = faltan.length, listos = 0;
    if (!total || typeof imagen !== 'function') return Promise.resolve(guests);
    var copia = guests.map(function (g) { return Object.assign({}, g); });
    var avisar = function () { if (alAvanzar) try { alAvanzar('Cargando documentos ' + Math.min(listos + 1, total) + ' de ' + total + '…'); } catch (e) {} };
    avisar();
    var uno = function (i, intento) {
      return Promise.resolve().then(function () { return imagen(copia[i].docFileId); }).catch(function () { return ''; }).then(function (img) {
        if (img) { copia[i].docImage = img; listos++; avisar(); return; }
        if (intento < 2) return new Promise(function (r) { setTimeout(r, 900 * (intento + 1)); }).then(function () { return uno(i, intento + 1); });
        listos++; avisar();
      });
    };
    return Promise.all(faltan.map(function (i) { return uno(i, 0); })).then(function () { return copia; });
  }

  function armar(jsPDF, d, valky, selloIm) {
    var h = d.h || {}, rec = d.rec || null, guests = d.guests || [];
    var doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    var serif = 'times';
    if (valky) { try { doc.addFileToVFS('Valky.ttf', valky); doc.addFont('Valky.ttf', 'Valky', 'normal'); serif = 'Valky'; } catch (e) { serif = 'times'; } }
    var PW = 210, PH = 297, M = 18, CW = PW - M * 2, y = M;
    var col = function (c) { doc.setTextColor(c[0], c[1], c[2]); };
    var fill = function (c) { doc.setFillColor(c[0], c[1], c[2]); };
    var draw = function (c) { doc.setDrawColor(c[0], c[1], c[2]); };
    var sans = function (st, sz) { doc.setFont('helvetica', st || 'normal'); doc.setFontSize(sz); };
    var titulo = function (sz) { doc.setFont(serif, 'normal'); doc.setFontSize(sz); };
    var espaciado = function (t, sp) { return String(t).split('').join(sp ? ' ' : ''); };
    var eyebrow = function (t, x, yy, c) { sans('bold', 7); col(c || COL.taupe); doc.text(String(t).toUpperCase(), x, yy, { charSpace: 0.9 }); };
    var nuevaPagina = function () { doc.addPage(); y = M; };
    var espacio = function (alto) { if (y + alto > PH - 22) { nuevaPagina(); cabeceraChica(); } };
    var nombreProp = h.propertyShort || h.propertyName || ('Reserva ' + (h.code || ''));
    var cabeceraChica = function () {
      eyebrow('Resumen de registro · ' + (h.code || ''), M, y + 3);
      sans('normal', 8); col(COL.tierra); doc.text(nombreProp, PW - M, y + 3, { align: 'right' });
      y += 7; draw(COL.linea); doc.setLineWidth(0.3); doc.line(M, y, PW - M, y); y += 8;
    };
    var fila = function (k, v) {
      if (v == null || v === '') return;
      var val = doc.splitTextToSize(String(v), CW * 0.62);
      var alto = Math.max(9, 5 + val.length * 4.6);
      espacio(alto);
      eyebrow(k, M, y + 5.4, COL.tierra);
      sans('normal', 10); col(COL.negro); doc.text(val, PW - M, y + 5.6, { align: 'right' });
      y += alto; draw(COL.beige); doc.setLineWidth(0.3); doc.line(M, y, PW - M, y);
    };
    var seccion = function (t) { espacio(20); y += 7; titulo(15); col(COL.negro); doc.text(t, M, y + 4); y += 7; };
    var pastilla = function (t, x, yy, fondo, borde, texto, punto) {
      sans('bold', 7); var tw = doc.getTextWidth(String(t).toUpperCase()) + String(t).length * 0.45 + (punto ? 4.5 : 0) + 7;
      fill(fondo); draw(borde); doc.setLineWidth(0.25); doc.roundedRect(x, yy, tw, 6.4, 3.2, 3.2, 'FD');
      if (punto) { fill(punto); doc.circle(x + 4, yy + 3.2, 0.9, 'F'); }
      col(texto); doc.text(String(t).toUpperCase(), x + (punto ? 6.5 : 3.5), yy + 4.3, { charSpace: 0.45 });
      return tw;
    };
    var imagenDoc = function (img, maxAlto) {
      if (!img) {
        espacio(30); draw(COL.gris); doc.setLineDashPattern([1.2, 1.2], 0); fill(COL.beige); doc.roundedRect(M, y, CW, 26, 3, 3, 'FD'); doc.setLineDashPattern([], 0);
        sans('normal', 9); col(COL.tierra); doc.text('El documento no se pudo cargar. Vuelve a descargar el PDF en un momento.', PW / 2, y + 14.5, { align: 'center' });
        y += 30; return false;
      }
      var maxW = CW, maxH = maxAlto || (PH - 22 - y), r = Math.min(maxW / img.w, maxH / img.h), iw = img.w * r, ih = img.h * r;
      if (ih < 40 && maxAlto == null) { nuevaPagina(); cabeceraChica(); maxH = PH - 22 - y; r = Math.min(maxW / img.w, maxH / img.h); iw = img.w * r; ih = img.h * r; }
      var x = M + (CW - iw) / 2;
      doc.addImage(img.url, 'JPEG', x, y, iw, ih, undefined, 'FAST');
      draw(COL.gris); doc.setLineWidth(0.3); doc.roundedRect(x, y, iw, ih, 2.5, 2.5, 'S');
      y += ih + 4; return true;
    };

    /* ── Página 1: membrete ── */
    eyebrow('Resumen de registro', M, y + 3);
    titulo(26); col(COL.negro);
    var nomLineas = doc.splitTextToSize(nombreProp, CW - 30);
    doc.text(nomLineas, M, y + 14);
    var yNom = y + 14 + (nomLineas.length - 1) * 9.5;
    var sub = (h.propertyName && h.propertyName !== h.propertyShort) ? h.propertyName : '';
    var apt = (h.apartment && String(sub || nombreProp).indexOf(h.apartment) < 0) ? h.apartment : '';
    var linea = [sub, apt].filter(Boolean).join(' · ');
    if (linea) { sans('normal', 9.5); col(COL.tierra); doc.text(linea, M, yNom + 6.5); yNom += 6.5; }
    if (selloIm) { try { doc.addImage(selloIm, 'PNG', PW - M - 20, y, 20, 20); } catch (e) {} }
    y = Math.max(yNom + 6, y + 24);
    draw(COL.negro); doc.setLineWidth(0.6); doc.line(M, y, PW - M, y); y += 7;

    /* estado */
    var listo = !!rec || /complet/i.test(String(h.statusForm || ''));
    var px = M;
    px += pastilla(listo ? 'Registro completo' : 'Registro pendiente', px, y, listo ? COL.verdeTint : COL.beige, listo ? [168, 196, 181] : COL.gris, listo ? COL.verde : COL.negro, listo ? COL.verde : COL.taupe) + 3;
    sans('normal', 8); col(COL.tierra);
    var meta = ['Generado: ' + fechaHora(Date.now())];
    if (rec && (rec.completedAt || rec.acceptedRulesAt)) meta.push('Formulario recibido: ' + fechaHora(rec.completedAt || rec.acceptedRulesAt));
    doc.text(meta.join('   ·   '), px + 1, y + 4.3);
    y += 9;
    if (rec && rec.completedBy && rec.completedBy !== 'huésped') { sans('normal', 8); col(COL.tierra); doc.text('Finalizado por: ' + rec.completedBy, M, y + 2); y += 5; }

    /* tarjetas de datos rápidos: llegada · salida · noches · huéspedes */
    y += 3;
    var n = noches(h.checkin, h.checkout), datos = [
      ['Llegada', fechaLarga(h.checkin), '3:00 PM'], ['Salida', fechaLarga(h.checkout), '11:00 AM'],
      ['Noches', n ? String(n) : '—', ''], ['Huéspedes', String(guests.length || '—'), h.maxCapacity ? 'de ' + h.maxCapacity : '']];
    var gap = 3, cw = (CW - gap * 3) / 4;
    datos.forEach(function (dt, i) {
      var x = M + i * (cw + gap);
      fill(COL.beige); doc.roundedRect(x, y, cw, 22, 3, 3, 'F');
      eyebrow(dt[0], x + 4, y + 6);
      titulo(i >= 2 ? 17 : 11.5); col(COL.negro);
      doc.text(doc.splitTextToSize(dt[1], cw - 8)[0] || '', x + 4, y + (i >= 2 ? 15.5 : 13.5));
      if (dt[2]) { sans('normal', 7.5); col(COL.tierra); doc.text(dt[2], x + 4, y + 19); }
    });
    y += 26;

    seccion('Reserva');
    fila('Código', h.code);
    fila('Check-in', h.checkin ? String(h.checkin).slice(0, 10) + ' · 3:00 PM' : '');
    fila('Check-out', h.checkout ? String(h.checkout).slice(0, 10) + ' · 11:00 AM' : '');
    fila('Capacidad', h.maxCapacity ? 'hasta ' + h.maxCapacity + ' personas' : '');

    if (rec) {
      var b = rec.booker || {}, c = rec.contact || {};
      seccion('Quién reservó');
      espacio(8); sans('normal', 10); col(COL.negro);
      doc.text(b.type === 'third' ? 'Reserva gestionada por un tercero (no se hospeda).' : 'El huésped principal realizó la reserva.', M, y + 5); y += 8;
      if (b.type === 'third' && b.doc) {
        fila('Nombre completo', b.doc.name); fila('Identificación', b.doc.id); fila('Teléfono', tel(b.phone)); fila('Emergencia', tel(b.emergency)); fila('Correo', b.email);
        if (d.bookerImg !== undefined) { y += 4; imagenDoc(d.bookerImg, 90); }
      }
      seccion('Contacto');
      fila('Correo', c.email || b.email); fila('Teléfono', tel(c.phone) || tel(b.phone)); fila('Emergencia', tel(c.emergency));

      seccion('Normas de convivencia');
      espacio(16); fill(COL.beige); doc.roundedRect(M, y + 1, CW, 13, 3, 3, 'F');
      fill(COL.verde); doc.circle(M + 5, y + 7.5, 1.1, 'F');
      sans('normal', 9.5); col(COL.negro); doc.text('Aceptadas al finalizar el registro', M + 9, y + 8.6);
      if (rec.acceptedRulesAt) { sans('normal', 8.5); col(COL.tierra); doc.text(fechaHora(rec.acceptedRulesAt), PW - M - 5, y + 8.6, { align: 'right' }); }
      y += 17;

      /* ── Un huésped por página, con su documento ── */
      guests.forEach(function (g, i) {
        nuevaPagina(); cabeceraChica();
        titulo(20); col(COL.negro); doc.text('Huésped ' + (i + 1), M, y + 5);
        var tw = doc.getTextWidth('Huésped ' + (i + 1));
        if (g.main) pastilla('Principal', M + tw + 4, y, COL.peach, COL.peach, [255, 255, 255]);
        y += 10;
        fila('Nombre completo', g.name || '—');
        fila('Número de identificación', g.id || '—');
        y += 6; eyebrow('Documento de identidad', M, y); y += 4;
        imagenDoc(d.guestImgs[i] || null);
      });
    } else {
      seccion('Formulario');
      espacio(10); sans('normal', 10); col(COL.tierra); doc.text('El huésped todavía no ha completado su registro.', M, y + 5); y += 9;
    }

    /* pie en cada página */
    var tot = doc.getNumberOfPages();
    for (var p = 1; p <= tot; p++) {
      doc.setPage(p);
      draw(COL.linea); doc.setLineWidth(0.3); doc.line(M, PH - 14, PW - M, PH - 14);
      sans('normal', 7.5); col(COL.taupe);
      doc.text('hola@spacioam.com  ·  spacioam.com', M, PH - 9);
      doc.text('Documento confidencial · solo para registro de ingreso', PW / 2, PH - 9, { align: 'center' });
      doc.text(p + ' / ' + tot, PW - M, PH - 9, { align: 'right' });
    }
    return doc;
  }

  function guardar(doc, nombre) {
    var blob = doc.output('blob');
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = nombre; a.rel = 'noopener';
    a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 60000);
    return blob;
  }

  function generar(o) {
    o = o || {};
    var h = o.h || {}, rec = o.rec || null, avance = o.alAvanzar;
    if (avance) try { avance('Preparando PDF…'); } catch (e) {}
    return Promise.all([lib(), fuente(), sello(), completarDocs(rec, o.imagen, avance)]).then(function (r) {
      var jsPDF = r[0], valky = r[1], selloIm = r[2], guests = r[3] || [];
      if (avance) try { avance('Armando el PDF…'); } catch (e) {}
      var b = (rec && rec.booker) || {};
      var imgs = guests.map(function (g) { return g && g.docImage ? imagenAUrl(g.docImage) : Promise.resolve(null); });
      imgs.push(b.type === 'third' && b.doc && b.doc.docImage ? imagenAUrl(b.doc.docImage) : Promise.resolve(null));
      return Promise.all(imgs).then(function (lis) {
        var bookerIm = lis.pop();
        var marca = function (im) { return im ? conMarca(im, selloIm) : null; };
        var guestImgs = lis.map(marca);
        var faltan = guests.filter(function (g, i) { return g && (g.docFileId || g.docImage) && !guestImgs[i]; }).length;
        var doc = armar(jsPDF, { h: h, rec: rec, guests: guests, guestImgs: guestImgs, bookerImg: b.type === 'third' && b.doc ? marca(bookerIm) : undefined }, valky, selloIm);
        var nombre = 'Registro-' + (slug(h.propertyShort || h.propertyName) || 'Spacio-AM') + '-' + (h.code || '') + '.pdf';
        return { doc: doc, nombre: nombre, faltan: faltan };
      });
    });
  }

  w.SARegistroPDF = {
    /* Genera y descarga. */
    descargar: function (o) {
      return generar(o).then(function (g) { guardar(g.doc, g.nombre); return { ok: true, faltan: g.faltan, nombre: g.nombre }; });
    },
    /* Genera y devuelve el Blob (para pruebas o para adjuntarlo). */
    blob: function (o) { return generar(o).then(function (g) { return { ok: true, blob: g.doc.output('blob'), faltan: g.faltan, nombre: g.nombre }; }); },
    precargar: function () { lib(); fuente(); sello(); }
  };
})(window);
