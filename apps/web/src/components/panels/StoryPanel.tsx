"use client";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectStory } from "@/store/selectors";
import { useGame, STORY } from "@/store/useGame";
import { renderText } from "@/systems/story/engine";
import { Btn, Panel } from "./ui";

/** "@companion" in story content is replaced with the currently chosen character's name. */
function StoryPanelView({ name }: { name: string }) {
  const { story, storyAdvance, storyRestart } = useGame(useShallow(selectStory));
  const node = STORY.nodes[story.nodeId];
  return (
    <Panel title={STORY.title}>
      <div className="min-h-32 rounded-2xl bg-cream/5 p-4">
        {node.speaker && <p className="mb-1 font-serif text-amber-glow">{node.speaker === "@companion" ? name : node.speaker}{node.mood && <span className="ml-2 text-xs opacity-60">({node.mood})</span>}</p>}
        <p className={`leading-relaxed ${node.speaker ? "" : "italic opacity-90"}`}>{renderText(node.text, story.flags)}</p>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {node.end ? <Btn onClick={storyRestart}>Read again</Btn>
          : node.choices ? node.choices.map((c, i) => <Btn key={i} className="text-left" onClick={() => storyAdvance(i)}>{c.text}</Btn>)
          : <Btn onClick={() => storyAdvance()}>Continue ▸</Btn>}
      </div>
      <p className="mt-3 text-xs opacity-50">Progress is saved automatically.</p>
    </Panel>
  );
}

export const StoryPanel = memo(StoryPanelView);
