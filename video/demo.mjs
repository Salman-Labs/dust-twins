// Records the 30-second product demo from the real app and lays narration under it.
// The script drives the app like a visitor would and adds only what a video needs: a title card,
// an end card, short captions and camera moves (a CSS transform on the page; nothing is faked).
// Run from a folder with playwright installed:  node demo.mjs [base url]
// Written with SI assistance (Claude). Narration is SI-generated speech (ElevenLabs).
import { openStage } from "./stage.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const ROOT = "/Users/salmankhan/Desktop/anemoia-saas/nasa-hackathon";
const AUDIO = `${ROOT}/media/audio-demo`;
const OUT = `${ROOT}/media/dust-twins-demo-30s.mp4`;
const LEAD = 0.2, TAIL = 0.35;

const dur = (f) => parseFloat(execFileSync("ffprobe", ["-loglevel", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const clips = [1, 2, 3, 4, 5, 6, 7].map((i) => dur(`${AUDIO}/demo-${i}.mp3`));
const len = clips.map((d, i) => LEAD + d + TAIL + (i === 6 ? 1.6 : 0));   // the end card holds a little longer
const start = len.map((_, i) => len.slice(0, i).reduce((a, b) => a + b, 0));
const total = start[6] + len[6];
if (total > 29.9) throw new Error(`too long: ${total.toFixed(2)} s`);

const { browser, ctx, page, t0 } = await openStage(BASE, "out-demo");

const at = async (sec) => { const wait = tStart + sec * 1000 - Date.now(); if (wait > 0) await page.waitForTimeout(wait); };
const ev = (fn, ...a) => page.evaluate(fn, ...a);
let tStart;

// ---- the cut ----
await ev(() => { window.card('<h1>{mark}Dust Twins</h1><p>Team WYRD · NASA Space Apps Challenge 2026</p><p style="font-size:22px;margin-top:10px">Earth analogs for Mars</p>'); });
await page.waitForTimeout(700);
tStart = Date.now();
const offset = (tStart - t0) / 1000;

// 1. title
await at(start[1] - 0.25);
// 2. why it matters
await ev(() => { window.img(true); window.card(null); window.cap("Dust ended NASA's InSight mission", "Final selfie, April 2022 · NASA/JPL-Caltech"); });
await at(start[2] - 0.3);
// 3. the match: both globes, then turn to the Pakistan twin
await ev(() => { document.body.classList.add("v-solo"); window.img(false); window.cap("Mars landing sites, matched to Earth by how dust behaves"); const c = document.querySelector("canvas").getBoundingClientRect(), w = 520, h = w * 9 / 16; window.look(c.x + (c.width - w) / 2, c.y + c.height * 0.455 - h / 2, w, h); });
await at(start[2] + 2.6);
await ev(() => { window.byText("ol li button", "4")?.click(); });
await at(start[3] - 1.2);
await ev(() => { window.byText("button", "Challenge ")?.click(); });   // a live model call; its answer lands in shot 5
await at(start[3] - 0.3);
// 4. the test calendar (and start the model's challenge so its answer lands in the next shot)
await ev(() => {
  document.body.classList.remove("v-solo");
  const s = document.querySelector('[data-guide="calendar"]');
  s.scrollIntoView({ block: "start" }); document.querySelector("main").scrollTop = 0; scrollTo(0, 0); s.parentElement.scrollTop -= 96;
  window.lookAt(s, 560, -20); window.cap("A test calendar for every twin");
});
for (const [i, m] of [[0.9, 3], [1.5, 4], [2.1, 5], [2.7, 6]]) { await at(start[3] + i); await ev((mm) => { document.querySelectorAll('[aria-label="Test calendar by month"] button')[mm]?.click(); }, m); }
await at(start[4] - 0.3);
// 5. the model argues against the result
await ev(() => {
  const s = document.querySelector('[data-guide="challenge"]');
  s.scrollIntoView({ block: "start" }); document.querySelector("main").scrollTop = 0; scrollTo(0, 0); s.parentElement.scrollTop -= 96;
  window.lookAt(s, 560, -16); window.cap("An SI model argues against our own result", "Every figure it cites is checked against the data");
});
await at(start[5] - 0.3);
// 6. evidence: rover ground truth
await ev(() => { const m = document.querySelector("main"); m.style.transition = "none"; window.look(0, 0, 0, 0); void m.offsetWidth; m.style.transition = ""; window.byText("button", "Evidence")?.click(); });
await page.waitForTimeout(350);
await ev(() => {
  const h = window.byText("h4", "Rover ground truth"); h.scrollIntoView({ block: "start" }); document.querySelector("main").scrollTop = 0; scrollTo(0, 0);
  const box = h.closest('[role="dialog"]'); box.scrollTop -= 14;
  window.lookAt(h.closest("div.border-t"), 760, -18); window.cap("Checked against the rovers' own dust readings");
});
await at(start[6] - 0.3);
// 7. end card
await ev(() => { window.cap(null); window.card('<h1>{mark}Dust Twins</h1><p>Test on Earth, before you fly</p><div class="url">dust-twins.vercel.app</div><p style="font-size:22px;margin-top:34px">Built on NASA MERRA-2 and Mars orbiter dust records · Team WYRD</p>'); });
await at(total + 0.4);

const video = await page.video().path();
await ctx.close(); await browser.close();

// ---- narration under the picture ----
const ins = clips.flatMap((_, i) => ["-i", `${AUDIO}/demo-${i + 1}.mp3`]);
const delays = clips.map((_, i) => `[${i + 1}:a]adelay=${Math.round((start[i] + LEAD) * 1000)}:all=1[a${i}]`).join(";");
const mix = clips.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${clips.length}:normalize=0[a]`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", offset.toFixed(3), "-i", video, ...ins,
  "-filter_complex", `[0:v]fps=30,scale=1920:1080:flags=lanczos,fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4[v];${delays};${mix}`,
  "-map", "[v]", "-map", "[a]", "-t", total.toFixed(2), "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
  "-metadata", "title=Dust Twins: 30-second demo (Team WYRD)",
  "-metadata", "comment=Screen recording of the Dust Twins app. Narration is SI-generated speech (ElevenLabs text-to-speech).",
  "-movflags", "+faststart", OUT], { stdio: "inherit" });
console.log(JSON.stringify({ out: OUT, seconds: +total.toFixed(2), shots: start.map((t) => +t.toFixed(2)) }));
