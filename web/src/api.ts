import type { Job, Lyrics, SearchResponse, Track } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export function searchTracks(query: string, limit = 12): Promise<SearchResponse> {
  return request(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function searchTracksByProvider(
  provider: "youtube" | "rutube",
  query: string,
  limit = 8
): Promise<SearchResponse> {
  return request(`/api/search/${provider}?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function resolveLink(url: string): Promise<{ track: Track }> {
  return request(`/api/link?url=${encodeURIComponent(url)}`);
}

export function getLocalCatalog(): Promise<{ tracks: Track[] }> {
  return request("/api/catalog");
}

export function getAllKaraoke(
  lang: "ru" | "en",
  refresh = false
): Promise<{ lang: string; results: Track[] }> {
  return request(`/api/karaoke?lang=${lang}&limit=100${refresh ? "&refresh=1" : ""}`);
}

export function deleteLocalPack(packId: string): Promise<{ ok: boolean }> {
  return request(`/api/catalog/delete?pack=${encodeURIComponent(packId)}`);
}

export function fetchLyrics(track: Track): Promise<Lyrics> {
  const params = new URLSearchParams();
  if (track.lyrics_id) {
    params.set("id", String(track.lyrics_id));
  } else {
    params.set("track", track.title);
    if (track.artist) params.set("artist", track.artist);
    if (track.duration) params.set("duration", String(Math.round(track.duration)));
  }
  return request(`/api/lyrics?${params.toString()}`);
}

export function importTrack(file: File): Promise<Track> {
  const data = new FormData();
  data.append("file", file);
  return request("/api/import", { method: "POST", body: data });
}

export function startSeparation(trackId: string): Promise<{ job_id: string | null; status: string; result?: { instrumental_url?: string } }> {
  return request(`/api/tracks/${encodeURIComponent(trackId)}/separate`, { method: "POST" });
}

export function getJob(jobId: string): Promise<Job> {
  return request(`/api/jobs/${jobId}`);
}

export function getHealth(): Promise<Record<string, unknown>> {
  return request("/api/health");
}

export function getRuTubeStream(id: string): Promise<{ url: string }> {
  return request(`/api/rutube/stream?id=${encodeURIComponent(id)}`);
}

export function getYouTubeAudio(videoId: string): Promise<{
  url: string;
  mime?: string;
  duration?: number;
  title?: string;
}> {
  return request(`/api/youtube/audio?id=${encodeURIComponent(videoId)}`);
}

export function saveVkToken(token: string): Promise<{ ok: boolean; vk: boolean }> {
  return request("/api/vk/token", {
    method: "POST",
    headers: { "X-VK-Token": token }
  });
}


