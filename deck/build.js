// Builds the 7-slide Dust Twins deck (media/dust-twins-deck.pptx).
// Run from a folder with pptxgenjs installed:  node build.js
// Every number comes from web/public/data/evidence.json and the twins files. Written with SI assistance (Claude).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const ROOT = "/Users/salmankhan/Desktop/anemoia-saas/nasa-hackathon";
const IMG = (f) => path.join(ROOT, "deck/img", f);
const OUT = path.join(ROOT, "media/dust-twins-deck.pptx");

// The app's own palette: a warm near-black, off-white ink, Mars red and Earth blue as data colours, sand as the one accent.
const THEME = {
  name: "Dust Twins", headFontFace: "Arial", bodyFontFace: "Arial",
  colors: { dk1: "EFE9DF", lt1: "0B0A09", dk2: "A8A196", lt2: "181715", accent1: "D9694A", accent2: "8DB8CC", accent3: "E6C07A", accent4: "9FC48D", accent5: "7A746A", accent6: "2A2824", hlink: "E6C07A", folHlink: "E6C07A" },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";   // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Dust Twins";
pres.author = "Team WYRD";
const C = pres.SchemeColor;
const INK = C.text1, DIM = C.text2, BG = C.background1, SURF = C.background2, MARS = C.accent1, EARTH = C.accent2, DUST = C.accent3, OK = C.accent4, MUTE = C.accent5, LINE = C.accent6;
const M = 0.6, W = 13.333, H = 7.5;

const footer = [
  { text: { text: "Dust Twins · Team WYRD · NASA Space Apps Challenge 2026", options: { x: M, y: 6.95, w: 8, h: 0.3, fontSize: 10, color: MUTE, margin: 0 } } },
];
pres.defineSlideMaster({
  title: "Cover", background: { color: THEME.colors.lt1 },
  objects: [],
});
pres.defineSlideMaster({
  title: "Content", background: { color: THEME.colors.lt1 },
  objects: [...footer, { placeholder: { options: { name: "title", type: "title", x: M, y: 0.5, w: W - 2 * M, h: 0.95, fontSize: 32, bold: true, color: INK, align: "left", valign: "top", margin: 0 }, text: "" } }],
  slideNumber: { x: W - M - 0.6, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: MUTE, align: "right" },
});

const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: INK, fontSize: 15, valign: "top", ...o });
/** The mark: two overlapping rings, Mars and Earth. */
function mark(s, x, y, d) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { type: "none" }, line: { color: MARS, width: d * 9 }, objectName: "Mark Mars ring" });
  s.addShape(pres.ShapeType.ellipse, { x: x + d * 0.34, y, w: d, h: d, fill: { type: "none" }, line: { color: EARTH, width: d * 9 }, objectName: "Mark Earth ring" });
}
/** A rounded panel on the surface colour. */
const panel = (s, x, y, w, h, name) => s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: SURF }, line: { color: LINE, width: 0.75 }, objectName: name });
/** A big figure with a label under it. */
function stat(s, x, y, w, figure, label, color = INK) {
  T(s, figure, { x, y, w, h: 0.95, fontSize: 54, bold: true, color, objectName: `Stat ${figure}` });
  T(s, label, { x, y: y + 1.0, w, h: 0.9, fontSize: 14, color: DIM });
}

// ---------- 1. Cover ----------
pres.addSection({ title: "Dust Twins" });
{
  const s = pres.addSlide({ masterName: "Cover", sectionTitle: "Dust Twins" });
  s.addImage({ path: IMG("globes-pk.png"), x: 6.2, y: 1.15, w: 7.13, h: 5.15, altText: "Mars and Earth globes joined by a dashed thread from InSight's landing site to its twin in Sindh, Pakistan" });
  mark(s, M, 1.55, 0.62);
  T(s, "Dust Twins", { x: M, y: 2.5, w: 6, h: 1.1, fontSize: 66, bold: true });
  T(s, "Where on Earth does dust behave like it does at a Mars landing site, and in which months?", { x: M, y: 3.75, w: 5.0, h: 1.3, fontSize: 21, color: DIM });
  T(s, "dust-twins.vercel.app", { x: M, y: 5.45, w: 5, h: 0.4, fontSize: 18, color: DUST, fontFace: "Courier New" });
  T(s, "Team WYRD · NASA Space Apps Challenge 2026\nChallenge: Earth locations that analog Moon base sites and Mars", { x: M, y: 6.25, w: 6.4, h: 0.7, fontSize: 13, color: MUTE });
  s.addNotes("Dust Twins matches Mars landing sites to places on Earth by how atmospheric dust behaves over a year, and gives each match a month-by-month test calendar.");
}

