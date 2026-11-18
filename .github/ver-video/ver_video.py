#!/usr/bin/env python3
"""Ver video (Juan, 18-nov-2026): «Tengo que poder compartir un link de TikTok y que tú puedas ver el video, entenderlo».

Corre en el workflow «Ver video» (.github/workflows/ver-video.yml), nunca en el Hub:
  1. trae el video: de una red social con yt-dlp (TikTok, Instagram, Facebook, YouTube, X) o de la carpeta de Drive de
     desarrollo por trozos que da el Hub (la llave de Google nunca sale del Hub);
  2. lo «ve»: fotos clave con su hora, en hojas de contacto de 3 x 3 (ffmpeg + Pillow), y lo escucha: transcripción con
     tiempos (faster-whisper, en el idioma que hable el video);
  3. le entrega todo al Hub (acción verVideo «listo»), que lo guarda en el Drive de alma@ y arma el resumen con Claude.
El repo es público: este script nunca imprime la transcripción, la descripción ni la llave; los registros solo dicen
el paso y el tamaño. Nada de lo que trae queda en el repo ni como artefacto (los artefactos de un repo público se ven).

Uso: ver_video.py  (todo llega por variables de entorno: VV_ID, VV_URL, VV_DRIVE, VV_LLAVE, VV_HUB, VV_COOKIES)
     ver_video.py --solo-procesar <video> <carpeta>   (prueba local: solo fotos y transcripción, sin red)
"""
import base64
import glob
import json
import math
import os
import subprocess
import sys
import time
import urllib.request

MAX_SEG = 25 * 60          # más de 25 min no se procesa (la transcripción en el runner tardaría demasiado)
MAX_FOTOS = 36             # 4 hojas de 3 x 3
POR_HOJA = 9
ALTO_FOTO = 320
MODELO = os.environ.get('VV_MODELO', 'small')
TROZO = 6 * 1024 * 1024    # lo que el Hub entrega por vuelta desde Drive


def log(msg):
    print(msg, flush=True)


def correr(args, **kw):
    return subprocess.run(args, check=True, capture_output=True, **kw)


