/* Escritorio de Alma en la computadora y Chat con Alma estilo messenger (Juan, 21-nov-2026), con dobles:
   1. Dock: por defecto las 6 apps (Hub, Hola, Epi, Grow, Mi, Docs); editable (quitar, reordenar, agregar) y se guarda por
      persona (la clave lleva el correo); una lista guardada rota o con claves que no existen no rompe el Dock.
   2. Buscador de Alma: siempre trae la fila «Pregúntale a Alma: <texto>» y esa fila manda ESE texto al Chat con Alma
      (SANav.chat({ texto })); reservas abren su conversación del Hub; las apps se buscan aquí mismo.
   3. El escritorio ya no tiene el botón «Chat»: es «Pregúntale a Alma» (js/sa-nav.js) y el inicio carga el escritorio.
   4. Hub (apps-script/buscador.js): solo administradores, sin teléfonos ni correos aunque la ficha los tenga, y la acción
      buscarEscritorio existe y cuenta en el canal «inicio».
   5. Chat con Alma estilo messenger: cabecera con estado «Escribiendo…», llamar y «⋯», lo fijado, la caja en píldora con
      cámara, micrófono, emoji e imagen; el hilo con separadores de hora, «Visto» y tres puntos.
   node .github/escritorio.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const RAIZ = path.join(__dirname, '..'), AS = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/* 1. Dock */
const N = require(path.join(RAIZ, 'js/alma-escritorio.js'));
ok(JSON.stringify(N.dockNormalizar(null)) === JSON.stringify(['hub', 'hola', 'epi', 'grow', 'mi', 'docs']), 'Dock por defecto: las 6 apps en orden');
ok(JSON.stringify(N.dockNormalizar('roto')) === JSON.stringify(N.DEF), 'Una lista guardada rota vuelve a las 6 apps');
ok(JSON.stringify(N.dockNormalizar(['epi', 'nada', 'epi', 'archivos'])) === JSON.stringify(['epi', 'archivos']), 'Sin claves desconocidas ni repetidas');
ok(JSON.stringify(N.dockNormalizar(null, ['hub', 'hola'])) === JSON.stringify(['hub', 'hola']), 'Solo las apps que la persona puede abrir');
ok(JSON.stringify(N.dockNormalizar([])) === '[]', 'Un Dock vaciado a propósito se queda vacío (no vuelve solo)');
let L = N.dockQuitar(N.DEF, 'grow'); ok(L.indexOf('grow') < 0 && L.length === 5, 'Quitar una app del Dock');
L = N.dockPoner(L, 'preguntar', 'hub'); ok(L[0] === 'preguntar', 'Agregar «Pregúntale a Alma» antes del Hub');
L = N.dockMover(L, 'preguntar', 1); ok(L[1] === 'preguntar' && L[0] === 'hub', 'Reordenar con las flechas');
ok(N.dockFaltan(L).some((x) => x.k === 'grow') && !N.dockFaltan(L).some((x) => x.k === 'hub'), '«+» ofrece solo lo que falta');
ok(N.dockClave('Juan@Ejemplo.com') === 'sa_dock:juan@ejemplo.com' && N.dockClave('a@x.com') !== N.dockClave('b@x.com'), 'Se guarda por persona (la clave lleva el correo)');
const esc = leer('js/alma-escritorio.js');
ok(/localStorage\.setItem\(dockClave\(correo\(\)\)/.test(esc) && /dockGuardar\(dockQuitar/.test(esc) && /dockGuardar\(dockMover/.test(esc) && /dockGuardar\(dockPoner/.test(esc), 'Cada cambio del Dock se guarda');
ok(/min-width: 1100px\) and \(hover: hover\) and \(pointer: fine\)/.test(esc), 'El Dock solo en pantalla ancha con ratón (no en el iPad ni el teléfono)');

/* 2. Buscador */
const F = N.filasBuscador('¿Qué llega hoy?', null);
ok(F.length && F[0].tipo === 'preguntar' && F[0].titulo === 'Pregúntale a Alma: ¿Qué llega hoy?', 'Siempre la fila «Pregúntale a Alma: <texto>» (primero)');
ok(JSON.stringify(N.accionFila(F[0])) === JSON.stringify({ chat: '¿Qué llega hoy?' }), 'Esa fila manda la misma pregunta al chat');
ok(/w\.SANav\.chat\(\{ texto: a\.chat \}\)/.test(esc), 'El buscador abre el Chat con Alma con la pregunta ya enviada (SANav.chat con texto)');
const F2 = N.filasBuscador('hola', { reservas: [{ codigo: 'HM12345678', huesped: 'Ana Prueba', propiedad: 'Apto 1', entrada: '2026-11-22', salida: '2026-11-24' }], propiedades: [{ nombre: 'Apto 1' }], contactos: [{ nombre: 'Beto Prueba', tipo: 'Técnico' }] });
ok(F2[0].tipo === 'app' && F2[0].k === 'hola' && F2[1].tipo === 'preguntar', 'Una app con ese nombre exacto va primero');
const fr = F2.find((f) => f.tipo === 'reserva');
ok(fr && N.accionFila(fr).abrir === 'https://hub.spacioam.com/?conv=HM12345678' && /22 nov – 24 nov/.test(fr.detalle), 'La reserva abre su conversación del Hub, con sus fechas');
ok(F2.some((f) => f.tipo === 'propiedad') && F2.some((f) => f.tipo === 'contacto'), 'Propiedades y contactos en el buscador');
ok(N.filasBuscador('  ', null).length === 0, 'Sin texto no hay filas');

/* 3. Sin botón «Chat» en el escritorio */
const nav = leer('js/sa-nav.js'), ini = leer('alma/inicio.html');
ok(!/<span>Chat<\/span>/.test(nav) && /data-a="chat"[^>]*>' \+ svg\(P\.chat, 21\) \+ '<span>Pregúntale a Alma<\/span>/.test(nav), 'El botón «Chat» ahora dice «Pregúntale a Alma»');
ok(/<script src="\.\.\/js\/alma-escritorio\.js\?v=[^"]+"><\/script>/.test(ini), 'El inicio carga el escritorio (Dock y Buscador de Alma)');

/* 4. Hub */
const cod = fs.readFileSync(path.join(AS, 'Código.js'), 'utf8'), cupo = fs.readFileSync(path.join(AS, 'cupo.js'), 'utf8');
ok(/case 'buscarEscritorio': return json_\(buscadorApi_\(ses, body\)\)/.test(cod), 'La acción buscarEscritorio existe');
ok(/inicio: '[^']*\bbuscarEscritorio\b/.test(cupo), 'buscarEscritorio cuenta en el canal «inicio»');
const ctx = {
  console: { error() {} }, String, JSON, Object, Array, Math,
  CFG: { TZ: 'America/Guatemala', TAB_RESERVAS: 'Reservas' }, ahora_: () => new Date('2026-11-21T16:00:00Z'),
  Utilities: { formatDate: () => '2026-11-21', base64EncodeWebSafe: (t) => Buffer.from(t).toString('base64') },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  s_: (v) => (v == null ? '' : String(v)), fecha_: (v) => String(v || '').slice(0, 10),
  vozWebAdmin_: (ses) => (ses && ses.email === 'admin@x.com' ? { email: 'admin@x.com' } : null),
  agBuscarReservas_: () => [{ item: { code: 'hm12345678', guest_first_name: 'Ana', guest_last_name: 'Prueba', property_name: 'Apto 1', checkin_date: '2026-11-22', checkout_date: '2026-11-24', status: 'accepted', guest_phone: '+50255555555', guest_email: 'ana@x.com' } }],
  vozReservas_: () => [{ property_name: 'Apto 1' }, { property_name: 'Casa Lago' }],
  contactoBuscar_: () => [{ nombre: 'Beto Prueba', tel: '50255554444', tipo: 'tecnico', empresa: 'Aire', resumen: 'correo beto@x.com' }],
  CONTACTO_TIPOS_: { tecnico: 'Técnico' }
};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(AS, 'buscador.js'), 'utf8'), ctx);
ok(vm.runInContext("buscadorApi_({ email: 'otro@x.com' }, { q: 'ana' })", ctx).ok === false, 'Solo administradores');
const R = vm.runInContext("buscadorApi_({ email: 'admin@x.com' }, { q: 'apto' })", ctx), RJ = JSON.stringify(R);
ok(R.ok && R.reservas[0].codigo === 'HM12345678' && R.reservas[0].huesped === 'Ana Prueba', 'Reservas con su huésped');
ok(R.propiedades.length === 1 && R.propiedades[0].nombre === 'Apto 1', 'Propiedades que coinciden, sin repetir');
ok(R.contactos[0].nombre === 'Beto Prueba' && R.contactos[0].tipo === 'Técnico', 'Contactos con su tipo');
ok(!/5025555|@x\.com|"tel"|resumen/.test(RJ), 'Nunca un teléfono ni un correo en el resultado');

