// Builds the README images from the app's own data and visual language, then renders them at 2x.
//   found.png  the app's twin list for InSight, and the closest twin for every landing site
//   data.png   the two globes and the NASA records behind each
//   how.png    fingerprint ring, two rings lined up, the month bar with the test window
//   app.png    the running app in a browser frame (needs the app on BASE)
//   banner.png from banner.html
// Run from a folder with puppeteer-core installed:  node build.cjs [app url, default http://localhost:3100]
// Every figure is read from web/public/data. Written with SI assistance (Claude).
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const HERE = __dirname, OUT = path.join(HERE, ".."), DATA = path.join(HERE, "../../../web/public/data");
const BASE = process.argv[2] || "http://localhost:3100";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SITES = read("mars_sites.json").sites;
const EV = read("evidence.json");
const TW = Object.fromEntries(SITES.map((s) => [s.id, read(`twins_${s.id}.json`)]));

// same as App.tsx monthRange: "May-Aug"
function monthRange(names) {
  const on = MONTHS.map((m) => names.includes(m));
  const start = on.findIndex((v, i) => v && !on[(i + 11) % 12]);
  let end = start;
  while (on[(end + 1) % 12] && (end + 1) % 12 !== start) end = (end + 1) % 12;
  return start === end ? MONTHS[start] : `${MONTHS[start]}-${MONTHS[end]}`;
}

