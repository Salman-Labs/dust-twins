// Lay the five narration clips under the recording at the measured beat times; output a <=30 s mp4.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const { beats, video } = JSON.parse(fs.readFileSync("beats.json", "utf8"));
const AUDIO = "/Users/salmankhan/Desktop/anemoia-saas/nasa-hackathon/web/public/audio";
const starts = ["December 2022", "The three years", "One thread", "turned 0 mo", "10/10"].map((p) => beats.find((b) => b.label.startsWith(p)).t);
const end = Math.min(29.8, beats.at(-1).t + 3.4);
const ins = starts.flatMap((_, i) => ["-i", `${AUDIO}/story-${i + 1}.mp3`]);
const delays = starts.map((t, i) => `[${i + 1}:a]adelay=${Math.round(t * 1000)}:all=1[a${i}]`).join(";");
const mix = starts.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${starts.length}:normalize=0,afade=t=out:st=${(end - 0.6).toFixed(2)}:d=0.6[a]`;
const out = process.argv[2] ?? "dust-twins-demo-30s.mp4";
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", video, ...ins,
  "-filter_complex", `[0:v]scale=1920:1080:flags=lanczos,fade=t=out:st=${(end - 0.5).toFixed(2)}:d=0.5[v];${delays};${mix}`,
  "-map", "[v]", "-map", "[a]", "-t", end.toFixed(2), "-r", "30", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
  "-metadata", "title=Dust Twins: 30-second demo", "-metadata", "comment=Screen recording of the Dust Twins app. Narration is SI-generated speech (ElevenLabs text-to-speech).", "-movflags", "+faststart", out], { stdio: "inherit" });
console.log(out, "length", end.toFixed(2), "s; narration starts", starts.map((t) => t.toFixed(2)).join(", "));
