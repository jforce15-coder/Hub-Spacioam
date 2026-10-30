/* ═══ BOTS DE PRUEBA ═══════════════════════════════════════════════════════════════════════════════════════
   Usuarios ficticios que entran a cada página del Hub y de la app de Alma después de un cambio y la usan como
   personas distintas: con teléfono chico o grande, apurados, sin internet, escribiendo cosas raras a propósito, o con el
   servidor fallando. Buscan errores, problemas de visualización y de formato, botones tapados o muy chicos, cosas
   que se salen de la pantalla e imágenes rotas.

   NO DEJAN NINGÚN REGISTRO: todo lo que va al servidor (Apps Script, login, WhatsApp, cualquier POST) se responde aquí
   mismo con datos de prueba; nada sale a internet salvo leer archivos (fuentes, librerías). Cada bot usa un navegador
   nuevo y vacío que se borra al terminar.

   Uso:  node bots.mjs                     prueba esta copia del repositorio (antes de unir un PR)
         node bots.mjs --vivo              prueba hub.spacioam.com ya publicado (después de unir), igual sin registros
         node bots.mjs --paginas alma/inicio.html,alma/correos.html
   Deja: salida/informe.md (para el PR o el aviso), salida/informe.json y capturas de lo que falló. */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'pruebas', 'salida');
const ARG = process.argv.slice(2);
const VIVO = ARG.includes('--vivo');
const SOLO = (ARG[ARG.indexOf('--paginas') + 1] || '').split(',').filter((x) => ARG.includes('--paginas') && x);

/* Las páginas: todas las .html del repositorio menos el sistema de diseño, herramientas y redirecciones. */
const FUERA = /^(ds|tools|assets|login|correo-puente|pruebas|apps-script)\/|^(design-system|claude|diagnostico)\.html$|alma\/google\.html$/;
function paginas() {
  if (SOLO.length) return SOLO;
  const out = [];
  (function andar(d) {
    for (const f of fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true })) {
      const r = path.posix.join(d, f.name);
      if (f.name.startsWith('.') || f.name === 'node_modules') continue;
      if (f.isDirectory()) { if (!FUERA.test(r + '/')) andar(r); }
      else if (f.name.endsWith('.html') && !FUERA.test(r)) out.push(r);
    }
  })('');
  return out.sort();
}

/* ── Los usuarios ficticios ── */
const RARO = ['', ' ', 'a'.repeat(4000), '😀🏠🔑✨'.repeat(30), '<img src=x onerror=alert("xss-bot")>', '"; DROP TABLE reservas; --', '../../etc/passwd', '-1', '9'.repeat(40), 'ñandú ÁÉÍÓÚ ü'];
const BOTS = [
  { id: 'ana', nombre: 'Ana · iPhone SE', disp: devices['iPhone SE'], estilo: 'normal' },
  { id: 'beto', nombre: 'Beto · iPhone Pro Max, impaciente', disp: devices['iPhone 15 Pro Max'], estilo: 'apurado' },
  { id: 'carla', nombre: 'Carla · iPad, se queda sin internet', disp: devices['iPad (gen 7)'], estilo: 'sin_red' },
  { id: 'dani', nombre: 'Dani · computadora, escribe cosas raras', disp: { viewport: { width: 1280, height: 800 } }, estilo: 'raro' },
  { id: 'eli', nombre: 'Eli · iPhone, el servidor falla', disp: devices['iPhone 13'], estilo: 'servidor_falla' }
];

