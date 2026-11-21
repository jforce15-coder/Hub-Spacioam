/* ═══ Recorte del prompt de voz (Juan, 21-nov-2026: «Vámonos con las tres partes de una vez, pero con prueba de calidad
   en cada parte») ═══
   El prompt de voz estaba en 42 798 de 42 800 caracteres. Ninguna regla se borró: cada una se movió a donde aplica.
   · Parte A: al código que la hace cumplir (guardas y `decir` de las herramientas) o a la ficha de la llamada.
   · Parte B: a la ficha de quien llama, solo cuando aplica (B1 en la app de Alma; B2 cuando llama Juan).
   · Parte C (persona.js): la lista de herramientas del prompt queda en su cabecera; cada herramienta ya trae en
     ElevenLabs su descripción completa (vozDefHerramientas_, manos.js, guia.js, anillo, VOZ_SISTEMA_DESC_).
   La compuerta de calidad (mismos casos antes y después) está en .github/recorte-voz.js y en el PR. */

/* ── A2: quién llama. Con la ficha activa (VOZ_INICIO_OK) el prompt dice una línea; cada ficha dice lo suyo. ── */
var VOZ_QUIEN_LARGO_ = 'QUIÉN LLAMA (lo dice la FICHA DE QUIEN LLAMA, al final de estas instrucciones, o lookup_reservation en caller_type). Si la ficha ya dice quién es (Juan, alguien del equipo, un socio, la familia o un huésped con reserva validada), NO llames lookup_reservation: ya está identificado. Solo si no hay ficha o dice «Número no identificado», tu PRIMERA acción, apenas la persona diga algo, es llamar lookup_reservation solo con caller_id, antes de responder o preguntar nada. Si alguien pregunta si reconoces su número y la ficha no lo dice, consúltalo con la herramienta antes de contestar.';
var VOZ_QUIEN_CORTO_ = 'QUIÉN LLAMA: lo dice la FICHA DE QUIEN LLAMA (al final de estas instrucciones) o caller_type de lookup_reservation; la ficha dice si ya está identificado o si lookup_reservation va primero.';
var VOZ_YA_IDENTIFICADO_ = ' Ya está identificado por el Hub: NO llames lookup_reservation.';
/* Lo que antes decía el prompt para un número que no se conoce va en la ficha por defecto (VOZ_DESCONOCIDO_, voz.js). */

/* ── A1: con un administrador (caller_type juan, o equipo con rol admin). Va en su ficha; lookup_reservation además lo
   recuerda si la llaman de más (vozLookup_). ── */
var VOZ_FICHA_ADMIN_ = '\nCON UN ADMINISTRADOR: NUNCA lookup_reservation NI hospitable_router en esta llamada (ni para identificarle, ni para buscar una reserva o un huésped): cada consulta tarda; lo que pida va por secretaria o a_mano; un envío con destinatario y texto claros, o ya confirmado, va por enviar_confirmado. Las personas del equipo (Jorge, Gabriel, Santiago, técnicos, recepciones de edificios) no son huéspedes: nunca busques «la reserva de» alguien del equipo.';

function vozEsAdminTel_(tel) { try { return !!(tel && adminPorTel_(tel)); } catch (e) { return false; } }

