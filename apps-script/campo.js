/* ═══ ALMA EN UN CUADRO DE TEXTO (navegador de la app de Alma) ═══════════════════════════════════════════════
   Con un cuadro de texto activo en cualquier página, dos toques a Alma: mejora lo que hay escrito o escribe lo que le
   pidas por voz. La app escucha (en el teléfono), manda aquí el texto del cuadro y el pedido, y pone la respuesta en el
   cuadro. Sin texto y sin pedido, la app dice «¿En qué te ayudo?» con la voz de Alma (que = 'saludo').
   Con la dirección y la captura de la pantalla (b.url, b.captura), Alma entiende dónde está: puede escribir en el cuadro
   («campo») o contestarte en voz («decir», con su audio). Cada vez queda en el hilo con Alma, así entra a su área de vida.
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
  var url = String(b.url || '').slice(0, 500);
  if (!texto.trim() && !pedido) return { ok: false, error: 'vacio' };
  /* Lo que se ve en la pantalla (captura del navegador): el Hub la lee para que Alma ayude con ese contexto. */
  var vista = '';
  if (b.captura) { try { var f = almaFoto_(ses, b.captura, true); vista = f && f.ok ? f.texto : ''; } catch (e) { console.error('campo captura: ' + e); } }
  var donde = [b.pagina ? 'Página: ' + String(b.pagina).slice(0, 200) : '', url ? 'Dirección: ' + url : '', b.etiqueta ? 'Cuadro: ' + String(b.etiqueta).slice(0, 120) : '',
    vista ? 'Lo que se ve en la pantalla: ' + vista : ''].filter(String).join('\n');
  var nombre = String(adm.nombre || 'Juan').split(' ')[0];
  var sys = 'Eres Alma, la asistente de ' + nombre + '. Está en una página web, con un cuadro de texto activo, y te pidió ayuda tocándote dos veces. ' +
    'Tienes la página, la dirección, lo que se ve en la pantalla y el texto del cuadro. Decide qué necesita:\n' +
    '· Si quiere algo escrito en el cuadro (redactar, corregir, traducir, acortar, cambiar el tono, llenar una búsqueda), ponlo en "campo". Usa el texto del cuadro como base cuando exista. ' +
    'Sin pedido, mejora el texto: ortografía, gramática y claridad, mismo idioma, tono y sentido, sin alargarlo. Si el cuadro es corto (búsqueda, nombre, asunto), responde corto.\n' +
    '· Si pregunta algo o necesita una guía (qué hacer en esta página, qué significa algo de la pantalla), contesta en "decir": corto, cálido, para escucharlo (1 a 3 frases), y deja "campo" vacío si no hay nada que escribir.\n' +
    'Responde SOLO un JSON: {"campo":"texto final para el cuadro o vacío","decir":"lo que dices en voz o vacío"}. En "campo" nunca expliques ni saludes.';
  var u = (donde ? donde + '\n\n' : '') + 'Texto del cuadro:\n' + (texto.trim() ? texto : '(vacío)') + '\n\nPedido: ' + (pedido || '(ninguno: mejóralo)');
  var r = ''; try { r = claude_(CFG.MODELO_REDACTOR, 1400, sys, u, 0.3, []); } catch (e) { console.error('campo: ' + e); }
  var j = {}; try { j = JSON.parse(String(r || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) { j = { campo: String(r || '') }; }
  var campo = String(j.campo || '').trim().replace(/^["«“]|["»”]$/g, ''), decir = String(j.decir || '').trim();
  if (!campo && !decir) return { ok: false, error: 'No pude escribirlo ahora.' };
  /* La conversación queda en el hilo con Alma (y así entra a su área de vida, como todas). */
  try {
    var contexto = '[En ' + (b.pagina || url || 'una página') + (url ? ' · ' + url : '') + ', cuadro «' + (b.etiqueta || 'de texto') + '»' + (vista ? '; en pantalla: ' + vista.slice(0, 600) : '') + ']';
    opGuardar_(adm, 'yo', 'app', (pedido || (texto.trim() ? 'Mejora este texto: ' + texto.slice(0, 800) : '¿Me ayudas?')) + '\n' + contexto);
    opGuardar_(adm, 'alma', 'app', [decir, campo ? 'Escribí en el cuadro: ' + campo.slice(0, 1500) : ''].filter(String).join('\n'));
  } catch (e) { console.error('campo op: ' + e); }
  var audio = ''; if (decir) { try { audio = vozTts_(decir); } catch (e) {} }
  return { ok: true, texto: campo, decir: decir, audio: audio };
}