/* ── Un servidor falso: responde lo que el Hub respondería, con datos de prueba ── */
const AHORA = new Date().toISOString();
const PERFIL = { email: 'bot@prueba.spacioam.com', nombre: 'Bot de Prueba', primer_nombre: 'Bot', apps: { hub: 'admin_principal', alma: 'admin_principal' } };
const FICHA = {
  verify: { ok: true, profile: PERFIL },
  areas: { ok: true, sin_clasificar: 1, archivadas: 0,
    areas: ['proposito', 'relaciones', 'finanzas', 'health', 'comunidad', 'espiritualidad'].map((k, i) => ({ k, n: ['Propósito', 'Relaciones', 'Finanzas', 'Health', 'Comunidad', 'Esencia'][i], d: 'Área de prueba', total: 1,
      proyectos: i ? [] : [{ k: 'spacio', n: 'Spacio AM', d: 'Proyecto de prueba', apps: [{ n: 'Hub', d: 'Centro', url: 'https://hub.spacioam.com' }] }],
      conversaciones: [{ clave: 'alma:p' + i, titulo: 'Conversación de prueba con un título bastante largo para ver si se corta bien', fuente: 'Alma · Chat', texto: 'Texto de prueba', ts: AHORA, guardado: 'temporal', vence: AHORA }] })),
    cajones: ['ideas', 'interes', 'ocio'].map((k) => ({ k, n: k, d: 'Cajón de prueba', proyectos: [], conversaciones: [], total: 0 })) },
  agentes: { ok: true, agentes: [{ id: 'operaciones', nombre: 'Operaciones', rol: 'Jefe de operaciones', mision: 'Prueba', horas: '7', dias: '1,2,3', estado: 'activo', presupuesto_usd: 10, gasto_mes: 1.5, ultima: AHORA, informe: 'Informe de prueba' }], propuestas: [] },
  correos: { ok: true, resumen: { responder: 1, autorizacion: 1, leer: 1, fyi: 1, seguimiento: 1 },
    hilos: [{ hilo: 'h1', cuenta: 'bot@prueba.spacioam.com', asunto: 'Reserva de diciembre', estado: 'borrador', borrador: 'Hola Ana, gracias por escribir.\n\nAlma\nSpacio AM', actualizado: AHORA },
      { hilo: 'h2', cuenta: 'bot@prueba.spacioam.com', asunto: 'Cotización de limpieza', estado: 'enviado', borrador: '', actualizado: AHORA, seguimiento: true }], cuentas: [{ cuenta: 'bot@prueba.spacioam.com', proyecto: 'Spacio AM', ultima: AHORA, entrega: {} }],
    responder: [{ id: 'c1', cuenta: 'bot@prueba.spacioam.com', de: 'huesped@ejemplo.com', de_nombre: 'Huésped de Prueba', asunto: '¿Tienen disponibilidad?', fragmento: 'Hola, quisiera saber…', fecha: AHORA, urgente: 'si' }],
    codigos: [{ de_nombre: 'Servicio', asunto: 'Tu código', codigo: '123456', cuenta: 'bot@prueba.spacioam.com', fecha: AHORA }],
    verificacion: [{ id: 'v1', de_nombre: 'Notion', asunto: 'Confirma tu correo', enlace: '#', cuenta: 'bot@prueba.spacioam.com', fecha: AHORA }],
    autorizacion: [{ id: 'a1', de_nombre: 'Banco de Prueba', asunto: 'Aprueba el cargo de US$120', fragmento: 'Compra en línea', enlace: '#', cuenta: 'bot@prueba.spacioam.com', fecha: AHORA }],
    proyectos: [{ k: 'Spacio AM', n: 'Spacio AM', total: 1, correos: [{ id: 'p1', asunto: 'Llegada tarde', de: 'x@ejemplo.com', cuenta: 'bot@prueba.spacioam.com', fecha: AHORA }] }],
    fyi: [{ id: 'f1', asunto: 'Recibo de pago', de: 'recibos@ejemplo.com', cuenta: 'bot@prueba.spacioam.com', fecha: AHORA }],
    promociones: [{ de: 'ofertas@ejemplo.com', de_nombre: 'Tienda', cuenta: 'bot@prueba.spacioam.com', total: 4, spam: 0.1, desuscribir: true, correos: [{ id: 'pr1', asunto: '50% de descuento', fragmento: 'Solo hoy' }] }],
    spam: [{ de: 'premio@ejemplo.biz', de_nombre: 'Premios', cuenta: 'bot@prueba.spacioam.com', total: 2, spam: 0.9, desuscribir: true, correos: [{ id: 's1', asunto: '¡Ganaste!', fragmento: 'Reclama ya' }] }] }
};
function respuesta(cuerpo, estilo, n) {
  if (estilo === 'servidor_falla') {   // a propósito: errores, respuestas rotas y lentitud
    const m = n % 3;
    if (m === 0) return { status: 500, body: 'Error interno de prueba' };
    if (m === 1) return { status: 200, body: '{"ok": tru' };
    return { status: 200, body: JSON.stringify({ ok: false, error: 'Falla de prueba del servidor' }), lento: 6000 };
  }
  let b = {}; try { b = JSON.parse(cuerpo || '{}'); } catch (e) {}
  const j = FICHA[b.action] || { ok: true, prueba: true };
  return { status: 200, body: JSON.stringify(j) };
}

