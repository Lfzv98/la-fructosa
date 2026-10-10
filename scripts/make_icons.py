"""Regenera los íconos PWA de La Fructosa con fondo azul pastel."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"

AZUL = (160, 196, 255, 255)  # #A0C4FF
FRUTA = (245, 165, 65, 255)  # naranja de la marca
HOJA = (168, 213, 162, 255)  # verde pastel (hoja)
TECHO = (247, 250, 255, 255)  # #F7FAFF


def draw_mark(draw: ImageDraw.ImageDraw, cx: float, cy: float, fruit_r: float) -> None:
    """Dibuja techo + fruta + hoja. (cx, cy) es el centro de la fruta."""
    draw.ellipse([cx - fruit_r, cy - fruit_r, cx + fruit_r, cy + fruit_r], fill=FRUTA)

    # Hoja pequeña sobre el borde superior derecho, como el ícono original.
    leaf_r = fruit_r * 0.16
    lx = cx + fruit_r * 0.18
    ly = cy - fruit_r * 0.92
    draw.ellipse([lx - leaf_r, ly - leaf_r, lx + leaf_r, ly + leaf_r], fill=HOJA)

    stroke = max(4, int(round(fruit_r * 0.16)))
    apex_y = cy - fruit_r * 1.55
    roof_y = cy - fruit_r * 1.08
    half_w = fruit_r * 1.05
    draw.line(
        [(cx - half_w, roof_y), (cx, apex_y), (cx + half_w, roof_y)],
        fill=TECHO,
        width=stroke,
        joint="curve",
    )
    cap = stroke / 2
    for x, y in ((cx - half_w, roof_y), (cx, apex_y), (cx + half_w, roof_y)):
        draw.ellipse([x - cap, y - cap, x + cap, y + cap], fill=TECHO)


def make_icon(size: int, *, rounded: bool, fruit_ratio: float, y_shift: float = 0.06) -> Image.Image:
    scale = 4
    canvas = size * scale
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if rounded:
        radius = int(canvas * 0.223)
        draw.rounded_rectangle([0, 0, canvas - 1, canvas - 1], radius=radius, fill=AZUL)
    else:
        draw.rectangle([0, 0, canvas - 1, canvas - 1], fill=AZUL)

    fruit_r = canvas * fruit_ratio
    cx = canvas / 2
    cy = canvas * (0.5 + y_shift)
    draw_mark(draw, cx, cy, fruit_r)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    ICONS.mkdir(exist_ok=True)

    icon_192 = make_icon(192, rounded=True, fruit_ratio=0.22, y_shift=0.07)
    icon_192.save(ICONS / "icon-192.png", "PNG")

    icon_512 = make_icon(512, rounded=True, fruit_ratio=0.22, y_shift=0.07)
    icon_512.save(ICONS / "icon-512.png", "PNG")

    # Maskable: lienzo completo, marca dentro de la zona segura (~80%).
    maskable = make_icon(512, rounded=False, fruit_ratio=0.17, y_shift=0.06)
    maskable.save(ICONS / "icon-maskable-512.png", "PNG")

    # Apple aplica su propia máscara: fondo a sangre, 180×180.
    apple = make_icon(180, rounded=False, fruit_ratio=0.20, y_shift=0.06)
    apple.save(ICONS / "apple-touch-icon.png", "PNG")

    fav = make_icon(256, rounded=True, fruit_ratio=0.22, y_shift=0.07)
    fav.save(ICONS / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    print("Wrote", *[p.name for p in sorted(ICONS.iterdir()) if p.suffix in {".png", ".ico"}])


if __name__ == "__main__":
    main()
