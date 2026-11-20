/* Prueba de la Guía de camino (apps-script/guia.js, pedido pc1794926294829) sin internet ni Google: el texto que se dice al
   oído, el medio que se recuerda (por lugar y el último), la primera vez pregunta (necesita_modo) y el Modo calle reconoce
   «¿cómo llego a…?». También la ruta del chat (calcular_distancia sin propiedad, #838): enlaces desde su ubicación actual. node .github/guia-camino.js [carpeta apps-script] */
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
    newDirectionFinder: () => { const f = { setLanguage: () => f, setOrigin: () => f, setDestination: () => f, setMode: m => { if (!['driving', 'walking', 'bicycling', 'transit'].includes(m)) throw new Error('Argumento no válido: mode'); pedidoModo = m; return f; }, setDepart: () => f, getDirections: () => ruta }; return f; }
  },
  chatSesAdm_: s => (s ? { email: 'juan@x' } : null) };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'guia.js'), 'utf8'), ctx);
const G = (b) => ctx.guiaCamino_('s', Object.assign({ lat: 14.55, lng: -90.73 }, b));
ok(ctx.guiaTexto_('Gira a la <b>derecha</b><div style="x">El destino está a la izquierda</div>') === 'Gira a la derecha. El destino está a la izquierda.', 'el HTML de Google queda como frase para el oído');
ok(ctx.guiaModo_('voy en Uber') === 'carro' && ctx.guiaModo_('a pie') === 'caminando' && ctx.guiaModo_('en camioneta') === 'bus' && ctx.guiaModo_('bicicleta') === 'bici', 'entiende el medio como lo dice Juan');
ok(G({ destino: 'Parque Central' }).necesita_modo === true, 'la primera vez pregunta el medio');
const r1 = G({ destino: 'Parque Central', modo: 'caminando' });
ok(r1.ok && r1.pasos.length === 2 && r1.minutos === 10 && pedidoModo === 'walking' && !r1.recordado, 'con el medio da la ruta paso a paso');
const r2 = G({ destino: 'parque central' });
ok(r2.ok && r2.modo === 'caminando' && r2.recordado === 'lugar', 'recuerda el medio de ese lugar');
G({ destino: 'Aeropuerto', modo: 'carro' });
ok(G({ destino: 'Oakland Mall' }).recordado === 'ultimo' && G({ destino: 'Oakland Mall' }).modo === 'carro', 'en un lugar nuevo usa el último medio');
ok(G({ destino: 'Parque Central' }).modo === 'caminando', 'el lugar ganó sobre el último');
ok(['carro', 'bici', 'bus', 'caminando'].every(m => G({ destino: 'Parque Central', modo: m }).ok), 'los 4 medios pasan el modo que acepta Google (Maps.DirectionFinder.Mode, en minúsculas)');
ok(ctx.guiaCamino_('', { destino: 'x', lat: 1, lng: 1 }).error === 'session', 'sin sesión no responde');
ok(ctx.guiaPideCamino_('¿Cómo llego al Parque Central?') && ctx.guiaPideCamino_('llévame a la casa de Flor') && !ctx.guiaPideCamino_('anota que llego tarde'), 'el Modo calle reconoce el pedido de camino');
const h = ctx.vozGuiaHerramientas_()[0];
ok(h.type === 'client' && h.name === 'guiar_camino' && /ESTÁS EN LA APP DE ALMA/.test(h.description), 'guiar_camino es herramienta de la app');
ok(h.parameters.properties.donde && h.parameters.properties.donde.type === 'boolean' && /donde: true/.test(h.description) && /ya llegaste/.test(h.description) && /skip_turn/.test(h.description),
   'guardia #946: «¿voy bien?» se pregunta a la app (donde), «ya llegaste» solo con el GPS y «...» es skip_turn');
