/* El prompt de cada canal llega a Alma en JSON (#498 T2; decisión de Juan, 12-nov-2026: mismo contenido, otro formato).
   Revisa, sobre lo que arma .github/prompts-armados.js (dobles de Google, sin red, hoja vacía):
   1. que cada bloque de cada canal (voz, chat_texto, whatsapp_texto, calle_texto, redactor y las herramientas del chat)
      sea JSON válido, y que el prompt sea un objeto por secciones;
   2. que el chat lleve dos bloques (lo fijo, que va a la caché, y este_turno) y la voz su ficha al final con
      {{quien_llama}} una sola vez (la única variable de ElevenLabs que queda en el prompt);
   3. que la conversión no pierda nada: cada línea del texto de antes (el chat y el redactor) está en el JSON tal cual,
      salvo los títulos, que pasan a ser claves (lo que traen además del nombre sí queda).
   node .github/prompts-json.js [carpeta apps-script] */
const path = require('path');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const error = m => { console.log('::error::' + m); fallo = 1; };
let p; try { p = require('./prompts-armados.js').armar(DIR); } catch (e) { console.log('::error::' + e.message); process.exit(1); }
const textos = (o, out) => { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') Object.keys(o).forEach(k => textos(o[k], out)); return out; };

/* 1 y 2 · JSON válido, por secciones. */
const obj = {};
Object.keys(p).filter(k => k[0] !== '_').forEach(k => {
  obj[k] = p[k].map((b, i) => {
    try { return JSON.parse(b); } catch (e) { error('El prompt de ' + k + (p[k].length > 1 ? ' (bloque ' + (i + 1) + ')' : '') + ' no es JSON válido: ' + e.message + ' · «' + String(b).slice(0, 80) + '»'); return null; }
  });
  if (k !== 'chat_herramientas') obj[k].forEach(o => { if (o && (typeof o !== 'object' || Array.isArray(o))) error('El prompt de ' + k + ' no es un objeto por secciones.'); });
});
['chat_texto', 'whatsapp_texto', 'calle_texto'].forEach(k => {
  if (p[k].length !== 2) error(k + ': el system debe ir en dos bloques (lo fijo con la caché y este_turno); van ' + p[k].length + '.');
  else if (obj[k][1] && !obj[k][1].este_turno) error(k + ': el segundo bloque no es este_turno.');
});
const voz = p.voz[0], vars = voz.match(/\{\{[^}]*\}\}/g) || [];
if (vars.join() !== '{{quien_llama}}') error('La voz debe llevar solo {{quien_llama}}, una vez; lleva: ' + (vars.join(' ') || 'ninguna') + '.');
if (obj.voz[0] && textos(obj.voz[0].ficha_de_quien_llama, []).indexOf('{{quien_llama}}') < 0) error('La voz: {{quien_llama}} debe ir en ficha_de_quien_llama.');
if (obj.voz[0] && Object.keys(obj.voz[0]).pop() !== 'ficha_de_quien_llama') error('La voz: la ficha de quien llama va al final (lo único que cambia entre llamadas; lo demás se reusa de la caché).');

/* 3 · Sin pérdidas: lo de antes, línea por línea, está en el JSON (los títulos, como clave). */
const ctx = p._ctx;
Object.keys(p._crudo).forEach(k => {
  const crudo = p._crudo[k], hay = {};
  ctx.T_ = crudo; textos(require('vm').runInContext('promptObj_(T_)', ctx), []).forEach(t => { hay[t] = 1; });
  let n = 0;
  crudo.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
    if (hay[l.replace(/^[·-] /, '').trim()]) return;
    const b = l.match(/^═══ (.+?) ═══$/); ctx.L_ = b ? b[1] : l; ctx.B_ = !!b;
    const t = require('vm').runInContext('pjTitulo_(L_, B_)', ctx);
    if (t && t.lineas.every(x => hay[x])) return;
    if (n++ < 5) error(k + ': esta línea no quedó en el JSON: «' + l.slice(0, 120) + '»');
  });
});

if (!fallo) console.log('✓ JSON válido: ' + Object.keys(obj).map(k => k + (p[k].length > 1 ? ' (' + p[k].length + ' bloques)' : '')).join(', ') + '; la voz con {{quien_llama}} al final; nada se perdió al convertir.');
process.exit(fallo);
