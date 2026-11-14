"""Generate story-mode narration with ElevenLabs (SI-generated audio; acknowledged in README).
Reads ELEVENLABS_API_KEY from web/.env.local. Run: .venv/bin/python pipeline/narrate.py [voice name]"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
LINES = [
    "In 2022, NASA's InSight lander fell silent on Mars. Its solar panels were buried in dust.",
    "Dust at its landing site rises and falls on a yearly rhythm.",
    "Dust Twins finds where Earth's sky keeps that same rhythm.",
    "Turn Earth's year until the rings lock, and you get a test calendar.",
    "Checked against NASA's own rovers. And honest about what Earth can never copy.",
]
key = next(l.split("=", 1)[1].strip() for l in open(ROOT / "web" / ".env.local") if l.startswith("ELEVENLABS_API_KEY="))


def call(url, body=None):
    req = urllib.request.Request(url, data=body and json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=120).read()


voices = json.loads(call("https://api.elevenlabs.io/v1/voices"))["voices"]
want = (sys.argv[1] if len(sys.argv) > 1 else "").lower()
voice = next((v for v in voices if want and want in v["name"].lower()), None) or \
    next((v for v in voices if (v.get("labels") or {}).get("use_case", "").startswith("narrat")), voices[0])
print("voices:", ", ".join(v["name"] for v in voices[:25]))
print("using:", voice["name"])
out = ROOT / "web" / "public" / "audio"
out.mkdir(parents=True, exist_ok=True)
for i, text in enumerate(LINES, 1):
    mp3 = call(f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}?output_format=mp3_44100_128",
               {"text": text, "model_id": "eleven_multilingual_v2"})
    (out / f"story-{i}.mp3").write_bytes(mp3)
    print(i, len(mp3), "bytes")
