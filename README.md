# hub.spacioam.com

Sitio estático. `index.html` es un Design Component: se abre tal cual, sin build.

```
hub/
├─ index.html            ← la app completa (plantilla + lógica)
├─ js/
│  ├─ support.js         ← runtime del Design Component (no editar)
│  ├─ sa-session.js      ← sesión compartida *.spacioam.com (cookie + localStorage, 180 días)
│  ├─ sa-auth-client.js  ← login contra la hoja «Control de usuarios»
│  ├─ alma-client.js     ← lectura de la hoja de ALMA + llamadas al Apps Script  ← AQUÍ VA LA URL /exec
│  ├─ charts.jsx         ← gráficas de reviews (copiado de mi-spacioam)
│  └─ noti-center.jsx    ← campana, push y centro de notificaciones (copiado de Grow)
├─ assets/               ← logos, brushstroke, fotos del bento
└─ _ds/                  ← Spacio AM Design System (tokens + bundle de componentes)
```

## Configuración
- `js/alma-client.js` → `CFG.url`: URL /exec del Apps Script de ALMA. `CFG.token`: debe ser igual a `HUB_TOKEN` en el script.
- `js/sa-auth-client.js`: endpoint y hoja de usuarios (ya configurado).
- Servir siempre bajo `https://hub.spacioam.com` para que la cookie de sesión se comparta con las demás apps.

## Dónde tocar qué
| Quiero cambiar… | Archivo |
|---|---|
| Pantallas, textos, tiles, lógica del hub | `index.html` (plantilla arriba, clase `Component` abajo) |
| Duración de la sesión / cookie | `js/sa-session.js` (`DIAS_SESION`) |
| Roles que entran al hub | `index.html` → `abrirSesion()` y `resolverSesion()` |
| Qué pestañas lee de ALMA, URL del script | `js/alma-client.js` |
