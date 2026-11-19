/* Bento vivo (#810; Juan eligió la opción A, 19-nov-2026). Sin navegador, con dobles:
   1. Geometría (js/alma-bento.js, geo): en iPad horizontal y vertical y en la computadora, la roca de siempre (270 px, al
      centro) y lo de debajo (estado, subtítulo, «Chat» y «Llamada») caben en el hueco; ninguna región del bento toca el
      hueco ni los rieles (112 px de cada borde). En el teléfono no hay bento.
   2. Siempre 1 imagen y 1 GIF: el tema (con y sin foto, sin cuadros) y el reposo los traen; sin datos de administrador
      no hay reposo.
   3. GIFs del tema (apps-script/gif.js): al menos 9 temas con 7 cada uno; sin llave, 7 emojis de Noto; con GIPHY, 7
      distintos y todos rating g, guardados en la propiedad (la segunda vez no se busca); el robot solo acepta URLs de
      GIPHY o Noto. La página rota sin repetir hasta agotar los 7 y usa los mismos emojis que el Hub.
   4. alma/inicio.html: con el bento vivo la roca no va a la esquina; los subtítulos llevan su fondo oscuro; el bento se
      esconde con las esferas, las hojas y el chat; la broma (alma-gif.js) tapa el GIF del tema.
   node .github/bento-vivo.js [raíz] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = process.argv[2] || path.join(__dirname, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const BENTO = leer('js/alma-bento.js'), INICIO = leer('alma/inicio.html'), GIF = leer('apps-script/gif.js'), AGIF = leer('js/alma-gif.js');

/* ── un DOM mínimo ── */
function nodo(tag) {
  const n = { tagName: String(tag).toUpperCase(), children: [], style: { setProperty() {} }, attrs: {}, className: '', textContent: '', hidden: false, offsetHeight: 0, offsetTop: 0,
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, contains(c) { return this._s.has(c); }, toggle(c, on) { if (on === undefined ? !this._s.has(c) : on) this._s.add(c); else this._s.delete(c); } },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, insertBefore(c) { return this.appendChild(c); }, removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
  Object.defineProperty(n, 'className', { get() { return [...n.classList._s].join(' '); }, set(v) { n.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); } });
  return n;
}
function todos(n, out) { out = out || []; (n.children || []).forEach((c) => { out.push(c); todos(c, out); }); return out; }
function caja(W, H, o) {
  o = o || {};
  const store = {}, body = nodo('body'), raiz = nodo('html');
  raiz.clientWidth = W;
  const document = { body, documentElement: raiz, createElement: nodo, createTextNode: (t) => ({ textContent: t }), querySelector: () => null, querySelectorAll: () => [] };
  const window = { innerWidth: W, innerHeight: H, matchMedia: () => ({ matches: false }), addEventListener() {}, getComputedStyle: () => ({ paddingTop: '0', paddingRight: '0', paddingBottom: '0', paddingLeft: '0' }),
    SANav: { datos: () => o.datos || {} }, ALMA: null, SAAuth: null };
  const ctx = { window, document, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, getComputedStyle: window.getComputedStyle,
    requestAnimationFrame: (f) => f(), setTimeout: (f) => f(), clearTimeout() {}, Date, Math, JSON, String, Number, Object, Array, RegExp, fetch: () => Promise.reject(new Error('sin red')) };
  vm.createContext(ctx); vm.runInContext(BENTO, ctx);
  return { B: window.AlmaBento, window, document, store };
}
const choca = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* 1 · geometría */
for (const [n, W, H] of [['iPad horizontal', 1366, 1024], ['iPad 11 horizontal', 1180, 820], ['computadora', 1440, 900], ['computadora chica', 1280, 720], ['iPad vertical', 1024, 1366]]) {
  const g = caja(W, H).B.geo();
  if (!g) { ok(false, `1 · ${n} (${W}×${H}): hay bento`); continue; }
  ok(Math.round(g.D) === Math.round(Math.min(W * .66, H * .4, 270)), `1 · ${n}: la roca con su tamaño de siempre (${Math.round(g.D)} px)`);
  const h = g.hueco, roca = { x: g.cx - g.D / 2 - 9, y: g.cy - g.D / 2 - 9, w: g.D + 18, h: g.D + 18 };
  ok(roca.x >= h.x && roca.x + roca.w <= h.x + h.w && roca.y + roca.h <= h.y + h.h, `1 · ${n}: la roca (con su anillo) cabe en el hueco`);
  const uiB = H * .44 + Math.min(W * .33, H * .2, 135) + 34 + 190;
  ok(h.y + h.h >= uiB && h.w >= 420, `1 · ${n}: el subtítulo de 2 líneas y «Chat»·«Llamada» caben en el hueco (hasta ${Math.round(h.y + h.h)} px, ${Math.round(h.w)} de ancho)`);
  const regs = [g.L, g.R, g.B].filter(Boolean);
  ok(regs.every((r) => !choca(r, h)), `1 · ${n}: ninguna región toca el hueco`);
  ok(regs.every((r) => r.x >= 112 && r.x + r.w <= W - 112 && r.w > 0 && r.h > 0), `1 · ${n}: los rieles de los bordes quedan libres`);
}
ok(!caja(390, 844).B.geo() && !caja(820, 1180).B.geo(), '1 · en el teléfono y el iPad chico vertical no hay bento (no cambia)');

