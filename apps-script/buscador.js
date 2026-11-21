/* Buscador de Alma (Juan, 21-nov-2026): el campo debajo de la roca en el escritorio (alma/inicio.html, js/alma-escritorio.js).
   Lo que escribes busca en las reservas (código, huésped, propiedad), las propiedades y los contactos; las apps se buscan en
   el navegador. Solo administradores (vozWebAdmin_). Sin IA y sin Hospitable: la hoja de Reservas (la misma que usa
   buscar_reservas, agBuscarReservas_) y la hoja de contactos (contactoBuscar_). Nunca devuelve teléfonos ni correos.
   { action: 'buscarEscritorio', q } → { ok, reservas: [...], propiedades: [...], contactos: [...] } */
var BUSCADOR_MAX_ = { reservas: 5, propiedades: 4, contactos: 4 };

function buscadorApi_(ses, body) {
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  var q = String((body && body.q) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (q.length < 2) return { ok: true, q: q, reservas: [], propiedades: [], contactos: [] };
  var cache = CacheService.getScriptCache(), k = 'busc_' + Utilities.base64EncodeWebSafe(q.toLowerCase()).slice(0, 200), hit = cache.get(k);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var out = buscadorBuscar_(q);
  try { cache.put(k, JSON.stringify(out), 60); } catch (e) {}
  return out;
}

function buscadorBuscar_(q) {
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd');
  var n = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var reservas = [], propiedades = [], contactos = [];
  try {
    reservas = agBuscarReservas_(q, '', false, hoy, BUSCADOR_MAX_.reservas).map(function (x) {
      var r = x.item;
      return { codigo: s_(r.code).toUpperCase(), huesped: [s_(r.guest_first_name), s_(r.guest_last_name)].join(' ').trim(), propiedad: s_(r.property_name),
        entrada: fecha_(r.checkin_date), salida: fecha_(r.checkout_date), cancelada: /cancel/i.test(s_(r.status)) };
    });
  } catch (e) { console.error('buscador reservas: ' + e); }
  try {
    var vistas = {}, nq = n(q);
    (typeof vozReservas_ === 'function' ? vozReservas_() : leerTabla_(CFG.TAB_RESERVAS)).forEach(function (r) {
      var p = s_(r.property_name).trim(); if (!p || vistas[p]) return;
      if (n(p).indexOf(nq) >= 0 || n(p).replace(/\s+/g, '').indexOf(nq.replace(/\s+/g, '')) >= 0) vistas[p] = 1;
    });
    propiedades = Object.keys(vistas).sort().slice(0, BUSCADOR_MAX_.propiedades).map(function (p) { return { nombre: p }; });
  } catch (e) { console.error('buscador propiedades: ' + e); }
  try {
    contactos = contactoBuscar_(q).slice(0, BUSCADOR_MAX_.contactos).map(function (o) {
      return { nombre: s_(o.nombre), tipo: CONTACTO_TIPOS_[o.tipo] || s_(o.tipo) || 'Contacto', empresa: s_(o.empresa) };
    }).filter(function (o) { return o.nombre; });
  } catch (e) { console.error('buscador contactos: ' + e); }
  return { ok: true, q: q, reservas: reservas, propiedades: propiedades, contactos: contactos };
}
