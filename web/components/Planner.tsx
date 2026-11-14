"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// The two SI features: "Challenge this twin" (an adversarial read of one result) and "Ask" (a planning
// question answered from the app's data). Both call /api/agent, fall back to a saved run when the shared
// key is unavailable, and let a visitor use their own Gemini key (kept in this browser only).
import { useEffect, useState } from "react";

type Reason = { title: string; detail: string; figures: string[] };
export type ChallengeResult = { reasons: Reason[]; settle: string; written?: number; removed: number; saved?: boolean };
type Step = { tool: string; args: Record<string, unknown>; found?: string };
export type AskResult = { text: string; checked?: number; steps: Step[]; action: { site: string; rank?: number; month?: number } | null; unverified: string[]; saved?: boolean; question?: string };
type Saved = { challenge: Record<string, ChallengeResult>; ask: AskResult[] };

const KEY = "dust-twins-gemini-key";
const readKey = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const ERR: Record<string, string> = {
  quota: "The shared key has reached its limit for now",
  rate: "Too many requests from this connection; try again in a few minutes",
  nokey: "No shared key is configured on this copy of the app",
  badkey: "That key was not accepted",
};
const TOOL_WORDS: Record<string, string> = { list_sites: "Read the Mars sites", get_twins: "Read the twins", get_twin_detail: "Read one twin in full", get_checks: "Read the method checks", show: "Turned the globes" };

async function call(body: unknown): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const own = readKey();
  try {
    const r = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json", ...(own ? { "x-user-key": own } : {}) }, body: JSON.stringify(body) });
    const data = await r.json();
    return r.ok ? { ok: true, data } : { ok: false, error: data.error ?? "upstream" };
  } catch { return { ok: false, error: "upstream" }; }
}

/** The question mode streams one JSON object per line: lookups as they happen, then the checked answer. */
async function askStream(question: string, on: (e: any) => void): Promise<string | null> {
  const own = readKey();
  try {
    const r = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json", ...(own ? { "x-user-key": own } : {}) }, body: JSON.stringify({ mode: "ask", question }) });
    if (!r.ok || !r.body) return (await r.json().catch(() => ({}))).error ?? "upstream";
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return null;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) { const e = JSON.parse(line); if (e.type === "error") return e.error; on(e); }
    }
  } catch { return "upstream"; }
}

