// Record the auto-playing story and note when each beat starts, so narration can be laid under it.
import { chromium } from "playwright";
import fs from "node:fs";
const URL = process.argv[2] ?? "http://localhost:3100/?story=auto";
const W = 1600, H = 900;
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: "out", size: { width: W, height: H } }, reducedMotion: "no-preference" });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded" });
const beats = [];
let last = "";
for (;;) {
  const label = await page.evaluate(() => {
    const d = document.querySelector('[aria-label="Story mode"]');
    return d ? d.querySelector("p")?.textContent ?? "" : null;
  });
  const t = (Date.now() - t0) / 1000;
  if (label === null && beats.length) { beats.push({ label: "END", t }); break; }
  if (label && label !== last) { beats.push({ label, t }); last = label; }
  if (t > 60) break;
  await page.waitForTimeout(40);
}
await page.waitForTimeout(4500);   // hold on the live app after the story
const gl = await page.evaluate(() => { const c = document.querySelector("canvas"); const g = c?.getContext("webgl2"); const e = g?.getExtension("WEBGL_debug_renderer_info"); return g && e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "no webgl"; });
const video = await page.video().path();
await ctx.close(); await browser.close();
fs.writeFileSync("beats.json", JSON.stringify({ beats, video, gl }, null, 1));
console.log(JSON.stringify({ beats, video, gl }));
