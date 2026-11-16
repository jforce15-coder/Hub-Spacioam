/* Prueba de «Pendientes que importan» en la voz (apps-script/retomar.js, #607 T-A) con dobles: sin Google ni IA.
   1. El saludo nunca ofrece pendientes (saludo vacío) y el bloque dice que no los ofrezca ni insista.
   2. Urgente = importancia 3, de las últimas 24 h, no de desarrollo, ofrecido en menos de 2 llamadas: va primero y es el
      único que se menciona (id para contarlo al empezar la llamada). Con 2 llamadas ofrecido, deja de ser urgente.
   3. Sin urgente: «no los menciones»; los demás solo si pregunta.
   4. Se quita lo que ya no aplica: desarrollo de más de 48 h, el repetido del mismo cambio (vale el más nuevo) y lo no
      urgente de más de 3 días. Lo de desarrollo nunca es urgente.
   5. retQuitarRef_: al unirse o cerrarse un cambio, su tema por retomar sale (y sin candado si no hay ninguno).
   6. La ficha de la llamada: vozWebInicio_ ya no cambia el saludo y guarda el urgente para contarlo; paraclaude.js guarda
      la referencia del microproyecto y microGuardar_ la quita al unir; las novedades de desarrollo solo si pregunta.
   node .github/pendientes-voz.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const AHORA = Date.parse('2026-11-16T22:00:00Z'), H = 3600000;
function caja(lista) {
  const props = {}, locks = { n: 0 };
  const jefe = { email: 'juan@spacioam.com', principal: true, nombre: 'Juan' };
  const ctx = {
    console: { log() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp,
    Date: class extends Date { constructor(...a) { if (!a.length) super(AHORA); else super(...a); } static now() { return AHORA; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: (k) => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { locks.n++; }, releaseLock() {} }) },
    Utilities: { base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64'), computeDigest: (a, s) => Array.from(Buffer.from(String(s))), DigestAlgorithm: { MD5: 'md5' } },
    adminsOp_: () => [jefe], pendResolverRet_: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'retomar.js'), 'utf8'), ctx);
  if (lista) props[ctx.retClave_(jefe)] = JSON.stringify(lista);
  return { X: ctx, props, jefe, locks };
}
const it = (id, o) => Object.assign({ id, ts: AHORA - H, texto: 'Texto de ' + id, tema: 'el tema ' + id, imp: 2, veces: 0, ult: 0, origen: 'pendientes', ref: '' }, o || {});

/* 1 y 2 · urgente primero, saludo vacío */
{ const { X, jefe } = caja([it('a', { imp: 2 }), it('u', { imp: 3, texto: 'El huésped del 1104 espera respuesta por el cobro' }), it('b', { imp: 1, ts: AHORA - 5 * H })]);
  const f = X.retFicha_(jefe, 'Juan');
  ok(f && f.saludo === '', '1 · el saludo no ofrece pendientes (queda el normal)');
  ok(/NO los ofrezcas en el saludo ni insistas/.test(f.bloque), '1 · el bloque dice que no los ofrezca ni insista');
  ok(f.id === 'u' && /UNO ES URGENTE, el 1\)/.test(f.bloque) && /\n1\) el tema u:/.test(f.bloque), '2 · el urgente va primero y es el único que se menciona (su id para contarlo)');
  ok(/UNA sola vez en toda la llamada/.test(f.bloque) && /no lo vuelvas a sacar/.test(f.bloque), '2 · una sola vez por llamada y sin insistir');
  ok(/SOLO si él pregunta/.test(f.bloque), '3 · los demás solo si pregunta');
}
{ const { X } = caja();
  ok(!X.retUrgente_(it('x', { imp: 3, veces: 2 }), AHORA), '2 · ofrecido en 2 llamadas ya no es urgente');
  ok(!X.retUrgente_(it('x', { imp: 3, ts: AHORA - 25 * H }), AHORA), '2 · de hace más de 24 h ya no es urgente');
  ok(!X.retUrgente_(it('x', { imp: 3, origen: 'claude' }), AHORA), '4 · lo de desarrollo nunca es urgente');
  ok(X.retUrgente_(it('x', { imp: 3, veces: 1 }), AHORA), '2 · importancia 3, de hoy y ofrecido una vez: sigue urgente');
}
/* 3 · sin urgente */
{ const { X, jefe } = caja([it('a'), it('b')]);
  const f = X.retFicha_(jefe, 'Juan');
  ok(f.id === '' && /Ninguno es urgente: no los menciones/.test(f.bloque), '3 · sin urgente: no los menciona y no hay id que contar');
}
/* 4 · lo que ya no aplica */
{ const { X } = caja();
  const v = X.retVoz_([
    it('viejo_claude', { origen: 'claude', ts: AHORA - 49 * H, ref: 'm1' }),
    it('claude_viejo_mismo', { origen: 'claude', ts: AHORA - 5 * H, ref: 'm2' }),
    it('claude_nuevo_mismo', { origen: 'claude', ts: AHORA - 1 * H, ref: 'm2' }),
    it('no_urgente_viejo', { imp: 2, ts: AHORA - 4 * 24 * H }),
    it('urgente_viejo', { imp: 3, ts: AHORA - 4 * 24 * H }),
    it('vigente', { imp: 2 })
  ], AHORA);
  const ids = v.lista.map((x) => x.id), fuera = v.fuera.map((x) => x.id);
  ok(fuera.includes('viejo_claude'), '4 · desarrollo de más de 48 h no llega a la ficha');
  ok(fuera.includes('claude_viejo_mismo') && ids.includes('claude_nuevo_mismo'), '4 · del mismo cambio vale el más nuevo');
  ok(fuera.includes('no_urgente_viejo') && ids.includes('urgente_viejo'), '4 · lo no urgente de más de 3 días sale; lo de importancia 3 se queda (si pregunta)');
  ok(!v.urgente, '4 · uno de importancia 3 de hace 4 días no es urgente');
  ok(v.fuera.every((x) => x.motivo), '4 · cada uno que sale dice por qué');
}
{ const { X, jefe } = caja([it('c', { origen: 'claude', ts: AHORA - 50 * H })]);
  ok(X.retFicha_(jefe, 'Juan') === null, '4 · si no queda nada vigente, no hay bloque de pendientes');
}
/* 5 · retQuitarRef_ */
{ const { X, jefe, locks } = caja([it('a', { origen: 'claude', ref: 'm9' }), it('b')]);
  ok(X.retQuitarRef_('m9') === 1 && X.retLeer_(jefe).map((x) => x.id).join() === 'b', '5 · al unirse el cambio, su tema por retomar sale');
  const antes = locks.n; X.retQuitarRef_('otro');
  ok(locks.n === antes, '5 · sin ninguno de ese cambio, ni toma el candado');
}
/* 6 · el resto del Hub */
{ const voz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8'), pc = fs.readFileSync(path.join(DIR, 'paraclaude.js'), 'utf8'), mp = fs.readFileSync(path.join(DIR, 'microproyectos.js'), 'utf8');
  ok(/if \(ret\.id\) CacheService\.getScriptCache\(\)\.put\('vozret_' \+ adm\.email, ret\.id, 1200\)/.test(voz), '6 · vozWebInicio_ guarda el urgente para contarlo al empezar la llamada');
  ok(/ref: micro \? String\(micro\) : ''/.test(pc), '6 · el tema por retomar de desarrollo guarda su microproyecto');
  ok(/retQuitarRef_\(m\.id\)/.test(mp), '6 · microGuardar_ lo quita al unirse o cerrarse');
  ok(/SOLO si pregunta qué hay nuevo/.test(pc), '6 · las novedades de desarrollo, solo si pregunta');
  ok(!/'[^'\n]*Cuando quieras vemos tus pendientes/.test(fs.readFileSync(path.join(DIR, 'retomar.js'), 'utf8')), '6 · ya no existe el saludo «Cuando quieras vemos tus pendientes»');
}
process.exit(fallo);
