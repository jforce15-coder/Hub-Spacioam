/* Correo a Claudio (pedido pc1795012841121, 18-nov-2026) con dobles: sin Gmail, sin Drive, sin hoja, sin IA.
   Juan: «¿qué te parece si te mando correos a alma@spacioam.com? ¿Podrías verlo?»
   1. Lo que el principal manda A la cuenta del Hub, con su firma en «pass», entra a la Biblioteca de Claudio: cada adjunto
      que sabe leer (sin los logos de la firma) y, sin adjuntos, el texto del correo; una sola vez por mensaje.
   2. No entra: otra persona, un remitente falsificado (sin DKIM/DMARC del dominio), ni un correo donde Alma va en copia.
   3. Si Claudio esperaba UN documento, le llega como ajuste de su microproyecto; si no, Juan lo ve en su chat y Pendientes.
   4. Cada 5 minutos, BUZON_ON = 0 lo apaga; procesarCola, leer_correo y el glosario lo conectan.
   node .github/buzon-claudio.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const HUB = 'alma@spacioam.com', JUAN = 'juan@gmail.com', ALT = 'juan@spacioam.com';
const PASA = d => 'mx.google.com; dkim=pass header.i=@' + d + ' header.s=20230601; spf=pass smtp.mailfrom=x@' + d + '; dmarc=pass (p=NONE) header.from=' + d;
let nMsg = 0;
function adj(nombre, mime, bytes) { const b = Buffer.from(bytes || '%PDF-1.4 ' + nombre); return { getName: () => nombre, getContentType: () => mime, getSize: () => b.length, getBytes: () => Array.from(b) }; }
function msg(o) {
  const id = 'm' + (++nMsg);
  return { getId: () => id, getFrom: () => o.de, getTo: () => o.para || HUB, getCc: () => o.cc || '', getSubject: () => o.asunto || 'Estados de cuenta',
    getDate: () => new Date(o.fecha || Date.now() - 3600000), getPlainBody: () => o.texto == null ? 'Claudio, aquí van los dos estados de cuenta.\n\n--\nJuan' : o.texto,
    getAttachments: () => o.adjuntos || [], getHeader: k => (k === 'Authentication-Results' ? (o.ar == null ? PASA(o.de.replace(/^.*@/, '').replace(/>.*$/, '')) : o.ar) : '') };
}
function caja(o = {}) {
  const props = Object.assign({}, o.props || {}), guardados = [], chat = [], pend = [], ajustes = [], etiquetas = [], busquedas = [];
  let hilos = o.hilos || [];
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, Buffer,
    CFG: { TZ: 'America/Guatemala', EMAIL_DESDE: 'hola@spacioam.com' },
    Session: { getEffectiveUser: () => ({ getEmail: () => HUB }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: { base64Encode: a => Buffer.from(a).toString('base64'), formatDate: d => new Date(d).toISOString().slice(0, 10) },
    GmailApp: { getAliases: () => [], search: q => { busquedas.push(q); return hilos; },
      getUserLabelByName: () => null, createLabel: n => ({ n }) },
    adminsOp_: () => [{ email: JUAN, alternos: [ALT], nombre: 'Juan', principal: true }, { email: 'flor@spacioam.com', alternos: [], nombre: 'Flor', principal: false }],
    bibliotecaSubir_: (ses, b) => {
      if (ses.email !== JUAN) return { ok: false, error: 'Solo el administrador principal.' };
      if (b.archivo && /\.exe$/.test(b.archivo)) return { ok: false, error: 'Ese tipo no lo puedo leer.' };
      const d = { id: 'b' + (guardados.length + 1), nombre: b.nombre, para_que: b.para_que, texto: b.texto || '', data: b.data || '' }; guardados.push(d); return { ok: true, documento: d };
    },
    biblioPedidos_: () => (o.pedidos || []).slice(), biblioPedidoQuitar_: m => { o.pedidos = (o.pedidos || []).filter(p => p.micro !== m); },
    microResponder_: (adm, micro, texto) => { ajustes.push({ micro, texto }); return { ok: true }; },
    opGuardar_: (adm, de, canal, texto) => { chat.push(texto); return {}; },
    pendAvisar_: (adm, texto, op) => { pend.push({ texto, op }); return true; }
  };
  vm.createContext(ctx);
  ['correohilo.js', 'buzon.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  const hilo = ms => ({ getMessages: () => ms, addLabel: l => etiquetas.push(l.n) });
  return { ctx, props, guardados, chat, pend, ajustes, etiquetas, busquedas, poner: l => { hilos = l.map(hilo); } };
}

/* 1. Lo de Juan entra a la Biblioteca */
{
  const c = caja();
  c.poner([[msg({ de: 'Juan Ovalle <' + JUAN + '>', adjuntos: [adj('BAC.pdf', 'application/pdf'), adj('Promerica.pdf', 'application/pdf'), adj('logo.png', 'image/png', 'PNG')] })]]);
  const r = c.ctx.buzonRevisar_(true);
  ok(r.ok && r.documentos === 2 && c.guardados.map(d => d.nombre).join() === 'BAC,Promerica', 'los dos PDF del correo de Juan entran a la Biblioteca (sin el logo de la firma)');
  ok(/Del correo «Estados de cuenta»/.test(c.guardados[0].para_que) && /aquí van los dos estados/.test(c.guardados[0].para_que) && !/--/.test(c.guardados[0].para_que), 'su «para qué» es el asunto y lo que Juan escribió, sin la firma');
  ok(Buffer.from(c.guardados[0].data, 'base64').toString() === '%PDF-1.4 BAC.pdf', 'el archivo va completo');
  ok(c.etiquetas[0] === 'Alma/Para Claudio', 'el hilo queda con la etiqueta «Alma/Para Claudio»');
  ok(c.chat.length === 1 && /Biblioteca de Claudio/.test(c.chat[0]) && /«BAC», «Promerica»/.test(c.chat[0]) && c.pend.length === 1 && c.pend[0].op.clasif.tipo === 'aviso', 'Juan lo ve en su chat y en Pendientes (sin IA)');
  ok(!/@/.test(c.chat[0]), 'el aviso no lleva correos');
  ok(/in:inbox newer_than:3d/.test(c.busquedas[0]) && c.busquedas[0].indexOf('from:' + ALT) > 0 && !/flor/.test(c.busquedas[0]), 'busca solo lo del principal (su correo y su alterno), de los últimos 3 días');
  const r2 = c.ctx.buzonRevisar_(true);
  ok(r2.correos === 0 && c.guardados.length === 2 && c.chat.length === 1, 'el mismo correo no entra dos veces');
  ok(c.ctx.buzonRevisar_(false).espera, 'revisa cada 5 minutos, no en cada vuelta de la cola');
  c.props.BUZON_ON = '0'; ok(c.ctx.buzonRevisar_(true).apagado, 'BUZON_ON = 0 lo apaga');
}
/* 2. Lo que no entra */
{
  const c = caja();
  c.poner([[
    msg({ de: 'Juan <' + JUAN + '>', ar: 'mx.google.com; dkim=none; spf=fail smtp.mailfrom=' + JUAN + '; dmarc=fail header.from=gmail.com', adjuntos: [adj('falso.pdf', 'application/pdf')] }),
    msg({ de: 'Juan <' + JUAN + '>', ar: 'mx.google.com; dkim=pass header.i=@otro.com; dmarc=fail header.from=gmail.com', adjuntos: [adj('falso2.pdf', 'application/pdf')] }),
    msg({ de: 'Juan <' + JUAN + '>', ar: '', adjuntos: [adj('sin-encabezado.pdf', 'application/pdf')] }),
    msg({ de: 'Flor <flor@spacioam.com>', adjuntos: [adj('flor.pdf', 'application/pdf')] }),
    msg({ de: 'Juan <' + JUAN + '>', para: 'Socio <socio@ejemplo.com>', cc: HUB, adjuntos: [adj('copia.pdf', 'application/pdf')] }),
    msg({ de: 'Juan <' + JUAN + '>', fecha: Date.now() - 5 * 86400000, adjuntos: [adj('viejo.pdf', 'application/pdf')] })
  ]]);
  c.ctx.buzonRevisar_(true);
  ok(c.guardados.length === 0 && c.chat.length === 0 && c.etiquetas.length === 0, 'no entra: firma falsa, firma de otro dominio, externo sin encabezado, otra persona, Alma no en «Para», ni lo de hace más de 3 días');
}
{
  const c = caja();
  c.poner([[msg({ de: 'Juan <' + ALT + '>', ar: '', adjuntos: [adj('interno.pdf', 'application/pdf')] })]]);
  c.ctx.buzonRevisar_(true);
  ok(c.guardados.length === 1, 'lo interno del mismo dominio que el Hub (sin encabezado) sí entra, desde el alterno');
}
/* 3. Sin adjuntos, un tipo raro y un pedido de Claudio */
{
  const c = caja({ pedidos: [{ micro: 'mp1', nombre: 'Estados de cuenta', que: 'los dos PDF', ts: Date.now() }] });
  c.poner([[msg({ de: JUAN, asunto: 'Fwd: Propuesta del socio', texto: 'Mira esto.\n\n---------- Forwarded message ---------\nDe: Socio\nHola Juan, te propongo…' })],
    [msg({ de: JUAN, asunto: 'Programa', adjuntos: [adj('setup.exe', 'application/x-msdownload', 'MZ'), adj('notas.pdf', 'application/pdf')] })]]);
  c.ctx.buzonRevisar_(true);
  const t = c.guardados.find(d => /^Correo · Propuesta del socio$/.test(d.nombre));
  ok(t && /te propongo/.test(t.texto) && /Asunto: Propuesta del socio/.test(t.texto), 'sin adjuntos, el texto del correo (con lo reenviado) entra como documento');
  ok(c.ajustes.length === 1 && c.ajustes[0].micro === 'mp1' && /id b1/.test(c.ajustes[0].texto) && /id b2/.test(c.ajustes[0].texto), 'Claudio esperaba un documento: le llega UN ajuste con todos los ids');
  ok(c.chat.length === 1 && /ya quedó con Claudio/.test(c.chat[0]) && /setup\.exe \(ese tipo no lo puedo guardar\)/.test(c.chat[0]), 'Juan sabe que ya lo tiene Claudio y qué no se pudo guardar');
}
{
  const c = caja({ pedidos: [{ micro: 'mp1', nombre: 'A', que: 'x' }, { micro: 'mp2', nombre: 'B', que: 'y' }] });
  c.poner([[msg({ de: JUAN, adjuntos: [adj('a.pdf', 'application/pdf')] })]]);
  c.ctx.buzonRevisar_(true);
  ok(c.ajustes.length === 0 && /próximo pedido/.test(c.chat[0]), 'con dos pedidos esperando no adivina: avisa a Juan');
}
/* 4. Conexiones */
{
  const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), ag = leer('agente.js'), glo = fs.readFileSync(path.join(RAIZ, 'docs', 'GLOSARIO.md'), 'utf8');
  ok(/try \{ buzonRevisar_\(false\); \}/.test(cod), 'procesarCola lo llama');
  ok(/T\('leer_correo', '[^']*alma@spacioam\.com/.test(ag), 'Alma sabe que lo que Juan manda a alma@ está en su bandeja');
  ok(/\| \*\*Correo a Claudio\*\* \|/.test(glo), 'el glosario tiene «Correo a Claudio»');
}
process.exit(fallo);
