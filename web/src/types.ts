export type PlayerMode = "video" | "text";

export type LyricsSize = "s" | "m" | "l";
export type LyricsColor = "gold" | "white" | "cyan";
export type LyricsFont = "serif" | "sans";

export type LyricsSettings = {
  size: LyricsSize;
  color: LyricsColor;
  font: LyricsFont;
};

export type View =
  | "home"
  | "search"
  | "library"
  | "favorites"
  | "history"
  | "queue"
  | "rating"
  | "achievements"
  | "settings"
  | "about"
  | "import";

export type Track = {
  id: string;
  source: "youtube" | "rutube" | "vk" | "jamendo" | "audius" | "local" | string;
  title: string;
  raw_title?: string;
  artist: string;
  duration?: number | null;
  thumbnail?: string | null;
  stream_url?: string | null;
  instrumental_url?: string | null;
  embed_url?: string | null;
  webpage_url?: string | null;
  is_karaoke?: boolean;
  is_instrumental?: boolean;
  is_pack?: boolean;
  pack_id?: string;
  has_lyrics?: boolean;
  has_synced_lyrics?: boolean;
  lyrics_id?: number | null;
  lyrics_track?: string | null;
  lyrics_artist?: string | null;
  lyrics_url?: string | null;
  provider?: string;
  license?: string;
  video_id?: string;
  file_name?: string;
  album?: string | null;
  author?: string | null;
};

export type SearchResponse = {
  query: string;
  results: Track[];
  providers: Record<string, boolean>;
};

export type Lyrics = {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration?: number | null;
  hasWordSync?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

export type Job = {
  id: string;
  track_id: string;
  status: "queued" | "running" | "done" | "error";
  error?: string | null;
  result?: { instrumental_url?: string } | null;
};
