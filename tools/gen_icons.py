#!/usr/bin/env python3
"""Generate the extension icons: a white return-arrow (enter key glyph) on a
rounded blue tile. Renders a 128px master and downscales to 48/32/16 via `sips`.
No third-party dependencies — writes the PNG bytes directly."""
import os
import struct
import subprocess
import zlib

W = H = 128
BRAND = (37, 99, 235)     # #2563eb
WHITE = (255, 255, 255)


def in_rrect(x, y, x0=4, y0=4, x1=123, y1=123, r=24):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def in_arrow(x, y):
    # Horizontal shaft.
    if 40 <= x <= 94 and 58 <= y <= 72:
        return True
    # Vertical riser on the right, rising up (return / enter shape).
    if 80 <= x <= 94 and 32 <= y <= 66:
        return True
    # Left-pointing arrowhead: tip at (28,65), base at x=52.
    if 28 <= x <= 52:
        h = (x - 28) / (52 - 28) * 21
        if 65 - h <= y <= 65 + h:
            return True
    return False


def pixel(x, y):
    if in_arrow(x, y):
        return WHITE + (255,)
    if in_rrect(x, y):
        return BRAND + (255,)
    return (0, 0, 0, 0)


def write_png(path):
    raw = bytearray()
    for y in range(H):
        raw.append(0)  # filter type 0
        for x in range(W):
            raw.extend(pixel(x, y))
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    ihdr = struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)  # 8-bit RGBA
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out, exist_ok=True)
    master = os.path.join(out, "icon128.png")
    write_png(master)
    for size in (48, 32, 16):
        dst = os.path.join(out, f"icon{size}.png")
        subprocess.run(
            ["sips", "-z", str(size), str(size), master, "--out", dst],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    print("icons written to", os.path.normpath(out))


if __name__ == "__main__":
    main()
