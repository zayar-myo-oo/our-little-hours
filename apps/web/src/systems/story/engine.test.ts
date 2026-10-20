import { describe, it, expect } from "vitest";
import * as S from "./engine";
import raw from "@content/story/the-unfinished-page.json";
const story = raw as S.Story;
describe("story engine", () => {
  it("content is valid", () => { expect(S.validateStory(story)).toEqual([]); });
  it("requires a choice at branching nodes and records flags", () => {
    let p = S.begin(story);
    p = S.advance(story, p); p = S.advance(story, p);
    expect(p.nodeId).toBe("s3");
    expect(S.advance(story, p).nodeId).toBe("s3");
    p = S.advance(story, p, 1);
    expect(p.nodeId).toBe("s4b");
    expect(p.flags).toContain("gentle");
  });
  it("reaches the end", () => {
    let p = S.begin(story);
    for (let i = 0; i < 30 && !p.completed; i++) p = S.advance(story, p, 0);
    expect(p.completed).toBe(true);
    expect(p.nodeId).toBe("end");
  });
  it("renders flag text", () => {
    expect(S.renderText("{flag:a|yes|no}", ["a"])).toBe("yes");
    expect(S.renderText("{flag:a|yes|no}", [])).toBe("no");
  });
});
