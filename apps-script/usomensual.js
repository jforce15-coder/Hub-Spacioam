/* ═══ REPORTE MENSUAL DE CONSUMO DE IA ═════════════════════════════════════════════════════════════════════
   El día 1 de cada mes Alma le manda a Juan por WhatsApp cuánto gastó la IA el mes anterior, y el Hub lo consulta con
   la acción «usoMensual». Sale de IA_USO (la misma hoja del tablero «usoIA»).
   · Por esfera y subcategoría: la esfera se asigna por función con la hoja IA_CATEGORIAS (patrón · esfera · subcategoría),
     que Juan puede corregir; la primera fila que coincida con «app · función» gana. Lo que no coincide queda en «Sin esfera».
   · Por app y por tipo de consumo (entrada, salida, caché). «Llamadas a herramientas» y «contexto del sistema» aún no se miden. */

var USOM_CAB_ = ['patron', 'esfera', 'subcategoria'];
var USOM_SEMILLA_ = [
  ['Alma voz|Notas de voz|Modo conferencia', 'Esencia', 'Hablar con Alma'],
  ['Redactar|Clasificar|Consultas|Control de calidad|decidir ruta|sin respuesta|Reviews|Hub · ajustar|^Hola', 'Relaciones', 'Huéspedes'],
  ['Chat operativo|^EPI', 'Propósito', 'Operación'],
  ['Mejoras|Auto mejora|Hub · redactar', 'Propósito', 'Mejora continua'],
  ['^mi ', 'Finanzas', 'Facturas']
];
var USOM_ESFERAS_ = ['Propósito', 'Relaciones', 'Finanzas', 'Health', 'Comunidad', 'Esencia'];

function usoMesReglas_() {
  var sh = hojaCrear_('IA_CATEGORIAS', USOM_CAB_);
  if (sh.getLastRow() < 2) USOM_SEMILLA_.forEach(function (f) { sh.appendRow(f); });
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    var re = null; try { re = new RegExp(String(r[0]), 'i'); } catch (e) {}
    return { re: re, esfera: String(r[1] || 'Sin esfera'), sub: String(r[2] || 'General') };
  });
}

/* mes = 'yyyy-MM' (por omisión, el mes anterior en hora de Guatemala) */
function usoMensual_(mes) {
  var ahora = new Date();
  if (!/^\d{4}-\d{2}$/.test(String(mes || ''))) mes = Utilities.formatDate(new Date(ahora.getTime() - Number(Utilities.formatDate(ahora, CFG.TZ, 'd')) * 86400000), CFG.TZ, 'yyyy-MM');
  var y = +mes.slice(0, 4), m = +mes.slice(5, 7), ant = Utilities.formatDate(new Date(Date.UTC(y, m - 2, 15)), 'UTC', 'yyyy-MM');
  var reglas = usoMesReglas_(), esf = {}, apps = {}, items = {}, tipo = { entrada: 0, salida: 0, cache: 0 }, tot = { usd: 0, n: 0 }, usdAnt = 0;
  var sh = ssAlma_().getSheetByName('IA_USO');
  if (sh && sh.getLastRow() >= 2) {
    var n = sh.getLastRow(), ini = Math.max(2, n - 60000);
    sh.getRange(ini, 1, n - ini + 1, USO_CAB_.length).getValues().forEach(function (v) {
      var t = v[0] instanceof Date ? v[0] : new Date(v[0]); if (isNaN(t)) return;
      var mm = Utilities.formatDate(t, CFG.TZ, 'yyyy-MM'), usd = +v[10] || 0;
      if (mm === ant) { usdAnt += usd; return; }
      if (mm !== mes) return;
      var app = String(v[1] || 'ALMA'), fn = String(v[2] || 'Otro'), clave = app + ' · ' + fn;
      var r = reglas.filter(function (x) { return x.re && x.re.test(clave); })[0] || { esfera: 'Sin esfera', sub: 'General' };
      var E = esf[r.esfera] = esf[r.esfera] || { esfera: r.esfera, usd: 0, subs: {} };
      E.usd += usd; E.subs[r.sub] = (E.subs[r.sub] || 0) + usd;
      apps[app] = (apps[app] || 0) + usd; items[clave] = (items[clave] || 0) + usd;
      tipo.entrada += +v[6] || 0; tipo.salida += +v[7] || 0; tipo.cache += (+v[8] || 0) + (+v[9] || 0);
      tot.usd += usd; tot.n++;
    });
  }
  var r2 = function (x) { return Math.round(x * 100) / 100; }, orden = function (o) { return Object.keys(o).map(function (k) { return { nombre: k, usd: r2(o[k]) }; }).sort(function (a, b) { return b.usd - a.usd; }); };
  return { ok: true, mes: mes, total: { usd: r2(tot.usd), llamadas: tot.n }, mes_anterior: { mes: ant, usd: r2(usdAnt) },
    esferas: Object.keys(esf).map(function (k) { var E = esf[k]; return { esfera: E.esfera, usd: r2(E.usd), subcategorias: orden(E.subs) }; }).sort(function (a, b) { return b.usd - a.usd; }),
    apps: orden(apps), tipos: tipo, mayores: orden(items).slice(0, 5),
    pendiente: 'Aún no se miden las llamadas a herramientas ni el contexto del sistema por separado.' };
}

function usoMensualTexto_(r) {
  var d = r.total.usd - r.mes_anterior.usd, tend = !r.mes_anterior.usd ? '' : (d >= 0 ? 'subió ' : 'bajó ') + '$' + Math.abs(Math.round(d * 100) / 100) + ' frente al mes anterior ($' + r.mes_anterior.usd + ')';
  var L = ['Consumo de IA de ' + r.mes + ': $' + r.total.usd + ' en ' + r.total.llamadas + ' llamadas' + (tend ? ', ' + tend : '') + '.', '', 'Por esfera:'];
  r.esferas.forEach(function (e) { L.push('• ' + e.esfera + ' $' + e.usd + ' (' + e.subcategorias.slice(0, 3).map(function (s) { return s.nombre + ' $' + s.usd; }).join(', ') + ')'); });
  L.push('', 'Por app: ' + r.apps.map(function (a) { return a.nombre + ' $' + a.usd; }).join(', '));
  L.push('Lo que más gastó: ' + r.mayores.slice(0, 3).map(function (a) { return a.nombre + ' $' + a.usd; }).join('; '));
  L.push('Tokens: entrada ' + r.tipos.entrada + ', salida ' + r.tipos.salida + ', caché ' + r.tipos.cache + '.');
  return L.join('\n');
}

/* procesarCola: el día 1, desde las 8:00 de Guatemala, una sola vez por mes. */
function usoMensualSiToca_() {
  var P = PropertiesService.getScriptProperties(), ahora = new Date();
  if (Utilities.formatDate(ahora, CFG.TZ, 'd') !== '1' || +Utilities.formatDate(ahora, CFG.TZ, 'H') < 8) return;
  var mesHoy = Utilities.formatDate(ahora, CFG.TZ, 'yyyy-MM'); if (P.getProperty('USOM_ENVIADO') === mesHoy) return;
  P.setProperty('USOM_ENVIADO', mesHoy);
  var r = usoMensual_(), adm = adminsOp_().filter(function (a) { return a.principal; })[0], tel = adm && adm.tels[0];
  if (!tel) { console.error('usoMensualSiToca_: el administrador principal no tiene WhatsApp'); return; }
  try { waEnviar_(tel, usoMensualTexto_(r)); } catch (e) { console.error('usoMensualSiToca_: ' + e); }
}
