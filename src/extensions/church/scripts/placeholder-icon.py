#!/usr/bin/env python3
"""Draw a placeholder app icon. Not the final mark. Run from the repo root:

    python3 src/extensions/church/scripts/placeholder-icon.py
"""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SIZE = 256


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size: int, pixel) -> bytes:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x, y, size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def ico(png_bytes: bytes) -> bytes:
    # Vista-style ICO that embeds one PNG. Width/height 0 means 256.
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_bytes), 22)
    return header + entry + png_bytes


def icon_pixel(x: int, y: int, size: int):
    cx = cy = (size - 1) / 2
    nx = (x - cx) / (size / 2)
    ny = (y - cy) / (size / 2)
    # slate background
    r, g, b = 22, 50, 74
    # gold ring
    dist = (nx * nx + ny * ny) ** 0.5
    if 0.46 < dist < 0.62:
        r, g, b = 232, 196, 122
    # two bars that meet, a stand-in for "every joint"
    if abs(ny) < 0.08 and abs(nx) < 0.34:
        r, g, b = 244, 236, 220
    if abs(nx) < 0.08 and abs(ny) < 0.34:
        r, g, b = 244, 236, 220
    return (r, g, b, 255)


def main() -> None:
    image = png(SIZE, icon_pixel)
    targets = [
        ROOT / "public" / "icon.png",
        ROOT / "src" / "server" / "icon.png",
    ]
    for path in targets:
        path.write_bytes(image)
    (ROOT / "public" / "icon.ico").write_bytes(ico(image))
    print("wrote", ", ".join(str(p.relative_to(ROOT)) for p in targets), "and public/icon.ico")


if __name__ == "__main__":
    main()
