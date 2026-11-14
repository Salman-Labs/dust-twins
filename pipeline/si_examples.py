"""Save real runs of the two SI features so the app can replay them when no key is available.
Needs the dev server running (pnpm dev). Output is SI-generated text (Gemini), labelled as a saved run in the app.
Run: .venv/bin/python pipeline/si_examples.py"""
import json
import time
import urllib.request
from pathlib import Path

URL = "http://localhost:3000/api/agent"
QUESTIONS = [
    "I am testing a solar panel dust wiper for an InSight-style mission. Where in Pakistan should I test, and in which months?",
    "Which Earth site best rehearses Opportunity's dust year, and how far can I trust that match?",
    "I can only run a field test in January or February. Which twin of Spirit's site fits those months?",
]


def post(body):
    for _ in range(3):
        try:
            req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            raw = urllib.request.urlopen(req, timeout=120).read().decode()
            if body["mode"] == "challenge":
                return json.loads(raw)
            last = json.loads(raw.strip().splitlines()[-1])   # the question mode streams one JSON object per line
            if last.get("type") != "final":
                raise RuntimeError(last)
            return last
        except Exception as e:   # rate limit or a malformed reply: wait and retry
            print("  retry:", e)
            time.sleep(60)
    raise SystemExit("failed: " + json.dumps(body))


out = dict(challenge={}, ask=[])
for site in ["insight", "opportunity", "spirit", "perseverance", "curiosity"]:
    r = post(dict(mode="challenge", site=site, rank=1))
    assert len(r["reasons"]) >= 2, r
    out["challenge"][f"{site}-1"] = {k: r[k] for k in ("reasons", "settle", "written", "removed")}
    print(site, len(r["reasons"]), "reasons,", r["removed"], "removed")
    time.sleep(42)   # stay under the route's own rate limit
for q in QUESTIONS:
    r = post(dict(mode="ask", question=q))
    assert r["text"], r
    out["ask"].append(dict(question=q, **{k: r[k] for k in ("text", "steps", "action", "checked", "unverified")}))
    print("ask:", r["text"][:90], "| unverified:", r["unverified"])
    time.sleep(42)
Path(__file__).parent.parent.joinpath("web/public/data/si_examples.json").write_text(json.dumps(out, indent=1))
