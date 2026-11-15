"""One continuous narration take for the 60-second local video, with the time each sentence starts.
A single take sounds like someone presenting; sentence-by-sentence clips sound like a list.
SI-generated speech (ElevenLabs). Reads ELEVENLABS_API_KEY from web/.env.local.
Run: .venv/bin/python pipeline/narrate_take.py [voice name]"""
import base64
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
SENTENCES = [
    "Hi, we're Team Wyrd, and this is Dust Twins.",
    "Dust killed NASA's InSight lander. It buried the solar panels until the power ran out.",
    "So we asked: where on Earth does dust behave like it does on Mars?",
    "We matched thirteen Mars years of NASA orbiter dust maps against twenty-four years of Earth's record.",
    "Pick a landing site, and you get its Earth twins. This one is in Sindh, Pakistan.",
    "Each twin comes with a test calendar: the months that line up with Mars's dusty season.",
    "Grouping both planets by dust regime, Mars-like skies cover just three percent of Earth's dusty land.",
    "You can ask it a question, and watch it look up the answer.",
    "Then a model argues against our own result, with every number checked.",
    "It found all three global Mars storms unprompted, and it matches the rovers' own readings.",
    "Dust Twins. Test on Earth, before you fly.",
]
key = next(l.split("=", 1)[1].strip() for l in open(ROOT / "web" / ".env.local") if l.startswith("ELEVENLABS_API_KEY="))


def call(url, body=None):
    req = urllib.request.Request(url, data=body and json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=180).read()


voices = json.loads(call("https://api.elevenlabs.io/v1/voices"))["voices"]
want = (sys.argv[1] if len(sys.argv) > 1 else "George").lower()
voice = next(v for v in voices if want in v["name"].lower())
text = " ".join(SENTENCES)
r = json.loads(call(f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}/with-timestamps?output_format=mp3_44100_128", {
    "text": text, "model_id": "eleven_multilingual_v2",
    # lower stability and some style: more variation in pace and pitch, closer to a person presenting
    "voice_settings": {"stability": 0.38, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True},
}))
times = r["alignment"]["character_start_times_seconds"]
ends = r["alignment"]["character_end_times_seconds"]
starts, pos = [], 0
for s in SENTENCES:
    starts.append(round(times[pos], 3))
    pos += len(s) + 1
out = ROOT / "media" / "audio-local"
out.mkdir(parents=True, exist_ok=True)
(out / "local.mp3").write_bytes(base64.b64decode(r["audio_base64"]))
(out / "local.json").write_text(json.dumps(dict(voice=voice["name"], starts=starts, duration=round(ends[-1], 3), sentences=SENTENCES), indent=1))
print(voice["name"], "duration", round(ends[-1], 2), "starts", starts)
