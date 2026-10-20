"use client";
import type { AwaySummary } from "@/world/sim/away";

const ICON: Record<string, string> = { studying: "✎", reading: "❦", relaxing: "☕︎", tea: "🍵", window: "☁︎", sleeping: "☾" };

/** Cozy, dismissible summary of what she did — only from simulated events, never guilt-tripping. */
export function AwayCard({ summary, title, intro, onDismiss }: { summary: AwaySummary; title: string; intro: string; onDismiss: () => void }) {
  return (
    <section role="dialog" aria-labelledby="away-title"
      className="panel-in absolute left-1/2 top-24 z-20 w-[min(92vw,360px)] -translate-x-1/2 rounded-3xl border border-cream/15 bg-ink/75 p-5 text-cream shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 id="away-title" className="font-serif text-lg text-amber-glow">{title}</h2>
        <button onClick={onDismiss} aria-label="Dismiss" className="rounded-full px-2 text-sm opacity-70 hover:bg-cream/10 hover:opacity-100">✕</button>
      </div>
      <p className="mb-3 text-sm opacity-80">{intro}</p>
      <ul className="space-y-1.5">
        {summary.highlights.map((h) => (
          <li key={h.activity} className="flex items-center gap-2 rounded-xl bg-cream/5 px-3 py-2 text-sm">
            <span aria-hidden className="w-5 text-center">{ICON[h.activity] ?? "•"}</span>{h.text}
          </li>
        ))}
      </ul>
      <button onClick={onDismiss} className="mt-4 w-full rounded-full bg-amber-glow/25 py-2 text-sm hover:bg-amber-glow/35">Welcome back ♡</button>
    </section>
  );
}
