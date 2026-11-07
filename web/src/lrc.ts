export type LyricLine = {
  time: number;
  text: string;
};

export type ParsedLyrics = {
  lines: LyricLine[];
  synced: boolean;
};

const TIME_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLyrics(synced?: string | null, plain?: string | null): ParsedLyrics {
  const source = (synced || "").trim();
  if (source) {
    const lines: LyricLine[] = [];
    let offset = 0;
    for (const raw of source.split(/\r?\n/)) {
      const offsetMatch = raw.match(/^\[offset:([+-]?\d+)\]/i);
      if (offsetMatch) {
        offset = Number(offsetMatch[1]) / 1000;
        continue;
      }
      const matches = [...raw.matchAll(TIME_RE)];
      if (!matches.length) continue;
      const text = raw.replace(TIME_RE, "").trim();
      if (!text) continue;
      for (const match of matches) {
        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
        lines.push({ time: minutes * 60 + seconds + fraction + offset, text });
      }
    }
    lines.sort((a, b) => a.time - b.time);
    if (lines.length) return { lines, synced: true };
  }

  const text = (plain || "").trim();
  if (!text) return { lines: [], synced: false };
  return {
    lines: text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ time: -1, text: line })),
    synced: false
  };
}

export function findActiveLine(lines: LyricLine[], time: number): number {
  if (!lines.length || time < 0) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= time) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

export function formatTime(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return "--:--";
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
