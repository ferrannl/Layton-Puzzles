#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

README = Path("README.md")
IMPOSSIBLE = Path("impossible.json")

START = "<!-- IMPOSSIBLE:START -->"
END = "<!-- IMPOSSIBLE:END -->"


def pad3(n: int) -> str:
    return str(n).zfill(3)


def load_impossible() -> dict[int, str]:
    data = json.loads(IMPOSSIBLE.read_text(encoding="utf-8"))
    out: dict[int, str] = {}
    for k, v in data.items():
        try:
            out[int(k)] = str(v)
        except Exception:
            continue
    return dict(sorted(out.items(), key=lambda kv: kv[0]))


def build_block(items: dict[int, str]) -> str:
    lines = []
    lines.append(START)
    lines.append("")
    if not items:
        lines.append("_No impossible puzzles listed._")
    else:
        lines.append("Known broken / unsolvable puzzles are flagged in the UI:")
        lines.append("")
        for pid, name in items.items():
            lines.append(f"- {pad3(pid)} — *{name}*")
    lines.append("")
    lines.append(END)
    return "\n".join(lines)


def replace_between(text: str, start: str, end: str, block: str) -> str:
    if start not in text or end not in text:
        raise SystemExit(
            "README markers not found. Add:\n"
            f"{start}\n{end}"
        )
    before = text.split(start)[0]
    after = text.split(end)[1]
    return before + block + after


def main():
    if not README.exists():
        raise SystemExit("README.md not found")
    if not IMPOSSIBLE.exists():
        raise SystemExit("impossible.json not found")

    impossible = load_impossible()
    block = build_block(impossible)

    old = README.read_text(encoding="utf-8")
    new = replace_between(old, START, END, block)

    if new != old:
        README.write_text(new, encoding="utf-8")
        print("README updated.")
    else:
        print("README already up to date.")


if __name__ == "__main__":
    main()
