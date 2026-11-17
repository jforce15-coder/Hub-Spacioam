/* Modo Weebo con tino y el GIF de la broma (Juan, 16-nov-2026), con dobles: sin hoja, sin red ni Google.
   «El modo Weebo no está funcionando muy bien… una carcajada que no correspondía a nada… Tenemos que ser más oportunos y
   sutiles.» En la llamada del 15-nov, 7 de 7 «[laugh]» salieron sin chiste (después de «eh», «mmm», un corte).
   1. El carácter (weeboBase_): manda el código si la fila WEEBO de la hoja es una semilla vieja o está vacía; la de Juan,
      si la escribió a mano. Trae las reglas del tino: gancho concreto, nunca risa sola, por grados, el nivel es techo.
   2. Mensajes (weeboBloque_): con el Weebo fijo en 3 y un problema, NIVEL 0.
   3. Voz: la regla de etiquetas prohíbe [laugh] y las risas escritas; mostrar_gif es de cliente, sin respuesta, y la
      regla del GIF va en el bloque de voz (no en el de la familia).
   4. GIF (gif.js): GIPHY solo por uf_ y con rating g (y descarta lo que no sea g); sin llave o con error, emoji animado;
      solo el administrador principal; la idea se limpia.
   node .github/weebo-tino.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, pedidos = [];
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); } }) },
    UrlFetchApp: { fetch: () => { throw new Error('UrlFetchApp directo: usa uf_'); } },
    uf_: (url, op) => { pedidos.push(url); const r = o.giphy || { code: 200, data: [] }; return { getResponseCode: () => r.code, getContentText: () => JSON.stringify({ data: r.data }) }; },
    prompt_: () => o.hoja || '',
    paraClaudePrincipalSes_: s => (s && s.email === 'juan@x.com' ? { principal: true } : null)
  };
  vm.createContext(ctx);
  ['weebo.js', 'gif.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  ctx.pedidos = pedidos;
  return ctx;
}

/* 1 · El carácter */
const vieja = fs.readFileSync(path.join(__dirname, 'weebo-semilla-vieja.txt'), 'utf8');
let c = caja({ hoja: vieja });
ok(c.weeboBase_() === c.SEMILLA_WEEBO_, 'La fila WEEBO con la semilla vieja (sembrada en b422291b, nunca editada): manda el código');
c = caja({ hoja: '' }); ok(c.weeboBase_() === c.SEMILLA_WEEBO_, 'La fila WEEBO vacía: manda el código');
c = caja({ hoja: 'MODO WEEBO a mi manera: …' }); ok(/a mi manera/.test(c.weeboBase_()), 'Si Juan la escribió a mano, manda la suya');
const S = caja().SEMILLA_WEEBO_;
ok(/gancho concreto/.test(S) && /Nunca risa sola/.test(S) && /«ja, ja»/.test(S) && /primera respuesta/.test(S), 'El tino: humor solo con gancho; nunca risa sola ni «ja, ja»; nunca en la primera respuesta');
ok(/techo, no una meta/.test(S) && /Por grados, nunca de golpe/.test(S) && /cada varios turnos/.test(S), 'Por grados, el nivel es techo y como mucho una broma cada varios turnos');
ok(/Flubber/.test(S) && /película/.test(S), 'Inspirada en Weebo (Flubber): comentarios rápidos con películas o cultura pop');
ok(/solo si Juan abrió ese tono/.test(S) && !/picardía/.test(S), 'Coquetería solo si Juan abrió ese tono; sin la «picardía» del nivel 3 viejo');
ok(S.length <= 2400, 'La semilla cabe en el presupuesto (' + S.length + ' ≤ 2400 caracteres)');

/* 2 · Mensajes */
c = caja({ props: { WEEBO_MODO: 'fijo', WEEBO_NIVEL_FIJO: '3' } });
const prob = c.weeboBloque_({ contexto: 'admin', principal: true, clave: 'juan@x.com', texto: 'no funciona la cerradura, es urgente', historial: ['jaja'] });
ok(/NIVEL 0/.test(prob), 'Weebo fijo en 3 y un problema urgente: NIVEL 0 (antes seguía en 3)');
/* Se enciende despacio (Juan, 17-nov-2026: «que se active de forma gradual y natural»): aun con el techo en 3, la chispa crece
   con los turnos; no llega de golpe. */
