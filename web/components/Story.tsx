"use client";
// Story mode (judge mode): the InSight story in five beats, about 30 seconds end to end.
import { useEffect } from "react";
import DustRing from "./DustRing";
import type { Site, Twin } from "@/lib/types";

export const STORY_STEPS = 5;
const SECONDS = [6, 6, 6, 7, 6];

export default function Story(props: { step: number; setStep: (s: number | null) => void; site: Site | null; twin: Twin | null; auto: boolean }) {
  const { step, setStep, site, twin } = props;
  useEffect(() => {
    if (!props.auto) return;
    const t = setTimeout(() => setStep(step + 1 < STORY_STEPS ? step + 1 : null), SECONDS[step] * 1000);
    return () => clearTimeout(t);
  }, [step, props.auto, setStep]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStep(null);
      if (e.key === "ArrowRight") setStep(step + 1 < STORY_STEPS ? step + 1 : null);
      if (e.key === "ArrowLeft") setStep(Math.max(0, step - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [step, setStep]);

  const captions = [
    ["December 2022", "NASA's InSight lander falls silent on Mars. Not broken. Buried: four years of dust on its solar panels."],
    ["The rhythm of dust", `Dust over ${site?.place ?? "Elysium Planitia"} rises and falls on a yearly beat. This ring is 13 Mars years of orbiter data.`],
    ["One thread", twin ? `Where on Earth does the sky keep that beat? The closest match: ${twin.place}.` : "Where on Earth does the sky keep that beat?"],
    ["A test calendar", twin ? `Turn Earth's year by ${twin.shift} months and the rings line up. To rehearse the dustiest stretch, the pattern says: ${twin.test_months.join(", ")}.` : ""],
    ["Checked, with limits", "Tested against scrambled seasons, split years, and Mars itself. Thin air, low gravity and static charge can never match, and every card says so."],
  ];
  const [kicker, text] = captions[step];
  const cover = step < 2;

  return (
    <div className={`fixed inset-0 z-20 flex flex-col ${cover ? "bg-black/85" : "pointer-events-none"}`} role="dialog" aria-label="Story mode">
      <div className="flex flex-1 items-center justify-center p-6">
        {step === 0 && (
          <figure className="max-w-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tex/insight_selfie.jpg" alt="InSight's final selfie, its solar panels covered in red dust" className="w-full rounded-xl border border-line" />
            <figcaption className="label mt-2">InSight&apos;s final selfie, 24 April 2022 · NASA/JPL-Caltech</figcaption>
          </figure>
        )}
        {step === 1 && site && <DustRing mars={site.shape} marsYears={site.series} title={`Dust ring for ${site.place}`} size={440} />}
      </div>
      <div className="pointer-events-auto mx-auto mb-6 w-full max-w-2xl px-4">
        <div className="panel p-5">
          <p className="label text-dust">{step + 1} / {STORY_STEPS} · {kicker}</p>
          <p className="mt-1 text-xl font-medium leading-snug md:text-2xl">{text}</p>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="label rounded-full border border-line px-3 py-1.5 disabled:opacity-30">Back</button>
            <button onClick={() => setStep(step + 1 < STORY_STEPS ? step + 1 : null)} className="label rounded-full border border-dust px-3 py-1.5 text-dust">{step + 1 < STORY_STEPS ? "Next" : "Explore it yourself"}</button>
            <button onClick={() => setStep(null)} className="label ml-auto px-2 py-1.5">Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}
