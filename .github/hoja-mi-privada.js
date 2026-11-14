/* La hoja de Mi es privada (Juan, 14-nov-2026): nadie la lee por gviz ni por un CSV público.
   Antes estaba compartida con «cualquiera con el enlace» porque la app la leía desde el navegador, y su id está en los
   repos públicos: cualquiera podía ver SETUP (correos de socios) y los números del negocio. Ahora:
     · el front pide sus datos al Apps Script de Mi con la sesión (leerHojas), que da a cada quien solo lo suyo;
     · los Apps Script la leen con SpreadsheetApp, o por gviz solo con el permiso del dueño (Authorization: Bearer).
   Este check falla si vuelve a aparecer una lectura pública. El mismo archivo vive en Mi, Epi y el Hub.
     (No se revisan archivo/ —código viejo que no se publica—, .github/ —pruebas con dobles— ni lo compilado —sale de su .jsx—.)
     A. Front (todo lo que no es Apps Script): un archivo que
        nombra la hoja de Mi (su id o una variable que lo guarda) no puede armar una dirección docs.google.com/spreadsheets.
        Con --estricto, el front ni siquiera puede nombrarla (Mi y Epi ya no la necesitan).
     B. En cualquier archivo: la hoja de Mi seguida de /gviz/, export?format=csv u output=csv en la misma instrucción,
        sin «Authorization» (eso es una lectura pública desde un Apps Script).
   node .github/hoja-mi-privada.js [carpeta] [--estricto] */
const fs = require('fs'), path = require('path');
const ID = '1l9wLH8880NlN9ac2jvne2U6cqej6gycqAD77Z25cLF4';
const args = process.argv.slice(2), estricto = args.includes('--estricto');
const RAIZ = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const EXT = /\.(js|jsx|gs|html|htm|mjs|ts|tsx)$/i;
const SALTAR = /(^|\/)(\.git|node_modules|archivo|\.github)(\/|$)/;
const SERVIDOR = /(^|\/)apps-script(\/|$)/;
const COMPILADO = /(^|\/)build\/|(^|\/)app\.build\.js$|\.min\.js$/;

function archivos(dir, rel, out) {
  for (const n of fs.readdirSync(dir)) {
    const r = rel ? rel + '/' + n : n, p = path.join(dir, n);
    if (SALTAR.test(r)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) archivos(p, r, out); else if (EXT.test(n) && !COMPILADO.test(r)) out.push(r);
  }
  return out;
}
const lista = archivos(RAIZ, '', []);
const texto = {}; lista.forEach(r => { texto[r] = fs.readFileSync(path.join(RAIZ, r), 'utf8'); });
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Variables que guardan el id (var X = '…', const X = "…"): valen en su archivo y, en un Apps Script, en toda su carpeta
   (Apps Script junta los archivos). Más SPACIO_SHEET_ID, la variable global que usaba el front de Mi. */
const grupo = r => SERVIDOR.test(r) ? path.dirname(r) : r;
const nombres = {};
const rxAsig = new RegExp('([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*["\']' + ID + '["\']', 'g');
lista.forEach(r => { let m; rxAsig.lastIndex = 0; while ((m = rxAsig.exec(texto[r]))) (nombres[grupo(r)] = nombres[grupo(r)] || new Set()).add(m[1]); });
const refDe = r => '(?:' + esc(ID) + '|' + ['SPACIO_SHEET_ID'].concat([...(nombres[grupo(r)] || [])]).map(n => '\\b' + esc(n) + '\\b').join('|') + ')';

let fallos = 0;
const mal = (r, txt, m) => { console.log('::error file=' + r + '::' + m); fallos++; };
const linea = (txt, i) => txt.slice(0, i).split('\n').length;
for (const r of lista) {
  const t = texto[r], front = !SERVIDOR.test(r), ref = refDe(r), rxRef = new RegExp(ref);
  const rxPublica = new RegExp(ref + '[^;]{0,200}?(?:/gviz/|gviz/tq|export\\?format=csv|output=csv)', 'g');
  if (front && rxRef.test(t)) {
    if (estricto) mal(r, t, 'nombra la hoja de Mi en el front (línea ' + linea(t, t.search(rxRef)) + '). El front la lee con la sesión por el Apps Script de Mi (leerHojas), nunca directo.');
    else if (/docs\.google\.com\/spreadsheets/.test(t)) mal(r, t, 'nombra la hoja de Mi y arma una dirección docs.google.com/spreadsheets: la hoja es privada, se lee por su Apps Script con la sesión.');
  }
  let m;
  while ((m = rxPublica.exec(t))) {
    const fin = t.indexOf(';', m.index + m[0].length), instr = t.slice(m.index, fin < 0 ? undefined : fin);
    if (!/Authorization/.test(instr)) mal(r, t, 'lee la hoja de Mi por gviz/CSV sin el permiso del dueño (línea ' + linea(t, m.index) + '). Usa SpreadsheetApp.openById o gviz con Authorization: Bearer ScriptApp.getOAuthToken().');
  }
}
console.log(fallos ? fallos + ' lectura(s) pública(s) de la hoja de Mi.' : '✓ ' + lista.length + ' archivos revisados: ninguna lectura pública de la hoja de Mi' + (estricto ? ' y el front no la nombra' : '') + '.');
process.exit(fallos ? 1 : 0);
