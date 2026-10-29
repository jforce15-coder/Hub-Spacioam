/* ═══ ALMA EN UN CUADRO DE TEXTO (navegador de la app de Alma) ═══════════════════════════════════════════════
   Con un cuadro de texto activo en cualquier página, dos toques a Alma: mejora lo que hay escrito o escribe lo que le
   pidas por voz. La app escucha (en el teléfono), manda aquí el texto del cuadro y el pedido, y pone la respuesta en el
   cuadro. Sin texto y sin pedido, la app dice «¿En qué te ayudo?» con la voz de Alma (que = 'saludo').
   Solo administradores (los mismos que hablan con Alma por voz). */

function mejorarCampo_(ses, b) {
  var adm = null; try { adm = vozWebAdmin_(ses); } catch (e) {}
  if (!adm) return { ok: false, error: 'usuario' };
  if (b.que === 'saludo') {
    var c = CacheService.getScriptCache(), hit = c.get('campo_saludo');
    if (hit) return { ok: true, audio: hit };
    var a = ''; try { a = vozTts_('¿En qué te ayudo?'); } catch (e) {}
    if (a && a.length < 95000) c.put('campo_saludo', a, 21600);
    return { ok: true, audio: a };
  }
  var texto = String(b.texto || '').slice(0, 6000), pedido = String(b.pedido || '').trim().slice(0, 1500);
  if (!texto.trim() && !pedido) return { ok: false, error: 'vacio' };
  var donde = [b.pagina ? 'Página: ' + String(b.pagina).slice(0, 200) : '', b.etiqueta ? 'Cuadro: ' + String(b.etiqueta).slice(0, 120) : ''].filter(String).join('\n');
  var sys = 'Eres Alma, la asistente de ' + (String(adm.nombre || 'Juan').split(' ')[0]) + '. Te pide ayuda con el texto de un cuadro de una página web. ' +
    'Si hay un pedido, cúmplelo (redactar, corregir, traducir, acortar, cambiar el tono…) usando el texto del cuadro como base cuando exista. ' +
    'Sin pedido, mejora el texto: corrige ortografía y gramática, hazlo claro y natural, con el mismo idioma, tono y sentido, sin alargarlo. ' +
    'Si el cuadro es una búsqueda o un campo corto (nombre, asunto, dirección), responde corto. ' +
    'Responde SOLO con el texto final que va dentro del cuadro: sin comillas, sin explicaciones, sin saludos.';
  var u = (donde ? donde + '\n\n' : '') + 'Texto del cuadro:\n' + (texto.trim() ? texto : '(vacío)') + '\n\nPedido: ' + (pedido || '(ninguno: mejóralo)');
  var r = ''; try { r = claude_(CFG.MODELO_REDACTOR, 1200, sys, u, 0.3, []); } catch (e) { console.error('campo: ' + e); }
  r = String(r || '').trim().replace(/^["«“]|["»”]$/g, '');
  return r ? { ok: true, texto: r } : { ok: false, error: 'No pude escribirlo ahora.' };
}
