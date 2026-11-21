/* Prueba del formulario de limpieza (apps-script/formlimpieza.js, ruta_del_dia con propiedad) con dobles: sin Epi ni Google.
   21-nov-2026 (#969): Juan pidió el formulario de limpieza de Helen de ayer en Rue 301 con la foto de los insumos y
   Alma no podía leerlo.
   1. Encuentra el formulario por propiedad, fecha y persona (sin tildes, con solo el nombre) y trae sus detalles.
   2. «301» nunca es «1301»; otra categoría (mantenimiento) no cuenta.
   3. Con fotos «insumos» trae las fotos de insumos como imágenes y sus enlaces; sin fotos, solo la lista de secciones.
   4. Sin formulario ese día: lo dice y da los más recientes, sin inventar.
   5. Va por ruta_del_dia con propiedad (sin otra herramienta) y en la voz las fotos no viajan como texto.
   node .github/formulario-limpieza.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const reps = [
  { id: 'a', categoria: 'Limpieza', propiedad: 'Rue 301', fecha: '2026-11-20', reportadoPor: 'Hélen Pineda', createdAt: Date.parse('2026-11-20T17:05:00Z') },
  { id: 'b', categoria: 'Limpieza', propiedad: 'Rue 1301', fecha: '2026-11-20', reportadoPor: 'Helen Pineda' },
  { id: 'c', categoria: 'Mantenimiento', propiedad: 'Rue 301', fecha: '2026-11-20', reportadoPor: 'Helen Pineda' },
  { id: 'd', categoria: 'Limpieza', propiedad: 'Rue 301', fecha: '2026-11-15', reportadoPor: 'Karen' }];
const full = { a: { id: 'a', categoria: 'Limpieza', propiedad: 'Rue 301', fecha: '2026-11-20', reportadoPor: 'Hélen Pineda', createdAt: Date.parse('2026-11-20T17:05:00Z'),
  comentarios: 'Faltaba café', inventario: [{ name: 'Toallas de cuerpo', cantidad: 4, estado: 'ok' }, { name: 'Plancha', cantidad: 1, malEstado: 1, estado: 'mal' }],
  fotosInsumos: 'https://drive.google.com/uc?id=INSUMOS123456', fotosBanos: ['https://drive.google.com/uc?id=BANO1234567'],
  fotosLimpieza: { fotosInsumosLimpieza: 'https://drive.google.com/uc?id=LIMPIA123456' } } };
const pedidos = [];
const ctx = { console, Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? '2026-11-21' : '2026-11-20 11:05' },
  epiPost_: (a, p) => { pedidos.push(a); return a === 'getAll' ? { reports: reps } : { report: full[p.id] || null }; },
  fuentesImagenes_: l => l.map(f => 'data:image/jpeg;base64,' + f.url.slice(-6)) };
vm.createContext(ctx);
const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), fuentes = fs.readFileSync(path.join(DIR, 'fuentes.js'), 'utf8');
const fn = (src, n) => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}', i) + 2); };
vm.runInContext([fn(cod, 's_'), fn(cod, 'tokProp_'), fn(cod, 'aplicaA_'), fn(fuentes, 'fuentesUrls_')].join('\n'), ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'formlimpieza.js'), 'utf8'), ctx);

const r = ctx.formularioLimpieza_({ propiedad: 'Rue 301', fecha: '2026-11-20', persona: 'helen' });
ok(r.ok && r.encontrado && r.quien === 'Hélen Pineda' && r.propiedad === 'Rue 301' && r.comentarios === 'Faltaba café', '1 · encuentra el formulario de Helen en Rue 301 del 20 (' + JSON.stringify([r.quien, r.propiedad]) + ')');
ok(r.inventario.length === 2 && /Plancha: 1 \(1 en mal estado\)/.test(r.inventario.join('|')), '1 · trae el inventario con lo que está en mal estado');
ok(!r.otros_ese_dia, '2 · Rue 1301 y el de mantenimiento no cuentan');
ok(!r._imgs && r.secciones_con_foto.some(x => /insumos de cortesía/.test(x)) && r.secciones_con_foto.some(x => /baños/.test(x)), '3 · sin fotos pedidas: solo la lista de secciones');
const f = ctx.formularioLimpieza_({ propiedad: 'rue 301', fecha: '2026-11-20', persona: 'Helen Pineda', fotos: 'insumos' });
ok(f._imgs && f._imgs.length === 2 && f.enlaces_fotos.length === 2 && f.enlaces_fotos.every(x => /insumos/.test(x) && /drive\.google/.test(x)), '3 · «insumos» trae las 2 fotos de insumos con su enlace (' + JSON.stringify(f.enlaces_fotos) + ')');
const t = ctx.formularioLimpieza_({ propiedad: 'Rue 301', fecha: '2026-11-20', fotos: 'todas' });
ok(t._imgs.length === 3, '3 · «todas» trae todas las fotos');
const n = ctx.formularioLimpieza_({ propiedad: 'Rue 301', fecha: '2026-11-18', persona: 'Helen' });
ok(n.ok && n.encontrado === false && /No hay formulario/.test(n.nota) && Array.isArray(n.mas_recientes), '4 · sin formulario ese día lo dice y da los más recientes');
ok(ctx.formularioLimpieza_({}).error, '4 · sin propiedad ni persona: pide el dato');
const ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8');
const ruta = ag.slice(ag.indexOf("case 'ruta_del_dia'"), ag.indexOf("case 'tareas_abiertas'"));
ok(/T\('ruta_del_dia', [^\n]*formulario de limpieza/.test(ag) && /propiedad\)\.trim\(\)\) return formularioLimpieza_\(/.test(ruta), '5 · ruta_del_dia con propiedad da el formulario (sin otra herramienta: el prompt no crece)');
const rap = fs.readFileSync(path.join(DIR, 'rapido.js'), 'utf8');
ok(/delete res\._imgs/.test(rap), '5 · en el camino rápido de la voz las fotos no viajan como texto');
process.exit(fallo);
