#!/usr/bin/env python3
"""
Подготовка кадров игрока из фотографий для SUPER MASHIO.

Что делает:
  1. Вырезает фон (белую студийную заливку) с мягким краем.
  2. Выравнивает кадры между собой: пол + горизонтальный центр таза.
     Кадр прыжка выравнивается по тазу (ноги в воздухе, пол там не работает).
  3. Нормализует масштаб, яркость, контраст, насыщенность.
  4. Стилизует под общий арт: мягкая обводка, постеризация, поднятые тени.
  5. Собирает спрайтшит public/assets/player/player.png + атлас player.json.
  6. Рисует player-debug.png — контрольный лист с направляющими для отладки.

Всё, что настраивается, лежит в scripts/photo-config.json.
Запуск:  python scripts/prepare_photos.py   (или npm run photos)
"""

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageOps
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "scripts", "photo-config.json")


# ---------------------------------------------------------------- утилиты

def hex_to_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def log(message):
    print(message, flush=True)


# ---------------------------------------------------------------- вырезание фона

def key_background(img, key):
    """Убирает белый фон. Возвращает RGBA с мягкой альфой.

    Белые полоски на кофте не должны пострадать, поэтому фоном считаем не любой
    белый пиксель, а только связанный с краем кадра либо достаточно крупный
    замкнутый кусок (просвет между рукой и корпусом, между ног).
    """
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    lo = rgb.min(axis=2)
    hi = rgb.max(axis=2)
    near_white = (lo >= key["whiteThreshold"]) & ((hi - lo) <= key["chromaTolerance"])

    labels, count = ndimage.label(near_white)
    background = np.zeros(near_white.shape, dtype=bool)
    if count:
        edge = np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
        keep = set(int(i) for i in np.unique(edge) if i != 0)
        # плюс замкнутые белые пятна (между рукой и корпусом, между ног) — они тоже фон,
        # но только достаточно крупные, чтобы не выесть светлые детали одежды
        sizes = ndimage.sum(near_white, labels, range(1, count + 1))
        for i, size in enumerate(sizes, start=1):
            if size >= key["holeMinArea"]:
                keep.add(i)
        background = np.isin(labels, list(keep))

    figure = ~background
    # выкидываем случайный мусор — оставляем только самую большую фигуру
    labels, count = ndimage.label(figure)
    if count > 1:
        sizes = ndimage.sum(figure, labels, range(1, count + 1))
        figure = labels == (int(np.argmax(sizes)) + 1)

    # сжимаем маску, чтобы срезать белую кайму по контуру, и слегка размываем ради сглаживания
    if key["shrink"] > 0:
        figure = ndimage.binary_erosion(figure, iterations=int(key["shrink"]))
    alpha = ndimage.gaussian_filter(figure.astype(np.float32), key["feather"])
    alpha = np.clip(alpha * 1.15, 0.0, 1.0)

    out = np.dstack([np.asarray(img.convert("RGB")), (alpha * 255).astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


# ---------------------------------------------------------------- замеры кадра

def measure(rgba, band):
    """Габариты силуэта, точка пола и горизонтальный центр таза (в пикселях кадра)."""
    alpha = np.asarray(rgba)[:, :, 3]
    mask = alpha > 128
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        raise ValueError("кадр пустой — фон съел всю фигуру, ослабь whiteThreshold")

    top, bottom = int(ys.min()), int(ys.max())
    left, right = int(xs.min()), int(xs.max())
    height = bottom - top + 1

    y0 = top + int(band[0] * height)
    y1 = top + int(band[1] * height)
    strip = mask[y0:y1 + 1, :]
    sxs = np.nonzero(strip)[1]
    pelvis_x = float(sxs.mean()) if len(sxs) else (left + right) / 2.0

    return {
        "top": top, "bottom": bottom, "left": left, "right": right,
        "height": height, "width": right - left + 1,
        "pelvisX": pelvis_x, "pelvisY": (y0 + y1) / 2.0,
    }


# ---------------------------------------------------------------- стилизация

def stylize(rgba, style):
    """Цветокоррекция и постеризация. Альфу не трогаем."""
    rgb = rgba.convert("RGB")

    if style["shadowLift"] > 0:
        gamma = 1.0 - style["shadowLift"]
        table = [int(round(255.0 * ((i / 255.0) ** gamma))) for i in range(256)]
        rgb = rgb.point(table * 3)

    rgb = ImageEnhance.Color(rgb).enhance(style["saturation"])
    rgb = ImageEnhance.Brightness(rgb).enhance(style["brightness"])
    rgb = ImageEnhance.Contrast(rgb).enhance(style["contrast"])

    if 1 <= style["posterizeBits"] <= 7:
        rgb = ImageOps.posterize(rgb, int(style["posterizeBits"]))

    result = rgb.convert("RGBA")
    result.putalpha(rgba.getchannel("A"))
    return result


def add_outline(canvas, style):
    """Мягкая тёмная обводка по силуэту, подложенная под спрайт."""
    width = style["outlineWidth"]
    if width <= 0:
        return canvas

    alpha = np.asarray(canvas)[:, :, 3].astype(np.float32) / 255.0
    solid = alpha > 0.5
    distance = ndimage.distance_transform_edt(~solid)
    ring = np.clip(width + 0.5 - distance, 0.0, 1.0)
    if style["outlineSoftness"] > 0:
        ring = ndimage.gaussian_filter(ring, style["outlineSoftness"])
    ring = ring * (1.0 - alpha) * style["outlineAlpha"]

    r, g, b = hex_to_rgb(style["outlineColor"])
    layer = np.zeros(canvas.size[::-1] + (4,), dtype=np.uint8)
    layer[:, :, 0] = r
    layer[:, :, 1] = g
    layer[:, :, 2] = b
    layer[:, :, 3] = (np.clip(ring, 0.0, 1.0) * 255).astype(np.uint8)

    return Image.alpha_composite(Image.fromarray(layer, "RGBA"), canvas)


# ---------------------------------------------------------------- плейсхолдеры

def make_placeholder(name, size):
    """Простая фигурка на случай, если фото ещё нет — чтобы игра запускалась всегда."""
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w, h = size
    cx, floor = w // 2, int(h * 0.87)
    body, skin = (90, 110, 190, 255), (240, 200, 170, 255)
    lift = 40 if name == "jump" else 0
    spread = {"idle": 0, "step1": 22, "step2": -22, "jump": 30}.get(name, 0)

    d.ellipse([cx - 34, floor - 300 - lift, cx + 34, floor - 232 - lift], fill=skin)
    d.rounded_rectangle([cx - 42, floor - 240 - lift, cx + 42, floor - 110 - lift], 22, fill=body)
    d.line([cx - 16, floor - 110 - lift, cx - 16 - spread, floor - lift], fill=body, width=26)
    d.line([cx + 16, floor - 110 - lift, cx + 16 + spread, floor - lift], fill=body, width=26)
    return img


# ---------------------------------------------------------------- сборка

def build():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    src_dir = os.path.join(ROOT, cfg["sourceDir"])
    out_dir = os.path.join(ROOT, cfg["outDir"])
    os.makedirs(out_dir, exist_ok=True)

    cw, ch = cfg["canvas"]["width"], cfg["canvas"]["height"]
    anchor_x = cfg["anchor"]["x"] * cw
    floor_y = cfg["anchor"]["floorY"] * ch
    band = cfg["pelvisBand"]

    # 1. читаем и кеим все кадры
    prepared = []
    for frame in cfg["frames"]:
        path = os.path.join(src_dir, frame["file"])
        alt = os.path.join(src_dir, frame["file"].lstrip("0"))  # поддержка 1.png вместо 01.png
        if os.path.exists(path):
            rgba = key_background(Image.open(path), cfg["key"])
            source = frame["file"]
        elif os.path.exists(alt):
            rgba = key_background(Image.open(alt), cfg["key"])
            source = os.path.basename(alt)
        else:
            log("  ! %s не найден — рисую плейсхолдер" % frame["file"])
            prepared.append({"frame": frame, "image": make_placeholder(frame["name"], (cw, ch)),
                             "placeholder": True})
            continue

        m = measure(rgba, band)
        rgba = rgba.crop((m["left"], m["top"], m["right"] + 1, m["bottom"] + 1))
        prepared.append({"frame": frame, "image": rgba, "metrics": measure(rgba, band),
                         "placeholder": False, "source": source})

    real = [p for p in prepared if not p["placeholder"]]
    if not real:
        log("Фотографий нет вообще — собираю спрайтшит из плейсхолдеров.")

    # 2. общий масштаб — один на все кадры: фото сняты с одной точки,
    #    так что относительные размеры уже верные, их нельзя ломать по-кадрово
    ref_name = cfg["scaleRefFrame"]
    ref = next((p for p in real if p["frame"]["name"] == ref_name), real[0] if real else None)
    global_scale = (cfg["figureHeight"] / ref["metrics"]["height"]) if ref else 1.0

    # 3. опорная высота таза берётся из эталонного кадра, поставленного на пол
    ref_pelvis_y = None
    if ref:
        s = global_scale * ref["frame"]["scale"]
        ref_pelvis_y = floor_y - (ref["metrics"]["height"] - ref["metrics"]["pelvisY"]) * s

    # 4. раскладываем по холстам
    sheet_frames = []
    meta_frames = {}
    for p in prepared:
        frame = p["frame"]
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))

        if p["placeholder"]:
            canvas = p["image"]
        else:
            m = p["metrics"]
            scale = global_scale * frame["scale"]
            new_size = (max(1, int(round(m["width"] * scale))), max(1, int(round(m["height"] * scale))))
            img = stylize(p["image"].resize(new_size, Image.LANCZOS), cfg["style"])

            x = anchor_x - m["pelvisX"] * scale + frame["offsetX"]
            if frame["alignBy"] == "pelvis" and ref_pelvis_y is not None:
                y = ref_pelvis_y - m["pelvisY"] * scale + frame["offsetY"]
            else:
                y = floor_y - m["height"] * scale + frame["offsetY"]

            canvas.paste(img, (int(round(x)), int(round(y))), img)
            canvas = add_outline(canvas, cfg["style"])

            meta_frames[frame["name"]] = {
                "source": p.get("source"),
                "alignBy": frame["alignBy"],
                "pelvisOnCanvas": [round(anchor_x, 1), round(y + m["pelvisY"] * scale, 1)],
                "footOnCanvas": round(y + m["height"] * scale, 1),
                "scale": round(scale, 4),
            }

        sheet_frames.append((frame["name"], canvas))

    # 5. спрайтшит одной строкой
    sheet = Image.new("RGBA", (cw * len(sheet_frames), ch), (0, 0, 0, 0))
    atlas = {"frames": [], "meta": {"app": "prepare-photos", "image": "player.png",
                                    "format": "RGBA8888",
                                    "size": {"w": sheet.width, "h": ch}, "scale": "1"}}
    for i, (name, canvas) in enumerate(sheet_frames):
        sheet.paste(canvas, (cw * i, 0))
        atlas["frames"].append({
            "filename": name,
            "frame": {"x": cw * i, "y": 0, "w": cw, "h": ch},
            "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": cw, "h": ch},
            "sourceSize": {"w": cw, "h": ch},
        })

    sheet.save(os.path.join(out_dir, "player.png"))
    with open(os.path.join(out_dir, "player.json"), "w", encoding="utf-8") as f:
        json.dump(atlas, f, ensure_ascii=False, indent=2)

    # мета для игры: где у спрайта ноги и таз — по ним ставим origin, хитбокс и тень
    meta = {
        "frameWidth": cw, "frameHeight": ch,
        "origin": {"x": cfg["anchor"]["x"], "y": cfg["anchor"]["floorY"]},
        "figureHeight": cfg["figureHeight"],
        "floorY": round(floor_y, 1),
        "pelvisY": round(ref_pelvis_y, 1) if ref_pelvis_y else None,
        "frames": meta_frames,
    }
    with open(os.path.join(out_dir, "player.meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    write_debug_sheet(sheet_frames, cfg, out_dir, anchor_x, floor_y, ref_pelvis_y)

    log("Готово: %s (%d кадров, %dx%d)" % (os.path.join(cfg["outDir"], "player.png"),
                                           len(sheet_frames), cw, ch))
    for name, info in meta_frames.items():
        log("  %-6s масштаб %.3f  таз y=%.1f  ноги y=%.1f"
            % (name, info["scale"], info["pelvisOnCanvas"][1], info["footOnCanvas"]))


def write_debug_sheet(frames, cfg, out_dir, anchor_x, floor_y, pelvis_y):
    """Контрольный лист: кадры рядом с направляющими + все кадры друг на друге."""
    cw, ch = cfg["canvas"]["width"], cfg["canvas"]["height"]
    cols = len(frames) + 1
    sheet = Image.new("RGBA", (cw * cols, ch), (28, 26, 38, 255))

    stack = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    for i, (name, canvas) in enumerate(frames):
        sheet.paste(canvas, (cw * i, 0), canvas)
        faded = canvas.copy()
        faded.putalpha(faded.getchannel("A").point(lambda a: int(a * 0.4)))
        stack = Image.alpha_composite(stack, faded)
    sheet.paste(stack, (cw * len(frames), 0), stack)

    d = ImageDraw.Draw(sheet)
    for i in range(cols):
        ox = cw * i
        d.line([ox + anchor_x, 0, ox + anchor_x, ch], fill=(255, 90, 120, 200), width=1)
        d.line([ox, floor_y, ox + cw, floor_y], fill=(120, 220, 255, 200), width=1)
        if pelvis_y:
            d.line([ox, pelvis_y, ox + cw, pelvis_y], fill=(255, 210, 100, 160), width=1)
        d.rectangle([ox, 0, ox + cw - 1, ch - 1], outline=(90, 90, 120, 255))
        label = frames[i][0] if i < len(frames) else "все вместе"
        d.text((ox + 8, 8), label, fill=(255, 255, 255, 230))

    sheet.convert("RGB").save(os.path.join(out_dir, "player-debug.png"))


if __name__ == "__main__":
    try:
        build()
    except Exception as exc:  # noqa: BLE001 — скрипт ручной, важнее понятное сообщение
        log("Ошибка: %s" % exc)
        sys.exit(1)