const nivelDe = t => +(String(t).match(/· NIVEL (\d)/) || [0, -1])[1];
const primera = c.weeboBloque_({ contexto: 'admin', principal: true, clave: 'juan@x.com', texto: 'jaja pensemos la estrategia', historial: [] });
const segunda = c.weeboBloque_({ contexto: 'admin', principal: true, clave: 'juan@x.com', texto: 'pensemos la estrategia', historial: ['hola'] });
const rel = c.weeboBloque_({ contexto: 'admin', principal: true, clave: 'juan@x.com', texto: 'jaja pensemos la estrategia', historial: ['hola', 'jaja', 'qué buena idea', 'me encanta', 'genial'] });
ok(nivelDe(primera) === 0 && nivelDe(segunda) === 1 && /NIVEL 3 \(techo 3/.test(rel), 'Weebo fijo en 3: primera respuesta 0, luego 1 y, ya con charla, 3 como techo (por grados, no de golpe)');
const auto = caja();
const m0 = auto.weeboMedir_({ contexto: 'admin', texto: 'jajaja pensemos la estrategia de marca 😂', historial: [] });
const m2 = auto.weeboMedir_({ contexto: 'admin', texto: 'jajaja pensemos la estrategia de marca 😂', historial: ['jaja', 'jaja genial', 'me encanta 😊'] });
ok(m0.nivel === 0 && m0.razones.indexOf('se enciende despacio') >= 0 && m2.nivel > m0.nivel, 'En automático también: mucha risa en el primer mensaje no salta niveles; sube con los turnos');
ok(auto.weeboRampa_(1, false) === 1 && auto.weeboRampa_(1, true) === 2 && auto.weeboRampa_(3, false) === 2 && auto.weeboRampa_(9, true) === 3, 'La rampa: 1–2 mensajes 1, 3–4 mensajes 2, 5 o más 3; abrir el juego suma un grado');

/* Con un socio por WhatsApp: ya no con la vara del huésped (máximo una chispa); cercana, con su ficha de gancho y acento neutro. */
const so = auto.weeboBloque_({ contexto: 'socio', texto: 'jaja qué bien, gracias', historial: ['hola', 'jaja', 'gracias crack', 'genial 😊'] });
ok(/ESTA CONVERSACIÓN: socio/.test(so) && /ficha trae algo suyo/.test(so) && nivelDe(so) >= 1 && nivelDe(so) <= 2 && /neutro latinoamericano/.test(so), 'Socio: su contexto (hasta 2), la ficha como gancho y acento neutro');
const soProb = auto.weeboBloque_({ contexto: 'socio', texto: 'hay una fuga urgente en el apartamento', historial: ['jaja', 'jaja', 'genial', 'gracias'] });
ok(nivelDe(soProb) === 0, 'Socio con un problema urgente: NIVEL 0');
ok(/Lo que sabes de la persona/.test(S) && /mejor gancho/.test(S) && /amigable siempre/.test(S), 'El carácter: amigable siempre y lo que sabe de la persona es su mejor gancho');
const C = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
ok(/weeboBloque_\(\{ contexto: ctx\.ruta === 'socio' \? 'socio' : 'huesped'/.test(C), 'El redactor de WhatsApp usa el contexto socio con los socios');
const F = fs.readFileSync(path.join(DIR, 'fichasocio.js'), 'utf8');
ok(/FICHA_CONECTAR_/.test(F.slice(F.indexOf('function fichaBloque_'))) && /FICHA_CONECTAR_/.test(F.slice(F.indexOf('function fichaVozBloque_'))), 'La ficha del socio pide conectar con lo que contó, por escrito y en la llamada');

/* 3 · Voz */
const voz = c.weeboVozBloque_(false), fam = c.weeboVozBloque_(true);
ok(/mostrar_gif/.test(voz) && !/mostrar_gif/.test(fam), 'La regla del GIF va en la voz de Spacio AM (con Juan), no en la de la familia');
ok(/Empiezas en el centro/.test(voz) && /de a un grado/.test(voz) && /Socio: cálida desde el saludo/.test(voz) && /tu techo con Juan, no tu punto de partida/.test(voz) && !/al empezar y cada vez/.test(voz), 'Voz: empieza en el centro; el Weebo fijo es techo; nivel_weebo solo cuando cambia');
const A = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'playbooks', 'alma.json'), 'utf8'));
const et = JSON.stringify(A).match(/"v_etiquetas"[^}]*/)[0];
ok(/\[laugh\]/.test(et) && /Nunca escribas risas/.test(et), 'La regla de etiquetas prohíbe [laugh] y escribir risas');
const v = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8');
const def = v.slice(v.indexOf('function vozMostrarGif_'), v.indexOf('function vozMostrarGif_') + 1500);
ok(/type: 'client', name: 'mostrar_gif', expects_response: false/.test(def) && /vozMostrarGif_\(\)/.test(v.replace(def, '')), 'mostrar_gif: herramienta de cliente, sin respuesta, en la lista de la voz');

