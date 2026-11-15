// Records the 60-second video for local judging: the real app, driven by this script, under one
// continuous narration take whose sentence timings (media/audio-local/local.json) set the cuts.
// Run from a folder with playwright installed:  node demo60.mjs [base url]
// Written with SI assistance (Claude). Narration is SI-generated speech (ElevenLabs).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { openStage } from "./stage.mjs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const ROOT = "/Users/salmankhan/Desktop/anemoia-saas/nasa-hackathon";
const take = JSON.parse(fs.readFileSync(`${ROOT}/media/audio-local/local.json`, "utf8"));
const OUT = `${ROOT}/media/dust-twins-local-60s.mp4`;
const LEAD = 0.3, S = take.starts.map((t) => t + LEAD), total = LEAD + take.duration + 1.8;
if (total > 59.8) throw new Error(`too long: ${total.toFixed(2)} s`);

const { browser, ctx, page, t0 } = await openStage(BASE, "out-demo60");
let tStart;
const at = async (sec) => { const wait = tStart + sec * 1000 - Date.now(); if (wait > 0) await page.waitForTimeout(wait); };
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const CUT = 0.25;   // change the picture just before the sentence starts

await ev(() => {
  const w = window;
  // the scene column at rest is 600 x 720 starting at x = 300 (the page is 1280 wide: 300 | 600 | 380)
  w.globes = (solo = true) => { document.body.classList.toggle("v-solo", solo); const wd = 520, h = wd * 9 / 16; w.look(300 + (600 - wd) / 2, 720 * 0.455 - h / 2, wd, h); };
  w.section = (id, width = 560, dy = -18) => { document.body.classList.remove("v-solo"); const s = document.querySelector(`[data-guide="${id}"]`); s.scrollIntoView({ block: "start" }); document.querySelector("main").scrollTop = 0; scrollTo(0, 0); s.parentElement.scrollTop -= 96; w.lookAt(s, width, dy); };
  w.card('<h1>{mark}Dust Twins</h1><p>Team WYRD · NASA Space Apps Challenge 2026</p><p style="font-size:22px;margin-top:10px">Earth analogs for Mars</p>');
});
await page.waitForTimeout(700);
tStart = Date.now();
const offset = (tStart - t0) / 1000;

