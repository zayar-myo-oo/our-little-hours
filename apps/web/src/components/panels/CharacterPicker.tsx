"use client";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectSettings } from "@/store/selectors";
import { useGame } from "@/store/useGame";
import { PLACEHOLDER_ID, thumbUrl, type CharacterModel } from "@/systems/character/models";

function CharacterPickerView({ models, loadError }: { models: CharacterModel[] | null; loadError: string | null }) {
  const { settings, setSettings } = useGame(useShallow(selectSettings));
  const options: (CharacterModel & { isPlaceholder?: boolean })[] = [{ id: PLACEHOLDER_ID, name: "Placeholder", file: "", available: true, isPlaceholder: true }, ...(models ?? [])];
  return (
    <div className="mb-4">
      <p className="mb-2 text-sm">Character</p>
      {models === null ? <p className="text-xs opacity-60">Loading characters…</p> : (
        <div className="grid grid-cols-3 gap-2">
          {options.map((m) => {
            const selected = settings.characterId === m.id, ok = m.available !== false, thumb = thumbUrl(m);
            return (
              <button key={m.id} disabled={!ok} onClick={() => setSettings({ characterId: m.id })} aria-pressed={selected}
                title={ok ? m.name : `${m.name}: not exported yet (add ${m.file})`}
                className={`overflow-hidden rounded-xl border text-left transition ${selected ? "border-amber-glow ring-2 ring-amber-glow/60" : "border-cream/15 hover:border-cream/40"} ${ok ? "" : "cursor-not-allowed opacity-45"}`}>
                <div className="aspect-square bg-cream/10">
                  {/* Plain <img>: thumbnails are tiny static files, and next/image optimization would use Vercel image quota. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
                    : <div className="flex h-full items-center justify-center text-2xl">{m.isPlaceholder ? "☺" : "?"}</div>}
                </div>
                <p className="truncate px-1.5 py-1 text-[11px]">{m.name}</p>
                {!ok && <p className="px-1.5 pb-1 text-[10px] leading-tight opacity-80">Not exported yet</p>}
              </button>
            );
          })}
        </div>
      )}
      {loadError && <p className="mt-2 text-xs text-red-300">{loadError}</p>}
      {models?.some((m) => m.available === false) && (
        <p className="mt-2 text-[11px] opacity-60">Grey characters need a .vrm file: open the .vroid in VRoid Studio → Export → VRM, then save it to public/models/ (see README).</p>
      )}
    </div>
  );
}

export const CharacterPicker = memo(CharacterPickerView);
