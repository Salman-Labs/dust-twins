"use client";
// Dust Twins main screen. Written with SI assistance (Claude).
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import DustRing from "./DustRing";
import Story from "./Story";
import type { Marker } from "./Scene";
import { type Evidence, type Site, type Twin, type TwinFile, MONTHS, fmtLatLon, lsRange, marsSeason } from "@/lib/types";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

const LIMITS = [
  ["Thin air", "Mars surface pressure is under 1% of Earth's. Wind lifts and drops dust differently."],
  ["Low gravity", "38% of Earth's. Dust settles more slowly and stays aloft longer."],
  ["Static charge", "Dry Martian dust clings electrostatically. Earth humidity bleeds charge away."],
  ["Dust itself", "Martian dust is finer (about 1.5 µm) and iron-rich. Earth dust is coarser and mixed with pollution."],
  ["Water", "No rain or dew on Mars. On Earth both clean panels and cement dust onto them."],
  ["How it is measured", "Mars: infrared, from orbit. Earth: visible light, from a reanalysis model. We compare patterns and ranks, never raw values."],
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Bar({ v, color = "var(--dust)" }: { v: number; color?: string }) {
  return <div className="h-1.5 w-full rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: pct(Math.max(0, Math.min(1, v))), background: color }} /></div>;
}

function Tag({ children, tone = "dim" }: { children: React.ReactNode; tone?: "ok" | "warn" | "dim" }) {
  const c = tone === "ok" ? "border-ok/40 text-ok" : tone === "warn" ? "border-warn/40 text-warn" : "border-line text-dim";
  return <span className={`label rounded-full border px-2 py-1 ${c}`}>{children}</span>;
}

/** 12-month strip: which Mars season each Earth month rehearses, and how well. */
function Calendar({ twin, site, month, setMonth }: { twin: Twin; site: Site; month: number; setMonth: (m: number) => void }) {
  const test = new Set(twin.test_months);
  return (
    <div>
      <div className="grid grid-cols-12 gap-1" role="listbox" aria-label="Test calendar by month">
        {MONTHS.map((m, j) => {
          const bin = twin.mars_bin[j], q = twin.month_match[j], on = test.has(m);
          return (
            <button key={m} role="option" aria-selected={month === j} onClick={() => setMonth(j)} onMouseEnter={() => setMonth(j)}
              title={`${m}: rehearses Mars ${lsRange(bin)} (${marsSeason(bin)}), match ${pct(q)}`}
              className={`flex flex-col items-center gap-1 rounded-md pb-1 pt-1.5 ${month === j ? "bg-white/10" : ""}`}>
              <span className="num text-[10px] text-dim">{m[0]}</span>
              <span className="block h-9 w-full rounded-sm" style={{ background: on ? "var(--dust)" : "var(--earth)", opacity: 0.18 + 0.82 * q * (on ? 1 : 0.55) }} />
              <span className="num text-[9px]" style={{ color: on ? "var(--dust)" : "var(--dim)" }}>{bin * 30}°</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-dim">
        <span className="text-ink">{MONTHS[month]}</span> here lines up with Mars <span className="text-mars">{lsRange(twin.mars_bin[month])}</span> ({marsSeason(twin.mars_bin[month])}) at {site.place}. Pattern match that month: <span className="num text-ink">{pct(twin.month_match[month])}</span>.
        <span className="ml-1" style={{ color: "var(--dust)" }}>■</span> = lines up with the site&apos;s four dustiest stretches of the year.
      </p>
    </div>
  );
}

function Check({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-2"><span className={`num text-[11px] ${ok ? "text-ok" : "text-warn"}`}>{ok ? "HOLDS" : "WEAK"}</span><h4 className="text-[13px] font-medium">{title}</h4></div>
      <p className="mt-1 text-[12px] leading-snug text-dim">{children}</p>
    </div>
  );
}

function EvidencePanel({ ev, site, expectations, onClose }: { ev: Evidence; site: Site; expectations: string | null; onClose: () => void }) {
  const e = ev.sites[site.id];
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="panel scroll max-h-[88vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(x) => x.stopPropagation()} role="dialog" aria-label="Evidence">
        <div className="flex items-start justify-between gap-4">
          <div><p className="label">Evidence · {site.name}</p><h2 className="font-serif text-3xl">Should you believe these twins?</h2></div>
          <button onClick={onClose} className="label rounded-full border border-line px-3 py-1.5">Close</button>
        </div>
        <p className="mt-2 text-[13px] text-dim">Four checks, published whichever way they came out. Numbers are computed by the pipeline in the repository, not typed in.</p>
        <div className="mt-4 grid gap-3">
          <Check ok={e.shuffle.top10_above_null >= 8} title="Shuffle baseline">
            We scrambled the months of every Earth cell and matched again. The best 1% of scrambled matches score <span className="num text-ink">{e.shuffle.null_p99}</span>; our top twin scores <span className="num text-ink">{e.top_score}</span>. <span className="num text-ink">{e.shuffle.top10_above_null}/10</span> of the top twins beat that line, and {e.shuffle.cells_above_null} of {e.shuffle.cells_scored} land cells do.
          </Check>
          <Check ok={e.split_years.spearman >= 0.6} title="Split years">
            Twins found from odd years alone and from even years alone, on both planets. Rank agreement <span className="num text-ink">{e.split_years.spearman}</span> (1 = identical); <span className="num text-ink">{pct(e.split_years.top50_overlap)}</span> of the top 50 cells appear in both.
          </Check>
          <Check ok={e.mars_self_test.neighbour_percentile >= 0.9} title="Mars-to-Mars self test">
            Matching the site against the rest of Mars, its own neighbouring cells rank above <span className="num text-ink">{pct(e.mars_self_test.neighbour_percentile)}</span> of the planet. If they did not, the fingerprint would be broken.
          </Check>
          <Check ok={e.pressure_sensitivity.spearman >= 0.8} title="Pressure choice">
            We use dust above the real ground. Switching to the 610 Pa-normalised product gives rank agreement <span className="num text-ink">{e.pressure_sensitivity.spearman}</span> and keeps <span className="num text-ink">{pct(e.pressure_sensitivity.top50_overlap)}</span> of the top 50.
          </Check>
        </div>
        <h3 className="mt-5 text-[13px] font-medium">What we expected before running it</h3>
        <pre className="scroll mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-line p-3 text-[12px] leading-snug text-dim">{expectations ?? "No expectations were registered before the run."}</pre>
        <p className="mt-4 text-[12px] leading-snug text-dim">
          These are atmospheric dust-behaviour analogues: places where the sky carries dust on a similar yearly pattern. They are candidate test windows to investigate, not predictions of dust settling or power loss. Whether dust stays on a panel also depends on wind cleaning, which differed sharply between Mars sites.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [ev, setEv] = useState<Evidence | null>(null);
  const [expectations, setExpectations] = useState<string | null>(null);
  const [siteId, setSiteId] = useState("insight");
  const [file, setFile] = useState<TwinFile | null>(null);
  const [ti, setTi] = useState<number | null>(null);
  const [month, setMonth] = useState(5);
  const [aligned, setAligned] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showEv, setShowEv] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const q = new URLSearchParams(window.location.search);
    if (q.has("story")) { setStory(0); setAuto(q.get("story") === "auto"); }
    fetch("/data/mars_sites.json").then((r) => r.json()).then((d) => setSites(d.sites)).catch(() => setErr("Could not load the data files."));
    fetch("/data/evidence.json").then((r) => r.json()).then(setEv).catch(() => {});
    fetch("/data/expectations.txt").then((r) => (r.ok ? r.text() : null)).then(setExpectations).catch(() => {});
  }, []);
  useEffect(() => {
    setFile(null); setTi(null);
    fetch(`/data/twins_${siteId}.json`).then((r) => r.json()).then((d: TwinFile) => { setFile(d); setTi(0); }).catch(() => setErr("Could not load the twins."));
  }, [siteId]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setMonth((m) => (m + 1) % 12), 850);
    return () => clearInterval(t);
  }, [playing]);

  // story mode drives the scene: InSight, its best twin, and the year playing from beat 4
  useEffect(() => {
    if (story == null) return;
    setSiteId("insight"); setAligned(true);
    if (story >= 2) setTi(0);
    setPlaying(story === 3);
  }, [story]);

  const site = sites.find((s) => s.id === siteId) ?? null;
  const twin = file && ti != null ? file.twins[ti] : null;

  const marsMarkers: Marker[] = useMemo(() => sites.map((s) => ({ key: `m-${s.id}`, lat: s.lat, lon: s.lon, active: s.id === siteId, onClick: () => setSiteId(s.id) })), [sites, siteId]);
  const earthMarkers: Marker[] = useMemo(() => (file?.twins ?? []).map((t, i) => ({ key: `e-${siteId}-${i}`, lat: t.lat, lon: t.lon, active: i === ti, onClick: () => setTi(i) })), [file, ti, siteId]);

  if (err) return <main className="flex h-full items-center justify-center p-8 text-dim">{err}</main>;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <Scene marsMarkers={marsMarkers} earthMarkers={earthMarkers}
          marsFace={site ? { lat: site.lat, lon: site.lon } : null} earthFace={twin ? { lat: twin.lat, lon: twin.lon } : null}
          overlay={file ? `/data/score_${siteId}.png` : null}
          marsFrame={twin ? twin.mars_bin[month] : month} earthFrame={month} showHaze={playing}
          threadFrom={site ? `m-${site.id}` : null} threadTo={twin ? `e-${siteId}-${ti}` : null} reducedMotion={reduced} />
      </div>

      {/* header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 md:p-5">
        <div className="pointer-events-auto">
          <h1 className="font-serif text-3xl leading-none md:text-4xl">Dust <span className="text-dust">Twins</span></h1>
          <p className="mt-1 max-w-xs text-[12px] leading-snug text-dim">Where on Earth does the sky carry dust like it does at a Mars landing site, and in which months?</p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button onClick={() => { setAuto(false); setStory(0); }} className="panel label px-3 py-2 text-dust">Play the story</button>
          <button onClick={() => setShowEv(true)} disabled={!ev || !site} className="panel label px-3 py-2 text-ink">Evidence</button>
        </div>
      </header>

      {/* Mars side */}
      <section className="scroll absolute bottom-24 left-0 top-24 z-10 hidden w-[300px] overflow-y-auto p-4 md:block lg:w-[320px]" aria-label="Mars site">
        <div className="panel p-4">
          <p className="label text-mars">Mars · pick a landing site</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sites.map((s) => (
              <button key={s.id} onClick={() => setSiteId(s.id)} aria-pressed={s.id === siteId}
                className={`rounded-full border px-2.5 py-1 text-[12px] ${s.id === siteId ? "border-mars bg-mars/15 text-ink" : "border-line text-dim hover:text-ink"}`}>{s.name}</button>
            ))}
          </div>
          {site && (
            <>
              <h2 className="mt-4 font-serif text-2xl leading-tight">{site.place}</h2>
              <p className="num text-[11px] text-dim">{fmtLatLon(site.lat, site.lon)} · {site.name}</p>
              <p className="mt-2 text-[12px] leading-snug text-dim">{site.note}</p>
              <div className="mt-2 flex justify-center">
                <DustRing mars={site.shape} marsYears={site.series} title={`Dust ring for ${site.place}`} size={230} />
              </div>
              <p className="text-[11px] leading-snug text-dim">One Mars year as a ring. Further out = dustier than this site&apos;s own average. Faint lines are 13 individual Mars years; spikes are global dust storms.</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["Stormy share", pct(site.storm)], ["Haze rank", pct(site.haze)], ["Swing", site.var.toFixed(2)]].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line py-2"><dd className="num text-[15px]">{v}</dd><dt className="label mt-0.5">{k}</dt></div>
                ))}
              </dl>
            </>
          )}
        </div>
      </section>

      {/* Earth side */}
      <section className="scroll absolute bottom-24 right-0 top-20 z-10 w-full max-w-[380px] overflow-y-auto p-4 max-md:top-auto max-md:max-h-[46dvh] max-md:max-w-none" aria-label="Earth twins">
        <div className="panel p-4">
          <p className="label text-earth">Earth · dust twins{site ? ` of ${site.place}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 md:hidden">
            {sites.map((s) => (
              <button key={s.id} onClick={() => setSiteId(s.id)} aria-pressed={s.id === siteId}
                className={`rounded-full border px-2.5 py-1 text-[12px] ${s.id === siteId ? "border-mars bg-mars/15" : "border-line text-dim"}`}>{s.name}</button>
            ))}
          </div>
          <ol className="scroll mt-2 grid max-h-[176px] gap-0.5 overflow-y-auto">
            {(file?.twins ?? []).map((t, i) => (
              <li key={i}>
                <button onClick={() => setTi(i)} aria-pressed={i === ti}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${i === ti ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <span className="num w-5 text-[11px] text-dim">{i + 1}</span>
                  <span className="flex-1 truncate text-[13px]">{t.place}</span>
                  <span className="num text-[12px] text-dust">{t.score.toFixed(2)}</span>
                </button>
              </li>
            ))}
            {!file && <li className="py-6 text-center text-[12px] text-dim">Matching…</li>}
          </ol>
        </div>

        {twin && site && (
          <div className="panel mt-3 p-4">
            <p className="label">Test card</p>
            <h2 className="font-serif text-2xl leading-tight">{twin.place}</h2>
            <p className="num text-[11px] text-dim">{fmtLatLon(twin.lat, twin.lon)} · match {twin.score.toFixed(2)} of 1</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Tag tone={twin.beats_null ? "ok" : "warn"}>{twin.beats_null ? "Beats shuffled baseline" : "Not above baseline"}</Tag>
              <Tag tone={twin.robust >= 0.9 ? "ok" : "dim"}>{twin.robust >= 0.9 ? "Robust to weights" : `Top-50 in ${pct(twin.robust)} of weightings`}</Tag>
              <Tag tone={twin.famous ? "dim" : "ok"}>{twin.famous ? `Known analog: ${twin.famous}` : "Not a famous analog"}</Tag>
              {site.reliability < 0.5 && <Tag tone="warn">Mars cell: few observations</Tag>}
            </div>

            <h3 className="mt-4 text-[13px] font-medium">Candidate test window</h3>
            <p className="mt-0.5 text-[12px] leading-snug text-dim">
              To rehearse {site.place}&apos;s dustiest stretch, the pattern says <span className="text-dust">{twin.test_months.join(", ")}</span>. A hypothesis to check on site, not a guarantee.
            </p>
            <div className="mt-2"><Calendar twin={twin} site={site} month={month} setMonth={setMonth} /></div>

            <div className="mt-3 flex items-center justify-between">
              <h3 className="text-[13px] font-medium">Two rings, one year</h3>
              <button onClick={() => setAligned((a) => !a)} className="label rounded-full border border-line px-2 py-1">{aligned ? "Show raw calendar" : "Line up seasons"}</button>
            </div>
            <div className="flex justify-center">
              <DustRing mars={site.shape} earth={twin.shape} shift={twin.shift} aligned={aligned} highlight={month} size={250}
                title={`Dust rings for ${site.place} (Mars) and ${twin.place} (Earth)`} />
            </div>
            <p className="text-[11px] leading-snug text-dim">
              <span className="text-mars">Mars</span> and <span className="text-earth">Earth</span>. The Earth ring is turned by {twin.shift} month{twin.shift === 1 ? "" : "s"} so the seasons line up.
            </p>

            <h3 className="mt-4 text-[13px] font-medium">What matches</h3>
            <div className="mt-1 grid gap-1.5">
              {([["Seasonal shape", twin.components.season], ["Storminess", twin.components.storminess], ["Usual haze (rank on own planet)", twin.components.haze], ["Year-to-year swing", twin.components.variability]] as const).map(([k, v]) => (
                <div key={k}><div className="flex justify-between text-[12px]"><span className="text-dim">{k}</span><span className="num">{pct(v)}</span></div><Bar v={v} /></div>
              ))}
            </div>

            <h3 className="mt-4 text-[13px] font-medium">What can never match</h3>
            <ul className="mt-1 grid gap-1">
              {LIMITS.map(([k, v]) => <li key={k} className="text-[12px] leading-snug text-dim"><span className="text-ink">{k}.</span> {v}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* year scrubber */}
      <footer className="absolute inset-x-0 bottom-0 z-10 p-4">
        <div className="panel mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5 max-md:hidden">
          <button onClick={() => setPlaying((p) => !p)} className="label rounded-full border border-line px-3 py-1.5 text-ink" aria-pressed={playing}>{playing ? "Pause" : "Play a year"}</button>
          <input type="range" min={0} max={11} step={1} value={month} onChange={(e) => setMonth(+e.target.value)} className="flex-1 accent-[var(--dust)]" aria-label="Month of the Earth year" />
          <span className="num w-44 text-right text-[11px] text-dim">{MONTHS[month]} · Mars {twin ? lsRange(twin.mars_bin[month]) : lsRange(month)}</span>
        </div>
        <p className="mt-2 text-center text-[10px] text-dim max-md:hidden">Mars dust: Montabone et al. climatology (CC BY-SA 3.0). Earth dust: NASA MERRA-2. Imagery: NASA, Solar System Scope (CC BY 4.0). Haze animation is an illustration driven by the dust record, not a soiling or power prediction.</p>
      </footer>

      {story != null && <Story step={story} setStep={setStory} site={site} twin={twin} auto={auto} />}
      {showEv && ev && site && <EvidencePanel ev={ev} site={site} expectations={expectations} onClose={() => setShowEv(false)} />}
    </main>
  );
}