// 1. "Hi, we're Team Wyrd, and this is Dust Twins."
await at(S[1] - CUT);
// 2. "Dust killed NASA's InSight lander..."
await ev(() => { window.img(true); window.card(null); window.cap("Dust ended NASA's InSight mission", "Final selfie, April 2022 · NASA/JPL-Caltech"); });
await at(S[2] - CUT);
// 3. "So we asked: where on Earth does dust behave like it does on Mars?"
await ev(() => { window.img(false); window.globes(); window.cap("Where on Earth does dust behave like it does on Mars?"); });
await at(S[3] - CUT);
// 4. "We matched thirteen Mars years ... against twenty-four years of Earth's record."  -> the dust ring
await ev(() => {
  document.body.classList.remove("v-solo");
  const ring = document.querySelector('aside svg[role="img"]'); ring.scrollIntoView({ block: "center" }); document.querySelector("main").scrollTop = 0; scrollTo(0, 0);
  window.lookAt(ring, 500, -8);
  window.cap("13 Mars years of orbiter dust maps · 24 years of NASA MERRA-2", "The ring is one year of dust at InSight's landing site");
});
await at(S[4] - CUT);
// 5. "Pick a landing site, and you get its Earth twins. This one is in Sindh, Pakistan."
await ev(() => { window.globes(); window.cap("Each Mars landing site gets ten Earth twins"); });
await at(S[4] + 2.4);
await ev(() => { window.byText("ol li button", "4")?.click(); window.cap("Khairpur, Sindh, Pakistan", "Match 0.88 of 1 with InSight's site"); });
await at(S[5] - CUT);
// 6. "Each twin comes with a test calendar..."
await ev(() => { window.section("calendar", 560, -20); window.cap("A test calendar for every twin"); });
for (const [i, m] of [[1.2, 3], [2.0, 4], [2.8, 5], [3.6, 6]]) { await at(S[5] + i); await ev((mm) => { document.querySelectorAll('[aria-label="Test calendar by month"] button')[mm]?.click(); }, m); }
await at(S[6] - CUT);
// 7. "Grouping both planets by dust regime, Mars-like skies cover just three percent..."
await ev(() => { window.byText("button", "Dust regimes")?.click(); window.globes(); window.cap("Dust regimes on both planets", "InSight's regime: 46% of Mars, 3% of Earth's dusty land"); });
await at(S[7] - 0.9);
await ev(() => { window.byText("button", "Challenge ")?.click(); });   // a live model call; its answer lands in shot 9
await at(S[7] - CUT);
// 8. "You can ask it a question, and watch it look up the answer."  -> replay of a saved run, labelled as such in the app
await ev(() => {
  window.byText("button", "Match score")?.click();
  document.body.classList.remove("v-solo");
  const s = window.byText("h3", "Ask a planning question").closest("section"); s.parentElement.scrollTop = 0;
  window.lookAt(s, 560, -8); window.cap("Ask a planning question", "An SI agent looks it up in the data and turns the globes");
  window.byText("button", "I am testing a solar panel")?.click();
});
await at(S[8] - CUT);
// 9. "Then a model argues against our own result, with every number checked."
await ev(() => { window.section("challenge", 560, -16); window.cap("An SI model argues against our own result", "Every figure it cites is checked against the data"); });
await at(S[9] - CUT);
// 10. "It found all three global Mars storms unprompted, and it matches the rovers' own readings."
await ev(() => { const m = document.querySelector("main"); m.style.transition = "none"; window.look(0, 0, 0, 0); void m.offsetWidth; m.style.transition = ""; window.byText("button", "Evidence")?.click(); });
await page.waitForTimeout(350);
await ev(() => { const h = window.byText("h4", "Storm-year detector"); h.scrollIntoView({ block: "start" }); document.querySelector("main").scrollTop = 0; scrollTo(0, 0); h.closest('[role="dialog"]').scrollTop -= 14; window.lookAt(h.closest("div.border-t"), 760, -18); window.cap("It found Mars's three global dust storms unprompted"); });
await at(S[9] + 3.0);
await ev(() => { const h = window.byText("h4", "Rover ground truth"); h.scrollIntoView({ block: "start" }); document.querySelector("main").scrollTop = 0; scrollTo(0, 0); window.lookAt(h.closest("div.border-t"), 760, -18); window.cap("And it agrees with the rovers' own dust readings"); });
await at(S[10] - CUT);
// 11. "Dust Twins. Test on Earth, before you fly."
await ev(() => { window.cap(null); window.card('<h1>{mark}Dust Twins</h1><p>Test on Earth, before you fly</p><div class="url">dust-twins.vercel.app</div><p style="font-size:22px;margin-top:34px">Built on NASA MERRA-2 and Mars orbiter dust records · Team WYRD</p>'); });
await at(total + 0.4);

const video = await page.video().path();
await ctx.close(); await browser.close();

execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", offset.toFixed(3), "-i", video, "-i", `${ROOT}/media/audio-local/local.mp3`,
  "-filter_complex", `[0:v]fps=30,scale=1920:1080:flags=lanczos,fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4[v];[1:a]adelay=${Math.round(LEAD * 1000)}:all=1[a]`,
  "-map", "[v]", "-map", "[a]", "-t", total.toFixed(2), "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
  "-metadata", "title=Dust Twins: 60-second demo (Team WYRD)",
  "-metadata", "comment=Screen recording of the Dust Twins app. Narration is SI-generated speech (ElevenLabs text-to-speech).",
  "-movflags", "+faststart", OUT], { stdio: "inherit" });
console.log(JSON.stringify({ out: OUT, seconds: +total.toFixed(2), cuts: S.map((t) => +t.toFixed(2)) }));
