"""Build the GitHub Pages site in docs/ from the markdown copy and the page templates.

    python3 model/worked_example.py   # numbers -> model/worked_example.json
    python3 build.py                  # json -> docs/assets/data.js, copy + templates -> docs/*.html

Templates live in templates/. Each section of content/explainer.md is a level-2 heading in the form
"## Title {#id}" and lands in the template's <!-- COPY:id --> placeholder. Fenced ```diagram blocks are
notes for the diagram builder and are dropped. content/article.md lands in <!-- ARTICLE -->.
"""
import html
import json
import re
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
TEMPLATES = ROOT / "templates"
CONTENT = ROOT / "content"
DOCS = ROOT / "docs"

SECTION_RE = re.compile(r"^## (.+?)\s*\{#([a-z0-9-]+)\}\s*$", re.M)
DIAGRAM_RE = re.compile(r"^```diagram[^\n]*\n.*?^```[ \t]*$\n?", re.M | re.S)
PLACEHOLDER_RE = re.compile(r"<!-- COPY:([a-z0-9-]+) -->")
BANNED_CHARS = {"\u2014": "em dash"}


def md_to_html(text: str) -> str:
    out = markdown.markdown(text, extensions=["tables", "attr_list", "fenced_code"], output_format="html5")
    out = out.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    # Outside links open in a new tab; links inside the site stay put.
    out = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', out)
    return out


DISCLAIMER = ("Educational only. Not investment, legal or tax advice. "
              "The worked example is an illustrative company, not a real deal.")


def drop_footer_duplicate(page: str, html_out: str) -> str:
    """The page footer already ends with the disclaimer, so drop the copy's own closing line."""
    if DISCLAIMER in page:
        html_out = html_out.replace(f"<p>{DISCLAIMER}</p>", "")
    return html_out


def check_text(name: str, text: str) -> None:
    for ch, label in BANNED_CHARS.items():
        if ch in text:
            line = text[: text.index(ch)].count("\n") + 1
            sys.exit(f"build: {name} line {line} contains an {label}")


def split_sections(text: str) -> tuple[str, dict[str, str]]:
    """Return (text before the first section, {id: markdown with a plain heading})."""
    matches = list(SECTION_RE.finditer(text))
    if not matches:
        sys.exit("build: content/explainer.md has no '## Title {#id}' sections")
    intro = text[: matches[0].start()]
    sections = {}
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.end() : end]
        body = DIAGRAM_RE.sub("", body)
        if "```diagram" in body:
            sys.exit(f"build: section {m.group(2)} has an unclosed ```diagram block")
        sections[m.group(2)] = f"## {m.group(1)}\n{body}".strip() + "\n"
    return intro, sections


def write_data_js() -> None:
    model = json.loads((ROOT / "model" / "worked_example.json").read_text())
    js = (
        "// Generated from model/worked_example.py. Do not edit by hand.\n"
        "window.MODEL = " + json.dumps(model, indent=2, sort_keys=True) + ";\n"
    )
    (DOCS / "assets" / "data.js").write_text(js)


def build_index() -> None:
    src = (CONTENT / "explainer.md").read_text()
    check_text("content/explainer.md", src)
    intro, sections = split_sections(src)
    page = (TEMPLATES / "index.html").read_text()

    wanted = PLACEHOLDER_RE.findall(page)
    missing = [k for k in wanted if k not in sections and k != "intro"]
    extra = [k for k in sections if k not in wanted]
    if missing:
        sys.exit(f"build: no copy for placeholder(s): {', '.join(missing)}")
    if extra:
        sys.exit(f"build: copy with no placeholder: {', '.join(extra)}")

    intro_md = re.sub(r"^# .*$", "", intro, flags=re.M).strip()
    if "intro" in wanted:
        sections["intro"] = intro_md
    elif intro_md:
        print("build: note: explainer intro text dropped (template has no COPY:intro)")

    def fill(m):
        key = m.group(1)
        out = drop_footer_duplicate(page, md_to_html(sections[key]))
        return out.replace("<p>", '<p class="dek">', 1) if key == "intro" else out

    page = PLACEHOLDER_RE.sub(fill, page)
    (DOCS / "index.html").write_text(page)


def build_article() -> None:
    src = (CONTENT / "article.md").read_text()
    check_text("content/article.md", src)
    page = (TEMPLATES / "article.html").read_text()
    if "<!-- ARTICLE -->" not in page:
        sys.exit("build: templates/article.html has no <!-- ARTICLE --> placeholder")
    h1 = re.search(r"^# (.+)$", src, re.M)
    if h1:
        title = html.escape(h1.group(1).strip(), quote=True)
        page = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", page, count=1, flags=re.S)
        page = re.sub(r'(<meta property="og:title" content=")[^"]*(")', rf"\g<1>{title}\2", page, count=1)
    page = page.replace("<!-- ARTICLE -->", drop_footer_duplicate(page, md_to_html(src)))
    (DOCS / "article.html").write_text(page)


def main() -> None:
    write_data_js()
    build_index()
    build_article()
    (DOCS / ".nojekyll").write_text("")
    for name in ("index.html", "article.html"):
        text = (DOCS / name).read_text()
        check_text(f"docs/{name}", text)
        left = PLACEHOLDER_RE.findall(text) + (["ARTICLE"] if "<!-- ARTICLE -->" in text else [])
        if left:
            sys.exit(f"build: docs/{name} still has placeholder(s): {left}")
    print("build: wrote docs/index.html, docs/article.html, docs/assets/data.js")


if __name__ == "__main__":
    main()
