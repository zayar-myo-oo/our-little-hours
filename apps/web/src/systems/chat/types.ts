import type { Availability } from "../character/schedule";
export interface ChatMessage { id: string; from: "user" | "character" | "system"; text: string; at: number }
export interface ChatContext { name?: string; availability: Availability; activity: string; tasksOpen: number; focusSessions: number; hour: number }
/** Provider adapter: mock now, Ollama (local, free) optional. */
export interface ChatProvider { name: string; reply(input: string, ctx: ChatContext, history: ChatMessage[]): Promise<string> }
