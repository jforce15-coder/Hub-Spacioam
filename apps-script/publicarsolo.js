/* ═══════════════════════════════ Unir = publicar (18-nov-2026) ═══════════════════════════════
   Lo que se une a main en el Hub, Docs, Hola, Epi o Mi se publica solo en alma@ con el workflow «Traslado a Workspace»
   (.github/workflows/traslado.yml). El horario de GitHub no basta (el 18-nov pasaron 12 h sin correr) y los repos de las
   apps no tienen una llave para pedírselo al Hub, así que lo pide el Hub:
   - mira la huella (árbol de git) de la carpeta de cada app con «sincronizar» en traslado/proyectos.json, en main;
   - si alguna cambió desde la última vez, le pide a GitHub que corra el Traslado (repository_dispatch «publicar»);
   - mira cada 5 min desde procesarCola y al instante cuando el «Publicar Apps Script» de una app avisa al unir
     (doPost { publicarAviso: 1 }, sin llave: el aviso solo hace mirar; si GitHub no cambió, no pasa nada).
   Una llamada a GitHub por app cada vez; la lista de apps se guarda 6 h. Usa las llaves de GitHub del Hub (paraAlmaGh_).
   Ahorro (19-nov-2026, era 1 488 llamadas al día): las huellas de todas las apps salen en UNA llamada (GraphQL, la misma
   huella que da la lista de la carpeta; si falla, la de antes: una por app) y procesarCola mira cada CUPO_PUBLICAR_MIN
   (30 min; antes 5). El aviso de una app sigue mirando al instante y, si GitHub aún no muestra lo unido, procesarCola
   vuelve a mirar cada minuto hasta PUB_SOLO_PRONTO_ veces. */
var PUB_SOLO_PROP_ = 'PUBLICAR_HUELLAS';
var PUB_SOLO_PRONTO_ = 3;
var PUB_SOLO_HUB_ = 'Hub-Spacioam';
function pubSoloCadaMs_() { try { return cupoIntervalo_('CUPO_PUBLICAR_MIN') * 60000; } catch (e) { return 30 * 60000; } }

function pubSoloDueno_() { try { return PropertiesService.getScriptProperties().getProperty('GITHUB_DUENO') || UNIR_DUENO_; } catch (e) { return UNIR_DUENO_; } }

function pubSoloGet_(ruta) {
  var r = paraAlmaGh_('GET', ruta);
  if (r.code !== 200 || !r.json) throw new Error('GitHub ' + r.code + ' ' + ruta);
  return r.json;
}

/* { nombre: 'repo:carpeta' } de las apps con «sincronizar» (traslado/proyectos.json en main del Hub), 6 h en caché. */
function pubSoloProyectos_(dueno) {
  var c = CacheService.getScriptCache(), g = c.get('pub_solo_proy');
  if (g) { try { return JSON.parse(g); } catch (e) {} }
  var j = pubSoloGet_('/repos/' + dueno + '/' + PUB_SOLO_HUB_ + '/contents/traslado/proyectos.json?ref=main');
  var cfg = JSON.parse(Utilities.newBlob(Utilities.base64Decode(String(j.content || '').replace(/\s/g, ''))).getDataAsString() || '{}'), out = {};
  Object.keys(cfg).forEach(function (k) { if (k.charAt(0) !== '_' && cfg[k] && cfg[k].sincronizar) out[k] = cfg[k].repo + ':' + cfg[k].carpeta; });
  c.put('pub_solo_proy', JSON.stringify(out), 21600);
  return out;
}

/* Huella (árbol de git) de la carpeta en main: la da la lista de su carpeta madre (una llamada por app). */
function pubSoloHuella_(dueno, repo, carpeta) {
  var partes = String(carpeta).split('/'), nombre = partes.pop();
  var lista = pubSoloGet_('/repos/' + dueno + '/' + repo + '/contents' + partes.map(function (x) { return '/' + encodeURIComponent(x); }).join('') + '?ref=main');
  for (var i = 0; i < (lista.length || 0); i++) if (lista[i].name === nombre && lista[i].type === 'dir') return lista[i].sha;
  return '';
}

/* Las huellas de todas las apps en una sola llamada (GraphQL: el árbol de git de «main:carpeta», el mismo sha que da la
   lista de la carpeta madre). null si GitHub no respondió bien: entonces se mira como antes, una por app. */
