/* Candado único (apps-script/candado.js), 21-nov-2026: en Apps Script el candado no cuenta cuántas veces se tomó y una
   función llamada a media pasada que lo tomaba y lo soltaba soltaba también el de quien la llamó: así salió dos veces el
   mismo mensaje a un huésped (Hub #959). Revisa:
   1. nadie fuera de candado.js toca el candado a mano (releaseLock, waitLock ni tryLock): todo pasa por candadoTomar_ o
      conCandado_, que solo sueltan lo que esa misma llamada tomó;
   2. con dobles de LockService que se comportan como Apps Script (un solo candado, sin contar): una función de adentro
      no suelta el candado de afuera, ni aunque hasLock no diga nada;
   3. ocupado → null (o lo que diga op.ocupado), op.lanzar → error, soltar dos veces no suelta de más, el del usuario
      va aparte del del script.
   node .github/candado-unico.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

/* 1. Nadie más toca el candado. Se quitan los comentarios para no confundir una explicación con una llamada. */
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const malos = [];
fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== 'candado.js').forEach(f => {
  sinComentarios(fs.readFileSync(path.join(DIR, f), 'utf8')).split('\n').forEach((l, i) => {
    if (/\.\s*(releaseLock|waitLock|tryLock)\s*\(/.test(l)) malos.push(f + ':' + (i + 1) + ' ' + l.trim().slice(0, 120));
  });
});
ok(!malos.length, '1. releaseLock, waitLock y tryLock solo en candado.js (usa candadoTomar_ o conCandado_)' + (malos.length ? ':\n  ' + malos.join('\n  ') : ''));
const fuente = fs.readFileSync(path.join(DIR, 'candado.js'), 'utf8');
ok(/function candadoTomar_\(/.test(fuente) && /function conCandado_\(/.test(fuente), '1. candado.js tiene candadoTomar_ y conCandado_');

/* 2 y 3. Dobles: un candado por tipo, como el de Apps Script (sin cuenta: un releaseLock lo suelta, lo haya tomado quien sea). */
function caja(o) {
  o = o || {};
  const c = { script: { de: null, sueltas: 0 }, usuario: { de: null, sueltas: 0 } };
  const lockDe = tipo => ({
    tryLock: () => { if (c[tipo].de && c[tipo].de !== 'yo') return false; c[tipo].de = 'yo'; return true; },
    waitLock() { if (c[tipo].de && c[tipo].de !== 'yo') throw new Error('Lock timeout'); c[tipo].de = 'yo'; },
    releaseLock() { c[tipo].de = null; c[tipo].sueltas++; },
    hasLock: () => (o.hasLockCalla ? false : c[tipo].de === 'yo')
  });
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, Error, LockService: { getScriptLock: () => lockDe('script'), getUserLock: () => lockDe('usuario') } };
  ctx.vozColaLock_ = () => ctx.LockService.getUserLock();
  vm.createContext(ctx);
  vm.runInContext(fuente, ctx, { filename: 'candado.js' });
  return { ctx, c };
}

[false, true].forEach(calla => {
  const { ctx, c } = caja({ hasLockCalla: calla }), q = calla ? ' (hasLock no dice nada)' : '';
  const afuera = ctx.candadoTomar_(10000);
  ok(!!afuera && c.script.de === 'yo', '2. la pasada toma el candado' + q);
  const adentro = ctx.candadoTomar_(10000);
  ok(!!adentro, '2. la función de adentro sigue (el candado ya es de esta ejecución)' + q);
  adentro();
  ok(c.script.de === 'yo' && c.script.sueltas === 0, '2. la función de adentro no suelta el candado de la pasada' + q);
  ctx.conCandado_(() => 1);
  ok(c.script.de === 'yo' && c.script.sueltas === 0, '2. conCandado_ adentro tampoco lo suelta' + q);
  afuera(); afuera();
  ok(c.script.de === null && c.script.sueltas === 1, '3. la pasada lo suelta una sola vez, aunque llame dos veces' + q);
  ok(ctx.CANDADO_MIO_.script === 0, '3. la cuenta vuelve a cero' + q);
});

{
  const { ctx, c } = caja();
  c.script.de = 'otra';   // otra ejecución lo tiene
  ok(ctx.candadoTomar_(5000) === null, '3. ocupado por otra ejecución → null');
  let error = ''; try { ctx.candadoTomar_(5000, { lanzar: true }); } catch (e) { error = String(e.message); }
  ok(/ocupado/i.test(error), '3. con lanzar, ocupado → error');
  ok(ctx.conCandado_(() => 'hecho', { ocupado: 'ocupado' }) === 'ocupado', '3. conCandado_ ocupado → op.ocupado');
  ok(ctx.conCandado_(() => 'hecho', { ocupado: () => 'igual' }) === 'igual', '3. conCandado_ ocupado con función → la llama');
  ok(c.script.de === 'otra' && c.script.sueltas === 0, '3. nunca suelta el candado de otra ejecución');
  const u = ctx.candadoTomar_(5000, { usuario: true });
  ok(!!u && c.usuario.de === 'yo', '3. el del usuario va aparte del del script');
  u();
  ok(c.usuario.de === null && c.script.de === 'otra', '3. soltar el del usuario no toca el del script');
  c.script.de = null;
  let lanzo = false; try { ctx.conCandado_(() => { throw new Error('x'); }); } catch (e) { lanzo = true; }
  ok(lanzo && c.script.de === null && ctx.CANDADO_MIO_.script === 0, '3. si la función falla, conCandado_ lo suelta igual');
  ok(ctx.conCandado_(() => 7) === 7, '3. conCandado_ devuelve lo que devuelve la función');
}

if (fallo) process.exit(1);
console.log('OK candado único');