/* 4 · GIF */
c = caja({ props: { GIPHY_KEY: 'k-prueba' }, giphy: { code: 200, data: [
  { rating: 'pg-13', title: 'no', images: { downsized_medium: { url: 'https://media.giphy.com/no.gif' } } },
  { rating: 'g', title: 'Slow clap', images: { downsized_medium: { url: 'https://media.giphy.com/si.gif' } } }] } });
let r = c.gifApi_({ email: 'juan@x.com' }, 'slow clap!!');
ok(r.ok && r.fuente === 'giphy' && r.url === 'https://media.giphy.com/si.gif', 'Con llave: GIPHY y solo el resultado con rating g');
ok(c.pedidos.length === 1 && /[?&]rating=g(&|$)/.test(c.pedidos[0]) && /q=slow%20clap/.test(c.pedidos[0]), 'El pedido a GIPHY va por uf_ con rating=g y la idea limpia');
c = caja({ props: { GIPHY_KEY: 'k' }, giphy: { code: 200, data: [{ rating: 'r', images: { downsized_medium: { url: 'https://x/y.gif' } } }] } });
r = c.gifApi_({ email: 'juan@x.com' }, 'mind blown');
ok(r.ok && r.fuente === 'emoji' && /notoemoji\/latest\/1f92f\//.test(r.url), 'Si GIPHY no trae nada apto (g): emoji animado que corresponde («mind blown» → 🤯)');
c = caja({ props: { GIPHY_KEY: 'k' }, giphy: { code: 500, data: [] } });
ok(c.gifApi_({ email: 'juan@x.com' }, 'aplauso').fuente === 'emoji', 'GIPHY falla: emoji animado');
c = caja();
r = c.gifApi_({ email: 'juan@x.com' }, "I'll be back");
ok(r.ok && r.fuente === 'emoji' && c.pedidos.length === 0 && /1f60e/.test(r.url) && /CC BY 4\.0/.test(r.credito), 'Sin llave: emoji animado de Noto (CC BY 4.0), sin pedir nada afuera');
ok(!c.gifApi_({ email: 'ana@x.com' }, 'clap').ok && !c.gifApi_(null, 'clap').ok, 'Solo el administrador principal');
ok(!c.gifApi_({ email: 'juan@x.com' }, '<>{}').ok && c.gifIdea_('x'.repeat(90)).length === 40, 'La idea se limpia (sin símbolos, 40 letras como mucho)');
const L = fs.readFileSync(path.join(DIR, 'llaves.js'), 'utf8');
ok(/nombre: 'GIPHY_KEY'/.test(L), 'GIPHY_KEY se puede guardar en Ajustes → Llaves');

/* 6 · Los nombres de herramientas no se dicen (Juan, 16-nov-2026: «que Alma no lea en voz alta nivel_weebo»). */
const sinN = new Function(v.match(/var VOZ_HERRAMIENTA_RX_[^\n]+\nfunction vozSinNotas_[^\n]+/)[0] + '; return vozSinNotas_;')();
ok(sinN('nivel_weebo Claro, lo reviso.') === 'Claro, lo reviso.' && sinN('Listo. mostrar_gif("slow clap") Te cuento.') === 'Listo. Te cuento.' && sinN('skip_turn') === '', 'Lo que Alma dice queda sin nombres de herramientas (nivel_weebo, mostrar_gif(…), skip_turn)');
ok(sinN('Escríbele a ana_lopez@correo.com') === 'Escríbele a ana_lopez@correo.com', 'Los correos con guion bajo no se tocan');
ok(/nunca se dicen sus nombres/.test(A.herramientas.titulo) && /no digas su nombre/.test(def) && /ni su nombre/.test(v.slice(v.indexOf('function vozNivelWeebo_'), v.indexOf('function vozMostrarGif_'))), 'El prompt y las herramientas silenciosas piden no decir su nombre');

process.exit(fallo);