// ---------- 2. Problem ----------
{
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Dust Twins" });
  s.addText("Dust ends solar-powered Mars missions", { placeholder: "title" });
  s.addImage({ path: IMG("insight_selfie.jpg"), x: M, y: 1.65, w: 6.4, h: 4.2, sizing: { type: "cover", w: 6.4, h: 4.2 }, altText: "InSight's final selfie, its solar panels covered in red dust" });
  T(s, "InSight's final selfie, April 2022 · NASA/JPL-Caltech", { x: M, y: 5.95, w: 6.4, h: 0.3, fontSize: 11, color: MUTE });
  stat(s, 7.6, 1.6, 2.5, "2022", "InSight lost power as dust buried its solar panels", MARS);
  stat(s, 10.4, 1.6, 2.4, "2018", "A planet-wide dust storm ended the Opportunity rover", MARS);
  T(s, "Dust-cleaning hardware is tested in chambers. We found no field site on Earth chosen for how its dust behaves.", { x: 7.6, y: 3.85, w: 5.1, h: 1.0, fontSize: 16 });
  panel(s, 7.6, 5.0, 5.13, 1.25, "Question panel");
  T(s, "Our question", { x: 7.85, y: 5.15, w: 4.6, h: 0.3, fontSize: 12, color: DUST });
  T(s, "Where on Earth does dust behave like it does at a Mars landing site, and when?", { x: 7.85, y: 5.47, w: 4.65, h: 0.7, fontSize: 16, bold: true });
  s.addNotes("Two NASA missions were ended by dust. The challenge asks for analogs that matter to robotic operations and for processes as well as places. Dust is both.");
}

// ---------- 3. Data ----------
{
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Dust Twins" });
  s.addText("Two planets' dust records, compared like for like", { placeholder: "title" });
  const cards = [
    ["13", "Mars years of daily dust maps", "Built from NASA orbiter instruments (Montabone et al.). 7,200 cells across the planet", MARS],
    ["24", "years of NASA MERRA-2 dust", "1999 to 2022, the same era as the Mars record. 2,230 dusty land cells", EARTH],
    ["3", "missions as ground truth", "Dust measured in their own sky by Opportunity, Spirit and InSight", DUST],
  ];
  cards.forEach(([n, head, body, col], i) => {
    const x = M + i * 4.11;
    panel(s, x, 1.65, 3.9, 2.55, `Data card ${i + 1}`);
    T(s, n, { x: x + 0.3, y: 1.8, w: 3.3, h: 0.95, fontSize: 60, bold: true, color: col });
    T(s, head, { x: x + 0.3, y: 2.85, w: 3.3, h: 0.35, fontSize: 16, bold: true });
    T(s, body, { x: x + 0.3, y: 3.25, w: 3.3, h: 0.8, fontSize: 13, color: DIM });
  });
  const steps = [
    ["Fingerprint", "Four numbers for every place: the shape of its dust year, how often months run stormy, its haze rank on its own planet, and its year-to-year swing"],
    ["Match", "Turn Earth's year month by month until its shape fits the Mars site. Only patterns and ranks are compared, never raw values"],
    ["Check", "Seven method checks, including a shuffled baseline and the rovers' own readings. All are published, whichever way they came out"],
  ];
  steps.forEach(([head, body], i) => {
    const x = M + i * 4.11;
    s.addShape(pres.ShapeType.ellipse, { x, y: 4.62, w: 0.42, h: 0.42, fill: { color: INK }, line: { type: "none" }, objectName: `Step ${i + 1} badge` });
    s.addText(String(i + 1), { isTextBox: true, x, y: 4.62, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: BG, align: "center", valign: "middle", margin: 0 });
    T(s, head, { x: x + 0.58, y: 4.66, w: 3.2, h: 0.35, fontSize: 18, bold: true });
    T(s, body, { x, y: 5.2, w: 3.8, h: 1.4, fontSize: 13, color: DIM });
  });
  s.addNotes("Mars dust is measured in infrared from orbit and Earth dust in visible light from a reanalysis. Every number in the fingerprint is a ratio or a rank, so the conversion factor between the two cancels out.");
}

