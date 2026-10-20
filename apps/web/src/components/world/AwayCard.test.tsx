// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AwayCard } from "./AwayCard";

const summary = { from: 0, to: 1, awayMs: 1, highlights: [
  { activity: "studying" as const, minutes: 90, times: 2, text: "Studied at her desk for about 1.5 hours" },
  { activity: "tea" as const, minutes: 10, times: 1, text: "Made tea once" },
] };

describe("AwayCard", () => {
  it("shows the highlights and can be dismissed both ways", () => {
    const onDismiss = vi.fn();
    render(<AwayCard summary={summary} title="While you were away" intro="Mio kept a gentle rhythm." onDismiss={onDismiss} />);
    expect(screen.getByRole("dialog", { name: "While you were away" })).toBeTruthy();
    expect(screen.getByText("Made tea once")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Dismiss"));
    fireEvent.click(screen.getByText(/Welcome back/));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
