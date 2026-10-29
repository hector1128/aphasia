"""Regenerate individual rating cards from the supplied artwork (requires Pillow).

Run: python3 scripts/crop-ratings.py
The browser loads these crops directly, avoiding SVG sheet-clipping differences.
"""
from pathlib import Path
from PIL import Image

ratings = Path(__file__).resolve().parents[1] / "public" / "ratings"
for kind in ("importance", "enjoyment"):
    sheet = Image.open(ratings / f"{kind}.png")
    target = ratings / kind
    target.mkdir(exist_ok=True)
    for score in range(11):
        source = sheet
        top = score < 6
        if kind == "importance" and score == 6:
            source = Image.open(ratings / "importance-6.png")
            x, y, width, height = 136, 120, 814, 1116
        elif kind == "importance":
            xs = [33, 267, 495, 725, 956, 1192] if top else [33, 286, 546, 812, 1101]
            widths = [221, 217, 219, 222, 225, 225] if top else [243, 249, 256, 280, 317]
            index = score if top else score - 6
            x, y, width, height = xs[index], 93 if top else 556, widths[index], 354 if top else 384
        else:
            cell_width = sheet.width / (6 if top else 5)
            x, y = (score if top else score - 6) * cell_width + 12, 100 if top else 548
            width, height = cell_width - 24, 300 if top else 320
        assert 0 <= x < x + width <= source.width
        assert 0 <= y < y + height <= source.height
        card = source.crop(tuple(round(v) for v in (x, y, x + width, y + height)))
        card.thumbnail((280, 280), Image.Resampling.LANCZOS)
        card.save(target / f"{score}.png", optimize=True)
