import type { ChatProvider } from "./types";
import { mockReply } from "./mockProvider";

/** Optional: free local LLM via Ollama (https://ollama.com). Falls back to the scripted reply on any failure. */
export function ollamaProvider(baseUrl: string, model: string): ChatProvider {
  return {
    name: `Ollama (${model})`,
    async reply(input, ctx, history) {
      if (ctx.availability !== "AVAILABLE") return mockReply(input, ctx);
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model, stream: false,
            messages: [
              { role: "system", content: `You are ${ctx.name || "Yuzu"}, a gentle, original study-buddy character in a cozy room. Currently: ${ctx.activity}. Reply in 1-2 short, warm sentences.` },
              ...history.slice(-8).filter((m) => m.from !== "system").map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
              { role: "user", content: input },
            ],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        return data?.message?.content?.trim() || mockReply(input, ctx);
      } catch {
        return mockReply(input, ctx) + " (Ollama unreachable — using scripted reply.)";
      }
    },
  };
}
