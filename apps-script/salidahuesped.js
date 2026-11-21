/* ═══ SALIDA AL HUÉSPED: el razonamiento interno de Alma nunca sale (18-nov-2026) ═══════════════════════════════════════
   Un huésped de una consulta recibió el análisis interno de Alma («El huésped está pidiendo… Según la base de conocimiento,
   ALMA no puede aprobar… la reserva no está confirmada…», luego «---» y recién la respuesta). El modelo escribió su análisis
   en el campo de la respuesta y nada lo revisaba antes de mandarlo.
   Por la pirámide (docs/PIRAMIDE.md, escalón 1) la revisión no vive en cada camino que redacta, sino en la puerta por la que
   sale TODO mensaje a un huésped: hosp_ (Hospitable: reservas, consultas y programados), waResponder_ y adjEnviarWa_
   (WhatsApp del huésped) y redesEnviar_ (Instagram y Messenger). Un camino nuevo que redacte para un huésped pasa solo.
   · salidaHuesped_(texto) → { ok, texto, recortado, motivo }.
     - Sin señales de razonamiento: sale igual, sin tocar ni un carácter.
     - Con análisis antes de un separador («---», «***», «___», «===») o de un rótulo («Respuesta al huésped:») y la parte
       final limpia: sale SOLO la parte final (recorte limpio).
     - Si no se puede separar: no sale (ok = false). Quien llama recibe { code: 422, bloqueado: 'razonamiento' }; la cola
       deja la fila en «borrador» (revisión) y el aviso va a Pendientes (salidaHuespedAvisar_).
   · Las señales son frases que Alma nunca le diría a un huésped: habla de él en tercera persona («el huésped está
     pidiendo», «el usuario quiere»), cita sus fuentes o reglas («según la base de conocimiento», «mis instrucciones»,
     «system prompt»), habla de sí misma en tercera persona («ALMA no puede»), nombra herramientas o trae rótulos de análisis
     («Análisis:», «Razonamiento:», <thinking>). Prueba: .github/salida-huesped.js. */
