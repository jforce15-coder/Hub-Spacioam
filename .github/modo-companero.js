/* Prueba del modo compañero (apps-script/vivo.js, #607 T-C1) con dobles: sin Google ni ElevenLabs.
   1. El dispositivo de la llamada publica estado y subtítulos; el otro los lee (solo los nuevos, con «desde»).
   2. Solo el administrador de esa llamada publica, y cada uno lee solo lo suyo (la clave sale de su correo).
   3. El tablero lo deja el Hub (tvCerrar_ → vivoTarjeta_) y el compañero lo ve; si el compañero está mirando, el tablero
      sale aunque el teléfono de la llamada esté bloqueado (y los tipos nuevos, solo si el compañero los pinta).
   4. Empieza con vozWebVincular_ (vivoInicio_) y termina con «fin» o con el aviso de ElevenLabs al colgar (vivoFin_); sin
      noticias en 10 min se da por terminada.
   5. Los subtítulos tapan lo que parece un código y se quedan los últimos 8.
   6. Las acciones vivoPublicar y vivoLeer están en el Hub y alma/inicio.html tiene el interruptor y el espejo.
   7. El Panel de Claudio (los trabajos en curso) también llega al compañero, en la llamada que ya sigue.
   node .github/modo-companero.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

function caja() {
  const cache = {}, reloj = { ms: Date.parse('2026-11-16T22:00:00Z') };
  const JUAN = { email: 'juan@spacioam.com', tels: ['50255550101'], principal: true }, ANA = { email: 'ana@spacioam.com', tels: ['50255550202'] };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, isFinite, Buffer,
    Date: class extends Date { constructor(...a) { if (!a.length) super(reloj.ms); else super(...a); } static now() { return reloj.ms; } },
    CFG: { TZ: 'America/Guatemala' },
    Utilities: { base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'), computeDigest: (a, s) => Array.from(require('crypto').createHash('md5').update(String(s)).digest()), DigestAlgorithm: { MD5: 'md5' },
      formatDate: (d) => new Date(d.getTime() - 6 * 3600e3).toISOString().slice(0, 10) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; },
      getAll: (ks) => { const r = {}; ks.forEach((k) => { if (k in cache) r[k] = cache[k]; }); return r; } }) },
    s_: (v) => (v == null || typeof v === 'object') ? '' : String(v),
    norm_: (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(),
    fin8_: (t) => String(t || '').replace(/\D/g, '').slice(-8),
    vozWebAdmin_: (ses) => (ses && ses.email === JUAN.email ? JUAN : ses && ses.email === ANA.email ? ANA : null),
    vozWebTel_: (c) => (c === 'conv-1' ? '50255550101' : c === 'conv-ana' ? '50255550202' : ''),
    adminPorTel_: (t) => (String(t).slice(-8) === '55550101' ? JUAN : String(t).slice(-8) === '55550202' ? ANA : null),
    AGENTE_CANAL_: 'llamada'
  };
  vm.createContext(ctx);
  ['calprops.js', 'tarjeta.js', 'tablero.js', 'vivo.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx));
  return { X: ctx, cache, reloj, JUAN, ANA };
}
const J = { email: 'juan@spacioam.com' }, A = { email: 'ana@spacioam.com' };

/* 1 · publicar y leer */
{ const { X } = caja();
  ok(X.vivoLeerApi_(J, {}).en_llamada === false, '1 · sin llamada: el compañero no muestra nada');
  ok(X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone', subs: [{ de: 'yo', t: '¿Quién llega hoy?' }, { de: 'alma', t: 'Hoy llegan dos.' }] }).ok, '1 · el iPhone publica estado y subtítulos');
  let r = X.vivoLeerApi_(J, { tipos: ['reserva', 'datos'] });
  ok(r.en_llamada && r.estado === 'hablando' && r.dispositivo === 'iPhone' && r.subs.length === 2 && r.subs[1].de === 'alma', '1 · el iPad lee el estado, quién habla y los subtítulos');
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', subs: [{ de: 'alma', t: 'Mariana llega a las 3.' }] });
  r = X.vivoLeerApi_(J, { desde: 2 });
  ok(r.subs.length === 1 && r.subs[0].n === 3 && r.estado === 'hablando', '1 · con «desde», solo lo nuevo; sin estado, se queda el de antes');
}
/* 2 · cada uno lo suyo */
{ const { X } = caja();
  ok(X.vivoPublicarApi_(A, { conv_id: 'conv-1', estado: 'hablando' }).error === 'Esa llamada no es tuya.', '2 · otro administrador no publica en la llamada de Juan');
  ok(X.vivoPublicarApi_(null, { conv_id: 'conv-1' }).error === 'session' && X.vivoLeerApi_(null, {}).error === 'session', '2 · sin sesión, nada');
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', subs: [{ t: 'hola' }] });
  ok(X.vivoLeerApi_(A, {}).en_llamada === false, '2 · Ana no ve la llamada de Juan');
}
/* 3 · el tablero */
{ const { X, cache } = caja();
  cache['vozapp_conv-1'] = '1'; cache['vozpant_conv-1'] = '0';   // el iPhone de la llamada, bloqueado
  const RES = [{ huesped: 'Mariana López', propiedad: 'Z10 - Brunelo - 1203', entrada: '2026-11-17', salida: '2026-11-20' }, { huesped: 'Pedro Ruiz', propiedad: 'Z10 - Brunelo - 1102', entrada: '2026-11-18', salida: '2026-11-19' }];
  X.tvCandidata_('datos', () => X.tdReservas_(RES));
  let t = X.tvCerrar_('conv-1', true, false);
  ok(t && !t.visible, '3 · sin compañero y con el iPhone bloqueado: el tablero queda solo en el chat');
  X.vivoLeerApi_(J, { tipos: ['reserva'] });   // el iPad mira, pero su página no pinta «datos»
  X.tvCandidata_('datos', () => X.tdReservas_(RES));
  t = X.tvCerrar_('conv-1', true, false);
  ok(t && !t.visible, '3 · un tipo nuevo sale en el compañero solo si lo pinta');
  X.vivoLeerApi_(J, { tipos: ['reserva', 'datos'] });
  X.tvCandidata_('datos', () => X.tdReservas_(RES));
  t = X.tvCerrar_('conv-1', true, false);
  ok(t && t.visible && /^EN PANTALLA/.test(t.voz), '3 · con el iPad mirando, el tablero sale y la voz dice «EN PANTALLA»');
  const r = X.vivoLeerApi_(J, {});
  ok(r.en_llamada && r.tarjeta && r.tarjeta.tipo === 'datos' && r.tarjeta.id === t.tarjeta.id, '3 · el iPad recibe el mismo tablero (aunque el iPhone no publique nada)');
}
/* 4 · empieza y termina */
{ const { X, reloj, JUAN } = caja();
  X.vivoInicio_(JUAN, 'conv-1');
  ok(X.vivoLeerApi_(J, {}).estado === 'conectando', '4 · al vincular la llamada, el compañero ya la ve');
  X.vivoFin_(JUAN, 'otra');
  ok(X.vivoLeerApi_(J, {}).en_llamada, '4 · el fin de otra conversación no la termina');
  X.vivoFin_(JUAN, 'conv-1');
  let r = X.vivoLeerApi_(J, {});
  ok(!r.en_llamada && r.estado === 'fin', '4 · el aviso al colgar la termina');
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando' });
  reloj.ms += 11 * 60000;
  ok(!X.vivoLeerApi_(J, {}).en_llamada, '4 · sin noticias en 10 min, terminada');
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'fin' });
  ok(!X.vivoLeerApi_(J, {}).en_llamada, '4 · el iPhone puede decir «fin»');
}
/* 5 · subtítulos */
{ const { X } = caja();
  const subs = []; for (let i = 0; i < 12; i++) subs.push({ de: 'alma', t: 'frase ' + i });
  subs.push({ de: 'alma', t: 'El código de la puerta es 482910' });
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', subs });
  const r = X.vivoLeerApi_(J, {});
  ok(r.subs.length === 8, '5 · se quedan los últimos 8');
  ok(!/482910/.test(JSON.stringify(r.subs)), '5 · lo que parece un código se tapa');
}
/* 7 · el Panel de Claudio (Juan, 17-nov-2026: «en el teléfono me pones los trabajos, pero en el iPad no veo nada») */
{ const { X, JUAN } = caja();
  const P = (id) => ({ tipo: 'claudio', vista: 'lista', id, titulo: 'Lo que está haciendo desarrollo', trabajos: [{ nombre: 'Saludos pregrabados', etapa: 'escribiendo', pasos: ['hecho', 'curso', 'pend', 'pend'] }] });
  X.vivoInicio_(JUAN, 'conv-1'); X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando' });
  ok(X.vivoPanel_(JUAN, 'conv_claudio1', P('cp1')), '7 · el panel que pide el iPhone se deja para el compañero');
  let r = X.vivoLeerApi_(J, {});
  ok(r.en_llamada && r.conv === 'conv-1' && r.tarjeta && r.tarjeta.tipo === 'claudio' && r.tarjeta.trabajos.length === 1, '7 · el iPad ve los trabajos en la misma llamada que ya seguía');
  X.vivoPanel_(JUAN, 'conv_claudio1', P('cp2'));
  ok(X.vivoLeerApi_(J, {}).tarjeta.id === 'cp2', '7 · el panel nuevo reemplaza al de antes');
  X.vivoInicio_(JUAN, 'conv-2');
  ok(!X.vivoLeerApi_(J, {}).tarjeta, '7 · al volver con Alma (otra conversación) el panel se quita');
  ok(!X.vivoPanel_(JUAN, 'conv_claudio1', { tipo: 'datos', id: 'x' }) && !X.vivoPanel_(null, 'c', P('cp3')), '7 · solo paneles de Claudio y con administrador');
  const { X: X2, JUAN: J2 } = caja();
  X2.vivoPanel_(J2, 'conv_claudio9', P('cp9'));
  r = X2.vivoLeerApi_(J, {});
  ok(r.en_llamada && r.tarjeta && r.tarjeta.id === 'cp9', '7 · sin llamada publicada (app de antes), el compañero igual ve el panel');
  ok(/vivoPanel_\(adm, conv, panel\)/.test(fs.readFileSync(path.join(DIR, 'claudiopanel.js'), 'utf8')), '7 · claudioPanelApi_ se lo deja al compañero');
}
/* 6 · Hub y página */
{ const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), voz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8'), tj = fs.readFileSync(path.join(DIR, 'tarjeta.js'), 'utf8');
  ok(/case 'vivoPublicar': return json_\(vivoPublicarApi_\(ses, body\)\)/.test(cod) && /case 'vivoLeer': return json_\(vivoLeerApi_\(ses, body\)\)/.test(cod), '6 · las acciones están en el Hub, con la sesión');
  ok(/vivoInicio_\(adm, convId\)/.test(voz) && /vivoFin_\(admC, convEL\)/.test(voz) && /vivoTarjeta_\(convId, t\)/.test(tj), '6 · empieza al vincular, termina al colgar y el tablero llega solo');
  const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/id="i-comp"/.test(h) && /hub\("vivoLeer"/.test(h) && /AlmaTarjeta\.bento/.test(h), '6 · inicio.html: el interruptor «Modo compañero» y el espejo');
  ok(/id="b-comp"[^>]*aria-pressed/.test(h) && /bc\.onclick = function \(\) \{ poner\(!C\.on\); \}/.test(h) && /\$\("b-comp"\)\.classList\.add\("on"\)/.test(h), '6 · inicio.html: el botón de arriba, junto a Pendientes y Notificaciones, enciende y apaga lo mismo');
}
/* 8 · retransmisión al pasar a Claudio (pedido pc1794949124807) */
{ const { X, reloj, JUAN } = caja();
  const P = { tipo: 'claudio', vista: 'lista', id: 'cp1', titulo: 'Trabajando en 1', trabajos: [] };
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone', subs: [{ de: 'yo', t: 'Pásame con Claudio' }] });
  reloj.ms += 5000;
  X.vivoFin_(JUAN, 'conv-1');   // ElevenLabs avisa que la conversación de Alma se cerró (pasó a Claudio)
  ok(X.vivoLeerApi_(J, {}).en_llamada, '8 · pasar a Claudio no termina la llamada en el compañero');
  X.vivoPanel_(JUAN, 'conv_claudio1', P);
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', subs: [{ de: 'alma', t: 'Van tres trabajos.' }] });
  const r = X.vivoLeerApi_(J, {});
  ok(r.tarjeta && r.tarjeta.id === 'cp1' && r.subs.length === 2, '8 · el panel y los subtítulos siguen juntos en la misma llamada');
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone' });
  reloj.ms += 3 * 60000;
  X.vivoFin_(JUAN, 'conv-1');
  ok(!X.vivoLeerApi_(J, {}).en_llamada, '8 · si la app se calló hace rato, el aviso al colgar sí la termina');
  const cl = fs.readFileSync(path.join(DIR, 'claudio.js'), 'utf8'), h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/vivoMira_\(adm\.email\)\) vivoPanel_\(adm, b\.conv_id, claudioPanelArmar_\(adm, cand\)\)/.test(cl), '8 · con el iPad mirando, cada herramienta de Claudio le deja el panel (aunque el iPhone esté bloqueado)');
  ok(/con Claudio/.test(h), '8 · inicio.html: arriba dice «con Claudio» mientras se ve su panel');
}
{ const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/comp-lado/.test(h) && /@media \(min-width: 900px\) \{\s*\.comp-cuerpo/.test(h) && /ci-dur/.test(h) && /subs\.children\.length > 40/.test(h), '9 · en el iPad (pantalla ancha): el tablero y al lado los datos de la llamada y la conversación entera');
}
process.exit(fallo);
