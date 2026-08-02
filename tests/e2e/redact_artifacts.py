"""Redact ephemeral login material from failure-only Playwright artifacts."""

from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image, ImageDraw


ROOT = Path("test-results")
VALUES = [
    value.encode()
    for name in ("E2E_TENANT_A_PASSWORD", "E2E_TENANT_B_PASSWORD", "E2E_FIXTURE_KEY")
    if (value := os.getenv(name))
]


def redacted_image_bytes(format_name: str = "PNG") -> bytes:
    image = Image.new("RGB", (1280, 720), color="black")
    ImageDraw.Draw(image).text((40, 40), "REDACTED FAILURE SCREENSHOT", fill="white")
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def is_image(data: bytes) -> bool:
    return data.startswith((b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"RIFF"))


def redact_bytes(data: bytes) -> bytes:
    if is_image(data):
        return redacted_image_bytes("JPEG" if data.startswith(b"\xff\xd8\xff") else "PNG")
    for value in VALUES:
        data = data.replace(value, b"[REDACTED]")
    return data


def redact_zip(path: Path) -> None:
    temporary = path.with_suffix(path.suffix + ".redacted")
    with ZipFile(path, "r") as source, ZipFile(temporary, "w", ZIP_DEFLATED) as target:
        for item in source.infolist():
            target.writestr(item, redact_bytes(source.read(item.filename)))
    temporary.replace(path)


if ROOT.exists():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() == ".zip":
            redact_zip(path)
        elif path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            path.write_bytes(redacted_image_bytes("JPEG" if path.suffix.lower() in {".jpg", ".jpeg"} else "PNG"))
        elif path.suffix.lower() in {".json", ".txt", ".log", ".html", ".xml"}:
            path.write_bytes(redact_bytes(path.read_bytes()))
print("E2E_FAILURE_ARTIFACTS_REDACTED")
