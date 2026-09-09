#!/usr/bin/env python3
"""
Генератор kb/manifest.json из frontmatter файлов kb/**/*.md.

Запускать локально вручную каждый раз, когда в kb/ добавляется новый файл темы
или меняется topic_slug/title/status у существующего:

    python tools/build-kb-manifest.py

Скрипт НЕ деплоится и не работает во время просмотра сайта — это разовый
шаг перед коммитом, как "build" в проектах с бандлером. Результат
(kb/manifest.json) — обычный статический файл, который сайт (js/kb-viewer.js)
подтягивает через fetch() наравне с самими .md-файлами. Никакого сервера,
Python или Node на проде не нужно — GitHub Pages отдаёт manifest.json как
любой другой статический файл.

Формат manifest.json:
{
  "01-01-os-basics": {
    "title": "...",
    "section": 1,
    "status": "not-started",
    "path": "01-fundamentals/01-os-basics.md"
  },
  "01-03-networking-basics": {
    "title": "Основы сетей",
    "section": 1,
    "status": "not-started",
    "path": "01-fundamentals/03-networking-basics/00-index.md",
    "children": [
      {"slug": "01-03-01-switching-and-osi", "title": "...", "path": "..."},
      ...
    ]
  },
  ...
}

Правило группировки в подпапки — то самое соглашение из kb/README.md
("топик-сабфолдер"): если в директории есть 00-index.md, все остальные
*.md-файлы этой же директории считаются его children, в порядке имени файла.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
KB_ROOT = REPO_ROOT / "kb"
OUT_PATH = KB_ROOT / "manifest.json"

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n", re.DOTALL)


def parse_frontmatter(text: str) -> dict | None:
    """Простой парсер для плоского YAML-подмножества, которое реально
    используется в kb/_templates/topic-template.md: строки вида
    `key: value`, `key: "value"`, `key: [a, b, c]`. Списков через
    `- "item"` не читаем — они здесь (title/section/topic_slug/status)
    не встречаются, а `related`/`tags` в manifest не нужны."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    fm: dict = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*:", line):
            continue  # часть многострочного списка (related: и т.п.) — пропускаем
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if value.startswith('"') and value.endswith('"') and len(value) >= 2:
            value = value[1:-1]
        elif value.startswith("'") and value.endswith("'") and len(value) >= 2:
            value = value[1:-1]
        fm[key] = value
    return fm


def collect_files() -> list[Path]:
    return sorted(
        p for p in KB_ROOT.rglob("*.md")
        if "_templates" not in p.parts and p.name != "README.md"
    )


def main() -> int:
    files = collect_files()
    nodes: dict[str, dict] = {}
    skipped: list[str] = []

    for path in files:
        text = path.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        rel_path = path.relative_to(KB_ROOT).as_posix()
        if not fm or "topic_slug" not in fm:
            skipped.append(rel_path)
            continue
        slug = fm["topic_slug"]
        node = {
            "title": fm.get("title", ""),
            "section": int(fm["section"]) if fm.get("section", "").isdigit() else fm.get("section"),
            "status": fm.get("status", "not-started"),
            "path": rel_path,
        }
        if slug in nodes:
            print(f"ВНИМАНИЕ: дублирующийся topic_slug '{slug}' — "
                  f"{nodes[slug]['path']} и {rel_path}", file=sys.stderr)
        nodes[slug] = node

    # Группировка "тема-подпапка": если рядом с 00-index.md в той же папке
    # лежат другие .md с валидным topic_slug — они становятся children индекса.
    by_dir: dict[Path, list[tuple[str, dict]]] = {}
    for slug, node in nodes.items():
        d = (KB_ROOT / node["path"]).parent
        by_dir.setdefault(d, []).append((slug, node))

    child_slugs: set[str] = set()
    for d, entries in by_dir.items():
        index_entry = next(
            ((s, n) for s, n in entries if Path(n["path"]).name == "00-index.md"),
            None,
        )
        if not index_entry or len(entries) < 2:
            continue
        index_slug, index_node = index_entry
        children = sorted(
            (s, n) for s, n in entries if n is not index_node
        )
        index_node["children"] = [
            {"slug": s, "title": n["title"], "path": n["path"]} for s, n in children
        ]
        for s, _ in children:
            child_slugs.add(s)

    manifest = {slug: node for slug, node in nodes.items() if slug not in child_slugs}

    OUT_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(f"kb/manifest.json обновлён: {len(manifest)} тем"
          f" ({sum(len(n.get('children', [])) for n in manifest.values())} из них — вложенные файлы подпапок).")
    if skipped:
        print(f"Пропущено файлов без topic_slug (это ожидаемо для заглушек/черновиков): {len(skipped)}")
        for s in skipped:
            print(f"  - {s}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