/* ── Servidor local (para probar esta copia del repositorio) ── */
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json' };
function servir() {
  return new Promise((ok) => {
    const tipos = TIPOS;
    const s = http.createServer((q, r) => {
      let f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]));
      if (!f.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no existe'); }
      r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => ok({ s, base: 'http://127.0.0.1:' + s.address().port + '/' }));
  });
}

/* ── Lo que se revisa en cada pantalla ── */
async function revisar(page, tapados) {
  return page.evaluate((tapados) => {
    const W = innerWidth, H = innerHeight, out = { desborde: [], tapados: [], chicos: [], imagenes: [], cortados: [], vacia: false };
    /* visible de verdad: ni él ni ningún contenedor está oculto, transparente o marcado como escondido (paneles cerrados) */
    const visible = (e) => {
      const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false;
      for (let x = e; x && x.nodeType === 1; x = x.parentElement) {
        const s = getComputedStyle(x);
        if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity <= .05 || x.getAttribute('aria-hidden') === 'true' || x.hidden || x.inert) return false;
      }
      return true;
    };
    const nombre = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (e.textContent ? ' «' + e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) + '»' : ''));
    if (document.documentElement.scrollWidth > W + 2)
      [...document.body.querySelectorAll('*')].filter((e) => visible(e) && e.getBoundingClientRect().right > W + 2 && getComputedStyle(e).position !== 'fixed').slice(0, 4).forEach((e) => out.desborde.push(nombre(e)));
    for (const e of document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, textarea')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
      const enTexto = e.tagName === 'A' && e.closest('p, li, small, span') && !e.closest('nav');
      if (!enTexto && (r.width < 30 || r.height < 30)) out.chicos.push(nombre(e) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
      const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(H - 1, Math.max(0, r.top + r.height / 2)), t = document.elementFromPoint(x, y);
      if (tapados && t && t !== e && !e.contains(t) && !t.contains(e) && getComputedStyle(t).pointerEvents !== 'none') out.tapados.push(nombre(e) + ' (lo tapa ' + nombre(t) + ')');
    }
    for (const i of document.images) if (i.complete && i.naturalWidth === 0 && visible(i) && i.src) out.imagenes.push(i.src.slice(0, 90));
    for (const e of document.querySelectorAll('button, h1, h2, h3, h4, .btn')) {
      if (!visible(e)) continue; const s = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 2 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis' && !s.webkitLineClamp) out.cortados.push(nombre(e));
    }
    out.vacia = !document.body || (document.body.innerText.trim().length < 2 && !document.querySelector('canvas, svg, img, video'));
    out.tapados = out.tapados.slice(0, 6); out.chicos = out.chicos.slice(0, 6); out.cortados = out.cortados.slice(0, 6);
    return out;
  }, tapados);
}

