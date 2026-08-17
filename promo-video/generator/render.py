"""Render film.html frame by frame through Chromium, encode to MP4 with the score."""
import base64, subprocess, sys, os, time
from playwright.sync_api import sync_playwright
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
FF = imageio_ffmpeg.get_ffmpeg_exe()

FPS = 24
DUR = 35.0
OUT = sys.argv[1] if len(sys.argv) > 1 else 'promo_9x16.mp4'
SILENT = '--silent' in sys.argv
W, H = 1080, 1920
for a in sys.argv[2:]:
    if a.startswith('--size='):
        W, H = (int(v) for v in a.split('=')[1].split('x'))
NFRAMES = int(round(DUR * FPS))

cmd = [FF, '-y', '-hide_banner', '-loglevel', 'error',
       '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', str(FPS), '-i', 'pipe:0']
if not SILENT:
    cmd += ['-i', os.path.join(HERE, 'score.wav')]
cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
        '-x264-params', 'keyint=48:min-keyint=24',
        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
        '-movflags', '+faststart', '-r', str(FPS)]
if not SILENT:
    cmd += ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest']
cmd += [OUT]

proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                        stderr=subprocess.PIPE)

t0 = time.time()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME,
                          args=['--no-sandbox', '--disable-gpu',
                                '--force-device-scale-factor=1',
                                '--font-render-hinting=none',
                                '--disable-lcd-text'])
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    pg.goto(f'file://{os.path.join(HERE, "film.html")}?w={W}&h={H}')
    pg.wait_for_function('typeof window.render === "function"')

    for i in range(NFRAMES):
        t = i / FPS
        data = pg.evaluate(
            "(t) => { window.render(t); "
            "return document.getElementById('c').toDataURL('image/jpeg', 0.95); }", t)
        proc.stdin.write(base64.b64decode(data.split(',', 1)[1]))
        if i % 96 == 0:
            el = time.time() - t0
            print(f'  {i:4d}/{NFRAMES}  t={t:5.2f}s  {el:5.1f}s elapsed', flush=True)
    b.close()

proc.stdin.close()
err = proc.stderr.read().decode()
rc = proc.wait()
if rc != 0:
    print('ffmpeg failed:\n' + err); sys.exit(1)
print(f'wrote {OUT} in {time.time()-t0:.1f}s')
