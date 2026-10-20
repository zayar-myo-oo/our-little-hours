import type { ChatContext, ChatProvider } from "./types";

interface Rule { match: RegExp; replies: (ctx: ChatContext) => string[] }

const RULES: Rule[] = [
  { match: /\b(hi|hello|hey|yo)\b/i, replies: (c) => [
    c.hour < 12 ? "Good morning! The tea's still warm, want to start slow?" : "Hey you. I saved you the comfy side of the desk.",
    "Oh! Hi. I was just about to sharpen my pencil for the third time." ] },
  { match: /\b(tired|sleepy|exhausted)\b/i, replies: () => [
    "Then let's do one small thing and call it a win. Stretch first?",
    "Rest counts as progress too. A short break might be exactly right." ] },
  { match: /\b(stress|anxious|worried|overwhelm)/i, replies: () => [
    "Breathe with me — in for four, out for six. We only need to do the next tiny step.",
    "Let's write the scary thing down as a task. It's smaller on paper." ] },
  { match: /\b(task|todo|to-do|list)\b/i, replies: (c) => [
    c.tasksOpen ? `You have ${c.tasksOpen} open task${c.tasksOpen > 1 ? "s" : ""}. Pick the easiest one first?` : "Your list is clear! Want to add something small for later?" ] },
  { match: /\b(focus|pomodoro|study|work)\b/i, replies: (c) => [
    c.focusSessions ? `We've done ${c.focusSessions} focus session${c.focusSessions > 1 ? "s" : ""} together. One more?` : "Shall we start a focus timer? I'll study quietly next to you." ] },
  { match: /\b(rain|weather)\b/i, replies: () => ["I love the rain. It makes the room feel like a little boat.", "The rain's keeping time for us, I think."] },
  { match: /\b(music|song|lofi|lo-fi)\b/i, replies: () => ["You can drop your own tracks into the music folder — I'll play them for us."] },
  { match: /\b(thank|thanks)\b/i, replies: () => ["Anytime. Really.", "You did the work — I just kept you company."] },
  { match: /\b(bye|good night|goodnight|see you)\b/i, replies: () => ["See you soon. I'll keep the lamp on.", "Good night! Proud of you today."] },
];

const FALLBACK = [
  "Mm, tell me more?",
  "I'm listening. Want to turn that into a task?",
  "That's a nice thought. I'll write it in the margin of my notebook.",
];

export function pick<T>(arr: T[], seed: number): T { return arr[Math.abs(seed) % arr.length]; }
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);

export function mockReply(input: string, ctx: ChatContext, seed = Date.now()): string {
  if (ctx.availability === "SLEEPING") return "(She has dozed off at her desk. Maybe leave a note for the morning.)";
  if (ctx.availability === "BUSY") return `(She's ${ctx.activity.toLowerCase()} right now — she'll read your message when she's back.)`;
  const rule = RULES.find((r) => r.match.test(input));
  return pick(rule ? rule.replies(ctx) : FALLBACK, hash(input) + seed);
}

export const mockProvider: ChatProvider = {
  name: "Scripted (offline)",
  reply: async (input, ctx) => mockReply(input, ctx),
};