/* ── B2: solo cuando llama Juan (el administrador principal), más el formato que él pidió para el modo agente. ── */
var VOZ_FORMATO_JUAN_ = '\nFORMATO CON JUAN (cuando te pide cómo va algo, sus pendientes o un resumen de trabajo): organiza por esfera y proyecto; de cada uno, una frase: qué hiciste, cómo está y qué necesitas de él y por qué. Pide UNA decisión a la vez, la más urgente, con opciones cortas y la que recomiendas primero; lo demás queda para después.';
function vozFichaJuan_() {
  return ['\nSOLO CON JUAN:',
    '· MEJORAS DEL SISTEMA: si Juan pide cambiar cómo funciona algo (una regla, una función nueva, algo que falla, «dile a Claudio…»), nunca digas que no puedes: usa secretaria con «Mejora para Claude (sencillo): …» o «Mejora para Claude (complejo): …» y el pedido completo. Sencillo: una pregunta simple, leer datos, un cambio chico y claro; complejo: lógica, funciones nuevas, errores, varias partes; con duda, complejo. Al volver di solo lo que diga secretaria («Listo, quedó pedido.»). Un ajuste («agrégale…») va igual, con «Mejora para Claude: agrégale …»; «con Opus» o «súbelo»: «Mejora para Claude: súbelo». Un pedido para Claudio va solo, no junto con otros. Si quien lo pide no es Juan, dile que se lo pida a Juan.',
    '· ' + CLAUDE_DERIVAR_REGLA_ + ' Por llamada, usa secretaria empezando por «Mejora para Claude:» como arriba (casi siempre complejo).',
    '· AVÍSAME CUANDO: «avísame cuando cambie la puerta de mi vuelo», «cuando responda el huésped», «cuando se una el PR», «avísale a Lucky cuando aterrice»: usa secretaria con su pedido tal cual; ella deja la vigilancia y avisa sola. «Deja de vigilar…», igual.'
  ].join('\n') + VOZ_FORMATO_JUAN_;
}

/* ── B1: solo en la app de Alma (iPhone). Las web apps no tienen música, pantalla del chat, navegador ni atajos. ── */
function vozFichaApp_(esJuan) {
  return ['\nEN LA APP DE ALMA:',
    esJuan ? '· MÚSICA: si pide música («pon…», «algo para…», «pausa la música», «súbele»), usa secretaria con su pedido tal cual, empezando por «Música:». Confirma en una frase corta.' : '',
    '· MOSTRAR EN EL CHAT: cuando la respuesta trae muchos datos (un itinerario, una lista, una tabla, muchos números o un texto largo), usa mostrar_en_chat sin anunciarlo, con un título corto y toda la información en markdown (listas, tablas, horas, fechas y montos exactos); solo si responde que se mostró, di «ya lo tienes en pantalla» y resume en UNA frase. Nunca prometas pantalla antes ni escribas tablas en lo que dices. Si la herramienta responde que no se pudo mostrar, dilo por voz en corto, solo lo más importante.',
    VOZ_MANOS_REGLA_, VOZ_ATAJOS_REGLA_
  ].filter(Boolean).join('\n');
}

/* La ficha de la llamada desde la app o el Hub (vozWebInicio_): quién es, lo de la app (B1) y la ficha del número.
   Si la ficha del número no lo reconoció como Juan pero su sesión es la del principal, B2 va igual (una sola vez). */
function vozFichaWeb_(adm, nom, app, fichaTel) {
  var t = vozWebFicha_(adm, nom) + (app ? '\nESTÁS EN LA APP DE ALMA (iPhone): aquí sí puedes poner música (Spotify), correr sus atajos permitidos de iOS y, cuando esté conectada, controlar la casa.' + vozFichaApp_(esAdminPrincipal_(adm)) : '') + '\n\n' + String(fichaTel || '').split(VOZ_FICHA_ADMIN_).join('');   // A1 ya va en vozWebFicha_
  if (esAdminPrincipal_(adm) && t.indexOf('SOLO CON JUAN:') < 0) t += vozFichaJuan_();
  return t;
}

/* ── A10: el momento de la estadía, con su frase (antes estaba en el prompt: «compara today con check_in y check_out»). ── */
function vozMomento_(stay, ci, co) {
  if (stay === 'antes_del_checkin') return 'Aún no llega (entra el ' + ci + '). Si reporta algo del interior, aclárale la fecha con calidez: muchos reportes se explican con la fecha. Nunca coordines mantenimiento para una estadía que no ha empezado. El ingreso es desde las 15:00; nunca prometas early check-in.';
  if (stay === 'despues_del_checkout') return 'Ya salió (salida el ' + co + '). Lo que reporte lo dejas anotado para el equipo.';
  return 'Está en su estadía (del ' + ci + ' al ' + co + '): un reporte del interior es de ahora; compáralo con estas fechas antes de resolverlo.';
}

