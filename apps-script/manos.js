/* ═══ Manos de Alma (navegador) y Atajos de iOS (#396 T3 y T4) ═══
   Herramientas de CLIENTE de la voz: las ejecuta la app de iPhone (alma-app: ManosAlma.swift y AtajosIOS.swift), no el
   Hub; sin URL ni llave. vozDefHerramientas_ (voz.js) las suma a las del agente y el robot voz_tools las publica.
   · Manos de Alma: en el navegador de la app, Alma lee la página (leer_pagina), marca dónde tocar con un círculo durazno
     (senalar) y toca, escribe, baja o abre dentro de su propio navegador. Lo que compra, paga, envía, borra o confirma no
     se toca sin el sí de Juan (la app responde necesita_permiso). Contraseñas y tarjetas nunca: las escribe Juan.
   · Atajos de iOS: corre un atajo de la app Atajos por su nombre, solo si es un atajo permitido (Ajustes de la app).
   · Modos del Navegador de Alma (#773): GUIADO (senalar + mostrar_dato: la tarjeta para copiar y pegar,
     que se queda aunque la llamada termine), CONTROL (tocar, escribir y bajar una a la vez, con pausa humana y tope por
     sitio: pausa_sitio) y PAUSA DE PRIVACIDAD (contraseña, código, tarjeta o captcha a la vista: la app responde te_toca y
     no lee ni captura nada). Las reglas largas van en la ficha de la app (ManosAlma.modos), no en el prompt fijo.
   · Apple Pay (#662): abrir_apple_pay abre la vista de pago (su atajo de Apple Pay o Wallet); nunca lee ni cobra tarjetas.
   La ficha de la llamada dice «NAVEGADOR DE ALMA: …» cuando la app las tiene (VozNativa.swift). Las web apps no las
   tienen: su voz (js/alma-voz.js) contesta que no existen y las reglas dicen que solo se usan con esa ficha.
   Idea de Atticus (github.com/SaarthurR/atticus-mac, MIT): «Draw on screen», el trabajo web en su propia ventana y «Safe by default». */
