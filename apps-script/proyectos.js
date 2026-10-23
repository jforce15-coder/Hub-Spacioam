/* ═══ PROYECTOS PERSONALES ═════════════════════════════════════════════════════════════════════════════════
   Un proyecto («Boda», «Mudanza»…) agrupa las conversaciones personales que ALMA tiene con varias personas sobre
   un mismo tema. Cada mensaje queda en el proyecto (hoja ALMA_PROY_MSGS) y ALMA mantiene un resumen consolidado
   (ALMA_PROY_PERS). Al hablar con alguien del proyecto, ALMA ve lo que ya dijeron los demás: no repite preguntas,
   completa lo que falta y contrasta. Un número puede pasar a otro proyecto cuando se le escribe por otro tema. */

var PROY_CAB_ = ['proyecto', 'creado', 'solicitante', 'objetivo', 'resumen', 'estado', 'actualizado'];
var PROY_MSG_CAB_ = ['ts', 'proyecto', 'persona', 'wa', 'quien', 'texto'];
function hojaProy_() { return hojaCrear_('ALMA_PROY_PERS', PROY_CAB_); }
function hojaProyMsg_() { return hojaCrear_('ALMA_PROY_MSGS', PROY_MSG_CAB_); }

function proyFilas_() {
  var sh = hojaProy_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PROY_CAB_.length).getValues().map(function (v, i) { return { fila: i + 2, proyecto: String(v[0]), creado: v[1], solicitante: String(v[2]), objetivo: String(v[3]), resumen: String(v[4]), estado: String(v[5] || 'abierto'), actualizado: v[6] }; });
}
function proyBuscar_(nombre) {
  var L = proyFilas_().filter(function (p) { return p.estado !== 'cerrado'; }); if (!nombre || !L.length) return null;
  var hit = opMatch_(String(nombre), L.map(function (p) { return p.proyecto; }));
  return hit ? L.filter(function (p) { return p.proyecto === hit; })[0] : null;
}
/* Devuelve el nombre del proyecto (existente por parecido, o nuevo). */
function proyAsegurar_(adm, nombre, objetivo) {
  nombre = String(nombre || '').trim(); if (!nombre) return '';
  var p = proyBuscar_(nombre);
  if (p) {
    if (objetivo && p.objetivo.indexOf(String(objetivo).slice(0, 60)) < 0) hojaProy_().getRange(p.fila, 4).setValue((p.objetivo ? p.objetivo + '\n· ' : '· ') + String(objetivo).slice(0, 800));
    return p.proyecto;
  }
  hojaProy_().appendRow([nombre, new Date().toISOString(), (adm && adm.email) || '', objetivo ? '· ' + String(objetivo).slice(0, 800) : '', '', 'abierto', new Date().toISOString()]);
  return nombre;
}
function proyNotar_(proyecto, persona, wa, quien, texto) {
  if (!proyecto) return;
  try { hojaProyMsg_().appendRow([new Date().toISOString(), proyecto, persona || '', wa || '', quien, String(texto).slice(0, 2000)]); } catch (e) {}
}
function proyMensajes_(proyecto) {
  var sh = hojaProyMsg_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PROY_MSG_CAB_.length).getValues().filter(function (v) { return String(v[1]) === proyecto; })
    .map(function (v) { return { ts: v[0], persona: String(v[2]), wa: String(v[3]), quien: String(v[4]), texto: String(v[5]) }; });
}
/* Contexto para la conversación con una persona: objetivo del proyecto, resumen consolidado y lo que dijeron los demás. */
function proyContexto_(proyecto, waActual) {
  var p = proyBuscar_(proyecto) || { objetivo: '', resumen: '' };
  var otros = proyMensajes_(proyecto).filter(function (m) { return fin8_(m.wa) !== fin8_(waActual); }).slice(-40)
    .map(function (m) { return (m.quien === 'alma' ? 'ALMA → ' + m.persona : m.persona) + ': ' + m.texto; }).join('\n');
  return ('PROYECTO: ' + proyecto + (p.objetivo ? '\nOBJETIVO GENERAL:\n' + p.objetivo : '') + (p.resumen ? '\n\nLO QUE YA SE SABE (resumen consolidado):\n' + p.resumen : '') +
    (otros ? '\n\nCONVERSACIONES CON OTRAS PERSONAS DEL PROYECTO:\n' + otros : '')).slice(0, 6000);
}
/* Rehace el resumen consolidado con todas las conversaciones del proyecto. */
function proyActualizarResumen_(proyecto, de) {
  var p = proyBuscar_(proyecto); if (!p) return '';
  var msgs = proyMensajes_(proyecto).slice(-120).map(function (m) { return (m.quien === 'alma' ? 'ALMA → ' + m.persona : m.persona) + ': ' + m.texto; }).join('\n');
  if (!msgs) return p.resumen;
  var sys = 'Consolidas la información de un proyecto personal de ' + (de || 'Juan') + ' reunida por su asistente en varias conversaciones de WhatsApp. ' +
    'Escribe un resumen ordenado por temas (no por persona), en viñetas «· », con fechas, horas, números y quién dijo cada dato cuando importe. ' +
    'Marca con ⚠ los datos que se contradicen entre personas y al final una sección «Falta» con lo que aún no se sabe según el objetivo. Sin introducción.';
  var res = '';
  try { res = String(claude_(CFG.MODELO_REDACTOR, 1100, sys, 'PROYECTO: ' + proyecto + '\nOBJETIVO:\n' + (p.objetivo || '(sin objetivo escrito)') + '\n\nRESUMEN ANTERIOR:\n' + (p.resumen || '(ninguno)') + '\n\nMENSAJES:\n' + msgs, 0.2) || '').trim(); } catch (e) {}
  if (res) hojaProy_().getRange(p.fila, 5, 1, 3).setValues([[res.slice(0, 8000), p.estado, new Date().toISOString()]]);
  return res || p.resumen;
}
function proyLista_() {
  var porProy = {};
  try { var m = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}'); Object.keys(m).forEach(function (k) { var r = m[k]; if (r.proy && r.hasta > Date.now()) (porProy[r.proy] = porProy[r.proy] || []).push(r.nombre); }); } catch (e) {}
  return proyFilas_().filter(function (p) { return p.estado !== 'cerrado'; }).map(function (p) { return { proyecto: p.proyecto, personas: porProy[p.proyecto] || [], objetivo: p.objetivo.slice(0, 200), tiene_resumen: !!p.resumen }; });
}
function proyVer_(nombre, rehacer, de) {
  var p = proyBuscar_(nombre); if (!p) return { error: 'No encontré el proyecto «' + nombre + '».' };
  var res = rehacer ? proyActualizarResumen_(p.proyecto, de) : p.resumen;
  var personas = {}; proyMensajes_(p.proyecto).forEach(function (m) { if (m.persona) personas[m.persona] = 1; });
  return { proyecto: p.proyecto, objetivo: p.objetivo, personas: Object.keys(personas), resumen: res || '(todavía sin resumen)' };
}
function proyCerrar_(nombre) {
  var p = proyBuscar_(nombre); if (!p) return { error: 'No encontré el proyecto «' + nombre + '».' };
  hojaProy_().getRange(p.fila, 6).setValue('cerrado'); return { ok: true, proyecto: p.proyecto };
}
/* Robot / herramienta: pasar una conversación ya iniciada a un proyecto (copia su historial al proyecto). */
function proyAsignar_(adm, wa, proyecto, objetivo) {
  var P = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(P.getProperty('WA_RELAY') || '{}'); } catch (e) {}
  var r = m[fin8_(wa)]; if (!r) return { error: 'No hay conversación personal reciente con ese número.' };
  var nom = proyAsegurar_(adm, proyecto, objetivo);
  if (r.proy !== nom) (r.h || []).forEach(function (x) { proyNotar_(nom, r.nombre, r.wa, x.q === 'alma' ? 'alma' : 'persona', x.t); });
  r.proy = nom; P.setProperty('WA_RELAY', JSON.stringify(m));
  return { ok: true, proyecto: nom, persona: r.nombre, mensajes: (r.h || []).length };
}
