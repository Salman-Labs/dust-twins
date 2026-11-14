"use client";
// Story mode (judge mode): the InSight story in five beats. Narration plays if /audio/story-N.mp3 exists.
// Beats 2 and 4 are hands-on: pick a Mars year, then turn Earth's year until the rings lock.
import { useEffect, useMemo, useRef, useState } from "react";
import DustRing from "./DustRing";
import { type Evidence, type Site, type Twin, MONTHS } from "@/lib/types";

export const STORY_STEPS = 5;
const SECONDS = [6, 6, 6, 7, 5];
const STORM_YEARS: Record<number, string> = { 25: "2001 global storm", 28: "2007 global storm", 34: "2018 global storm" };

/** Correlation between the Mars ring and the Earth ring turned by k months. */
function ringMatch(mars: number[], earth: number[], k: number) {
  const e = mars.map((_, i) => earth[(i - k + 120) % 12]);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const mm = mean(mars), me = mean(e);
  let n = 0, dm = 0, de = 0;
  for (let i = 0; i < 12; i++) { n += (mars[i] - mm) * (e[i] - me); dm += (mars[i] - mm) ** 2; de += (e[i] - me) ** 2; }
  return n / Math.sqrt(dm * de || 1);
}

export default function Story(props: {
  step: number; setStep: (s: number | null) => void; site: Site | null; twin: Twin | null; auto: boolean;
  ev: Evidence | null; openEvidence: () => void;
}) {
  const { step, setStep, site, twin, ev } = props;
  const [muted, setMuted] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [turn, setTurn] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const next = () => setStep(step + 1 < STORY_STEPS ? step + 1 : null);

  useEffect(() => { fetch("/audio/story-1.mp3", { method: "HEAD" }).then((r) => setHasAudio(r.ok)).catch(() => {}); }, []);
  useEffect(() => { setTurn(0); setYear(null); }, [step]);

  // narration: one clip per beat; in auto mode the beat ends when the clip does
  useEffect(() => {
    audio.current?.pause();
    if (!hasAudio || muted) return;
    const a = new Audio(`/audio/story-${step + 1}.mp3`);
    audio.current = a;
    if (props.auto) a.onended = () => setTimeout(next, 500);
    a.play().catch(() => {});
    return () => a.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hasAudio, muted]);
  useEffect(() => {
    if (!props.auto || (hasAudio && !muted)) return;
    const t = setTimeout(next, SECONDS[step] * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, props.auto, hasAudio, muted]);
  // auto mode performs the hands-on beats itself
  useEffect(() => {
    if (!props.auto || !site || !twin) return;
    if (step === 1) { const i = site.mars_years?.indexOf(34) ?? -1; const t = setTimeout(() => setYear(i >= 0 ? i : null), 2500); return () => clearTimeout(t); }
    if (step === 3) { const t = setInterval(() => setTurn((k) => (k < twin.shift ? k + 1 : k)), 900); return () => clearInterval(t); }
  }, [step, props.auto, site, twin]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStep(null);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") setStep(Math.max(0, step - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const match = useMemo(() => (site && twin ? ringMatch(site.shape, twin.shape, turn) : 0), [site, twin, turn]);
  const locked = !!twin && turn === twin.shift;
  const e = ev && site ? ev.sites[site.id] : null;

  const captions: [string, string][] = [
    ["December 2022", "NASA's InSight lander falls silent on Mars. Not broken. Buried: four years of dust on its solar panels."],
    ["The rhythm of dust", `Dust over ${site?.place ?? "Elysium Planitia"} rises and falls on a yearly beat. Pick a Mars year to see it, storms and all.`],
    ["One thread", twin ? `Where on Earth does the sky keep that beat? The closest match we found: ${twin.near}, ${twin.country}.` : "Where on Earth does the sky keep that beat?"],
    ["Your turn", locked ? `Locked. Earth's year, turned ${twin!.shift} months, tracks Mars. To rehearse the dustiest stretch, the pattern says ${twin!.test_months.join(", ")}.` : "The two years are out of step. Turn Earth's year until the rings line up."],
    ["Checked, with limits", "Every twin is tested against scrambled seasons, split years and the rovers' own readings. Thin air, low gravity and static charge can never match, and every card says so."],
  ];
  const [kicker, text] = captions[step];
  const dim = step === 0 || step === 1 ? "bg-black/85" : step === 3 ? "bg-black/70" : "pointer-events-none";

  return (
    <div className={`fixed inset-0 z-20 flex flex-col ${dim}`} role="dialog" aria-label="Story mode">
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-6">
        {step === 0 && (
          <figure className="max-w-3xl overflow-hidden">
            <div className="overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tex/insight_selfie.jpg" alt="InSight's final selfie, its solar panels covered in red dust" className="kenburns w-full" />
            </div>
            <figcaption className="label mt-2">InSight&apos;s final selfie, 24 April 2022 · NASA/JPL-Caltech</figcaption>
          </figure>
        )}
        {step === 1 && site && (
          <div className="flex flex-col items-center">
            <DustRing mars={site.shape} marsYears={site.series} emphYear={year} title={`Dust ring for ${site.place}`} size={400} />
            <div className="pointer-events-auto mt-1 flex max-w-xl flex-wrap justify-center gap-1" role="group" aria-label="Mars year">
              {(site.mars_years ?? []).map((my, i) => (
                <button key={my} onClick={() => setYear(year === i ? null : i)} aria-pressed={year === i}
                  className={`num rounded-md border px-2 py-1 text-[11px] ${year === i ? "border-ink bg-white/10" : STORM_YEARS[my] ? "border-mars/60 text-mars" : "border-line text-dim"}`}>MY{my}</button>
              ))}
            </div>
            <p className="mt-2 h-4 text-[12px] text-dim">{year != null && site.mars_years ? (STORM_YEARS[site.mars_years[year]] ?? `Mars year ${site.mars_years[year]}: an ordinary year`) : "Orange years had planet-wide dust storms"}</p>
          </div>
        )}
        {step === 3 && site && twin && (
          <div className="flex flex-col items-center">
            <DustRing mars={site.shape} earth={twin.shape} shift={turn} aligned title="Mars and Earth dust rings" size={380} />
            <div className="pointer-events-auto mt-1 flex items-center gap-3">
              <button onClick={() => setTurn((k) => (k + 11) % 12)} aria-label="Turn Earth's year back one month" className="grid h-10 w-10 place-items-center rounded-lg border border-line text-lg hover:border-earth">‹</button>
              <div className="w-56 text-center">
                <div className="h-1.5 w-full rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, match) * 100}%`, background: locked ? "var(--ok)" : "var(--earth)" }} /></div>
                <p className="num mt-1.5 text-[12px]">{locked ? "locked" : `turned ${turn} mo`} · rhythm match {Math.round(Math.max(0, match) * 100)}%</p>
              </div>
              <button onClick={() => setTurn((k) => (k + 1) % 12)} aria-label="Turn Earth's year forward one month" className="grid h-10 w-10 place-items-center rounded-lg border border-line text-lg hover:border-earth">›</button>
            </div>
            <p className="mt-2 text-[12px] text-dim"><span className="text-mars">Mars</span> stays put. <span className="text-earth">Earth</span> turns: {MONTHS[0]} now sits where Mars has Ls {turn * 30}°.</p>
          </div>
        )}
        {step === 4 && e && (
          <div className="pointer-events-auto grid grid-cols-3 gap-6 rounded-lg bg-black/70 px-8 py-6 text-center">
            {[[`${e.shuffle.top10_above_null}/10`, "top twins beat scrambled seasons"], [e.rover ? e.rover.r.toFixed(2) : "–", "rover vs orbit agreement"], [`${10 - e.famous_in_top10}/10`, "are not famous analog sites"]].map(([n, l]) => (
              <div key={l}><p className="font-serif text-4xl text-dust">{n}</p><p className="mt-1 max-w-[9rem] text-[12px] leading-snug text-dim">{l}</p></div>
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-auto mx-auto mb-4 w-full max-w-2xl px-4 md:mb-6">
        <div className="panel p-4 md:p-5">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: STORY_STEPS }, (_, i) => (
              <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/12">
                <span key={`${i}-${step}`} className={`block h-full bg-dust ${i < step ? "w-full" : i === step ? (props.auto ? "story-fill" : "w-full") : "w-0"}`} style={i === step ? { animationDuration: `${SECONDS[step]}s` } : undefined} />
              </span>
            ))}
          </div>
          <p className="label mt-3 text-dust">{kicker}</p>
          <p className="mt-1 text-lg font-medium leading-snug md:text-[22px]">{text}</p>
          <div className="mt-3 flex items-center gap-2 text-[13px]">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-30">Back</button>
            {step + 1 < STORY_STEPS
              ? <button onClick={next} className="rounded-lg bg-dust px-3.5 py-1.5 font-medium text-black">Next</button>
              : <><button onClick={() => setStep(null)} className="rounded-lg bg-dust px-3.5 py-1.5 font-medium text-black">Open the test card</button>
                  <button onClick={props.openEvidence} className="rounded-lg border border-line px-3 py-1.5">See the evidence</button></>}
            {hasAudio && <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} className="ml-auto rounded-lg border border-line px-3 py-1.5">{muted ? "Sound off" : "Sound on"}</button>}
            <button onClick={() => setStep(null)} className={`${hasAudio ? "" : "ml-auto"} px-2 py-1.5 text-dim`}>Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}
