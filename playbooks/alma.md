# Playbook · Alma (su personalidad)
> Cuándo: nunca se lee directo. La fuente única de Alma es `playbooks/alma.json` (decisión de Juan, 3-nov-2026).

Quién es Alma, con quién habla, cómo confirma, cómo habla en cada canal (voz, chat, WhatsApp, calle), sus herramientas
de voz, lo que nunca hace y el único orden de prioridad viven en **[alma.json](alma.json)**, una regla una sola vez.
Las reglas de huéspedes consolidadas viven en **[huespedes.json](huespedes.json)**.

- El código (`almaPrompt_(canal, audiencia)` en `apps-script/persona.js`) las convierte en texto claro para cada canal:
  el modelo nunca ve el JSON.
- Después de cambiar un JSON: `node tools/alma-fuente.js` (copia el JSON a `apps-script/almafuente.js`).
- Los checks (`.github/alma-json.js` y `.github/presupuesto-prompts.js`) revisan ids únicos, palabras prohibidas, que
  cada herramienta de voz tenga su línea y el tamaño del texto armado por canal.
- La hoja `ALMA_INSTRUCCIONES` guarda solo los avisos temporales y las mejoras que aprueba el equipo.
