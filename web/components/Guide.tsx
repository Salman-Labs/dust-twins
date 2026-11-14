"use client";
// "How it works": opens on a first visit and from the header. Each step can point at the part of the
// screen it describes. Written with SI assistance (Claude).
import { useEffect } from "react";

const STEPS: [string, string, string][] = [
  ["site", "Pick a Mars landing site", "Its ring is one year of dust"],
  ["twins", "Read its Earth twins", "Ten places with the closest dust year"],
  ["calendar", "Check the test window", "The months that line up with Mars"],
  ["challenge", "Argue against it", "A model lists why the match could fail"],
];

/** Scroll a marked section into view and outline it briefly. */
export function pointAt(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-guide="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("guide-flash");
  setTimeout(() => el.classList.remove("guide-flash"), 2600);
}

export default function Guide({ onClose, onStory }: { onClose: () => void; onStory: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="surface w-full max-w-[520px] rounded-2xl p-6 md:p-7" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How Dust Twins works">
        <h2 className="text-[22px] font-semibold leading-tight">How Dust Twins works</h2>
        <p className="mt-2 text-[14px] leading-6 text-dim">Find where on Earth dust behaves like it does at a Mars landing site, and in which months, so Mars solar hardware can be tested there first</p>

        <ol className="mt-5">
          {STEPS.map(([id, title, text], i) => (
            <li key={id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-2 border-t border-line py-2.5">
              <span className="num text-[12px] text-mute">{i + 1}</span>
              <span><span className="block text-[14px] font-medium leading-5">{title}</span><span className="block text-[12px] leading-4 text-dim">{text}</span></span>
              <button onClick={() => { onClose(); setTimeout(() => pointAt(id), 150); }} className="row h-8 rounded-lg bg-white/[0.07] px-3 text-[12px] hover:bg-white/[0.12]">Show me</button>
            </li>
          ))}
        </ol>

        <details className="border-t border-line py-3">
          <summary className="cursor-pointer text-[13px] text-dim hover:text-ink">How a match is made, and the data behind it</summary>
          <p className="mt-2 text-[13px] leading-5 text-dim">Every place on both planets gets four numbers: the shape of its dust year, how often months run stormy, how hazy it is against the rest of its planet, and how much it changes year to year. Earth&apos;s year is turned until its shape fits the Mars site; that turn builds the test calendar</p>
          <p className="mt-2 text-[13px] leading-5 text-dim">Mars: 13 Mars years of orbiter dust maps. Earth: 24 years of NASA MERRA-2. Ground truth: dust measured by Opportunity, Spirit and InSight. These are candidate test windows, not predictions of dust settling or power loss</p>
        </details>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onClose} className="row h-9 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-bg hover:bg-white">Start exploring</button>
          <button onClick={onStory} className="row h-9 rounded-lg bg-white/[0.07] px-3.5 text-[13px] font-medium hover:bg-white/[0.12]">Play the 30-second story</button>
        </div>
      </div>
    </div>
  );
}
