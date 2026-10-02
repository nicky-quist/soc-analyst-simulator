"""Builds docs/img/tour.gif from the frames scripts/capture-docs.mjs saves.

    python scripts/make-tour-gif.py

Each frame gets a one-line caption, is scaled to a README-friendly width, and is
held for a couple of seconds, so nine frames make a clip of about twenty seconds.
Needs Pillow.
"""

import glob
import os

from PIL import Image, ImageDraw, ImageFont

FRAMES = 'docs/img/frames'
OUT = 'docs/img/tour.gif'
WIDTH = 1000
CAPTION_H = 48
HOLD_MS = 2200
COLORS = 128

# Story order
STORY = [
    ('dashboard', 'The shift at a glance'),
    ('case-overview', 'Work a real queue: seven alerts, SLA clocks running'),
    ('investigate', 'Investigate by typing your own searches'),
    ('respond-harm', 'Take a wrong action and the console answers back'),
    ('debrief', 'Get graded, with the answer explained'),
    ('redops', 'Play the attacker while the SOC reacts to every move'),
    ('fast-triage', 'Triage twenty alerts against the clock'),
    ('leaderboard', 'Climb four boards: Blue, Red, Fast Triage, Secrets'),
    ('shift-report', 'End the shift with a report card'),
]


def font(size):
    for path in ('C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def find(name):
    matches = glob.glob(f'{FRAMES}/*-{name}.png')
    if not matches:
        raise SystemExit(f'missing frame for {name}: run scripts/capture-docs.mjs first')
    return matches[0]


def build():
    caption_font = font(22)
    frames = []
    for index, (name, caption) in enumerate(STORY, start=1):
        shot = Image.open(find(name)).convert('RGB')
        height = round(shot.height * WIDTH / shot.width)
        shot = shot.resize((WIDTH, height), Image.LANCZOS)

        canvas = Image.new('RGB', (WIDTH, height + CAPTION_H), (15, 24, 37))
        canvas.paste(shot, (0, 0))
        draw = ImageDraw.Draw(canvas)
        label = f'{index}/{len(STORY)}  {caption}'
        box = draw.textbbox((0, 0), label, font=caption_font)
        draw.text(((WIDTH - (box[2] - box[0])) / 2, height + (CAPTION_H - (box[3] - box[1])) / 2 - box[1]),
                  label, font=caption_font, fill=(232, 238, 248))
        frames.append(canvas.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))

    frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=HOLD_MS, loop=0, optimize=True, disposal=1)
    size = os.path.getsize(OUT) / 1_000_000
    print(f'{OUT}: {len(frames)} frames, {WIDTH}x{frames[0].height}, {size:.1f} MB, about {len(frames) * HOLD_MS / 1000:.0f}s')


if __name__ == '__main__':
    build()
