import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = r"C:\Users\79157\Desktop\tv\karaoke"
SRC = os.path.join(ROOT, "branding", "logo-source.jpg")
WEB = os.path.join(ROOT, "web", "public")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
os.makedirs(os.path.join(RES, "drawable-nodpi"), exist_ok=True)
for d in ["mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi", "mipmap-anydpi-v26"]:
    os.makedirs(os.path.join(RES, d), exist_ok=True)

base = Image.open(SRC).convert("RGB")


def rounded(size, radius_ratio=0.2):
    img = base.resize((size, size), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=255)
    img.putalpha(mask)
    return img


# Web / PWA
logo512 = rounded(512)
logo512.save(os.path.join(WEB, "logo.png"))
logo512.resize((192, 192), Image.LANCZOS).save(os.path.join(WEB, "icon-192.png"))
logo512.resize((512, 512), Image.LANCZOS).save(os.path.join(WEB, "icon-512.png"))
logo512.resize((64, 64), Image.LANCZOS).save(os.path.join(WEB, "favicon.png"))
logo512.resize((180, 180), Image.LANCZOS).save(os.path.join(WEB, "apple-touch-icon.png"))

# Android in-app logo
logo512.save(os.path.join(RES, "drawable-nodpi", "logo.png"))

# Android legacy launcher icons
sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, size in sizes.items():
    icon = rounded(size, 0.22)
    icon.save(os.path.join(RES, f"mipmap-{density}", "ic_launcher.png"))
    icon.save(os.path.join(RES, f"mipmap-{density}", "ic_launcher_round.png"))

# Adaptive foreground: 432x432, logo inside the safe zone
fg = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
inner = rounded(280, 0.22)
fg.paste(inner, ((432 - 280) // 2, (432 - 280) // 2), inner)
fg.save(os.path.join(RES, "drawable-nodpi", "ic_launcher_foreground.png"))

# TV banner 320x180
w, h = 320, 180
banner = Image.new("RGB", (w, h), "#07060B")
px = banner.load()
for y in range(h):
    for x in range(w):
        t = (x / w * 0.45 + y / h * 0.55)
        px[x, y] = (
            int(8 + 26 * t),
            int(6 + 8 * t),
            int(14 + 38 * t),
        )
glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((60, -60, 260, 140), fill=(255, 77, 109, 70))
gd.ellipse((160, 40, 340, 220), fill=(85, 230, 255, 45))
glow = glow.filter(ImageFilter.GaussianBlur(28))
banner = Image.alpha_composite(banner.convert("RGBA"), glow).convert("RGB")
mark = rounded(140, 0.22)
banner.paste(mark, ((w - 140) // 2, 8), mark)
banner.save(os.path.join(RES, "drawable-nodpi", "tv_banner.png"))

# Big branding asset for README / social
logo512.save(os.path.join(ROOT, "branding", "logo-512.png"))
print("generated")
