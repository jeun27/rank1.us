import { describe, expect, it, vi } from "vitest";
import "./no-live";
import { listMyChannels, listRecentVideos, MAX_VIDEOS } from "@/lib/connections/youtube";
import * as fx from "../../fixtures/google";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const yt = (path: string) => `https://www.googleapis.com/youtube/v3/${path}`;

describe("YouTube (read-only)", () => {
  it("lists the signed-in owner's channels with their uploads playlist", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(fx.ytChannels));
    expect(await listMyChannels("ya29.example", { fetch })).toEqual([
      { id: "UCexample000000000000001", title: "Example Ramen House", uploads: "UUexample000000000000001" },
    ]);
    const u = new URL(String(fetch.mock.calls[0][0]));
    expect(`${u.origin}${u.pathname}`).toBe(yt("channels"));
    expect(Object.fromEntries(u.searchParams)).toEqual({ part: "snippet,contentDetails", mine: "true" });
    expect((fetch.mock.calls[0][1]!.headers as Record<string, string>).authorization).toBe("Bearer ya29.example");
  });

  it("reads the newest uploads (paged), then their details in one videos.list call", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const u = new URL(String(input));
      if (u.pathname.endsWith("/playlistItems"))
        return json(u.searchParams.get("pageToken") ? fx.ytPlaylistPage2 : fx.ytPlaylistPage1);
      return json(fx.ytVideos);
    });
    const videos = await listRecentVideos("t", "UUexample000000000000001", { fetch });
    expect(videos.map((v) => [v.id, v.durationSec])).toEqual([
      ["vid-1", 432],
      ["vid-2", 45],
      ["vid-3", 720],
    ]);
    expect(videos[0]).toMatchObject({
      title: "Best ramen in Irvine: a tour",
      url: "https://www.youtube.com/watch?v=vid-1",
      publishedAt: "2026-10-20T18:00:00Z",
    });
    const pl = new URL(String(fetch.mock.calls[0][0]));
    expect(Object.fromEntries(pl.searchParams)).toMatchObject({
      part: "contentDetails",
      playlistId: "UUexample000000000000001",
      maxResults: "50",
    });
    const v = new URL(String(fetch.mock.calls.at(-1)![0]));
    expect(Object.fromEntries(v.searchParams)).toEqual({ part: "snippet,contentDetails", id: "vid-1,vid-2,vid-3" });
    expect(MAX_VIDEOS).toBe(50);
  });

  it("no uploads → no videos.list call", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ items: [] }));
    expect(await listRecentVideos("t", "UUempty", { fetch })).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("an API error keeps only the status", async () => {
    const fetch = vi.fn(async () => json({ error: { message: "Example private" } }, 403));
    const err = await listMyChannels("t", { fetch }).catch((e) => e);
    expect(err.status).toBe(403);
    expect(String(err)).not.toContain("Example private");
  });
});
