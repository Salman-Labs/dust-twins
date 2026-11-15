// Shared stage for the demo recordings: opens the app in a headless browser with video capture, and adds
// what a video needs on top of it (title card, caption band, camera moves). Nothing in the app is faked.
import { chromium } from "playwright";

export const W = 1280, H = 720;

export async function openStage(BASE, dir) {
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, recordVideo: { dir, size: { width: W, height: H } } });
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
  return { browser, ctx, page, t0 };
}
