# Spec · Tres automatizaciones decididas por Juan (issue #347)

## Problema
Juan recibe demasiado ruido: impugnaciones de limpieza, avisos sin orden y propuestas de Hola, Grow y Docs que hoy hay que leer una por una. Quiere que el sistema decida lo obvio y le muestre solo lo que importa.

## Decisiones de Juan (tinta)
1. **Epi · impugnaciones de reviews de limpieza:** el sistema decide en automático. Sensibilidad muy baja: a Juan solo llegan los casos sumamente dudosos y puntuales.
2. **Notification Center:** tres niveles — *operativas urgentes*, *administrativas* y *menos importantes* (no afectan la continuidad operativa). Siempre Pareto 80/20: se muestra primero el 20 % de mayor impacto.
3. **Hola, Grow y Docs:** las automatizaciones propuestas se revisan en el teléfono con tarjetas, como el swipe de mejoras del Hub: deslizar a los lados aprueba o rechaza.

## Historias de usuario
1. Como administrador, no recibo una impugnación de review salvo que el sistema la marque como sumamente dudosa.
2. Como administrador, puedo ver (en una lista de «decididas solas») lo que el sistema resolvió, por si quiero corregir.
3. Como administrador, veo las notificaciones en 3 niveles y las operativas urgentes salen primero.
4. Como administrador, veo arriba solo el 20 % de mayor impacto y el resto plegado.
5. Como administrador, reviso las propuestas de automatización de Hola, Grow y Docs como tarjetas y las apruebo o rechazo deslizando.
6. Como administrador, lo que apruebo se aplica y lo que rechazo no vuelve a proponerse igual.

## Tickets (rebanadas verticales, cada uno se prueba solo)
- **T1 · Epi decide impugnaciones** (pantalla Epi + Apps Script Epi + hoja de impugnaciones). Umbral de «dudoso» muy bajo, como propiedad del script. Historias 1-2.
- **T2 · Niveles y Pareto en el Notification Center** (`js/noti-center.jsx` + clasificación en Apps Script + hoja de notificaciones). Historias 3-4.
- **T3 · Tarjetas de aprobación** (componente compartido de swipe + propuestas en Hola, Grow y Docs). Historias 5-6.

## Niebla que queda (preguntas para Juan, con recomendación)
1. **T1 · ¿Qué es «sumamente dudoso»?** Recomiendo: solo cuando la evidencia se contradice (foto vs. reporte) o el monto supera un tope que tú pones. Todo lo demás se decide solo.
2. **T2 · ¿Qué cuenta como «operativa urgente»?** Recomiendo: lo que frena una limpieza, un check-in o un cobro hoy.
3. **T3 · ¿Cómo se ven las tarjetas?** Es visual: hago 3 prototipos desechables (A: una tarjeta grande como el Hub · B: pila con vista previa de la siguiente · C: lista con deslizar en cada fila) y eliges mirándolos. Recomiendo A, por ser lo que ya conoces.

## Glosario
Palabras nuevas a agregar al construir: **Nivel de notificación**, **Tarjeta de aprobación**, **Decidida sola**.
