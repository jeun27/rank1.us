import { parseDuration } from "@/lib/metrics/youtube-checks";
import { call, type Deps } from "./google-api";

// YouTube Data API v3, read-only (youtube.readonly). Each call is 1 quota unit.
// channels.list https://developers.google.com/youtube/v3/docs/channels/list
// playlistItems.list https://developers.google.com/youtube/v3/docs/playlistItems/list
// videos.list https://developers.google.com/youtube/v3/docs/videos/list (contentDetails.duration is ISO 8601)
const API = "https://www.googleapis.com/youtube/v3";
export const MAX_VIDEOS = 50; // the newest 50 uploads: one videos.list call

export async function listMyChannels(token: string, deps: Deps = {}) {
  const body = await call(token, `${API}/channels?part=snippet,contentDetails&mine=true`, deps);
  const items =
    (body.items as {
      id: string;
      snippet?: { title?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }[]) ?? [];
  return items.map((c) => ({
    id: c.id,
    title: c.snippet?.title ?? "",
    uploads: c.contentDetails?.relatedPlaylists?.uploads ?? null,
  }));
}

export type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
  durationSec: number | null;
};

export async function listRecentVideos(token: string, uploads: string, deps: Deps = {}): Promise<YoutubeVideo[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < MAX_VIDEOS) {
    const u = new URL(`${API}/playlistItems`);
    u.search = new URLSearchParams({
      part: "contentDetails",
      playlistId: uploads,
      maxResults: String(MAX_VIDEOS),
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const page = await call(token, u.toString(), deps);
    for (const it of (page.items as { contentDetails?: { videoId?: string } }[]) ?? [])
      if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    pageToken = page.nextPageToken as string | undefined;
    if (!pageToken) break;
  }
  if (!ids.length) return [];
  const v = new URL(`${API}/videos`);
  v.search = new URLSearchParams({ part: "snippet,contentDetails", id: ids.slice(0, MAX_VIDEOS).join(",") }).toString();
  const body = await call(token, v.toString(), deps);
  type Raw = {
    id: string;
    snippet?: { title?: string; description?: string; publishedAt?: string };
    contentDetails?: { duration?: string };
  };
  return ((body.items as Raw[]) ?? []).map((r) => ({
    id: r.id,
    title: r.snippet?.title ?? "",
    description: r.snippet?.description ?? "",
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(r.id)}`,
    publishedAt: r.snippet?.publishedAt ?? null,
    durationSec: r.contentDetails?.duration ? parseDuration(r.contentDetails.duration) : null,
  }));
}
