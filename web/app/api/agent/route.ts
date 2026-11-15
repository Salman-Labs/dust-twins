// SI features (Gemini): "challenge this twin" and "ask the planner". Written with SI assistance (Claude).
//
// Grounding: the model only ever sees figures from the pipeline's result files, and every number it
// writes is checked against those figures afterwards. Reasons that cite an untraceable number are dropped.
//
// Abuse guards: short inputs, capped tool steps and output, per-IP rate limit on the shared key,
// read-only tools, narrow system prompt. Visitors can send their own key in x-user-key; it is used
// for that one request and never stored or logged.
import evidenceFile from "@/public/data/evidence.json";
import sitesFile from "@/public/data/mars_sites.json";
import tCuriosity from "@/public/data/twins_curiosity.json";
import tInsight from "@/public/data/twins_insight.json";
import tOpportunity from "@/public/data/twins_opportunity.json";
import tPerseverance from "@/public/data/twins_perseverance.json";
import tSpirit from "@/public/data/twins_spirit.json";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Low thinking: with the default, reasoning ate the output budget and replies took 20 to 50 seconds.
const MODEL = "gemini-flash-lite-latest";   // the lite model: several times cheaper and faster, so a public demo can take many visitors
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SITES: any[] = (sitesFile as any).sites;
const EV: any = evidenceFile;
const TWINS: Record<string, any[]> = {
  insight: (tInsight as any).twins, opportunity: (tOpportunity as any).twins, spirit: (tSpirit as any).twins,
  perseverance: (tPerseverance as any).twins, curiosity: (tCuriosity as any).twins,
};
const REGIMES: any[] = EV.regimes.regimes;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LIMITS = [
  "Mars surface pressure is under 1% of Earth's, so wind lifts and drops dust differently",
  "Mars gravity is 38% of Earth's, so dust settles more slowly",
  "Dry Martian dust holds static charge; Earth humidity bleeds it away",
  "Martian dust is finer (about 1.5 micrometres) and iron-rich; Earth dust is coarser and mixed with pollution",
  "There is no rain or dew on Mars; on Earth both clean panels and cement dust onto them",
  "Mars dust is measured in infrared from orbit and Earth dust in visible light from a reanalysis model, so only patterns and ranks are compared",
  "Dust in the sky is not dust on a panel: wind cleaning mattered as much as dust loading on Mars",
  "Storminess is measured on monthly means, so short storms are smoothed out",
];

// ---------- facts the model is allowed to see ----------

const siteFacts = (s: any) => ({
  id: s.id, lander: s.name, place: s.place, wind_cleaning_on_mars: s.cleaning, note: s.note,
  dust_regime: REGIMES[s.regime].name, regime_share_of_mars: REGIMES[s.regime].mars_share, regime_share_of_earth: REGIMES[s.regime].earth_share,
  share_of_months_stormy: s.storm, haze_rank_on_mars: s.haze, year_to_year_swing: s.var, orbital_data_reliability: s.reliability,
});

const twinBrief = (t: any, i: number) => ({
  rank: i + 1, place: t.place, country: t.country, match_score: t.score, test_months: t.test_months,
  winds: t.wind_tag, same_dust_regime_as_site: t.same_regime, beats_shuffled_baseline: t.beats_null, known_famous_analog: t.famous,
});

const PART_NAMES: Record<string, string> = { season: "seasonal shape", storminess: "storminess", haze: "usual haze rank", variability: "year-to-year swing" };
function weakest(t: any, strongest = false) {
  const [k, v] = Object.entries(t.components as Record<string, number>).sort((a, b) => (strongest ? b[1] - a[1] : a[1] - b[1]))[0];
  return `${PART_NAMES[k]} at ${v}`;
}

const twinFacts = (t: any, i: number) => ({
  ...twinBrief(t, i), lat: t.lat, lon: t.lon, dust_regime: REGIMES[t.regime].name,
  match_by_part: { seasonal_shape: t.components.season, storminess: t.components.storminess, usual_haze_rank: t.components.haze, year_to_year_swing: t.components.variability },
  // stated outright so the model never has to compare numbers itself (the lite model gets comparisons wrong)
  weakest_part_of_the_match: weakest(t), strongest_part_of_the_match: weakest(t, true),
  month_that_strays_most_often: MONTHS[t.off_years.indexOf(Math.max(...t.off_years))], years_that_month_strayed: Math.max(...t.off_years),
  earth_year_turned_by_months: t.shift,
  pattern_match_by_month: Object.fromEntries(MONTHS.map((m, j) => [m, t.month_match[j]])),
  years_each_month_strayed_from_normal: Object.fromEntries(MONTHS.map((m, j) => [m, t.off_years[j]])), years_of_record: t.n_years,
  share_of_months_stormy: t.storm, haze_rank_on_earth: t.haze, year_to_year_swing: t.var,
  share_of_random_weightings_in_top_50: t.robust, wind_speed_percentile_among_scored_land: t.wind_pct,
});