/* ── Un bot en una página ── */
async function probar(browser, base, pag, bot) {
  const hallazgos = [], anota = (nivel, que, detalle) => hallazgos.push({ pagina: pag, bot: bot.nombre, nivel, que, detalle: String(detalle || '').slice(0, 300) });
  const ctx = await browser.newContext({ ...bot.disp, locale: 'es-GT', timezoneId: 'America/Guatemala', serviceWorkers: 'block' });
  // la sesión ficticia (el «login» lo contesta el servidor falso)
  const ses = Buffer.from(JSON.stringify({ e: PERFIL.email, n: PERFIL.nombre, p: PERFIL, exp: Date.now() + 864e5 })).toString('base64url') + '.firma-de-prueba';
  await ctx.addInitScript((s) => { try { localStorage.setItem('sa_auth', s); } catch (e) {} }, ses);
  let n = 0;
  await ctx.route('**/*', async (route) => {
    const q = route.request(), u = q.url(), m = q.method();
    if (/script\.google(usercontent)?\.com/.test(u)) {   // Apps Script (Hub, login): servidor falso, nada se guarda
      const r = respuesta(q.postData(), bot.estilo, n++);
      if (r.lento) await new Promise((ok) => setTimeout(ok, r.lento));
      return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: r.body });
    }
    if (!VIVO && /^https:\/\/hub\.spacioam\.com\//.test(u)) {   // esta copia, no la publicada
      let f = path.join(RAIZ, decodeURIComponent(new URL(u).pathname));
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!f.startsWith(RAIZ) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'no existe' });
      return route.fulfill({ status: 200, contentType: TIPOS[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"prueba":true}' });   // ninguna escritura sale
    if (/onesignal|firebase|googletagmanager|google-analytics|facebook|hotjar/.test(u)) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => anota('grave', 'Error de JavaScript', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) anota('media', 'Error en la consola', m.text()); });
  page.on('dialog', async (d) => { if (/xss-bot/.test(d.message())) anota('grave', 'Se ejecutó código escrito por el usuario (XSS)', d.message()); await d.dismiss().catch(() => {}); });
  page.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && (u.startsWith(base) || /hub\.spacioam\.com/.test(u)) && !/favicon/.test(u)) anota('media', 'Archivo que no carga (' + r.status() + ')', u.replace(base, '/')); });
  const url = (VIVO ? 'https://hub.spacioam.com/' : base) + pag;
  try { await page.goto(url, { waitUntil: 'load', timeout: 25000 }); } catch (e) { anota('grave', 'La página no carga', e.message); await ctx.close(); return hallazgos; }
  await page.waitForTimeout(1500);
  const foto = async (que) => { try { const f = bot.id + '-' + pag.replace(/[\/.]/g, '_') + '-' + que + '.png'; await page.screenshot({ path: path.join(SALIDA, f) }); return f; } catch (e) { return ''; } };
  const mirar = async (momento) => {
    /* lo tapado solo se mira al abrir: después de tocar, un panel o una hoja abierta tapa el fondo a propósito */
    const r = await revisar(page, momento === 'al abrir').catch(() => null); if (!r) return;
    if (r.vacia) anota('grave', 'Pantalla en blanco ' + momento, await foto('blanco'));
    if (r.desborde.length) anota('media', 'Algo se sale de la pantalla (scroll horizontal) ' + momento, r.desborde.join(' · ') + ' — ' + await foto('desborde'));
    if (r.tapados.length) anota('media', 'Botones tapados por otra cosa ' + momento, r.tapados.join(' · '));
    if (r.imagenes.length) anota('media', 'Imágenes rotas', r.imagenes.join(' · '));
    if (r.cortados.length) anota('leve', 'Texto cortado en botones o títulos', r.cortados.join(' · '));
    if (r.chicos.length && momento === 'al abrir') anota('leve', 'Botones muy chicos para el dedo (menos de 30 px)', r.chicos.join(' · '));
  };
  await mirar('al abrir');
  if (bot.estilo === 'sin_red') await ctx.setOffline(true);
  // escribir: lo normal o, a propósito, cosas raras
  const campos = await page.$$('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea');
  for (const [i, c] of campos.slice(0, 6).entries()) {
    try { if (!(await c.isVisible())) continue; await c.fill(bot.estilo === 'raro' ? RARO[i % RARO.length] : 'Prueba ' + (i + 1), { timeout: 1500 }); if (bot.estilo === 'raro') await c.press('Enter', { timeout: 1000 }); } catch (e) {}
  }
  // tocar: todo lo que se pueda tocar (sin salir a otras páginas); el apurado toca dos y tres veces seguidas
  const toques = await page.$$('button, [role=button], a[href^="#"], summary, .area, .esf');
  for (const t of toques.slice(0, 18)) {
    try {
      if (!(await t.isVisible())) continue;
      if (bot.estilo === 'apurado') { await t.click({ timeout: 1200, clickCount: 2 }); await t.click({ timeout: 800, clickCount: 3 }).catch(() => {}); }
      else await t.click({ timeout: 1500 });
      await page.waitForTimeout(bot.estilo === 'apurado' ? 60 : 250);
      if (!page.url().startsWith(url.split('#')[0])) { await page.goBack({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(400); }
    } catch (e) {}
  }
  await page.waitForTimeout(bot.estilo === 'servidor_falla' ? 7000 : 800);
  await mirar('después de usarla');
  if (bot.estilo === 'apurado') { try { await page.setViewportSize({ width: bot.disp.viewport.height, height: bot.disp.viewport.width }); await page.waitForTimeout(500); await mirar('con el teléfono de lado'); } catch (e) {} }
  await ctx.close();   // el navegador del bot se borra entero: no queda nada
  return hallazgos;
}

/* ── Todo ── */
fs.rmSync(SALIDA, { recursive: true, force: true }); fs.mkdirSync(SALIDA, { recursive: true });
const srv = VIVO ? null : await servir();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const lista = paginas(), todos = [];
for (const pag of lista) for (const bot of BOTS) { process.stdout.write('· ' + pag + ' — ' + bot.nombre + '\n'); todos.push(...await probar(browser, srv ? srv.base : '', pag, bot)); }
await browser.close(); if (srv) srv.s.close();

/* El mismo problema visto por varios bots se cuenta una vez (con quiénes lo vieron). */
const unidos = {};
for (const h of todos) { const k = h.pagina + '|' + h.nivel + '|' + h.que + '|' + h.detalle.replace(/ — \S+\.png$/, '').slice(0, 120); (unidos[k] = unidos[k] || { ...h, bots: [] }).bots.push(h.bot); }
const L = Object.values(unidos).sort((a, b) => ['grave', 'media', 'leve'].indexOf(a.nivel) - ['grave', 'media', 'leve'].indexOf(b.nivel) || a.pagina.localeCompare(b.pagina));
const cuenta = (n) => L.filter((h) => h.nivel === n).length;
const icono = { grave: '🔴', media: '🟠', leve: '🟡' };
let md = '## 🤖 Bots de prueba · ' + (VIVO ? 'hub.spacioam.com publicado' : 'esta versión') + '\n\n' +
  lista.length + ' páginas × ' + BOTS.length + ' usuarios ficticios (' + BOTS.map((b) => b.nombre).join(' · ') + '). Sin registros: todo lo que iba al servidor se contestó con datos de prueba.\n\n' +
  '**' + cuenta('grave') + ' graves · ' + cuenta('media') + ' medios · ' + cuenta('leve') + ' leves**\n\n';
if (!L.length) md += 'Todo bien: ningún bot encontró problemas. ✅\n';
for (const nivel of ['grave', 'media', 'leve']) {
  const g = L.filter((h) => h.nivel === nivel); if (!g.length) continue;
  md += '### ' + icono[nivel] + ' ' + { grave: 'Graves', media: 'Medios', leve: 'Leves' }[nivel] + '\n\n';
  for (const h of g.slice(0, nivel === 'leve' ? 25 : 60)) md += '- **' + h.pagina + '** · ' + h.que + ' — ' + h.detalle + ' _(' + [...new Set(h.bots)].map((b) => b.split(' · ')[0]).join(', ') + ')_\n';
  if (g.length > (nivel === 'leve' ? 25 : 60)) md += '- …y ' + (g.length - (nivel === 'leve' ? 25 : 60)) + ' más en informe.json\n';
  md += '\n';
}
fs.writeFileSync(path.join(SALIDA, 'informe.md'), md);
fs.writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify({ vivo: VIVO, paginas: lista, graves: cuenta('grave'), medios: cuenta('media'), leves: cuenta('leve'), hallazgos: L }, null, 1));
console.log('\n' + md);
