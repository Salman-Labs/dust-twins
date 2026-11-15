// Renders the README images (banner, NASA data panel) from the HTML files beside this script, at 2x for sharp text.
// Run from a folder with puppeteer-core installed:  node render.cjs [path to Chrome]
// Written with SI assistance (Claude).
const path = require("path");
const puppeteer = require("puppeteer-core");

const CHROME = process.argv[2] || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.join(__dirname, "..");
const PAGES = [["banner.html", "banner.png"], ["nasa-data.html", "nasa-data.png"]];

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  for (const [html, png] of PAGES) {
    const p = await b.newPage();
    await p.setViewport({ width: 1280, height: 400, deviceScaleFactor: 2 });
    await p.goto("file://" + path.join(__dirname, html), { waitUntil: "networkidle0" });
    await p.evaluate(() => document.fonts.ready);
    const h = await p.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height) || 440);
    await p.screenshot({ path: path.join(OUT, png), clip: { x: 0, y: 0, width: 1280, height: h } });
    console.log(png, 1280 * 2, "x", h * 2);
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
