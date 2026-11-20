"""Extract picker rows from Rex's HTML capture, preserving OSC 8 targets."""

import json
import re
import shutil
import socket
import subprocess
import sys
from collections import OrderedDict
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


TOKEN = re.compile(
    r"""[a-z][\w+.-]*://[^\s<>"'`]+|"([^"\n]+)"|'([^'\n]+)'|`([^`\n]+)`|[^\s<>"'`()\[\],;=]+""",
    re.I,
)
POSITION = re.compile(r":([1-9][0-9]{0,8})(?::([1-9][0-9]{0,8}))?$")
LOCAL_HOSTS = {"", "localhost", socket.gethostname().lower()}


@lru_cache(maxsize=8192)
def existing_file(name, cwd):
    try:
        path = Path(name).expanduser()
        if not path.is_absolute():
            if not cwd:
                return None
            path = Path(cwd) / path
        if path.is_file():
            return str(path.resolve())
    except (OSError, RuntimeError, ValueError):
        pass
    return None


class Links(HTMLParser):
    def __init__(self, cwd):
        super().__init__()
        self.rows = OrderedDict()
        self.text = []
        self.href = None
        self.cwd = cwd

    def remember(self, target, label="", anchor=False):
        if not target or re.search(r"[\x00-\x1f\x7f]", target):
            return
        if re.fullmatch(r"https?://[^\s/][^\s]*", target, re.I):
            row = dict(kind="web", target=target, title=label or target)
        else:
            name = target
            if target.lower().startswith("file://"):
                try:
                    uri = urlsplit(target)
                except ValueError:
                    return
                if uri.netloc.lower() not in LOCAL_HOSTS or not uri.path.startswith("/"):
                    return
                name = unquote(uri.path)
            elif anchor or "://" in name:
                return
            position = POSITION.search(name)
            path = existing_file(name[:position.start()] if position else name, self.cwd)
            if not path:
                return
            row = dict(kind="file", target=path, title=label or target)
            if position:
                row["line"] = int(position[1])
                if position[2]:
                    row["column"] = int(position[2])
        key = (row["target"], row.get("line"), row.get("column"))
        self.rows[key] = row
        self.rows.move_to_end(key)
        if len(self.rows) > 2000:  # rex.ui.pick capacity
            self.rows.popitem(last=False)
        return True

    def flush(self):
        text = "".join(self.text)
        self.text.clear()
        if self.href is not None:
            self.remember(self.href, " ".join(text.split()), anchor=True)
            return
        self.scan(text)

    def scan(self, text):
        for match in TOKEN.finditer(text):
            quoted = next((part for part in match.groups() if part is not None), None)
            if quoted is not None:
                if not self.remember(quoted):
                    self.scan(quoted)
                continue
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
    rex = shutil.which("rex") or (
        Path.home() / "Library/Application Support/com.superlogical.rex/RexServer"
        / "Versions/Current/Rex Server.app/Contents/MacOS/rex"
    )
    session, block, cwd = sys.argv[1:]
    html = subprocess.check_output(
        [rex, "capture", "-s", session, "-b", block, "--format=html", "--trim", "--unwrap"],
        encoding="utf-8",
    )
    links = Links(cwd)
    links.feed(html)
    links.close()
    links.flush()
    print(json.dumps(list(reversed(links.rows.values()))))