// ---------- 4. Method picture ----------
{
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Dust Twins" });
  s.addText("Turn Earth's year until the two rings lock", { placeholder: "title" });
  s.addImage({ path: IMG("rings.png"), x: M, y: 1.6, w: 5.05, h: 5.13, altText: "Two overlaid dust rings: Mars in red and Earth in blue, the Earth ring turned three months" });
  const pts = [
    ["A ring is one year of dust", "Further from the centre means dustier than that place's own average", MARS],
    ["Turning the ring is the season shift", "For Khairpur, Sindh, Earth's year turns three months to fit InSight's site", EARTH],
    ["The lined-up months are the test window", "April to July there rehearses the dustiest stretch of the Martian year", DUST],
  ];
  pts.forEach(([head, body, col], i) => {
    const y = 1.65 + i * 1.02;
    s.addShape(pres.ShapeType.ellipse, { x: 6.2, y: y + 0.08, w: 0.2, h: 0.2, fill: { color: col }, line: { type: "none" }, objectName: `Point ${i + 1} dot` });
    T(s, head, { x: 6.6, y, w: 6.1, h: 0.35, fontSize: 17, bold: true });
    T(s, body, { x: 6.6, y: y + 0.38, w: 6.1, h: 0.5, fontSize: 13, color: DIM });
  });
  s.addImage({ path: IMG("calendar.png"), x: 6.2, y: 4.72, w: 2.85, h: 2.015, altText: "The test calendar: twelve months with April to July highlighted" });
  T(s, "Every twin gets this calendar. Each month also shows how often it strayed from its usual level across 24 years", { x: 9.3, y: 4.85, w: 3.4, h: 1.5, fontSize: 13, color: DIM });
  s.addNotes("This is the signature of the tool: the same chart is the fingerprint, the comparison and the calendar.");
}

// ---------- 5. Results ----------
{
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Dust Twins" });
  s.addText("Each landing site gets ten Earth twins and a test window", { placeholder: "title" });
  s.addImage({ path: IMG("globes-pk.png"), x: M, y: 1.6, w: 5.6, h: 4.04, altText: "The thread from InSight's landing site to its twin in Sindh, Pakistan" });
  T(s, "InSight's site and its twin at Khairpur, Sindh", { x: M, y: 5.75, w: 5.6, h: 0.3, fontSize: 11, color: MUTE });
  const head = { bold: true, color: DIM, fontSize: 12, fill: { color: BG }, border: [{ type: "none" }, { type: "none" }, { type: "solid", color: THEME.colors.accent6, pt: 1 }, { type: "none" }] };
  const cell = (t, o = {}) => ({ text: t, options: { color: INK, fontSize: 14, fill: { color: BG }, border: [{ type: "none" }, { type: "none" }, { type: "solid", color: THEME.colors.accent6, pt: 0.75 }, { type: "none" }], valign: "middle", ...o } });
  s.addTable([
    [{ text: "Mars site", options: head }, { text: "Closest Earth twin", options: head }, { text: "Match", options: { ...head, align: "right" } }, { text: "Test window", options: head }],
    [cell("InSight"), cell("Bechar, Algeria"), cell("0.89", { align: "right", fontFace: "Courier New" }), cell("May to Aug")],
    [cell("Opportunity"), cell("Vihari, Punjab, Pakistan"), cell("0.88", { align: "right", fontFace: "Courier New" }), cell("Apr to Jul")],
    [cell("Spirit"), cell("Diplo, Sindh, Pakistan"), cell("0.88", { align: "right", fontFace: "Courier New" }), cell("Mar to Jun")],
  ], { x: 6.6, y: 1.6, w: 6.13, colW: [1.4, 2.6, 0.8, 1.33], rowH: 0.46, objectName: "Top twins table" });
  stat(s, 6.6, 3.95, 2.0, "0.89", "best match, against 0.73 for shuffled seasons", DUST);
  stat(s, 8.75, 3.95, 2.0, "10/10", "of InSight's top twins beat that baseline");
  stat(s, 10.9, 3.95, 1.85, "0", "are famous analog sites");
  T(s, "The Pakistan twins match on timing but sit in a different dust regime from their Mars sites. The app says so on each card.", { x: 6.6, y: 5.95, w: 6.13, h: 0.7, fontSize: 13, color: DIM });
  s.addNotes("Scores for the top ten sit close together, about 0.85 to 0.89, so read each result as a set of similar regions and not one winner.");
}

