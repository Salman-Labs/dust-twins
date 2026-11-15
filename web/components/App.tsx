"use client";
// Dust Twins main screen. Written with SI assistance (Claude).
// Layout: two fixed sidebars (Mars left, Earth right) around the scene. The chrome stays quiet;
// the globes and the Dust Ring carry the colour.
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import DustRing from "./DustRing";
import Story from "./Story";
import Guide, { pointAt } from "./Guide";
import Hook from "./Hook";
import { Ask, Challenge } from "./Planner";
import type { Marker } from "./Scene";
import { type Evidence, type FamousSite, type Regime, type Site, type Twin, type TwinFile, MONTHS, fmtLatLon, lsRange, marsSeason } from "@/lib/types";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

const LIMITS = [
  ["Thin air", "Mars surface pressure is under 1% of Earth's. Wind lifts and drops dust differently"],
  ["Low gravity", "38% of Earth's. Dust settles more slowly and stays aloft longer"],
  ["Static charge", "Dry Martian dust clings electrostatically. Earth humidity bleeds charge away"],
  ["Dust itself", "Martian dust is finer (about 1.5 µm) and iron-rich. Earth dust is coarser and mixed with pollution"],
  ["Water", "No rain or dew on Mars. On Earth both clean panels and cement dust onto them"],
  ["How it is measured", "Mars: infrared, from orbit. Earth: visible light, from a reanalysis model. We compare patterns and ranks, never raw values"],
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

const PlayIcon = () => <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden><path d="M3 1 L13 7 L3 13Z" fill="currentColor" /></svg>;
const PauseIcon = () => <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden><rect x="2" y="1" width="3.5" height="12" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" /></svg>;

function Section({ title, aside, guide, children }: { title: string; aside?: React.ReactNode; guide?: string; children: React.ReactNode }) {
  return (
    <section data-guide={guide} className="border-t border-line px-5 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h3 className="text-[13px] font-medium text-dim">{title}</h3>{aside}</div>
      {children}
    </section>
  );
}

/**
 * The desktop side panels scroll on their own, and most of the right one sits below the fold.
 * "Up next": a slim bar pinned to the panel's bottom names the next section out of view and how many
 * more follow; a click brings that section up under the panel header. It goes at the end of the panel.
 */
function ScrollHint({ panel }: { panel: React.RefObject<HTMLElement | null> }) {
  const [next, setNext] = useState<{ title: string; left: number } | null>(null);
  const below = useRef<HTMLElement[]>([]);
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const check = () => {
      const bottom = el.getBoundingClientRect().bottom - 44;   // the bar's own height
      below.current = [...el.querySelectorAll<HTMLElement>(":scope section")].filter((s) => s.getBoundingClientRect().top > bottom - 8);
      const first = below.current[0];
      const title = first?.querySelector("h3")?.textContent?.trim();
      setNext((n) => (title ? (n?.title === title && n.left === below.current.length ? n : { title, left: below.current.length }) : null));
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);   // the panel resizes with the window
    ro.observe(el);
    const mo = new MutationObserver(check); // its content changes when a site or twin loads
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); mo.disconnect(); };
  }, [panel]);
  if (!next) return null;
  const go = () => {
    const el = panel.current, s = below.current[0];
    if (!el || !s) return;
    const header = el.querySelector<HTMLElement>(":scope > .sticky")?.offsetHeight ?? 0;
    el.scrollTo({ top: el.scrollTop + s.getBoundingClientRect().top - el.getBoundingClientRect().top - header, behavior: "smooth" });
    s.classList.add("guide-flash");
    setTimeout(() => s.classList.remove("guide-flash"), 2600);
  };
  return (
    <button onClick={go} aria-label={`Scroll to ${next.title}`}
      className="row surface sticky bottom-0 z-20 flex h-11 w-full items-center gap-2.5 border-t border-line px-5 text-left text-[13px] hover:bg-white/[0.035] max-md:hidden">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-surface to-transparent" />
      <span aria-hidden className="nudge num text-[16px] leading-none text-dust">↓</span>
      <span className="text-mute">Next</span>
      <span className="min-w-0 truncate text-ink">{next.title}</span>
      {next.left > 1 && <span className="ml-auto shrink-0 text-[12px] text-mute">{next.left - 1} more</span>}
    </button>
  );
}

