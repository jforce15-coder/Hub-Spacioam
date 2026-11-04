/* Prueba de la respuesta con fuentes (apps-script/fuentes.js) con dobles: sin internet, sin Google, sin Hospitable ni Epi.
   1. Ignacio 301 (3 y 4-nov): «¿hay TV en cada habitación?». La ficha y el anuncio no lo dicen claro; las fotos de la
      limpieza más reciente sí: Alma responde sola, con cautela («En las fotos del apartamento se ve…»), la fuente queda en
      la razón (registro) y en ALMA_FUENTES, y la segunda vez sale de la caché sin leer fotos.
   2. Las fotos no se ven claras: escala como siempre (sigue en AMARILLO) y el caso dice qué se revisó.
   3. Un tema prohibido (dinero, descuento, códigos, daños, quejas…): siempre escala, sin leer ninguna fuente.
   También: a lo mucho 8 fotos, la más reciente primero, y nunca las de otro apartamento.
   node .github/respuesta-fuentes.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

function hoja(cab) {
  const filas = [cab.slice()];
  return { filas, getLastRow: () => filas.length, appendRow: r => { filas.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({ getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = filas[r - 1 + i] || []; out.push(Array.from({ length: nc }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; } }) };
}
const drive = id => 'https://drive.google.com/uc?id=' + id + '&export=view';
/* Reportes de Epi: dos limpiezas de Ignacio 301 (la más nueva con 6 habitaciones para probar el tope de 8) y una de 1301. */
const REPORTES = [
  { id: 'r-viejo', propiedad: 'Z10 - Ignacio - 301', categoria: 'Limpieza tradicional', fecha: '2026-10-20' },
  { id: 'r-nuevo', propiedad: 'Z10 - Ignacio - 301', categoria: 'Limpieza tradicional', fecha: '2026-10-30' },
  { id: 'r-otro', propiedad: 'Z10 - Ignacio - 1301', categoria: 'Limpieza tradicional', fecha: '2026-11-02' },
  { id: 'r-dano', propiedad: 'Z10 - Ignacio - 301', categoria: 'Reporte de Daños', fecha: '2026-11-01' }
];
const DETALLE = {
  'r-nuevo': { fecha: '2026-10-30', fotosTv: drive('tvSala1030xx'), fotosSalaGeneral: drive('sala1030xxxx'),
    fotosHabitaciones: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(x => drive(x + '1030xxxxx')) },
  'r-viejo': { fecha: '2026-10-20', fotosTv: drive('tvSala1020xx'), fotosHabitaciones: [drive('h11020xxxxx')] },
  'r-otro': { fecha: '2026-11-02', fotosTv: drive('otroApto1301') }
};

function caja(vision) {
  const llamadas = { claude: [], hosp: [], epi: [], drive: 0 };
  let fuentes = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp,
    CFG: { MODELO_CLASIFICADOR: 'rapido', MODELO_REDACTOR: 'vision' },
    s_: v => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    celdaTexto_: x => String(x == null ? '' : x),
    tokProp_: s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(t => t && ['apto', 'apt', 'apartamento', 'unidad', 'casa', 'de', 'la', 'el'].indexOf(t) === -1),
    listingsPlano_: o => ({ 'summary': JSON.stringify(o) }),
    hojaCrear_: (nombre, cab) => (fuentes = fuentes || hoja(cab)),
    hosp_: (m, ruta) => { llamadas.hosp.push(ruta);
      if (/\/images$/.test(ruta)) return { code: 200, json: { data: Array.from({ length: 12 }, (_, i) => ({ url: 'https://assets.prueba/big' + i + '.jpg', thumbnail_url: 'https://assets.prueba/t' + i + '.jpg', order: i })) } };
      return { code: 200, json: { data: { summary: '2 comfortable rooms, fully equipped kitchen, Wi-Fi' } } }; },
    epiPost_: (accion, p) => { llamadas.epi.push(accion + (p && p.id ? ':' + p.id : ''));
      if (accion === 'getAll') return { ok: true, data: { reports: REPORTES } };
      return { ok: true, data: { report: DETALLE[p.id] || null } }; },
    ScriptApp: { getOAuthToken: () => 'token-prueba' },
    Utilities: { base64Encode: b => 'b64:' + b },
    ufAll_: pedidos => { llamadas.drive += pedidos.length; return pedidos.map(p => ({ getResponseCode: () => 200, getBlob: () => ({ getContentType: () => 'image/jpeg', getBytes: () => (p.url.match(/id=([\w-]+)/) || [])[1] }) })); },
    claude_: (modelo, max, sys, usr, temp, imgs, maxFotos) => {
      llamadas.claude.push({ modelo, usr, imgs: imgs || [], maxFotos });
      if (!imgs) return '{"claro": false, "respuesta": "", "fuente": "ficha", "duda": "la ficha no habla de televisores"}';
      return vision(usr, imgs);
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'fuentes.js'), 'utf8'), ctx);
  return { ctx, llamadas, fuentes: () => fuentes };
}
const caso = texto => ({ resId: 'res-301', propiedad: 'Z10 - Ignacio - 301', propId: 'b32c-prueba', nivel: 'AMARILLO', razon: 'pregunta por televisores',
  texto, propiedadInfo: 'Piso: 3\nParqueo: 1 vehículo', conocimiento: '## Check-in\n15:00', instrucciones: '' });