// ---------- 6. Evidence ----------
{
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Dust Twins" });
  s.addText("We publish the checks that came out weak, too", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "Rover vs orbit", labels: ["InSight", "Opportunity", "Spirit"], values: [0.94, 0.79, 0.97] }], {
    x: M, y: 1.6, w: 4.6, h: 4.4, barDir: "col", chartColors: [THEME.colors.accent1], showLegend: false,
    showTitle: true, title: "Rover readings vs the orbital record (correlation)", titleFontSize: 12, titleColor: THEME.colors.dk2, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: THEME.colors.dk1, dataLabelFontSize: 13, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0.00",
    catAxisLabelColor: THEME.colors.dk2, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: THEME.colors.accent5, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valGridLine: { color: THEME.colors.accent6, size: 0.5 }, catGridLine: { style: "none" },
    plotArea: { fill: { color: THEME.colors.lt1 } }, chartArea: { fill: { color: THEME.colors.lt1 } }, barGapWidthPct: 80, objectName: "Rover agreement chart",
  });
  T(s, "Each rover measured dust in its own sky. The orbital maps we used agree with all three.", { x: M, y: 6.1, w: 4.6, h: 0.6, fontSize: 12, color: MUTE });
  const col = (x, w, title, color, rows) => {
    T(s, title, { x, y: 1.6, w, h: 0.4, fontSize: 18, bold: true, color });
    rows.forEach(([h2, b], i) => {
      const y = 2.15 + i * 1.08;
      T(s, h2, { x, y, w, h: 0.32, fontSize: 14, bold: true });
      T(s, b, { x, y: y + 0.34, w, h: 0.62, fontSize: 12, color: DIM });
    });
  };
  col(5.7, 3.4, "Holds", OK, [
    ["Shuffled baseline", "All ten of InSight's top twins beat matches made with scrambled months"],
    ["Storm-year detector", "Found Mars's three global storms (2001, 2007, 2018) with no list to go on"],
    ["Mars-to-Mars self test", "A site's own neighbours rank above 99% of the planet"],
    ["Pressure choice", "Switching dust products leaves the ranking almost unchanged (0.96 to 0.995)"],
  ]);
  col(9.4, 3.33, "Weak", DUST, [
    ["Split years", "Odd and even years agree only moderately: 0.56 to 0.75"],
    ["Weight robustness", "No twin stays in the top 50 under 90% of random weightings; the best reach 74 to 88%"],
    ["Dust regimes", "Only 2 to 5 of each site's ten twins share its dust regime"],
    ["Pre-registration", "We did not write our expectations down before running it"],
  ]);
  s.addNotes("Validity is where an analog claim is weakest, so every check is in the app, with the weak ones marked weak.");
}

// ---------- 7. SI and close ----------
{
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Dust Twins" });
  s.addText("An SI model argues against our own result", { placeholder: "title" });
  s.addImage({ path: IMG("challenge.png"), x: M, y: 1.6, w: 3.12, h: 5.1, altText: "The app's 'Argue against this twin' panel listing three reasons the match could fail" });
  const pts = [
    ["It reads only our figures", "The model (Gemini) is given the pipeline's numbers for one twin and nothing else"],
    ["Every number is checked", "A reason that cites a figure not in the data is dropped, and the count is shown"],
    ["You can ask it to plan", "A question such as “where in Pakistan, and when?” is looked up step by step and turns the globes"],
  ];
  pts.forEach(([h2, b], i) => {
    const y = 1.62 + i * 1.02;
    T(s, h2, { x: 4.2, y, w: 4.3, h: 0.35, fontSize: 17, bold: true });
    T(s, b, { x: 4.2, y: y + 0.38, w: 4.3, h: 0.55, fontSize: 13, color: DIM });
  });
  T(s, "What Earth can never copy", { x: 4.2, y: 4.85, w: 4.3, h: 0.3, fontSize: 12, color: DUST });
  T(s, "Thin air, 38% gravity, static-charged dust, no rain or dew. These are candidate test windows to check on site, not predictions of dust settling or power loss.", { x: 4.2, y: 5.2, w: 4.3, h: 1.4, fontSize: 13, color: DIM });
  panel(s, 8.95, 1.6, 3.78, 5.1, "Closing panel");
  mark(s, 9.3, 1.95, 0.42);
  T(s, "Test on Earth,\nbefore you fly", { x: 9.3, y: 2.75, w: 3.2, h: 1.2, fontSize: 26, bold: true });
  T(s, "Live app", { x: 9.3, y: 4.15, w: 3.2, h: 0.28, fontSize: 12, color: MUTE });
  T(s, "dust-twins.vercel.app", { x: 9.3, y: 4.43, w: 3.3, h: 0.35, fontSize: 15, color: DUST, fontFace: "Courier New" });
  T(s, "Code and data pipeline", { x: 9.3, y: 4.95, w: 3.2, h: 0.28, fontSize: 12, color: MUTE });
  T(s, "github.com/Salman-Labs/dust-twins", { x: 9.3, y: 5.23, w: 3.35, h: 0.35, fontSize: 10.5, color: INK, fontFace: "Courier New" });
  T(s, "SI tools (Claude, Gemini, ElevenLabs) were used and are declared in the README", { x: 9.3, y: 5.8, w: 3.2, h: 0.7, fontSize: 11, color: MUTE });
  s.addNotes("The model is turned on our own result. It can only quote the pipeline's figures, and anything it cannot trace is removed before display.");
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