// same geometry as DustRing.tsx
const C = 160, R0 = 44, R1 = 122, VMAX = 2.4;
const pt = (i, v) => { const a = ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2; const r = R0 + (Math.min(v, VMAX) / VMAX) * (R1 - R0); return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
function ringPath(shape) {
  const p = shape.map((v, i) => pt(i, v)), n = p.length;
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}
function ring({ mars, earth, shift = 0, labels = false }) {
  const guides = [1, 2].map((v) => `<circle cx="${C}" cy="${C}" r="${R0 + (v / VMAX) * (R1 - R0)}" fill="none" stroke="rgba(239,233,223,.12)" ${v === 2 ? 'stroke-dasharray="2 4"' : ""}/>`).join("");
  const storm = `<path d="M${C},${C + R1 + 8} A${R1 + 8},${R1 + 8} 0 0 1 ${C},${C - R1 - 8}" fill="none" stroke="#d9694a" stroke-opacity=".35" stroke-width="1.5"/>`;
  const ls = labels ? [0, 90, 180, 270].map((l) => { const a = (l / 360) * Math.PI * 2 - Math.PI / 2; return `<text x="${C + (R1 + 24) * Math.cos(a)}" y="${C + (R1 + 24) * Math.sin(a) + 4}" text-anchor="middle" class="mono" font-size="11" fill="#7a746a">${l}°</text>`; }).join("") : "";
  const e = earth ? `<g transform="rotate(${shift * 30} ${C} ${C})"><path d="${ringPath(earth)}" fill="#8db8cc" fill-opacity=".08" stroke="#8db8cc" stroke-width="1.75"/></g>` : "";
  return `<svg viewBox="-10 -10 340 340" width="300" height="300">${guides}${storm}${ls}<path d="${ringPath(mars)}" fill="#d9694a" fill-opacity=".12" stroke="#d9694a" stroke-width="1.75"/>${e}</svg>`;
}

const HEAD = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@87.5,400;87.5,500&family=Schibsted+Grotesk:wght@400;500;600&display=block">
<style>
:root{--bg:#0b0a09;--surface:#121110;--ink:#efe9df;--dim:#a8a196;--mute:#7a746a;--line:rgba(239,233,223,.09);--mars:#d9694a;--earth:#8db8cc;--dust:#e6c07a}
html,body{background:none} body{margin:0;width:1280px;color:var(--ink);font-family:"Schibsted Grotesk",system-ui,sans-serif;position:relative} body>div{background:var(--bg);border-radius:24px;overflow:hidden}
.mono{font-family:"Martian Mono",monospace;font-stretch:87.5%;font-variant-numeric:tabular-nums}
.surface{background:var(--surface);border-radius:20px}
.label{font-size:17px;color:var(--dim)}
.eyebrow{font-family:"Martian Mono",monospace;font-stretch:87.5%;font-size:13px;letter-spacing:.12em;text-transform:uppercase}
.dim{color:var(--dim)} .mute{color:var(--mute)} .mars{color:var(--mars)} .earth{color:var(--earth)} .dust{color:var(--dust)}
code{font-family:"Martian Mono",monospace;font-stretch:87.5%;font-size:.86em;color:var(--ink);background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px}
</style></head><body>`;

// ---------- found: the app's twin list + closest twin per site ----------
function found() {
  const ins = SITES.find((s) => s.id === "insight"), f = TW.insight, { lo, hi } = f.scale;
  const rows = f.twins.slice(0, 5).map((t, i) => {
    const fill = Math.max(0.04, (t.score - lo) / (hi - lo || 1)), on = i === 0;
    return `<div style="position:relative;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:0 10px;padding:13px 16px;border-radius:12px;${on ? "background:rgba(255,255,255,.07)" : ""}">
      <span class="mono mute" style="font-size:15px">${i + 1}</span>
      <span><span style="display:block;font-size:20px;font-weight:500;line-height:1.3">${t.near}</span><span class="dim" style="display:block;font-size:15px;line-height:1.3">${t.country} · ${monthRange(t.test_months)}</span></span>
      <span class="mono" style="font-size:17px">${t.score.toFixed(2)}</span>
      <span style="position:absolute;bottom:0;left:16px;height:2px;width:calc((100% - 32px) * ${fill.toFixed(3)});background:${on ? "var(--dust)" : "rgba(255,255,255,.14)"}"></span></div>`;
  }).join("");
  const sites = SITES.map((s, i) => {
    const t = TW[s.id].twins[0];
    return `<div style="display:grid;grid-template-columns:22px 210px 70px 1fr auto;align-items:center;gap:0 10px;padding:15px 4px;${i ? "border-top:1px solid var(--line)" : ""}">
      <span style="width:9px;height:9px;border-radius:50%;${s.id === "insight" ? "background:var(--mars)" : "border:1.5px solid var(--mute)"}"></span>
      <span><span style="display:block;font-size:20px;font-weight:500;line-height:1.3">${s.name}</span><span class="dim" style="display:block;font-size:15px;line-height:1.3">${s.place}</span></span>
      <svg width="70" height="12"><path d="M2 6 H62" stroke="#e8dcc0" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="5 5"/><circle cx="66" cy="6" r="3" fill="#e8dcc0"/></svg>
      <span><span style="display:block;font-size:20px;font-weight:500;line-height:1.3">${t.near}</span><span class="dim" style="display:block;font-size:15px;line-height:1.3">${t.country.replace("Central African Republic", "C. African Rep.")} · ${monthRange(t.test_months)}</span></span>
      <span class="mono" style="font-size:17px">${t.score.toFixed(2)}</span></div>`;
  }).join("");
  const base = SITES.map((s) => EV.sites[s.id].shuffle.null_p99), above = SITES.every((s) => EV.sites[s.id].shuffle.top10_above_null === 10);
  return HEAD + `<div style="padding:40px 48px;display:grid;grid-template-columns:500px 1fr;gap:28px;align-items:start">
    <div class="surface" style="padding:22px 14px 16px">
      <div class="label" style="padding:0 16px 10px"><span class="mars">Mars</span> ${ins.place} · its Earth twins</div>${rows}
      <div class="mute" style="display:flex;justify-content:space-between;padding:14px 16px 2px;font-size:14px"><span>Line length: match above the shuffled baseline</span><span class="dim">All 10 in the app</span></div>
    </div>
    <div class="surface" style="padding:22px 26px 12px">
      <div class="label" style="padding-bottom:6px">Closest Earth twin for each landing site</div>${sites}
      <div class="mute" style="padding:12px 4px 6px;font-size:14px">${above ? "All ten top twins beat the shuffled baseline at every site" : ""} (baseline ${Math.min(...base).toFixed(2)} to ${Math.max(...base).toFixed(2)})</div>
    </div></div></body></html>`;
}

// ---------- data: the app's own two-globe view, and the NASA record behind each planet ----------
function data() {
  const rv = SITES.filter((s) => EV.sites[s.id].rover).map((s) => `<span style="white-space:nowrap">${s.name}<span class="mono dim" style="margin-left:10px">r ${EV.sites[s.id].rover.r.toFixed(2)}</span></span>`).join('<span class="mute" style="margin:0 18px">·</span>');
  const m = EV.meta;
  const col = (cls, n, unit, lines) => `<div>
      <div class="eyebrow ${cls}">${cls === "mars" ? "Mars" : "Earth"}</div>
      <div style="margin-top:12px;display:flex;align-items:baseline;gap:12px"><span class="mono" style="font-size:52px;line-height:1">${n}</span><span style="font-size:22px;font-weight:500">${unit}</span></div>
      <div class="dim" style="margin-top:12px;font-size:17px;line-height:1.6">${lines}</div></div>`;
  return HEAD + `<div style="padding:44px 64px 40px">
    <div style="text-align:center"><div class="eyebrow dust">Built on NASA open data</div>
      <div style="margin-top:12px;font-size:32px;font-weight:600;letter-spacing:-.01em">The same fingerprint, on both planets</div>
      <div class="dim" style="margin-top:8px;font-size:17px">${m.mars_years.replace("MY", "Mars Year ").replace("-MY", " to ")} on Mars · ${m.earth_years.replace("-", " to ")} on Earth · the same era</div></div>
    <img src="globes-crop.png" style="display:block;width:1000px;margin:18px auto 0">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:72px;margin-top:10px">
      ${col("mars", 13, "Mars years of dust maps", `From NASA orbiters: TES on Mars Global Surveyor, THEMIS on Mars Odyssey and MCS on Mars Reconnaissance Orbiter, in the Montabone et al. climatology. ${(60 * 120).toLocaleString("en-US")} cells on a 3° grid`)}
      ${col("earth", 24, "years of Earth dust", `NASA MERRA-2 from GES DISC: dust optical depth <code>M2TMNXAER</code> on ${m.earth_cells_scored.toLocaleString("en-US")} dusty land cells, plus surface wind <code>M2TMNXFLX</code> and land fraction <code>M2C0NXASM</code>`)}
    </div>
    <div style="margin-top:34px;padding-top:24px;border-top:1px solid var(--line);text-align:center">
      <div style="font-size:18px"><span class="eyebrow mute" style="margin-right:18px">Ground truth</span><span class="dim">Three missions measured dust in their own sky. The Mars record matches them</span></div>
      <div style="margin-top:14px;font-size:19px">${rv}</div></div>
  </div></body></html>`;
}

// ---------- how: fingerprint, match, test window ----------
function how() {
  const site = SITES.find((s) => s.id === "insight"), t = TW.insight.twins[0];
  const marsRow = MONTHS.map((_, j) => site.shape[t.mars_bin[j]]);
  const top = Math.max(1.6, ...t.shape, ...marsRow);
  const bars = MONTHS.map((mo, j) => {
    const on = t.test_months.includes(mo);
    return `<div style="display:flex;flex-direction:column;align-items:stretch;padding:6px 2px;border-radius:8px;${on ? "background:rgba(255,255,255,.08)" : ""}">
      <div style="height:46px;display:flex;align-items:flex-end"><div style="width:100%;border-radius:3px;height:${((t.shape[j] / top) * 100).toFixed(0)}%;background:#8db8cc;opacity:${on ? 1 : 0.45}"></div></div>
      <div class="mono" style="text-align:center;font-size:13px;padding:6px 0;color:${on ? "var(--ink)" : "var(--mute)"}">${mo[0]}</div>
      <div style="height:46px;display:flex;align-items:flex-start"><div style="width:100%;border-radius:3px;height:${((marsRow[j] / top) * 100).toFixed(0)}%;background:#d9694a;opacity:${on ? 1 : 0.45}"></div></div></div>`;
  }).join("");
  const card = (n, title, visual, text) => `<div class="surface" style="padding:26px 26px 28px;display:flex;flex-direction:column">
      <div style="display:flex;align-items:baseline;gap:12px"><span class="mono mute" style="font-size:14px">${n}</span><span style="font-size:23px;font-weight:500">${title}</span></div>
      <div style="height:300px;display:grid;place-items:center;margin:8px 0 4px">${visual}</div>
      <div class="dim" style="font-size:16px;line-height:1.55">${text}</div></div>`;
  return HEAD + `<div style="padding:40px 48px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
    ${card("01", "Fingerprint every place", ring({ mars: site.shape, labels: true }), `One year of dust as a ring: further out is dustier than the place's own average. Plus how often months run stormy, its haze rank and its year-to-year swing.`)}
    ${card("02", "Turn Earth's year to fit", ring({ mars: site.shape, earth: t.shape, shift: t.shift }), `<span class="mars">${site.place}</span> stays put. <span class="earth">${t.near}</span> turns ${t.shift} months until the shapes line up. Only patterns and ranks are compared, never raw values.`)}
    ${card("03", "Read off the test window", `<div style="width:100%"><div style="display:grid;grid-template-columns:repeat(12,1fr);gap:3px">${bars}</div><div style="display:flex;justify-content:space-between;margin-top:12px;font-size:14px"><span class="earth">Earth months</span><span class="mars">Mars season they rehearse</span></div></div>`, `The lined-up months are the test window. For ${t.near}, <span style="color:var(--ink)">${monthRange(t.test_months).replace("-", " to ")}</span> rehearses the dustiest stretch of the Martian year at ${site.place}.`)}
  </div></body></html>`;
}

// ---------- app: the running app in a browser frame ----------
const appFrame = () => HEAD + `<div style="padding:36px 56px 40px">
  <div style="border-radius:16px;overflow:hidden;border:1px solid rgba(239,233,223,.14);box-shadow:0 30px 80px rgba(0,0,0,.6)">
    <div style="height:38px;background:#171614;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid var(--line)">
      <span style="width:11px;height:11px;border-radius:50%;background:#3a3631"></span><span style="width:11px;height:11px;border-radius:50%;background:#3a3631"></span><span style="width:11px;height:11px;border-radius:50%;background:#3a3631"></span>
      <span class="mono dim" style="margin:0 auto;font-size:13px;background:rgba(255,255,255,.05);padding:4px 14px;border-radius:8px">dust-twins.vercel.app</span></div>
    <img src="app-shot.png" style="display:block;width:100%">
  </div></div></body></html>`;

(async () => {
  for (const [name, html] of [["found", found()], ["data", data()], ["how", how()], ["app", appFrame()]]) fs.writeFileSync(path.join(HERE, name + ".html"), html);
  const b = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  // app screenshot first (the frame embeds it)
  const a = await b.newPage();
  await a.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await a.evaluateOnNewDocument(() => { try { localStorage.setItem("dust-twins-seen", "1"); } catch {} });
  await a.goto(BASE, { waitUntil: "networkidle2" });
  await a.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await new Promise((r) => setTimeout(r, 4000));
  await a.screenshot({ path: path.join(HERE, "app-shot.png") });
  await a.screenshot({ path: path.join(HERE, "globes-crop.png"), clip: { x: 300, y: 222, width: 760, height: 376 } });   // the two globes and their arc
  await a.close();
  for (const name of ["banner", "found", "data", "how", "app"]) {
    const p = await b.newPage();
    await p.setViewport({ width: 1280, height: 400, deviceScaleFactor: 2 });
    await p.goto("file://" + path.join(HERE, name + ".html"), { waitUntil: "networkidle0" });
    await p.evaluate(() => document.fonts.ready);
    const h = await p.evaluate(() => Math.ceil(document.body.scrollHeight));
    await p.screenshot({ path: path.join(OUT, name + ".png"), clip: { x: 0, y: 0, width: 1280, height: h }, omitBackground: true });   // rounded card, transparent outside
    console.log(name + ".png", 2560, "x", h * 2);
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
