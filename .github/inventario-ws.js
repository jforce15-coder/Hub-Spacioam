/* Prueba con dobles del inventario para el traslado a Workspace (apps-script/inventariows.js, robot «inventario_ws», T1).
   1. Devuelve los NOMBRES de las Propiedades del script, nunca un valor (ni llaves ni ids).
   2. Lista los activadores vivos con su función y tipo.
   3. Para cada hoja o carpeta conocida (código, Propiedades con id, carpetas del cerebro e ids extra): nombre, si se abre,
      si es de la cuenta del script y su carpeta. Una que no se abre sale con abre=false, sin romper el resto.
   4. Solo lee: no escribe Propiedades, no crea pestañas ni carpetas y no cambia permisos.
   node .github/inventario-ws.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const SECRETO = 'valor-secreto-que-no-debe-salir';
const props = { ANTHROPIC_KEY: SECRETO, WA_CARPETA: 'carpetaWA0000000000000000', ALMA_ARCHIVO_ID: 'hojaArchivo00000000000000', CALENDARIO_JUAN: SECRETO };
let escrituras = 0;
const carpetaMadre = { getId: () => 'madre000000000000000000000', getName: () => 'Spacio AM · Hojas' };
const it = a => { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; };
const archivo = (id, nombre, mime, dueno) => ({ getName: () => nombre, getMimeType: () => mime, getOwner: () => ({ getEmail: () => dueno }), getParents: () => it([carpetaMadre]) });
const ARCHIVOS = {
  ALMA0000000000000000000000: archivo('ALMA', 'ALMA', 'application/vnd.google-apps.spreadsheet', 'dueno@gmail.com'),
  hojaArchivo00000000000000: archivo('arch', 'ALMA · Archivo', 'application/vnd.google-apps.spreadsheet', 'dueno@gmail.com'),
  extraHoja0000000000000000: archivo('ext', 'Hoja extra', 'application/vnd.google-apps.spreadsheet', 'otra@spacioam.com'),
  carpetaPorArchivo00000000: archivo('cpa', 'Documentos', 'application/vnd.google-apps.folder', 'dueno@gmail.com')
};
const CARPETAS = { carpetaWA0000000000000000: archivo('wa', 'ALMA · WhatsApp', 'application/vnd.google-apps.folder', 'dueno@gmail.com'),
  cerebro000000000000000000: archivo('cer', 'Manuales', 'application/vnd.google-apps.folder', 'dueno@gmail.com') };
const fuentes = [['tipo', 'id_carpeta'], ['drive', 'cerebro000000000000000000'], ['drive', 'noexiste00000000000000000']];
const ctx = {
  console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, Error,
  CFG: { SHEET_ALMA_ID: 'ALMA0000000000000000000000', SHEET_WEBAPP_ID: 'privada000000000000000000', SHEET_EPI_ID: 'ALMA0000000000000000000000' },
  SHEET_ACCESOS_ID: 'accesos000000000000000000',
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), getProperties: () => Object.assign({}, props),
    setProperty() { escrituras++; }, deleteProperty() { escrituras++; } }) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'dueno@gmail.com' }) },
  ScriptApp: { getProjectTriggers: () => [{ getHandlerFunction: () => 'procesarCola', getEventType: () => 'CLOCK', getTriggerSource: () => 'CLOCK' }] },
  ssAlma_: () => ({ getSheetByName: n => n === 'ALMA_CEREBRO_FUENTES'
    ? { getLastRow: () => fuentes.length, getRange: (r, c, nr, nc) => ({ getValues: () => fuentes.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)) }) } : null,
    insertSheet() { escrituras++; } }),
  DriveApp: {
    getFileById: id => { if (ARCHIVOS[id]) return ARCHIVOS[id]; throw new Error('no'); },
    getFolderById: id => { if (CARPETAS[id]) return CARPETAS[id]; throw new Error('no'); },
    createFolder() { escrituras++; }
  },
  SpreadsheetApp: { create() { escrituras++; } }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'inventariows.js'), 'utf8'), ctx, { filename: 'inventariows.js' });

const r = ctx.invWsInventario_({ ids: [{ origen: 'grow', id: 'extraHoja0000000000000000' }, 'corto'] });
const txt = JSON.stringify(r);
ok(r.ok && r.propiedades.indexOf('ANTHROPIC_KEY') >= 0 && r.propiedades.indexOf('WA_CARPETA') >= 0, 'devuelve los nombres de las Propiedades');
ok(txt.indexOf(SECRETO) < 0, 'nunca devuelve el valor de una llave ni del calendario');
ok(r.calendario_juan === true && r.cuenta_gmail === true, 'dice si existe CALENDARIO_JUAN y si la cuenta es Gmail, sin valores');
ok(r.activadores.length === 1 && r.activadores[0].funcion === 'procesarCola' && r.activadores[0].tipo === 'CLOCK', 'lista los activadores vivos');
const por = id => r.archivos.filter(a => a.id === id)[0];
ok(por('ALMA0000000000000000000000') && r.archivos.filter(a => a.id === 'ALMA0000000000000000000000').length === 1, 'un id repetido sale una vez');
const alma = por('ALMA0000000000000000000000');
ok(alma.abre && alma.tipo === 'hoja' && alma.nombre === 'ALMA' && alma.propia === true && alma.carpeta.nombre === 'Spacio AM · Hojas' && alma.fin === '000000',
  'una hoja: nombre, tipo, si es de la cuenta, su carpeta y los últimos 6 del id');
ok(por('carpetaWA0000000000000000').tipo === 'carpeta' && por('hojaArchivo00000000000000').abre, 'lee los ids guardados en Propiedades (carpeta y hoja)');
ok(por('cerebro000000000000000000').abre && por('noexiste00000000000000000').abre === false, 'incluye las carpetas del cerebro; la que no se abre sale con abre=false');
ok(por('privada000000000000000000').abre === false && /no se puede abrir/.test(por('privada000000000000000000').error), 'una hoja que no se abre no rompe el resto');
ok(por('extraHoja0000000000000000').propia === false && !por('corto'), 'acepta ids extra del robot (y descarta lo que no es un id)');
const r2 = ctx.invWsInventario_({ ids: ['carpetaPorArchivo00000000'] }).archivos.filter(a => a.id === 'carpetaPorArchivo00000000')[0];
ok(r2 && r2.tipo === 'carpeta', 'una carpeta que Drive también abre como archivo sale como carpeta (16-nov: salía «archivo»)');
ok(escrituras === 0, 'solo lee: no escribe Propiedades, ni crea pestañas, carpetas u hojas');
process.exit(fallo);
