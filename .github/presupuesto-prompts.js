/* Presupuesto de los prompts (issue #396, idea de Atticus; T9 del 3-nov-2026): mide el texto REAL que recibe Alma en
   cada canal, ya armado como le llega al modelo (desde #498 T2, en JSON), no solo unas constantes. Lo arma
   .github/prompts-armados.js (dobles de Google, sin red, hoja vacía):
   · voz: el prompt que se copia al agente de ElevenLabs, sin la ficha de quien llama (ficha_de_quien_llama);
   · chat_texto / whatsapp_texto / calle_texto: los bloques de system de opAgente_ con Juan en el Hub, WhatsApp y modo calle;
   · chat_herramientas: las herramientas del chat (JSON, se mandan en cada turno);
   · redactor: lo que recibe el redactor de huéspedes (base + reglas fijas + reglas consolidadas + estilo).
   Falla si alguno pasa su tope de .github/presupuesto-prompts.json. Las mejoras y avisos de la hoja no cuentan aquí.
   node .github/presupuesto-prompts.js [carpeta apps-script]   ·   --medir imprime los tamaños de hoy, sin revisar. */
const fs = require('fs'), path = require('path');
const DIR = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'apps-script');
let p; try { p = require('./prompts-armados.js').armar(DIR); } catch (e) { console.error(e.message); process.exit(1); }
const largo = bloques => bloques.reduce((n, b) => n + b.length, 0);
const sinFicha = t => { try { const o = JSON.parse(t); delete o.ficha_de_quien_llama; return JSON.stringify(o); } catch (e) { return t.replace(/FICHA DE QUIEN LLAMA \(el Hub[\s\S]*$/, ''); } };
const hoy = {};
Object.keys(p).filter(k => k[0] !== '_').forEach(k => { hoy[k] = k === 'voz' ? sinFicha(p.voz[0]).length : largo(p[k]); });
if (process.argv.includes('--medir')) { console.log(JSON.stringify(hoy)); process.exit(0); }
const tope = JSON.parse(fs.readFileSync(path.join(__dirname, 'presupuesto-prompts.json'), 'utf8')).topes;
let fallo = 0;
Object.keys(hoy).forEach(k => {
  const linea = k + ': ' + hoy[k] + ' caracteres (tope ' + tope[k] + ')';
  if (!tope[k]) { console.log('::error::Falta el tope de ' + k + ' en .github/presupuesto-prompts.json'); fallo = 1; }
  else if (hoy[k] > tope[k]) { console.log('::error::El prompt de ' + k + ' creció de más: ' + linea + '. Recorta antes de agregar (cada carácter se paga en cada llamada), o sube el tope en .github/presupuesto-prompts.json con el sí de Juan.'); fallo = 1; }
  else console.log('✓ ' + linea);
});
process.exit(fallo);
