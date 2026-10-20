// @vitest-environment jsdom
// Proves the M0 render optimizations: memoized panels skip parent re-renders (e.g. the page's 500 ms clock),
// and store selectors skip unrelated store updates while still following relevant ones.
import { describe, it, expect, beforeAll } from "vitest";
import { Profiler, useState, type ReactNode } from "react";
import { render, act, cleanup, screen } from "@testing-library/react";
import { useGame } from "@/store/useGame";
import { TasksPanel } from "./TasksPanel";
import { StoryPanel } from "./StoryPanel";
import { FocusPanel } from "./FocusPanel";

/** Parent that re-renders on demand, like page.tsx does on every clock tick. */
function withTicker(children: ReactNode) {
  let bump = () => {};
  function Parent() {
    const [n, setN] = useState(0);
    bump = () => setN((x) => x + 1);
    return <div data-tick={n}>{children}</div>;
  }
  return { Parent, tick: () => act(() => bump()) };
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe("panel render behaviour", () => {
  beforeAll(async () => { await useGame.persist.rehydrate(); });

  it("TasksPanel ignores clock ticks and unrelated store updates, but follows task changes", async () => {
    let renders = 0;
    const { Parent, tick } = withTicker(<Profiler id="tasks" onRender={() => { renders++; }}><TasksPanel /></Profiler>);
    render(<Parent />);
    await flush();
    const base = renders;
    tick(); tick(); tick();
    act(() => useGame.getState().pushChat({ from: "user", text: "unrelated" }));
    await flush();
    expect(renders).toBe(base);
    act(() => useGame.getState().taskAction({ type: "add", title: "relevant" }));
    await flush();
    expect(renders).toBe(base + 1);
    expect(screen.getByText("relevant")).toBeTruthy();
    cleanup();
  });

  it("StoryPanel and FocusPanel skip parent re-renders when their props are unchanged", async () => {
    let story = 0, focus = 0;
    const { Parent, tick } = withTicker(<>
      <Profiler id="story" onRender={() => { story++; }}><StoryPanel name="Mio" /></Profiler>
      <Profiler id="focus" onRender={() => { focus++; }}><FocusPanel /></Profiler>
    </>);
    render(<Parent />);
    await flush();
    const s0 = story, f0 = focus;
    tick(); tick();
    expect(story).toBe(s0);
    expect(focus).toBe(f0); // FocusPanel owns its clock now; parent ticks don't reach it
    cleanup();
  });
});
