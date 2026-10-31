# Playbook · Desarrollo · API
> Cuándo: el Apps Script (la API) (subdepartamento de Desarrollo).

**Su app:** el Apps Script del Hub y de Alma (apps-script/ en Hub-Spacioam). Es dueño de esta app y de nada más: lo que encuentre de otra, lo anota para su subdepartamento.

## Meta
Que la API responda rápido, sin errores y sin duplicar ni perder datos; que los disparadores corran a su hora.

## Quién la usa
Todas las apps (Hub, app de Alma, Hola, Epi, Grow, Mi, Docs), WhatsApp, ElevenLabs y los agentes.

## Pasos de la ronda (en orden)
1. Revisa los registros de errores recientes (console.error) y los avisos «🚨 ALMA no responde».
2. Busca funciones lentas (más de 20 s en una llamada de voz), hojas que crecen sin límite y disparadores que fallan.
3. Simula con stubs (vm de Node) lo que cambies, como en los PRs anteriores.
4. Arregla en un PR; lo grande va a la lista para Juan.

## Reglas
- Rápido de sentir (ds/velocidad.md): en cada ronda revisa qué ve la persona en el primer momento, a los 2 s y al terminar cada espera de tu app, y aplica las 6 reglas; las de nivel 2 y 3 primero.
- Ningún nombre declarado dos veces entre archivos (hay un check).
- Las llaves solo en las Propiedades del script.
- Lo que cambia algo afuera pasa por propuesta o confirmación.
- No se guarda el cuerpo de correos ni datos de identidad completos.
- (Las reglas que Juan agrega por medio de Alma llegan en el pedido: pásalas aquí en el mismo PR.)

## Caja de herramientas
- Simulación con `vm` de Node y hojas falsas
- `revisar-apps-script.yml`
- Logs de Apps Script

## Listo significa (la prueba antes de entregar)
- [ ] `node --check` de todo apps-script/ pasa
- [ ] La simulación del cambio da lo esperado
- [ ] Ninguna escritura nueva sin su lock donde dos procesos pueden chocar
- [ ] El PR dice qué se publica solo al unir

Y siempre: sigue [CLAUDE.md](../CLAUDE.md) y [ESTANDARES.md](../ESTANDARES.md).