/* Cómo llegar en el chat (#838): siempre desde su ubicación actual, salvo que nombre otro punto. */
const c1 = ctx.guiaComoLlegar_({ email: 'juan@x' }, { destino: 'Parque Central' });
ok(c1.ok && c1.desde === 'tu ubicación actual' && !/origin=/.test(c1.google) && !/saddr=/.test(c1.apple) && /navigate=yes/.test(c1.waze), 'la ruta sale desde su ubicación actual (sin origen)');
ok(c1.modo === 'caminando' && /travelmode=walking/.test(c1.google) && c1.recordado === 'lugar', 'la ruta usa el medio recordado de ese lugar');
ok(['mi ubicación', 'desde mi ubicación actual', 'aquí', ''].every(o => !/origin=/.test(ctx.guiaComoLlegar_(null, { destino: 'x', origen: o }).google)), '«mi ubicación», «aquí» o vacío = sin origen');
const c2 = ctx.guiaComoLlegar_(null, { destino: 'Oakland Mall', origen: 'Aeropuerto La Aurora', modo: 'en carro' });
ok(/origin=Aeropuerto%20La%20Aurora/.test(c2.google) && /saddr=/.test(c2.apple) && !c2.waze && /travelmode=driving/.test(c2.google), 'otro punto solo si Juan lo nombra');
ok(ctx.guiaComoLlegar_(null, {}).ok === false, 'sin destino no arma enlaces');
const herr = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8');
ok(/T\('calcular_distancia', [^\n]*sin propiedad, mapas desde su ubicación actual \(no preguntes desde dónde\)/.test(herr) && /if \(!String\(inp\.propiedad \|\| ''\)\.trim\(\)\) return guiaComoLlegar_\(adm,/.test(herr), 'en el chat, calcular_distancia sin propiedad sale desde su ubicación actual');

/* Puntos de referencia (pedido pc1795047765857, #839): aviso antes del cruce, el cruce con su referencia y «vas bien». */
const enc = pts => { let lat = 0, lng = 0, o = ''; const e = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  pts.forEach(([a, b]) => { const A = Math.round(a * 1e5), B = Math.round(b * 1e5); o += e(A - lat) + e(B - lng); lat = A; lng = B; }); return o; };
ok(JSON.stringify(ctx.guiaDecodificar_(enc([[14.6, -90.5], [14.601, -90.5]])).map(p => [p.lat, p.lng])) === '[[14.6,-90.5],[14.601,-90.5]]', 'lee la línea de Google');
ok(ctx.guiaRefNombre_({ name: 'Galeno', amenity: 'pharmacy' }).texto === 'la farmacia Galeno' && ctx.guiaRefNombre_({ name: 'Farmacia Galeno', amenity: 'pharmacy' }).texto === 'la Farmacia Galeno' &&
   ctx.guiaRefNombre_({ name: 'La Esquina', shop: 'tobacco' }).texto === 'la tienda de tabacos La Esquina' && ctx.guiaRefNombre_({ name: 'Polo', shop: 'clothes' }).texto === 'la tienda Polo' &&
   ctx.guiaRefNombre_({ name: 'Parqueo X', amenity: 'parking' }) === null, 'nombra la referencia como se dice («la tienda Polo») y descarta parqueos');
ok(ctx.guiaCruza_('Gira a la izquierda hacia 5a Av.') === 'Cruza a la izquierda hacia 5a Av.' && ctx.guiaGiro_('turn-left', '') === 'a la izquierda' && ctx.guiaGiro_('', 'Continúa por 5a Av.') === '', 'cruza a la izquierda, como en Guatemala');
let consultas = 0;
ctx.CacheService = { getScriptCache: () => ({ get: () => null, put: () => {} }) };
ctx.uf_ = (u, o, canal) => { consultas++; return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ elements: [
  { lat: 14.6045, lon: -90.5001, tags: { name: 'Polo', shop: 'clothes' } },
  { lat: 14.6045, lon: -90.5002, tags: { name: 'Parqueo', amenity: 'parking' } },
  { type: 'way', center: { lat: 14.6022, lon: -90.5001 }, tags: { name: 'La Esquina', shop: 'tobacco' } }] }) }; };
const largo = [{ texto: 'Dirígete al norte por 5a Av.', lat: 14.6, lng: -90.5, metros: 500, seg: 400, maniobra: '', tramo: enc([[14.6, -90.5], [14.6045, -90.5]]) },
  { texto: 'Gira a la izquierda hacia 6a Calle.', lat: 14.6045, lng: -90.5, metros: 80, seg: 60, maniobra: 'turn-left', tramo: '' },
  { texto: 'Gira a la derecha en 7a Av.', lat: 14.6045, lng: -90.5007, metros: 50, seg: 40, maniobra: 'turn-right', tramo: '' }];
