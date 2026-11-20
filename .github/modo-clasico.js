/* Modo clásico (Juan, 20-nov-2026, #923): «un modo como combate militar, donde Alma responde de forma pasiva, algo
   como “copiado”». Prueba sin red que:
   1. la regla pide confirmar con «Copiado.» en 1 a 4 palabras, sin sugerencias ni bromas, y deja los encargos completos;
   2. prendido, el chat de Juan lleva la regla y el Modo Weebo en 0; apagado, nada cambia; con el equipo o huéspedes, nada;
   3. la ficha de la llamada saluda corto y lleva la regla aparte (Claudio no la recibe);
   4. solo el principal lo prende; la herramienta modo_clasico existe en el chat y el interruptor en Ajustes → Personalidad;
   5. (guardia 20-nov-2026) Alma reconoce «modo táctico» y «modo militar» como el Modo clásico, prendido o apagado.
   node .github/modo-clasico.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const props = {};
const ctx = { console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isFinite,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
  prompt_: () => '', maricarmenWeebo_: () => false, MARICARMEN_BLOQUE_: '',
  paraClaudePrincipalSes_: s => (s === 'juan' ? { email: 'juan@x', principal: true } : null),
  adaptLeer_: () => ({ nivel: 0, tope: 60, mensajes: 0 }), adaptTope_: () => 20, adaptFijarTope_: () => ({ ok: true }), ADAPT_PASO_: 5, ADAPT_CADA_: 10 };
vm.createContext(ctx);
['clasico.js', 'weebo.js', 'medidores.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
const R = vm.runInContext('CLASICO_REGLA_', ctx);

ok(/«Copiado\.»/.test(R) && /1 a 4 palabras/.test(R) && /sin sugerencias/.test(R) && /sin bromas/.test(R) && /completo y exacto/.test(R), '1 · la regla: «Copiado.» en 1 a 4 palabras, sin sugerencias ni bromas; los encargos, completos');
ok(!/\bva\b/i.test(R), '1 · sin «va» en la regla');

const juan = { contexto: 'admin', principal: true, texto: 'jaja qué buena idea, pensemos la estrategia', historial: ['jaja', 'jaja', 'genial', 'gracias', 'jaja'] };
ok(!/MODO CLÁSICO/.test(ctx.weeboBloque_(juan)), '2 · apagado: el chat no lleva la regla');
ok(ctx.clasicoFijar_({ principal: false }, true).ok === false && !props.ALMA_CLASICO, '4 · alguien que no es el principal no lo prende');
ok(ctx.personalidadFijarApi_('juan', { clasico: true }).clasico === true && props.ALMA_CLASICO === '1', '4 · Ajustes (personalidadFijar) lo prende y personalidad lo devuelve');
const b = ctx.weeboBloque_(juan);
ok(/MODO CLÁSICO/.test(b) && /NIVEL 0/.test(b), '2 · prendido: el chat de Juan lleva la regla y el Weebo en 0 aunque se ría');
ok(!/MODO CLÁSICO/.test(ctx.weeboBloque_({ contexto: 'huesped', texto: 'hola' })) && !/MODO CLÁSICO/.test(ctx.weeboBloque_({ contexto: 'admin', principal: false, texto: 'hola' })), '2 · con huéspedes y el equipo no cambia nada');
const f = ctx.personalidadFicha_({ email: 'juan@x', principal: true });
ok(f.clasico === true && /MODO CLÁSICO/.test(f.clasico_regla) && !/MODO CLÁSICO/.test(f.bloque) && f.weebo_nivel === 0, '3 · la ficha lleva la regla aparte (Claudio no la recibe) y Weebo en 0');
ok(f.saludos.length > 1 && f.saludos.every(s => s.split(/\s+/).length <= 4) && f.first_message === 'Adelante.', '3 · la llamada saluda corto («Adelante.», «Te copio.»)');
ok(ctx.clasicoHerramienta_({ principal: true }, { encender: false }).clasico === false && !props.ALMA_CLASICO, '4 · la herramienta lo apaga');
const fa = ctx.personalidadFicha_({ email: 'juan@x', principal: true });
ok(!fa.clasico && fa.first_message === undefined, '3 · apagado, la ficha vuelve a la normal');
/* Guardia 20-nov-2026: «ya tenemos activado el modo táctico» y Alma solo se rió. */
ok(/modo táctico/.test(R) && /modo militar/.test(R) && /Confirmado\./.test(R), '5 · prendido: la regla reconoce «modo táctico» y «modo militar» y confirma «Confirmado.»');
ok(/MODO CLÁSICO \(apagado\)/.test(fa.clasico_regla) && /modo táctico/.test(fa.clasico_regla) && /activa el modo clásico/.test(fa.clasico_regla) && !/MODO CLÁSICO/.test(fa.bloque), '5 · apagado: la ficha de la llamada reconoce «modo táctico» y lo pide como «activa el modo clásico» (Claudio no lo recibe)');

const ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8'), voz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8');
ok(/T\('modo_clasico', '[^']*modo táctico[^']*modo militar/.test(ag), '5 · la herramienta modo_clasico del chat reconoce «modo táctico» y «modo militar»');
ok(/T\('modo_clasico'/.test(ag) && /case 'modo_clasico'/.test(ag) && /esAdminPrincipal_\(adm\)\) return \{ error: 'Solo Juan prende o apaga el Modo clásico/.test(ag), '4 · herramienta modo_clasico en el chat, solo Juan');
ok(/pf\.clasico_regla/.test(voz), '3 · la llamada de Alma suma la regla a la ficha');
const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
ok(/id="g-clasico"/.test(html) && /id="pp-clasico"/.test(html) && /fijar\(\{ clasico: on \}/.test(html), '4 · interruptor en Ajustes → Personalidad');
process.exit(fallo);
