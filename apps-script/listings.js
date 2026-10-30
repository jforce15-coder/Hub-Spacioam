/* ═══ LISTINGS · comparar dos propiedades de Hospitable (solo lectura) ═══════════════════════════════════════════
   Pedido: unificar la información de Z14P14703 y Z14P14703A. La API pública de Hospitable (v2) no ofrece un endpoint
   para escribir los datos de una propiedad (solo lectura de /properties y escritura de calendario/mensajes), así que
   ALMA NO modifica nada: esta función dice cuál listing está más completo y qué campos faltan o difieren, para copiarlos
   a mano en Hospitable. Se ejecuta desde el editor del script: compararListings_('Z14P14703', 'Z14P14703A'). */

function listingsPlano_(o, pre, out) {
  out = out || {};
  Object.keys(o || {}).forEach(function (k) {
    var v = o[k], ruta = pre ? pre + '.' + k : k;
    if (/(^|\.)(id|uuid|created_at|updated_at|platform_id|listings)$/.test(ruta)) return;
    if (v && typeof v === 'object' && !Array.isArray(v)) listingsPlano_(v, ruta, out);
    else out[ruta] = v;
  });
  return out;
}
function listingsLleno_(v) { return !(v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)); }

function listingsBuscar_(codigo) {
  var cod = String(codigo).trim().toLowerCase(), pag = 1, hallado = null;
  while (!hallado && pag <= 20) {
    var r = hosp_('get', '/properties?per_page=100&page=' + pag), d = (r.json && r.json.data) || [];
    if (r.code !== 200) throw new Error('Hospitable respondió ' + r.code + ' al listar propiedades (¿falta HOSPITABLE_TOKEN?)');
    hallado = d.filter(function (p) { return [p.name, p.public_name, p.nickname].some(function (n) { return String(n || '').trim().toLowerCase() === cod; }); })[0];
    if (d.length < 100) break;
    pag++;
  }
  if (!hallado) throw new Error('No encontré la propiedad ' + codigo + ' en Hospitable.');
  var p = hosp_('get', '/properties/' + hallado.id);
  return (p.json && p.json.data) || hallado;
}

function compararListings_(codA, codB) {
  var pa = listingsPlano_(listingsBuscar_(codA)), pb = listingsPlano_(listingsBuscar_(codB));
  var claves = Object.keys(pa).concat(Object.keys(pb)).filter(function (k, i, a) { return a.indexOf(k) === i; }).sort();
  var llenosA = 0, llenosB = 0, faltanEnA = [], faltanEnB = [], distintos = [];
  claves.forEach(function (k) {
    var a = listingsLleno_(pa[k]), b = listingsLleno_(pb[k]);
    if (a) llenosA++; if (b) llenosB++;
    if (a && !b) faltanEnB.push(k); else if (b && !a) faltanEnA.push(k);
    else if (a && b && JSON.stringify(pa[k]) !== JSON.stringify(pb[k])) distintos.push(k);
  });
  var res = { ok: true, mas_completo: llenosA === llenosB ? 'igual' : (llenosA > llenosB ? codA : codB), campos_llenos: {}, faltan_en_A: faltanEnA, faltan_en_B: faltanEnB, distintos: distintos };
  res.campos_llenos[codA] = llenosA; res.campos_llenos[codB] = llenosB;
  Logger.log(JSON.stringify(res, null, 1));
  return res;
}
