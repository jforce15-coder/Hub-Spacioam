/* ═══ Ayudante de socio en Mi (nov 2026) ═══════════════════════════════════════════════════════════════════
   Herramienta de la secretaria «dar_acceso_mi_ayudante»: el ayudante de un socio (p. ej. quien le sube las facturas)
   recibe SU usuario de Mi (su correo, su contraseña) y ve las mismas propiedades del socio. Lo hace el login
   (login/apps-script/03-auth-endpoint.js · accesoAyudanteMi) con la llave del robot.
   Primero se muestra lo que haría (sin aplicar) y Juan dice que sí; recién entonces se aplica. Si el modelo intenta
   aplicar sin esa vista previa (o pasó más de media hora), vuelve a mostrarla en vez de aplicar. */
function ayudanteMiHerramienta_(adm, inp) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal da accesos a Mi.' };
  const correo = x => String(x || '').replace(/\s+/g, '').toLowerCase();
  const socio = correo(inp.socio), ayudante = correo(inp.correo), nombre = String(inp.nombre || '').trim();
  if (!/^[^@]+@[^@]+\.[a-z]{2,}$/.test(socio) || !/^[^@]+@[^@]+\.[a-z]{2,}$/.test(ayudante)) return { ok: false, error: 'Necesito el correo del socio y el del ayudante.' };
  if (!nombre) return { ok: false, error: 'Falta el nombre del ayudante.' };
  const llave = llaveRobot_(); if (!llave) return { ok: false, error: 'Falta la llave del robot (ROBOT_TOKEN) en el Hub.' };
  const cache = CacheService.getScriptCache(), clave = 'ayu_mi_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, socio + '|' + ayudante)).slice(0, 40);
  const aplicar = inp.aplicar === true && !!cache.get(clave);
  let j;
  try {
    const r = uf_(LOGIN_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ action: 'accesoAyudanteMi', robot: llave, socio_email: socio, ayudante_email: ayudante, nombre: nombre, aplicar: aplicar }) }, 'Login');
    j = JSON.parse(r.getContentText() || '{}');
  } catch (e) { return { ok: false, error: 'El login no contestó: ' + e }; }
  if (!j.ok) return { ok: false, error: j.error === 'token' ? 'El login no reconoció la llave del robot del Hub.' : String(j.error || 'el login no lo hizo') };
  const p = j.plan || {}, props = (p.propiedades || []).join(', ') || p.filas_mi + ' propiedad(es)';
  if (!j.aplicado) {
    cache.put(clave, '1', 1800);
    return { ok: true, aplicado: false, vista_previa: (p.usuario === 'crear' ? 'Crear el usuario de ' + nombre + ' (' + ayudante + ')' : 'El usuario ' + ayudante + ' ya existe') +
      '; verá en Mi las propiedades del socio: ' + props + '.', nota: 'Todavía no hice nada. Díselo a Juan en simple y pregúntale si lo hago; con su sí, vuelve a llamarla con aplicar = true.' };
  }
  cache.remove(clave);
  return { ok: true, aplicado: true, propiedades: props,
    nota: 'Listo. ' + nombre + ' entra a mi.spacioam.com con su correo, crea su contraseña y la confirma desde su correo. Verá: ' + props + '.' };
}
