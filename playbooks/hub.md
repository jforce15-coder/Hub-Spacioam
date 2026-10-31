# Playbook · Desarrollo · Hub
> Cuándo: el Hub: bandeja, conversación, la roca (subdepartamento de Desarrollo).

**Su app:** hub.spacioam.com (repo Hub-Spacioam: index.html, js/sa-nav.js, js/alma-client.js). Es dueño de esta app y de nada más: lo que encuentre de otra, lo anota para su subdepartamento.

## Meta
Que Juan y el equipo atiendan a cada huésped desde la bandeja sin fricción, en el teléfono y en la computadora.

## Quién la usa
Juan (administrador principal) y el equipo: atienden conversaciones de Hospitable, Airbnb, Booking y WhatsApp.

## Pasos de la ronda (en orden)
1. Abre la bandeja, una conversación completa y la roca con su menú en los 5 tamaños de pantalla.
2. Mira el último informe de los bots de prueba (corren solos después de unir; aviso con la etiqueta bots-prueba).
3. Revisa con los skills de diseño lo que se ve y se mueve.
4. Arregla lo claro y pequeño en un PR; lo demás va a la lista para Juan.

## Reglas
- Rápido de sentir (ds/velocidad.md): en cada ronda revisa qué ve la persona en el primer momento, a los 2 s y al terminar cada espera de tu app, y aplica las 6 reglas; las de nivel 2 y 3 primero.
- Movimiento con sentido (ds/movimiento.md): en cada ronda revisa qué dice cada movimiento de tu app y usa las piezas de `ds/movimiento.css` y `ds/movimiento.js`; empieza por los errores que no se sacuden y las filas que saltan al quitarlas.
- La roca se comporta igual en todas las web apps: si tocas `js/sa-nav.js`, prueba también alma/inicio.html y alma/roca.html, y sube su `?v=`.
- index.html es una exportación de Claude Design: no rompas sus marcadores `{{ }}` ni quites sa-sesion.js.
- Nada de datos reales de huéspedes en capturas.
- (Las reglas que Juan agrega por medio de Alma llegan en el pedido: pásalas aquí en el mismo PR.)

## Caja de herramientas
- `pruebas/bots.mjs` (bots de prueba)
- Playwright con los 5 tamaños
- Skills: web-design-guidelines, apple-design, emil-design-eng, improve-animations
- `ds/` (sistema de diseño)

## Listo significa (la prueba antes de entregar)
- [ ] Los bots: 0 graves y 0 medios en las páginas que tocaste
- [ ] Nada se sale de la pantalla en 375 px
- [ ] La roca abre, se mueve y vuelve igual que antes
- [ ] El PR trae evidencia antes y después

Y siempre: sigue [CLAUDE.md](../CLAUDE.md) y [ESTANDARES.md](../ESTANDARES.md).
