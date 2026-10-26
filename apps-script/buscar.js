/* ═══ BÚSQUEDA FLEXIBLE ═══════════════════════════════════════════════════════════════════════════
   Nombres y propiedades llegan mal escritos, sobre todo por voz o nota de voz: «Brunello» por «Brunelo»,
   «Erika» por «Ericka», «Cuba» por «Kuba», un número de apartamento con un dígito cambiado. Aquí se comparan
   por sonido (español) y con tolerancia a una o dos letras, y se ordenan los resultados por parecido.
   Lo usan: buscar_reservas y ver_propiedad (secretaria), opMatch_ (personas, propiedades, técnicos) y la
   validación de reservas por voz. */

/* Texto → palabras normalizadas: sin acentos ni signos, «zona 10» → «z10». */
function bqPalabras_(s) {
  var t = String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\bzona\s*(\d+)/g, 'z$1').replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');
  t = t.replace(/\bz (\d+)/g, 'z$1');
  /* Números en letras desde diez («Bonadiez», «Bona diez», «Andares doce») → dígitos (los menores son nombres comunes: «Tres Marías»). */
  t = t.replace(/[a-zñ]+/g, function (w) {
    if (BQ_NUM_[w] != null) return String(BQ_NUM_[w]);
    var m = w.match(BQ_NUM_FIN_); return m && w.length > m[1].length + 2 ? w.slice(0, -m[1].length) + ' ' + BQ_NUM_[m[1]] : w;
  });
  t = t.replace(/\bzona\s*(\d+)/g, 'z$1');
  return t.replace(/[^a-z0-9ñ]+/g, ' ').trim().split(' ').filter(function (w) { return w && ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'apto', 'apartamento', 'edificio'].indexOf(w) < 0; });
}

var BQ_NUM_ = { diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50 };
var BQ_NUM_FIN_ = /(diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta)$/;
/* Cómo suena una palabra en español: ck/qu/c dura → k, z/ce/ci → s, v → b, h muda, y/ll → i, sin letras dobles. */
function bqSonido_(w) {
  if (/^\d+$/.test(w) || /^z\d+$/.test(w)) return w;
  return w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'k').replace(/c([ei])/g, 's$1').replace(/c/g, 'k').replace(/z/g, 's')
    .replace(/w/g, 'u').replace(/v/g, 'b').replace(/y/g, 'i').replace(/ñ/g, 'n').replace(/x/g, 'ks')
    .replace(/h/g, '').replace(/(.)\1+/g, '$1');
}

function bqLev_(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  var prev = [], i, j; for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    var cur = [i], minFila = i;
    for (j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      if (cur[j] < minFila) minFila = cur[j];
    }
    if (minFila > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* Parecido entre una palabra buscada y una del registro (0 a 1). */
function bqPalabraSim_(q, t) {
  if (q === t) return 1;
  var dq = /^\d+$/.test(q), dt = /^\d+$/.test(t);
  if (dq || dt) {   // números de apartamento: exactos, o un dígito distinto con el mismo largo
    if (!(dq && dt)) return 0;
    return q.length >= 3 && q.length === t.length && bqLev_(q, t, 1) <= 1 ? 0.6 : 0;
  }
  var sq = bqSonido_(q), st = bqSonido_(t);
  if (sq === st) return 0.95;
  if (sq.length >= 3 && st.indexOf(sq) === 0) return 0.85;   // «brun» → «brunelo»
  var d = bqLev_(sq, st, 2);
  if (d <= 1 && sq.length >= 4) return 0.8;
  if (d <= 2 && sq.length >= 7) return 0.7;
  return 0;
}

/* Puntaje de un registro para una búsqueda: promedio del mejor parecido de cada palabra buscada.
   todas = cada palabra encontró pareja (≥ 0.6). */
function bqPuntaje_(busqueda, texto) {
  var qs = bqPalabras_(busqueda), ts = bqPalabras_(texto);
  if (!qs.length) return { puntaje: 0, todas: false, halladas: 0, total: 0 };
  var suma = 0, halladas = 0;
  qs.forEach(function (q) {
    var mejor = 0; ts.forEach(function (t) { var s = bqPalabraSim_(q, t); if (s > mejor) mejor = s; });
    suma += mejor; if (mejor >= 0.6) halladas++;
  });
  var r = { puntaje: suma / qs.length, todas: halladas === qs.length, halladas: halladas, total: qs.length };
  /* Palabras pegadas o separadas distinto («Namericas» / «N Americas», «Casasol» / «Casa Sol»): se compara también sin espacios. */
  if (!r.todas) {
    var qc = qs.join(''), tc = ts.join('');
    if (qc.length >= 5 && (tc.indexOf(qc) >= 0 || bqLev_(bqSonido_(qc), bqSonido_(tc).slice(0, bqSonido_(qc).length), 1) <= 1)) r = { puntaje: 0.9, todas: true, halladas: qs.length, total: qs.length };
  }
  return r;
}

/* Busca en una lista. Primero los que cumplen todas las palabras; si no hay, los que cumplen la mayoría.
   Devuelve [{ item, puntaje, coincidencia: 'exacta' | 'aproximada' }] ordenado de más a menos parecido. */
function bqBuscar_(busqueda, items, textoDe, max) {
  var res = items.map(function (it) { var tx = textoDe(it), p = bqPuntaje_(busqueda, tx); p.item = it; p.largo = String(tx || '').length; return p; });
  var todas = res.filter(function (r) { return r.todas; });
  var lista = todas.length ? todas : res.filter(function (r) { return r.total >= 2 && r.halladas / r.total >= 0.6 && r.puntaje >= 0.5; });
  lista.sort(function (a, b) { return (b.puntaje - a.puntaje) || (a.largo - b.largo); });
  return lista.slice(0, max || 12).map(function (r) { return { item: r.item, puntaje: Math.round(r.puntaje * 100) / 100, coincidencia: r.todas && r.puntaje >= 0.99 ? 'exacta' : 'aproximada' }; });
}

/* El nombre de la lista que más se parece (para personas, propiedades, técnicos). '' si nada se parece lo suficiente. */
function bqMejor_(busqueda, lista) {
  var r = bqBuscar_(busqueda, lista, function (x) { return x; }, 2);
  if (!r.length || r[0].puntaje < 0.7) return '';
  if (r.length > 1 && r[1].puntaje === r[0].puntaje && r[0].puntaje < 0.99) return '';   // empate: mejor no adivinar
  return r[0].item;
}
