import { useEffect, useRef, useState } from "react";
import { ListMusic, Loader2, Music2, Play, RefreshCw } from "lucide-react";
import { getAllKaraoke } from "../api";
import type { Track } from "../types";

type Props = {
  onOpenTrack: (track: Track) => void;
};

type Lang = "ru" | "en";

function displayTitle(track: Track): string {
  const raw = track.title || track.raw_title || "Без названия";
  return raw
    .replace(/\b(karaoke|караоке|minus|минус|instrumental)\b/gi, "")
    .replace(/\s*[|•]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim() || raw;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function AllKaraokePage({ onOpenTrack }: Props) {
  const [lang, setLang] = useState<Lang>("ru");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<Lang, Track[]>());
  const requestId = useRef(0);

  async function load(nextLang: Lang, force = false) {
    const id = ++requestId.current;
    const cached = cache.current.get(nextLang);
    if (cached && !force) {
      setTracks(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAllKaraoke(nextLang, force);
      if (id !== requestId.current) return;
      cache.current.set(nextLang, data.results);
      setTracks(data.results);
    } catch (exc) {
      if (id !== requestId.current) return;
      setTracks([]);
      setError(exc instanceof Error ? exc.message : "Не удалось получить список");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load(lang);
  }, [lang]);

  function choose(nextLang: Lang) {
    if (nextLang === lang) return;
    setLang(nextLang);
  }

  return (
    <section className="content-page all-karaoke-page">
      <div className="page-heading search-heading">
        <span className="eyebrow">МИНИ-КАТАЛОГ</span>
        <h1>Всё караоке</h1>
        <p className="muted">
          Списки песен из YouTube и RuTube — без превью, как в DVD-плеере. Выбери строку,
          и караоке сразу включится.
        </p>
      </div>

      <div className="karaoke-lang-grid">
        <button
          className={`karaoke-lang ${lang === "ru" ? "active" : ""}`}
          onClick={() => choose("ru")}
          type="button"
        >
          <span className="karaoke-lang-icon">RU</span>
          <span>
            <strong>Русские песни</strong>
            <small>Караоке на русском</small>
          </span>
        </button>
        <button
          className={`karaoke-lang ${lang === "en" ? "active" : ""}`}
          onClick={() => choose("en")}
          type="button"
        >
          <span className="karaoke-lang-icon">EN</span>
          <span>
            <strong>Иностранные песни</strong>
            <small>Karaoke in English</small>
          </span>
        </button>
      </div>

      <div className="karaoke-list-head">
        <span>
          <ListMusic size={17} />
          {loading ? "Ищем караоке…" : `${tracks.length} песен`}
        </span>
        <button
          className="ghost-button karaoke-refresh"
          onClick={() => void load(lang, true)}
          disabled={loading}
          type="button"
        >
          <RefreshCw className={loading ? "spin" : ""} size={15} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="empty-panel error-panel">
          <Music2 size={32} />
          <p>{error}</p>
          <button className="primary-button" onClick={() => void load(lang, true)} type="button">
            Попробовать снова
          </button>
        </div>
      )}

      {!error && loading && (
        <div className="karaoke-list" aria-busy="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <div className="karaoke-row skeleton-row" key={index}>
              <span className="karaoke-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="karaoke-main">
                <span className="skeleton-line wide" />
                <span className="skeleton-line" />
              </span>
            </div>
          ))}
        </div>
      )}

      {!error && !loading && tracks.length > 0 && (
        <div className="karaoke-list">
          {tracks.map((track, index) => (
            <button
              className="karaoke-row"
              key={track.id}
              onClick={() => onOpenTrack(track)}
              type="button"
            >
              <span className="karaoke-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="karaoke-main">
                <strong>{displayTitle(track)}</strong>
                <span>
                  {track.artist || "Неизвестный исполнитель"}
                  <i>·</i>
                  {track.source === "rutube" ? "RuTube" : track.source === "youtube" ? "YouTube" : track.source}
                </span>
              </span>
              <span className="karaoke-duration">{formatDuration(track.duration)}</span>
              <span className="karaoke-play">
                <Play size={17} fill="currentColor" />
              </span>
            </button>
          ))}
        </div>
      )}

      {!error && !loading && tracks.length === 0 && (
        <div className="empty-panel">
          <ListMusic size={36} />
          <p>Ничего не нашлось. Попробуй обновить список.</p>
        </div>
      )}
    </section>
  );
}