/* La visión: en las fotos del anuncio no se ven las habitaciones; en las de limpieza, sí. */
const visionIgnacio = (usr, imgs) => /anuncio/.test(usr)
  ? '{"claro": false, "respuesta": "una TV en la sala", "fotos_usadas": [2], "duda": "no se ven las habitaciones"}'
  : '{"claro": true, "respuesta": "una TV en la sala y otra en la habitación principal", "fotos_usadas": [1, 3]}';

/* 1 · Ignacio 301, resuelto con las fotos de limpieza. */
{ const c = caja(visionIgnacio), x = caso('Hola! una pregunta, ¿hay TV en cada habitación?');
  const r = c.ctx.respuestaConFuentes_(x);
  ok(r.estado === 'respondida' && r.fuente === 'fotos de limpieza del 2026-10-30', 'Ignacio 301: responde con las fotos de limpieza (' + r.fuente + ')');
  ok(x.nivel === 'VERDE', 'pasa a VERDE: no se llama al equipo');
  ok(/En las fotos del apartamento se ve/.test(x.instrucciones) && /una TV en la sala y otra en la habitación principal/.test(x.instrucciones) && /No digas que lo confirmas con el equipo/.test(x.instrucciones), 'el redactor recibe la respuesta, con cautela y sin seguimiento');
  ok(/respuesta con fuentes: fotos de limpieza del 2026-10-30/.test(x.razon), 'la fuente queda en la razón del registro');
  const vistas = c.llamadas.claude.filter(k => k.imgs.length);
  ok(vistas.length === 2 && vistas[0].usr.indexOf('anuncio') !== -1, 'orden: lo escrito, después las fotos del anuncio y al final las de limpieza');
  ok(vistas.every(k => k.imgs.length <= 8 && k.maxFotos === 8), 'a lo mucho 8 fotos por consulta (' + vistas.map(k => k.imgs.length).join(' y ') + ')');
  const limpieza = vistas[1];
  ok(/1030/.test(limpieza.imgs[0]) && limpieza.imgs.every(u => /^data:image\/jpeg;base64,/.test(u)), 'fotos de limpieza: la más reciente primero, bajadas de Drive como miniatura');
  ok(!limpieza.imgs.some(u => /otroApto1301/.test(u)) && c.llamadas.epi.indexOf('getReport:r-otro') === -1 && c.llamadas.epi.indexOf('getReport:r-dano') === -1, 'nunca las de otro apartamento (1301) ni las de un reporte de daños');
  ok(/Sala, TV encendida|sala, TV encendida/.test(limpieza.usr), 'cada foto va con su etiqueta (en qué cuarto se tomó)');
  const fila = c.fuentes().filas[1];
  ok(fila && fila[1] === 'Z10 - Ignacio - 301' && fila[2] === 'tv_por_cuarto' && fila[4] === 'respondida' && /fotos de limpieza/.test(fila[6]), 'ALMA_FUENTES guarda propiedad, «tv_por_cuarto», respuesta y fuente');
  ok(Date.parse(fila[9]) - Date.now() > 29 * 86400000, 'la respuesta vale 30 días');
  /* Segunda pregunta parecida, otro huésped: sale de la caché, sin leer fotos. */
  const antes = c.llamadas.claude.length, drv = c.llamadas.drive, y = caso('Do both bedrooms have a TV?');
  const r2 = c.ctx.respuestaConFuentes_(y);
  ok(r2.estado === 'respondida' && r2.cache && c.llamadas.claude.length === antes && c.llamadas.drive === drv, 'la segunda vez sale de la caché: ninguna foto se vuelve a leer');
  ok(y.nivel === 'VERDE' && /\(guardada\)/.test(y.razon), 'la caché también queda anotada en la razón'); }

