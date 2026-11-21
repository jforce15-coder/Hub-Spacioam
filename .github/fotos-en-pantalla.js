/* Prueba de «las fotos del formulario de limpieza, en pantalla» (apps-script/formlimpieza.js, agCerrarTurno_ y
   js/sa-chat.js) con dobles: sin Epi ni Google. Juan, 21-nov-2026 (pedido pc1795284963805): «no me estás poniendo eso en
   pantalla, solo me estás poniendo las reservas… necesito las fotos que están en Epi… ¿quién hizo la última limpieza
   antes que ella?… la foto de los insumos».
   Revisa:
   1. ruta_del_dia con propiedad le pasa el ctx al formulario y agCerrarTurno_ llama a flPantalla_;
   2. con propiedad sale «recientes» (fecha · quién, la más reciente primero) para «¿quién limpió antes que…?»;
   3. las fotos pedidas quedan para la pantalla con su id de Drive; en el chat Alma no recibe los enlaces para pegarlos;
   4. en el chat (hub, app) la respuesta lleva el bloque [[fotos]]; en WhatsApp no; en una llamada va al chat aparte;
   5. el chat (SAChat.fotos) saca el bloque del texto y arma la miniatura de Drive de cada foto.
   node .github/fotos-en-pantalla.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8');
ok(/formularioLimpieza_\(\{[^}]*\}, ctx\)/.test(ag), 'ruta_del_dia con propiedad le pasa el ctx al formulario');
ok(/respFinal = flPantalla_\(adm, respFinal, ctx\)/.test(ag), 'al cerrar el turno, las fotos van a la pantalla (agCerrarTurno_)');

const D = n => 'https://drive.google.com/uc?id=IdDeDrive' + n + 'xxxxx&export=view';
const reps = [
  { id: 'a', categoria: 'Limpieza', propiedad: 'Brunelo 1104', fecha: '2026-11-20', reportadoPor: 'Caren' },
  { id: 'b', categoria: 'Limpieza', propiedad: 'Brunelo 1104', fecha: '2026-11-17', reportadoPor: 'Gabriel' },
  { id: 'c', categoria: 'Mantenimiento', propiedad: 'Brunelo 1104', fecha: '2026-11-18', reportadoPor: 'Luis' },
  { id: 'd', categoria: 'Limpieza', propiedad: 'Brunelo 1104', fecha: '2026-11-12', reportadoPor: 'Caren' }];
const full = { b: { id: 'b', categoria: 'Limpieza', propiedad: 'Brunelo 1104', fecha: '2026-11-17', reportadoPor: 'Gabriel',
  fotosInsumos: D(1), fotosBanos: [D(3)], fotosLimpieza: { fotosInsumosLimpieza: D(2) } } };
const guardados = [];
const ctx = { console: { log() {}, error() {}, warn() {} }, AGENTE_CANAL_: 'hub',
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? '2026-11-21' : '2026-11-17 11:05' },
  epiPost_: (a, p) => a === 'getAll' ? { reports: reps } : { report: full[p.id] || null },
  fuentesImagenes_: l => l.map(f => 'data:image/jpeg;base64,' + f.url.slice(-6)),
  opGuardar_: (adm, de, canal, texto) => { guardados.push({ de, canal, texto }); return {}; } };
vm.createContext(ctx);
const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), fuentes = fs.readFileSync(path.join(DIR, 'fuentes.js'), 'utf8');
const fn = (src, n) => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}', i) + 2); };
vm.runInContext([fn(cod, 's_'), fn(cod, 'tokProp_'), fn(cod, 'aplicaA_'), fn(fuentes, 'fuentesUrls_')].join('\n'), ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'formlimpieza.js'), 'utf8'), ctx);

/* 2 · recientes. */
let r = ctx.formularioLimpieza_({ propiedad: 'Brunelo 1104', fecha: '2026-11-21' }, {});
ok(r.recientes && r.recientes[0] === '2026-11-20 · Caren' && r.recientes[1] === '2026-11-17 · Gabriel' && r.recientes.length === 3, 'recientes: solo limpiezas, la más reciente primero, para saber quién limpió antes de Caren');

/* 3 · fotos para la pantalla. */
const c3 = {}; r = ctx.formularioLimpieza_({ propiedad: 'Brunelo 1104', fecha: '2026-11-17', fotos: 'insumos' }, c3);
ok(r._imgs && r._imgs.length === 2, 'Alma ve las 2 fotos de insumos');
ok(c3.fotosPantalla && c3.fotosPantalla.length === 2 && c3.fotosPantalla[0].id === 'IdDeDrive1xxxxx' && /2026-11-17 · Gabriel/.test(c3.fotosPantalla[0].t), 'las fotos quedan para la pantalla con su id de Drive, fecha y quién');
ok(r.en_pantalla && !r.enlaces_fotos, 'en el chat Alma sabe que ya salen en pantalla y no recibe enlaces para pegar');
const c4 = {}; r = ctx.formularioLimpieza_({ propiedad: 'Brunelo 1104', fecha: '2026-11-17' }, c4);
ok(!c4.fotosPantalla, 'sin fotos pedidas no se pone nada en pantalla');

/* 4 · por canal. */
const conB = ctx.flPantalla_({ email: 'j@x' }, 'Esta es la foto.', c3);
ok(/^Esta es la foto\.\n\n\[\[fotos\]\]\n.+ \| IdDeDrive1xxxxx\n.+\n\[\[\/fotos\]\]$/.test(conB), 'en el chat la respuesta lleva el bloque [[fotos]]');
ctx.AGENTE_CANAL_ = 'whatsapp';
ok(ctx.flPantalla_({ email: 'j@x' }, 'Hola', c3) === 'Hola' && !guardados.length, 'en WhatsApp no va el bloque');
ctx.AGENTE_CANAL_ = 'llamada';
ok(ctx.flPantalla_({ email: 'j@x' }, 'Te las dejé en el chat', c3) === 'Te las dejé en el chat' && guardados.length === 1 && /\[\[fotos\]\]/.test(guardados[0].texto), 'en una llamada la voz no las lee: van al chat en un mensaje aparte');

/* 5 · el chat. */
const SAChat = require(path.resolve(DIR, '..', 'js', 'sa-chat.js'));
const fo = SAChat.fotos(conB);
ok(fo && fo.texto === 'Esta es la foto.' && fo.fotos.length === 2 && fo.fotos[0].src === 'https://drive.google.com/thumbnail?id=IdDeDrive1xxxxx&sz=w800', 'el chat saca el bloque y arma la miniatura de cada foto');
ok(SAChat.fotos('sin fotos') === null && SAChat.enlaces(fo.texto).length === 0, 'sin bloque no hay galería ni filas de enlaces de más');
process.exit(fallo);
