import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Lyrics } from "../types";
import { findActiveLine, parseLyrics } from "../lrc";

type Props = {
  lyrics: Lyrics | null;
  loading: boolean;
  error: string | null;
  currentTime: number;
  syncAvailable?: boolean;
  offsetSeconds?: number;
  rate?: number;
};

export default function LyricsView({
  lyrics,
  loading,
  error,
  currentTime,
  syncAvailable = true,
  offsetSeconds = 0,
  rate = 1
}: Props) {
  const parsed = useMemo(() => parseLyrics(lyrics?.syncedLyrics, lyrics?.plainLyrics), [lyrics]);
  const effectiveTime = currentTime * rate + offsetSeconds;
  const activeIndex = syncAvailable && parsed.synced ? findActiveLine(parsed.lines, effectiveTime) : -1;
  const activeRef = useRef<HTMLParagraphElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeLine = activeIndex >= 0 ? parsed.lines[activeIndex] : null;
  const nextLine = activeIndex >= 0 ? parsed.lines[activeIndex + 1] : null;
  const fill = activeLine
    ? Math.min(
        1,
        Math.max(
          0,
          (effectiveTime - activeLine.time) /
            Math.max(1.5, (nextLine?.time ?? activeLine.time + 4) - activeLine.time)
        )
      )
    : 0;

  useEffect(() => {
    const container = scrollRef.current;
    const line = activeRef.current;
    if (activeIndex < 0 || !container || !line) return;
    const containerRect = container.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const target =
      container.scrollTop +
      (lineRect.top - containerRect.top) -
      container.clientHeight / 2 +
      line.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex]);

  if (loading) {
    return (
      <div className="lyrics-state">
        <div className="loader" />
        <p>Ищем синхронный текст…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lyrics-state">
        <p className="lyrics-empty-title">Текст не найден</p>
        <p className="muted">{error}</p>
        <p className="muted small">Можно спеть под видео — текст часто есть прямо в кадре.</p>
      </div>
    );
  }

  if (!parsed.lines.length) {
    return (
      <div className="lyrics-state">
        <p className="lyrics-empty-title">Текста пока нет</p>
        <p className="muted">Для этого трека нет записи в LRCLIB. Попробуй другой вариант или добавь свой файл.</p>
      </div>
    );
  }

  return (
    <div className={`lyrics-scroll ${syncAvailable && parsed.synced ? "is-synced" : "is-plain"}`} ref={scrollRef}>
      <div className="lyrics-heading">
        <span className="eyebrow">ТЕКСТ</span>
        <span className="lyrics-source">
          {syncAvailable ? (parsed.synced ? "синхронизирован" : "без тайминга") : "без синхронизации"}
        </span>
      </div>
      <div className="lyrics-lines" aria-live="polite">
        {parsed.lines.map((line, index) => {
          const active = syncAvailable && parsed.synced && index === activeIndex;
          const past = syncAvailable && parsed.synced && index < activeIndex;
          return (
            <p
              key={`${line.time}-${index}`}
              ref={active ? activeRef : null}
              className={`lyric-line ${active ? "active" : ""} ${past ? "past" : ""}`}
              style={active ? ({ "--fill": `${fill * 100}%` } as CSSProperties) : undefined}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