/* 2 · Las fotos no se ven claras o se contradicen: escala como ahora. */
{ const c = caja(() => '{"claro": false, "respuesta": "", "fotos_usadas": [], "duda": "en una foto hay TV en la habitación y en la otra no"}'), x = caso('¿Hay televisión en el cuarto?');
  const r = c.ctx.respuestaConFuentes_(x);
  ok(r.estado === 'dudosa' && x.nivel === 'AMARILLO', 'con duda: sigue en AMARILLO y va al equipo');
  ok(!/RESPUESTA CON FUENTES/.test(x.instrucciones), 'el redactor no recibe ninguna respuesta inventada');
  ok(/Alma revisó/.test(x.fuentesNota) && /fotos de limpieza/.test(x.fuentesNota) && /no se ve claro/.test(x.fuentesNota), 'el caso dice qué se revisó: «' + x.fuentesNota + '»');
  ok(c.fuentes().filas[1][4] === 'dudosa' && Date.parse(c.fuentes().filas[1][9]) - Date.now() < 4 * 86400000, 'la duda se guarda 3 días');
  const sinFotos = caja(visionIgnacio);
  sinFotos.ctx.epiPost_ = () => ({ ok: true, data: { reports: [] } });
  sinFotos.ctx.hosp_ = () => ({ code: 404, json: null });
  const z = caso('¿Hay TV en las habitaciones?'), rz = sinFotos.ctx.respuestaConFuentes_(z);
  ok(rz.estado === 'sin_dato' && z.nivel === 'AMARILLO' && /no lo encontró/.test(z.fuentesNota), 'sin fotos ni dato: escala igual, con «no lo encontró»'); }

/* 3 · Tema prohibido: siempre escala, sin mirar ninguna fuente. */
{ const prohibidos = ['Si no hay TV en el cuarto, ¿me hacen un descuento?', '¿Cuál es el código de la puerta? Quiero ver la tele', 'La TV de la habitación está rota',
    'Quiero poner una queja: la cama es muy pequeña', '¿Cuánto cuesta la noche extra con jacuzzi?', '¿Puedo traer mi perro? ¿Hay patio?', '¿Me pueden traer toallas extra?'];
  prohibidos.forEach(t => {
    const c = caja(visionIgnacio), x = caso(t), r = c.ctx.respuestaConFuentes_(x);
    ok(r.estado === 'prohibido' && x.nivel === 'AMARILLO' && !c.llamadas.claude.length && !c.llamadas.hosp.length && !c.llamadas.epi.length && !c.fuentes(), 'prohibido, escala sin leer nada: «' + t + '»');
  });
  const c = caja(visionIgnacio), x = Object.assign(caso('¿Hay TV en el cuarto?'), { nivel: 'ROJO' });
  ok(c.ctx.respuestaConFuentes_(x).estado === 'no_aplica' && !c.llamadas.claude.length, 'un ROJO nunca pasa por aquí');
  const w = caja(visionIgnacio);
  ok(w.ctx.respuestaConFuentes_(caso('¿A qué hora puedo llegar mañana?')).estado !== 'respondida' && !w.llamadas.claude.length, 'lo que no es una pregunta de la propiedad no gasta nada'); }

process.exit(fallo);
