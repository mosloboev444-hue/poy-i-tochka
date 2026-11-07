import { useEffect, useRef, useState } from "react";
import { Loader2, Mic2, X } from "lucide-react";
import type { Track } from "../types";
import TrackCard from "./TrackCard";

type Filter = "all" | "karaoke" | "lyrics" | "youtube" | "rutube";

type Props = {
  query: string;
  results: Track[];
  loading: boolean;
  error: string | null;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  onClose: () => void;
  onSelect: (track: Track) => void;
  onRetry: () => void;
  isFavorite: (track: Track) => boolean;
  onToggleFavorite: (track: Track) => void;
  isQueued: (track: Track) => boolean;
  onToggleQueue: (track: Track) => void;
};

const FILTERS: [Filter, string][] = [
  ["all", "Все"],
  ["karaoke", "Караоке"],
  ["lyrics", "С текстом"],
  ["youtube", "YouTube"],
  ["rutube", "RuTube"]
];

export default function SearchResultsWindow({
  query,
  results,
  loading,
  error,
  filter,
  onFilterChange,
  onClose,
  onSelect,
  onRetry,
  isFavorite,
  onToggleFavorite,
  isQueued,
  onToggleQueue
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const [expanded, setExpanded] = useState(false);
  const filtered = results.filter((track) => {
    if (filter === "all") return true;
    if (filter === "karaoke") return Boolean(track.is_karaoke || track.is_instrumental);
    if (filter === "lyrics") return Boolean(track.has_lyrics || track.has_synced_lyrics);
    return track.source === filter;
  });
  const visible = expanded ? filtered : filtered.slice(0, 8);

  useEffect(() => {
    setExpanded(false);
  }, [query, filter]);

  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHandler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="results-overlay" role="dialog" aria-modal="true" aria-label="Результаты поиска">
      <div className="results-window">
        <header className="results-window-head">
          <div>
            <span className="eyebrow">РЕЗУЛЬТАТЫ ПОИСКА</span>
            <h2>
              {loading && filtered.length === 0
                ? "Ищем варианты…"
                : error
                  ? "Поиск не удался"
                  : `Найдено ${filtered.length}${loading ? " · ищем ещё" : ""}`}
            </h2>
            <span className="results-query">«{query}»</span>
          </div>
          <button ref={closeRef} className="results-close" onClick={onClose} type="button" title="Закрыть результаты">
            <X size={24} />
          </button>
        </header>

        {!error && results.length > 0 && (
          <div className="filter-row" role="group" aria-label="Фильтр результатов">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                className={`filter-chip ${filter === value ? "active" : ""}`}
                onClick={() => onFilterChange(value)}
                type="button"
              >
                {label}
              </button>
            ))}
            {!expanded && filtered.length > 8 && (
              <button className="filter-chip filter-more" onClick={() => setExpanded(true)} type="button">
                Ещё {filtered.length - 8}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="empty-panel error-panel">
            <p>Не получилось выполнить поиск.</p>
            <p className="muted">{error}</p>
            <button className="primary-button" onClick={onRetry} type="button">
              Попробовать ещё раз
            </button>
          </div>
        )}

        {!error && loading && results.length === 0 && (
          <div className="cards-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="track-card skeleton" key={index}>
                <div className="track-art" />
                <div className="track-meta">
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!error && visible.length > 0 && (
          <div className="cards-grid">
            {visible.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                onSelect={onSelect}
                isFavorite={isFavorite(track)}
                onToggleFavorite={onToggleFavorite}
                isQueued={isQueued(track)}
                onToggleQueue={onToggleQueue}
              />
            ))}
          </div>
        )}

        {!error && !loading && !results.length && (
          <div className="empty-panel">
            <Mic2 size={38} />
            <p>Ничего не нашлось.</p>
            <p className="muted">Попробуй написать исполнителя латиницей или добавить «караоке».</p>
          </div>
        )}

        {!error && !loading && results.length > 0 && filtered.length === 0 && (
          <div className="empty-panel">
            <Mic2 size={38} />
            <p>В этом фильтре пока пусто.</p>
            <button className="primary-button" onClick={() => onFilterChange("all")} type="button">
              Показать все
            </button>
          </div>
        )}

        <footer className="results-window-foot">
          <button className="ghost-button" onClick={onClose} type="button">
            <X size={18} /> Закрыть
          </button>
          {loading && (
            <span className="muted small">
              <Loader2 className="spin" size={15} /> Ищем в YouTube и RuTube
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
