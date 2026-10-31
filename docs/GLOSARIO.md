# Glosario de Spacio AM y Alma

Una palabra, un significado. Úsalas así en el código, en la app, en los PRs y al hablar con Juan. Si hace falta una
palabra nueva, se agrega aquí en el mismo PR. La columna «Evitar» son los sinónimos que confunden.

| Palabra | Qué es (y solo eso) | Evitar |
|---|---|---|
| **Alma** | La asistente: la única que habla con las personas (Juan, equipo, socios, huéspedes). | bot, IA, sistema |
| **La roca** | El botón de Alma que flota en las web apps y en la app (sa-nav); en el inicio, la piedra grande al centro. | botón, burbuja, círculo |
| **Modo anillo** | Dos toques del anillo encienden o apagan el modo conferencia, también con el teléfono bloqueado (ya no abren una llamada propia). Si Alma está hablando, dos toques la pausan o la retoman. | modo amigo, manos libres |
| **Llamada** | Una conversación de voz con Alma (por la roca, el anillo o WhatsApp). | sesión de voz |
| **Agente** | Uno del equipo detrás de Alma (Operaciones, Huéspedes, Finanzas, Crecimiento, Marketing, Mantenimiento, Desarrollo, Archivo). Revisa y propone; no habla con nadie. | bot, robot |
| **Playbook** | Cómo trabaja un agente: meta, pasos, reglas (las de Juan incluidas), caja de herramientas y «listo significa». Se arregla el playbook, no el chat. | instrucciones, prompt |
| **Subdepartamento** | Un agente de Desarrollo dueño de una sola app (Hub, API, App de Alma, Hola, Epi, Grow, Mi, Docs), con su playbook. | equipo de la app |
| **Personalidad de Alma** | Su playbook propio (`playbooks/alma.md`): cómo habla y se expresa. No nombra ningún negocio, así Alma se puede llevar a otro. | prompt de voz, tono |
| **Playbook del negocio** | Lo de un negocio (`playbooks/negocio-<nombre>.md`): datos, voz de marca, cómo se dice y el índice de playbooks. | contexto, configuración |
| **Caja de herramientas** | Lo que Juan ya aprobó de un agente; lo reúsa como plantilla en vez de rehacerlo. | ejemplos, historial |
| **Listo significa** | La lista que un agente revisa antes de entregar: su prueba. | criterios, checklist |
| **Propuesta** | Lo que un agente quiere hacer afuera y espera el «sí» de Juan. | sugerencia, tarea |
| **Segundo plano** | Lo que Alma sigue trabajando después de colgar (más de 20 s). | backend, después |
| **Tema por retomar** | Algo terminado en segundo plano que necesita algo de Juan. Al empezar una llamada Alma lo ofrece con suavidad («Cuando quieras vemos tus pendientes; el más importante es …, ¿lo retomamos?»): uno solo, sin listas ni números, y no lo repite si lo ofreció hace menos de 2 horas. | pendiente, notificación |
| **Pendientes** | Solo lo que necesita una acción de Juan (decidir, responder, unir, comprar), de Alma, de Claude o un cambio por unir; por esfera y proyecto. Se queda hasta resolverse. Las tarjetas que piden respuesta tienen «Responder». | tareas, temas, notificaciones |
| **Notificaciones** | La campana junto a Pendientes, con el mismo semicírculo de esferas: lo que Alma te avisó y lo que no pide nada de ti (para leer, ya listo, lo que Claude está trabajando o publicando), por día, últimos 3 días. Un aviso de algo que sí pide acción lleva a Pendientes. | avisos, alertas |
| **Barra de avisos** | La píldora de vidrio arriba de las esferas (al tocar a Alma en el inicio): de cada esfera, lo más importante (primero lo que pide algo de ti; si no, el aviso más nuevo de 24 h), uno a la vez. Su esfera crece y brilla. Al tocarla se abre con los mismos botones de Pendientes y «Ver en Pendientes / Notificaciones». | ticker, banner, carrusel |
| **Modo avisos** | Dos toques a Alma con las esferas abiertas: Alma te cuenta tus avisos uno por uno mientras la barra muestra cada uno. Si le hablas o tocas la barra, deja la lista y te acompaña en ese. | modo notificaciones, lectura de avisos |
| **Mejora de llamadas** | El subequipo de mejora continua que cuida las llamadas con Alma: cada lunes arma el reporte de llamadas y propone mejoras (lo que no cambia nada para Juan va directo a Claude; lo que sí, espera su sí). | equipo de voz |
| **Movimiento con sentido** | El principio del design system (`ds/movimiento.md`) de que cada movimiento dice algo: resorte en lo que mueves, el toque que se siente, sale de donde tocaste, el «no» que se sacude, la píldora que viaja y nada salta. | animaciones, efectos |
| **Rápido de sentir** | El principio del design system (`ds/velocidad.md`) para diseñar la espera: el resultado primero, la forma antes que el contenido, algo ahí desde el principio, la barra que termina rápido, el trabajo adelantado y que se vea el trabajo. Nunca una pantalla en blanco ni un «Cargando…» sin forma. | carga rápida, optimización |
| **Foto** | La copia de la primera pantalla que se guarda en el teléfono para mostrarla al instante al abrir (`ds/velocidad.md`, regla 8). Por persona y versión, vence a las 24 h, se borra al cerrar sesión, nada sensible. Mientras se ve dice «actualizando…» y ningún botón decide con ella. | caché, snapshot |
| **Reporte de llamadas** | El reporte semanal (lunes, la semana anterior) en Ajustes → Reportes: silencio, relleno, cortes, tiempo de respuesta en 3 niveles, cada modo y las propuestas del equipo. | dashboard, informe |
| **Modo conferencia** | El botón de la reunión, junto a «Iniciar llamada»: Alma escucha sin la llamada de ElevenLabs y despierta al oír «Alma». Si habla una persona usa el dictado del iPhone; si son varias, ElevenLabs transcribe distinguiendo las voces. Al terminar lo clasifica y lo deja en Pendientes. | modo reunión, grabar |
| **Inicio con escucha activa** | Ajuste de la app (encendido por defecto): con Alma abierta en el inicio, el iPhone escucha en el teléfono y Alma despierta cuando dices «Alma». No graba ni guarda nada. | escucha siempre, manos libres |
| **Puntito de escucha** | El punto durazno que respira cuando Alma está escuchando: bajo la roca (inicio con escucha activa) y en la esquina del botón del modo conferencia. Sin palabras. | luz, indicador del micrófono |
| **Beep** | El sonido corto de Alma (alma-inicio) que suena siempre que empieza a escuchar: anillo, roca, llamada, «Alma» en el inicio o en una reunión, tres toques en una página, dictado. Al terminar suena alma-fin. | beat, señal, campana, tono |
| **Familia** | Las personas de la familia de Juan (p. ej. Christine, su esposa) guardadas en Contactos con tipo «familia». Alma las reconoce por su número, las trata por su nombre y en su idioma, como «la asistente de Juan», y les da lo personal de Juan (viajes, vuelos, agenda); nada de Spacio AM. | círculo cercano, VIP |
| **Temporal** | Donde quedan las grabaciones del modo conferencia que no tienen sentido (por error, ruido): no van a Pendientes, se pueden buscar con Alma y se borran solas a los 7 días si nadie las consulta. | papelera, borrador |
| **Reporte mensual de consumo** | El día 1 de cada mes Alma le manda a Juan por WhatsApp cuánto gastó la IA el mes anterior, por esfera y subcategoría, por app y por tipo (entrada, salida, caché); el Hub lo consulta. La esfera de cada función sale de la hoja IA_CATEGORIAS, que Juan corrige. | factura, informe de tokens |
| **Equipo de mejora continua** | El agente que cada semana busca cómo gastar menos sin quitar funciones ni bajar la calidad. | optimización, ahorro |
| **Esfera** | Una de las 6 áreas de vida del inicio (Propósito, Relaciones, Finanzas, Health, Comunidad, Esencia); cada pendiente lleva una. | categoría, área |
| **Área** | Una de las 6 áreas de vida: Propósito, Relaciones, Finanzas, Health, Comunidad, Esencia. | categoría |
| **Cajón** | Ideas, Interés u Ocio: lo que no es de un área. | carpeta, área |
| **Proceso / Permanente** | Proceso: se resuelve y termina. Permanente: está para quedarse. | temporal (eso es un guardado) |
| **Guardado** | Qué tanto se guarda: guardar, temporal (N días), no guardar. Lo decide la regla del grupo. | retención, archivo |
| **Archivo** | El departamento (agente) que ordena todo. | archivista |
| **Puente** | El script pequeño que vive en cada cuenta de correo y le pasa lo nuevo a Alma. | conector, integración |
| **Hilo** | Una conversación de correo. «Involucrar a Alma» = que ella responda ese hilo. | thread, cadena |
| **Bots de prueba** | Usuarios ficticios que prueban cada cambio sin dejar registros. | QA, tests |
| **Pedido para Claude** | Lo que Juan le pide al desarrollador por medio de Alma («Mejora para Claude»). | ticket, issue |
| **Unir** | Dar Merge a un PR: es el «sí» de Juan. Se hace en GitHub, con «une» a Claude, con el botón «Unir» de Pendientes o pidiéndoselo a Alma. | aprobar, mergear |
| **Huésped** | Quien se queda en un apartamento de Spacio AM. | cliente, inquilino |
| **Reserva / código de reserva** | La estadía de un huésped y su identificador de Hospitable. | booking, ID |
| **Equipo** | Las personas que trabajan en Spacio AM (limpieza, mantenimiento, administración). | staff, personal |
| **Asociado** | Socio o propietario: se le habla en nombre de la empresa. | partner |
| **Copia en el teléfono** | Lo que el Hub guarda en el teléfono para pintar rápido Hoy, ALMA, las reviews y las conversaciones (nombres de huéspedes y fechas, sí; documentos, no). Una por persona, vence a las 24 h, se borra al cerrar sesión, y mientras se ve la pantalla dice «actualizando…». | caché, datos offline |
| **Cerebro de Alma** | El índice común donde Alma busca con prueba: fichas y memoria de las propiedades y los playbooks (después, conversaciones, correos y Drive), en BigQuery, por significado y por palabras. Se sincroniza cada 15 min. Sin prueba no hay respuesta. | base de datos, RAG, índice vectorial |
| **Pedazo** | Un trozo de unos 500 tokens de un documento del cerebro, cortado en sus títulos, con su ruta delante («Playbook · Operaciones › Pasos») y sus etiquetas: fuente, propiedad, área, audiencia y vigencia. | chunk, fragmento |
| **Cuarentena** | Donde queda (hoja ALMA_CEREBRO_CUARENTENA, con el motivo) un documento cuyas etiquetas no encajan en las listas aprobadas: no entra al cerebro hasta que encaje. Nunca se adivina. | descartados, errores |