const checkFacts = (id: string) => {
  const e = EV.sites[id];
  return {
    best_score: e.top_score, shuffled_baseline_99th_percentile: e.shuffle.null_p99, top10_above_baseline: e.shuffle.top10_above_null,
    split_years_rank_agreement: e.split_years.spearman, split_years_top50_overlap: e.split_years.top50_overlap,
    mars_neighbours_percentile: e.mars_self_test.neighbour_percentile, pressure_choice_rank_agreement: e.pressure_sensitivity.spearman,
    rover_vs_orbit_correlation: e.rover?.r ?? null, rover_month_stretches_compared: e.rover?.n ?? null,
    top10_in_same_dust_regime: e.same_regime_in_top10, top10_famous_sites: e.famous_in_top10,
    expectations_registered_before_the_run: "no",
    storm_year_detector: { mars_years_flagged: EV.storm_years.found, known_global_storm_years: EV.storm_years.known, earth_years_flagged: EV.storm_years.earth_flagged },
  };
};

// ---------- number check ----------

function allowedNumbers(obj: unknown, out = new Set<number>()): Set<number> {
  const add = (v: number) => { for (const d of [0, 1, 2, 3]) { out.add(+v.toFixed(d)); out.add(+(v * 100).toFixed(d)); } };
  if (typeof obj === "number") add(obj);
  else if (typeof obj === "string") for (const m of obj.match(/\d+(?:\.\d+)?/g) ?? []) add(parseFloat(m));
  else if (Array.isArray(obj)) obj.forEach((x) => allowedNumbers(x, out));
  else if (obj && typeof obj === "object") for (const [k, x] of Object.entries(obj)) { allowedNumbers(k, out); allowedNumbers(x, out); }   // names count too ("top 50", "99th percentile")
  return out;
}

/** Numbers in `text` that cannot be traced to the facts. Small whole numbers (counts, months) pass. */
function untraceable(text: string, ok: Set<number>): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).filter((m) => {
    const v = parseFloat(m);
    return !(ok.has(v) || (Number.isInteger(v) && v <= 12));
  });
}

// ---------- guards ----------