let savedCache: Promise<Saved | null> | null = null;
const loadSaved = () => (savedCache ??= fetch("/data/si_examples.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));

/** Shown when the shared key fails: a plain explanation and a field for the visitor's own key. */
function OwnKey({ error, onSaved }: { error: string; onSaved: () => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-3 rounded-lg bg-white/[0.05] p-3">
      <p className="text-[13px] leading-5">{ERR[error] ?? "The model did not answer"}</p>
      <label className="mt-2 block text-[12px] text-dim" htmlFor="own-key">Use your own Gemini key</label>
      <div className="mt-1 flex gap-2">
        <input id="own-key" type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} placeholder="Paste key"
          className="h-9 min-w-0 flex-1 rounded-lg bg-black/40 px-3 text-[13px] outline-none ring-1 ring-line focus:ring-ink" />
        <button onClick={() => { try { localStorage.setItem(KEY, v.trim()); } catch {} onSaved(); }} disabled={v.trim().length < 20}
          className="row h-9 rounded-lg bg-white/[0.1] px-3 text-[13px] hover:bg-white/[0.16]">Use it</button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-mute">Kept in this browser only. It is sent with your own requests and is not stored or logged on the server</p>
    </div>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-[11px] leading-4 text-mute">{children}</p>;

export function Challenge({ site, rank, twinName }: { site: string; rank: number; twinName: string }) {
  const [res, setRes] = useState<ChallengeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setRes(null); setErr(null); }, [site, rank]);

  const run = async () => {
    setBusy(true); setErr(null);
    const r = await call({ mode: "challenge", site, rank });
    if (r.ok) setRes(r.data as ChallengeResult);
    else {
      setErr(r.error);
      const saved = (await loadSaved())?.challenge[`${site}-${rank}`];
      if (saved) setRes({ ...saved, saved: true });
    }
    setBusy(false);
  };

  return (
    <div>
      {!res && <p className="mb-3 text-[13px] leading-5 text-dim">Have a model argue against this match, using only the numbers on this card and in the evidence</p>}
      {!res && <button onClick={run} disabled={busy} className="row h-9 rounded-lg bg-white/[0.07] px-3.5 text-[13px] font-medium hover:bg-white/[0.12]">{busy ? "Reading the numbers…" : `Challenge ${twinName}`}</button>}
      {res && (
        <>
          <ol className="grid gap-4">
            {res.reasons.map((r, i) => (
              <li key={i}>
                <p className="text-[14px] font-medium leading-5">{r.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-dim">{r.detail}</p>
                <p className="num mt-1.5 text-[11px] leading-4 text-mute">{r.figures.join(" · ")}</p>
              </li>
            ))}
          </ol>
          {res.reasons.length === 0 && <p className="text-[13px] text-dim">Every reason the model wrote cited a figure we could not trace, so none is shown</p>}
          {res.settle && <p className="mt-4 border-t border-line pt-3 text-[13px] leading-5"><span className="text-dim">To settle it</span><br />{res.settle}</p>}
          <Note>
            {res.saved ? "Saved run, replayed. " : ""}Written by an SI model (Gemini) from this card&apos;s figures. Every number was checked against the data
            {res.removed > 0 ? `; ${res.removed} of ${res.written ?? res.removed + res.reasons.length} reasons were dropped for citing a figure that is not in it` : ""}
          </Note>
          {!res.saved && <button onClick={run} disabled={busy} className="mt-2 text-[12px] text-dim underline decoration-line underline-offset-4 hover:text-ink">{busy ? "Reading…" : "Ask again"}</button>}
        </>
      )}
      {err && <OwnKey error={err} onSaved={run} />}
    </div>
  );
}

const Arrow = () => <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M3 8 H13 M9 4 L13 8 L9 12" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
const Tick = () => <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden><path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="var(--ok)" strokeWidth="1.5" /></svg>;

const Spinner = () => <svg width="12" height="12" viewBox="0 0 16 16" className="spin" aria-hidden><circle cx="8" cy="8" r="6" fill="none" stroke="var(--line)" strokeWidth="1.5" /><path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="var(--ink)" strokeWidth="1.5" /></svg>;

/** The agent's working, one row per lookup: what it did and what it found. */
function Trace({ steps, now, tail }: { steps: Step[]; now?: string | null; tail?: React.ReactNode }) {
  return (
    <ol className="trace grid">
      {steps.map((s, i) => (
        <li key={i} className="trace-row grid grid-cols-[16px_1fr] gap-x-2.5 pb-3">
          <span className="trace-mark mt-[3px]"><Tick /></span>
          <span>
            <span className="block text-[13px] leading-5">{TOOL_WORDS[s.tool] ?? s.tool}</span>
            {s.found && <span className="trace-found block text-[12px] leading-4 text-dim">{s.found}</span>}
          </span>
        </li>
      ))}
      {now && (
        <li key={`now-${steps.length}`} className="trace-row trace-now grid grid-cols-[16px_1fr] gap-x-2.5 pb-3">
          <span className="mt-[3px]"><Spinner /></span>
          <span className="text-[13px] leading-5 text-dim">{now}<span className="dots" aria-hidden><i>.</i><i>.</i><i>.</i></span></span>
        </li>
      )}
      {tail}
    </ol>
  );
}

/** A planning question, answered from the app's data. `showing` is what the globes point at after the answer. */
export function Ask({ onAction, showing }: { onAction: (a: NonNullable<AskResult["action"]>) => void; showing: string | null }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<AskResult[]>([]);
  useEffect(() => { loadSaved().then((s) => setSaved(s?.ask ?? [])); }, []);
  // "/" focuses the question box from anywhere
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(t.tagName)) { e.preventDefault(); document.getElementById("ask")?.focus(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const [live, setLive] = useState<Step[]>([]);
  const [now, setNow] = useState<string | null>(null);

  const show = (r: AskResult) => { setRes(r); if (r.action) onAction(r.action); };
  const run = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setBusy(text); setErr(null); setRes(null); setLive([]); setNow("Working out what to look up");
    const error = await askStream(text, (e) => {
      if (e.type === "thinking" || e.type === "checking") setNow(e.text);
      if (e.type === "step") {
        setLive((l) => [...l, e]);
        if (e.tool === "show" && e.args?.site) onAction(e.args);   // the globes turn while it is still working
      }
      if (e.type === "final") { setRes({ ...e, question: text }); setQ(""); }
    });
    if (error) setErr(error);
    setBusy(null); setNow(null);
  };
  /** Replay a saved run at reading speed so it shows the same working. */
  const replay = async (r: AskResult) => {
    setBusy(r.question ?? ""); setErr(null); setRes(null); setLive([]); setNow("Working out what to look up");
    for (const st of r.steps) {
      await new Promise((ok) => setTimeout(ok, 650));
      setLive((l) => [...l, st]);
      if (st.tool === "show" && r.action) onAction(r.action);
    }
    setNow(`Checking ${r.checked ?? "the"} figures against the data`);
    await new Promise((ok) => setTimeout(ok, 650));
    setRes({ ...r, saved: true }); setBusy(null); setNow(null);
  };
  void show;
  const again = () => { setRes(null); setErr(null); setLive([]); setTimeout(() => document.getElementById("ask")?.focus(), 0); };

  return (
    <div>
      {/* composer */}
      {!res && busy == null && (
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="rounded-xl bg-black/35 ring-1 ring-line focus-within:ring-ink/50">
          <label htmlFor="ask" className="sr-only">Ask a test-planning question</label>
          <textarea id="ask" rows={2} value={q} onChange={(e) => setQ(e.target.value.slice(0, 300))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(q); } }}
            placeholder="What are you testing, for which mission, and what limits you?"
            className="block w-full resize-none bg-transparent px-3.5 pt-3 text-[14px] leading-5 outline-none placeholder:text-mute" />
          <div className="flex items-center justify-between gap-3 px-3.5 pb-2.5 pt-1">
            <span className="text-[11px] text-mute">{q.length > 240 ? `${300 - q.length} characters left` : <>Press <kbd className="num rounded bg-white/[0.08] px-1 py-0.5 text-[10px]">Enter</kbd> to ask</>}</span>
            <button type="submit" disabled={q.trim().length < 3} aria-label="Ask" className="row grid h-8 w-8 place-items-center rounded-lg bg-ink text-bg hover:bg-white"><Arrow /></button>
          </div>
        </form>
      )}

      {/* suggestions */}
      {!res && busy == null && saved.length > 0 && (
        <div className="mt-4">
          <p className="text-[12px] text-mute">Or open a saved answer</p>
          <ul className="-mx-3 mt-1">
            {saved.map((s, i) => (
              <li key={i}>
                <button onClick={() => replay(s)} className="row grid w-full grid-cols-[1fr_auto] items-start gap-3 rounded-lg px-3 py-2 text-left text-[13px] leading-5 text-dim hover:bg-white/[0.05] hover:text-ink">
                  <span>{s.question}</span><span className="mt-1 text-mute"><Arrow /></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* working: each lookup appears as it happens */}
      {busy != null && (
        <div aria-live="polite">
          <p className="text-[14px] leading-5">{busy}</p>
          <div className="mt-4"><Trace steps={live} now={now} /></div>
        </div>
      )}

      {/* answer */}
      {res && (
        <div aria-live="polite">
          {res.question && <p className="text-[13px] leading-5 text-dim">{res.question}</p>}
          {res.action && showing && (
            <p className="mt-3 rounded-lg bg-white/[0.06] px-3 py-2.5 text-[13px] leading-5">
              <span className="flex items-center gap-2 text-[12px] text-dim"><span className="h-1.5 w-1.5 rounded-full bg-dust" />On the globes now</span>
              <span className="mt-0.5 block font-medium">{showing}</span>
            </p>
          )}
          <p className="mt-3 text-[14px] leading-6">{res.text}</p>
          <details className="mt-4 border-t border-line pt-3" open>
            <summary className="cursor-pointer text-[12px] text-dim">How it got there, {res.steps.length} lookups</summary>
            <div className="mt-3">
              <Trace steps={res.steps} tail={
                <li className="grid grid-cols-[16px_1fr] gap-x-2 text-[13px] leading-5">
                  {res.unverified.length
                    ? <><span /><span className="text-warn">Could not trace these figures: {res.unverified.join(", ")}</span></>
                    : <><span className="mt-[3px]"><Tick /></span><span>Checked {res.checked ?? "every"} figure{res.checked === 1 ? "" : "s"} against the data</span></>}
                </li>} />
            </div>
          </details>
          <Note>{res.saved ? "Saved run, replayed. " : ""}Written by an SI model (Gemini) from this app&apos;s data</Note>
          <button onClick={again} className="row mt-3 h-9 rounded-lg bg-white/[0.07] px-3.5 text-[13px] font-medium hover:bg-white/[0.12]">Ask another</button>
        </div>
      )}
      {err && <OwnKey error={err} onSaved={() => run(q)} />}
    </div>
  );
}
