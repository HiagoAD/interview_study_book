#!/usr/bin/env python3
"""Verify each receipt in a Codex evidence answer: its quote must appear at its URL, its file and line, or its log.

usage: python3 docs/evidence/codex/check_receipts.py <evidence.json> [--rerun]

Prints one line per failed receipt and a summary. --rerun also re-runs a receipt's command when its program is a
read-only tool (javap, monodis, grep and so on) and looks for the quote in the fresh output. Fetched pages are cached
in RECEIPTS_CACHE, by default receipts-pages/ in the system's temporary folder, with index.tsv mapping URLs to files.
Apple's documentation pages are read through their JSON, and RFC page headers are dropped. See docs/PLAN.md,
"Delegated evidence".
"""
import hashlib, html, json, os, re, shlex, subprocess, sys, tempfile, unicodedata

CACHE = os.environ.get("RECEIPTS_CACHE") or os.path.join(tempfile.gettempdir(), "receipts-pages")
os.makedirs(CACHE, exist_ok=True)
SAFE_PROGRAMS = {"javap", "monodis", "grep", "sed", "cat", "head", "tail", "plutil", "strings", "unzip", "xcrun"}


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    for a, b in (("‘", "'"), ("’", "'"), ("‚", "'"), ("‛", "'"), ("′", "'"),
                 ("“", '"'), ("”", '"'), ("„", '"'), ("‟", '"'),
                 ("–", "-"), ("—", "-"), ("‑", "-"), (" ", " "), ("​", ""),
                 ("﻿", ""), ("`", ""), ("…", "...")):
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+([,.;:!?(\])])", r"\1", s)
    return re.sub(r"([(\[])\s+", r"\1", s)


def curl(url, follow):
    key = hashlib.sha1((url + str(follow)).encode()).hexdigest()
    path = os.path.join(CACHE, key)
    meta = path + ".meta"
    if not os.path.exists(path):
        cmd = ["curl", "-s", "-o", path, "-w", "%{http_code} %{redirect_url}", "--max-time", "60",
               "-H", "Accept-Language: en-US,en;q=0.9", "-A", "Mozilla/5.0"]
        if follow:
            cmd.append("-L")
        r = subprocess.run(cmd + [url], capture_output=True, text=True)
        open(meta, "w").write(r.stdout)
        with open(os.path.join(CACHE, "index.tsv"), "a") as f:
            f.write(f"{url}\t{path}\t{'followed' if follow else 'direct'}\t{r.stdout}\n")
    return open(meta).read().split(" ", 1), open(path, "rb").read().decode("utf-8", "replace")


def apple_text(data):
    refs = data.get("references", {})
    blocks, strings = [], []

    def inline(items):
        out = []
        for it in items or []:
            t = it.get("type")
            if t == "text":
                out.append(it.get("text", ""))
            elif t == "codeVoice":
                out.append(it.get("code", ""))
            elif t == "reference":
                r = refs.get(it.get("identifier"), {})
                out.append(it.get("overridingTitle") or r.get("title") or it.get("identifier", "").rsplit("/", 1)[-1])
            elif "inlineContent" in it:
                out.append(inline(it["inlineContent"]))
        return "".join(out)

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("inlineContent"), list):
                blocks.append(inline(o["inlineContent"]))
            for k, v in o.items():
                if k == "abstract" and isinstance(v, list):
                    blocks.append(inline(v))
                if k in ("text", "code", "title") and isinstance(v, str):
                    strings.append(v)
                if k == "code" and isinstance(v, list):
                    strings.append("\n".join(x for x in v if isinstance(x, str)))
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(data)
    return " \n ".join(blocks) + " \n " + " \n ".join(strings)


def page_text(url):
    status, _ = curl(url, follow=False)
    m = re.match(r"https://developer\.apple\.com/documentation/(.+?)/?(#.*)?$", url)
    if m:
        jurl = "https://developer.apple.com/tutorials/data/documentation/" + m.group(1).lower() + ".json"
        (code, _r), body = curl(jurl, follow=True)
        try:
            return status, apple_text(json.loads(body))
        except Exception:
            return status, ""
    _, body = curl(url, follow=True)
    body = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", body)
    body = re.sub(r"(?s)<[^>]+>", " ", body)
    body = html.unescape(body)
    if "rfc-editor.org" in url or "ietf.org" in url:
        lines = [l for l in body.splitlines()
                 if not re.match(r"^\s*RFC \d+\s{2,}.*\s\d{4}\s*$", l) and not re.search(r"\[Page \d+\]\s*$", l)]
        body = "\n".join(lines).replace("\f", " ")
    return status, body


def check(entry, rerun):
    src, q = entry["source"], norm(entry["quote"])
    if not q:
        return "empty quote"
    if src.get("url"):
        (code, redirect), text = page_text(src["url"])
        t = norm(text)
        if q in t:
            return None if code == "200" else f"found, but the URL returns {code} {redirect}".strip()
        return f"not found at {src['url']} (status {code})" + (" [case-insensitive match]" if q.lower() in t.lower() else "")
    if src.get("file"):
        path = src["file"]
        if not os.path.exists(path):
            return f"no file {path}"
        lines = open(path, encoding="utf-8", errors="replace").read().splitlines()
        whole = norm(" ".join(lines))
        if q not in whole:
            return f"not in {path}"
        n = src.get("line") or 0
        for start in range(max(0, n - 3), min(len(lines), n + 2)):
            if q in norm(" ".join(lines[start:start + 200])) and q.split(" ")[0] in norm(" ".join(lines[start:start + 3])):
                return None
        found = next((i + 1 for i in range(len(lines)) if q.split(" ")[0] in lines[i] and q in norm(" ".join(lines[i:i + 200]))), None)
        return f"in {os.path.basename(path)} but at line {found}, not {n}"
    if src.get("log"):
        path = src["log"]
        if not os.path.exists(path):
            return f"no log {path}"
        if q not in norm(open(path, encoding="utf-8", errors="replace").read()):
            return f"not in log {path}"
        if rerun and src.get("command"):
            try:
                prog = os.path.basename(shlex.split(src["command"])[0])
            except ValueError:
                prog = ""
            if prog in SAFE_PROGRAMS:
                r = subprocess.run(src["command"], shell=True, capture_output=True, text=True, timeout=120)
                if q not in norm(r.stdout + r.stderr):
                    return f"in the log, but not in a fresh run of: {src['command'][:120]}"
        return None
    return "no source"


def main():
    data = json.load(open(sys.argv[1]))
    rerun = "--rerun" in sys.argv
    claims = data["claims"]
    fails = []
    for e in claims:
        why = check(e, rerun)
        if why:
            fails.append((e, why))
            print(f"FAIL {e['id']} [{e['section']}] {e['evidence_kind']}: {why}")
    kinds = {}
    for e in claims:
        kinds[e["evidence_kind"]] = kinds.get(e["evidence_kind"], 0) + 1
    verdicts = {}
    for e in claims:
        verdicts[e["verdict"]] = verdicts.get(e["verdict"], 0) + 1
    print(f"\n{len(claims)} receipts, {len(fails)} failed; kinds {kinds}; verdicts {verdicts}; "
          f"{len(set(e['id'] for e in claims))} claim ids; {len(data.get('runs_needed', []))} runs requested")


if __name__ == "__main__":
    main()
