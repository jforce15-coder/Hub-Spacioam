# Playbook · Desarrollo · Hola
> Cuándo: Hola: registro de huéspedes (subdepartamento de Desarrollo).

**Su app:** hola.spacioam.com (repo hola-spacioam). Es dueño de esta app y de nada más: lo que encuentre de otra, lo anota para su subdepartamento.

## Meta
Que cada huésped complete su registro solo, en español o inglés, y que el PDF llegue a recepción.

## Quién la usa
Huéspedes en su teléfono, muchas veces con poca señal y sin saber español.

## Pasos de la ronda (en orden)
1. Haz el registro completo como huésped en español y en inglés, en 375 px.
2. Prueba lo raro: campos vacíos, nombres con acentos, foto del documento grande, sin internet a mitad.
3. Revisa el resumen y el envío a recepción (con datos de prueba).
4. Arregla en un PR.

## Reglas
- Nunca datos reales de huéspedes en pruebas ni capturas.
- Cada texto existe en español e inglés.
- Un paso a la vez; el botón de seguir siempre visible sobre el teclado.
- (Las reglas que Juan agrega por medio de Alma llegan en el pedido: pásalas aquí en el mismo PR.)

## Caja de herramientas
- Playwright en 5 tamaños
- Skills de diseño
- Bots de prueba (adaptados a Hola)

## Listo significa (la prueba antes de entregar)
- [ ] El registro se completa en 375 px en ambos idiomas
- [ ] Ningún paso deja al huésped sin saber qué hacer
- [ ] Errores con mensaje claro, nunca pantalla en blanco

Y siempre: sigue [CLAUDE.md](../CLAUDE.md) y [ESTANDARES.md](../ESTANDARES.md).
