/* ═══ TARJETA DE LA LLAMADA (#446 T2) ═══════════════════════════════════════════════════════════════════════════════
   En una llamada de la app de Alma, cuando la secretaria ya trajo los datos de UNA cosa concreta (una reserva, una
   conversación o un apartamento), el Hub arma una tarjeta con esos mismos datos y la app la pinta sobre la llamada.
   · Sin IA y sin herramienta nueva: agEjecutar_ (agente.js) deja una «candidata» con tvCandidata_ cuando buscar_reservas
     trae un solo resultado, o con ver_conversacion o ver_propiedad. Una lista borra la candidata (las listas no son tarjetas).
   · vozSecretaria_ (voz.js) cierra el turno con tvCerrar_: si la llamada es de la app (vozapp_) y Juan ve la pantalla, la
     guarda en voztarjeta_<conv_id> por 10 minutos y le dice a la voz «EN PANTALLA» (no lee lo que ya se ve). Con la
     pantalla bloqueada (Modo calle, anillo) no se muestra: queda solo en el Chat con Alma, junto a la llamada
     (columna tarjeta de ALMA_OPERATIVO), sin notificación.
   · La app la pide con la acción vozTarjeta cuando le llega agent_tool_response de la secretaria. Mostrarla no llama a
     Hospitable: todo sale de lo que la herramienta ya leyó, de la hoja Reservas o de la caché del calendario de propiedades.
     Una sola excepción (Juan, 13-nov-2026): las fotos de un apartamento que no tiene ninguna (tvPedirFotos_).
   · Nunca la misma cosa dos veces en una llamada (voztv_vistas_<conv_id>). Solo administradores: la familia nunca la ve.
   · El apartamento nunca lleva códigos, claves ni el wifi.
   · Dónde sí (Juan, 6-nov-2026; tvPermitida_): SOLO en una llamada de la app de Alma o del Hub con la voz de Alma
     EXPANDIDA (vozexp_), y solo con un administrador (el teléfono de la llamada es de un administrador). NUNCA por
     WhatsApp, el chat escrito o en segundo plano (la candidata solo nace en el canal «llamada») y NUNCA con huéspedes.
   · Consulta (inquiry): huésped, fechas, propiedad, su mensaje y el precio si lo hay; con un borrador, el texto que
     saldría. Mismas reglas que las demás.
   · Tablero bento (#508 T1): la reserva trae además cabeza y cuadros (tvCuadrosReserva_); la app nueva los acomoda con Alma
     minimizada abajo a la derecha, y la app vieja sigue pintando la tarjeta con los campos de siempre.
   · (#508 T2) El apartamento también (tvCuadrosApartamento_), y el edificio completo cuando se habla de él (tvEdificio_):
     ver_propiedad con el nombre de un edificio («Brunelo») o con varias opciones del mismo edificio. Mismas fuentes: la
     hoja, la caché del calendario y del catálogo, la de Epi y la de Hola; nada de Hospitable ni IA nueva.
   · (#508 T3) POR ESTADO (Juan, 13-nov-2026): «el tablero se queda en pantalla hasta que se termine la llamada o se cambie
     a una nueva solicitud». La app nueva lo avisa al vincular (tablero: «estado» → voztvest_<conv_id>): el tablero no se
     va por tiempo, la próxima tarjeta de OTRA cosa lo reemplaza y se quita al colgar (la página espera ~3 s). Por eso,
     con esa app, volver a algo que ya se vio en la llamada lo muestra otra vez, y lo mismo que ya está en pantalla
     (voztv_actual_<conv_id>) no se vuelve a armar: la voz recibe «EN PANTALLA» igual. La app de antes sigue con «nunca la
     misma cosa dos veces» (voztv_vistas_).
   · (#508 T3) MODO CONFERENCIA: los pedidos pasan por la misma secretaria (vozSecretaria_, canal «llamada», vozconf_). La
     tarjeta sale también ahí, pero SOLO si la app dijo que la pantalla está encendida (vozpant_ = «1»: la app nueva lo
     manda al vincular y con vozPantalla); sin ese aviso (la app de antes, o el teléfono bloqueado) queda en el chat.
   · (#508 T3) FOTOS: las del anuncio que Alma ya pidió a Hospitable para responder sobre la propiedad (fuentes.js) quedan
     guardadas 6 h (calp_fotos_<id>, tvGuardarFotos_); el tablero las usa como galería y como foto principal si el
     catálogo no trae picture.
   · FOTOS QUE FALTAN (Juan, 13-nov-2026): si un apartamento del tablero no tiene ninguna foto, el Hub pide
     /properties/{id}/images UNA vez cada 6 h, solo al armar el tablero (tvPedirFotos_). Es la única llamada de la tarjeta. */

var TV_CANDIDATA_ = null;
var TV_SEG_ = 600, TV_LLAMADA_SEG_ = 21600, TV_FOTOS_SEG_ = 21600, TV_FOTOS_MAX_ = 8;
var TV_DIAS_ = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], TV_LETRA_ = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
var TV_MESES_ = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var TV_CANAL_ = { airbnb: 'Airbnb', booking: 'Booking', vrbo: 'Vrbo', expedia: 'Expedia', directa: 'Directa' };
/* Lo que parece un código, una clave o el wifi no entra a la tarjeta (ni su campo ni su texto). */
var TV_SECRETO_CAMPO_ = /(code|codigo|código|clave|pass|pin\b|lock|cerradura|wifi|wi-fi|door|puerta_cod|token)/i;
var TV_SECRETO_TEXTO_ = /(c[oó]digo|clave|contrase|password|passcode|\bpin\b|wi-?fi|cerradura)/i;
/* Un teléfono (7 dígitos o más, con espacios, guiones o paréntesis) no sale en el tablero: de la recepción, solo el nombre. */
var TV_TEL_ = /(\b(tel[eé]fono|tel|cel(ular)?|whats ?app|wa)\.?:?\s*)?\(?\+?\(?\d{1,4}\)?(?:[\s.-]?\(?\d{3,4}\)?)+/gi;

/* agEjecutar_ deja la candidata del turno. tipo null = una lista: borra la de antes. hacer() arma la tarjeta solo si de
   verdad se va a mostrar (el apartamento lee la semana del calendario). */
function tvCandidata_(tipo, hacer) {
  if (typeof AGENTE_PERMITIDAS_ !== 'undefined' && AGENTE_PERMITIDAS_) return;   // la familia (vozFamilia_) nunca tiene tarjetas
  if (tipo && (typeof AGENTE_CANAL_ === 'undefined' || AGENTE_CANAL_ !== 'llamada')) { TV_CANDIDATA_ = null; return; }   // WhatsApp, chat o segundo plano: nunca
  TV_CANDIDATA_ = tipo && typeof hacer === 'function' ? { tipo: tipo, hacer: hacer } : null;
}

/* Al cerrar el turno de la secretaria. app: la llamada es de la app de Alma (vozapp_) · conf: modo conferencia.
   Devuelve null o { celda (columna tarjeta), voz (para el resultado), tarjeta, visible }. */
function tvCerrar_(convId, app, conf) {
  var cand = TV_CANDIDATA_; TV_CANDIDATA_ = null;
  convId = String(convId || '').trim();
  var c = CacheService.getScriptCache();
  if (!convId || !tvPermitida_(convId, app)) return null;   // voztarjeta_ solo en la app o el Hub expandido, con un administrador
  if (!cand) { c.remove('voztarjeta_' + convId); return null; }
  /* Conferencia: solo con la pantalla encendida (vozpant_ «1», lo dice la app nueva). Fuera de conferencia: salvo bloqueada. */
  var pant = c.get('vozpant_' + convId), visible = conf ? pant === '1' : pant !== '0';
  var t = null; TV_SIN_PEDIR_ = !visible;   // lo que no se va a ver no pide fotos (tvPedirFotos_)
  try { t = cand.hacer(); } catch (e) { console.error('tarjeta ' + cand.tipo + ': ' + (e.stack || e)); } finally { TV_SIN_PEDIR_ = false; }
  if (!t || !t.clave) { c.remove('voztarjeta_' + convId); return null; }
  /* Por estado (app nueva): lo que ya está en pantalla se queda (mismo id); otra cosa, o volver a algo ya visto, se muestra.
     App de antes: nunca lo mismo dos veces en la llamada. */
  var estado = c.get('voztvest_' + convId) === '1', actual = null;
  try { actual = JSON.parse(c.get('voztv_actual_' + convId) || 'null'); } catch (e) {}
  var vistas = []; try { vistas = JSON.parse(c.get('voztv_vistas_' + convId) || '[]'); } catch (e) {}
  if (!estado && vistas.indexOf(t.clave) >= 0) { c.remove('voztarjeta_' + convId); return null; }   // nunca lo mismo dos veces
  t.id = estado && visible && actual && actual.clave === t.clave && actual.id ? String(actual.id) : 'tv' + Date.now() + (vistas.length ? '-' + vistas.length : '');
  var out = { tarjeta: t, visible: visible, celda: JSON.stringify({ tipo: t.tipo, id: t.ref, titulo: t.titulo }), voz: '' };
  if (visible) {
    vistas.push(t.clave);
    c.put('voztv_vistas_' + convId, JSON.stringify(vistas.slice(-40)), TV_LLAMADA_SEG_);
    c.put('voztv_actual_' + convId, JSON.stringify({ clave: t.clave, id: t.id }), TV_LLAMADA_SEG_);
    c.put('voztarjeta_' + convId, JSON.stringify(t), TV_SEG_);
    out.voz = 'EN PANTALLA: ' + t.resumen + '. Juan ya lo ve en la tarjeta de la llamada.';
  } else c.remove('voztarjeta_' + convId);
  return out;
}

/* Acción vozTarjeta { conv_id }: la tarjeta de esta llamada (la pide la app). Solo el administrador de esa llamada. */
function vozTarjetaApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses), conv = String(b.conv_id || '').trim();
  if (!adm || !conv) return { ok: false, error: 'session' };
  if (!tvDeLaLlamada_(adm, conv)) return { ok: false, error: 'Esa llamada no es tuya.' };
  var t = null; try { t = JSON.parse(CacheService.getScriptCache().get('voztarjeta_' + conv) || 'null'); } catch (e) {}
  return { ok: true, tarjeta: t };
}
/* Acción vozPantalla { conv_id, visible }: la app avisa si Juan ve la pantalla (bloqueó el teléfono o volvió). */
function vozPantallaApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses), conv = String(b.conv_id || '').trim();
  if (!adm || !conv) return { ok: false, error: 'session' };
  if (!tvDeLaLlamada_(adm, conv)) return { ok: false, error: 'Esa llamada no es tuya.' };
  CacheService.getScriptCache().put('vozpant_' + conv, b.visible === false || b.visible === 0 || b.visible === '0' ? '0' : '1', TV_LLAMADA_SEG_);
  return { ok: true };
}
/* ¿Esta llamada puede tener tarjeta? La app de Alma (vozapp_) o el Hub con la voz expandida (vozexp_), y quien habla es un
   administrador (vozweb_ lo dejó vozWebVincular_ con el teléfono de su sesión). Un huésped por teléfono no tiene ninguno. */
