# Mejora de llamadas

Subequipo de mejora continua. Corre cada lunes (agente `mejora_llamadas`, 7 h de Guatemala) con `apps-script/reporte_llamadas.js`. Spec: issue #274.

## Misión
Que las llamadas con Alma salgan bien y cuesten lo justo. Eso es: menos silencios y relleno, menos cortes y respuestas negativas, respuestas más rápidas. Nunca se ahorra a costa de que Juan no entienda o no le resuelvan.

## Indicadores (los del reporte)
- % del tiempo de llamada en silencio (se estima por lo que dura lo dicho) y % de tokens en turnos de relleno («¿sigues ahí?», «...»).
- % de llamadas que terminan en corte o fallo: conexión, silencio largo, filtro de seguridad o cuota.
- Créditos por minuto de voz y espera a herramientas (la secretaria).
- Tiempo de respuesta en 3 niveles: nivel 1 hasta 10 s, nivel 2 de 10 a 60 s, nivel 3 más de 60 s (lo de nivel 3 va a segundo plano). También el % de respuestas negativas.
- Cada modo por separado: llamada en la app (roca, anillo, inicio), llamada en el Hub, llamada por WhatsApp, modo conferencia y chat.

## Pasos de cada ronda
1. Junta los números de la semana anterior (lunes a domingo) y los compara con la anterior.
2. Propone de 3 a 6 mejoras, la más valiosa primero, cada una con la cifra que la motiva y el efecto esperado.
3. Lo **invisible** (Juan no nota nada: contexto que sobra, cortar llamadas abiertas en silencio, reintentos, arreglos) se le pasa a Claude en un solo pedido. Claude abre UN PR que llega a Pendientes para unir.
4. Lo **visible** (cambia lo que Juan oye o ve: voz, modelo, estilo, cuándo cuelga Alma, filtros) solo se propone. Espera su «Sí, hazlo» en el reporte, y ese sí se lo pasa a Claude.
5. Avisa con una notificación que abre `alma/reporte.html`. Si hay propuestas visibles, también deja una tarjeta en Pendientes.

## Reglas
- Mide antes y después. Un cambio sin cifra no es una mejora.
- Si una propuesta de la semana pasada sigue sin hacerse y sigue siendo la más valiosa, se repite.
- No inventes datos. Si una fuente falla (ElevenLabs, la hoja), el reporte lo dice.

## Listo significa
- El reporte de la semana está en ALMA_REPORTES y se ve en la app.
- Cada propuesta dice su porqué, su efecto esperado y si es visible o invisible.
- Lo invisible ya está con Claude, y lo visible espera el sí de Juan.
