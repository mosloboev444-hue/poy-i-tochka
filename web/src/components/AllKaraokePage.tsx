import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  Loader2,
  Music2,
  Play,
  Plus,
  RefreshCw,
  Search
} from "lucide-react";
import { getAllKaraoke } from "../api";
import type { Track } from "../types";

const PAGE_SIZE = 20;
const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

type Lang = "ru" | "en";

type Props = {
  onOpenTrack: (track: Track) => void;
  onSearch: (query: string) => void;
};

type CacheEntry = {
  tracks: Track[];
  batch: number;
  hasMore: boolean;
};

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

export default function AllKaraokePage({ onOpenTrack, onSearch }: Props) {
  const [lang, setLang] = useState<Lang>("ru");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [batch, setBatch] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [ascending, setAscending] = useState(true);
  const [search, setSearch] = useState("");
  const cache = useRef(new Map<Lang, CacheEntry>());
  const requestId = useRef(0);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  function scrollListTop() {
    window.setTimeout(() => {
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function applyEntry(nextLang: Lang, entry: CacheEntry) {
    setTracks(entry.tracks);
    setBatch(entry.batch);
    setHasMore(entry.hasMore);
    setLoading(false);
    setError(null);
    cache.current.set(nextLang, entry);
  }

  async function load(nextLang: Lang, force = false) {
    const id = ++requestId.current;
    setPage(1);
    setSearch("");
    setMoreError(null);
    setLoadingMore(false);
    const cached = cache.current.get(nextLang);
    if (cached && !force) {
      applyEntry(nextLang, cached);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAllKaraoke(nextLang, 0, force);
      if (id !== requestId.current) return;
      applyEntry(nextLang, {
        tracks: data.results,
        batch: data.batch,
        hasMore: data.hasMore
      });
    } catch (exc) {
      if (id !== requestId.current) return;
      setTracks([]);
      setHasMore(false);
      setError(exc instanceof Error ? exc.message : "Не удалось получить список");
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loading || loadingMore || !hasMore) return;
    const nextBatch = batch + 1;
    const id = ++requestId.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const data = await getAllKaraoke(lang, nextBatch, false);
      if (id !== requestId.current) return;
      const merged = [...tracks];
      for (const track of data.results) {
        if (!merged.some((item) => item.id === track.id)) merged.push(track);
      }
      const entry = { tracks: merged, batch: data.batch, hasMore: data.hasMore };
      setTracks(merged);
      setBatch(data.batch);
      setHasMore(data.hasMore);
      cache.current.set(lang, entry);
    } catch (exc) {
      setMoreError(exc instanceof Error ? exc.message : "Не удалось загрузить ещё");
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load(lang);
  }, [lang]);

  const filteredTracks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tracks;
    return tracks.filter((track) =>
      `${displayTitle(track)} ${track.artist || ""}`.toLowerCase().includes(needle)
    );
  }, [tracks, search]);

  const sortedTracks = useMemo(() => {
    return [...filteredTracks].sort((left, right) => {
      const result = collator.compare(displayTitle(left), displayTitle(right));
      return ascending ? result : -result;
    });
  }, [filteredTracks, ascending]);

  const totalPages = Math.max(1, Math.ceil(sortedTracks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageTracks = sortedTracks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstOnPage = sortedTracks.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastOnPage = Math.min(currentPage * PAGE_SIZE, sortedTracks.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function choose(nextLang: Lang) {
    if (nextLang === lang) return;
    setLang(nextLang);
    setPage(1);
    scrollListTop();
  }

  function toggleSort() {
    setAscending((value) => !value);
    setPage(1);
    scrollListTop();
  }

  function goToPage(nextPage: number) {
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
    scrollListTop();
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

      <div className="karaoke-search-row">
        <label className="karaoke-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Найти в загруженном списке"
          />
        </label>
        {search.trim() && (
          <button
            className="ghost-button karaoke-search-everywhere"
            onClick={() => onSearch(`${search.trim()} караоке`)}
            type="button"
          >
            Искать везде
          </button>
        )}
      </div>

      <div className="karaoke-list-head" ref={listTopRef}>
        <span>
          <ListMusic size={17} />
          {loading
            ? "Ищем караоке…"
            : search.trim()
              ? `${sortedTracks.length} найдено`
              : tracks.length
                ? `${firstOnPage}–${lastOnPage} из ${tracks.length}`
                : "0 песен"}
        </span>
        <div className="karaoke-list-actions">
          <button className="ghost-button karaoke-sort" onClick={toggleSort} type="button">
            {ascending ? <ArrowDownAZ size={15} /> : <ArrowUpAZ size={15} />}
            {ascending ? "А–Я" : "Я–А"}
          </button>
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

      {!error && !loading && sortedTracks.length > 0 && (
        <>
          <div className="karaoke-list">
            {pageTracks.map((track, index) => (
              <button
                className="karaoke-row"
                key={track.id}
                onClick={() => onOpenTrack(track)}
                type="button"
              >
                <span className="karaoke-number">
                  {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                </span>
                <span className="karaoke-main">
                  <strong>{displayTitle(track)}</strong>
                  <span>{track.artist || "Неизвестный исполнитель"}</span>
                </span>
                <span className={`karaoke-source ${track.source === "rutube" ? "rutube" : "youtube"}`}>
                  {track.source === "rutube" ? "RuTube" : "YouTube"}
                </span>
                <span className="karaoke-duration">{formatDuration(track.duration)}</span>
                <span className="karaoke-play">
                  <Play size={17} fill="currentColor" />
                </span>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="karaoke-pager">
              <button
                className="ghost-button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                type="button"
              >
                <ChevronLeft size={16} />
                Назад
              </button>
              <span>
                Страница <strong>{currentPage}</strong> из {totalPages}
              </span>
              <button
                className="ghost-button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                type="button"
              >
                Дальше
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {hasMore && (
            <div className="karaoke-load-more">
              {moreError && <span className="form-error">{moreError}</span>}
              <button className="ghost-button" onClick={() => void loadMore()} disabled={loadingMore} type="button">
                {loadingMore ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                {loadingMore ? "Загружаем ещё…" : "Загрузить ещё"}
              </button>
            </div>
          )}
        </>
      )}

      {!error && !loading && sortedTracks.length === 0 && (
        <div className="empty-panel">
          <ListMusic size={36} />
          <p>{search.trim() ? "В загруженном списке ничего нет." : "Ничего не нашлось. Попробуй обновить список."}</p>
          {search.trim() && (
            <button className="primary-button" onClick={() => onSearch(`${search.trim()} караоке`)} type="button">
              Искать в YouTube и RuTube
            </button>
          )}
        </div>
      )}
    </section>
  );
}
