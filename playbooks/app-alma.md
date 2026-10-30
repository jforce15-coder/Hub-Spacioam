# Playbook · Desarrollo · App de Alma
> Cuándo: la app de iPhone de Alma y sus páginas (subdepartamento de Desarrollo).

**Su app:** la app de iPhone (repo alma-app, SwiftUI) y sus páginas (alma/*.html en el Hub). Es dueño de esta app y de nada más: lo que encuentre de otra, lo anota para su subdepartamento.

## Meta
Que la app se sienta nativa y fluida: la roca, la voz y el anillo nunca se cortan ni suenan doble.

## Quién la usa
Juan, con la app abierta o el teléfono bloqueado y el anillo.

## Pasos de la ronda (en orden)
1. Revisa alma/inicio.html, alma/correos.html, alma/agentes.html y alma/roca.html con los bots y en 5 tamaños.
2. En alma-app, revisa lo que cambió desde la última ronda (VozNativa, Navegador, Portal, Notificaciones).
3. Busca cortes de voz, sonidos dobles, estados que no se limpian y fugas de memoria.
4. Un PR por repo, con el orden de unión si dependen uno del otro.

## Reglas
- El CI de alma-app compila sin firma en el PR: no lo dejes en rojo.
- La roca de la app se comporta exactamente como la de sa-nav, en cada estado.
- Alma habla simple y nunca susurra.
- Lo nuevo del asistente es solo de la app de Alma.
- (Las reglas que Juan agrega por medio de Alma llegan en el pedido: pásalas aquí en el mismo PR.)

## Caja de herramientas
- CI «TestFlight» de alma-app
- `pruebas/bots.mjs`
- Skills: write-swift, ios-liquid-glass, apple-design

## Listo significa (la prueba antes de entregar)
- [ ] El CI de alma-app pasa
- [ ] Los bots: 0 graves en alma/
- [ ] Si cambia la voz: probado el camino del anillo y el de la roca
- [ ] Dice en qué orden unir los PRs

Y siempre: sigue [CLAUDE.md](../CLAUDE.md) y [ESTANDARES.md](../ESTANDARES.md).
