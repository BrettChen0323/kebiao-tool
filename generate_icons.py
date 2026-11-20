"""生成 Capacitor 工程要用的图标（本机跑一次，产物提交进仓库）。

    resources/icon-{48,72,96,144,192}.png         普通启动图标（满幅）
    resources/ic_launcher_foreground-{108,...,432}.png  自适应图标前景（留安全区）
    resources/ic_stat_icon-{24,...,96}.png        通知栏小图标（纯白剪影）

画的是原型里那三根柱子：电蓝 / 青 / 橙，午夜黑底。
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'resources')
os.makedirs(OUT, exist_ok=True)

BLUE = (74, 158, 255, 255)
CYAN = (95, 211, 243, 255)
ORANGE = (255, 122, 60, 255)
BG = (9, 11, 16, 255)


def bars(size, colors, pad_ratio=0.30, bg=None):
    """在 size×size 画布上画三根圆角柱；pad_ratio = 四周留白比例。"""
    S = size * 4  # 4 倍超采样，缩回去更干净
    img = Image.new('RGBA', (S, S), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    inner = S * (1 - pad_ratio * 2)
    off = S * pad_ratio
    gap = inner * 0.16
    w = (inner - gap * 2) / 3
    base = off + inner                      # 柱子底部对齐线
    heights = [inner * 0.42, inner * 0.66, inner * 0.92]

    for i, (c, h) in enumerate(zip(colors, heights)):
        x0 = off + i * (w + gap)
        y0 = base - h
        d.rounded_rectangle([x0, y0, x0 + w, base], radius=w * 0.42, fill=c)

    return img.resize((size, size), Image.LANCZOS)


# 1) 普通启动图标：满幅深色底 + 柱子
for s in (48, 72, 96, 144, 192, 512):
    bars(s, [BLUE, CYAN, ORANGE], pad_ratio=0.26, bg=BG).convert('RGB').save(
        os.path.join(OUT, f'icon-{s}.png'))

# 2) 自适应图标前景：透明底，图缩到中间 62%，四周是安全区
for s in (108, 162, 216, 324, 432):
    glyph = bars(s, [BLUE, CYAN, ORANGE], pad_ratio=0.06)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    inner = int(s * 0.62)
    canvas.paste(glyph.resize((inner, inner), Image.LANCZOS),
                 ((s - inner) // 2, (s - inner) // 2), glyph.resize((inner, inner), Image.LANCZOS))
    canvas.save(os.path.join(OUT, f'ic_launcher_foreground-{s}.png'))

# 3) 通知栏小图标：纯白剪影（系统会自己上色）
for s in (24, 36, 48, 72, 96):
    white = bars(s, [(255, 255, 255, 255)] * 3, pad_ratio=0.10)
    white.save(os.path.join(OUT, f'ic_stat_icon-{s}.png'))

print('icons →', OUT)
for f in sorted(os.listdir(OUT)):
    print('  ', f, os.path.getsize(os.path.join(OUT, f)), 'bytes')