/* ── A9 y A11: el código de la cerradura nunca sale por llamada (infoPropiedad_ no lo trae). La frase, lista. ── */
function vozCodigoPuerta_(ci, hoy) {
  return 'Hay dos códigos distintos: el del apartamento (cerradura) y el del edificio (portería, lobby, garita o ascensor); nunca los confundas ni ofrezcas uno por el otro. Del edificio, solo lo que diga info. El de la cerradura no lo tienes por llamada: «Te llega directamente por la plataforma, un día antes de tu llegada»' +
    (ci && ci === hoy ? ' (su entrada es hoy: agrega «si en unos minutos no lo ves, el equipo te lo envía por WhatsApp a este mismo número»)' : '') +
    '. Si ya se lo dijiste en esta llamada y lo pide otra vez, repítelo tal cual. Nunca inventes ni prometas un código.';
}

/* ── A3, A4–A6 y A5: guardas de secretaria (antes eran líneas del prompt).
   · Un pedido va una sola vez: el mismo pedido en la misma llamada (en primer plano o en segundo plano) no sale dos veces.
   · Si falla: «No pude…» en `decir`, nunca como hecho. Si se cae del todo, pasa sola a segundo plano. ── */
var VOZ_SEC_REPETIDO_S_ = 600;
function vozSecClave_(b) {
  var conv = String(b.conv_id || '').trim(), tel = normTel_(b.caller_id || b.system__caller_id || '');
  var p = String(b.pedido || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  /* Las respuestas cortas («Sí, hazlo», «Sí, envíalo») se repiten con razón: contestan borradores distintos. */
  if (!p || p.length < 30 || /^(si|no|ok|listo)\b/.test(p)) return '';
  return (conv || tel) ? 'vozsecped_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, (conv || tel) + '|' + p, Utilities.Charset.UTF_8)).slice(0, 40) : '';
}
function vozSecretariaGuardada_(b) {
  var c = CacheService.getScriptCache(), k = vozSecClave_(b || {});
  if (k && c.get(k)) return { ok: true, ya_pedido: true, decir: 'Ese pedido ya salió en esta llamada (un pedido va una sola vez): no lo repitas. Si pregunta en qué quedó, di que sigue en proceso y que le avisas.' };
  var r;
  try { r = vozSecretaria_(b); }
  catch (e) {
    console.error('vozSecretaria_: ' + (e.stack || e));
    var tel = normTel_(b.caller_id || b.system__caller_id || '');
    if (tel && String(b.pedido || '').trim() && adminPorTel_(tel)) {
      try { vozSecEncolar_(tel, String(b.pedido), vozEsConferencia_(b.conv_id)); if (k) c.put(k, '1', VOZ_SEC_REPETIDO_S_);
        return { ok: true, en_proceso: true, decir: 'Falló a la primera; ya quedó en segundo plano (no lo reintentes en la llamada). Dile en una frase que lo trabajas por detrás y le avisas.' }; } catch (e2) { console.error('vozSecretaria_ segundo plano: ' + e2); }
    }
    return { ok: false, error: 'interno', decir: 'No pude: mi sistema falló. NO se hizo: dilo así y no lo reintentes en la llamada.' };
  }
  if (r && r.ok === false) { if (!r.decir) r.decir = 'No pude: ' + String(r.error || 'mi sistema no lo confirmó') + ' NO se hizo: dilo así («no pude, mi sistema me respondió…») y nunca digas que quedó.'; }
  else if (k && r && !r.ya_pedido) c.put(k, '1', VOZ_SEC_REPETIDO_S_);
  return r;
}
