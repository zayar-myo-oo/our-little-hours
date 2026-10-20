import type { ReactNode, ButtonHTMLAttributes } from "react";
export const Btn = ({ className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className={`rounded-full border border-cream/25 bg-cream/10 px-4 py-2 text-sm text-cream transition hover:bg-cream/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-glow disabled:opacity-40 ${className}`} />
);
export const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="panel-in max-h-[min(60vh,560px)] w-full overflow-y-auto rounded-3xl border border-cream/15 bg-ink/70 p-5 text-cream shadow-2xl backdrop-blur-md sm:w-[420px]">
    <h2 className="mb-4 font-serif text-xl tracking-wide text-amber-glow">{title}</h2>
    {children}
  </section>
);
export const Slider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <label className="mb-3 block text-sm">
    <span className="flex justify-between"><span>{label}</span><span className="opacity-60">{Math.round(value * 100)}%</span></span>
    <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-amber-300" />
  </label>
);
