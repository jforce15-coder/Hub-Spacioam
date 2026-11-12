/* Prueba de grow_presupuesto_pdf (apps-script/growpresupuesto.js) con dobles: sin Grow, WhatsApp ni red.
   6-nov-2026: Juan pidió el equipamiento de MONACO como un presupuesto por apartamento (B5, A4, A1, B1, A3, B3) y los PDF
   para el correo a Casa Sol.
   1. Con hoja y aptos: Grow importa (presupuesto_importar) y después sale un PDF por presupuesto, de a una llamada, más el
      consolidado; cada uno a WhatsApp de Juan y con su enlace y drive_id. El PDF no vuelve al modelo.
   2. Otra vez: Grow dice que ya existían; no se cuentan como nuevos y salen sus PDF igual.
   3. Sin aptos ni hoja: el PDF del activo, como antes.
   4. Con la ventana de WhatsApp cerrada no insiste con los demás; solo el administrador principal.
   node .github/grow-presupuesto.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const SEIS = ['B5', 'A4', 'A1', 'B1', 'A3', 'B3'], PID = 'p1788381685478';
function caja(o) {
  o = o || {};
  const llamadas = [], wa = [], existentes = {};
  const grow = (op, d) => {
    llamadas.push({ op, d });
    if (op === 'presupuesto_importar') {
      const aptos = d.aptos.split(/[,;]+|\s+y\s+/).map(x => x.trim()).filter(Boolean), creados = [], ya = [];
      aptos.forEach(a => { const x = { id: 'pr-' + a, nombre: 'Equipamiento ' + a, apto: a, total: 'Q 20,582' }; (existentes[a] ? ya : creados).push(x); existentes[a] = 1; });
      return { ok: true, proyecto: 'MONACO', id: PID, creados, ya_existian: ya, por_apto: 'Q 20,582', total_creados: creados.length ? 'Q ' + (creados.length * 20581.63).toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'Q 0',
        presupuesto_ids: creados.concat(ya).map(x => x.id), avisos: ['Baños: la hoja dice Q 2,040 y sus ítems suman Q 2,110. Entran los ítems tal cual.'], plantilla: { items: 44 } };
    }
    if (op === 'presupuesto_pdf') {
      if (d.solo_consolidado) return { ok: true, proyecto: 'MONACO', id: PID, pdfs: [], consolidado: { nombre: 'Presupuesto consolidado MONACO Fase 2.pdf', total: 'Q 123,490', fase: 'Fase 2', url: 'https://drive.google.com/file/d/CONS/view', file_id: 'CONS', compartido: true, pdf_b64: 'JVBERi0x' } };
      const id = d.presupuesto_ids || (d.aptos ? 'pr-' + d.aptos : '');
      if (!id) return { ok: true, proyecto: 'MONACO', id: PID, presupuesto: 'Presupuesto general', items: 1, total: 'Q 9,900', estado: 'Confirmado', resumen: [], nombre: 'Presupuesto MONACO.pdf', url: 'https://drive.google.com/file/d/GENxxxxxxxxxxxx/view', compartido: true, pdf_b64: 'JVBERi0x' };
      const a = id.replace('pr-', '');
      return { ok: true, proyecto: 'MONACO', id: PID, pdfs: [{ presupuesto_id: id, presupuesto: 'Equipamiento ' + a, apto: a, total: 'Q 20,582', nombre: 'Presupuesto MONACO Equipamiento ' + a + '.pdf', url: 'https://drive.google.com/file/d/D' + a + '/view', file_id: 'D' + a, compartido: true, pdf_b64: 'JVBERi0x' }] };
    }
    return { ok: false, error: 'op' };
  };
  const ctx = {
    console, JSON, Date, Math, String, Number, Object, Array, RegExp,
    esAdminPrincipal_: a => !!(a && a.principal), growApi_: grow,
    acortar_: u => 'https://hub.spacioam.com/c' + String(u).replace(/[^A-Za-z0-9]/g, '').slice(-4).toLowerCase(),   // el corto de mentira (enlaces.js)
    waEnviarDocumento_: (tel, blob, leyenda) => { wa.push({ tel, nombre: blob.nombre, leyenda }); return o.ventanaCerrada ? { ok: false, error: 'ventana', detalle: 'Pasaron más de 24 h' } : { ok: true }; },
    Utilities: { base64Decode: s => Buffer.from(s, 'base64'), newBlob: (b, mime, nombre) => ({ mime, nombre }) }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'growpresupuesto.js'), 'utf8'), ctx, { filename: 'growpresupuesto.js' });
  return { llamadas, wa, R: (inp, adm) => { const hechas = []; const r = ctx.growPresupuestoPdf_(adm || JUAN, inp, { hechas }); r._hechas = hechas; return r; } };
}
const JUAN = { nombre: 'Juan', principal: true, tels: ['50200000000'] };
const PEDIDO = { proyecto_id: 'MONACO', aptos: 'B5, A4, A1, B1, A3 y B3', hoja: 'Presupuesto edificio Mónaco Fase 2', pestana: 'Equipamiento apartamento monaco', consolidado: true };

/* ── 1 y 2 ── */
{
  const c = caja(), r = c.R(PEDIDO), ops = c.llamadas.map(x => x.op);
  ok(ops[0] === 'presupuesto_importar' && c.llamadas[0].d.por === 'Juan' && ops.filter(x => x === 'presupuesto_pdf').length === 7, 'importa primero y después 7 llamadas a presupuesto_pdf (6 + consolidado), un PDF por llamada');
  ok(c.llamadas.slice(1, 7).map(x => x.d.presupuesto_ids).join() === SEIS.map(a => 'pr-' + a).join() && c.llamadas[7].d.solo_consolidado && c.llamadas[7].d.presupuesto_ids.length === 6, 'los PDF son de los 6 presupuestos importados, y el consolidado de esos 6');
  ok(r.ok && r.pdfs.length === 6 && r.pdfs.every(p => /^D[AB]\d$/.test(p.drive_id) && p.url && p.total === 'Q 20,582') && r.consolidado.drive_id === 'CONS' && r.consolidado.total === 'Q 123,490', 'vuelven 6 enlaces con su drive_id y el consolidado (Q 123,490)');
  ok(c.wa.length === 7 && r.whatsapp === 'enviados los 7' && /Equipamiento B5 · Q 20,582/.test(c.wa[0].leyenda) && /Consolidado Fase 2/.test(c.wa[6].leyenda), 'los 7 PDF a WhatsApp de Juan, cada uno con su nombre y total');
  ok(!JSON.stringify(r).includes('JVBERi0x'), 'el PDF no vuelve al modelo (solo enlaces)');
  ok(r.pdfs.concat(r.consolidado).every(p => /^https:\/\/hub\.spacioam\.com\/c\w{4}$/.test(p.url)) && !JSON.stringify(r).includes('drive.google.com'), 'los enlaces vuelven cortos (hub.spacioam.com/<código>) y el drive_id sigue siendo el del archivo');
  ok(r.importados.creados.length === 6 && /Baños/.test(r.importados.avisos[0]) && /drive_id/.test(r.para_correo) && r._hechas.length === 2, 'dice los 6 creados, el aviso de Baños y cómo adjuntarlos al correo');
  const r2 = c.R(PEDIDO);
  ok(r2.ok && r2.importados.creados.length === 0 && r2.importados.ya_existian.length === 6 && r2.pdfs.length === 6 && r2._hechas.length === 1, 'otra vez: ya existían los 6 (nada nuevo) y salen sus PDF');
}
/* ── 3. Como antes ── */
{
  const c = caja(), r = c.R({ proyecto_id: PID });
  ok(c.llamadas.length === 1 && r.ok && r.total === 'Q 9,900' && r.url && r.drive_id === 'GENxxxxxxxxxxxx' && !r.pdfs && r.whatsapp === 'enviado', 'sin aptos ni hoja: el activo, una llamada, con su enlace y drive_id');
  const s = caja(), ra = s.R({ proyecto_id: PID, aptos: 'B5 y A4' });
  ok(s.llamadas.length === 2 && s.llamadas.every(x => x.op === 'presupuesto_pdf' && x.d.aptos) && ra.pdfs.length === 2 && !ra.consolidado, 'con aptos y sin hoja: no importa, un PDF por apartamento');
}
/* ── 4 ── */
{
  const c = caja({ ventanaCerrada: true }), r = c.R(PEDIDO);
  ok(r.ok && c.wa.length === 1 && /24 h/.test(r.whatsapp) && r.pdfs.length === 6, 'con la ventana de 24 h cerrada: un intento, lo dice y vuelven los enlaces');
  const e = caja().R(PEDIDO, { nombre: 'Flor', principal: false });
  ok(e.ok === false && /administrador principal/.test(e.error), 'solo el administrador principal');
  const f = caja().R({ proyecto_id: PID, hoja: 'x' });
  ok(f.ok === false && /aptos/.test(f.error), 'hoja sin aptos lo pide');
}
process.exit(fallo);