const cr = ctx.guiaConReferencias_(largo, 'caminando'), tx = cr.pasos.map(p => p.texto);
ok(consultas === 1 && cr.referencias === 2, 'una sola consulta a OpenStreetMap para toda la ruta');
ok(tx[1] === 'Vas bien: vas a ver la tienda de tabacos La Esquina. Sigue recto.' && cr.pasos[1].antes === 60, 'a mitad del tramo largo: «vas bien» con lo que va a ver');
ok(tx[2] === 'Sigue recto hasta la tienda Polo; ahí cruzas a la izquierda. Yo te aviso.' && cr.pasos[2].antes === 120, 'avisa antes del cruce con la referencia');
ok(tx[3] === 'En la tienda Polo, cruza a la izquierda hacia 6a Calle.', 'en el cruce: la referencia primero y la calle después');
ok(tx[4] === 'Cruza a la derecha en 7a Av.' && tx.length === 5, 'un cruce seguido (tramo corto) no lleva aviso ni repite la referencia');
/* Anticipación (Juan, 20-nov-2026): media cuadra caminando y en bici, una cuadra en carro; en bus, normal. */
const conGiro = ps => ps.map(p => Object.assign(p, { giro: ctx.guiaGiroCodigo_(p) }));
const an = ctx.guiaAnticipar_(cr.pasos.map(p => Object.assign({}, p)), 'caminando');
ok(an[3].texto === 'En media cuadra, en la tienda Polo, cruza a la izquierda hacia 6a Calle.' && an[3].antes === 50, 'caminando: el cruce se dice media cuadra antes (50 m), con la referencia primero');
ok(an[4].texto === 'En media cuadra, cruza a la derecha en 7a Av.' && an[4].antes === 50, 'el cruce seguido también media cuadra antes');
ok(an[0].texto === 'Dirígete al norte por 5a Av.' && an[1].antes === 60 && an[2].antes === 120, 'el primer paso, el «vas bien» y el aviso no cambian');
const auto = conGiro([{ texto: 'Dirígete al norte.', lat: 1, lng: 1, metros: 400, maniobra: '' }, { texto: 'Gira a la derecha en 7a Av.', lat: 1.004, lng: 1, metros: 300, maniobra: 'turn-right' }, { texto: 'Gira ligeramente a la izquierda.', lat: 1.005, lng: 1, metros: 30, maniobra: 'turn-slight-left' }]);
const ac = ctx.guiaAnticipar_(auto, 'carro');
ok(ac[1].texto === 'En una cuadra, gira a la derecha en 7a Av.' && ac[1].antes === 100 && ac[2].antes === 100 && ac[2].texto.indexOf('En una cuadra, ') === 0, 'en carro: una cuadra antes (100 m)');
const bi = ctx.guiaAnticipar_(conGiro([{ texto: 'a', lat: 1, lng: 1, metros: 300 }, { texto: 'Gira a la izquierda.', lat: 1.003, lng: 1, metros: 40, maniobra: 'turn-left' }, { texto: 'Gira a la derecha.', lat: 1.0034, lng: 1, metros: 40, maniobra: 'turn-right' }]), 'bici');
ok(bi[1].antes === 50 && /^En media cuadra, gira a la izquierda/.test(bi[1].texto) && bi[2].antes === 25 && /^Ahora, gira a la derecha/.test(bi[2].texto), 'en bici: media cuadra; tras un tramo de 40 m, «ahora»');
const bu = [{ texto: 'Camina.', lat: 1, lng: 1, metros: 300 }, { texto: 'Toma el bus 1.', lat: 1.003, lng: 1, metros: 900, bus: true }];
ok(ctx.guiaAnticipar_(bu.map(p => Object.assign({}, p)), 'bus').every((p, i) => p.texto === bu[i].texto && !p.antes), 'en bus no cambia');
ok(['turn-left', 'turn-right', 'uturn-left', 'roundabout-right', ''].map(m => ctx.guiaGiroCodigo_({ maniobra: m, texto: '' })).join() === 'izquierda,derecha,vuelta,rotonda,recto' &&
   ctx.guiaGiroCodigo_({ bus: true }) === 'bus' && ctx.guiaGiroCodigo_({ antes: 350, texto: 'Prepárate para bajarte.' }) === 'bajar', 'la flecha de cada paso para la pantalla');
const rr = G({ destino: 'Parque Central', modo: 'caminando' });
ok(rr.pasos[1].giro === 'derecha' && rr.pasos[1].texto === 'En media cuadra, cruza a la derecha. El destino está a la izquierda.' && rr.pasos[1].antes === 50 && rr.pasos[0].giro === 'recto', 'la ruta completa manda la flecha y la anticipación');
props.GUIA_REFERENCIAS = '0';
ok(ctx.guiaConReferencias_([{ texto: 'a', lat: 1, lng: 1, metros: 900, tramo: '' }, { texto: 'Gira a la izquierda.', lat: 1.001, lng: 1, metros: 10 }], 'caminando').referencias === 0, 'GUIA_REFERENCIAS = 0 lo apaga');
process.exit(fallo);
