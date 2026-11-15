"use client";
// First-visit opening: the InSight selfie pair says why dust matters before any instructions.
// "How it works" stays one tap away. Written with SI assistance (Claude).
import { useEffect } from "react";

export default function Hook({ onExplore, onStory, onGuide }: { onExplore: () => void; onStory: () => void; onGuide: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onExplore();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onExplore]);

  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-black" role="dialog" aria-label="Why Dust Twins exists">
      {/* clean panels (Dec 2018) dissolve into buried panels (Apr 2022) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tex/insight_first_selfie.jpg" alt="" aria-hidden className="hook-img hook-first absolute inset-0 h-full w-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tex/insight_selfie.jpg" alt="InSight's final selfie, April 2022: its solar panels covered in red dust" className="hook-img hook-last absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black via-black/70 to-black/10 md:bg-gradient-to-r md:from-black/95 md:via-black/50 md:to-black/0" />

      <div className="relative z-[3] flex h-full flex-col justify-end p-6 md:max-w-[640px] md:justify-center md:p-14">
        <p className="num hook-in text-[11px] uppercase tracking-[0.12em] text-dust" style={{ animationDelay: "0.2s" }}>NASA Space Apps 2026 · Earth analogs for Mars</p>
        <h2 className="hook-in mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] md:text-[56px]" style={{ animationDelay: "0.5s" }}>Dust ended two NASA Mars missions.</h2>
        <p className="hook-in mt-4 max-w-[52ch] text-[15px] leading-6 text-dim md:text-[17px] md:leading-7" style={{ animationDelay: "1.4s" }}>
          Dust on its panels cut InSight&apos;s power from about 5,000 to 500 watt-hours a day. A planet-wide storm silenced Opportunity in 2018.
          <span className="text-ink"> Dust Twins finds where on Earth dust behaves like Mars, and in which months, so hardware can be tested there first.</span>
        </p>
        <div className="hook-in mt-6 flex flex-wrap items-center gap-2" style={{ animationDelay: "2s" }}>
          <button onClick={onStory} className="row h-11 rounded-lg bg-ink px-4 text-[14px] font-medium text-bg hover:bg-white">Play the 30-second story</button>
          <button onClick={onExplore} className="row h-11 rounded-lg bg-white/[0.1] px-4 text-[14px] font-medium hover:bg-white/[0.16]">Start exploring</button>
          <button onClick={onGuide} className="row h-11 px-3 text-[14px] text-dim underline-offset-4 hover:text-ink hover:underline">How it works</button>
        </div>
        <p className="hook-in mt-5 text-[12px] text-mute" style={{ animationDelay: "2.2s" }}>InSight&apos;s first and final selfies, December 2018 and April 2022 · NASA/JPL-Caltech</p>
      </div>
    </div>
  );
}