/** A value with a thin track under it. */
function Meter({ label, value, v, color = "var(--ink)" }: { label: string; value: string; v: number; color?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3"><dt className="text-[13px]">{label}</dt><dd className="num text-[13px]">{value}</dd></div>
      <div className="mt-1.5 h-[2px] w-full bg-white/10"><div className="h-full" style={{ width: pct(Math.max(0, Math.min(1, v))), background: color }} /></div>
    </div>
  );
}

/** One line of the test card: a tick when it holds, a dash when it does not. */
function Fact({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px] leading-snug">
      <svg width="16" height="16" viewBox="0 0 16 16" className="mt-[1px] shrink-0" aria-hidden>
        {ok ? <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="var(--ok)" strokeWidth="1.5" /> : <path d="M4 8 H12" stroke="var(--mute)" strokeWidth="1.5" />}
      </svg>
      <span className={ok ? "" : "text-dim"}>{children}</span>
    </li>
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

function SiteList({ sites, siteId, setSiteId }: { sites: Site[]; siteId: string; setSiteId: (id: string) => void }) {
  return (
    <ul>
      {sites.map((s) => {
        const on = s.id === siteId;
        return (
          <li key={s.id}>
            <button onClick={() => setSiteId(s.id)} aria-pressed={on}
              className={`row flex h-9 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[14px] ${on ? "bg-white/[0.07] text-ink" : "text-dim hover:text-ink"}`}>
              <span className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "var(--mars)" : "transparent", boxShadow: on ? "none" : "inset 0 0 0 1px var(--mute)" }} />{s.name}</span>
              <span className="truncate text-[12px] text-mute">{s.place}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Ranked twins as a quiet table. The hairline under each row is its score above the shuffled baseline. */
function TwinList({ file, ti, setTi }: { file: TwinFile; ti: number | null; setTi: (i: number) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? file.twins : file.twins.slice(0, 5);
  const { lo, hi } = file.scale;
  return (
    <>
      <ol>
        {shown.map((t, i) => {
          const on = i === ti, fill = Math.max(0.04, (t.score - lo) / (hi - lo || 1));
          return (
            <li key={i}>
              <button onClick={() => setTi(i)} aria-pressed={on}
                className={`row relative grid w-full grid-cols-[1.75rem_1fr_auto] items-center gap-x-2 rounded-lg px-3 py-2 text-left ${on ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"}`}>
                <span className="num text-[12px] text-mute">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium leading-5">{t.near}</span>
                  <span className="block truncate text-[12px] leading-4 text-dim">{t.country} · {monthRange(t.test_months)}</span>
                </span>
                <span className="num text-[13px]">{t.score.toFixed(2)}</span>
                <span aria-hidden className="absolute bottom-0 left-3 h-[2px]" style={{ width: `calc((100% - 1.5rem) * ${fill})`, background: on ? "var(--dust)" : "rgba(255,255,255,0.14)" }} />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center justify-between px-3 text-[12px] text-mute">
        <span>Line length: match above the shuffled baseline</span>
        <button onClick={() => setAll((a) => !a)} className="-my-3 -mr-2 inline-flex min-h-11 items-center px-2 text-dim underline decoration-line underline-offset-4 hover:text-ink">{all ? "Top 5" : `All ${file.twins.length}`}</button>
      </div>
    </>
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
              title={`${m}: lines up with Mars ${lsRange(bin)} (${marsSeason(bin)}), match ${pct(q)}`}
              className="row flex flex-col items-stretch gap-1.5 rounded-md pb-1">
              <span className="block h-10 w-full rounded-[4px]" style={{ background: on ? "var(--dust)" : "var(--ink)", opacity: on ? 0.3 + 0.7 * q : 0.06 + 0.16 * q, outline: month === j ? "1px solid var(--ink)" : "none", outlineOffset: 2 }} />
              <span className={`num text-center text-[11px] ${month === j ? "text-ink" : "text-mute"}`}>{m[0]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] leading-5 text-dim">
        <span className="text-ink">{MONTHS[month]}</span> lines up with Mars <span className="num text-ink">{lsRange(twin.mars_bin[month])}</span>, {marsSeason(twin.mars_bin[month]).toLowerCase()} at {site.place}. Pattern match that month <span className="num text-ink">{pct(twin.month_match[month])}</span>. It strayed far from its usual level in <span className="num text-ink">{twin.off_years[month]} of {twin.n_years}</span> years
      </p>
    </div>
  );
}

/** The year as two facing rows of bars: Earth dust above, the Mars dust it lines up with below. */
function YearBar(props: { month: number; setMonth: (m: number) => void; playing: boolean; setPlaying: (p: boolean) => void; site: Site | null; twin: Twin | null }) {
  const { month, setMonth, playing, setPlaying, site, twin } = props;
  const earth = twin?.shape ?? null;
  const mars = site ? MONTHS.map((_, j) => site.shape[twin ? twin.mars_bin[j] : j]) : null;
  const top = Math.max(1.6, ...(earth ?? []), ...(mars ?? []));
  const bin = twin ? twin.mars_bin[month] : month;
  return (
    <div className="surface flex items-stretch gap-4 rounded-xl p-3">
      <button onClick={() => setPlaying(!playing)} aria-pressed={playing} aria-label={playing ? "Pause the year" : "Play the year"}
        className="row grid w-10 shrink-0 place-items-center rounded-lg bg-white/[0.07] hover:bg-white/[0.12]">{playing ? <PauseIcon /> : <PlayIcon />}</button>
      <div className="grid flex-1 grid-cols-12 gap-1" role="listbox" aria-label="Month of the year">
        {MONTHS.map((m, j) => {
          const on = j === month;
          return (
            <button key={m} role="option" aria-selected={on} aria-label={m} onClick={() => setMonth(j)} className={`row flex flex-col items-stretch rounded-md px-0.5 py-1 ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
              <span className="flex h-4 items-end"><span className="w-full rounded-[2px]" style={{ height: `${earth ? (earth[j] / top) * 100 : 8}%`, background: "var(--earth)", opacity: on ? 1 : 0.5 }} /></span>
              <span className={`num py-1 text-center text-[11px] leading-none ${on ? "text-ink" : "text-mute"}`}>{m[0]}</span>
              <span className="flex h-4 items-start"><span className="w-full rounded-[2px]" style={{ height: `${mars ? (mars[j] / top) * 100 : 8}%`, background: "var(--mars)", opacity: on ? 1 : 0.5 }} /></span>
            </button>
          );
        })}
      </div>
      <dl className="grid w-32 shrink-0 grid-cols-[auto_1fr] content-center gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-earth">Earth</dt><dd className="num">{MONTHS[month]}</dd>
        <dt className="text-mars">Mars</dt><dd className="num">{lsRange(bin)}</dd>
      </dl>
    </div>
  );
}

type Level = "holds" | "moderate" | "weak";
const LEVEL_LABEL: Record<Level, string> = { holds: "Holds", moderate: "Moderate", weak: "Weak" };

function Check({ ok, level, title, children }: { ok?: boolean; level?: Level; title: string; children: React.ReactNode }) {
  const l: Level = level ?? (ok ? "holds" : "weak");
  return (
    <div className="border-t border-line py-4">
      <div className="flex items-baseline justify-between gap-3"><h4 className="text-[14px] font-medium">{title}</h4><span className={`text-[12px] ${l === "holds" ? "text-ok" : l === "moderate" ? "text-warn" : "text-mars"}`}>{LEVEL_LABEL[l]}</span></div>
      <div className="mt-1 text-[13px] leading-5 text-dim">{children}</div>
    </div>
  );
}

const andList = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/** Where the challenge's famous analog sites land under this method (pipeline/famous_check.py). */
function FamousCheck({ sites, site, N }: { sites: FamousSite[]; site: Site; N: (p: { children: React.ReactNode }) => React.ReactElement }) {
  const hit = sites.filter((f) => f.above_baseline[site.id] > 0);
  const below = sites.filter((f) => f.scored > 0 && !(f.above_baseline[site.id] > 0));
  const unscored = sites.filter((f) => f.scored === 0);
  return (
    <Check ok={hit.length === 0} title="Famous analog sites">
      The challenge asks teams to look beyond {andList(sites.map((f) => f.name))}. <N>{hit.length} of {sites.length}</N> keep {site.place}&apos;s dust year here.
      {below.map((f) => <span key={f.name}> {f.name}&apos;s <N>{f.scored}</N> scored cells all fall below the scrambled-seasons line.</span>)}
      {unscored.length > 0 && <> {andList(unscored.map((f) => f.name))} have too little dust in the air, or are mostly ocean or ice at this grid size, to be scored at all.</>}
      {hit.length > 0 && <> {andList(hit.map((f) => f.name))} {hit.length === 1 ? "clears" : "clear"} the line.</>}
    </Check>
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
  const y = (v: number) => H - 16 - (v / top) * (H - 36);
  const line = (k: "rover" | "orbit", m: number) => pairs.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(p[k] / m).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Rover-measured dust compared with the orbital record over time">
      <path d={line("orbit", mo)} fill="none" stroke="var(--mars)" strokeWidth="1.5" />
      <path d={line("rover", mr)} fill="none" stroke="var(--ink)" strokeWidth="1.25" strokeDasharray="3 3" />
      <text x={P} y={11} className="num" fontSize="11" fill="var(--mars)">Orbit</text>
      <text x={P + 52} y={11} className="num" fontSize="11" fill="var(--ink)">Rover (dashed)</text>
      <text x={P} y={H - 2} className="num" fontSize="11" fill="var(--mute)">MY{pairs[0].my}</text>
      <text x={W - P} y={H - 2} textAnchor="end" className="num" fontSize="11" fill="var(--mute)">MY{pairs[pairs.length - 1].my}</text>
    </svg>
  );
}

function EvidencePanel({ ev, site, expectations, onClose }: { ev: Evidence; site: Site; expectations: string | null; onClose: () => void }) {
  const e = ev.sites[site.id];
  const N = ({ children }: { children: React.ReactNode }) => <span className="num text-ink">{children}</span>;
  useEffect(() => {
    const k = (x: KeyboardEvent) => x.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="surface scroll max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 md:p-8" onClick={(x) => x.stopPropagation()} role="dialog" aria-label="Evidence">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[13px] text-dim">Evidence for {site.name}, {site.place}</p><h2 className="mt-1 text-[26px] font-semibold leading-tight">Should you believe these twins?</h2></div>
          <button onClick={onClose} className="row rounded-lg bg-white/[0.07] px-3 py-1.5 text-[13px] hover:bg-white/[0.12]">Close</button>
        </div>
        <p className="mb-5 mt-2 text-[14px] leading-6 text-dim">Every check is shown whichever way it came out. The numbers come from the pipeline in the repository</p>
        <Check ok={e.shuffle.top10_above_null >= 8} title="Shuffle baseline">
          We scrambled the months of every Earth cell and matched again. The best 1% of scrambled matches score <N>{e.shuffle.null_p99}</N>; our top twin scores <N>{e.top_score}</N>. <N>{e.shuffle.top10_above_null} of 10</N> top twins beat that line, as do {e.shuffle.cells_above_null} of {e.shuffle.cells_scored} land cells
        </Check>
        {/* same bands as the README: 0.8 and up holds, 0.6 to 0.8 is moderate, below 0.6 is weak */}
        <Check level={e.split_years.spearman >= 0.8 ? "holds" : e.split_years.spearman >= 0.6 ? "moderate" : "weak"} title="Split years">
          Twins found from odd years alone and from even years alone, on both planets. Rank agreement <N>{e.split_years.spearman}</N> where 1 is identical; <N>{pct(e.split_years.top50_overlap)}</N> of the top 50 cells appear in both
        </Check>
        <Check ok={e.mars_self_test.neighbour_percentile >= 0.9} title="Mars-to-Mars self test">
          Matched against the rest of Mars, the site&apos;s own neighbouring cells rank above <N>{(e.mars_self_test.neighbour_percentile * 100).toFixed(1)}%</N> of the planet. If they did not, the fingerprint would be broken
        </Check>
        <Check ok={e.pressure_sensitivity.spearman >= 0.8} title="Pressure choice">
          We use dust above the real ground. Switching to the 610 Pa-normalised product gives rank agreement <N>{e.pressure_sensitivity.spearman}</N> and keeps <N>{pct(e.pressure_sensitivity.top50_overlap)}</N> of the top 50
        </Check>
        <Check ok={ev.storm_years.missed.length === 0 && ev.storm_years.extra.length === 0} title="Storm-year detector">
          With no list of storms to go on, the detector flags Mars years <N>{ev.storm_years.found.map((y) => `MY${y}`).join(", ") || "none"}</N>. The known global dust storms are MY{ev.storm_years.known.join(", MY")} (2001, 2007 and 2018). On Earth it flags <N>{ev.storm_years.earth_flagged.length ? ev.storm_years.earth_flagged.join(", ") : "no year"}</N>: Earth has no planet-wide storm years, which is one way it cannot rehearse Mars. {ev.storm_years.note}
        </Check>
        <Check ok={e.same_regime_in_top10 >= 5} title="Dust regimes">
          Grouping every cell on both planets by the shape of its dust year gives {ev.regimes.meta.k} regimes (cluster separation {ev.regimes.meta.silhouette[String(ev.regimes.meta.k)]}, which is loose: the regimes shade into each other). {site.place} sits in a regime that covers <N>{pct(ev.regimes.regimes[site.regime].mars_share)}</N> of Mars and only <N>{pct(ev.regimes.regimes[site.regime].earth_share)}</N> of Earth&apos;s dusty land. <N>{e.same_regime_in_top10} of 10</N> top twins fall in it
        </Check>
        {ev.famous_sites && <FamousCheck sites={ev.famous_sites} site={site} N={N} />}
        {e.rover && (
          <Check ok={e.rover.r >= 0.7} title="Rover ground truth">
            {site.name} measured the dust in its own sky. Across <N>{e.rover.n}</N> month-sized stretches, its readings and the orbital record at this cell correlate at <N>{e.rover.r}</N>. Each line is scaled to its own average because the two instruments see different wavelengths
            <RoverChart pairs={e.rover.pairs} />
          </Check>
        )}
        <div className="border-t border-line py-4">
          <h4 className="text-[14px] font-medium">What we expected before running it</h4>
          <pre className="scroll mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-5 text-dim">{expectations ?? "No expectations were registered before the run."}</pre>
        </div>
        <p className="border-t border-line pt-4 text-[13px] leading-5 text-dim">
          These are atmospheric dust-behaviour analogues: places where the sky carries dust on a similar yearly pattern. They are candidate test windows to investigate, not predictions of dust settling or power loss. Whether dust stays on a panel also depends on wind cleaning, which differed sharply between Mars sites
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
  const [layer, setLayer] = useState<"match" | "regime">("match");
  const [guide, setGuide] = useState(false);
  const [hook, setHook] = useState(false);
  const pending = useRef<number | null>(null);
  const marsPanel = useRef<HTMLElement>(null), earthPanel = useRef<HTMLElement>(null);
  const [story, setStory] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const q = new URLSearchParams(window.location.search);
    if (q.has("story")) { setStory(0); setAuto(q.get("story") === "auto"); }
    else { try { if (!localStorage.getItem("dust-twins-seen")) setHook(true); } catch { /* private mode: skip the first-visit hook */ } }
    fetch("/data/mars_sites.json").then((r) => r.json()).then((d) => setSites(d.sites)).catch(() => setErr("Could not load the data files"));
    fetch("/data/evidence.json").then((r) => r.json()).then(setEv).catch(() => {});
    fetch("/data/expectations.txt").then((r) => (r.ok ? r.text() : null)).then(setExpectations).catch(() => {});
  }, []);
  useEffect(() => {
    setFile(null); setTi(null);
    fetch(`/data/twins_${siteId}.json`).then((r) => r.json()).then((d: TwinFile) => { setFile(d); setTi(Math.min(pending.current ?? 0, d.twins.length - 1)); pending.current = null; }).catch(() => setErr("Could not load the twins"));
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

  // the guide counts as seen once it has been closed, not merely shown
  const closeGuide = () => { setGuide(false); try { localStorage.setItem("dust-twins-seen", "1"); } catch { /* ignore */ } };
  const closeHook = () => { setHook(false); try { localStorage.setItem("dust-twins-seen", "1"); } catch { /* ignore */ } };

  const site = sites.find((s) => s.id === siteId) ?? null;
  const twin = file && ti != null ? file.twins[ti] : null;
  const regimes: Regime[] | null = ev?.regimes?.regimes ?? null;

  const marsMarkers: Marker[] = useMemo(() => sites.map((s) => ({ key: `m-${s.id}`, lat: s.lat, lon: s.lon, active: s.id === siteId, onClick: () => setSiteId(s.id) })), [sites, siteId]);
  const earthMarkers: Marker[] = useMemo(() => (file?.twins ?? []).map((t, i) => ({ key: `e-${siteId}-${i}`, lat: t.lat, lon: t.lon, active: i === ti, onClick: () => setTi(i) })), [file, ti, siteId]);

  if (err) return <main className="flex h-dvh items-center justify-center p-8 text-dim">{err}</main>;

  const actions = (
    <div className="flex gap-2">
      <button onClick={() => { setAuto(false); setStory(0); }} className="row flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-[13px] font-medium text-bg hover:bg-white max-md:px-2.5"><PlayIcon /><span className="max-md:hidden">Play the story</span><span className="md:hidden">Story</span></button>
      <button onClick={() => setShowEv(true)} disabled={!ev || !site} className="row h-9 rounded-lg bg-white/[0.07] px-3.5 text-[13px] font-medium hover:bg-white/[0.12] max-md:px-2.5">Evidence</button>
      <button onClick={() => setGuide(true)} className="row h-9 whitespace-nowrap rounded-lg bg-white/[0.07] px-3.5 text-[13px] font-medium hover:bg-white/[0.12] max-md:px-2.5"><span className="max-md:hidden">How it works</span><span className="md:hidden">Guide</span></button>
    </div>
  );

  return (
    <main className="relative w-full md:grid md:h-dvh md:grid-cols-[300px_1fr_380px] md:overflow-hidden">
      {/* Mars sidebar */}
      <aside ref={marsPanel} className="surface scroll z-10 md:overflow-y-auto md:border-r md:border-line max-md:hidden" aria-label="Mars landing site">
        <div className="surface sticky top-0 z-20 border-b border-line px-5 pb-5 pt-6">
          <h1 className="flex items-center gap-2.5 text-[22px] font-semibold leading-none">
            <svg width="26" height="20" viewBox="10 14 44 36" aria-hidden><circle cx="27" cy="32" r="15" fill="none" stroke="var(--mars)" strokeWidth="4" /><circle cx="37" cy="32" r="15" fill="none" stroke="var(--earth)" strokeWidth="4" /></svg>
            Dust Twins
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-dim">Where on Earth the sky carries dust like a Mars landing site, and in which months</p>
        </div>
        <Section title="Mars landing site" guide="site"><div className="-mx-3"><SiteList sites={sites} siteId={siteId} setSiteId={setSiteId} /></div></Section>
        {layer === "regime" && regimes && site && (
          <Section title="Dust regimes on both planets">
            <p className="mb-3 text-[12px] leading-4 text-mute">Cells grouped by the shape of their dust year, whatever month it peaks in</p>
            <ul className="grid gap-3">
              {regimes.map((r) => (
                <li key={r.id} className="grid grid-cols-[10px_1fr] gap-x-2.5">
                  <span className="mt-1 h-2.5 w-2.5 rounded-[3px]" style={{ background: `rgb(${r.rgb.join(",")})` }} />
                  <span>
                    <span className={`block text-[13px] leading-4 ${r.id === site.regime ? "text-ink" : "text-dim"}`}>{r.name}{r.id === site.regime ? ` · ${site.name} is here` : ""}</span>
                    <span className="num block text-[11px] leading-4 text-mute">Mars {pct(r.mars_share)} · Earth {pct(r.earth_share)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {site && (
          <>
            <Section title="Its dust year">
              <h2 className="text-[20px] font-semibold leading-6">{site.place}</h2>
              <p className="num mt-1 text-[12px] text-mute">{fmtLatLon(site.lat, site.lon)}</p>
              <p className="mt-2 text-[13px] leading-5 text-dim">{site.note}</p>
              <div className="-mx-2 mt-2 flex justify-center"><DustRing mars={site.shape} marsYears={site.series} title={`Dust ring for ${site.place}`} size={264} /></div>
              <p className="text-[12px] leading-4 text-mute">One Mars year as a ring. Further out is dustier than this site&apos;s own average. Faint lines are single years; spikes are global storms</p>
            </Section>
            <Section title="Fingerprint">
              <dl className="grid gap-4">
                <Meter label="Months that run stormy" value={pct(site.storm)} v={site.storm / 0.25} color="var(--mars)" />
                <Meter label="Haze, ranked across Mars" value={pct(site.haze)} v={site.haze} color="var(--mars)" />
                <Meter label="Year-to-year swing" value={site.var.toFixed(2)} v={site.var / 0.8} color="var(--mars)" />
              </dl>
            </Section>
          </>
        )}
        <ScrollHint panel={marsPanel} />
      </aside>

      {/* scene */}
      <div className="relative h-[42dvh] md:h-auto">
        <div className="absolute inset-0">
          <Scene marsMarkers={marsMarkers} earthMarkers={earthMarkers}
            marsFace={site ? { lat: site.lat, lon: site.lon } : null} earthFace={twin ? { lat: twin.lat, lon: twin.lon } : null}
            overlay={layer === "regime" ? "/data/regimes_earth.png" : file ? `/data/score_${siteId}.png` : null}
            marsOverlay={layer === "regime" ? "/data/regimes_mars.png" : null} additive={layer === "match"}
            marsFrame={twin ? twin.mars_bin[month] : month} earthFrame={month} showHaze={playing}
            threadFrom={site ? `m-${site.id}` : null} threadTo={twin ? `e-${siteId}-${ti}` : null} reducedMotion={reduced} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 md:hidden">
          <h1 className="whitespace-nowrap text-[16px] font-semibold">Dust Twins</h1>
          <div className="pointer-events-auto">{actions}</div>
        </div>
        <div className="absolute left-1/2 top-14 z-10 flex -translate-x-1/2 gap-1 rounded-lg bg-white/[0.06] p-1 max-md:hidden" role="group" aria-label="Map layer">
          {([["match", "Match score"], ["regime", "Dust regimes"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setLayer(k)} aria-pressed={layer === k} className={`row h-7 rounded-md px-3 text-[12px] ${layer === k ? "bg-white/[0.14] text-ink" : "text-dim hover:text-ink"}`}>{l}</button>
          ))}
        </div>
        {site && (
          <div className="pointer-events-none absolute inset-x-0 top-6 grid grid-cols-2 text-center max-md:top-auto max-md:bottom-3">
            <p className="text-[13px]"><span className="text-mars">Mars</span> <span className="text-dim">{site.place}</span></p>
            <p className="text-[13px]"><span className="text-earth">Earth</span> <span className="text-dim">{twin ? `${twin.near}, ${twin.country}` : "…"}</span></p>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-6 max-md:hidden">
          {story == null && <div className="mx-auto max-w-[560px]"><YearBar month={month} setMonth={setMonth} playing={playing} setPlaying={setPlaying} site={site} twin={twin} /></div>}
          <p className="mx-auto mt-3 max-w-[640px] text-center text-[11px] leading-4 text-mute">Mars dust: Montabone et al. (CC BY-SA 3.0). Earth dust: NASA MERRA-2. Imagery: NASA, Solar System Scope (CC BY 4.0). The haze animation illustrates the dust record; it is not a soiling or power prediction. Story narration is SI-generated speech (ElevenLabs)</p>
        </div>
      </div>

      {/* Earth sidebar */}
      <aside ref={earthPanel} className="surface scroll z-10 md:overflow-y-auto md:border-l md:border-line" aria-label="Earth twins">
        <div className="surface sticky top-0 z-20 border-b border-line px-5 py-4 max-md:hidden">
          {actions}
          {site && twin && (
            <button onClick={() => pointAt("card")} className="row -mx-2 mt-3 grid w-[calc(100%+1rem)] grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.05]" title="Jump to the test card">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium leading-5">{twin.near}, {twin.country}</span>
                <span className="block truncate text-[12px] leading-4 text-dim">Twin {(ti ?? 0) + 1} of {site.name}&apos;s site · test {monthRange(twin.test_months)}</span>
              </span>
              <span className="num text-[13px] text-dust">{twin.score.toFixed(2)}</span>
            </button>
          )}
        </div>
        <Section title="Ask a planning question" aside={<span className="text-[11px] text-mute">SI · Gemini</span>}>
          <Ask showing={twin && site ? `${twin.near}, ${twin.country} for ${site.name} · ${monthRange(twin.test_months)}` : null} onAction={(a) => {
            const rank = Math.max(0, (a.rank ?? 1) - 1);
            if (a.month && a.month >= 1 && a.month <= 12) setMonth(a.month - 1);
            if (a.site === siteId) setTi(rank); else { pending.current = rank; setSiteId(a.site); }
          }} />
        </Section>
        <Section title={site ? `Earth twins of ${site.place}` : "Earth twins"} guide="twins">
          <div className="-mx-3 mb-3 md:hidden"><SiteList sites={sites} siteId={siteId} setSiteId={setSiteId} /></div>
          <div className="-mx-3">{file ? <TwinList file={file} ti={ti} setTi={setTi} /> : <p className="px-3 py-6 text-[13px] text-dim">Matching…</p>}</div>
        </Section>

        {twin && site && (
          <>
            <Section title={`Test card for ${site.name}`} guide="card">
              <h2 className="text-[20px] font-semibold leading-6">{twin.place}</h2>
              <p className="num mt-1 text-[12px] text-mute">{fmtLatLon(twin.lat, twin.lon)} · match {twin.score.toFixed(2)} of 1</p>
              <ul className="mt-4 grid gap-2">
                <Fact ok={twin.beats_null}>{twin.beats_null ? "Beats the shuffled-season baseline" : "Does not beat the shuffled-season baseline"}</Fact>
                <Fact ok={twin.robust >= 0.9}>In the top 50 under {pct(twin.robust)} of random weightings</Fact>
                <Fact ok={!twin.famous}>{twin.famous ? `Already a known analog (${twin.famous})` : "Not one of the famous analog sites"}</Fact>
                {regimes && (
                  <Fact ok={twin.same_regime}>
                    {twin.same_regime ? `Same dust regime as ${site.place}: ${regimes[twin.regime].name.toLowerCase()}` : `Different dust regime: ${regimes[twin.regime].name.toLowerCase()} here, ${regimes[site.regime].name.toLowerCase()} at ${site.place}`}
                  </Fact>
                )}
                {site.cleaning !== "n/a" && (
                  <Fact ok={twin.wind_tag === site.cleaning}>
                    {twin.wind_tag === site.cleaning ? `Winds are ${twin.wind_tag}, as at ${site.name}'s site` : `Winds are ${twin.wind_tag} here; ${site.name}'s site was ${site.cleaning}`}
                  </Fact>
                )}
                {site.reliability < 0.5 && <Fact ok={false}>The Mars cell has few direct observations</Fact>}
              </ul>
            </Section>

            <Section title="Candidate test window" guide="calendar" aside={<span className="num text-[13px] text-dust">{monthRange(twin.test_months)}</span>}>
              <p className="mb-4 text-[13px] leading-5 text-dim">The months that line up with {site.place}&apos;s dustiest stretch. A hypothesis to check on site</p>
              <Calendar twin={twin} site={site} month={month} setMonth={setMonth} />
            </Section>

            <Section title="Argue against this twin" guide="challenge">
              <Challenge site={site.id} rank={(ti ?? 0) + 1} twinName={twin.near} />
            </Section>

            <Section title="Two rings, one year" aside={<button onClick={() => setAligned((a) => !a)} className="-my-3 -mr-2 inline-flex min-h-11 items-center px-2 text-[12px] text-dim underline decoration-line underline-offset-4 hover:text-ink">{aligned ? "Show raw calendar" : "Line up the seasons"}</button>}>
              <div className="-mx-2 flex justify-center">
                <DustRing mars={site.shape} earth={twin.shape} shift={twin.shift} aligned={aligned} highlight={month} size={280}
                  title={`Dust rings for ${site.place} (Mars) and ${twin.place} (Earth)`} />
              </div>
              <p className="text-[12px] leading-4 text-mute"><span className="text-mars">Mars</span> and <span className="text-earth">Earth</span>. The Earth ring is turned {twin.shift} month{twin.shift === 1 ? "" : "s"} so the seasons line up</p>
            </Section>

            <Section title="What matches">
              <dl className="grid gap-4">
                <Meter label="Seasonal shape" value={pct(twin.components.season)} v={twin.components.season} />
                <Meter label="Storminess" value={pct(twin.components.storminess)} v={twin.components.storminess} />
                <Meter label="Usual haze, ranked on its own planet" value={pct(twin.components.haze)} v={twin.components.haze} />
                <Meter label="Year-to-year swing" value={pct(twin.components.variability)} v={twin.components.variability} />
              </dl>
            </Section>

            <Section title="What can never match">
              <ul className="grid gap-3">
                {LIMITS.map(([k, v]) => <li key={k} className="text-[13px] leading-5 text-dim"><span className="text-ink">{k}</span><br />{v}</li>)}
              </ul>
            </Section>
          </>
        )}
        <p className="border-t border-line px-5 py-5 text-[11px] leading-4 text-mute md:hidden">Mars dust: Montabone et al. (CC BY-SA 3.0). Earth dust: NASA MERRA-2. Imagery: NASA, Solar System Scope (CC BY 4.0). Story narration is SI-generated speech (ElevenLabs)</p>
        <ScrollHint panel={earthPanel} />
      </aside>

      {story != null && <Story step={story} setStep={setStory} site={site} twin={twin} auto={auto} ev={ev} openEvidence={() => { setStory(null); setShowEv(true); }} />}
      {hook && <Hook onExplore={closeHook} onStory={() => { closeHook(); setAuto(false); setStory(0); }} onGuide={() => { closeHook(); setGuide(true); }} />}
      {guide && <Guide onClose={closeGuide} onStory={() => { closeGuide(); setAuto(false); setStory(0); }} />}
      {showEv && ev && site && <EvidencePanel ev={ev} site={site} expectations={expectations} onClose={() => setShowEv(false)} />}
    </main>
  );
}
