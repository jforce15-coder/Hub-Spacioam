/* Prueba de la bandeja A3 del Hub (#567 T1, apps-script/bandejaesfera.js e index.html) con dobles: sin Google de verdad.
   Juan, 16-nov-2026: la bandeja pinta cada conversación con el color EXACTO de su esfera (los de alma/inicio.html), con la
   foto de la persona, y arriba los círculos de lo importante, con lo personal pendiente siempre a la vista. Revisa que:
   1. cada conversación que va al Hub trae esfera (una de las 6) y foto (una URL o null): la que movió Juan manda, lo
      personal (WA_RELAY) toma la de Alma o Relaciones, lo demás es Propósito; la foto es la del huésped, la del login por
      teléfono (nunca de una cuenta suspendida), la de la reserva ligada al número o al código, o null (nunca inventada);
   2. las hojas se leen una vez por caché y mover una conversación de esfera la borra; hubCola_ completa las filas;
   3. los colores de las esferas del Hub son los mismos de alma/inicio.html (--c, --c2, --c3) y los nombres, los del glosario;
   4. los círculos: por importancia, lo más nuevo primero y lo personal pendiente entre los 3 primeros (aunque haya muchos
      urgentes de trabajo y aunque se corte en 12);
   5. los filtros siguen funcionando: Resumen · Requiere atención · Ver todo con su cuenta, el fondo que se mueve calza con
      las columnas, lo personal pendiente cuenta en «Requiere atención» y no se cae de la lista por no tener propiedad;
   6. las etiquetas de estado se leen (contraste AA) sobre el fondo de cada esfera.
   node .github/bandeja-esferas.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js'), AREAS = leer('areas.js'), BE = leer('bandejaesfera.js');
const HUB = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'), INICIO = fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const linea = (src, re) => { const m = re.exec(src); if (!m) throw new Error('no encontré ' + re); return m[0].replace(/^const /, 'var '); };

/* ── 1 y 2 · Lo que el Hub manda con cada conversación ── */
function caja(o) {
  const lecturas = { areas: 0, login: 0, ct: 0 }, cache = {};
  const ctx = {
    console, JSON, Object, String, Number, Math, Date, RegExp,
    SHEET_ACCESOS_ID: 'hoja-usuarios',
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'WA_RELAY' ? JSON.stringify(o.relay || {}) : null) }) },
    SpreadsheetApp: { openById: (id) => { if (id !== 'hoja-usuarios') throw new Error('hoja'); lecturas.login++; return { getSheets: () => [
      { getDataRange: () => ({ getDisplayValues: () => [['Nombre', 'Email', 'Foto', 'Estado', 'Teléfono'], ...o.usuarios] }) },
      { getDataRange: () => ({ getDisplayValues: () => [['clave', 'valor']] }) }] }; } },
    areasFilas_: () => { lecturas.areas++; return JSON.parse(JSON.stringify(o.areas || {})); },
    fctVersiones_: () => { lecturas.ct++; return JSON.parse(JSON.stringify(o.ct || {})); }   // fotoscontacto.js (#567 T4): últimos 8 → versión
  };
  vm.createContext(ctx);
  vm.runInContext([linea(COD, /const fin8_ = [^\n]*/), sacar(COD, 'normTel_'), sacar(COD, 'telsDe_'),
    linea(AREAS, /var AREAS_ = \[[\s\S]*?\n\];/), sacar(AREAS, 'areaOk_'), BE].join('\n'), ctx);
  return { ctx, lecturas, cache };
}
const U = (n, foto, estado, tel) => [n, n.toLowerCase() + '@x.com', foto, estado, tel];
const datos = {
  relay: { '55550101': { nombre: 'Mamá' }, '55550109': { nombre: 'Vecino' } },
  areas: { 'pers:55550101': { area: 'relaciones' }, 'pers:55550102': { area: 'health' }, 'conv:r-movida': { area: 'finanzas' }, 'conv:r-cajon': { area: '', cajon: 'ideas' } },
  ct: { '55550108': 'k1', '55550103': 'k2' },   // fotos del contacto guardadas (iPhone, Google o a mano)
  usuarios: [U('Ana', 'https://fotos.x/ana.jpg', 'activo', '+502 5555 0103'), U('Beto', 'https://fotos.x/beto.jpg', 'suspendido', '5555-0104'), U('Caro', 'sin-url', 'activo', '55550105')]
};
const filas = () => [
  { conv_id: 'r-huesped', codigo: 'HMA1', foto: 'https://fotos.x/huesped.jpg', wa: '50255550106' },
  { conv_id: 'r-sinfoto', codigo: 'HMB2', foto: '' },
  { conv_id: 'r-movida', codigo: 'HMC3', foto: '' },
  { conv_id: 'r-cajon', codigo: '', foto: '' },
  { conv_id: 'wa:50255550101', foto: '' },
  { conv_id: 'wa:50255550102', foto: '' },
  { conv_id: 'wa:50255550109', foto: '' },
  { conv_id: 'wa:50255550103', foto: '' },
  { conv_id: 'wa:50255550104', foto: '' },
  { conv_id: 'wa:50255550105', foto: '' },
  { conv_id: 'wa:50255550106', foto: '' },
  { conv_id: 'wa:50255550107', codigo: 'HMA1', foto: '' },
  { conv_id: 'wa:50255550108', foto: '' }
];
{
  const { ctx, lecturas } = caja(datos);
  const r = ctx.bandejaEsferaFoto_(filas()), por = {}; r.forEach((x) => { por[x.conv_id] = x; });
  const CLAVES = ['proposito', 'relaciones', 'finanzas', 'health', 'comunidad', 'espiritualidad'];
  ok(r.every((x) => CLAVES.includes(x.esfera)), 'cada conversación trae una de las 6 esferas');
  ok(r.every((x) => x.foto === null || /^https?:\/\//.test(x.foto)), 'cada conversación trae una foto (URL) o null');
  ok(por['r-huesped'].esfera === 'proposito' && por['r-sinfoto'].esfera === 'proposito' && por['wa:50255550108'].esfera === 'proposito', 'Hospitable, Airbnb, Booking y el WhatsApp de Spacio AM son Propósito');
  ok(por['r-movida'].esfera === 'finanzas', 'la esfera que Juan movió a mano (ALMA_AREAS conv:) manda');
  ok(por['r-cajon'].esfera === 'proposito', 'un cajón (Ideas) no es una esfera: se queda en Propósito');
  ok(por['wa:50255550101'].esfera === 'relaciones' && por['wa:50255550102'].esfera === 'health', 'lo personal toma la esfera que le puso Alma (pers:)');
  ok(por['wa:50255550109'].esfera === 'relaciones', 'lo personal aún sin clasificar (solo en WA_RELAY) va en Relaciones, como en areas_');
  ok(por['r-huesped'].foto === 'https://fotos.x/huesped.jpg', 'la foto del huésped (ALMA_INBOX.foto) se queda');
  ok(por['wa:50255550103'].foto === 'https://fotos.x/ana.jpg', 'un WhatsApp de alguien con cuenta lleva la foto de su login (por teléfono)');
  ok(por['wa:50255550104'].foto === null, 'una cuenta suspendida no presta su foto');
  ok(por['wa:50255550105'].foto === null, 'un valor que no es una URL no se usa como foto');
  ok(por['wa:50255550106'].foto === 'https://fotos.x/huesped.jpg', 'un WhatsApp ligado a una reserva con foto (por su número) lleva esa foto');
  ok(por['wa:50255550107'].foto === 'https://fotos.x/huesped.jpg', 'un WhatsApp ligado a una reserva con foto (por su código) lleva esa foto');
  ok(por['r-sinfoto'].foto === null && por['wa:50255550108'].foto === null, 'sin foto de nadie: null (el Hub pone las iniciales), nunca una inventada');
  ctx.bandejaEsferaFoto_(filas()); ctx.bandejaEsferaFoto_(filas());
  ok(por['wa:50255550108'].foto_contacto === '55550108.k1', '4.ª fuente: un WhatsApp sin foto con foto del contacto guardada trae foto_contacto «últimos 8.versión» (foto sigue en null)');
  ok(!por['wa:50255550103'].foto_contacto && !por['r-sinfoto'].foto_contacto && !por['r-huesped'].foto_contacto, 'la foto del contacto no pisa la del login, la del huésped ni va en conversaciones que no son WhatsApp');
  ok(lecturas.areas === 1 && lecturas.login === 1 && lecturas.ct === 1, 'las hojas se leen una sola vez mientras dura la caché (el Hub pregunta cada 5–10 s)');
}
ok(/areaMover_[\s\S]*?remove\(BANDEJA_ESFERA_CACHE_\)/.test(AREAS), 'mover una conversación de esfera (areaMover_) borra la caché: se ve al instante');
ok(/function hubCola_[\s\S]*?bandejaEsferaFoto_\(inbox\)[\s\S]*?const out = \{/.test(COD), 'hubCola_ completa esfera y foto antes de mandar la bandeja');
ok(!/UrlFetchApp|uf_\(/.test(BE), 'bandejaesfera.js no va a internet');

/* ── 3 · Colores de las esferas: los mismos de alma/inicio.html ── */
const esfInicio = {}; let m; const reI = /\.esf\.(\w+)\s*\{\s*--c:\s*(#[0-9A-Fa-f]{6});\s*--c2:\s*(#[0-9A-Fa-f]{6});\s*--c3:\s*(#[0-9A-Fa-f]{6});/g;
while ((m = reI.exec(INICIO))) esfInicio[m[1]] = [m[2], m[3], m[4]].map((x) => x.toUpperCase());
const bloque = /\n {2}ESFERAS = \{([\s\S]*?)\n {2}\};/.exec(HUB);
ok(!!bloque, 'el Hub define sus colores de esfera en un solo lugar (ESFERAS)');
const esfHub = {}; const reH = /(\w+): \{ n: "([^"]+)", c: "(#[0-9A-Fa-f]{6})", c2: "(#[0-9A-Fa-f]{6})", c3: "(#[0-9A-Fa-f]{6})" \}/g;
while (bloque && (m = reH.exec(bloque[1]))) esfHub[m[1]] = { n: m[2], cs: [m[3], m[4], m[5]].map((x) => x.toUpperCase()) };
const claves = Object.keys(esfInicio);
ok(claves.length === 6 && Object.keys(esfHub).length === 6, 'hay 6 esferas en el inicio de la app y 6 en el Hub');
claves.forEach((k) => ok(esfHub[k] && esfHub[k].cs.join() === esfInicio[k].join(), 'la esfera ' + k + ' usa exactamente ' + esfInicio[k].join(' / ') + ' en el Hub'));
const nombres = {}; (/var AREAS_ = \[([\s\S]*?)\n\];/.exec(AREAS)[1].match(/k: '(\w+)', n: '([^']+)'/g) || []).forEach((x) => { const q = /k: '(\w+)', n: '([^']+)'/.exec(x); nombres[q[1]] = q[2]; });
ok(Object.keys(nombres).every((k) => esfHub[k] && esfHub[k].n === nombres[k]), 'los nombres son los del glosario: ' + Object.values(nombres).join(', '));
ok(!/\b(categor[ií]a|tag)\b/i.test((HUB.match(/#567[^\n]*/g) || []).join(' ')), 'los comentarios de la bandeja no usan las palabras a evitar del glosario');

/* ── 4 · Orden de los círculos ── */
const mo = /\n {2}circulosOrden\(items, max\) \{[\s\S]*?\n {2}\}/.exec(HUB);
ok(!!mo, 'el orden de los círculos vive en circulosOrden');
const orden = mo ? new Function('return function ' + mo[0].trim())() : () => [];
const it = (id, rank, ts, personal) => ({ id, rank, ts, personal: !!personal });
const muchos = [it('u1', 0, 9), it('u2', 0, 8), it('u3', 0, 7), it('u4', 0, 6), it('s1', 1, 5), it('e1', 2, 5), it('p1', 3, 5), it('mama', 1, 1, true), it('c1', 4, 9)];
const o1 = orden(muchos, 12).map((x) => x.id);
ok(o1.slice(0, 2).join() === 'u1,u2' && o1.indexOf('mama') === 2, 'lo personal pendiente sube a los 3 primeros círculos aunque haya 4 urgentes de trabajo: ' + o1.join(' · '));
const o2 = orden(muchos.concat(Array.from({ length: 14 }, (_, i) => it('x' + i, 0, 100 + i))), 12).map((x) => x.id);
ok(o2.length === 12 && o2.indexOf('mama') === 2, 'con más de 12 círculos se corta en 12 y lo personal pendiente sigue arriba');
const o3 = orden([it('ci', 4, 9), it('p', 3, 1), it('e', 2, 1), it('s', 1, 1), it('u', 0, 1)], 12).map((x) => x.id);
ok(o3.join() === 'u,s,e,p,ci', 'por importancia: urgente, sin responder, necesita equipo, promesa, check-in hoy');
const o4 = orden([it('viejo', 0, 1), it('nuevo', 0, 5)], 12).map((x) => x.id);
ok(o4.join() === 'nuevo,viejo', 'en la misma importancia, lo más nuevo primero');
const o5 = orden([it('u1', 0, 9), it('u2', 0, 8), it('u3', 0, 7), it('cumple', 4, 5, true)], 12).map((x) => x.id);
ok(o5.join() === 'u1,u2,u3,cumple', 'un check-in personal no es «pendiente»: no salta a los primeros');
ok(/aroCls: "bj-aro" \+ \(x\.est === "urg" \? " bj-late" : ""\)/.test(HUB) && /animation:bj-latido [^;]* 3;/.test(HUB), 'solo lo urgente late, y 3 veces');
ok(/prom: \[3, "#D4A23F"/.test(HUB), 'la promesa va en dorado (#D4A23F) en el aro');
ok(/prefers-reduced-motion:reduce\)\{[\s\S]*?\.bj-circulo\{ animation:bj-fade[\s\S]*?\.bj-aro\.bj-late::after\{ animation:none; \}/.test(HUB), 'prefers-reduced-motion: sin cascada ni latido');

/* ── 5 · Filtros ── */
const tabs = HUB.match(/<div role="tablist" aria-label="Vista" class="bj-filtros" style="[^"]*grid-template-columns:1fr 1\.7fr 1fr;[^"]*"/g) || [];
ok(tabs.length === 2, 'las dos pastillas de filtros (teléfono y computadora) tienen las mismas 3 columnas');
const L = /mTabThumbL: st\.mVista === "atencion" \? "calc\(3px \+ \(100% - 6px\) \* ([\d.]+)\)" : st\.mVista === "lista" \? "calc\(3px \+ \(100% - 6px\) \* ([\d.]+)\)"/.exec(HUB);
const W = /mTabThumbW: st\.mVista === "atencion" \? "calc\(\(100% - 6px\) \* ([\d.]+)\)" : "calc\(\(100% - 6px\) \* ([\d.]+)\)"/.exec(HUB);
const cerca = (a, b) => Math.abs(a - b) < 0.0006;
ok(L && W && cerca(+L[1], 1 / 3.7) && cerca(+L[2], 2.7 / 3.7) && cerca(+W[1], 1.7 / 3.7) && cerca(+W[2], 1 / 3.7), 'el fondo blanco del filtro elegido calza con sus columnas');
ok(/\[\["resumen", "Resumen"\], \["atencion", [^\]]*\], \["lista", "Ver todo"\]\]/.test(HUB) && (HUB.match(/onClick="\{\{ v\.set \}\}"/g) || []).length === 2, 'siguen Resumen · Requiere atención · Ver todo, y cada uno cambia la vista');
ok(/hayN: esA && nAtn > 0, n: String\(nAtn\)/.test(HUB), '«Requiere atención» lleva su cuenta');
ok(/var esSinG = function \(g\) \{[^\n]*\(!!propDe\(g\) \|\| esPers\(g\)\)/.test(HUB), 'lo personal que espera respuesta cuenta en «Requiere atención» aunque no tenga propiedad');
ok(/\(est !== "pend" \|\| \(!propR && !esPers\(g\)\)\)\) return null;/.test(HUB), 'lo personal pendiente no se cae de la lista por no tener propiedad');
ok(!/s2\/favicons/.test((/<sc-for list="\{\{ cronoFilas \}\}"[\s\S]*?<\/sc-for>/.exec(HUB) || [''])[0]), 'el canal de cada fila va dibujado en la página (sin pedir íconos afuera)');

/* ── 6 · Contraste AA de las etiquetas sobre el fondo de cada esfera ── */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const capa = (s) => { const r = /rgba\(([^)]+)\)/.exec(s); if (r) { const p = r[1].split(',').map(Number); return { c: p.slice(0, 3), a: p[3] }; } return { c: hex(s), a: 1 }; };
const mezcla = (t, b) => t.c.map((v, i) => v * t.a + b[i] * (1 - t.a));
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const est = /var EST3 = \{([\s\S]*?)\};/.exec(HUB);
const chips = []; const reC = /\w+: \["([^"]+)", "([^"]+)", "(#[0-9A-Fa-f]{6})"/g; while (est && (m = reC.exec(est[1]))) chips.push(m.slice(1));
chips.push(['Check-in mañana', 'rgba(233,130,106,.14)', '#A8472F'], ['Hospedado', 'rgba(61,107,82,.14)', '#3d6b52']);
let peor = 99, cual = '';
Object.keys(esfHub).forEach((k) => chips.forEach(([n, bg, fg]) => {
  const fondo = mezcla(capa(bg), mezcla({ c: hex(esfHub[k].cs[0]), a: 15 / 255 }, [255, 255, 255])), r = ratio(hex(fg), fondo);
  if (r < peor) { peor = r; cual = n + ' en ' + k; }
}));
ok(chips.length >= 6 && peor >= 4.5, 'todas las etiquetas pasan AA sobre el fondo de cada esfera (la más justa: ' + cual + ', ' + peor.toFixed(2) + ':1)');
ok(/bg: E3\.c \+ "0F"/.test(HUB), 'el fondo de la fila es el color exacto de su esfera, muy tenue');

process.exit(fallo);