function pubSoloHuellasJuntas_(dueno, proy) {
  var ks = Object.keys(proy); if (!ks.length) return {};
  var q = '{ ' + ks.map(function (k, i) {
    var x = proy[k].split(':');
    return 'a' + i + ': repository(owner: ' + JSON.stringify(dueno) + ', name: ' + JSON.stringify(x[0]) + ') { object(expression: ' + JSON.stringify('main:' + x[1]) + ') { oid } }';
  }).join(' ') + ' }';
  var r = paraAlmaGh_('POST', '/graphql', { query: q });
  if (r.code !== 200 || !r.json || !r.json.data) return null;
  var out = {};
  ks.forEach(function (k, i) { var o = r.json.data['a' + i]; if (o && o.object && o.object.oid) out[k] = String(o.object.oid); });
  return out;
}

/* Mira las huellas y, si cambió alguna, pide la publicación. forzar: sin esperar (el aviso de una app). */
function pubSoloRevisar_(forzar) {
  var p = PropertiesService.getScriptProperties(), ahora = Date.now(), pronto = Number(p.getProperty('PUBLICAR_PRONTO') || 0);
  if (!forzar && ahora - Number(p.getProperty('PUBLICAR_MIRADO') || 0) < (pronto > 0 ? 50000 : pubSoloCadaMs_())) return { ok: true, mirado: false };
  p.setProperty('PUBLICAR_MIRADO', String(ahora));
  if (!forzar && pronto > 0) p.setProperty('PUBLICAR_PRONTO', String(pronto - 1));
  var dueno = pubSoloDueno_(), proy = pubSoloProyectos_(dueno), ahoraH = null;
  try { ahoraH = pubSoloHuellasJuntas_(dueno, proy); } catch (e) { console.error('pubSoloHuellasJuntas_: ' + e); }
  if (!ahoraH) {
    ahoraH = {};
    Object.keys(proy).forEach(function (k) {
      var x = proy[k].split(':');
      try { var h = pubSoloHuella_(dueno, x[0], x[1]); if (h) ahoraH[k] = h; } catch (e) { console.error('pubSoloHuella_ ' + k + ': ' + e); }
    });
  }
  var antes = {}; try { antes = JSON.parse(p.getProperty(PUB_SOLO_PROP_) || '{}') || {}; } catch (e) {}
  var cambiaron = Object.keys(ahoraH).filter(function (k) { return antes[k] !== ahoraH[k]; });
  if (!cambiaron.length) return { ok: true, cambiaron: [] };
  var r = paraAlmaGh_('POST', '/repos/' + dueno + '/' + PUB_SOLO_HUB_ + '/dispatches', { event_type: 'publicar', client_payload: { cambiaron: cambiaron } });
  if (r.code !== 204) { console.error('pubSoloRevisar_: GitHub ' + r.code); return { ok: false, error: 'GitHub ' + r.code, cambiaron: cambiaron }; }
  Object.keys(ahoraH).forEach(function (k) { antes[k] = ahoraH[k]; });
  p.setProperty(PUB_SOLO_PROP_, JSON.stringify(antes));   // solo si GitHub tomó el pedido: si no, la siguiente vuelta reintenta
  return { ok: true, cambiaron: cambiaron, pedido: true };
}

/* doPost { publicarAviso: 1 }: el «Publicar Apps Script» de una app acaba de recibir un cambio en main. Sin llave a
   propósito (los repos son públicos y no tienen una): solo adelanta la revisión; como mucho una cada 20 s. */
function pubSoloAviso_() {
  var c = CacheService.getScriptCache(); if (c.get('pub_solo_aviso')) return { ok: true, espera: true };
  c.put('pub_solo_aviso', '1', 20);
  var r; try { r = pubSoloRevisar_(true); } catch (e) { r = { ok: false, error: String(e).slice(0, 200) }; }
  /* GitHub puede tardar unos segundos en mostrar lo recién unido (18-nov: el aviso de Docs vio la carpeta de antes): si no vio
     nada nuevo, procesarCola vuelve a mirar cada minuto (hasta PUB_SOLO_PRONTO_ veces) en vez de esperar 30. */
  try { var p = PropertiesService.getScriptProperties(); if (!r.pedido) { p.setProperty('PUBLICAR_MIRADO', '0'); p.setProperty('PUBLICAR_PRONTO', String(PUB_SOLO_PRONTO_)); } else p.setProperty('PUBLICAR_PRONTO', '0'); } catch (e) {}
  return r;
}
