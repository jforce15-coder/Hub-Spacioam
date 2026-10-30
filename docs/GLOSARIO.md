# Glosario de Spacio AM y Alma

Una palabra, un significado. Úsalas así en el código, en la app, en los PRs y al hablar con Juan. Si hace falta una
palabra nueva, se agrega aquí en el mismo PR. La columna «Evitar» son los sinónimos que confunden.

| Palabra | Qué es (y solo eso) | Evitar |
|---|---|---|
| **Alma** | La asistente: la única que habla con las personas (Juan, equipo, socios, huéspedes). | bot, IA, sistema |
| **La roca** | El botón de Alma que flota en las web apps y en la app (sa-nav); en el inicio, la piedra grande al centro. | botón, burbuja, círculo |
| **Modo anillo** | Hablar con Alma con dos toques del anillo, también con el teléfono bloqueado. | modo amigo, manos libres |
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
| **Pendientes** | La lista de la app de Alma con todo lo que Alma resolvió para Juan, lo de Claude y los cambios por unir, por esfera y proyecto. Tres secciones: «Necesita tu sí» (se queda hasta resolverse), «Para leer» y «Listo hoy» (se van solas a la hora). Las tarjetas que necesitan una respuesta tienen «Responder»: escribes o mandas una nota de voz y va a quien preguntó (Claude o Alma). | tareas, temas, notificaciones |
| **Notificaciones** | El historial de lo que Alma te avisó en la app (campana junto a Pendientes, últimos 3 días). El detalle vive en Pendientes. | avisos, alertas |
| **Modo conferencia** | El botón de la reunión, junto a «Iniciar llamada»: Alma escucha sin la llamada de ElevenLabs y despierta al oír «Alma». Si habla una persona usa el dictado del iPhone; si son varias, ElevenLabs transcribe distinguiendo las voces. Al terminar lo clasifica y lo deja en Pendientes. | modo reunión, grabar |
| **Inicio con escucha activa** | Ajuste de la app (encendido por defecto): con Alma abierta en el inicio, el iPhone escucha en el teléfono y Alma despierta cuando dices «Alma». No graba ni guarda nada. | escucha siempre, manos libres |
| **Puntito de escucha** | El punto durazno que respira cuando Alma está escuchando: bajo la roca (inicio con escucha activa) y en la esquina del botón del modo conferencia. Sin palabras. | luz, indicador del micrófono |
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