/* 2 · siempre 1 imagen y 1 GIF */
function piezasDe(t, W, H, o) {
  const c = caja(W || 1366, H || 1024, o);
  const ov = nodo('div'); ov.querySelector = () => null;
  c.document.querySelector = (s) => (/san-ov$/.test(s) ? ov : null);
  const render = { cuadro: (x) => { const e = nodo('div'); e.className = 'tvb-t tvb-' + x.tipo; if (x.tipo === 'foto' && x.avatar) e.appendChild(Object.assign(nodo('span'), { className: 'tvb-av' })); return e; }, claudio: t && t.tipo === 'claudio' ? nodo('section') : null };
  if (t) c.B.tema(t, render); else c.B.iniciar({});
  const els = todos(ov).filter((x) => x.classList && x.classList.contains('bv-c'));
  const cls = els.map((x) => x.children[0] && x.children[0].className || '');
  return { cls, n: els.length, B: c.B };
}
const FOTO = { id: 'foto', tipo: 'foto', tam: 'alto', prioridad: 1, fondo: 'https://x/apto.jpg', de: 'apartamento', iniciales: 'VR' };
const DATOS = [{ id: 'fechas', tipo: 'dato', tam: 's', prioridad: 2, k: 'Fechas', v: '19 → 22 nov' }, { id: 'responder', tipo: 'mensaje', tam: 'ancho', prioridad: 2, texto: 'Hola' }, { id: 'mapa', tipo: 'mapa', tam: 'm', prioridad: 5, lat: 14.6, lng: -90.5 }];
const casos = [
  ['reserva con foto', { id: 'a', tipo: 'reserva', titulo: 'Valeria', cuadros: [FOTO].concat(DATOS) }],
  ['reserva sin foto', { id: 'b', tipo: 'reserva', titulo: 'Valeria', cuadros: [{ id: 'foto', tipo: 'foto', tam: 'm', prioridad: 1, iniciales: 'VR' }].concat(DATOS) }],
  ['apartamento solo con galería', { id: 'c', tipo: 'apartamento', titulo: '302', cuadros: [{ id: 'galeria', tipo: 'galeria', fotos: ['https://x/1.jpg'] }, DATOS[0]] }],
  ['tarjeta de antes (sin cuadros)', { id: 'd', tipo: 'conversacion', titulo: 'Luis', mensajes: [{ texto: 'Hola' }] }],
  ['Claudio', { id: 'e', tipo: 'claudio', titulo: 'Trabajos', cuadros: [] }]
];
for (const vista of [[1366, 1024], [1440, 900], [1024, 1366]]) {
  for (const [n, t] of casos) {
    const p = piezasDe(t, vista[0], vista[1]);
    const img = p.cls.filter((c) => /tvb-foto|tvb-galeria|bv-marca/.test(c)).length, gif = p.cls.filter((c) => /bv-gif/.test(c)).length;
    ok(img >= 1 && gif === 1, `2 · ${n} (${vista.join('×')}): ${img} imagen y ${gif} GIF (${p.cls.join(' | ')})`);
  }
}
{
  const conDatos = piezasDe(null, 1366, 1024, { datos: { pend: { atencion: [{ id: 'p1', titulo: 'Aprobar precio' }] }, noti: { items: [] } } });

  ok(conDatos.cls.some((c) => /bv-marca/.test(c)) && conDatos.cls.filter((c) => /bv-gif/.test(c)).length === 1 && conDatos.n >= 3, '2 · reposo: el bento del Hub con su imagen, su GIF y lo de Pendientes y avisos');
  const sin = piezasDe(null, 1366, 1024, { datos: {} });
  ok(sin.n === 0, '2 · sin datos de administrador no hay bento en el reposo');
}