function tvPermitida_(convId, app) {
  var c = CacheService.getScriptCache();
  if (!app && c.get('vozexp_' + convId) !== '1') return false;
  var tel = vozWebTel_(convId);
  return !!(tel && adminPorTel_(tel));
}
function tvDeLaLlamada_(adm, conv) {
  var tel = vozWebTel_(conv); if (!tel) return false;
  return (adm.tels || []).some(function (x) { return fin8_(x) === fin8_(tel); });
}

/* La línea del Chat con Alma junto a la llamada: el código de la reserva se vuelve su fila «›» (js/sa-chat.js). */
function tvLineaChat_(celda) {
  var o = null; try { o = JSON.parse(String(celda || '')); } catch (e) {}
  if (!o || !o.tipo) return '';
  var cod = /^HM[A-Z0-9]{8}$/.test(String(o.id || '')) ? ' (' + o.id + ')' : '';
  if (o.tipo === 'reserva') return 'Tarjeta de la llamada · reserva de ' + (o.titulo || 'un huésped') + cod;
  if (o.tipo === 'conversacion') return 'Tarjeta de la llamada · conversación con ' + (o.titulo || 'un huésped') + cod;
  if (o.tipo === 'apartamento') return 'Tarjeta de la llamada · apartamento ' + (o.titulo || '');
  if (o.tipo === 'edificio') return 'Tarjeta de la llamada · edificio ' + (o.titulo || '');
  if (o.tipo === 'consulta') return 'Tarjeta de la llamada · consulta de ' + (o.titulo || 'un interesado');
  return '';
}
function tvConLinea_(m) {
  var l = m && m.tarjeta ? tvLineaChat_(m.tarjeta) : ''; if (!l) return m;
  var o = {}; Object.keys(m).forEach(function (k) { o[k] = m[k]; });
  o.texto = String(m.texto || '') + '\n\n' + l;
  return o;
}

