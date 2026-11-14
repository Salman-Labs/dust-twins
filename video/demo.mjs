// Records the 30-second product demo from the real app and lays narration under it.
// The script drives the app like a visitor would and adds only what a video needs: a title card,
// an end card, short captions and camera moves (a CSS transform on the page; nothing is faked).
// Run from a folder with playwright installed:  node demo.mjs [base url]
// Written with SI assistance (Claude). Narration is SI-generated speech (ElevenLabs).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const ROOT = "/Users/salmankhan/Desktop/anemoia-saas/nasa-hackathon";
const AUDIO = `${ROOT}/media/audio-demo`;
const OUT = `${ROOT}/media/dust-twins-demo-30s.mp4`;
const W = 1280, H = 720, LEAD = 0.2, TAIL = 0.35;

const dur = (f) => parseFloat(execFileSync("ffprobe", ["-loglevel", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const clips = [1, 2, 3, 4, 5, 6, 7].map((i) => dur(`${AUDIO}/demo-${i}.mp3`));
const len = clips.map((d, i) => LEAD + d + TAIL + (i === 6 ? 1.6 : 0));   // the end card holds a little longer
const start = len.map((_, i) => len.slice(0, i).reduce((a, b) => a + b, 0));
const total = start[6] + len[6];
if (total > 29.9) throw new Error(`too long: ${total.toFixed(2)} s`);

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, recordVideo: { dir: "out-demo", size: { width: W, height: H } } });
await ctx.addInitScript(() => { try { localStorage.setItem("dust-twins-seen", "1"); } catch {} });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("ol li button");
await page.waitForTimeout(3500);   // textures and the first globe turn

// ---- what the video adds on top of the app ----
await page.addStyleTag({ content: `
  main { transform-origin: 0 0; transition: transform 1100ms cubic-bezier(.3,.7,.2,1); will-change: transform; }
  #v-card, #v-cap, #v-img { position: fixed; z-index: 100; font-family: var(--font-sans), sans-serif; color: #efe9df; transition: opacity 450ms ease-out; opacity: 0; pointer-events: none; }
  #v-card { inset: 0; background: #0b0a09; display: grid; place-content: center; text-align: center; }
  #v-card h1 { font-size: 112px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; display: flex; gap: 22px; align-items: center; justify-content: center; }
  #v-card p { margin-top: 26px; font-size: 30px; color: #a8a196; }
  #v-card .url { margin-top: 40px; font-family: var(--font-mono), monospace; font-size: 40px; color: #e6c07a; }
  #v-img { inset: 0; background: #0b0a09 url(/tex/insight_selfie.jpg) center/cover no-repeat; transform: scale(1.04); transition: opacity 450ms ease-out, transform 5s ease-out; }
  #v-cap { left: 0; right: 0; bottom: 0; height: 104px; background: #0b0a09; border-top: 1px solid rgba(239,233,223,0.12); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 30px; font-weight: 500; white-space: nowrap; }
  #v-cap small { display: block; font-size: 18px; font-weight: 400; color: #a8a196; margin-top: 2px; text-align: center; }
  nextjs-portal { display: none !important; }
  aside { transition: opacity 500ms ease-out; }
  body.v-solo aside { opacity: 0; }
` });
await page.evaluate(() => {
  for (const id of ["v-img", "v-card", "v-cap"]) { const d = document.createElement("div"); d.id = id; document.body.appendChild(d); }
  const mark = '<svg width="150" height="118" viewBox="10 14 44 36"><circle cx="27" cy="32" r="15" fill="none" stroke="#d9694a" stroke-width="4"/><circle cx="37" cy="32" r="15" fill="none" stroke="#8db8cc" stroke-width="4"/></svg>';
  const w = window;
  w.cam = { s: 1, x: 0, y: 0 };
  w.card = (html) => { const c = document.getElementById("v-card"); if (html) c.innerHTML = html.replace("{mark}", mark); c.style.opacity = html ? 1 : 0; };
  w.cap = (text, small) => { const c = document.getElementById("v-cap"); if (text) c.innerHTML = text + (small ? `<small>${small}</small>` : ""); c.style.opacity = text ? 1 : 0; };
  w.img = (on) => { const c = document.getElementById("v-img"); c.style.opacity = on ? 1 : 0; c.style.transform = on ? "scale(1.14)" : "scale(1.04)"; };
  /** Point the camera at a rectangle given in untransformed page pixels. */
  w.look = (x, y, wd, hd) => {
    const vh = innerHeight - 104;   // the caption band owns the bottom of the frame
    const s = wd ? Math.min(innerWidth / wd, vh / hd) : 1;
    const tx = wd ? (innerWidth - wd * s) / 2 - x * s : 0, ty = wd ? (vh - hd * s) / 2 - y * s : 0;
    w.cam = { s, x: tx, y: ty };
    document.querySelector("main").style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  };
  /** An element's rectangle as it would be with the camera at rest. */
  w.rect = (el) => { const r = el.getBoundingClientRect(), c = w.cam; return { x: (r.x - c.x) / c.s, y: (r.y - c.y) / c.s, w: r.width / c.s, h: r.height / c.s }; };
  w.lookAt = (sel, width, dy = 0) => {
    const el = typeof sel === "string" ? document.querySelector(sel) : sel, r = w.rect(el), hd = width * 9 / 16;
    const x = Math.max(0, Math.min(innerWidth - width, r.x + r.w / 2 - width / 2));
    w.look(x, Math.max(0, r.y + dy), width, hd);
  };
  w.byText = (tag, text) => [...document.querySelectorAll(tag)].find((e) => e.textContent.trim().startsWith(text));
});

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
  s.scrollIntoView({ block: "start" }); s.parentElement.scrollTop -= 96;
  window.lookAt(s, 560, -20); window.cap("A test calendar for every twin");
});
for (const [i, m] of [[0.9, 3], [1.5, 4], [2.1, 5], [2.7, 6]]) { await at(start[3] + i); await ev((mm) => { document.querySelectorAll('[aria-label="Test calendar by month"] button')[mm]?.click(); }, m); }
await at(start[4] - 0.3);
// 5. the model argues against the result
await ev(() => {
  const s = document.querySelector('[data-guide="challenge"]');
  s.scrollIntoView({ block: "start" }); s.parentElement.scrollTop -= 96;
  window.lookAt(s, 560, -16); window.cap("An SI model argues against our own result", "Every figure it cites is checked against the data");
});
await at(start[5] - 0.3);
// 6. evidence: rover ground truth
await ev(() => { const m = document.querySelector("main"); m.style.transition = "none"; window.look(0, 0, 0, 0); void m.offsetWidth; m.style.transition = ""; window.byText("button", "Evidence")?.click(); });
await page.waitForTimeout(350);
await ev(() => {
  const h = window.byText("h4", "Rover ground truth"); h.scrollIntoView({ block: "start" });
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