function vozManosHerramientas_() {
  var s = function (d) { return { type: 'string', description: d }; };
  var b = function (d) { return { type: 'boolean', description: d }; };
  var cliente = function (nombre, segundos, descripcion, props, requeridos) {
    return { type: 'client', name: nombre, expects_response: true, response_timeout_secs: segundos, description: descripcion,
      parameters: { type: 'object', required: requeridos || [], properties: props || {} }, disable_interruptions: false,
      pre_tool_speech: 'off', force_pre_tool_speech: false };   // sin frase antes (#446 T7: «Déjame revisar tu cuenta…» antes de abrir)
  };
  var solo = ' Úsala SOLO si la FICHA DE QUIEN LLAMA dice «NAVEGADOR DE ALMA».';
  return [
    cliente('leer_pagina', 8, 'Lee la página abierta en el navegador de la app de Alma: título, dirección, el texto principal y la lista de elementos que se pueden tocar o llenar, cada uno con su id («7 · botón · Comprar ahora ⚠»). ⚠ = compra, paga, envía, borra o confirma. Úsala antes de senalar, tocar o escribir, y otra vez si la página cambió. Con para, viene solo lo que importa (más rápido). Si responde te_toca, la pantalla es privada (contraseña, código, tarjeta o «soy humano»): no la ves; dile a Juan «te toca a ti» y espera su «listo».' + solo,
      { para: s('Qué buscas en la página, en pocas palabras (opcional; mejor con ella).') }),
    cliente('senalar', 6, 'Marca en la pantalla de Juan, con un círculo durazno y una etiqueta corta, el elemento que tiene que tocar. Un paso a la vez: marca uno, espera a que Juan lo haga o diga «listo» y sigue con el siguiente. La marca se quita sola cuando Juan toca la pantalla.' + solo,
      { id: s('El id del elemento (de leer_pagina).'), texto: s('La etiqueta corta junto al círculo, p. ej. «Toca aquí» o «Escribe tu correo».') }, ['id', 'texto']),
    cliente('tocar', 15, 'Toca (hace clic en) un elemento de la página en el navegador de Alma y dice qué cambió. Si responde necesita_permiso, NO se tocó: pregúntale a Juan en una frase y solo si dice que sí vuelve a llamarla con el mismo id y confirmado: true. Si dice que no pudo confirmar el resultado, díselo a Juan así. Si responde te_toca, es de Juan (contraseña, código, tarjeta o «soy humano»); si responde pausa_sitio o espera, la página no quiere prisa: espera los segundos que dice.' + solo,
      { id: s('El id del elemento (de leer_pagina).'), confirmado: b('true SOLO cuando Juan ya dijo que sí a lo que pidió necesita_permiso.') }, ['id']),
    cliente('escribir', 15, 'Escribe un texto en un campo de la página (o elige una opción de una lista, o marca una casilla con «sí» / «no»). Nunca escribe contraseñas ni números de tarjeta: esos los escribe Juan. Con enter: true da Enter, solo en una búsqueda.' + solo,
      { id: s('El id del campo (de leer_pagina).'), texto: s('Lo que se escribe, o la opción que se elige.'), enter: b('true para dar Enter después (solo en un cuadro de búsqueda).') }, ['id', 'texto']),
    cliente('mostrar_dato', 6, 'Modo guiado: pone un dato en la tarjeta para copiar, encima del navegador de Alma (p. ej. «Número de reserva · HM4K2Q»), para que Juan lo toque, se copie y lo pegue donde le señalaste. Se queda aunque la llamada termine; Juan la cierra. Misma etiqueta = se reemplaza. Nunca contraseñas, códigos ni tarjetas (responde rechazado).' + solo,
      { etiqueta: s('Qué es, corto (p. ej. «Correo», «Número de reserva»).'), valor: s('El dato tal cual se pega.') }, ['etiqueta', 'valor']),
    cliente('bajar', 6, 'Mueve la página del navegador de Alma para ver más.' + solo,
      { cuanto: { type: 'string', enum: ['poco', 'pantalla', 'subir', 'inicio', 'final'], description: 'poco · pantalla (por defecto) · subir (una pantalla hacia arriba) · inicio · final.' } }),
    cliente('abrir', 15, 'Abre una dirección web en el navegador de la app de Alma, o busca en Google lo que le pases. Solo páginas web.' + ' Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ESTÁS EN LA APP DE ALMA».',
      { url: s('La dirección (p. ej. «https://…» o «amazon.com») o lo que hay que buscar.') }, ['url']),
    cliente('correr_atajo', 8, 'Corre un atajo de la app Atajos del iPhone de Juan por su nombre (p. ej. «Modo concentración»). Solo corren sus atajos permitidos: si responde permitido: false, dile que lo agregue en Ajustes → Atajos permitidos. Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ESTÁS EN LA APP DE ALMA».',
      { nombre: s('El nombre del atajo, como lo dijo Juan.') }, ['nombre']),
    /* Apple Pay por voz (#662): Alma no lee las tarjetas de Wallet (iOS no deja); abre la vista de pago. La app corre su atajo
       permitido con «Apple Pay», «Wallet» o «Cartera» en el nombre, o si no tiene, abre Wallet. No paga: Juan usa Face ID. */
    cliente('abrir_apple_pay', 8, 'Abre Apple Pay en el iPhone de Juan para que pague (su atajo de Apple Pay si lo tiene en sus atajos permitidos, o la app Wallet con sus tarjetas). No paga ni lee las tarjetas: Juan elige la tarjeta, confirma con Face ID y acerca el teléfono. Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ESTÁS EN LA APP DE ALMA».')
  ];
}
/* Las reglas del prompt de voz (vozQuienBloque_, voz.js). Cortas: el prompt tiene presupuesto. */
var VOZ_MANOS_REGLA_ = '· MANOS DE ALMA (solo con la ficha «NAVEGADOR DE ALMA», que trae sus MODOS): «¿dónde toco…?» o «¿cómo hago…?» → leer_pagina y senalar UN paso a la vez y espera su «listo»; el dato que debe poner, con mostrar_dato. «Llena…», «búscame…», «haz clic…» → hazlo tú paso a paso (tocar, escribir, bajar, abrir) y narra en corto. Antes de comprar, pagar, enviar, borrar o confirmar (⚠ o necesita_permiso) pregúntale en una frase y repite con confirmado: true solo con su sí. Contraseñas, códigos, tarjetas y «soy humano» son de Juan: con te_toca dile «te toca a ti» y espera. Di qué cambió; si no pudiste confirmarlo, dilo así.';
var VOZ_ATAJOS_REGLA_ = '· ATAJOS DE iOS (solo con «ESTÁS EN LA APP DE ALMA»): «pon mi atajo de música» → correr_atajo con el nombre; si responde permitido: false, dile que lo agregue en Ajustes → Atajos permitidos. Pagar con Apple Pay → abrir_apple_pay.';