/* 5. Chat con Alma estilo messenger */
ok(/class="san-estado"[^>]*>En línea</.test(nav) && /"Escribiendo…" : "En línea"/.test(nav), 'Cabecera: estado «En línea» y «Escribiendo…» mientras Alma escribe');
ok(/san-llamar/.test(nav) && /san-mas3/.test(nav) && /san-enlinea/.test(nav) && /san-insignia/.test(nav), 'Cabecera: roca con punto verde, insignia, llamar y «⋯»');
ok(/class="san-fijado"/.test(nav) && /sa_chat_fijado:/.test(nav), 'Barra de lo fijado (por persona)');
ok(/san-cam/.test(nav) && /san-mic/.test(nav) && /san-emo/.test(nav) && /class="san-pb san-mas"/.test(nav), 'Caja en píldora: cámara, micrófono, emoji e imagen');
ok((nav.match(/estilo: "messenger"/g) || []).length >= 2, 'El hilo del chat se pinta en estilo messenger');
const chat = leer('js/sa-chat.js'), css = leer('ds/chat.css');
ok(/sa-chat-sep/.test(chat) && /sa-chat-visto/.test(chat) && /sa-chat-puntos/.test(chat), 'Hilo: separadores de hora, «Visto» y tres puntos');
const S = require(path.join(RAIZ, 'js/sa-chat.js')), hoy = new Date();
ok(/^Hoy a las /.test(S.separador(hoy.getTime(), hoy.getTime())) && /^Ayer a las /.test(S.separador(hoy.getTime() - 86400000, hoy.getTime())), 'Separador «Hoy a las…» y «Ayer a las…»');
ok(/\.sa-chat-hilo--msn \.sa-chat-burbuja--mia\{[^}]*background:var\(--msn-tuya\)/.test(css.replace(/\s+/g, '')) || /sa-chat-hilo--msn .sa-chat-burbuja--mia\{ background:var\(--msn-tuya\)/.test(css), 'Tus burbujas azules con letra blanca');

if (fallo) process.exit(1);
