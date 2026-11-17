/* Prueba de apps-script/identidad.js: Maricarmen se llama así solo en la voz; todo lo que sale a otra persona va en
   nombre de Alma (Juan, 17-nov-2026, #667). Revisa que:
   1. «Soy Maricarmen», «te saluda Mari Carmen», «Maricarmen, la asistente…» y la firma «— Maricarmen» pasan a Alma;
   2. una persona de verdad que se llame Maricarmen («Hola Maricarmen», «escríbele a Maricarmen») no se toca;
   3. identidadEntrada_ limpia todos los campos de texto (también dentro de listas) y cambia el mismo objeto;
   4. la regla de voz solo existe con un nombre conocido y con el principal; y está conectada: agEjecutar_ limpia antes
      de cada herramienta, opAgente_ suma la regla al prompt y calle_ la enciende con persona y la apaga al terminar.
   node .github/identidad-voz.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const caja = { esAdminPrincipal_: a => !!(a && a.principal) }; vm.createContext(caja);
vm.runInContext(fs.readFileSync(path.join(DIR, 'identidad.js'), 'utf8'), caja);
const X = caja.identidadExterna_;

ok(X('Hola Lucía, soy Maricarmen, la asistente de Juan.') === 'Hola Lucía, soy Alma, la asistente de Juan.', '1. «soy Maricarmen» → Alma');
ok(X('Buenas, te saluda Mari Carmen de parte de Juan.') === 'Buenas, te saluda Alma de parte de Juan.', '1. «te saluda Mari Carmen» → Alma');
ok(X('Maricarmen, la asistente virtual de Spacio AM, te escribe.') === 'Alma, la asistente virtual de Spacio AM, te escribe.', '1. «Maricarmen, la asistente…» → Alma');
ok(X('Su asistente Maricarmen le confirma.') === 'Su asistente Alma le confirma.', '1. «asistente Maricarmen» → Alma');
ok(X('Gracias por todo.\n— Maricarmen') === 'Gracias por todo.\n— Alma', '1. firma «— Maricarmen» → Alma');
ok(X('Un abrazo,\nMaricarmen') === 'Un abrazo,\nAlma', '1. «Un abrazo, Maricarmen» → Alma');
ok(X('Hi, this is Maricarmen, Juan\'s assistant.') === 'Hi, this is Alma, Juan\'s assistant.', '1. en inglés también');
ok(X('Hola Maricarmen, ¿cómo estás? Soy Alma.') === 'Hola Maricarmen, ¿cómo estás? Soy Alma.', '2. saludo a una Maricarmen de verdad: no se toca');
ok(X('Escríbele a Maricarmen que mañana llego.') === 'Escríbele a Maricarmen que mañana llego.', '2. mencionar a otra Maricarmen: no se toca');
ok(X('') === '' && X(null) === '', '2. vacío queda vacío');

const inp = { texto: 'Soy Maricarmen, te escribo por la llave.', persona: 'Maricarmen', lista: [{ mensaje: 'Te saluda Maricarmen' }], n: 3, si: true };
const out = caja.identidadEntrada_(inp);
ok(out === inp, '3. cambia el mismo objeto');
ok(inp.texto === 'Soy Alma, te escribo por la llave.' && inp.persona === 'Maricarmen' && inp.lista[0].mensaje === 'Te saluda Alma' && inp.n === 3 && inp.si === true, '3. limpia textos (también en listas) y deja lo demás: ' + JSON.stringify(inp));

ok(caja.identidadVozDe_('maricarmen', { principal: true }) === 'Maricarmen' && caja.identidadVozDe_('MariCarmen', { principal: true }) === 'Maricarmen', '4. persona maricarmen con el principal → Maricarmen');
ok(caja.identidadVozDe_('maricarmen', { principal: false }) === '' && caja.identidadVozDe_('otra', { principal: true }) === '' && caja.identidadVozDe_('', { principal: true }) === '', '4. otro admin, otro nombre o nada → Alma');
const regla = caja.identidadVozRegla_('Maricarmen');
ok(/te llamas Maricarmen/.test(regla) && /SIEMPRE en nombre de Alma/.test(regla) && caja.identidadVozRegla_('') === '', '4. la regla dice el nombre de voz y que lo externo va como Alma');

const P = (t, principal = true) => caja.identidadPideAlter_({ principal }, t);
ok(P('Comunicar a Juan con Mari Carmen o solicitarle que lo llame.'), '5. #705: «comunicar a Juan con Mari Carmen o que lo llame» → Alma dice cómo, no escala');
ok(P('Comunícame con Maricarmen') && P('quiero hablar con la Maricarmen') && P('Dile a Maricarmen que me llame') && P('que me llame Maricarmen'), '5. pásame, hablar con, que me llame → dice cómo');
ok(!P('Haz que Maricarmen hable más lento') && !P('Agrégale a Maricarmen que sepa los vuelos') && !P('Maricarmen no funciona en la llamada'), '5. cambiar algo de Maricarmen → sí sigue a Desarrollo');
ok(!P('Comunícame con Maricarmen', false) && !P('Comunícame con Lucía'), '5. otro admin u otra persona → no aplica');
caja.IDENTIDAD_VOZ_ = 'Maricarmen'; ok(!P('Comunícame con Maricarmen'), '5. ya hablando con Maricarmen → no aplica'); caja.IDENTIDAD_VOZ_ = '';
ok(/pásame con Maricarmen/.test(caja.IDENTIDAD_COMO_ALTER_), '5. la respuesta dice cómo llamarla');
const ch = fs.readFileSync(path.join(DIR, 'chat.js'), 'utf8'), iC = ch.indexOf('function chatTurnoCerrar_('), iD = ch.indexOf('chatDesarrollo_(adm', iC);
ok(iC >= 0 && ch.slice(iC, iD).indexOf('identidadPideAlter_(adm, texto)') > 0, '5. chatTurnoCerrar_ lo revisa antes de Desarrollo y de escalar');

const ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8'), ca = fs.readFileSync(path.join(DIR, 'calle.js'), 'utf8');
const iE = ag.indexOf('function agEjecutar_('), iS = ag.indexOf('switch (nombre)', iE);
ok(iE >= 0 && ag.slice(iE, iS).indexOf('identidadEntrada_(inp') > 0, '4. agEjecutar_ limpia la entrada antes de cada herramienta');
ok(/identidadVozRegla_\(IDENTIDAD_VOZ_\)/.test(ag), '4. opAgente_ suma la regla de voz al prompt del turno');
ok(/IDENTIDAD_VOZ_ = typeof identidadVozDe_ === 'function' \? identidadVozDe_\(b\.persona, adm\)/.test(ca) && /finally \{[^}]*IDENTIDAD_VOZ_ = ''/.test(ca), '4. calle_ la enciende con persona y la apaga al terminar');
process.exit(fallo);
