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

/** One line of the Test Card: a tick when it holds, a dash when it does not. */
function Fact({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px] leading-snug">
      <svg width="14" height="14" viewBox="0 0 14 14" className="mt-[2px] shrink-0" aria-hidden>
        {ok ? <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" fill="none" stroke="var(--ok)" strokeWidth="1.8" /> : <path d="M3 7 H11" stroke="var(--dim)" strokeWidth="1.8" />}
      </svg>
      <span className={ok ? "" : "text-dim"}>{children}</span>
    </li>
  );
}

function Meter({ label, value, v, hint }: { label: string; value: string; v: number; hint: string }) {
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between"><dt className="text-[12px] text-dim">{label}</dt><dd className="num text-[13px]">{value}</dd></div>
      <Bar v={v} color="var(--mars)" />
    </div>
  );
}

/** "May–Aug" from an unordered set of month names, handling a run that wraps the new year. */
function monthRange(names: string[]) {
  const on = MONTHS.map((m) => names.includes(m));
  if (!on.some(Boolean)) return "";
  const start = on.findIndex((v, i) => v && !on[(i + 11) % 12]);
  let end = start;
  while (on[(end + 1) % 12] && (end + 1) % 12 !== start) end = (end + 1) % 12;
  return start === end ? MONTHS[start] : `${MONTHS[start]}–${MONTHS[end]}`;
}

