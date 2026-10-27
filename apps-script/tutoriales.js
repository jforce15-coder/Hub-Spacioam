/* ═══ TUTORIALES · quién vio qué (oct 2026) ══════════════════════════════════════════════════════════════
   js/sa-tutoriales.js (todas las apps del equipo) avisa aquí el avance de cada persona en cada tutorial.
   Así el video obligatorio deja de salir en TODOS sus equipos cuando lo vio en uno, y el Hub sabe quién lo vio.
   · body.tutorial = 1, body.session = sesión firmada del login (la persona sale de ahí, nunca del navegador).
   · accion 'leer'    → { ok, avance: { "<id>@<v>": { v: 1|0, m: % máximo } } } de esa persona.
   · accion 'guardar' → id, version, pct (lo que llegó a reproducir), evento ('avance' | 'mas_tarde' | 'fin'), app.
   · Hoja TUTORIALES (en la hoja de ALMA): una fila por persona y tutorial. Visto = llegó al 85 %.
   · El Hub (administradores) lo lee con la acción 'tutoriales' de hubApi_. */

var TUT_TAB_ = 'TUTORIALES';
var TUT_COLS_ = ['email', 'nombre', 'rol', 'tutorial', 'version', 'pct_max', 'visto', 'veces_mas_tarde', 'primera_vez', 'ultima_vez', 'visto_el', 'app'];
var TUT_VISTO_ = 85;

function tutHoja_() {
  var ss = ssAlma_(), sh = ss.getSheetByName(TUT_TAB_);
  if (!sh) {
    sh = ss.insertSheet(TUT_TAB_);
    sh.getRange(1, 1, 1, TUT_COLS_.length).setValues([TUT_COLS_]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function tutFilas_(sh) {
  var n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, TUT_COLS_.length).getValues();
}

function tutorialApi_(b) {
  var ses = b.session ? sesionLogin_(b.session) : null;
  var email = String((ses && (ses.email || ses.correo)) || '').trim().toLowerCase();
  /* Ojo: nunca error 'session' (sa-sesion.js cerraría la sesión de la persona por un simple registro). */
  if (!email) return { ok: false, error: 'sinSesion' };
  var accion = String(b.accion || 'leer');
  if (accion === 'leer') {
    var avance = {};
    tutFilas_(tutHoja_()).forEach(function (r) {
      if (String(r[0]).toLowerCase() !== email) return;
      avance[String(r[3]) + '@' + (Number(r[4]) || 1)] = { v: r[6] === true || String(r[6]).toUpperCase() === 'TRUE' ? 1 : 0, m: Number(r[5]) || 0 };
    });
    return { ok: true, avance: avance };
  }
  if (accion !== 'guardar') return { ok: false, error: 'accion' };
  var id = String(b.id || '').replace(/[^\w-]/g, '').slice(0, 60); if (!id) return { ok: false, error: 'id' };
  var ver = Math.max(1, Math.min(99, Number(b.version) || 1));
  var pct = Math.max(0, Math.min(100, Math.round(Number(b.pct) || 0)));
  var evento = String(b.evento || 'avance'), app = String(b.app || '').slice(0, 20), ahora = new Date();
  var lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) return { ok: false, error: 'ocupado' };
  try {
    var sh = tutHoja_(), filas = tutFilas_(sh), i = -1;
    for (var k = 0; k < filas.length; k++) if (String(filas[k][0]).toLowerCase() === email && String(filas[k][3]) === id && (Number(filas[k][4]) || 1) === ver) { i = k; break; }
    var r = i >= 0 ? filas[i] : [email, '', '', id, ver, 0, false, 0, ahora, ahora, '', ''];
    r[1] = String((ses && ses.nombre) || r[1] || ''); r[2] = String((ses && ses.rol) || r[2] || '');
    r[5] = Math.max(Number(r[5]) || 0, pct);
    var yaVisto = r[6] === true || String(r[6]).toUpperCase() === 'TRUE';
    if (!yaVisto && (r[5] >= TUT_VISTO_ || evento === 'fin')) { r[6] = true; r[10] = ahora; if (evento === 'fin') r[5] = 100; }
    if (evento === 'mas_tarde') r[7] = (Number(r[7]) || 0) + 1;
    r[9] = ahora; r[11] = app || r[11];
    if (i >= 0) sh.getRange(i + 2, 1, 1, TUT_COLS_.length).setValues([r]);
    else sh.appendRow(r);
    return { ok: true, v: r[6] === true ? 1 : 0, m: r[5] };
  } finally { lock.releaseLock(); }
}

/* Hub · administradores: quién vio cada tutorial (acción 'tutoriales' de hubApi_). */
function hubTutoriales_() {
  var out = tutFilas_(tutHoja_()).map(function (r) {
    return { email: r[0], nombre: r[1], rol: r[2], tutorial: r[3], version: Number(r[4]) || 1, pct: Number(r[5]) || 0,
             visto: r[6] === true || String(r[6]).toUpperCase() === 'TRUE', masTarde: Number(r[7]) || 0,
             primera: r[8] ? new Date(r[8]).toISOString() : '', ultima: r[9] ? new Date(r[9]).toISOString() : '', vistoEl: r[10] ? new Date(r[10]).toISOString() : '', app: r[11] };
  });
  return { ok: true, filas: out };
}
