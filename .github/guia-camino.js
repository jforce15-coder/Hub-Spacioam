/* Prueba de la Guía de camino (apps-script/guia.js, pedido pc1794926294829) sin internet ni Google: el texto que se dice al
   oído, el medio que se recuerda (por lugar y el último), la primera vez pregunta (necesita_modo) y el Modo calle reconoce
   «¿cómo llego a…?». node .github/guia-camino.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const props = {};
const ruta = { status: 'OK', routes: [{ overview_polyline: { points: 'abc' }, legs: [{ duration: { value: 600 }, distance: { value: 800 }, end_location: { lat: 14.6, lng: -90.5 },
  steps: [{ travel_mode: 'WALKING', html_instructions: 'Dirígete al <b>norte</b> por <b>5a Av</b>', start_location: { lat: 14.1, lng: -90.1 }, distance: { value: 100 }, duration: { value: 60 } },
          { travel_mode: 'WALKING', html_instructions: 'Gira a la <b>derecha</b><div style="x">El destino está a la izquierda</div>', start_location: { lat: 14.2, lng: -90.2 }, distance: { value: 50 }, duration: { value: 30 } }] }] }] };
let pedidoModo = '';
const ctx = { console, JSON, Date, Math, String, Number, Object, Array, RegExp, isFinite,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  Utilities: { computeDigest: (a, s) => Array.from(crypto.createHash('md5').update(String(s)).digest()), base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'), DigestAlgorithm: { MD5: 'md5' } },
  Maps: {
    newGeocoder: () => { const g = { setLanguage: () => g, setBounds: () => g, geocode: () => ({ status: 'OK', results: [{ formatted_address: 'Parque Central, Antigua Guatemala, Guatemala', geometry: { location: { lat: 14.55, lng: -90.73 } } }] }) }; return g; },
    newDirectionFinder: () => { const f = { setLanguage: () => f, setOrigin: () => f, setDestination: () => f, setMode: m => { pedidoModo = m; return f; }, setDepart: () => f, getDirections: () => ruta }; return f; }
  },
  chatSesAdm_: s => (s ? { email: 'juan@x' } : null) };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'guia.js'), 'utf8'), ctx);
const G = (b) => ctx.guiaCamino_('s', Object.assign({ lat: 14.55, lng: -90.73 }, b));
ok(ctx.guiaTexto_('Gira a la <b>derecha</b><div style="x">El destino está a la izquierda</div>') === 'Gira a la derecha. El destino está a la izquierda.', 'el HTML de Google queda como frase para el oído');
ok(ctx.guiaModo_('voy en Uber') === 'carro' && ctx.guiaModo_('a pie') === 'caminando' && ctx.guiaModo_('en camioneta') === 'bus' && ctx.guiaModo_('bicicleta') === 'bici', 'entiende el medio como lo dice Juan');
ok(G({ destino: 'Parque Central' }).necesita_modo === true, 'la primera vez pregunta el medio');
const r1 = G({ destino: 'Parque Central', modo: 'caminando' });
ok(r1.ok && r1.pasos.length === 2 && r1.minutos === 10 && pedidoModo === 'WALKING' && !r1.recordado, 'con el medio da la ruta paso a paso');
const r2 = G({ destino: 'parque central' });
ok(r2.ok && r2.modo === 'caminando' && r2.recordado === 'lugar', 'recuerda el medio de ese lugar');
G({ destino: 'Aeropuerto', modo: 'carro' });
ok(G({ destino: 'Oakland Mall' }).recordado === 'ultimo' && G({ destino: 'Oakland Mall' }).modo === 'carro', 'en un lugar nuevo usa el último medio');
ok(G({ destino: 'Parque Central' }).modo === 'caminando', 'el lugar ganó sobre el último');
ok(ctx.guiaCamino_('', { destino: 'x', lat: 1, lng: 1 }).error === 'session', 'sin sesión no responde');
ok(ctx.guiaPideCamino_('¿Cómo llego al Parque Central?') && ctx.guiaPideCamino_('llévame a la casa de Flor') && !ctx.guiaPideCamino_('anota que llego tarde'), 'el Modo calle reconoce el pedido de camino');
const h = ctx.vozGuiaHerramientas_()[0];
ok(h.type === 'client' && h.name === 'guiar_camino' && /ESTÁS EN LA APP DE ALMA/.test(h.description), 'guiar_camino es herramienta de la app');
process.exit(fallo);