var SALIDA_H_SEP_ = /^[ \t]*(?:-{3,}|\*{3,}|_{3,}|={3,}|—{2,}|–{3,})[ \t]*$/m;
var SALIDA_H_ROTULO_ = /^[ \t]*(?:\*\*)?(?:respuesta(?: final)?(?: (?:al|para el) (?:hu[eé]sped|cliente|interesad[oa]))?|mensaje (?:al|para el) (?:hu[eé]sped|cliente)|borrador(?: final)?|texto (?:a enviar|final)|final (?:answer|response|reply)|reply|response(?: to (?:the )?guest)?|message to (?:the )?guest)(?:\*\*)?[ \t]*:[ \t]*(?:\*\*)?[ \t]*(?:\n|$)/im;
var SALIDA_H_SENALES_ = [
  { m: 'habla del huésped en tercera persona', rx: /\b(?:el|la|este|esta)\s+(?:hu[eé]sped|usuario|usuaria|cliente|interesad[oa]|prospecto)\s+(?:est[aá]\s+(?:pidiendo|preguntando|solicitando|diciendo|escribiendo|consultando|buscando|intentando|confirmando|reclamando)|pide|pregunta|solicita|quiere|dice|escribe|menciona|consulta|necesita|indica|plantea|busca|desea|parece|ya\s+(?:tiene|pag[oó]|reserv[oó]))\b/i },
  { m: 'habla del huésped en tercera persona', rx: /\bthe\s+(?:guest|user|customer)\s+(?:is\s+(?:asking|requesting|saying|writing|trying|looking)|asks|wants|says|mentions|needs|requests|seems)\b/i },
  { m: 'cita su base de conocimiento o sus reglas', rx: /\b(?:seg[uú]n|de acuerdo (?:con|a)|conforme a)\s+(?:la|mi|mis|las|nuestra|nuestras|el)\s+(?:base de conocimiento|instrucciones|reglas|prompt|pol[ií]tica interna)\b|\bbase de conocimiento\b|\bknowledge base\b|\b(?:mis|las) instrucciones (?:dicen|indican|del sistema|me piden)\b|\bsystem prompt\b|\b(?:el|mi) prompt\b|\b(?:my|the) instructions (?:say|state|tell)\b/i },
  { m: 'habla de sí misma en tercera persona', rx: /\bALMA\b|\bAlma\s+(?:no\s+(?:puede|debe|deber[ií]a|tiene que)|debe|deber[ií]a)\b/ },
  { m: 'decide qué responder en voz alta', rx: /\b(?:debo|deber[ií]a|tengo que|voy a|conviene)\s+(?:responder(?:le)?|contestar(?:le)?|escribir(?:le)?|decirle|explicarle|aclararle)\b|\b(?:I|we)\s+(?:should|need to|must|will)\s+(?:reply|respond|answer|tell (?:him|her|them))\b/i },
  { m: 'nombra una herramienta o un marcador interno', rx: /\b(?:usar|uso|llamo|llamar|invoco|invocar|con)\s+la\s+herramienta\b|\btool[_ ](?:use|call|result)\b|\bfunction[_ ]call\b|<\/?(?:thinking|analysis|reasoning|scratchpad)>/i },
  { m: 'trae un rótulo de análisis', rx: /^[ \t]*(?:\*\*)?(?:an[aá]lisis|razonamiento|pensamiento|nota interna|notas internas|contexto interno|reasoning|analysis|thinking|internal note)(?:\*\*)?[ \t]*:/im }
];
function salidaHuespedSenal_(t) {
  t = String(t || '');
  for (var i = 0; i < SALIDA_H_SENALES_.length; i++) if (SALIDA_H_SENALES_[i].rx.test(t)) return SALIDA_H_SENALES_[i].m;
  return '';
}
function salidaHuespedLimpio_(t) { t = String(t || '').trim(); return t.replace(/[\s.,;:·—\-–()\[\]"'«»*_]/g, '').length >= 12 && !salidaHuespedSenal_(t); }
function salidaHuesped_(texto) {
  var t = String(texto == null ? '' : texto), motivo = salidaHuespedSenal_(t);
  if (!motivo) return { ok: true, texto: t, recortado: false, motivo: '' };
  /* 1) <thinking>…</thinking> completo: se quita el bloque. */
  var sinBloque = t.replace(/<(thinking|analysis|reasoning|scratchpad)>[\s\S]*?<\/\1>/gi, '').trim();
  if (sinBloque !== t.trim() && salidaHuespedLimpio_(sinBloque)) return { ok: true, texto: sinBloque, recortado: true, motivo: motivo };
  /* 2) Análisis + separador + respuesta: sale lo que queda después del último separador. */
  var partes = t.split(new RegExp(SALIDA_H_SEP_.source, 'gm'));
  if (partes.length > 1) {
    var ultima = partes[partes.length - 1].trim();
    ultima = ultima.replace(new RegExp('^' + SALIDA_H_ROTULO_.source.slice(1), 'i'), '').trim();
    if (salidaHuespedLimpio_(ultima)) return { ok: true, texto: ultima, recortado: true, motivo: motivo };
  }
  /* 3) Análisis + rótulo («Respuesta al huésped:»): sale lo que sigue al último rótulo. */
  var rx = new RegExp(SALIDA_H_ROTULO_.source, 'gim'), m, corte = -1;
  while ((m = rx.exec(t))) { corte = m.index + m[0].length; if (!m[0].length) rx.lastIndex++; }
  if (corte > 0) {
    var tras = t.slice(corte).trim();
    if (salidaHuespedLimpio_(tras)) return { ok: true, texto: tras, recortado: true, motivo: motivo };
  }
  return { ok: false, texto: '', recortado: false, motivo: motivo };
}
/* La puerta: lo que devuelve el envío cuando no sale. Mismo formato que hosp_ ({ code, error }) y que WhatsApp ({ ok, code, error }). */
function salidaHuespedBloqueo_(motivo, destino, texto) {
  try { salidaHuespedAvisar_(destino, motivo, texto); } catch (e) { console.error('salidaHuespedAvisar_: ' + e); }
  console.error('salida al huésped bloqueada (' + motivo + ') · ' + destino);
  var error = 'no se mandó: el texto traía razonamiento interno de Alma (' + motivo + '). Quedó en revisión.';
  return { ok: false, code: 422, bloqueado: 'razonamiento', error: error, json: { message: error } };
}
/* Aviso a Pendientes (no a WhatsApp: nada salió y nadie corre), uno por texto cada 30 min: el mismo borrador que se intenta
   por dos caminos (el programado y el mensaje directo de una consulta) avisa una sola vez. */
function salidaHuespedClave_(texto) {
  var t = String(texto || '').replace(/\s+/g, ' ').slice(0, 600), h = 0;
  for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return 'salidah_' + (h >>> 0).toString(36) + '_' + t.length;
}
function salidaHuespedAvisar_(destino, motivo, texto) {
  var cache = null, k = salidaHuespedClave_(texto);
  try { cache = CacheService.getScriptCache(); if (cache.get(k)) return; cache.put(k, '1', 1800); } catch (e) {}
  avisarAdmins_('ALMA · respuesta retenida (razonamiento interno)',
    'No le mandé este mensaje al huésped porque traía mi análisis interno (' + motivo + ') y no pude separar la respuesta.\n' +
    'Conversación: ' + destino + '\nRevísalo y respóndele tú desde el Hub.\n\nTexto retenido:\n' + String(texto || '').slice(0, 1500), false);
}