const hits = new Map<string, number[]>();
// ponytail: in-memory limiter, so each serverless instance counts on its own. The real backstops are the
// quota on the key and a Vercel firewall rule on /api/agent; move to a shared store if abuse shows up.
function limited(ip: string, max = 8, windowMs = 5 * 60_000) {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return true;   // refused calls are not counted, so waiting actually clears the limit
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const fail = (error: string, status: number) => Response.json({ error }, { status });

async function gemini(key: string, body: unknown) {
  const r = await fetch(API, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  if (r.status === 429) throw new Error("quota");
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error("badkey");
  if (!r.ok) { console.error("gemini", r.status, (await r.text()).slice(0, 300)); throw new Error("upstream"); }
  return r.json();
}

const SCOPE = "You work inside Dust Twins, a tool that matches places on Earth to Mars landing sites by how atmospheric dust behaves over a year, to suggest candidate sites and months for testing Mars solar and dust-cleaning hardware. " +
  "Only discuss that. If asked for anything else, say in one sentence that you only answer Dust Twins questions. " +
  "Every figure you state must be copied exactly from the data you are given; never estimate, convert or invent a number. " +
  "These are atmospheric dust-behaviour analogues and candidate test windows, not predictions of dust settling or power loss. " +
  "Write plain sentences with no markdown, no lists and no headings.";

// ---------- mode: challenge ----------

async function challenge(key: string, siteId: string, rank: number) {
  const site = SITES.find((s) => s.id === siteId), twin = TWINS[siteId]?.[rank - 1];
  if (!site || !twin) return fail("bad_request", 400);
  const facts = { mars_site: siteFacts(site), earth_twin: twinFacts(twin, rank - 1), method_checks: checkFacts(siteId), what_earth_cannot_copy: LIMITS };
  const request = {
    systemInstruction: { parts: [{ text: SCOPE }] },
    contents: [{ role: "user", parts: [{ text:
      "FACTS:\n" + JSON.stringify(facts) + "\n\n" +
      "Act as a sceptical reviewer. Give the five strongest reasons this Earth site could fail as a rehearsal for dust at this Mars site, strongest first. " +
      "Each reason must rest on one or two specific figures from FACTS and must say what that means for someone planning a field test. " +
      "Copy figures exactly; you may write a share between 0 and 1 as a percentage, but do no other arithmetic and state no figure that is not in FACTS. " +
      "Write for a field engineer in plain words: never write a field name or anything with an underscore, describe what the figure measures instead. " +
      "Keep each title under 8 words and each detail under 45 words. " +
      "Prefer the weakest evidence: low agreement between odd and even years, a different dust regime or wind, the month that strays most often, the weakest part of the match (use the one FACTS names; do not work it out yourself), no expectations registered before the run. " +
      "Never say one figure is higher or lower than another unless FACTS says so. " +
      "In `figures`, list each figure you used as a short plain label and its value, for example 'Split-years agreement: 0.67'. " +
      "Then, in `settle`, one sentence under 30 words on what would have to be measured on site to settle the question." }] }],
    generationConfig: {
      temperature: 0.3, maxOutputTokens: 4000, thinkingConfig: { thinkingLevel: "low" }, responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", required: ["reasons", "settle"], properties: {
        settle: { type: "STRING" },
        reasons: { type: "ARRAY", items: { type: "OBJECT", required: ["title", "detail", "figures"], properties: {
          title: { type: "STRING" }, detail: { type: "STRING" }, figures: { type: "ARRAY", items: { type: "STRING" } } } } } } },
    },
  };
  let parsed: any = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {   // the model occasionally returns malformed JSON
    const out = await gemini(key, request);
    const text = out.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    try { parsed = JSON.parse(text); } catch { console.error("challenge: unparseable", out.candidates?.[0]?.finishReason, text.length); }
  }
  if (!parsed) return fail("upstream", 502);
  const ok = allowedNumbers(facts);
  const all: any[] = (parsed.reasons ?? []).slice(0, 5);
  const reasons = all.filter((r) => untraceable(`${r.title} ${r.detail} ${(r.figures ?? []).join(" ")}`, ok).length === 0).slice(0, 3);
  const settle = untraceable(parsed.settle ?? "", ok).length ? "" : parsed.settle ?? "";
  const kept = all.filter((r) => untraceable(`${r.title} ${r.detail} ${(r.figures ?? []).join(" ")}`, ok).length === 0).length;
  return Response.json({ mode: "challenge", site: siteId, rank, reasons, settle, written: all.length, removed: all.length - kept, model: MODEL });
}

// ---------- mode: ask (tool loop) ----------

const TOOLS = [{ functionDeclarations: [
  { name: "list_sites", description: "The five Mars landing sites with their dust fingerprint and dust regime." },
  { name: "get_twins", description: "The ten best Earth twins of a Mars site, ranked, with country, score, test months, winds and regime match.",
    parameters: { type: "OBJECT", required: ["site"], properties: { site: { type: "STRING", enum: Object.keys(TWINS) } } } },
  { name: "get_twin_detail", description: "Everything known about one twin: match by part, month-by-month pattern match, how many years each month strayed from normal.",
    parameters: { type: "OBJECT", required: ["site", "rank"], properties: { site: { type: "STRING", enum: Object.keys(TWINS) }, rank: { type: "INTEGER" } } } },
  { name: "get_checks", description: "Method checks for a site: shuffled baseline, split years, rover ground truth, regimes, storm-year detector. Use it to state how far a result can be trusted.",
    parameters: { type: "OBJECT", required: ["site"], properties: { site: { type: "STRING", enum: Object.keys(TWINS) } } } },
  { name: "show", description: "Point the app at your answer: select a Mars site, optionally one of its twins by rank, optionally a month (1-12). Call this once before your final answer.",
    parameters: { type: "OBJECT", required: ["site"], properties: { site: { type: "STRING", enum: Object.keys(TWINS) }, rank: { type: "INTEGER" }, month: { type: "INTEGER" } } } },
] }];

function runTool(name: string, a: any): unknown {
  if (name === "list_sites") return SITES.map(siteFacts);
  if (!TWINS[a?.site]) return { error: "unknown site" };
  if (name === "get_twins") return TWINS[a.site].map(twinBrief);
  if (name === "get_twin_detail") { const t = TWINS[a.site][(a.rank | 0) - 1]; return t ? twinFacts(t, (a.rank | 0) - 1) : { error: "rank must be 1 to 10" }; }
  if (name === "get_checks") return { ...checkFacts(a.site), what_earth_cannot_copy: LIMITS };
  if (name === "show") return { shown: true };
  return { error: "unknown tool" };
}

