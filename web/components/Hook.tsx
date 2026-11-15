"use client";
// First-visit opening: InSight's first and final selfies side by side say why dust matters, then the idea.
// It sits as one card over the live app, dimmed behind it; clicking outside the card, "Start exploring"
// or Escape enters the app. "How it works" stays one tap away. Written with SI assistance (Claude).
import { useEffect } from "react";

type Props = { onExplore: () => void; onStory: () => void; onGuide: () => void };

function Shot({ src, alt, when, delay, children }: { src: string; alt: string; when: string; delay: string; children: React.ReactNode }) {
  return (
    <figure className="hook-in m-0" style={{ animationDelay: delay }}>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="aspect-[16/10] w-full object-cover object-[50%_45%]" />
      </div>
      <figcaption className="mt-2.5 flex flex-col gap-0.5 text-left md:mt-3 md:flex-row md:items-baseline md:gap-3">
        <span className="num shrink-0 text-[12px] text-mute">{when}</span>
        <span className="text-[12px] leading-4 text-dim md:text-[14px] md:leading-5">{children}</span>
      </figcaption>
    </figure>
  );
}

export default function Hook({ onExplore, onStory, onGuide }: Props) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onExplore();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onExplore]);

  return (
    <div className="scroll fixed inset-0 z-30 overflow-y-auto bg-black/60 backdrop-blur-[3px]" role="dialog" aria-label="Why Dust Twins exists" onClick={onExplore}>
      <div className="flex min-h-full items-center justify-center p-3 md:p-8">
        <div className="hook-in surface w-full max-w-[940px] rounded-2xl border border-line px-4 py-7 text-center shadow-[0_30px_80px_rgba(0,0,0,.55)] md:px-10 md:py-10"
          onClick={(e) => e.stopPropagation()} style={{ animationDelay: "0.05s" }}>
          <p className="num hook-in text-[11px] uppercase tracking-[0.12em] text-dust" style={{ animationDelay: "0.1s" }}>NASA Space Apps 2026 · Earth analogs for Mars</p>
          <h2 className="hook-in mt-3 text-[28px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[42px]" style={{ animationDelay: "0.2s" }}>Dust ended two NASA Mars missions.</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-6">
            <Shot src="/tex/insight_first_selfie.jpg" alt="InSight's first selfie, December 2018: clean solar panels" when="Dec 2018" delay="0.35s">
              InSight lands. <span className="text-ink">Clean panels</span>, about 5,000 watt-hours a day
            </Shot>
            <Shot src="/tex/insight_selfie.jpg" alt="InSight's final selfie, April 2022: solar panels covered in red dust" when="Apr 2022" delay="0.55s">
              <span className="text-ink">Buried in dust</span>, about 500 watt-hours a day. The mission ends
            </Shot>
          </div>
          <p className="hook-in mx-auto mt-6 max-w-[60ch] text-[15px] leading-6 text-dim md:mt-8 md:text-[17px] md:leading-7" style={{ animationDelay: "0.75s" }}>
            A planet-wide dust storm silenced Opportunity too, in 2018. <span className="text-ink">Dust Twins finds where on Earth dust behaves like Mars, and in which months, so hardware can be tested there first.</span>
          </p>
          <div className="hook-in mt-7 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "0.9s" }}>
            <button onClick={onStory} className="row h-11 rounded-lg bg-ink px-4 text-[14px] font-medium text-bg hover:bg-white">Play the 30-second story</button>
            <button onClick={onExplore} className="row h-11 rounded-lg bg-white/[0.1] px-4 text-[14px] font-medium hover:bg-white/[0.16]">Start exploring</button>
            <button onClick={onGuide} className="row h-11 px-3 text-[14px] text-dim underline-offset-4 hover:text-ink hover:underline">How it works</button>
          </div>
          <p className="hook-in mt-6 text-[12px] text-mute" style={{ animationDelay: "1s" }}>InSight&apos;s first and final selfies, December 2018 and April 2022 · NASA/JPL-Caltech</p>
        </div>
      </div>
    </div>
  );
}
