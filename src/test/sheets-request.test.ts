import { afterEach, describe, expect, it, vi } from "vitest";
import { readSheets } from "@/lib/sheets-request.server";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("Sheets read resilience", () => {
  it("does not retry permanent errors and preserves details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn().mockResolvedValue(new Response("missing tab", { status: 400 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(readSheets("https://example.test", {})).rejects.toThrow("Google Sheets [400]: missing tab");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("backs off once for quota failures", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("quota", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(Response.json({ values: [["real"]] }));
    vi.stubGlobal("fetch", fetcher);
    const result = readSheets("https://example.test", {});
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ values: [["real"]] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("waits through two quota windows before recovering", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("quota", { status: 429 }))
      .mockResolvedValueOnce(new Response("quota", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ values: [["recovered"]] }));
    vi.stubGlobal("fetch", fetcher);
    const result = readSheets("https://example.test", {});
    await vi.advanceTimersByTimeAsync(64_999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(119_999);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ values: [["recovered"]] });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("recovers from a temporary connection failure", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(Response.json({ values: [["real"]] }));
    vi.stubGlobal("fetch", fetcher);
    const result = readSheets("https://example.test", {});
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual({ values: [["real"]] });
  });
});