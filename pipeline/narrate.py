"""Generate story-mode narration with ElevenLabs (SI-generated audio; acknowledged in README).
Reads ELEVENLABS_API_KEY from web/.env.local. Run: .venv/bin/python pipeline/narrate.py [story|demo] [voice name]"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
SCRIPTS = {
    # in-app story mode
    "story": ("web/public/audio", "story", [
        "In 2022, NASA's InSight lander fell silent on Mars. Its solar panels were buried in dust.",
        "Dust at its landing site rises and falls on a yearly rhythm.",
        "Dust Twins finds where Earth's sky keeps that same rhythm.",
        "Turn Earth's year until the rings lock, and you get a test calendar.",
        "Mars dust, checked against NASA's own rovers. And honest about what Earth can never copy.",
    ]),
    # 30-second product demo video
    "demo": ("media/audio-demo", "demo", [
        "Team Wyrd presents Dust Twins.",
        "Dust buried InSight's solar panels and ended the mission.",
        "We find where on Earth dust behaves like it does at Mars landing sites, from NASA records of both planets.",
        "Every match comes with a calendar of months to test in.",
        "A model then argues against our own result, with every number checked.",
        "The Mars dust record matches the rovers' own readings.",  # mp4 sped 1.06x to fit its slot,
        "Test on Earth, before you fly.",
    ]),
}
which = next((a for a in sys.argv[1:] if a in SCRIPTS), "story")
OUT_DIR, PREFIX, LINES = SCRIPTS[which]
key = next(l.split("=", 1)[1].strip() for l in open(ROOT / "web" / ".env.local") if l.startswith("ELEVENLABS_API_KEY="))


def call(url, body=None):
    req = urllib.request.Request(url, data=body and json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=120).read()


voices = json.loads(call("https://api.elevenlabs.io/v1/voices"))["voices"]
want = next((a for a in sys.argv[1:] if a not in SCRIPTS), "").lower()
voice = next((v for v in voices if want and want in v["name"].lower()), None) or \
    next((v for v in voices if (v.get("labels") or {}).get("use_case", "").startswith("narrat")), voices[0])
print("voices:", ", ".join(v["name"] for v in voices[:25]))
print("using:", voice["name"])
out = ROOT / OUT_DIR
out.mkdir(parents=True, exist_ok=True)
for i, text in enumerate(LINES, 1):
    mp3 = call(f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}?output_format=mp3_44100_128",
               {"text": text, "model_id": "eleven_multilingual_v2"})
    (out / f"{PREFIX}-{i}.mp3").write_bytes(mp3)
    print(i, len(mp3), "bytes")