/** Ranked twins. The bar behind each row is its score between the shuffled baseline and the best match. */
function TwinList({ file, ti, setTi }: { file: TwinFile; ti: number | null; setTi: (i: number) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? file.twins : file.twins.slice(0, 5);
  const { lo, hi } = file.scale;
  return (
    <>
      <ol className="mt-3 grid gap-1">
        {shown.map((t, i) => {
          const on = i === ti, fill = Math.max(0.06, (t.score - lo) / (hi - lo || 1));
          return (
            <li key={i}>
              <button onClick={() => setTi(i)} aria-pressed={on}
                className={`relative grid w-full grid-cols-[1.4rem_1fr_auto] items-center gap-x-2 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors ${on ? "border-dust/60" : "border-transparent hover:border-line"}`}>
                <span aria-hidden className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${fill * 100}%`, background: on ? "rgba(255,176,64,0.16)" : "rgba(255,255,255,0.045)" }} />
                <span className={`num relative text-[12px] ${on ? "text-dust" : "text-dim"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="relative min-w-0">
                  <span className="block truncate text-[14px] font-medium leading-tight">{t.near}</span>
                  <span className="block truncate text-[11.5px] leading-tight text-dim">{t.country} · test {monthRange(t.test_months)}</span>
                </span>
                <span className="num relative text-[13px]">{t.score.toFixed(2)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex items-center justify-between text-[11.5px] text-dim">
        <span>Bar = match above the shuffled baseline</span>
        <button onClick={() => setAll((a) => !a)} className="text-ink underline decoration-line underline-offset-4">{all ? "Top 5 only" : `All ${file.twins.length}`}</button>
      </div>
    </>
  );
}

/** The year as two facing rows of bars: Earth dust above, the Mars dust it lines up with below. Click a month. */
function YearBar(props: { month: number; setMonth: (m: number) => void; playing: boolean; setPlaying: (p: boolean) => void; site: Site | null; twin: Twin | null }) {
  const { month, setMonth, playing, setPlaying, site, twin } = props;
  const earth = twin?.shape ?? null;
  const mars = site ? MONTHS.map((_, j) => site.shape[twin ? twin.mars_bin[j] : j]) : null;
  const top = Math.max(1.6, ...(earth ?? []), ...(mars ?? []));
  const bin = twin ? twin.mars_bin[month] : month;
  return (
    <div className="panel mx-auto flex max-w-[560px] items-stretch gap-3 px-3 py-2.5 max-md:hidden">
      <button onClick={() => setPlaying(!playing)} aria-pressed={playing} aria-label={playing ? "Pause the year" : "Play the year"}
        className="grid w-11 shrink-0 place-items-center rounded-lg border border-line hover:border-dust">
        {playing
          ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="2" y="1" width="3.5" height="12" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" /></svg>
          : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 1 L13 7 L3 13Z" fill="currentColor" /></svg>}
      </button>
      <div className="flex-1">
        <div className="grid grid-cols-12 gap-[3px]" role="listbox" aria-label="Month of the year">
          {MONTHS.map((m, j) => {
            const on = j === month;
            return (
              <button key={m} role="option" aria-selected={on} aria-label={m} onClick={() => setMonth(j)}
                className={`group flex flex-col items-stretch rounded-[5px] px-[2px] pb-[2px] pt-[3px] ${on ? "bg-white/10" : "hover:bg-white/5"}`}>
                <span className="flex h-[18px] items-end"><span className="w-full rounded-[2px]" style={{ height: `${earth ? (earth[j] / top) * 100 : 8}%`, background: "var(--earth)", opacity: on ? 1 : 0.55 }} /></span>
                <span className={`num py-[2px] text-center text-[9.5px] leading-none ${on ? "text-ink" : "text-dim"}`}>{m[0]}</span>
                <span className="flex h-[18px] items-start"><span className="w-full rounded-[2px]" style={{ height: `${mars ? (mars[j] / top) * 100 : 8}%`, background: "var(--mars)", opacity: on ? 1 : 0.55 }} /></span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex w-[124px] shrink-0 flex-col justify-center text-[11.5px] leading-tight">
        <span><span className="text-earth">Earth</span> <span className="num">{MONTHS[month]}</span></span>
        <span className="mt-1"><span className="text-mars">Mars</span> <span className="num">{lsRange(bin)}</span></span>
        <span className="mt-1 text-dim">{marsSeason(bin)}</span>
      </div>
    </div>
  );
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

/** Rover sky opacity vs the orbital record at the same cell, each scaled by its own mean (different wavelengths). */
function RoverChart({ pairs }: { pairs: { my: number; bin: number; rover: number; orbit: number }[] }) {
  const W = 560, H = 120, P = 6;
  const t0 = pairs[0].my + pairs[0].bin / 12, t1 = pairs[pairs.length - 1].my + pairs[pairs.length - 1].bin / 12;
  const mean = (k: "rover" | "orbit") => pairs.reduce((a, p) => a + p[k], 0) / pairs.length;
  const mr = mean("rover"), mo = mean("orbit");
  const top = Math.max(...pairs.map((p) => Math.max(p.rover / mr, p.orbit / mo)));
  const x = (p: { my: number; bin: number }) => P + ((p.my + p.bin / 12 - t0) / (t1 - t0 || 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / top) * (H - 2 * P);
  const line = (k: "rover" | "orbit", m: number) => pairs.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(p[k] / m).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Rover-measured dust compared with the orbital record over time">
      <path d={line("orbit", mo)} fill="none" stroke="var(--mars)" strokeWidth="1.5" />
      <path d={line("rover", mr)} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x={P} y={12} className="num" fontSize="9" fill="var(--mars)">orbit (used here)</text>
      <text x={P + 130} y={12} className="num" fontSize="9" fill="var(--ink)">rover on the ground</text>
      <text x={P} y={H - 1} className="num" fontSize="8" fill="var(--dim)">MY{pairs[0].my}</text>
      <text x={W - P} y={H - 1} textAnchor="end" className="num" fontSize="8" fill="var(--dim)">MY{pairs[pairs.length - 1].my}</text>
    </svg>
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
        <p className="mt-2 text-[13px] text-dim">Every check is published whichever way it came out. Numbers are computed by the pipeline in the repository, not typed in.</p>
        <div className="mt-4 grid gap-3">
          <Check ok={e.shuffle.top10_above_null >= 8} title="Shuffle baseline">
            We scrambled the months of every Earth cell and matched again. The best 1% of scrambled matches score <span className="num text-ink">{e.shuffle.null_p99}</span>; our top twin scores <span className="num text-ink">{e.top_score}</span>. <span className="num text-ink">{e.shuffle.top10_above_null}/10</span> of the top twins beat that line, and {e.shuffle.cells_above_null} of {e.shuffle.cells_scored} land cells do.
          </Check>
          <Check ok={e.split_years.spearman >= 0.6} title="Split years">
            Twins found from odd years alone and from even years alone, on both planets. Rank agreement <span className="num text-ink">{e.split_years.spearman}</span> (1 = identical); <span className="num text-ink">{pct(e.split_years.top50_overlap)}</span> of the top 50 cells appear in both.
          </Check>
          <Check ok={e.mars_self_test.neighbour_percentile >= 0.9} title="Mars-to-Mars self test">
            Matching the site against the rest of Mars, its own neighbouring cells rank above <span className="num text-ink">{(e.mars_self_test.neighbour_percentile * 100).toFixed(1)}%</span> of the planet. If they did not, the fingerprint would be broken.
          </Check>
          <Check ok={e.pressure_sensitivity.spearman >= 0.8} title="Pressure choice">
            We use dust above the real ground. Switching to the 610 Pa-normalised product gives rank agreement <span className="num text-ink">{e.pressure_sensitivity.spearman}</span> and keeps <span className="num text-ink">{pct(e.pressure_sensitivity.top50_overlap)}</span> of the top 50.
          </Check>
        </div>
        {e.rover && (
          <div className="mt-3 rounded-lg border border-line p-3">
            <div className="flex items-center gap-2"><span className={`num text-[11px] ${e.rover.r >= 0.7 ? "text-ok" : "text-warn"}`}>{e.rover.r >= 0.7 ? "HOLDS" : "WEAK"}</span><h4 className="text-[13px] font-medium">Rover ground truth</h4></div>
            <p className="mt-1 text-[12px] leading-snug text-dim">
              {site.name} measured the dust in its own sky. Across <span className="num text-ink">{e.rover.n}</span> month-sized stretches, its readings and the orbital record at this cell correlate at <span className="num text-ink">{e.rover.r}</span>. Each line is scaled to its own average because the two instruments see different wavelengths.
            </p>
            <RoverChart pairs={e.rover.pairs} />
          </div>
        )}
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
    <main className="relative w-full md:h-dvh md:overflow-hidden">
      <div className="relative h-[40dvh] md:absolute md:inset-0 md:h-auto">
        <Scene marsMarkers={marsMarkers} earthMarkers={earthMarkers}
          marsFace={site ? { lat: site.lat, lon: site.lon } : null} earthFace={twin ? { lat: twin.lat, lon: twin.lon } : null}
          overlay={file ? `/data/score_${siteId}.png` : null}
          marsFrame={twin ? twin.mars_bin[month] : month} earthFrame={month} showHaze={playing}
          threadFrom={site ? `m-${site.id}` : null} threadTo={twin ? `e-${siteId}-${ti}` : null} reducedMotion={reduced} />
      </div>

      {/* header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 md:p-5">
        <div className="pointer-events-auto">
          <h1 className="font-serif text-2xl leading-none md:text-4xl">Dust <span className="text-dust">Twins</span></h1>
          <p className="mt-1 max-w-xs text-[12px] leading-snug text-dim max-md:hidden">Where on Earth does the sky carry dust like it does at a Mars landing site, and in which months?</p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button onClick={() => { setAuto(false); setStory(0); }} className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-dust px-3.5 py-2 text-[13px] font-medium text-black max-md:px-2.5 max-md:py-1.5 max-md:text-[12px]"><svg width="10" height="10" viewBox="0 0 14 14" aria-hidden><path d="M3 1 L13 7 L3 13Z" fill="currentColor" /></svg>Play the story</button>
          <button onClick={() => setShowEv(true)} disabled={!ev || !site} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium hover:border-ink/40 max-md:px-2.5 max-md:py-1.5 max-md:text-[12px]">Evidence</button>
        </div>
      </header>

      {/* Mars side */}
      <section className="scroll absolute bottom-24 left-0 top-24 z-10 hidden w-[300px] overflow-y-auto p-4 md:block lg:w-[320px]" aria-label="Mars site">
        <div className="panel p-4">
          <p className="label text-mars">Mars · pick a landing site</p>
          <ul className="mt-3 grid gap-1">
            {sites.map((s) => {
              const on = s.id === siteId;
              return (
                <li key={s.id}>
                  <button onClick={() => setSiteId(s.id)} aria-pressed={on}
                    className={`flex w-full items-baseline justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${on ? "border-mars/60 bg-mars/10" : "border-transparent hover:border-line"}`}>
                    <span className="text-[14px] font-medium">{s.name}</span>
                    <span className={`truncate text-[11.5px] ${on ? "text-mars" : "text-dim"}`}>{s.place}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {site && (
            <>
              <h2 className="mt-4 font-serif text-2xl leading-tight">{site.place}</h2>
              <p className="num text-[11px] text-dim">{fmtLatLon(site.lat, site.lon)} · {site.name}</p>
              <p className="mt-2 text-[12px] leading-snug text-dim">{site.note}</p>
              <div className="mt-2 flex justify-center">
                <DustRing mars={site.shape} marsYears={site.series} title={`Dust ring for ${site.place}`} size={230} />
              </div>
              <p className="text-[11px] leading-snug text-dim">One Mars year as a ring. Further out = dustier than this site&apos;s own average. Faint lines are 13 individual Mars years; spikes are global dust storms.</p>
              <dl className="mt-3 grid gap-2.5 border-t border-line pt-3">
                <Meter label="Months that run stormy" value={pct(site.storm)} v={site.storm / 0.25} hint="share of months well above their own normal" />
                <Meter label="Haze, ranked on Mars" value={pct(site.haze)} v={site.haze} hint="100% = dustiest skies on the planet" />
                <Meter label="Year-to-year swing" value={site.var.toFixed(2)} v={site.var / 0.8} hint="how far a month strays from its usual level" />
              </dl>
            </>
          )}
        </div>
      </section>

      {/* Earth side */}
      <section className="scroll z-10 w-full p-4 md:absolute md:bottom-24 md:right-0 md:top-20 md:max-w-[380px] md:overflow-y-auto" aria-label="Earth twins">
        <div className="panel p-4">
          <p className="label text-earth">Earth · dust twins{site ? ` of ${site.place}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 md:hidden">
            {sites.map((s) => (
              <button key={s.id} onClick={() => setSiteId(s.id)} aria-pressed={s.id === siteId}
                className={`rounded-full border px-2.5 py-1 text-[12px] ${s.id === siteId ? "border-mars bg-mars/15" : "border-line text-dim"}`}>{s.name}</button>
            ))}
          </div>
          {file ? <TwinList file={file} ti={ti} setTi={setTi} /> : <p className="py-6 text-center text-[12px] text-dim">Matching…</p>}
        </div>

        {twin && site && (
          <div className="panel mt-3 p-4">
            <p className="label">Test card · {site.name}</p>
            <h2 className="font-serif text-2xl leading-tight">{twin.place}</h2>
            <p className="num text-[11px] text-dim">{fmtLatLon(twin.lat, twin.lon)} · match {twin.score.toFixed(2)} of 1</p>
            <ul className="mt-3 grid gap-1.5 border-y border-line py-3">
              <Fact ok={twin.beats_null}>{twin.beats_null ? "Beats the shuffled-season baseline" : "Does not beat the shuffled-season baseline"}</Fact>
              <Fact ok={twin.robust >= 0.9}>Stays in the top 50 under {pct(twin.robust)} of random weightings</Fact>
              <Fact ok={!twin.famous}>{twin.famous ? `Already a known analog (${twin.famous})` : "Not one of the famous analog sites"}</Fact>
              {site.cleaning !== "n/a" && (
                <Fact ok={twin.wind_tag === site.cleaning}>
                  {twin.wind_tag === site.cleaning ? `Winds are ${twin.wind_tag}, as at ${site.name}'s site` : `Winds are ${twin.wind_tag} here; ${site.name}'s site was ${site.cleaning}`}
                </Fact>
              )}
              {site.reliability < 0.5 && <Fact ok={false}>The Mars cell has few direct observations</Fact>}
            </ul>

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

            <details className="mt-4 border-t border-line pt-3" open>
              <summary className="cursor-pointer text-[13px] font-medium">What can never match <span className="num text-dim">({LIMITS.length})</span></summary>
              <ul className="mt-2 grid gap-1.5">
                {LIMITS.map(([k, v]) => <li key={k} className="text-[12px] leading-snug text-dim"><span className="text-ink">{k}.</span> {v}</li>)}
              </ul>
            </details>
          </div>
        )}
      </section>

      {/* year scrubber */}
      <footer className="z-10 p-4 md:absolute md:inset-x-0 md:bottom-0">
        {story == null && <YearBar month={month} setMonth={setMonth} playing={playing} setPlaying={setPlaying} site={site} twin={twin} />}
        <p className="mt-2 text-center text-[10px] text-dim">Mars dust: Montabone et al. climatology (CC BY-SA 3.0). Earth dust: NASA MERRA-2. Imagery: NASA, Solar System Scope (CC BY 4.0). Haze animation is an illustration driven by the dust record, not a soiling or power prediction. Story narration is SI-generated speech (ElevenLabs).</p>
      </footer>

      {story != null && <Story step={story} setStep={setStory} site={site} twin={twin} auto={auto} ev={ev} openEvidence={() => { setStory(null); setShowEv(true); }} />}
      {showEv && ev && site && <EvidencePanel ev={ev} site={site} expectations={expectations} onClose={() => setShowEv(false)} />}
    </main>
  );
}
