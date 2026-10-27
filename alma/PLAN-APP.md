# Plan · App «Alma» (navegador con Alma integrada)

**Objetivo:** abrir cualquier enlace (GitHub, Google, las apps de Spacio AM) dentro de una app propia que siempre tiene a Alma a mano, flotando encima, con chat y voz, y que sabe qué página estás viendo.

## Por qué hace falta una app (y no basta una página web)
- GitHub y Google prohíben que su página se meta dentro de otra (`frame-src`, `script-src`). Una página «navegador» hecha en el Hub saldría en blanco con esos enlaces.
- Safari no le pasa tu sesión a Alma cuando Alma está dentro de otro sitio. Alma aparecería sin saber quién eres.
- Una app nativa no tiene esos límites. Muestra la página en su propio visor (`WKWebView`) y dibuja a Alma por encima, como parte de la app.

Mientras tanto, **«Alma aquí»** (`alma/index.html` + `alma/instalar.html`) cubre el uso diario: el atajo de Compartir o el marcador abren a Alma con la página como contexto.

## Qué es la app
| Pieza | Qué hace |
|---|---|
| Barra de dirección + pestañas | Un navegador simple: escribir una dirección, atrás, adelante, compartir. |
| Visor `WKWebView` | Muestra cualquier página. Guarda las sesiones (GitHub, Google) como Safari. |
| Burbuja de Alma | Flota siempre encima. Al tocarla abre `hub.spacioam.com/alma/` en un panel, ya con la sesión de Spacio AM y con `?t=<título>&desde=<url>` de la página actual. Así se reusa todo lo de «Alma aquí»: chat, voz y contexto. |
| «Abrir en Alma» | La app se registra en la hoja de Compartir y para los enlaces `https://`. Los enlaces que yo te mando se abren directo ahí. |
| Sesión | Entra una vez con el login de Spacio AM, en el panel de Alma (mismo origen hub.spacioam.com). La pulsera queda en el almacenamiento de la app. |

## Qué necesitas tú
1. **Cuenta de Apple Developer** (99 USD al año) a tu nombre o al de Spacio AM.
2. **Una Mac con Xcode** para compilar e instalar, o un servicio de compilación en la nube (Xcode Cloud, Codemagic) si no tienes Mac.
3. Instalarla en tu iPad/iPhone con **TestFlight**. No hace falta publicarla en la App Store.

## Cómo la construiríamos
1. **Repo nuevo** `alma-app` (SwiftUI, iOS 17+). Lo escribo yo y va por PR como todo lo demás.
2. **Primera versión (1–2 días de trabajo):** visor + barra + burbuja de Alma que abre el panel con contexto + extensión de Compartir.
3. **Compilación automática:** GitHub Actions con un runner macOS, o Xcode Cloud, para que cada Merge genere una versión nueva en TestFlight.
4. **Después:** Alma «ve» la página (le pasa el texto visible, no solo el enlace), atajos por voz («Alma, resume esta página») y abrir enlaces de los correos de Spacio AM directo en la app.

## Riesgos y límites
- Sin Mac ni cuenta de Apple no se puede instalar en el iPad. Es el único bloqueo real.
- Algunas páginas de Google detectan visores incrustados al iniciar sesión. Se resuelve abriendo esa pantalla en el navegador del sistema (`ASWebAuthenticationSession`).
- Es una app más que mantener. Las actualizaciones de iOS a veces piden ajustes.
