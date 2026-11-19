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
   12. «Terminar» en el compañero cuelga la llamada del otro dispositivo (vivoColgar → «colgar» a la app).
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
  ['calprops.js', 'episnap.js', 'tarjeta.js', 'tablero.js', 'vivo.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx));
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
/* 10 · el iPad, con más espacio (Juan, 17-nov-2026: «en el iPad hay más espacio… más datos o desplegar las cosas distinto») */
{ const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/@media \(min-width: 900px\)[\s\S]*\.comp-lado \{ display: flex/.test(h) && /\.comp-centro \.comp-subs \{ display: none/.test(h), '10 · inicio.html: en pantalla ancha, columna a la derecha (en el teléfono no cambia)');
  ok(/"La llamada"/.test(h) && /"Se mostró"/.test(h) && /"Conversación"/.test(h) && /lineas\.children\.length > 200/.test(h), '10 · inicio.html: la llamada, lo que se mostró y la conversación completa');
  ok(/b\.onclick = function \(\) \{ mostrar\(v\.t\); \}/.test(h), '10 · inicio.html: tocar un tablero de antes lo vuelve a mostrar');
}
/* 11 · la roca quieta del inicio no es una llamada (Juan, 19-nov-2026: «el modo companion está activado en el celular y en el
   iPad, pero en el iPad no está copiando lo mismo que pasa en el teléfono»): en la escena, .san-ov.on queda siempre puesto */
{ const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  const m = /function llamadaAqui\(\) \{[^\n]*\}/.exec(h);
  ok(!!m, '11 · inicio.html: llamadaAqui existe');
  if (m) {
    const aqui = (clases) => new Function('document', m[0] + '; return llamadaAqui();')({ querySelector: () => clases === null ? null : { classList: { contains: (c) => clases.indexOf(c) >= 0 } } });
    ok(aqui(['on', 'escena', 'quieta']) === false, '11 · la roca quieta en el inicio (sin llamada): el iPad sí muestra la llamada del otro');
    ok(aqui(['on', 'escena']) === true, '11 · con la llamada en este dispositivo (la roca despierta): no se muestra el otro');
    ok(aqui(['on']) === true && aqui([]) === false && aqui(null) === false, '11 · fuera del inicio, como antes');
  }
}
/* 12 · nunca atascado (Juan, 19-nov-2026: «en el iPad parece como atascado, siempre está encendido») */
{ const { X, reloj, JUAN } = caja();
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone' });
  reloj.ms += 5000;
  X.vivoFin_(JUAN, 'conv-1');   // colgó, pero el «fin» de la app se perdió (pantalla bloqueada, sin red)
  ok(X.vivoLeerApi_(J, {}).en_llamada, '12 · justo después del aviso al colgar sigue (puede ser el paso a Claudio)');
  reloj.ms += 61000;
  let r = X.vivoLeerApi_(J, {});
  ok(!r.en_llamada && r.estado === 'fin', '12 · si la app ya no dice nada en 1 min, terminó (antes: 10 min «en vivo»)');
  const k = caja();
  k.X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone' });
  k.reloj.ms += 5000; k.X.vivoFin_(k.JUAN, 'conv-1');
  k.reloj.ms += 30000; k.X.vivoPublicarApi_(J, { conv_id: 'conv-1', subs: [{ de: 'alma', t: 'Sigo con Claudio.' }] });
  k.reloj.ms += 50000;
  ok(k.X.vivoLeerApi_(J, {}).en_llamada, '12 · si la app sigue hablando (con Claudio), la llamada sigue');
  const q = caja();
  q.X.vivoInicio_(q.JUAN, 'conv-1');
  q.reloj.ms += 91000;
  ok(!q.X.vivoLeerApi_(J, {}).en_llamada, '12 · una llamada que nunca conectó no se queda en «Conectando»');
  const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/class(Name)?[^\n]*comp-x|el\("button", "comp-x"\)/.test(h) && /C\.oculta = C\.conv; cerrar\(false\)/.test(h) && /r\.conv !== C\.oculta\) pintar\(r\)/.test(h), '12 · inicio.html: la capa siempre tiene ✕ para cerrarla (la próxima llamada sí sale)');
  ok(/!\(YO && r\.dispositivo === YO\)/.test(h), '12 · inicio.html: este dispositivo no se copia a sí mismo');
}
/* 13 · terminar desde el compañero (Juan, 19-nov-2026: «en el desktop no me está dejando terminar la llamada. Si por error
   se activa, no puedo terminar la llamada manualmente») */
{ const { X, cache, JUAN } = caja();
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone', subs: [{ de: 'alma', t: 'Hola, Juan.' }] });
  ok(!X.vivoPublicarApi_(J, { conv_id: 'conv-1', subs: [] }).colgar, '13 · sin «Terminar», la app no recibe «colgar»');
  ok(X.vivoColgarApi_(A, { conv: 'conv-1' }).terminada === false && X.vivoLeerApi_(J, {}).en_llamada, '13 · otro administrador no termina la llamada de Juan');
  ok(X.vivoColgarApi_(J, { conv: 'otra' }).terminada === false && X.vivoLeerApi_(J, {}).en_llamada, '13 · si ya empezó otra llamada, no se toca');
  ok(X.vivoColgarApi_(null, {}).error === 'session', '13 · sin sesión, nada');
  ok(X.vivoColgarApi_(J, { conv: 'conv-1' }).terminada === true, '13 · «Terminar» en el compañero');
  let r = X.vivoLeerApi_(J, {});
  ok(!r.en_llamada && r.estado === 'fin', '13 · el compañero la ve terminada al momento');
  let p = X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', subs: [{ de: 'alma', t: 'Sigo aquí.' }] });
  ok(p.colgar === true && !X.vivoLeerApi_(J, {}).en_llamada, '13 · la app que sigue hablando recibe «colgar» y la llamada sigue terminada');
  p = X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'fin' });
  ok(!p.colgar && !('vivo_colgar_' + X.vivoClave_(J.email) in cache), '13 · al colgar la app («fin»), el pedido se borra');
  X.vivoInicio_(JUAN, 'conv-2');
  ok(X.vivoLeerApi_(J, {}).en_llamada, '13 · la llamada siguiente se ve normal');
  const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/case 'vivoColgar': return json_\(vivoColgarApi_\(ses, body\)\)/.test(cod), '13 · la acción vivoColgar está en el Hub, con la sesión');
  const m13 = /function llamadaAqui\(\) \{[^\n]*\}/.exec(h);
  if (m13) {
    const aqui = (vn) => new Function('document', 'AlmaVozAqui', m13[0] + '; return llamadaAqui();')({ querySelector: () => ({ classList: { contains: (c) => ['on', 'escena', 'quieta'].indexOf(c) >= 0 } }) }, () => vn);
    ok(aqui(true) === true && aqui(false) === false, '13 · la llamada de la app aquí (empezó con el anillo o un roce, la roca quieta): la vista del compañero no la tapa');
  }
  ok(/el\("button", "comp-colgar"\)/.test(h) && /hub\("vivoColgar", \{ conv: conv \}\)/.test(h) && /r\.conv === C\.colgada\) vivo = false/.test(h), '13 · inicio.html: el botón «Terminar» del compañero y no se vuelve a abrir');
}
/* 14 · una sola voz: manda el teléfono (Juan, 19-nov-2026: «solo debería haber un agente por voz activo; si está
   activado el teléfono, por default el agente del teléfono») */