def sondear(video):
    """Duración, ancho, alto y si tiene audio."""
    out = correr(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', video]).stdout
    j = json.loads(out or b'{}')
    dur = float((j.get('format') or {}).get('duration') or 0)
    v = next((s for s in j.get('streams', []) if s.get('codec_type') == 'video'), {})
    a = any(s.get('codec_type') == 'audio' for s in j.get('streams', []))
    return dur, int(v.get('width') or 0), int(v.get('height') or 0), a


def hora(s):
    s = int(round(s))
    return '%d:%02d' % (s // 60, s % 60) if s < 3600 else '%d:%02d:%02d' % (s // 3600, (s % 3600) // 60, s % 60)


def fotos_clave(video, dur, carpeta):
    """Fotos repartidas en todo el video: una cada ~2,5 s en un video corto, hasta 36 en uno largo. Hojas de 3 x 3 con hora."""
    from PIL import Image, ImageDraw, ImageFont
    n = max(4, min(MAX_FOTOS, int(math.ceil(dur / 2.5)))) if dur > 0 else 1
    tiempos = [min(max(dur - 0.05, 0), (i + 0.5) * dur / n) for i in range(n)] if dur > 0 else [0]
    fotos = []
    for i, t in enumerate(tiempos):
        f = os.path.join(carpeta, 'f%02d.jpg' % i)
        try:
            correr(['ffmpeg', '-v', 'error', '-y', '-ss', '%.2f' % t, '-i', video, '-frames:v', '1', '-vf', 'scale=-2:%d' % ALTO_FOTO, '-q:v', '4', f])
            if os.path.exists(f):
                fotos.append((t, f))
        except subprocess.CalledProcessError:
            pass
    try:
        letra = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    except Exception:
        letra = ImageFont.load_default()
    hojas = []
    for h in range(0, len(fotos), POR_HOJA):
        grupo = fotos[h:h + POR_HOJA]
        ims = [Image.open(f).convert('RGB') for _, f in grupo]
        w = max(im.width for im in ims)
        cols = 3
        filas = int(math.ceil(len(ims) / cols))
        hoja = Image.new('RGB', (cols * w + (cols + 1) * 6, filas * ALTO_FOTO + (filas + 1) * 6), (24, 24, 24))
        d = ImageDraw.Draw(hoja)
        for k, im in enumerate(ims):
            x = 6 + (k % cols) * (w + 6) + (w - im.width) // 2
            y = 6 + (k // cols) * (ALTO_FOTO + 6)
            hoja.paste(im, (x, y))
            etq = hora(grupo[k][0])
            d.rectangle([x, y, x + 12 + 11 * len(etq), y + 26], fill=(0, 0, 0))
            d.text((x + 6, y + 3), etq, fill=(255, 220, 120), font=letra)
        nombre = os.path.join(carpeta, 'hoja_%d.jpg' % (h // POR_HOJA + 1))
        hoja.save(nombre, 'JPEG', quality=72, optimize=True)
        hojas.append({'archivo': nombre, 'desde': round(grupo[0][0], 1), 'hasta': round(grupo[-1][0], 1)})
    return hojas


def transcribir(video):
    """Transcripción con tiempos. El audio lo decodifica ffmpeg (16 kHz, mono) y se le pasa a faster-whisper ya listo."""
    import numpy as np
    from faster_whisper import WhisperModel
    pcm = correr(['ffmpeg', '-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']).stdout
    audio = np.frombuffer(pcm, dtype=np.float32)
    if audio.size < 16000 * 0.5:
        return '', []
    modelo = WhisperModel(MODELO, device='cpu', compute_type='int8')
    segs, info = modelo.transcribe(audio, beam_size=5, vad_filter=True, condition_on_previous_text=False)
    out = [{'i': round(s.start, 1), 'f': round(s.end, 1), 't': s.text.strip()} for s in segs if s.text.strip()]
    return info.language or '', out


def procesar(video, carpeta):
    dur, ancho, alto, con_audio = sondear(video)
    if dur > MAX_SEG:
        raise RuntimeError('el video dura %d min; el tope es %d min' % (dur // 60, MAX_SEG // 60))
    t0 = time.time()
    hojas = fotos_clave(video, dur, carpeta)
    log('Fotos clave: %d hojas en %.0f s' % (len(hojas), time.time() - t0))
    t0 = time.time()
    idioma, segs = transcribir(video) if con_audio else ('', [])
    log('Transcripción: %d frases (%s) en %.0f s' % (len(segs), idioma or 'sin voz', time.time() - t0))
    return {'duracion': round(dur, 1), 'ancho': ancho, 'alto': alto, 'idioma': idioma, 'segmentos': segs, 'hojas': hojas}


# ── Red: el Hub ─────────────────────────────────────────────────────────────────────────────────────────────────────
def hub(cuerpo, espera=300):
    datos = json.dumps(cuerpo).encode('utf-8')
    req = urllib.request.Request(os.environ['VV_HUB'], data=datos, headers={'Content-Type': 'text/plain'})
    with urllib.request.urlopen(req, timeout=espera) as r:   # el 302 de Apps Script se sigue con GET (así responde)
        return json.loads(r.read().decode('utf-8') or '{}')


def traer_drive(vid, destino):
    """El archivo de Drive por trozos: el Hub lo lee con su permiso y solo si está en la carpeta de desarrollo."""
    desde, total, nombre = 0, None, 'video'
    with open(destino, 'wb') as f:
        while total is None or desde < total:
            r = hub({'verVideo': 'trozo', 'llave': os.environ['VV_LLAVE'], 'id': vid, 'desde': desde})
            if not r.get('ok'):
                raise RuntimeError('el Hub no dio el archivo: %s' % str(r.get('error', ''))[:120])
            b = base64.b64decode(r.get('datos') or '')
            if not b:
                raise RuntimeError('el Hub devolvió un trozo vacío')
            f.write(b)
            total, desde, nombre = int(r.get('total') or 0), desde + len(b), r.get('nombre') or nombre
            log('Drive: %d de %d MB' % (desde // 1048576, total // 1048576))
    return {'titulo': nombre, 'plataforma': 'drive'}


def traer_red(url, carpeta):
    """yt-dlp con el mejor formato hasta 720p (con audio), sin listas. Cookies solo si Juan cargó el secreto."""
    args = [sys.executable, '-m', 'yt_dlp', '--no-playlist', '--no-progress', '--quiet', '--no-warnings',
            '-f', 'bv*[height<=720]+ba/b[height<=720]/bv*+ba/b', '--merge-output-format', 'mp4',
            '--max-filesize', '400M', '--write-info-json', '-o', os.path.join(carpeta, 'video.%(ext)s'), url]
    cookies = os.environ.get('VV_COOKIES', '').strip()
    if cookies:
        ruta = os.path.join(carpeta, '..', 'cookies.txt')
        with open(ruta, 'w') as f:
            f.write(cookies + '\n')
        args[3:3] = ['--cookies', ruta]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        err = (r.stderr or '').strip().splitlines()
        motivo = next((l for l in reversed(err) if 'ERROR' in l), err[-1] if err else 'sin detalle')
        raise RuntimeError(motivo.replace('ERROR: ', '')[:300])
    info = {}
    for p in glob.glob(os.path.join(carpeta, 'video*.info.json')):
        with open(p) as f:
            info = json.load(f)
    videos = [p for p in glob.glob(os.path.join(carpeta, 'video.*')) if not p.endswith('.json')]
    if not videos:
        raise RuntimeError('yt-dlp no dejó ningún video')
    meta = {'titulo': info.get('title') or '', 'autor': info.get('uploader') or info.get('channel') or '',
            'plataforma': (info.get('extractor_key') or info.get('extractor') or '').lower(),
            'descripcion': (info.get('description') or '')[:2000], 'fecha': info.get('upload_date') or '',
            'vistas': info.get('view_count'), 'likes': info.get('like_count'), 'url': info.get('webpage_url') or url}
    return videos[0], meta


def main():
    vid, url, drive = os.environ.get('VV_ID', ''), os.environ.get('VV_URL', '').strip(), os.environ.get('VV_DRIVE', '').strip()
    carpeta = os.path.abspath('vv/trabajo')
    os.makedirs(carpeta, exist_ok=True)
    base = {'verVideo': 'listo', 'llave': os.environ['VV_LLAVE'], 'id': vid}
    try:
        if drive:
            video = os.path.join(carpeta, 'video.bin')
            meta = traer_drive(drive, video)
        elif url:
            video, meta = traer_red(url, carpeta)
        else:
            raise RuntimeError('falta el enlace o el archivo de Drive')
        log('Video: %.1f MB' % (os.path.getsize(video) / 1048576))
        res = procesar(video, carpeta)
    except Exception as e:
        log('No se pudo: %s' % str(e)[:300])
        r = hub(dict(base, error=str(e)[:400]))
        log('Hub: ok=%s' % r.get('ok'))
        sys.exit(1)
    hojas = []
    for h in res.pop('hojas'):
        with open(h['archivo'], 'rb') as f:
            hojas.append({'desde': h['desde'], 'hasta': h['hasta'], 'jpg': base64.b64encode(f.read()).decode('ascii')})
    cuerpo = dict(base, meta=meta, resultado=res, hojas=hojas)
    log('Entregando al Hub: %d KB' % (len(json.dumps(cuerpo)) // 1024))
    r = hub(cuerpo, espera=360)
    log('Hub: ok=%s %s' % (r.get('ok'), str(r.get('error') or '')[:160]))
    if not r.get('ok'):
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--solo-procesar':
        os.makedirs(sys.argv[3], exist_ok=True)
        res = procesar(sys.argv[2], sys.argv[3])
        print(json.dumps({k: v for k, v in res.items() if k != 'segmentos'}, ensure_ascii=False))
        print(json.dumps(res['segmentos'][:5], ensure_ascii=False))
    else:
        main()
