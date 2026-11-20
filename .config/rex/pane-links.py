"""Extract picker rows from Rex's HTML capture, preserving OSC 8 targets."""

import re
import shutil
import subprocess
import sys
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path


WEB_URL = re.compile(r"""https?://[^\s<>"'\x00-\x1f\x7f]+""", re.I)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = OrderedDict()
        self.text = []
        self.href = None

    def remember(self, url, label=""):
        if not re.fullmatch(r"https?://[^\s/\x00-\x1f\x7f][^\s\x00-\x1f\x7f]*", url, re.I):
            return
        self.rows[url] = label if label != url else ""
        self.rows.move_to_end(url)
        if len(self.rows) > 2000:  # rex.ui.pick capacity
            self.rows.popitem(last=False)

    def flush(self):
        text = "".join(self.text)
        self.text.clear()
        if self.href is not None:
            self.remember(self.href, " ".join(text.split()))
            return
        for match in WEB_URL.finditer(text):
            url = match.group().rstrip(".,;:!?")
            for left, right in (("(", ")"), ("[", "]"), ("{", "}")):
                while url.endswith(right) and url.count(right) > url.count(left):
                    url = url[:-1]
            self.remember(url)

    def handle_data(self, data):
        self.text.append(data)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.flush()
            self.href = dict(attrs).get("href", "")
        elif tag == "br":
            self.text.append("\n")

    def handle_endtag(self, tag):
        if tag == "a":
            self.flush()
            self.href = None


if __name__ == "__main__":
    session, block = sys.argv[1:]
    rex = shutil.which("rex") or (
        Path.home() / "Library/Application Support/com.superlogical.rex/RexServer"
        / "Versions/Current/Rex Server.app/Contents/MacOS/rex"
    )
    html = subprocess.check_output(
        [rex, "capture", "-s", session, "-b", block, "--format=html", "--trim", "--unwrap"],
        encoding="utf-8",
    )
    links = Links()
    links.feed(html)
    links.close()
    links.flush()
    for url in reversed(links.rows):
        print(url, links.rows[url], sep="\t")