/* 3 · GIFs del tema */
function cajaGif(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), pedidos = [];
  const ctx = { console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    Utilities: { base64EncodeWebSafe: (b) => Buffer.from(String(b)).toString('base64'), computeDigest: (a, s) => s, DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' } },
    uf_: (url) => { pedidos.push(url); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ data: o.giphy || [] }) }; },
    vozWebAdmin_: (s) => (s === 'admin' ? { email: 'a@x' } : null), paraClaudePrincipalSes_: () => true };
  vm.createContext(ctx); vm.runInContext(GIF, ctx);
  return { X: ctx, props, pedidos };
}
{
  const { X, pedidos } = cajaGif();
  const temas = Object.keys(X.GIF_TEMAS_);
  const pide = ['huesped', 'salida', 'limpieza', 'mantenimiento', 'cobro', 'socio', 'buena_noticia', 'reserva_nueva'];
  ok(temas.length >= 9 && pide.every((t) => temas.includes(t)), '3 · los temas que pidió Juan y más: ' + temas.join(', '));
  ok(temas.every((t) => X.GIF_TEMAS_[t].e.length === 7 && new Set(X.GIF_TEMAS_[t].e).size === 7), '3 · 7 emojis distintos por tema');
  const c = X.gifTemas_();
  ok(c.ok && c.por_tema === 7 && temas.every((t) => c.temas[t].gifs.length === 7 && c.temas[t].fuente === 'emoji') && !pedidos.length, '3 · sin llave de GIPHY: 7 emojis por tema y ninguna llamada a internet');
  ok(!X.gifTemasApi_('otro').ok && X.gifTemasApi_('admin').ok, '3 · gifTemas solo con sesión de administrador');
  /* la página usa los mismos emojis que el Hub */
  const m = BENTO.match(/var EMOJIS = (\{[\s\S]*?\});/); let E = null; try { E = vm.runInNewContext('(' + m[1] + ')'); } catch (e) {}
  ok(E && temas.every((t) => JSON.stringify(E[t]) === JSON.stringify(X.GIF_TEMAS_[t].e)), '3 · js/alma-bento.js tiene los mismos 7 emojis por tema que gif.js');
}
{
  const g = (i, r) => ({ id: 'g' + i, rating: r || 'g', title: 'gif ' + i, images: { downsized_medium: { url: 'https://media.giphy.com/media/g' + i + '/giphy.gif' } } });
  const giphy = [g(1), g(2, 'pg'), g(3), g(3), g(4), g(5), g(6, 'pg-13'), g(7), g(8), g(9), g(10)];
  const { X, props, pedidos } = cajaGif({ props: { GIPHY_KEY: 'k' }, giphy });
  const c = X.gifTemas_();
  const llenos = Object.keys(c.temas).filter((t) => c.temas[t].fuente === 'giphy');
  ok(llenos.length === 4 && pedidos.length === 4, '3 · con GIPHY: se eligen como mucho 4 temas por vez (' + llenos.join(', ') + ')');
  const l = c.temas[llenos[0]].gifs.map((x) => x.url);
  ok(l.length === 7 && new Set(l).size === 7 && !l.some((u) => /g2\/|g6\//.test(u)), '3 · 7 GIFs distintos y solo rating g');
  ok(/rating=g/.test(pedidos[0]), '3 · la búsqueda pide rating g');
  const n = pedidos.length; X.gifTemas_(); X.gifTemas_(); X.gifTemas_();
  const n2 = pedidos.length; X.gifTemas_();
  ok(pedidos.length === n2 && JSON.parse(props.GIF_TEMAS).huesped.length === 7, '3 · elegidos una vez y guardados en GIF_TEMAS: después no se buscan (' + n + ' → ' + n2 + ' pedidos en total)');
  const r1 = X.gifTemasRobot_({ tema: 'huesped', urls: ['https://evil.example/x.gif', 'https://media.giphy.com/media/a/giphy.gif'] });
  ok(!r1.ok, '3 · el robot no acepta URLs que no sean de GIPHY o Noto, ni menos de 7');
  const urls = [1, 2, 3, 4, 5, 6, 7].map((i) => 'https://media.giphy.com/media/m' + i + '/giphy.gif');
  const r2 = X.gifTemasRobot_({ tema: 'limpieza', urls });
  ok(r2.ok && JSON.parse(props.GIF_TEMAS).limpieza[0].url === urls[0], '3 · el robot cambia los 7 de un tema sin PR');
}
{
  const c = caja(1366, 1024);
  const vistos = []; for (let i = 0; i < 7; i++) vistos.push(c.B.siguienteGif('huesped').url);
  ok(new Set(vistos).size === 7, '3 · la página rota los 7 sin repetir hasta agotarlos');
  const sig = c.B.siguienteGif('huesped').url;
  ok(sig !== vistos[6], '3 · la vuelta nueva no empieza con el último que se vio');
  const T = (t) => c.B.temaGif(t);
  ok(T({ tipo: 'reserva', titulo: 'Ana', cuadros: [] }) === 'huesped' && T({ tipo: 'socio' }) === 'socio' && T({ tipo: 'claudio' }) === 'claudio' &&
    T({ tipo: 'reserva', cuadros: [{ tipo: 'foco', problema: 'El agua caliente no funciona' }] }) === 'mantenimiento' && T({ tipo: 'consulta' }) === 'reserva_nueva' && T(null) === 'reposo',
    '3 · el tema del GIF sale de la tarjeta sin IA (huésped, socio, Claudio, mantenimiento, reserva nueva, reposo)');
}

/* 4 · la página */
ok(/function pintarVivo\(t, v\)[\s\S]{0,200}roca\(null\)/.test(INICIO) && !/function pintarVivo[\s\S]{0,900}roca\("esquina"\)/.test(INICIO), '4 · con el bento vivo la roca se queda al centro (nunca a la esquina)');
ok(/html\.bv-on #sa-nav-root \.san-ov-cap:not\(:empty\) \{ background: rgba\(34,26,28,\.7\d\)/.test(INICIO), '4 · los subtítulos llevan su fondo oscuro sobre el bento (blanco sobre ~#3A3032, AA)');
ok(/body\.orbita-on \.bv,[^{]*body\.san-hoja \.bv,[^{]*\.san-ov\.chat \.bv/.test(INICIO), '4 · el bento se esconde con las esferas y sus niveles, las hojas y el chat');
ok(/AlmaBento\.gifCuadro/.test(AGIF), '4 · la broma tapa el GIF del tema (alma-gif.js)');
ok(/alma-bento\.js\?v=/.test(INICIO), '4 · alma/inicio.html carga js/alma-bento.js');
process.exit(fallo);