/** What a lookup found, in one plain line, built from the tool result (never from the model). */
function found(name: string, a: any, result: any): string {
  const lander = SITES.find((x) => x.id === a?.site)?.name ?? "";
  if (name === "list_sites") return `${SITES.length} landing sites, each with its dust fingerprint`;
  if (result?.error) return String(result.error);
  if (name === "get_twins") return `10 twins of ${lander}'s site; the closest is ${result[0].place} at ${result[0].match_score}`;
  if (name === "get_twin_detail") return `${result.place}: match ${result.match_score}, test months ${result.test_months.join(", ")}, winds ${result.winds}`;
  if (name === "get_checks") return `split-years agreement ${result.split_years_rank_agreement}, ${result.top10_above_baseline} of 10 twins above the shuffled baseline` + (result.rover_vs_orbit_correlation ? `, rover agreement ${result.rover_vs_orbit_correlation}` : "");
  if (name === "show") { const t = TWINS[a.site]?.[(a.rank | 0) - 1]; return t ? `${t.place}${a.month ? `, ${MONTHS[a.month - 1]}` : ""}` : `${lander}'s site`; }
  return "";
}

/** Streams one JSON object per line: each lookup as it happens, then the checked answer. */
function ask(key: string, question: string, history: { role: string; text: string }[]) {
  const contents: any[] = [
    ...history.slice(-4).map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: String(h.text).slice(0, 600) }] })),
    { role: "user", parts: [{ text: question }] },
  ];
  const seen: unknown[] = [LIMITS, question], steps: { tool: string; args: unknown; found: string }[] = [];
  let action: { site: string; rank?: number; month?: number } | null = null;
  const system = SCOPE + " Use the tools to look things up before answering. Call `show` once so the app points at your answer. " +
    "Answer in at most 90 words: the recommended place and months, one figure that supports it, and the single most important caveat from the method checks or the limits.";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        for (let turn = 0; turn < 6; turn++) {
          send({ type: "thinking", text: turn === 0 ? "Working out what to look up" : "Deciding what else it needs" });
          const out = await gemini(key, { systemInstruction: { parts: [{ text: system }] }, contents, tools: TOOLS, generationConfig: { temperature: 0.3, maxOutputTokens: 3000, thinkingConfig: { thinkingLevel: "low" } } });
          const content = out.candidates?.[0]?.content;
          if (!content?.parts) throw new Error("upstream");
          const calls = content.parts.filter((p: any) => p.functionCall);
          if (!calls.length) {
            const text = content.parts.map((p: any) => p.text ?? "").join("").trim();
            const ok = allowedNumbers(seen), cited = text.match(/\d+(?:\.\d+)?/g) ?? [];
            send({ type: "checking", text: `Checking ${cited.length} figures against the data` });
            send({ type: "final", mode: "ask", text, steps, action, checked: cited.length, unverified: [...new Set(untraceable(text, ok))], model: MODEL });
            return ctrl.close();
          }
          contents.push(content);   // keep the model's turn verbatim so thought signatures survive
          contents.push({ role: "user", parts: calls.map((p: any) => {
            const { name, args } = p.functionCall, result = runTool(name, args);
            const step = { tool: name, args, found: found(name, args, result) };
            steps.push(step);
            send({ type: "step", ...step });
            seen.push(result);
            if (name === "show" && TWINS[args?.site]) action = { site: args.site, rank: args.rank, month: args.month };
            return { functionResponse: { name, response: { result } } };
          }) });
        }
        throw new Error("too_many_steps");
      } catch (e) {
        const m = e instanceof Error ? e.message : "";
        send({ type: "error", error: ["quota", "badkey", "too_many_steps"].includes(m) ? m : "upstream" });
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

// ---------- handler ----------

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return fail("bad_request", 400); }
  const own = req.headers.get("x-user-key")?.trim();
  if (own && !/^[\w-]{20,100}$/.test(own)) return fail("badkey", 400);
  const key = own || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return fail("nokey", 503);
  if (!own && limited(req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local")) return fail("rate", 429);
  try {
    if (body?.mode === "challenge") return await challenge(key, String(body.site), Number(body.rank) | 0);
    if (body?.mode === "ask") {
      const q = String(body.question ?? "").trim();
      if (q.length < 3 || q.length > 300) return fail("bad_request", 400);
      return ask(key, q, Array.isArray(body.history) ? body.history : []);
    }
    return fail("bad_request", 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return fail(m === "quota" ? "quota" : m === "badkey" ? "badkey" : "upstream", m === "quota" ? 429 : m === "badkey" ? 401 : 502);
  }
}
