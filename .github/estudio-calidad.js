/* Mini estudio (Juan, 19-nov-2026): la revisión de cada toma, con señales sintéticas (sin micrófono ni navegador).
   Una «voz» falsa (tonos con sílabas de 180 ms y pausas), con ruido, recortada, baja, cortada al inicio o al final, corta;
   el silencio del cuarto limpio y ruidoso; el WAV de 24 bit; y el Hub (apps-script/estudio.js) con dobles de Drive.
   node .github/estudio-calidad.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const RAIZ = path.join(__dirname, '..'), DIR = process.argv[2] || path.join(RAIZ, 'apps-script');
const C = require(path.join(RAIZ, 'js', 'estudio-calidad.js'));
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const HZ = 48000;
let semilla = 7; const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647 - 0.5; };
/* silencio(s) + voz(s) + silencio(s): la voz son sílabas de 180 ms con 70 ms entre ellas y una pausa de 0,6 s cada 8. */
function senal({ antes = 0.8, habla = 6, despues = 0.8, pico = 0.35, ruido = 0.0003, hueco = 0 } = {}) {
  const n = Math.round((antes + habla + hueco + despues) * HZ), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = azar() * 2 * ruido;
  let t = antes, k = 0;
  while (t < antes + habla + hueco - 0.18) {
    if (hueco && t >= antes + habla / 2 && t < antes + habla / 2 + hueco) { t = antes + habla / 2 + hueco; continue; }
    const a = Math.round(t * HZ), b = Math.round((t + 0.18) * HZ), f = 160 + 60 * Math.sin(k);
    for (let i = a; i < b && i < n; i++) { const env = Math.sin(Math.PI * (i - a) / (b - a)); x[i] += pico * env * (0.7 * Math.sin(2 * Math.PI * f * i / HZ) + 0.3 * Math.sin(2 * Math.PI * 3 * f * i / HZ)); }
    t += 0.25; k++; if (k % 8 === 0) t += 0.6;
  }
  return x;
}
const claves = r => r.problemas.map(p => p.clave);
const sala = C.analizarSala(senal({ antes: 10, habla: 0, despues: 0 }), HZ);
ok(sala.estado === 'verde' && sala.m.ruido < -60, 'Silencio de cuarto limpio: verde (' + sala.m.ruido + ' dBFS)');
const salaR = C.analizarSala(senal({ antes: 10, habla: 0, despues: 0, ruido: 0.02 }), HZ);
ok(salaR.estado === 'rojo' && claves(salaR).includes('ruido'), 'Cuarto ruidoso: rojo «ruido» (' + salaR.m.ruido + ' dBFS)');
ok(C.analizarSala(senal({ antes: 4, habla: 0, despues: 0 }), HZ).estado === 'rojo', 'Silencio de 4 s en vez de 10: rojo');
const base = { ruidoSala: sala.m.ruido, esperado: 6 };
const bien = C.analizarToma(senal(), HZ, base);
ok(bien.estado === 'verde', 'Toma limpia a −12 dBFS: verde ' + JSON.stringify(bien.m) + ' ' + claves(bien));
const rec = senal({ pico: 1.6 }).map(v => Math.max(-1, Math.min(1, v)));
ok(C.analizarToma(rec, HZ, base).estado === 'rojo' && claves(C.analizarToma(rec, HZ, base)).includes('recorte'), 'Toma recortada (clipping): rojo «recorte»');
const casi = C.analizarToma(senal({ pico: 1.3 }), HZ, base);
ok(casi.estado === 'amarillo' && claves(casi).includes('casi'), 'Pico sobre −1 dBFS sin recortar: amarillo «casi» (' + casi.m.pico + ')');
const baja = C.analizarToma(senal({ pico: 0.03, ruido: 0.00003 }), HZ, { esperado: 6 });
ok(baja.estado === 'rojo' && claves(baja).includes('bajo'), 'Toma a −30 dBFS: rojo «bajo»');
const ruidosa = C.analizarToma(senal({ ruido: 0.03 }), HZ, base);
ok(ruidosa.estado === 'rojo' && claves(ruidosa).includes('snr'), 'Voz con mucho ruido: rojo «snr» (' + ruidosa.m.snr + ' dB)');
ok(claves(ruidosa).includes('ruidonuevo'), 'El ruido que no estaba en el silencio del cuarto se avisa');
const pronto = C.analizarToma(senal({ antes: 0.05 }), HZ, base);
ok(claves(pronto).includes('inicio') && pronto.estado !== 'verde', 'Habló antes de tiempo: amarillo «inicio»');
const corto = C.analizarToma(senal({ despues: 0.05 }), HZ, base);
ok(claves(corto).includes('fin'), 'Paró antes de terminar: amarillo «fin»');
const faltan = C.analizarToma(senal({ habla: 2 }), HZ, { ruidoSala: sala.m.ruido, esperado: 12 });
ok(faltan.estado === 'rojo' && claves(faltan).includes('corta'), 'Toma demasiado corta para su texto: rojo «corta»');
const muda = C.analizarToma(senal({ habla: 0, antes: 3 }), HZ, base);
ok(muda.estado === 'rojo' && claves(muda).includes('sinvoz'), 'Sin voz: rojo «sinvoz»');
const hueco = C.analizarToma(senal({ hueco: 7 }), HZ, { ruidoSala: sala.m.ruido, esperado: 13 });
ok(claves(hueco).includes('hueco'), 'Silencio largo en medio: amarillo «hueco»');
const w = C.wav24(new Float32Array([0, 1, -1, 0.5]), HZ), dv = new DataView(w.buffer);
ok(String.fromCharCode(...w.slice(0, 4)) === 'RIFF' && dv.getUint16(20, true) === 1 && dv.getUint16(34, true) === 24 && dv.getUint32(24, true) === 48000 && w.length === 44 + 12,
  'WAV PCM mono 24 bit a 48 kHz, sin compresión');
ok(w[47] === 0xff && w[48] === 0xff && w[49] === 0x7f && w[50] === 0 && w[51] === 0 && w[52] === 0x80, 'El máximo y el mínimo se guardan como +8388607 y −8388608');
ok(C.zona(-9) === 'verde' && C.zona(-4) === 'amarillo' && C.zona(-1) === 'rojo' && C.zona(-30) === 'amarillo', 'Zonas del medidor: verde −18…−6, amarilla, roja desde −3');
module.exports = { ok, fallo: () => fallo };
if (require.main === module) {
  const hub = path.join(__dirname, 'estudio-hub.js');
  if (fs.existsSync(hub)) require(hub)(DIR, ok);
  process.exit(fallo);
}
