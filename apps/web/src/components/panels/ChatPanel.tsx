"use client";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/store/useGame";
import { mockProvider } from "@/systems/chat/mockProvider";
import { ollamaProvider } from "@/systems/chat/ollamaProvider";
import type { ChatContext } from "@/systems/chat/types";
import { Btn, Panel } from "./ui";

export function ChatPanel({ ctx, name }: { ctx: ChatContext; name: string }) {
  const { chat, pushChat, clearChat, settings } = useGame();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [chat.length]);
  const provider = settings.chatProvider === "ollama" ? ollamaProvider(settings.ollamaUrl, settings.ollamaModel) : mockProvider;

  const send = async () => {
    const input = text.trim(); if (!input || busy) return;
    setText(""); pushChat({ from: "user", text: input }); setBusy(true);
    const reply = await provider.reply(input, ctx, useGame.getState().chat);
    await new Promise((r) => setTimeout(r, 400));
    pushChat({ from: ctx.availability === "AVAILABLE" ? "character" : "system", text: reply }); setBusy(false);
  };

  return (
    <Panel title={`Chat with ${name}`}>
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {chat.length === 0 && <p className="text-sm opacity-60">Say hello. ({provider.name})</p>}
        {chat.map((m) => (
          <p key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "ml-auto bg-amber-glow/20" : m.from === "system" ? "italic opacity-70" : "bg-cream/10"}`}>{m.text}</p>
        ))}
        {busy && <p className="text-xs opacity-60">{name} is writing…</p>}
        <div ref={end} />
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Type a message…" aria-label="Message"
          className="flex-1 rounded-full bg-cream/10 px-4 py-2 text-sm placeholder:text-cream/40" />
        <Btn type="submit" disabled={busy || !text.trim()}>Send</Btn>
      </form>
      {chat.length > 0 && <button className="mt-2 text-xs opacity-50 hover:opacity-100" onClick={clearChat}>Clear history</button>}
    </Panel>
  );
}
