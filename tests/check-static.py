#!/usr/bin/env python3
"""Dependency-free checks for the static multipage site."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.references = []
        self.tags = Counter()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        self.tags[tag] += 1
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for key in ("href", "src"):
            if key in attrs:
                self.references.append(attrs[key])
        if tag == "meta" and attrs.get("name") == "viewport":
            self.tags["viewport"] += 1


def main():
    pages = {}
    errors = []
    for path in sorted(ROOT.glob("*.html")):
        page = Page()
        page.feed(path.read_text())
        pages[path.name] = page
        if page.tags["h1"] != 1:
            errors.append(f"{path.name}: expected one h1")
        for tag in ("main", "nav", "footer", "viewport"):
            if not page.tags[tag]:
                errors.append(f"{path.name}: missing {tag}")
        duplicates = [key for key, count in Counter(page.ids).items() if count > 1]
        if duplicates:
            errors.append(f"{path.name}: duplicate IDs {duplicates}")
    for name, page in pages.items():
        for reference in page.references:
            url = urlparse(reference)
            if url.scheme or url.netloc:
                continue
            target = ROOT / unquote(url.path) if url.path else ROOT / name
            if not target.is_file():
                errors.append(f"{name}: missing local asset {reference}")
            elif url.fragment and target.name in pages:
                if url.fragment not in pages[target.name].ids:
                    errors.append(f"{name}: missing anchor {reference}")
    if len(pages) != 11:
        errors.append(f"Expected 11 canonical pages, found {len(pages)}")
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"PASS: {len(pages)} pages; local assets, anchors, IDs, headings, and landmarks.")


if __name__ == "__main__":
    main()
