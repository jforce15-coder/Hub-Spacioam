/* ═══ Manos de Alma (navegador) y Atajos de iOS (#396 T3 y T4) ═══
   Herramientas de CLIENTE de la voz: las ejecuta la app de iPhone (alma-app: ManosAlma.swift y AtajosIOS.swift), no el
   Hub; sin URL ni llave. vozDefHerramientas_ (voz.js) las suma a las del agente y el robot voz_tools las publica.
   · Manos de Alma: en el navegador de la app, Alma lee la página (leer_pagina), marca dónde tocar con un círculo durazno
     (senalar) y toca, escribe, baja o abre dentro de su propio navegador. Lo que compra, paga, envía, borra o confirma no
     se toca sin el sí de Juan (la app responde necesita_permiso). Contraseñas y tarjetas nunca: las escribe Juan.
   · Atajos de iOS: corre un atajo de la app Atajos por su nombre, solo si es un atajo permitido (Ajustes de la app).
   La ficha de la llamada dice «NAVEGADOR DE ALMA: …» cuando la app las tiene (VozNativa.swift). Las web apps no las
   tienen: su voz (js/alma-voz.js) contesta que no existen y las reglas dicen que solo se usan con esa ficha.
   Idea de Atticus (github.com/SaarthurR/atticus-mac, MIT): «Draw on screen», el trabajo web en su propia ventana y «Safe by default». */
function vozManosHerramientas_() {
  var s = function (d) { return { type: 'string', description: d }; };
  var b = function (d) { return { type: 'boolean', description: d }; };
  var cliente = function (nombre, segundos, descripcion, props, requeridos) {
    return { type: 'client', name: nombre, expects_response: true, response_timeout_secs: segundos, description: descripcion,
      parameters: { type: 'object', required: requeridos || [], properties: props || {} }, disable_interruptions: false, force_pre_tool_speech: false };
  };
  var solo = ' Úsala SOLO si la FICHA DE QUIEN LLAMA dice «NAVEGADOR DE ALMA».';
  return [
    cliente('leer_pagina', 8, 'Lee la página abierta en el navegador de la app de Alma: título, dirección, el texto principal y la lista de elementos que se pueden tocar o llenar, cada uno con su id («7 · botón · Comprar ahora ⚠»). ⚠ = compra, paga, envía, borra o confirma. Úsala antes de senalar, tocar o escribir, y otra vez si la página cambió.' + solo,
      { para: s('Qué buscas en la página, en pocas palabras (opcional).') }),
    cliente('senalar', 6, 'Marca en la pantalla de Juan, con un círculo durazno y una etiqueta corta, el elemento que tiene que tocar. Un paso a la vez: marca uno, espera a que Juan lo haga o diga «listo» y sigue con el siguiente. La marca se quita sola cuando Juan toca la pantalla.' + solo,
      { id: s('El id del elemento (de leer_pagina).'), texto: s('La etiqueta corta junto al círculo, p. ej. «Toca aquí» o «Escribe tu correo».') }, ['id', 'texto']),
    cliente('tocar', 15, 'Toca (hace clic en) un elemento de la página en el navegador de Alma y dice qué cambió. Si responde necesita_permiso, NO se tocó: pregúntale a Juan en una frase y solo si dice que sí vuelve a llamarla con el mismo id y confirmado: true. Si dice que no pudo confirmar el resultado, díselo a Juan así.' + solo,
      { id: s('El id del elemento (de leer_pagina).'), confirmado: b('true SOLO cuando Juan ya dijo que sí a lo que pidió necesita_permiso.') }, ['id']),
    cliente('escribir', 15, 'Escribe un texto en un campo de la página (o elige una opción de una lista, o marca una casilla con «sí» / «no»). Nunca escribe contraseñas ni números de tarjeta: esos los escribe Juan. Con enter: true da Enter, solo en una búsqueda.' + solo,
      { id: s('El id del campo (de leer_pagina).'), texto: s('Lo que se escribe, o la opción que se elige.'), enter: b('true para dar Enter después (solo en un cuadro de búsqueda).') }, ['id', 'texto']),
    cliente('bajar', 6, 'Mueve la página del navegador de Alma para ver más.' + solo,
      { cuanto: { type: 'string', enum: ['poco', 'pantalla', 'subir', 'inicio', 'final'], description: 'poco · pantalla (por defecto) · subir (una pantalla hacia arriba) · inicio · final.' } }),
    cliente('abrir', 15, 'Abre una dirección web en el navegador de la app de Alma, o busca en Google lo que le pases. Solo páginas web.' + ' Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ESTÁS EN LA APP DE ALMA».',
      { url: s('La dirección (p. ej. «https://…» o «amazon.com») o lo que hay que buscar.') }, ['url']),
    cliente('correr_atajo', 8, 'Corre un atajo de la app Atajos del iPhone de Juan por su nombre (p. ej. «Modo concentración»). Solo corren sus atajos permitidos: si responde permitido: false, dile que lo agregue en Ajustes → Atajos permitidos. Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ESTÁS EN LA APP DE ALMA».',
      { nombre: s('El nombre del atajo, como lo dijo Juan.') }, ['nombre'])
  ];
}
/* Las reglas del prompt de voz (vozQuienBloque_, voz.js). Cortas: el prompt tiene presupuesto. */
var VOZ_MANOS_REGLA_ = '· MANOS DE ALMA (solo si la ficha dice «NAVEGADOR DE ALMA»): si Juan pregunta «¿dónde toco…?» o «¿cómo hago…?» en la página, usa leer_pagina y senalar UN paso a la vez, con una etiqueta corta; espera a que lo haga o diga «listo» antes del siguiente. Si pide «llena…», «búscame…» o «haz clic…», hazlo tú paso a paso (tocar, escribir, bajar, abrir) y narra en corto («Escribo tu correo… listo»). Antes de comprar, pagar, enviar, borrar o confirmar (lo marcado con ⚠ o cuando la herramienta responde necesita_permiso) pregúntale siempre en una frase y repite con confirmado: true solo con su sí. Nunca escribas contraseñas ni números de tarjeta: dile que los escriba él. Di qué cambió; si la herramienta no pudo confirmar el resultado, dilo así.';
var VOZ_ATAJOS_REGLA_ = '· ATAJOS DE iOS (solo si la ficha dice «ESTÁS EN LA APP DE ALMA»): si Juan pide correr uno de sus atajos («pon mi atajo de música»), usa correr_atajo con el nombre. Si responde permitido: false, dile que lo agregue en Ajustes → Atajos permitidos; no busques otro camino.';
