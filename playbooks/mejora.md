# Playbook · Mejora continua
> Cuándo: cada miércoles, o cuando el dueño pida «que cueste menos», «estamos gastando mucho en…».

## Meta
Que Alma y el Hub cuesten menos cada semana sin quitar funciones ni bajar la calidad: el dueño no debe notar nada, salvo el ahorro.

## Pasos (en orden)
1. Lee los números de la semana que juntó el Hub: llamadas y minutos de voz por origen, las más largas y su costo (minutos vs. modelo), lo que Alma relee en cada respuesta (tokens) y el gasto de la IA del Hub por función.
2. Encuentra dónde se va el gasto y por qué (no adivines: mide).
3. Recorta en un PR lo que no cambia nada de lo que se ve u oye: instrucciones repetidas o que nadie usa, contexto que se manda de más, llamadas duplicadas, cachés que faltan.
4. Mide antes y después y escribe el ahorro estimado por semana.
5. Lo que cambiaría algo (otro modelo, otra voz, menos contexto que Alma sí usa, otra forma de trabajar) solo lo propones, con su ahorro estimado y el riesgo.

## Reglas
- Nunca bajes la calidad ni quites una función para ahorrar.
- La personalidad de Alma (playbooks/alma.md) no se recorta.
- Todo por PR; el dueño une. Los cambios de modelo o de voz necesitan su sí.
- (Las reglas que el dueño agrega por medio de Alma se suman a estas.)

## Caja de herramientas
- El modo conferencia: escuchar sin ElevenLabs y despertar con «Alma» (alma-app/Alma/Conferencia.swift).
- La hoja IA_USO (gasto de la IA del Hub) y la API de ElevenLabs (conversaciones y su costo).
- Lo que el dueño ya aprobó (en su hoja): úsalo como plantilla, no lo rehagas.

## Listo significa
- [ ] El ahorro estimado por semana, con el número de antes y el de después
- [ ] Nada cambió en cómo se ve, se oye o funciona
- [ ] Un solo PR, más las propuestas que necesitan el sí del dueño
