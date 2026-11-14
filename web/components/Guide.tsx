"use client";
// "How it works": opens on a first visit and from the header. Each step can point at the part of the
// screen it describes. Written with SI assistance (Claude).
import { useEffect } from "react";

const STEPS: [string, string, string][] = [
  ["site", "Pick a Mars landing site", "Five sites where rovers and landers worked. The ring shows that site's dust year from 13 Mars years of orbiter data"],
  ["twins", "Read its Earth twins", "The ten places on Earth whose sky carries dust on the most similar yearly pattern. Click one and both globes turn to it"],
  ["calendar", "Check the test window", "Each Earth month lines up with a Mars season. The highlighted months are the ones that rehearse the site's dustiest stretch"],
  ["challenge", "Argue against it", "A model reads that twin's figures and gives the strongest reasons the match could fail. Then open Evidence for the method checks"],
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
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mt-6 text-[13px] font-medium text-dim">{children}</h3>;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="surface scroll max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 md:p-8" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How Dust Twins works">
        <h2 className="text-[26px] font-semibold leading-tight">How Dust Twins works</h2>
        <p className="mt-2 text-[14px] leading-6 text-dim">
          Dust ended two NASA Mars missions by burying their solar panels. This tool finds the places on Earth where dust in the sky behaves most like it does at a Mars landing site, and the months when it does, so Mars solar and dust-cleaning hardware can be tried there first
        </p>

        <H>Try it in four steps</H>
        <ol className="mt-2">
          {STEPS.map(([id, title, text], i) => (
            <li key={id} className="grid grid-cols-[1.75rem_1fr_auto] items-start gap-x-2 border-t border-line py-3">
              <span className="num text-[12px] leading-5 text-mute">{i + 1}</span>
              <span><span className="block text-[14px] font-medium leading-5">{title}</span><span className="mt-0.5 block text-[13px] leading-5 text-dim">{text}</span></span>
              <button onClick={() => { onClose(); setTimeout(() => pointAt(id), 150); }} className="row h-8 rounded-lg bg-white/[0.07] px-3 text-[12px] hover:bg-white/[0.12]">Show me</button>
            </li>
          ))}
        </ol>

        <H>How a match is made</H>
        <p className="mt-2 text-[13px] leading-5 text-dim">
          Every place on both planets gets the same four numbers: the shape of its dust year, how often months run stormy, how hazy it usually is compared with the rest of its planet, and how much it changes from year to year. Earth&apos;s year is turned month by month until its shape fits the Mars site best; that turn is what builds the test calendar. Only patterns and ranks are compared, never raw values, because the two planets are measured differently
        </p>

        <H>Where the data comes from</H>
        <ul className="mt-2 grid gap-1.5 text-[13px] leading-5 text-dim">
          <li><span className="text-ink">Mars</span> 13 Mars years of daily dust maps built from NASA orbiter instruments (Montabone et al.)</li>
          <li><span className="text-ink">Earth</span> 24 years of NASA&apos;s MERRA-2 dust record, 1999 to 2022, plus surface wind</li>
          <li><span className="text-ink">Ground truth</span> dust measured by the Opportunity, Spirit and InSight missions themselves</li>
        </ul>
        <p className="mt-3 text-[13px] leading-5 text-dim">Results are computed once by an open pipeline and shown as they are. These are candidate test windows to investigate, not predictions of dust settling or power loss</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={onClose} className="row h-9 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-bg hover:bg-white">Start exploring</button>
          <button onClick={onStory} className="row h-9 rounded-lg bg-white/[0.07] px-3.5 text-[13px] font-medium hover:bg-white/[0.12]">Play the 30-second story</button>
        </div>
      </div>
    </div>
  );
}
