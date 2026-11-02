# Propuesta · Qué se puede automatizar de lo que hoy espera a una persona

> Pedido de Juan a Alma (issue #344, id pc1793573824004). Es un **barrido de lectura**: no cambia código.
> Qué leí: Hub (pendientes, decisiones, correo, agente), Epi (avisos, casos de reseñas, adelantos), Hola (early check-in,
> comprobantes de renta), Grow (secretaria), Docs (firmas) y los playbooks. Lo que **no** pude comprobar leyendo el código
> va marcado con ❓ y es lo primero que hay que confirmar.

## Cómo decidí «se puede» y «no se puede»
Regla de ESTANDARES.md: *lo que cambia algo afuera (mensajes, cobros, datos de huéspedes) pasa por una propuesta o una
confirmación.* Entonces:
- **Verde** · se puede sin persona: la regla es objetiva, el error es barato o se puede deshacer, y queda registro.
- **Amarillo** · Alma decide sola solo cuando está muy segura; si no, va a Pendientes. Se prende con «modo sombra»
  (Alma anota qué habría hecho, Juan compara una o dos semanas y recién ahí se prende).
- **Rojo** · se queda con una persona: dinero que sale, palabra pública o legal, algo que no se deshace.

## Verde · automatizar
| # | Dónde | Hoy espera a… | Propuesta | Por qué es seguro |
|---|---|---|---|---|
| 1 | **Epi · casos de reseñas de limpieza** (hoja Reseñas-casos: tipo, motivo, decisión, reasignada a) | Un admin abre cada caso y guarda decisión + nota | Si Alma ya leyó la conversación y la evidencia (fotos del formulario, hora de salida, mensajes) y **todo apunta a lo mismo**, aprueba sola la impugnación y deja la nota con la prueba citada. Lo dudoso o contradictorio sigue yendo a una persona | La decisión ya se guarda con nota; es reversible (reabrir caso). Aplica ESTANDARES: «sin prueba no hay respuesta» → sin prueba citada, no aprueba |
| 2 | **Epi · aviso 1:00 pm** «técnico con ruta sin formulario» (`cronAlertaLimpiezas13`) | Un admin lee el correo y llama | Primero escribir al técnico (como ya hace el recordatorio de las 7 pm) y avisar al admin **solo si pasa media hora sin formulario** | Es un recordatorio, no mueve dinero |
| 3 | **Epi · programación** (`avisarAdmins_`: «hay que bloquear calendario / revisar carga») | Admin ajusta la ruta a mano | Cuando la alerta es *crítica* y hay un técnico libre, Alma **propone la ruta ya armada** con un toque para aceptar (hoy solo avisa y manda a «entrar a Programación») | Sigue siendo propuesta; ahorra el trabajo, no la decisión |
| 4 | **Epi · adelantos** (correo «Nueva solicitud de adelanto» → depósito) | Admin revisa cada solicitud | Cuando el monto está dentro del tope ya definido y la persona no tiene saldo vencido, Alma deja el **depósito listo para transferir** con el descuento semanal calculado. Mover el dinero sigue siendo de una persona | Hoy el cálculo es automático después; lo manual es juntar los datos |
| 5 | **Hola · early check-in** (`earlyAdminPrompt` → enlace de aprobación → verificación 8:45 pm) | Admin toca «aprobar» por correo; el sistema re-verifica igual a las 8:45 pm | Si `earlyIsAvailable_` da disponible **y** el calendario real confirma la noche previa libre, aprobar solo. Si no es seguro, rechazar con el texto estándar. Solo pasa a persona cuando la verificación no pudo confirmar (`null`) | La verificación final en vivo ya existe y manda; la aprobación humana hoy repite lo que el código comprueba |
| 6 | **Hola · comprobantes de renta** (`ltVerify_`; la IA ya lee el comprobante y deja el pago en «revisión») | Admin pasa de «revisión» a «verificado» o «rechazado» | Si el monto, la moneda, la fecha y el nombre coinciden con lo que se esperaba y el comprobante no se repite (misma referencia ya usada), pasa a «verificado». Diferencias o sospecha → persona | Rechazo y verificación ya son pasos reversibles en la hoja. ⚠️ Es dinero: ver la pregunta 2 abajo |
| 7 | **Hub · correo** categoría `autorizacion` («te llegó un correo que pide tu autorización») | Juan lee y decide | Dejar la respuesta redactada (ya se hace con otras categorías) **y** agrupar los repetitivos en un solo Pendiente diario | No envía nada solo |
| 8 | **Hub · Pendientes «Necesita tu sí»** que son solo recordatorios (pregunta sin responder, tareas viejas sin dueño) | Juan toca «Ya está» | Cerrarlos solos cuando el dato que los originó ya cambió (la reserva se resolvió, la tarea se hizo) | Solo limpia lo que ya no aplica |

## Amarillo · automatizar con modo sombra primero
| # | Dónde | Propuesta |
|---|---|---|
| 9 | **Hub · Decisión del equipo** (A/B/C para el responsable de turno) | Para casos de bajo riesgo y sin dinero (ej.: pedir toallas extra, hora de salida tardía con el apartamento libre) Alma envía la opción A sola. Excepciones, devoluciones, quejas y daños: siempre persona. Hoy «nada sale solo, salvo Enviar» (decisión de Juan #325): cambiarlo es decisión suya |
| 10 | **Hub · propuestas de agentes** (`decidir_propuestas`: Juan aprueba o rechaza) | Las que repiten algo que Juan **ya aprobó antes** (la «caja de herramientas» del playbook) pasan solas, con aviso en Notificaciones. Las nuevas siguen esperando el sí |
| 11 | **Hub · respuestas públicas a reseñas** (`SEMILLA_RESP_REVIEW_`) | Reseñas de 5 estrellas sin críticas: publicar la respuesta redactada. Con críticas: persona |
| 12 | **Grow · secretaria** (crear proyecto, mover de etapa, agendar visita) | Mover de etapa solo cuando el hecho ya ocurrió y está en la hoja (visita hecha → «visita»). Pasar a «contrato», «ejecución» o «descartado»: persona |
| 13 | **Docs · firmas** | Recordatorio automático al firmante a los 2 y 5 días; la firma y el contenido del contrato nunca |

## Rojo · se queda con una persona
- Mover dinero (pagos, devoluciones, cobros, depósitos): solo **preparar**, nunca ejecutar.
- Contratos y firmas; cualquier cosa con documentos de identidad.
- Quejas, daños y excepciones de huéspedes; palabra pública con críticas.
- Descartar un proyecto de Grow; dar o quitar permisos; borrar datos.
- Reescribir las reglas de Alma (playbooks).

## ❓ Lo que no pude confirmar leyendo el código
1. **El análisis de conversaciones para impugnar reseñas**: en el código de Epi veo la hoja y la pantalla donde un admin guarda la decisión, pero **no encontré** la parte que lee las conversaciones (¿vive en el Hub, en Alma o en una hoja aparte?). La #1 depende de eso: si ya existe, es cambio chico; si no, es una rebanada nueva.
2. Cuántos casos, adelantos y comprobantes pasan por mes y cuántos se rechazan hoy. Con ese número se ve cuánto ahorra cada fila y se mide el modo sombra.
3. Los límites que usan hoy las personas (tope de adelantos, tolerancia del comprobante): no están escritos en el código.

## Preguntas para Juan (máximo 3)
1. **Reseñas de limpieza (#1)**: ¿Alma aprueba sola cuando está segura, o prefieres que primero lo haga «en sombra» dos semanas? *Recomendado: sombra dos semanas, luego sola.* Es la que tú nombraste y la de menor riesgo.
2. **Comprobantes de renta (#6) y adelantos (#4)**: ¿aceptas que Alma marque «verificado» sin una persona cuando todo coincide exacto? *Recomendado: sí en comprobantes con monto exacto; adelantos solo preparados.* Es dinero: es tu decisión.
3. **Orden**: ¿empezamos por 1 → 5 → 2 (las tres sin dinero)? *Recomendado: sí, en un ticket cada una.*

## Siguiente paso
Con tus respuestas armo el spec (Problema · Solución · Historias de usuario) y los tickets en rebanadas verticales
(pantalla + Apps Script + hoja), uno por fila aprobada. Nada de esto se construye antes de tu sí.
