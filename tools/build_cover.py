#!/usr/bin/env python3
"""Build the People PPL cover loop from the travel clips.

  python3 tools/build_cover.py <folder with the .MOV clips> ppl/assets [--reuse]

Edit CLIPS to change the cut. Each shot dissolves into the next and the last one
dissolves back into the first, so the loop has no visible seam. The first frame of
the result is also saved as the poster the page shows before the video plays.
Needs ffmpeg with libx264, libvpx-vp9 and libwebp. --reuse skips the edit and only
re-encodes from the masters of a previous run."""
import os
import subprocess
import sys

# (file, start in seconds, horizontal centre of the portrait crop: 0 left .. 1 right)
CLIPS = [
    ('IMG_1058.MOV', 1.0, 0.45),   # Japan: lake reflecting the peaks
    ('IMG_1418.MOV', 1.6, 0.60),   # Japan: garden pond and stone lantern
    ('IMG_0782.MOV', 2.0, 0.55),   # Japan: macaque in the grass
    ('IMG_4587.MOV', 3.6, 0.55),   # Japan: whale shark
    ('IMG_5932.MOV', 0.1, 0.50),   # China: peaks under a broken sky
    ('IMG_6367.MOV', 7.6, 0.50),   # China: mist over the forest
    ('IMG_6369.MOV', 0.4, 0.70),   # China: temple eaves above the clouds
    ('IMG_5540.MOV', 0.2, 0.35),   # China: towers
]
SHOT = 3.6    # seconds each shot is taken for, dissolves included
X = 0.8       # dissolve length, seconds
FPS = 25
# name: (width, height, mp4 bitrate cap, webm target), bitrates in kbit/s
OUTPUTS = {
    'cover': (1920, 1080, 3600, 2600),
    'cover-v': (720, 1280, 1500, 1100),
}

src, out = sys.argv[1], sys.argv[2]
REUSE = '--reuse' in sys.argv
work = os.environ.get('COVER_WORK', '/tmp/ppl-cover')
os.makedirs(work, exist_ok=True)


def run(*a):
    subprocess.run(a, check=True)


def master(name, w, h):
    """Near-lossless master at w x h with every dissolve applied and the loop closed."""
    m = os.path.join(work, name + '-master.mkv')
    if REUSE and os.path.exists(m):
        return m
    # the head of the first shot is appended so the last shot has something to dissolve into
    seq = [(f, s, c, SHOT) for f, s, c in CLIPS] + [(CLIPS[0][0], CLIPS[0][1], CLIPS[0][2], X)]
    ins, f = [], []
    for i, (p, s, c, d) in enumerate(seq):
        ins += ['-ss', str(s), '-t', str(d + 0.2), '-i', os.path.join(src, p)]
        f.append(f'[{i}:v]fps={FPS},trim=duration={d},setpts=PTS-STARTPTS,'
                 f'scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,'
                 f'crop={w}:{h}:(iw-{w})*{c}:(ih-{h})/2,setsar=1,format=yuv420p[v{i}]')
    cur, t = 'v0', seq[0][3]
    for i in range(1, len(seq)):
        f.append(f'[{cur}][v{i}]xfade=transition=fade:duration={X}:offset={t - X:.3f}[x{i}]')
        cur, t = f'x{i}', t + seq[i][3] - X
    # the closing dissolve already shows the first X seconds, so the loop starts after them
    f.append(f'[{cur}]trim=start={X},setpts=PTS-STARTPTS[o]')
    run('ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(f), '-map', '[o]', '-an',
        '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', m)
    return m


for name, (w, h, mp4k, webmk) in OUTPUTS.items():
    m = master(name, w, h)
    run('ffmpeg', '-v', 'error', '-y', '-i', m, '-an', '-c:v', 'libx264', '-crf', '21',
        '-maxrate', f'{mp4k}k', '-bufsize', f'{mp4k * 2}k', '-preset', 'slower', '-profile:v', 'high',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', f'{out}/{name}.mp4')
    for n in ('1', '2'):
        dest = ['-f', 'null', '/dev/null'] if n == '1' else [f'{out}/{name}.webm']
        run('ffmpeg', '-v', 'error', '-y', '-i', m, '-an', '-c:v', 'libvpx-vp9', '-b:v', f'{webmk}k',
            '-row-mt', '1', '-cpu-used', '2', '-pass', n, '-passlogfile', os.path.join(work, name), *dest)
    run('ffmpeg', '-v', 'error', '-y', '-i', m, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82',
        f'{out}/{name}-poster.webp')
    print(name, 'done')