const dosDev = (k) => { k.X.vozWebTel_ = (c) => (c === 'conv-ana' ? '50255550202' : /^conv-/.test(c) ? '50255550101' : ''); return k; };
{ const { X, reloj, JUAN } = dosDev(caja());
  X.vivoInicio_(JUAN, 'conv-1'); X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone' });
  X.vivoInicio_(JUAN, 'conv-ipad');
  ok(X.vivoLeerApi_(J, {}).conv === 'conv-1', '14 · el iPad empieza otra llamada: al vincular no pisa la del iPhone');
  let r = X.vivoPublicarApi_(J, { conv_id: 'conv-ipad', estado: 'conectando', dispositivo: 'iPad' });
  ok(r.ok && r.ceder === true && r.otra === 'iPhone', '14 · con el iPhone en llamada, el iPad recibe «ceder» (la app cuelga la suya)');
  ok(X.vivoLeerApi_(J, {}).conv === 'conv-1' && X.vivoLeerApi_(J, {}).dispositivo === 'iPhone', '14 · el compañero sigue viendo la del iPhone');
  ok(X.vivoPublicarApi_(J, { conv_id: 'conv-ipad', estado: 'fin', dispositivo: 'iPad' }).ceder && X.vivoLeerApi_(J, {}).en_llamada, '14 · el «fin» de la que cedió no termina la del iPhone');
  ok(X.vivoTarjeta_('conv-ipad', { tipo: 'datos', id: 'x' }) === false, '14 · un tablero de la que cedió no pisa la del iPhone');
}
{ const { X, JUAN } = dosDev(caja());
  X.vivoInicio_(JUAN, 'conv-ipad'); X.vivoPublicarApi_(J, { conv_id: 'conv-ipad', estado: 'hablando', dispositivo: 'iPad' });
  let r = X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'conectando', dispositivo: 'iPhone' });
  ok(r.ok && !r.ceder, '14 · el iPad estaba primero y llega el iPhone: el iPhone se queda');
  ok(X.vivoLeerApi_(J, {}).conv === 'conv-1', '14 · ahora la llamada que se ve es la del iPhone');
  r = X.vivoPublicarApi_(J, { conv_id: 'conv-ipad', subs: [{ de: 'alma', t: 'hola' }], dispositivo: 'iPad' });
  ok(r.ceder === true && X.vivoLeerApi_(J, {}).conv === 'conv-1', '14 · la siguiente vez que publica el iPad recibe «ceder» y no pisa');
}
{ const { X, reloj } = dosDev(caja());
  X.vivoPublicarApi_(J, { conv_id: 'conv-1', estado: 'hablando', dispositivo: 'iPhone' });
  reloj.ms += 31000;
  ok(!X.vivoPublicarApi_(J, { conv_id: 'conv-ipad', estado: 'conectando', dispositivo: 'iPad' }).ceder, '14 · si el iPhone ya no avisa (30 s), el iPad sí puede');
  const { X: Y } = dosDev(caja());
  Y.vivoPublicarApi_(J, { conv_id: 'conv-a', estado: 'hablando', dispositivo: 'iPhone' });
  Y.vivoPublicarApi_(J, { conv_id: 'conv-a', estado: 'fin', dispositivo: 'iPhone' });
  ok(!Y.vivoPublicarApi_(J, { conv_id: 'conv-b', estado: 'conectando', dispositivo: 'iPad' }).ceder, '14 · con la del iPhone terminada, el iPad sí puede');
  ok(!Y.vivoPublicarApi_(J, { conv_id: 'conv-c', estado: 'conectando', dispositivo: 'iPad' }).ceder, '14 · dos del mismo dispositivo: como antes, la última');
}
process.exit(fallo);
