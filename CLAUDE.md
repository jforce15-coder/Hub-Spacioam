# Cómo trabajamos en Spacio AM (Claude, léelo antes de empezar)

Juan decide; Claude ejecuta. Los **hechos** son trabajo de Claude (investígalos en el código, las hojas, el historial);
las **decisiones** son de Juan. Este método viene de las lecciones de Matt Pocock (skills v1.3) aplicadas a este repo.

## 1. Una palabra, un significado
Usa las palabras de [docs/GLOSARIO.md](docs/GLOSARIO.md) en el código, en los textos de la app, en los PRs y en lo que
le dices a Juan. Si aparece un concepto nuevo, agrégalo al glosario en el mismo PR. Nunca uses los sinónimos de «evitar».

## 2. Pregunta primero (nada de adivinar en silencio)
Antes de construir, dibuja el árbol de decisiones del pedido (p. ej. «pausar»: cobro → hoy o fin de mes · lo ya
empacado → se envía o se cancela · cuánto dura). Cada rama es **niebla** (nadie decidió) o **tinta** (Juan ya decidió).
- Lo que es un hecho, averígualo tú. No le preguntes a Juan lo que el código o los datos ya responden.
- Si una rama en niebla cambia lo que Juan va a ver o pagar, **pregunta antes** (respuesta con estado `pregunta`):
  máximo 3 preguntas, cada una con tu opción recomendada. No construyas sobre una suposición.
- Si el pedido es pequeño y todo es tinta, constrúyelo sin preguntar.

## 3. Lo visual se decide mirando
Si la decisión es de diseño (cómo se ve, dónde va, cómo se mueve), haz 2 o 3 **prototipos desechables** (capturas A · B · C
en la pregunta) y deja que Juan elija mirándolos. Los prototipos no se unen: se tiran.

## 4. El destino antes del camino (pedidos grandes)
Más de un día de trabajo o más de una pantalla → primero el **spec** en el issue: Problema · Solución · Historias de
usuario numeradas («Como administrador, puedo…»). Luego **tickets en rebanadas verticales**: cada uno toca pantalla +
Apps Script + hoja y se puede probar solo. Un ticket listo para el agente = sin niebla.

## 5. Un tanque para cada uno
El contexto tiene una zona buena (cabeza limpia); se ensucia con logs, diffs y chats viejos. Un ticket por vez con
contexto limpio (un subagente por ticket si son varios). Todos los tickets del pedido van en **una sola rama y un PR**.

## 6. Unir rápido; el equipo revisa después
Juan no espera para unir. **Antes del PR** solo lo que tarda segundos: `node --check`, los checks de `estandares.yml`
y un repaso propio contra el pedido y [ESTANDARES.md](ESTANDARES.md). **Después de unir**, atrás y sin que Juan espere:
los bots de prueba prueban la versión publicada y, si encuentran algo, abren el aviso y Claude manda el arreglo en un PR
corto. Nada lento (bots, navegadores, subagentes revisores) va como requisito antes de unir.

## 7. El PR es la imagen más chica posible, con prueba
Usa la plantilla: Resumen corto · **Evidencia antes y después** (capturas, simulación) ·
Peligros al unir · Cómo probarlo. Los bots de prueba corren solos después de unir.

## 8. Retro: lo que se repite se vuelve regla
Cuando Juan corrige lo mismo dos veces, o algo falló después de unir, agrégalo a ESTANDARES.md. **Si una máquina puede
detectarlo, conviértelo en un check** (`.github/workflows/estandares.yml`), no en una nota.

## Reglas fijas del repo
- Todo cambio va por PR; nunca a `main` directo. Juan une. Español en commits, PRs y textos.
- Commits terminan con las líneas de atribución que indique la sesión. Ningún identificador de modelo en commits ni PRs.
- Apps Script junta todos los archivos: un nombre declarado dos veces lo tumba (hay un check).
- Si cambias `js/sa-nav.js` o `js/alma-client.js`, sube su `?v=` en todas las páginas que lo cargan (hay un check).
- Nunca pidas ni escribas llaves en el chat ni en el código: van a las Propiedades del script o a los secretos de GitHub.
- Alma habla simple, «como explicándole a un niño», y trata distinto a cada audiencia (principal, equipo, asociado, externo).
