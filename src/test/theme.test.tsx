import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider, ThemeToggle } from "@/components/atlas/ThemeToggle";

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.body.classList.remove("dark");
});

describe("theme preference", () => {
  it("persists dark selection and restores it on the next visit", async () => {
    const first = render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("atlas-theme")).toBe("dark");
    first.unmount();
    document.documentElement.classList.remove("dark");
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("atlas-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});