/* ── Las piezas ── */
function tvTxt_(v, n) { v = (v === null || v === undefined || typeof v === 'object') ? '' : String(v); v = v.replace(/\s+/g, ' ').trim(); return n && v.length > n ? v.slice(0, n - 1).trim() + '…' : v; }
function tvIniciales_(n) { return tvTxt_(n).split(' ').filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join(''); }
function tvDia_(f) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(f || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null; }
function tvFecha_(f) { var d = tvDia_(f); return d ? TV_DIAS_[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + TV_MESES_[d.getUTCMonth()] : ''; }
function tvMasDias_(f, n) { var d = tvDia_(f); if (!d) return ''; d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function tvNoches_(a, b) { var x = tvDia_(a), y = tvDia_(b); return x && y ? Math.max(0, Math.round((y - x) / 864e5)) : 0; }
function tvCanal_(p) { var x = String(p || '').toLowerCase(); var k = /airbnb/.test(x) ? 'airbnb' : /homeaway|vrbo/.test(x) ? 'vrbo' : /booking/.test(x) ? 'booking' : /expedia/.test(x) ? 'expedia' : x ? 'directa' : ''; return TV_CANAL_[k] || ''; }
function tvSecreto_(campo, texto) { return TV_SECRETO_CAMPO_.test(String(campo || '')) || TV_SECRETO_TEXTO_.test(String(texto || '')); }
/* «Z10 - Brunelo - 1203» → «Z10 · Brunelo 1203». */
function tvLugar_(nombre) { var p = calpPartes_(nombre); return p.zona && p.zona !== 'Otras' && p.corto !== p.zona ? p.zona + ' · ' + p.corto : (p.corto || tvTxt_(nombre)); }
function tvHoy_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function tvHora_(iso) {
  var d = new Date(iso); if (isNaN(d.getTime())) return '';
  var dia = Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd'), h = Utilities.formatDate(d, CFG.TZ, 'H:mm');
  return dia === tvHoy_() ? 'hoy ' + h : dia === tvMasDias_(tvHoy_(), -1) ? 'ayer ' + h : tvFecha_(dia).replace(/^\S+ /, '') + ' ' + h;
}
/* Un campo de la fila por su nombre (las hojas cambian de columnas): el primero que exista y tenga algo. */
function tvCampo_(r, re) { var k = Object.keys(r || {}).filter(function (x) { return re.test(x) && tvTxt_(r[x]); })[0]; return k ? r[k] : ''; }
function tvTel_(v) { var d = String(v || '').replace(/[^\d+]/g, ''); return d.replace(/\D/g, '').length >= 8 ? (d.charAt(0) === '+' ? d : '+' + d) : ''; }

/* Reserva y huésped: la fila de la hoja Reservas (r), lo que devolvió buscar_reservas (x) y su conversación de la bandeja. */
function tvReserva_(r, x, inbox) {
  x = x || {}; var cod = String(x.codigo || s_(r.code)).toUpperCase();
  tvPedirFotos_([x.propiedad]);   // sin ninguna foto del apartamento: una vez cada 6 h
  var ib = (inbox || []).filter(function (y) { return String(y.codigo || '').toUpperCase() === cod; })[0] || {};
  var est = String(x.estado || ''), cancel = /cancel/i.test(est), solic = /solicit|request|pend|consulta/i.test(est);
  var canal = tvCanal_(s_(r.platform) || s_(r.source) || s_(r.channel) || ib.canal);
  var noches = tvNoches_(x.entrada, x.salida), hues = Number(x.huespedes) || 0;
  var datos = [x.registro === 'completo' ? 'Registro completo' : 'Registro pendiente'];
  var pago = tvCampo_(r, /^(payout|total|total_price|monto|pago|amount)/i);
  if (pago && !isNaN(Number(pago)) && Number(pago) > 0) datos.push('Total US$ ' + Math.round(Number(pago)));
  if (cancel && x.cancelada_el) datos.push('Cancelada el ' + tvFecha_(String(x.cancelada_el).slice(0, 10)));
  var hLlega = tvTxt_(tvCampo_(r, /^(checkin_time|check_in_time|hora_llegada)$/i), 5), hSale = tvTxt_(tvCampo_(r, /^(checkout_time|check_out_time|hora_salida)$/i), 5);
  var tel = tvTel_(tvCampo_(r, /^(guest_phone|phone|telefono|guest_telefono)$/i) || (String(ib.conv_id || '').indexOf('wa:') === 0 ? String(ib.conv_id).slice(3) : '') || ib.wa);
  return {
    tipo: 'reserva', clave: 'reserva:' + cod, ref: cod, etiqueta: 'Reserva · ' + cod,
    titulo: tvTxt_(x.huesped, 40) || 'Huésped', sub: [tvLugar_(x.propiedad), canal].filter(Boolean).join(' · '),
    chip: cancel ? 'Cancelada' : solic ? 'Por aprobar' : est ? est.charAt(0).toUpperCase() + est.slice(1) : 'Confirmada', tono: cancel ? 'alerta' : solic ? 'aviso' : 'info',
    foto: /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '', iniciales: tvIniciales_(x.huesped),
    fechas: [{ t: 'Llega', v: tvFecha_(x.entrada), d: hLlega }, { t: 'Sale', v: tvFecha_(x.salida), d: hSale }, { t: 'Noches', v: String(noches), d: hues ? hues + ' huésp.' : '' }],
    datos: datos, mensajes: [], promesas: [], semana: [],
    detalle: [tvTxt_(x.propiedad), canal ? 'Canal: ' + canal : '', hues ? hues + (hues === 1 ? ' huésped' : ' huéspedes') : '', ib.ultimo_texto ? 'Último mensaje: «' + tvTxt_(ib.ultimo_texto, 140) + '»' : ''].filter(Boolean),
    conv: cod || String(x.conv_id || ''), tel: tel, wa: tel ? tel.replace(/\D/g, '') : '',
    resumen: 'la reserva de ' + (tvTxt_(x.huesped) || 'el huésped') + ' (fechas, noches, registro' + (datos.length > 1 ? ' y pago' : '') + ')',
    /* Tablero bento (#508 T1): la app nueva pinta estos cuadros; la vieja sigue con los campos de arriba. */
    cabeza: 'Reserva de ' + (tvTxt_(x.huesped, 40) || 'un huésped'),
    cuadros: tvCuadrosReserva_(x, ib, {
      chip: cancel ? 'Cancelada' : solic ? 'Por aprobar' : est ? est.charAt(0).toUpperCase() + est.slice(1) : 'Confirmada', tono: cancel ? 'alerta' : solic ? 'aviso' : 'info',
      cancel: cancel, noches: noches, hues: hues, hLlega: hLlega, pago: pago && !isNaN(Number(pago)) && Number(pago) > 0 ? Math.round(Number(pago)) : 0
    })
  };
}

/* ── Tablero bento de la reserva (#508 T1) ─────────────────────────────────────────────────────────────────────────────
   Una lista de cuadros { id, tipo (foto|dato|mensaje|mapa|resumen), tam (s|m|alto|ancho), prioridad, ... }; la app los
   acomoda (alma/inicio.html, AlmaTarjeta): lo que falta no se manda y los demás crecen para llenar.
   · foto: la del apartamento (catálogo de propiedades guardado) con la foto del huésped (bandeja, viene de Hospitable) o sus
     iniciales encima; sin la del apartamento, la del huésped; sin ninguna, un degradado de la marca con las iniciales
     (tam m: un cuadro más angosto y los datos crecen). Nunca un cuadro vacío.
   · Fechas, huéspedes · noches y total (solo si la hoja lo trae).
   · Necesita respuesta: el último mensaje es del huésped, Alma no marcó que no lo necesita y la estadía no terminó.
   · Galería (#508 T3): 2 o 3 fotos más del apartamento, si ya están guardadas (tvGaleria_).
   · Mapa: las coordenadas que ya guardó el Hub (catálogo o distancias); sin ellas, no hay mapa.
   · Resumen breve: cuándo llega, registro, promesa abierta y la última respuesta nuestra. Sin IA nueva.
   Nada de esto lleva códigos, claves ni wifi (tvTapar_). */
function tvCuadrosReserva_(x, ib, o) {
  ib = ib || {}; o = o || {};
  var out = [], apto = tvFotoProp_(x.propiedad), hues = /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '';
  var fondo = apto || hues;
  out.push({ id: 'foto', tipo: 'foto', tam: fondo ? 'alto' : 'm', prioridad: 1, fondo: fondo, de: apto ? 'apartamento' : fondo ? 'huesped' : '',
    avatar: apto ? hues : '', iniciales: tvIniciales_(x.huesped), alt: apto ? 'Foto de ' + tvLugar_(x.propiedad) : fondo ? 'Foto de ' + (tvTxt_(x.huesped) || 'el huésped') : '',
    chip: o.chip || '', tono: o.tono || 'info' });
  var rango = tvRango_(x.entrada, x.salida);
  if (rango) out.push({ id: 'fechas', tipo: 'dato', tam: 's', prioridad: 2, k: 'Fechas', v: rango,
    d: [tvFecha_(x.entrada).split(' ')[0], tvFecha_(x.salida).split(' ')[0]].filter(Boolean).join(' → ') + (o.hLlega ? ' · llega ' + o.hLlega : '') });
  if (o.noches || o.hues) out.push({ id: 'huespedes', tipo: 'dato', tam: 's', prioridad: 3, k: o.hues ? 'Huéspedes · noches' : 'Noches', v: o.hues ? o.hues + ' · ' + o.noches : String(o.noches) });
  if (o.pago) out.push({ id: 'pago', tipo: 'dato', tam: 's', prioridad: 4, k: 'Total', v: 'US$ ' + o.pago });
  var pend = tvPorResponder_(ib, x.salida, o.cancel);
  if (pend) out.push({ id: 'responder', tipo: 'mensaje', tam: 'ancho', prioridad: 2, k: 'Necesita respuesta', chip: pend.hora || 'Por responder', texto: pend.texto });
  var gal = tvGaleria_(x.propiedad, apto);   // #508 T3: las fotos del apartamento siempre que existan
  if (gal.length) out.push({ id: 'galeria', tipo: 'galeria', tam: 'ancho', prioridad: 4, fotos: gal, alt: 'Fotos de ' + tvLugar_(x.propiedad) });
  var co = tvCoords_(x.propiedad);
  if (co) out.push({ id: 'mapa', tipo: 'mapa', tam: 'm', prioridad: 5, lat: co.lat, lng: co.lng, lugar: tvLugar_(x.propiedad) });
  var res = tvResumenReserva_(x, ib, o, !!pend);
  if (res) out.push({ id: 'resumen', tipo: 'resumen', tam: 'm', prioridad: 6, k: 'Resumen', texto: res });
  return out;
}
/* «6 → 9 nov» · «30 nov → 2 dic». */
function tvRango_(a, b) {
  var x = tvDia_(a), y = tvDia_(b); if (!x) return '';
  if (!y) return x.getUTCDate() + ' ' + TV_MESES_[x.getUTCMonth()];
  return x.getUTCMonth() === y.getUTCMonth() ? x.getUTCDate() + ' → ' + y.getUTCDate() + ' ' + TV_MESES_[y.getUTCMonth()]
    : x.getUTCDate() + ' ' + TV_MESES_[x.getUTCMonth()] + ' → ' + y.getUTCDate() + ' ' + TV_MESES_[y.getUTCMonth()];
}
/* Lo que parece un código dentro de un texto del huésped se tapa (los números largos), y el texto queda. */
function tvTapar_(t) { t = tvTxt_(t); return tvSecreto_('', t) ? t.replace(/\d{3,}/g, '••••') : t; }
/* El último mensaje de la bandeja, si es del huésped y espera respuesta (como «Por responder» del Hub: index.html noRequiere). */
function tvPorResponder_(ib, salida, cancel) {
  if (!ib || cancel || String(ib.ultimo_de) !== 'guest' || !tvTxt_(ib.ultimo_texto)) return null;
  var ug = Date.parse(ib.ultimo_guest_ts || ib.ultimo_ts), nr = Date.parse(ib.no_requiere);
  if (nr && ug && nr === ug) return null;                                      // Alma revisó: no necesita respuesta
  if (salida && tvMasDias_(String(salida).slice(0, 10), 1) < tvHoy_()) return null;   // la estadía ya terminó
  return { texto: '«' + tvTapar_(tvTxt_(ib.ultimo_texto, 180)) + '»', hora: tvHora_(ib.ultimo_guest_ts || ib.ultimo_ts) };
}
/* Coordenadas que el Hub ya guardó: el catálogo de propiedades (calprops.js) o las de distancias (distancia.js). Sin llamar. */
function tvCoords_(nombre) {
  var k = calpClave_(nombre), c = CacheService.getScriptCache(), hit = null;
  try { hit = JSON.parse(c.get('calp_catalogo') || '[]').filter(function (y) { return calpClave_(y.nombre) === k && y.lat; })[0]; } catch (e) {}
  if (!hit) try { hit = JSON.parse(c.get('dist_props') || '[]').filter(function (y) { return calpClave_(y.n) === k && y.lat; })[0]; } catch (e) {}
  var lat = hit ? Number(hit.lat) : NaN, lng = hit ? Number(hit.lng) : NaN;
  return isFinite(lat) && isFinite(lng) && (lat || lng) ? { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 } : null;
}
/* Resumen breve, con lo que ya se sabe: cuándo llega, el registro, la promesa abierta y nuestra última respuesta. */
function tvResumenReserva_(x, ib, o, pend) {
  var hoy = tvHoy_(), ent = String(x.entrada || '').slice(0, 10), sal = String(x.salida || '').slice(0, 10), fr = [];
  if (o.cancel) fr.push(x.cancelada_el ? 'Cancelada el ' + tvFecha_(String(x.cancelada_el).slice(0, 10)) : 'Reserva cancelada');
  else if (ent > hoy) { var n = tvNoches_(hoy, ent); fr.push(n === 1 ? 'Llega mañana' : 'Llega en ' + n + ' días'); }
  else if (ent === hoy) fr.push('Llega hoy');
  else if (sal > hoy) fr.push('En estadía · sale ' + (sal === tvMasDias_(hoy, 1) ? 'mañana' : tvFecha_(sal)));
  else if (sal === hoy) fr.push('Sale hoy');
  else if (sal) fr.push('Ya salió');
  if (!o.cancel) fr.push(x.registro === 'completo' ? 'Registro completo' : 'Registro pendiente');
  var pe = String(ib.promesa_estado || '');
  if ((pe === 'abierta' || pe === 'vencida') && tvTxt_(ib.promesa) && !tvSecreto_('', ib.promesa))
    fr.push('Promesa ' + pe + ': ' + tvTxt_(ib.promesa, 80) + (tvTxt_(ib.promesa_vence) ? ' (vence ' + tvTxt_(ib.promesa_vence, 16) + ')' : ''));
  if (!pend && String(ib.ultimo_de) === 'host' && tvHora_(ib.ultimo_host_ts || ib.ultimo_ts)) fr.push('Le respondimos ' + tvHora_(ib.ultimo_host_ts || ib.ultimo_ts));
  return fr.length ? fr.join('. ') + '.' : '';
}

/* Fragmento de conversación: los últimos 2 o 3 mensajes y las promesas abiertas (lo mismo que leyó ver_conversacion). */
function tvConversacion_(rid, hilo, promesas, inbox) {
  var ib = (inbox || []).filter(function (y) { return String(y.conv_id) === String(rid); })[0] || {};
  var nombre = tvTxt_(ib.huesped, 40), primer = nombre.split(' ')[0];
  var msgs = (hilo || []).filter(function (m) { return tvTxt_(m.texto) || (m.fotos || []).length; }).slice(-3).map(function (m) {
    var de = m.tipo === 'guest' ? 'huesped' : m.auto ? 'auto' : 'equipo';
    return { de: de, quien: de === 'huesped' ? (primer || 'Huésped') : de === 'auto' ? 'Automático' : 'Spacio AM', texto: tvTxt_(m.texto, 220) || '[foto]', hora: tvHora_(m.created) };
  });
  if (!msgs.length) return null;
  var cod = String(ib.codigo || '').toUpperCase();
  var pr = (promesas || []).map(function (p) { return tvTxt_(p.que, 90) + (p.vence ? ' · vence ' + tvTxt_(p.vence, 16) : ''); }).slice(0, 3);
  var tel = String(rid).indexOf('wa:') === 0 ? tvTel_(String(rid).slice(3)) : '';
  return {
    tipo: 'conversacion', clave: 'conversacion:' + rid, ref: cod || String(rid), etiqueta: 'Conversación' + (cod ? ' · ' + cod : ''),
    titulo: nombre || 'Conversación', sub: [ib.propiedad ? tvLugar_(ib.propiedad) : '', tvCanal_(ib.canal) || (tel ? 'WhatsApp' : '')].filter(Boolean).join(' · '),
    chip: pr.length ? 'Promesa abierta' : '', tono: 'aviso', foto: /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '', iniciales: tvIniciales_(nombre),
    fechas: [], datos: [], mensajes: msgs, promesas: pr, semana: [], detalle: [],
    conv: cod || String(rid), tel: tel, wa: tel ? tel.replace(/\D/g, '') : '',
    resumen: 'los últimos mensajes de la conversación' + (nombre ? ' con ' + nombre : '') + (pr.length ? ' y sus promesas abiertas' : '')
  };
}

/* Consulta (inquiry): quien escribió sin reservar. Sale de la fila de la bandeja (ib) y, si ya se leyó, de su hilo; con
   un borrador, el texto que saldría (todavía no salió: lo dice el chip). Precio solo si algo ya lo trae. */
function tvConsulta_(ib, hilo, borrador) {
  ib = ib || {}; var rid = String(ib.conv_id || ''); if (rid.indexOf('inq:') !== 0) return null;
  var nombre = tvTxt_(ib.huesped, 40), primer = nombre.split(' ')[0], canal = tvCanal_(ib.canal) || 'Airbnb';
  var ent = String(ib.checkin || '').slice(0, 10), sal = String(ib.checkout || '').slice(0, 10), noches = tvNoches_(ent, sal), hues = Number(ib.huespedes) || 0;
  var msgs = (hilo || []).filter(function (m) { return tvTxt_(m.texto); }).slice(-2).map(function (m) {
    var de = m.tipo === 'guest' ? 'huesped' : m.auto ? 'auto' : 'equipo';
    return { de: de, quien: de === 'huesped' ? (primer || 'Huésped') : de === 'auto' ? 'Automático' : 'Spacio AM', texto: tvTxt_(m.texto, 220), hora: tvHora_(m.created) };
  });
  if (!msgs.length && tvTxt_(ib.ultimo_texto)) msgs = [{ de: ib.ultimo_de === 'guest' ? 'huesped' : 'equipo', quien: ib.ultimo_de === 'guest' ? (primer || 'Huésped') : 'Spacio AM', texto: tvTxt_(ib.ultimo_texto, 220), hora: tvHora_(ib.ultimo_ts) }];
  if (tvTxt_(borrador)) msgs.push({ de: 'equipo', quien: 'Borrador · sale con tu sí', texto: tvTxt_(borrador, 400), hora: '' });
  var precio = tvCampo_(ib, /^(precio|price|total|monto|tarifa|quote)/i), datos = [];
  if (precio && !isNaN(Number(precio)) && Number(precio) > 0) datos.push('Precio US$ ' + Math.round(Number(precio)));
  datos.push('Sin reserva todavía');
  return {
    tipo: 'consulta', clave: 'consulta:' + rid + (tvTxt_(borrador) ? ':b' + tvTxt_(borrador).length : ''), ref: rid, etiqueta: 'Consulta · ' + canal,
    titulo: nombre || 'Interesado', sub: [ib.propiedad ? tvLugar_(ib.propiedad) : '', canal].filter(Boolean).join(' · '),
    chip: tvTxt_(borrador) ? 'Borrador' : 'Consulta', tono: 'aviso', foto: /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '', iniciales: tvIniciales_(nombre),
    fechas: ent ? [{ t: 'Llega', v: tvFecha_(ent), d: '' }, { t: 'Sale', v: tvFecha_(sal), d: '' }, { t: 'Noches', v: String(noches), d: hues ? hues + ' huésp.' : '' }] : [],
    datos: datos, mensajes: msgs, promesas: [], semana: [], detalle: [tvTxt_(ib.propiedad)].filter(Boolean),
    conv: rid, tel: '', wa: '',
    resumen: (tvTxt_(borrador) ? 'el borrador para ' : 'la consulta de ') + (nombre || 'la persona') + ' (fechas, propiedad y su mensaje)'
  };
}

/* Apartamento: foto del anuncio, zona y edificio, cuartos, parqueo y portería, y la semana del calendario con los colores
   del glosario («Colores del calendario»). Nunca códigos, claves, wifi ni teléfonos. */
function tvApartamento_(nombre, j, plano) {
  nombre = tvTxt_(nombre); if (!nombre) return null;
  j = j || {}; plano = plano || {};
  var p = calpPartes_(nombre), std = (j.std && j.std.es) || {};
  var limpio = function (campo, v, n) { v = tvSinTel_(tvTxt_(v, n || 90)); return v && !tvSecreto_(campo, v) ? v : ''; };
  var deCampo = function (re, n) { var k = Object.keys(plano).filter(function (x) { return re.test(x) && !tvSecreto_(x, plano[x]) && tvTxt_(plano[x]); })[0]; return k ? limpio(k, plano[k], n) : ''; };
  var cuartos = deCampo(/(bedroom|habitaci|dormitor|cuartos|recamar)/i, 30);
  var parqueo = limpio('parking', std.parking, 110) || deCampo(/(parqueo|parking|estacionamiento)/i, 110);
  var porteria = deCampo(/(porter|lobby|recepci|garita|conserje|concierge|seguridad)/i, 90);
  var hab = cuartos ? (/^\d+$/.test(cuartos) ? cuartos + (cuartos === '1' ? ' habitación' : ' habitaciones') : cuartos) : '';
  var datos = [hab, parqueo ? 'Parqueo: ' + parqueo : '', porteria ? 'Portería: ' + porteria : ''].filter(Boolean);
  var fotos = tvFotosLeidas_(j);
  tvPedirFotos_([nombre], fotos);   // sin ninguna foto (ni guardada, ni picture, ni en la herramienta): una vez cada 6 h
  var foto = tvFotoProp_(nombre) || fotos[0] || '';
  var est = tvEstadias_(), semana = tvSemana_(nombre, est);
  return {
    tipo: 'apartamento', clave: 'apartamento:' + calpClave_(nombre), ref: nombre, etiqueta: 'Apartamento' + (p.zona && p.zona !== 'Otras' ? ' · ' + p.zona : ''),
    titulo: p.corto || nombre, sub: [p.zona !== 'Otras' ? p.zona : '', p.edificio].filter(Boolean).join(' · '), chip: '', tono: '',
    foto: foto, iniciales: tvIniciales_(p.edificio || nombre),
    fechas: [], datos: datos, mensajes: [], promesas: [], semana: semana,
    detalle: [limpio('arrivalIntro', std.arrivalIntro, 220)].filter(Boolean), conv: '', tel: '', wa: '',
    resumen: 'la ficha de ' + (p.corto || nombre) + ' y su semana del calendario',
    /* Tablero bento (#508 T2): la app nueva pinta estos cuadros; la vieja sigue con los campos de arriba. */
    cabeza: p.corto || nombre,
    cuadros: tvCuadrosApartamento_(nombre, { foto: foto, fotos: fotos, est: est, semana: semana, hab: hab, parqueo: parqueo, porteria: porteria })
  };
}
/* La foto del anuncio sale del catálogo de Hospitable que ya guardó el calendario de propiedades (sin llamarlo); si el
   catálogo no trae picture, la primera de las fotos del anuncio que ya están guardadas (#508 T3). */
function tvFotoProp_(nombre) {
  var x = tvCatalogoProp_(nombre);
  if (x && /^https:\/\//.test(String(x.foto || ''))) return String(x.foto);
  var g = tvFotosGuardadas_(nombre, x);
  return g.length ? g[0].u : '';
}
function tvCatalogoProp_(nombre) {
  try {
    var cat = JSON.parse(CacheService.getScriptCache().get('calp_catalogo') || '[]'), k = calpClave_(nombre);
    return cat.filter(function (y) { return calpClave_(y.nombre) === k; })[0] || null;
  } catch (e) { return null; }
}
/* ── Fotos del anuncio guardadas (#508 T3) ─────────────────────────────────────────────────────────────────────────────
   fuentes.js ya pide /properties/{id}/images cuando Alma revisa las fotos para responder sobre la propiedad: ahí mismo
   quedan guardadas 6 h (como calp_catalogo) en calp_fotos_<id>, en el orden del anuncio: { u (grande), t (miniatura) }.
   La tarjeta las lee; solo las pide ella misma cuando el apartamento no tiene ninguna (tvPedirFotos_, abajo). */
function tvGuardarFotos_(propId, lista) {
  propId = String(propId || '').trim(); if (!propId) return;
  var out = [];
  (lista || []).forEach(function (x) {
    var u = String((x && (x.url || x.u)) || '').trim(), t = String((x && (x.thumbnail_url || x.t)) || '').trim();
    var ok = function (v) { return /^https:\/\/[^\s"'<>]+$/.test(v) ? v : ''; };
    u = ok(u) || ok(t); t = ok(t) || u;
    if (u && out.length < TV_FOTOS_MAX_ && !out.some(function (y) { return y.u === u; })) out.push({ u: u, t: t });
  });
  try { if (out.length) CacheService.getScriptCache().put('calp_fotos_' + propId, JSON.stringify(out), TV_FOTOS_SEG_); } catch (e) { console.error('tvGuardarFotos_: ' + e); }
}
function tvFotosGuardadas_(nombre, cat) {
  var x = cat === undefined ? tvCatalogoProp_(nombre) : cat; if (!x || !x.id || TV_FOTOS_TARDE_[x.id]) return [];
  try { return (JSON.parse(CacheService.getScriptCache().get('calp_fotos_' + x.id) || '[]') || []).filter(function (f) { return f && /^https:\/\//.test(String(f.u || '')); }); } catch (e) { return []; }
}
/* La galería: 2 o 3 fotos del anuncio que no son la principal (las guardadas y, si faltan, las que trajo la herramienta). */
function tvGaleria_(nombre, principal, leidas) {
  var out = [], vistas = [String(principal || '')];
  var mete = function (u, t) { if (out.length >= 3 || !u || vistas.indexOf(u) >= 0 || (t && vistas.indexOf(t) >= 0)) return; vistas.push(u); if (t) vistas.push(t); out.push(t || u); };
  tvFotosGuardadas_(nombre).forEach(function (f) { mete(f.u, f.t); });
  (leidas || []).forEach(function (u) { mete(String(u), ''); });
  return out.length >= 2 ? out : [];
}
/* ── Fotos que faltan (Juan, 13-nov-2026) ───────────────────────────────────────────────────────────────────────────────
   La ÚNICA llamada de la tarjeta a Hospitable. Al armar el tablero de una reserva, un apartamento o un edificio: si un
   apartamento no tiene ninguna foto (ni guardada en calp_fotos_<id>, ni picture en el catálogo, ni en lo que trajo la
   herramienta), pide /properties/{id}/images con el mismo pedido de fuentes.js (fuentesPedirFotos_: mismo cupo, y las
   guarda 6 h con tvGuardarFotos_).
   · Una vez cada 6 h por apartamento: el intento queda en calp_fotos_intento_<id> ANTES de pedir, así no se repite
     aunque falle, venga vacía o se caiga a medias.
   · Solo si el tablero no tiene ninguna foto, y a lo mucho un apartamento por tablero: el edificio pide solo el primero
     sin intento (si ese falló, el próximo tablero prueba con el siguiente).
   · Sin espera notable: un 429 no se reintenta y, si el pedido tarda más de 2 s, este tablero sale sin esas fotos
     (TV_FOTOS_TARDE_); quedan guardadas y el próximo ya las trae.
   · Nunca para un tablero que no se va a ver (pantalla bloqueada o conferencia sin pantalla: TV_SIN_PEDIR_, tvCerrar_). */
var TV_FOTOS_ESPERA_MS_ = 2000;
var TV_SIN_PEDIR_ = false;   // tvCerrar_: este tablero no se va a ver
var TV_FOTOS_TARDE_ = {};    // ids cuyas fotos llegaron tarde para el tablero que se está armando
function tvPedirFotos_(nombres, leidas) {
  TV_FOTOS_TARDE_ = {};
  if (TV_SIN_PEDIR_ || (leidas && leidas.length) || typeof fuentesPedirFotos_ !== 'function') return false;
  var c = CacheService.getScriptCache(), cats = (nombres || []).map(function (n) { return { n: n, cat: tvCatalogoProp_(n) }; });
  var tiene = function (y) { return !!y.cat && (/^https:\/\//.test(String(y.cat.foto || '')) || tvFotosGuardadas_(y.n, y.cat).length > 0); };
  if (cats.some(tiene)) return false;   // el tablero ya tiene alguna foto: no hace falta pedir
  var x = (cats.filter(function (y) { return y.cat && y.cat.id && !c.get('calp_fotos_intento_' + y.cat.id); })[0] || {}).cat;
  if (!x) return false;
  var id = String(x.id), t0 = Date.now(), lista = null;
  try { c.put('calp_fotos_intento_' + id, '1', TV_FOTOS_SEG_); } catch (e) { return false; }   // sin poder marcar, no se pide
  try { lista = fuentesPedirFotos_(id, { sinReintentos: true }); } catch (e) { console.error('tvPedirFotos_: ' + e); }
  if (Date.now() - t0 > TV_FOTOS_ESPERA_MS_) TV_FOTOS_TARDE_[id] = 1;
  return !!(lista && lista.length);
}
/* Siete noches desde hoy: res (reservado, azul) · con (consulta o solicitud, amarillo) · bloq (bloqueado, rojo) · libre (verde). */
function tvSemana_(nombre, est) {
  var hoy = tvHoy_(), k = calpClave_(nombre);
  est = (est || tvEstadias_()).filter(function (e) { return calpClave_(e.propiedad) === k; });
  var bl = (calpBloqueos_([nombre])[k] || {}).d || [];
  var out = [];
  for (var i = 0; i < 7; i++) {
    var f = tvMasDias_(hoy, i), d = tvDia_(f), e = 'libre';
    var e1 = est.filter(function (x) { return x.checkin <= f && f < x.checkout; })[0];
    if (e1) e = e1.tipo === 'reserva' ? 'res' : 'con';
    else if (bl.some(function (b) { return b[0] === f && b[2] === 'B'; })) e = 'bloq';
    out.push({ f: f, letra: TV_LETRA_[d.getUTCDay()], n: d.getUTCDate(), e: e, hoy: i === 0 });
  }
  return out;
}

/* ── Tablero bento del apartamento y del edificio (#508 T2) ─────────────────────────────────────────────────────────────
   Mismo formato que la reserva (tipo, tam, prioridad); la app los acomoda igual. Dos tipos nuevos de cuadro:
   · semana (ancho): las 7 noches desde hoy con los colores del calendario, como la ficha de siempre.
   · lista (ancho): renglones cortos { t (etiqueta), v, d, tono, foto? } (pendientes, llegadas y salidas de hoy).
   · galeria (ancho): 2 o 3 fotos más del anuncio: las guardadas (tvGaleria_, #508 T3) o las que trajo la herramienta.
   Juan (13-nov): lo que más importa son las fotos. La de la propiedad siempre que exista (catálogo, o la primera que trajo la
   herramienta) y la del huésped (ALMA_INBOX) en quien está hoy, quien llega y quien sale.
   Fuentes, sin llamar a nadie: hoja Reservas o la caché del calendario (estadías), catálogo guardado (foto y coordenadas),
   hoja de promesas, caché de Epi (tareas) y caché de Hola o RECEP_NUMS (si el edificio tiene recepción: solo su nombre).
   Nunca códigos, claves, wifi ni teléfonos (tvSecreto_, tvSinTel_). */
function tvSinTel_(t) {
  return tvTxt_(String(t || '').replace(TV_TEL_, function (m) { return m.replace(/\D/g, '').length >= 7 ? ' ' : m; }))
    .replace(/\s+([,.;:)])/g, '$1').replace(/\(\s*\)/g, '').replace(/[\s(:,;-]+$/, '').trim();
}
/* Las fotos del anuncio que ya trajo la herramienta (info_json de la hoja Propiedades): las direcciones https dentro de un
   campo de foto, en su orden. Sin llamar a Hospitable. */
function tvFotosLeidas_(j) {
  var out = [];
  (function rec(v, foto) {
    if (out.length >= 8 || v === null || v === undefined) return;
    if (typeof v === 'string') { if (foto && /^https:\/\/[^\s"'<>]+$/.test(v.trim()) && out.indexOf(v.trim()) < 0) out.push(v.trim()); return; }
    if (Array.isArray(v)) { v.forEach(function (x) { rec(x, foto); }); return; }
    if (typeof v === 'object') Object.keys(v).forEach(function (k) { if (!TV_SECRETO_CAMPO_.test(k)) rec(v[k], foto || /(picture|photo|foto|imagen|image|thumbnail)/i.test(k)); });
  })(j || {}, false);
  return out;
}
/* La foto del huésped (bandeja; viene de Hospitable y ya está guardada): por el código de la reserva o la conversación. */
function tvFotoHuesped_(x, inbox) {
  if (!x) return '';
  var cod = String(x.codigo || '').toUpperCase(), conv = String(x.conv || '');
  var ib = (inbox || []).filter(function (y) { return (cod && String(y.codigo || '').toUpperCase() === cod) || (conv && String(y.conv_id) === conv); })[0];
  return ib && /^https:\/\/[^\s"'<>]+$/.test(String(ib.foto || '')) ? String(ib.foto) : '';
}
function tvInbox_() { try { return typeof hubInbox_ === 'function' ? hubInbox_() : []; } catch (e) { console.error('tvInbox_: ' + e); return []; } }
/* Las estadías que ya juntó el calendario de propiedades (caché de 5 min) o, sin ella, la hoja Reservas y la bandeja. */
function tvEstadias_() {
  var hoy = tvHoy_(), est = null;
  try { var base = JSON.parse(CacheService.getScriptCache().get('calp_base_' + hoy) || 'null'); if (base && base.estadias) est = base.estadias; } catch (e) {}
  return est || calpEstadias_(tvMasDias_(hoy, -1), tvMasDias_(hoy, 60));
}
/* Quién está, quién llega y quién sale en un grupo de propiedades (claves de calpClave_). Las consultas no cuentan. */
function tvMovimientos_(claves, est) {
  var hoy = tvHoy_(), r = (est || []).filter(function (e) { return e && e.tipo !== 'consulta' && claves[calpClave_(e.propiedad)]; });
  var por = function (a, b) { return a.checkin < b.checkin ? -1 : a.checkin > b.checkin ? 1 : 0; };
  return { hoy: hoy, dentro: r.filter(function (e) { return e.checkin <= hoy && hoy < e.checkout; }).sort(por),
    llegan: r.filter(function (e) { return e.checkin === hoy; }).sort(por), salen: r.filter(function (e) { return e.checkout === hoy; }).sort(por),
    manana: { llegan: r.filter(function (e) { return e.checkin === tvMasDias_(hoy, 1); }).length, salen: r.filter(function (e) { return e.checkout === tvMasDias_(hoy, 1); }).length },
    proxima: r.filter(function (e) { return e.checkin > hoy; }).sort(por)[0] || null };
}
/* «Hoy» · «Mañana» · «vie 14 nov». */
function tvCuando_(f) { var hoy = tvHoy_(); f = String(f || '').slice(0, 10); return f === hoy ? 'Hoy' : f === tvMasDias_(hoy, 1) ? 'Mañana' : tvFecha_(f); }
function tvQuien_(x) { return tvTxt_(x && x.huesped, 28) || (x && x.tipo === 'solicitud' ? 'Solicitud' : 'Un huésped'); }
/* Las claves con que otras hojas nombran al apartamento: «Z10 - Brunelo - 1203» y «Brunelo 1203». */
function tvClavesProp_(nombre) { var o = {}, p = calpPartes_(nombre); o[calpClave_(nombre)] = 1; if (p.unidad) o[calpClave_(p.corto)] = 1; return o; }

function tvCuadrosApartamento_(nombre, o) {
  o = o || {};
  var p = calpPartes_(nombre), cl = tvClavesProp_(nombre), m = tvMovimientos_(cl, o.est), sem = o.semana || [], out = [];
  var e0 = sem[0] ? sem[0].e : 'libre', dentro = m.dentro[0] || null, sale = m.salen[0] || null;
  var inbox = dentro || m.proxima || sale ? tvInbox_() : [], fd = tvFotoHuesped_(dentro, inbox), fp = tvFotoHuesped_(m.proxima, inbox), fs = tvFotoHuesped_(sale, inbox);
  var chip = dentro ? (dentro.tipo === 'solicitud' ? 'Por aprobar' : 'Ocupado') : e0 === 'bloq' ? 'Bloqueado' : e0 === 'con' ? 'Consulta' : 'Libre hoy';
  var tono = dentro ? (dentro.tipo === 'solicitud' ? 'aviso' : 'info') : e0 === 'bloq' ? 'alerta' : e0 === 'con' ? 'aviso' : 'libre';
  out.push({ id: 'foto', tipo: 'foto', tam: o.foto ? 'alto' : 'm', prioridad: 1, fondo: o.foto || '', de: o.foto ? 'propiedad' : '',
    iniciales: p.unidad && p.unidad.length <= 5 ? p.unidad : tvIniciales_(p.edificio || nombre), alt: o.foto ? 'Foto de ' + (p.corto || nombre) : '', chip: chip, tono: tono });
  /* La foto del huésped va en su cuadro (hoy, llegada, salida), no repetida encima de la del apartamento. */
  if (dentro) out.push({ id: 'hoy', tipo: 'dato', tam: 's', prioridad: 2, k: dentro.checkin === m.hoy ? 'Llega hoy' : 'Hoy está', v: tvQuien_(dentro), foto: fd, iniciales: tvIniciales_(dentro.huesped),
    d: 'sale ' + tvCuando_(dentro.checkout).replace(/^(Hoy|Mañana)$/, function (x) { return x.toLowerCase(); }) + ' · ' + tvNoches_(dentro.checkin, dentro.checkout) + ' noches' });
  if (m.proxima) out.push({ id: 'llegada', tipo: 'dato', tam: 's', prioridad: 3, k: 'Llega', v: tvCuando_(m.proxima.checkin), foto: fp, iniciales: tvIniciales_(m.proxima.huesped),
    d: tvQuien_(m.proxima) + ' · ' + tvNoches_(m.proxima.checkin, m.proxima.checkout) + ' noches' });
  if (sale || dentro) out.push({ id: 'salida', tipo: 'dato', tam: 's', prioridad: 4, k: sale ? 'Sale hoy' : 'Sale', v: sale ? tvQuien_(sale) : tvCuando_(dentro.checkout), foto: sale ? fs : '', iniciales: sale ? tvIniciales_(sale.huesped) : '',
    d: sale ? (sale.tipo === 'solicitud' ? 'solicitud' : 'check-out hoy') : tvQuien_(dentro) });
  if (sem.length) {
    var oc = sem.filter(function (d) { return d.e === 'res'; }).length;
    out.push({ id: 'semana', tipo: 'semana', tam: 'ancho', prioridad: 5, k: 'Esta semana', d: oc ? oc + ' de 7 noches reservadas' : 'Libre toda la semana',
      dias: sem.map(function (d) { return { letra: d.letra, n: d.n, e: d.e, hoy: !!d.hoy }; }) });
  }
  var gal = tvGaleria_(nombre, o.foto, o.fotos);
  if (gal.length) out.push({ id: 'galeria', tipo: 'galeria', tam: 'ancho', prioridad: 6, fotos: gal, alt: 'Más fotos de ' + (p.corto || nombre) });
  var pend = tvPendientes_(cl);
  if (pend.length) out.push({ id: 'pendientes', tipo: 'lista', tam: 'ancho', prioridad: 6, k: 'Pendientes', chip: String(pend.length), items: tvRecortar_(pend, 3) });
  var co = tvCoords_(nombre);
  if (co) out.push({ id: 'mapa', tipo: 'mapa', tam: 'm', prioridad: 7, lat: co.lat, lng: co.lng, lugar: tvLugar_(nombre) });
  var rec = tvRecepcion_([nombre]);
  if (rec) out.push({ id: 'recepcion', tipo: 'dato', tam: 'm', prioridad: 8, k: 'Recepción', v: rec, d: o.porteria || 'Le escribe Alma' });
  var ficha = [o.hab, o.parqueo ? 'Parqueo: ' + o.parqueo : '', !rec && o.porteria ? 'Portería: ' + o.porteria : ''].filter(Boolean);
  if (ficha.length) out.push({ id: 'ficha', tipo: 'resumen', tam: 'm', prioridad: 9, k: 'El apartamento', texto: ficha.join('. ').replace(/\.?$/, '.') });
  return out;
}
/* Promesas abiertas (hoja de promesas) y tareas abiertas (la caché de Epi que ya guardó Alma) de esas propiedades. */
function tvPendientes_(claves) {
  var out = [], vence = function (v) { v = tvTxt_(v); return /^\d{4}-\d\d-\d\dT/.test(v) ? tvHora_(v) : tvTxt_(v, 16); };
  try {
    if (typeof hubPromesas_ === 'function') (hubPromesas_(false).promesas || []).forEach(function (x) {
      if (!claves[calpClave_(x.propiedad)] || !tvTxt_(x.que) || tvSecreto_('', x.que)) return;
      out.push({ t: x.estado === 'vencida' ? 'Vencida' : 'Promesa', v: tvSinTel_(tvTxt_(x.que, 90)), d: vence(x.vence) ? 'vence ' + vence(x.vence) : '', tono: x.estado === 'vencida' ? 'alerta' : 'aviso' });
    });
  } catch (e) { console.error('tvPendientes_ promesas: ' + e); }
  try {
    var sn = JSON.parse(CacheService.getScriptCache().get('episnap') || 'null');
    ((sn && sn.tareas) || []).forEach(function (t) {
      if (!t || t.hecha || !claves[calpClave_(t.prop)] || !tvTxt_(t.texto) || tvSecreto_('', t.texto)) return;
      out.push({ t: 'Tarea', v: tvSinTel_(tvTxt_(t.texto, 90)), d: [tvTxt_(t.quien, 20), vence(t.vence) ? 'vence ' + vence(t.vence) : ''].filter(Boolean).join(' · '), tono: '' });
    });
  } catch (e) { console.error('tvPendientes_ tareas: ' + e); }
  return out;
}
function tvRecortar_(items, n) { return items.length <= n ? items : items.slice(0, n - 1).concat([{ t: '', v: 'y ' + (items.length - n + 1) + ' más', d: '', tono: '' }]); }
/* ¿El edificio tiene recepción? Lo sabe Hola (la caché recep_nums) o RECEP_NUMS. Devuelve SOLO el nombre del edificio. */
function tvRecepcion_(nombres) {
  var m = {};
  try { m = JSON.parse(CacheService.getScriptCache().get('recep_nums') || '{}') || {}; } catch (e) {}
  try { if (typeof PropertiesService !== 'undefined') { var x = JSON.parse(PropertiesService.getScriptProperties().getProperty('RECEP_NUMS') || '{}'); Object.keys(x).forEach(function (k) { m[k] = x[k]; }); } } catch (e) {}
  var claves = {}, eds = {};
  (nombres || []).forEach(function (n) { claves[calpClave_(n)] = 1; var p = calpPartes_(n); if (p.edificio) eds[calpClave_(p.edificio)] = p.edificio; });
  var hit = Object.keys(m).map(function (k) { return m[k]; }).filter(function (r) {
    var pr = String((r && r.prop) || ''), pp = calpPartes_(pr); return pr && (claves[calpClave_(pr)] || eds[calpClave_(pp.edificio)] || eds[calpClave_(pr)]);
  })[0];
  if (!hit) return '';
  var pp = calpPartes_(hit.prop);
  return tvSinTel_(eds[calpClave_(pp.edificio)] || eds[calpClave_(hit.prop)] || pp.edificio || hit.prop);
}

/* ¿Se habla del edificio completo? texto: lo que se pidió («Brunelo», «edificio Brunelo», «Z10 Brunelo»); nombres: lo que
   trajo la herramienta (opciones, todas del mismo edificio); todos: las propiedades de la hoja. Con 2 o más apartamentos
   devuelve { zona, edificio, props }; si no, null. */
function tvEdificioDe_(texto, nombres, todos) {
  var grupos = {};
  (todos || []).forEach(function (n) {
    n = tvTxt_(n); var p = calpPartes_(n); if (!n || !p.unidad) return;
    var g = calpClave_(p.zona + ' ' + p.edificio); (grupos[g] = grupos[g] || { zona: p.zona, edificio: p.edificio, props: [] }).props.push(n);
  });
  var q = calpClave_(texto), q2 = calpClave_(String(texto || '').replace(/\b(el|edificio)\b/gi, ' ')), elegido = null;
  if (q) Object.keys(grupos).forEach(function (g) {
    var e = calpClave_(grupos[g].edificio);
    if ((g === q || g === q2 || e === q || e === q2) && (!elegido || grupos[g].props.length > elegido.props.length)) elegido = grupos[g];
  });
  if (!elegido && (nombres || []).length >= 2) {
    var gs = nombres.map(function (n) { var p = calpPartes_(n); return p.unidad ? calpClave_(p.zona + ' ' + p.edificio) : ''; });
    if (gs[0] && gs.every(function (g) { return g === gs[0]; })) elegido = grupos[gs[0]] || null;
  }
  if (!elegido || elegido.props.length < 2) return null;
  return { zona: elegido.zona, edificio: elegido.edificio, props: elegido.props.slice().sort() };
}
/* El tablero del edificio: foto (la primera propiedad con foto), cuántos apartamentos, llegadas y salidas de hoy, mapa. */
function tvEdificio_(e) {
  if (!e || !e.props || e.props.length < 2) return null;
  var claves = {}; e.props.forEach(function (n) { Object.keys(tvClavesProp_(n)).forEach(function (k) { claves[k] = 1; }); });
  var m = tvMovimientos_(claves, tvEstadias_()), N = e.props.length, ocup = {};
  m.dentro.forEach(function (x) { ocup[calpClave_(x.propiedad)] = 1; });
  var nOcup = Object.keys(ocup).length, zona = e.zona && e.zona !== 'Otras' ? e.zona : '';
  var nombre = /^(edificio|torre|residencial|condominio)\b/i.test(e.edificio) ? e.edificio : 'Edificio ' + e.edificio;
  var foto = '', co = null;
  tvPedirFotos_(e.props);   // solo el primer apartamento sin ninguna foto (uno por tablero)
  e.props.some(function (n) { foto = tvFotoProp_(n); return !!foto; });
  e.props.some(function (n) { co = tvCoords_(n); return !!co; });
  var uni = function (x) { return calpPartes_(x.propiedad).unidad || tvLugar_(x.propiedad); };
  var unis = function (xs) { var u = []; xs.forEach(function (x) { if (u.indexOf(uni(x)) < 0) u.push(uni(x)); }); return u.length > 4 ? u.slice(0, 3).join(' · ') + ' y ' + (u.length - 3) + ' más' : u.join(' · '); };
  var cuenta = function (n, uno, varios) { return n === 1 ? '1 ' + uno : n + ' ' + varios; };
  var cuadros = [
    { id: 'foto', tipo: 'foto', tam: foto ? 'alto' : 'm', prioridad: 1, fondo: foto, de: foto ? 'propiedad' : '', iniciales: tvIniciales_(e.edificio), alt: foto ? 'Foto de ' + nombre : '', chip: zona, tono: 'info' },
    { id: 'apartamentos', tipo: 'dato', tam: 's', prioridad: 2, k: 'Apartamentos', v: String(N), d: nOcup ? nOcup + ' ocupados esta noche' : 'Todos libres esta noche' },
    { id: 'llegadas', tipo: 'dato', tam: 's', prioridad: 3, k: 'Llegadas hoy', v: m.llegan.length ? String(m.llegan.length) : 'Ninguna', d: unis(m.llegan) },
    { id: 'salidas', tipo: 'dato', tam: 's', prioridad: 4, k: 'Salidas hoy', v: m.salen.length ? String(m.salen.length) : 'Ninguna', d: unis(m.salen) }
  ];
  var inbox = m.llegan.length || m.salen.length ? tvInbox_() : [];
  var mov = m.llegan.map(function (x) { return { t: 'Llega', v: uni(x) + ' · ' + tvQuien_(x), d: tvNoches_(x.checkin, x.checkout) + ' noches', tono: 'info', foto: tvFotoHuesped_(x, inbox), iniciales: tvIniciales_(x.huesped) }; })
    .concat(m.salen.map(function (x) { return { t: 'Sale', v: uni(x) + ' · ' + tvQuien_(x), d: '', tono: '', foto: tvFotoHuesped_(x, inbox), iniciales: tvIniciales_(x.huesped) }; }));
  if (mov.length) cuadros.push({ id: 'hoy', tipo: 'lista', tam: 'ancho', prioridad: 5, k: 'Hoy en el edificio', chip: String(mov.length), items: tvRecortar_(mov, 5) });
  /* #508 T3: las fotos de sus apartamentos (una de cada uno; si hay una sola, las del anuncio de ese apartamento). */
  var gal = [];
  e.props.forEach(function (n) { var f = tvFotoProp_(n); if (f && f !== foto && gal.indexOf(f) < 0 && gal.length < 3) gal.push(f); });
  if (gal.length < 2) e.props.some(function (n) { var g = tvGaleria_(n, foto, gal); if (g.length) gal = g; return g.length > 0; });
  if (gal.length >= 2) cuadros.push({ id: 'galeria', tipo: 'galeria', tam: 'ancho', prioridad: 5, fotos: gal.slice(0, 3), alt: 'Fotos de ' + nombre });
  if (co) cuadros.push({ id: 'mapa', tipo: 'mapa', tam: 'm', prioridad: 6, lat: co.lat, lng: co.lng, lugar: [zona, e.edificio].filter(Boolean).join(' · ') });
  var rec = tvRecepcion_(e.props);
  if (rec) cuadros.push({ id: 'recepcion', tipo: 'dato', tam: 'm', prioridad: 7, k: 'Recepción', v: rec, d: 'Le escribe Alma' });
  var mn = m.manana;
  cuadros.push({ id: 'resumen', tipo: 'resumen', tam: 'm', prioridad: 8, k: 'Mañana',
    texto: !mn.llegan && !mn.salen ? 'Sin llegadas ni salidas.' : [mn.llegan ? cuenta(mn.llegan, 'llegada', 'llegadas') : '', mn.salen ? cuenta(mn.salen, 'salida', 'salidas') : ''].filter(Boolean).join(' y ') + '.' });
  return {
    tipo: 'edificio', clave: 'edificio:' + calpClave_(e.zona + ' ' + e.edificio), ref: e.edificio, etiqueta: 'Edificio' + (zona ? ' · ' + zona : ''),
    titulo: nombre, sub: [zona, N + ' apartamentos'].filter(Boolean).join(' · '), chip: '', tono: '',
    foto: foto, iniciales: tvIniciales_(e.edificio), fechas: [], mensajes: [], promesas: [], semana: [], detalle: [], conv: '', tel: '', wa: '',
    datos: [N + ' apartamentos', nOcup + ' ocupados esta noche', m.llegan.length ? cuenta(m.llegan.length, 'llegada hoy', 'llegadas hoy') : 'Sin llegadas hoy', m.salen.length ? cuenta(m.salen.length, 'salida hoy', 'salidas hoy') : 'Sin salidas hoy'],
    resumen: 'el ' + nombre.charAt(0).toLowerCase() + nombre.slice(1) + ' (apartamentos, llegadas y salidas de hoy)',
    cabeza: nombre, cuadros: cuadros
  };
}
