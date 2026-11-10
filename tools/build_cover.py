#!/usr/bin/env python3
"""Build the People PPL cover loop.
Edit CLIPS (file, start seconds, duration seconds), then run:
  python3 build_cover.py <repo>/ppl/assets
Clips dissolve into each other and the last one dissolves back into the first, so the loop has no cut."""
import subprocess, sys, os
U = '/root/.claude/uploads/be6b6a9b-1149-586e-bb57-59ab0707f764/'
CLIPS = [
    (U + '4e7a156e-IMG_1418.MOV', 0.0, 7.0),
]
X = 1.0      # dissolve length, seconds
FPS = 25
BITRATE = {'cover': (4200, 3000), 'cover-v': (3200, 2300)}   # kbit/s: (mp4 cap, webm target)
REUSE = '--reuse' in sys.argv   # re-encode from the existing masters
out = sys.argv[1]
work = os.environ.get('COVER_WORK', '/tmp/ppl-cover')
os.makedirs(work, exist_ok=True)

def run(*a):
    print(' '.join(a)[:200]); subprocess.run(a, check=True)

def master(name, w, h):
    """Lossless-ish master at w x h with every dissolve applied and the loop closed."""
    seq = CLIPS + [(CLIPS[0][0], CLIPS[0][1], X)]          # head of clip 1 again, to dissolve into
    ins, f = [], []
    for i, (p, s, d) in enumerate(seq):
        ins += ['-ss', str(s), '-t', str(d), '-i', p]
        f.append(f'[{i}:v]fps={FPS},scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v{i}]')
    cur, t = 'v0', seq[0][2]
    for i in range(1, len(seq)):
        f.append(f'[{cur}][v{i}]xfade=transition=fade:duration={X}:offset={t - X}[x{i}]')
        cur, t = f'x{i}', t + seq[i][2] - X
    # the first X seconds are replayed by the closing dissolve, so drop them
    f.append(f'[{cur}]trim=start={X},setpts=PTS-STARTPTS[o]')
    m = os.path.join(work, name + '-master.mkv')
    if REUSE and os.path.exists(m): return m
    run('ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(f), '-map', '[o]', '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', m)
    return m

for name, w, h in [('cover', 1920, 1080), ('cover-v', 1080, 1920)]:
    m = master(name, w, h)
    kb = BITRATE[name]
    run('ffmpeg', '-v', 'error', '-y', '-i', m, '-an', '-c:v', 'libx264', '-crf', '21', '-maxrate', f'{kb[0]}k', '-bufsize', f'{kb[0]*2}k', '-preset', 'slower', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', f'{out}/{name}.mp4')
    for n in ('1', '2'):
        run('ffmpeg', '-v', 'error', '-y', '-i', m, '-an', '-c:v', 'libvpx-vp9', '-b:v', f'{kb[1]}k', '-row-mt', '1', '-cpu-used', '2', '-pass', n, '-passlogfile', os.path.join(work, name), *(['-f', 'null', '/dev/null'] if n == '1' else [f'{out}/{name}.webm']))
    run('ffmpeg', '-v', 'error', '-y', '-i', m, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', f'{out}/{name}-poster.webp')
