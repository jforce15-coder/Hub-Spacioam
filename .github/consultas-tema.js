/* Prueba de consultas_tema (apps-script/consultastema.js) con dobles: sin hojas ni Google.
   19-nov-2026 (#913): Juan preguntó qué % de las consultas de Mónaco necesita parqueo y Alma no tenía el conteo.
   1. Cuenta las consultas de la propiedad por el día de su primer mensaje (30 y 60 días) y su porcentaje.
   2. Solo los mensajes del huésped cuentan (nuestro mensaje con «parqueo» no la vuelve consulta con tema).
   3. Las que ya reservaron (su conv_id pasó al de la reserva) también cuentan y se dicen aparte.
   4. Parqueo, estacionamiento, parking, garaje… sin tildes ni mayúsculas; «parquet» no cuenta.
   5. Sin teléfonos ni correos en los pedacitos; una propiedad sin consultas da error y no estima.
   6. Solo el administrador principal; la herramienta está en el chat y en el camino rápido.
   node .github/consultas-tema.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const ctx = { console, CFG: { TZ: 'America/Guatemala' }, Utilities: { formatDate: d => d.toISOString().slice(0, 10) },
  isoDe_: v => { const t = Date.parse(String(v)); return isNaN(t) ? '' : new Date(t).toISOString(); },
  esAdminPrincipal_: a => !!(a && a.principal), INBOX_CAB_: ['conv_id', 'propiedad', 'huesped'] };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(DIR, 'consultastema.js'), 'utf8'), ctx);
const HOY = Date.parse('2026-11-19T12:00:00Z'), dia = n => new Date(HOY - n * 864e5).toISOString();
const inbox = [{ conv_id: 'inq:a', propiedad: 'Mónaco 1203', huesped: 'Ana Pérez' }, { conv_id: 'inq:b', propiedad: 'Monaco 905', huesped: 'Beto' },
  { conv_id: 'res-c', propiedad: 'MONACO 1203', huesped: 'Carla' }, { conv_id: 'inq:d', propiedad: 'Monaco 905', huesped: 'Dan' },
  { conv_id: 'inq:e', propiedad: 'Narama 725', huesped: 'Eva' }, { conv_id: 'inq:f', propiedad: 'Monaco 1203', huesped: 'Fer' }];
const msg = [
  { conv_id: 'inq:a', created: dia(5), tipo: 'guest', texto: 'Hola, ¿tienen PARQUEO? escríbeme a ana@x.com o +502 5555 1234' },
  { conv_id: 'inq:b', created: dia(10), tipo: 'guest', texto: 'Hola, ¿está disponible?' },
  { conv_id: 'inq:b', created: dia(10), tipo: 'host', texto: 'Sí, y el edificio tiene parqueo limitado.' },
  { conv_id: 'res-c', created: dia(40), tipo: 'guest', texto: 'Vamos en carro, ¿hay estacionamiento?' },
  { conv_id: 'inq:d', created: dia(45), tipo: 'guest', texto: 'Me gusta el piso de parquet' },
  { conv_id: 'inq:e', created: dia(3), tipo: 'guest', texto: 'parking?' },
  { conv_id: 'inq:f', created: dia(90), tipo: 'guest', texto: 'parking please' },
  { conv_id: 'inq:f', created: dia(2), tipo: 'guest', texto: 'still interested' }];
const r = ctx.ctemaContar_(msg, inbox, 'Mónaco', '', [30, 60], HOY);
const p30 = r.periodos[0], p60 = r.periodos[1];
ok(r.ok && p30.consultas === 2 && p30.con_tema === 1 && p30.porcentaje === '50 %', '1 · 30 días: 1 de 2 consultas de Mónaco (50 %) (' + JSON.stringify(p30 && [p30.consultas, p30.con_tema, p30.porcentaje]) + ')');
ok(p60.consultas === 4 && p60.con_tema === 2 && p60.porcentaje === '50 %', '1 · 60 días: 2 de 4, por el día del primer mensaje (la de hace 90 días no entra)');
ok(!p30.mensajes.some(m => m.quien === 'Beto'), '2 · nuestro mensaje con «parqueo» no cuenta');
ok(/^1 de 2/.test(p60.reservaron), '3 · la que ya reservó cuenta y se dice aparte (' + p60.reservaron + ')');
ok(!p60.mensajes.some(m => m.quien === 'Dan') && p60.mensajes.some(m => m.quien === 'Carla'), '4 · estacionamiento cuenta; parquet no');
ok(!/@|5555/.test(JSON.stringify(r)) && p30.mensajes[0].quien === 'Ana', '5 · sin correos ni teléfonos y solo el primer nombre');
const n = ctx.ctemaContar_(msg, inbox, 'Brunelo', '', [30], HOY);
ok(!n.ok && /No lo estimes/.test(n.error), '5 · sin consultas de esa propiedad: error, sin estimar');
ok(!ctx.consultasTema_({ principal: false }, { propiedad: 'Mónaco' }).ok, '6 · solo el administrador principal');
const ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8'), rap = fs.readFileSync(path.join(DIR, 'rapido.js'), 'utf8');
ok(/T\('consultas_tema'/.test(ag) && /case 'consultas_tema': return consultasTema_\(adm, inp\)/.test(ag) && /'consultas_tema'/.test(rap), '6 · la herramienta está en el chat y en el camino rápido');
process.exit(fallo);
