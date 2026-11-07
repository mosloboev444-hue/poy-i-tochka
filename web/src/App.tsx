import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Heart,
  Info,
  Link2,
  ListMusic,
  Loader2,
  Mic2,
  Play,
  Search,
  Settings,
  Trash2,
  Upload
} from "lucide-react";
import { getHealth, searchTracksByProvider } from "./api";
import type { LyricsSettings, PlayerMode, Track, View } from "./types";
import AboutPage from "./components/AboutPage";
import Dashboard from "./components/Dashboard";
import ImportPanel from "./components/ImportPanel";
import LibraryPage from "./components/LibraryPage";
import LinkOpen from "./components/LinkOpen";
import Player from "./components/Player";
import SearchResultsWindow from "./components/SearchResultsWindow";
import SettingsPage from "./components/SettingsPage";
import Sidebar from "./components/Sidebar";
import StatsPage from "./components/StatsPage";
import TrackCard from "./components/TrackCard";

const SUGGESTIONS = ["Queen", "Кино", "Мåneskin", "Imagine Dragons", "Linkin Park"];
const FAVORITES_KEY = "poy:favorites:v1";
const HISTORY_KEY = "poy:history:v1";
const PLAYER_MODE_KEY = "poy:playerMode:v1";
const QUEUE_KEY = "poy:queue:v1";
const LYRICS_SETTINGS_KEY = "poy:lyricsSettings:v1";

function loadLyricsSettings(): LyricsSettings {
  try {
    const raw = localStorage.getItem(LYRICS_SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LyricsSettings>) : {};
    return {
      size: parsed.size === "s" || parsed.size === "l" ? parsed.size : "m",
      color: parsed.color === "white" || parsed.color === "cyan" ? parsed.color : "gold",
      font: parsed.font === "sans" ? "sans" : "serif"
    };
  } catch {
    return { size: "m", color: "gold", font: "serif" };
  }
}

function loadStored(key: string): Track[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Track[]) : [];
  } catch {
    return [];
  }
}

function store(key: string, value: Track[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

const PAGE_TITLES: Record<View, string> = {
  home: "Главная",
  search: "Каталог",
  library: "Библиотека",
  favorites: "Избранное",
  history: "История",
  queue: "Очередь",
  rating: "Рейтинг",
  achievements: "Достижения",
  import: "Импорт",
  settings: "Настройки",
  about: "О приложении"
};

export default function App() {
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selected, setSelected] = useState<Track | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [favorites, setFavorites] = useState<Track[]>(() => loadStored(FAVORITES_KEY));
  const [history, setHistory] = useState<Track[]>(() => loadStored(HISTORY_KEY));
  const [lastPlayed, setLastPlayed] = useState<Track | null>(() => loadStored(HISTORY_KEY)[0] || null);
  const [queue, setQueue] = useState<Track[]>(() => loadStored(QUEUE_KEY));
  const [filter, setFilter] = useState<"all" | "karaoke" | "lyrics" | "youtube" | "rutube">("all");
  const [lyricsSettings, setLyricsSettings] = useState<LyricsSettings>(loadLyricsSettings);
  const [playerMode, setPlayerMode] = useState<PlayerMode>(() => {
    const saved = localStorage.getItem(PLAYER_MODE_KEY);
    if (saved === "text" || saved === "video") return saved;
    const tv = window.PoyTV?.isTvDevice?.() ?? true;
    return tv ? "video" : "text";
  });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchCache = useRef(new Map<string, Track[]>());
  const introVoiceSent = useRef(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    window.poyHandleBack = () => {
      if (selected) {
        setSelected(null);
        return true;
      }
      if (linkOpen) {
        setLinkOpen(false);
        return true;
      }
      if (resultsOpen) {
        setResultsOpen(false);
        return true;
      }
      if (view !== "home") {
        setView(view === "about" ? "settings" : "home");
        return true;
      }
      return false;
    };
    return () => {
      delete window.poyHandleBack;
    };
  }, [selected, linkOpen, resultsOpen, view]);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    store(FAVORITES_KEY, favorites);
  }, [favorites]);

  useEffect(() => {
    store(HISTORY_KEY, history);
  }, [history]);

  useEffect(() => {
    localStorage.setItem(PLAYER_MODE_KEY, playerMode);
  }, [playerMode]);

  useEffect(() => {
    store(QUEUE_KEY, queue);
  }, [queue]);

  useEffect(() => {
    localStorage.setItem(LYRICS_SETTINGS_KEY, JSON.stringify(lyricsSettings));
  }, [lyricsSettings]);

  useEffect(() => {
    window.closePoyResults = () => setResultsOpen(false);
    window.PoyTV?.setResultsOpen?.(resultsOpen);
    return () => {
      window.PoyTV?.setResultsOpen?.(false);
    };
  }, [resultsOpen]);

  useEffect(() => {
    if (view === "search") {
      window.setTimeout(() => searchRef.current?.focus(), 120);
    }
  }, [view]);

  useEffect(() => {
    if (view !== "home" || introVoiceSent.current) return;
    introVoiceSent.current = true;
    const timer = window.setTimeout(() => window.PoyTV?.onMainMenuReady?.(), 350);
    return () => window.clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q")?.trim();
    if (initial) {
      setQuery(initial);
      void runSearch(initial, true);
    }
  }, []);

  function recordHistory(track: Track) {
    setHistory((previous) => [track, ...previous.filter((item) => item.id !== track.id)].slice(0, 30));
    setLastPlayed(track);
  }

  function openTrack(track: Track) {
    setResultsOpen(false);
    setSelected(track);
    recordHistory(track);
  }

  function toggleFavorite(track: Track) {
    setFavorites((previous) => {
      if (previous.some((item) => item.id === track.id)) {
        return previous.filter((item) => item.id !== track.id);
      }
      return [track, ...previous];
    });
  }

  function isFavorite(track: Track) {
    return favorites.some((item) => item.id === track.id);
  }

  function toggleQueue(track: Track) {
    setQueue((previous) =>
      previous.some((item) => item.id === track.id)
        ? previous.filter((item) => item.id !== track.id)
        : [...previous, track]
    );
  }

  function isQueued(track: Track) {
    return queue.some((item) => item.id === track.id);
  }

  function playNext(track: Track) {
    if (queue.length === 0) return;
    const index = queue.findIndex((item) => item.id === track.id);
    const next = queue[(index + 1) % queue.length];
    if (next) openTrack(next);
  }

  async function runSearch(value?: string, autoPlay = false, force = false) {
    const q = (value ?? query).trim();
    if (!q) return;
    const seq = ++searchSeq.current;
    setQuery(q);
    setView("search");
    setFilter("all");
    setSearchedQuery(q);
    setResultsOpen(true);
    const cached = searchCache.current.get(q);
    if (cached && !force) {
      setResults(cached);
      setSearched(true);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    setResults([]);

    const collected: Track[] = [];
    const merge = (batch: Track[]) => {
      if (seq !== searchSeq.current) return;
      for (const track of batch) {
        if (!collected.some((item) => item.id === track.id)) collected.push(track);
      }
      collected.sort((left, right) => {
        const score = (track: Track) =>
          (track.is_karaoke ? 0 : 100) +
          (track.has_synced_lyrics ? 0 : 10) +
          (track.source === "rutube" ? 0 : track.source === "youtube" ? 1 : 2);
        return score(left) - score(right);
      });
      setResults([...collected]);
    };

    const requests = [
      searchTracksByProvider("rutube", q, 6),
      searchTracksByProvider("youtube", q, 8)
    ];
    const settled = await Promise.allSettled(
      requests.map((promise) =>
        promise.then((data) => {
          merge(data.results);
          return data.results;
        })
      )
    );
    if (seq !== searchSeq.current) return;

    if (collected.length === 0) {
      const rejected = settled.find((item) => item.status === "rejected");
      setResults([]);
      setError(
        rejected && rejected.status === "rejected" && rejected.reason instanceof Error
          ? rejected.reason.message
          : "Поиск не удался"
      );
    } else {
      setResults([...collected]);
      searchCache.current.set(q, [...collected]);
      const params = new URLSearchParams(window.location.search);
      if (autoPlay && params.has("play")) {
        const index = Math.max(0, Number(params.get("play")) || 0);
        openTrack(collected[Math.min(index, collected.length - 1)]);
      }
    }
    setLoading(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const q = query.trim();
    if (!loading && searched && results.length > 0 && q === searchedQuery) {
      setResultsOpen(true);
      return;
    }
    void runSearch();
  }

  function findKaraoke(track: Track) {
    setSelected(null);
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    const nextQuery = `${track.title} ${track.artist === "Local file" ? "" : track.artist} караоке`.trim();
    setQuery(nextQuery);
    void runSearch(nextQuery);
  }

  function goTo(next: View) {
    setResultsOpen(false);
    setView(next);
  }

  const backendOnline = Boolean(health?.ok);
  const currentList = view === "favorites" ? favorites : history;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="noise" />

      <div className="layout">
        <Sidebar view={view} onSelect={goTo} />

        <main className="main">
          <header className="topbar">
            <div className="topbar-title">
              <img className="topbar-logo" src="/logo.png" alt="" />
              <span className="topbar-kicker">{PAGE_TITLES[view]}</span>
              <span className={`status-dot ${backendOnline ? "online" : "offline"}`} />
              <span className="topbar-status">{backendOnline ? "локальный сервер" : "нет связи"}</span>
            </div>
            <div className="topbar-actions">
              <button
                className="topbar-icon"
                onClick={() => {
                  setView("search");
                  window.setTimeout(() => searchRef.current?.focus(), 120);
                }}
                type="button"
                title="Поиск"
              >
                <Search size={22} />
              </button>
              <button
                className={`topbar-icon ${linkOpen ? "active" : ""}`}
                onClick={() => {
                  setResultsOpen(false);
                  setLinkOpen(true);
                }}
                type="button"
                title="Открыть по ссылке"
              >
                <Link2 size={22} />
              </button>
              <button
                className={`topbar-icon ${view === "about" ? "active" : ""}`}
                onClick={() => setView("about")}
                type="button"
                title="О приложении"
              >
                <Info size={21} />
              </button>
              <button
                className={`topbar-icon ${view === "settings" ? "active" : ""}`}
                onClick={() => setView("settings")}
                type="button"
                title="Настройки"
              >
                <Settings size={22} />
              </button>
            </div>
          </header>

          {view === "home" && (
            <Dashboard
              favoritesCount={favorites.length}
              history={history}
              onSing={() => {
                setView("search");
                window.setTimeout(() => searchRef.current?.focus(), 120);
              }}
              onNavigate={(target) => setView(target)}
              onSearch={(value) => void runSearch(value)}
              onOpenTrack={openTrack}
            />
          )}

          {view === "library" && (
            <LibraryPage
              onSearch={(value) => void runSearch(value)}
              onOpenTrack={openTrack}
            />
          )}

          {view === "search" && (
            <section className="content-page">
              <div className="page-heading search-heading">
                <span className="eyebrow">КАТАЛОГ</span>
                <h1>Выбери песню</h1>
                <p className="muted">
                  YouTube, RuTube. Текст — из LRCLIB, минус уже в караоке-видео.
                </p>
              </div>

              <form className="search-box catalog-search" onSubmit={handleSubmit}>
                <Search className="search-icon" size={24} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Песня, исполнитель или строка из текста…"
                  aria-label="Поиск песни"
                />
                <button className="search-submit" type="submit" disabled={loading || !query.trim()}>
                  {loading ? <Loader2 className="spin" size={20} /> : <Mic2 size={20} />}
                  <span>{loading ? "Ищем" : "Петь"}</span>
                </button>
              </form>

              <div className="hero-chips">
                <span className="chips-label">Начни с:</span>
                {SUGGESTIONS.map((item) => (
                  <button key={item} className="chip" onClick={() => void runSearch(item)} type="button">
                    {item}
                  </button>
                ))}
              </div>

              <div className="search-window-hint">
                <span className="search-window-icon">
                  <Mic2 size={26} />
                </span>
                <div>
                  <p>
                    {loading
                      ? "Ищем песни…"
                      : searched
                        ? `Результаты по запросу «${searchedQuery}» готовы`
                        : "Результаты откроются в отдельном окне"}
                  </p>
                  <span className="muted small">
                    Нажми «Петь» — откроется новое окно с найденными песнями.
                  </span>
                </div>
                {searched && !loading && (
                  <button className="primary-button" onClick={() => setResultsOpen(true)} type="button">
                    Открыть результаты
                  </button>
                )}
              </div>
            </section>
          )}

          {(view === "favorites" || view === "history") && (
            <section className="content-page">
              <div className="page-heading search-heading">
                <span className="eyebrow">{view === "favorites" ? "ИЗБРАННОЕ" : "ИСТОРИЯ"}</span>
                <h1>{view === "favorites" ? "Любимые песни" : "Последние исполнения"}</h1>
                <p className="muted">
                  {view === "favorites"
                    ? "Сердце на карточке добавляет песню сюда."
                    : "Всё, что ты открывал для пения на этом устройстве."}
                </p>
              </div>

              {currentList.length > 0 ? (
                <>
                  <div className="results-head">
                    <div>
                      <span className="eyebrow">СПИСОК</span>
                      <h2>{currentList.length}</h2>
                    </div>
                    {view === "history" && (
                      <button className="text-link" onClick={() => setHistory([])} type="button">
                        <Trash2 size={16} /> Очистить
                      </button>
                    )}
                  </div>
                  <div className="cards-grid">
                    {currentList.map((track) => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        onSelect={openTrack}
                        isFavorite={isFavorite(track)}
                        onToggleFavorite={toggleFavorite}
                        isQueued={isQueued(track)}
                        onToggleQueue={toggleQueue}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-panel">
                  <Heart size={38} />
                  <p>{view === "favorites" ? "Ещё ничего не сохранено." : "История пока пуста."}</p>
                  <button className="primary-button" onClick={() => setView("search")} type="button">
                    Открыть каталог
                  </button>
                </div>
              )}
            </section>
          )}

          {(view === "rating" || view === "achievements") && (
            <StatsPage view={view} history={history} favorites={favorites} />
          )}

          {view === "queue" && (
            <section className="content-page">
              <div className="page-heading search-heading">
                <span className="eyebrow">ОЧЕРЕДЬ</span>
                <h1>Что поём дальше</h1>
                <p className="muted">
                  Добавляй песни с карточек. Очередь сохраняется на телевизоре.
                </p>
              </div>

              {queue.length > 0 ? (
                <>
                  <div className="results-head">
                    <div>
                      <span className="eyebrow">В ОЧЕРЕДИ</span>
                      <h2>{queue.length}</h2>
                    </div>
                    <button className="text-link" onClick={() => setQueue([])} type="button">
                      <Trash2 size={16} /> Очистить
                    </button>
                  </div>
                  <div className="cards-grid">
                    {queue.map((track) => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        onSelect={openTrack}
                        isFavorite={isFavorite(track)}
                        onToggleFavorite={toggleFavorite}
                        isQueued={isQueued(track)}
                        onToggleQueue={toggleQueue}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-panel">
                  <ListMusic size={38} />
                  <p>Очередь пуста.</p>
                  <p className="muted">Открой каталог и добавь песни кнопкой «В очередь» на карточке.</p>
                  <button className="primary-button" onClick={() => setView("search")} type="button">
                    Открыть каталог
                  </button>
                </div>
              )}
            </section>
          )}

          {view === "settings" && (
            <SettingsPage
              playerMode={playerMode}
              onPlayerModeChange={setPlayerMode}
              onOpenAbout={() => setView("about")}
            />
          )}

          {view === "about" && (
            <AboutPage onBack={() => setView("settings")} />
          )}

          {view === "import" && (
            <section className="content-page import-page">
              <div className="page-heading search-heading">
                <span className="eyebrow">ИМПОРТ</span>
                <h1>Своя музыка</h1>
                <p className="muted">
                  Загрузи трек на телевизор. Текст найдём в LRCLIB, а минус подберём караоке-версией
                  на YouTube.
                </p>
              </div>
              <ImportPanel onImported={openTrack} />
            </section>
          )}
        </main>
      </div>

      {resultsOpen && (
        <SearchResultsWindow
          query={searchedQuery || query}
          results={results}
          loading={loading}
          error={error}
          filter={filter}
          onFilterChange={setFilter}
          onClose={() => {
            setResultsOpen(false);
            window.setTimeout(() => searchRef.current?.focus(), 100);
          }}
          onSelect={openTrack}
          onRetry={() => void runSearch(query, false, true)}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          isQueued={isQueued}
          onToggleQueue={toggleQueue}
        />
      )}

      <LinkOpen
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onOpenTrack={openTrack}
      />

      {lastPlayed &&
        view !== "home" &&
        view !== "library" &&
        view !== "settings" &&
        view !== "about" &&
        !resultsOpen && (
        <div className="now-playing-bar">
          <div className="np-track">
            {lastPlayed.thumbnail ? (
              <img src={lastPlayed.thumbnail} alt="" />
            ) : (
              <span className="np-fallback">
                <Mic2 size={22} />
              </span>
            )}
            <div>
              <strong>{lastPlayed.title}</strong>
              <span>{lastPlayed.artist}</span>
            </div>
          </div>
          <div className="np-controls">
            <button className="np-play" onClick={() => openTrack(lastPlayed)} type="button">
              <Play size={20} fill="currentColor" />
            </button>
            <span className="np-hint">Продолжить</span>
          </div>
          <div className="np-wave" aria-hidden>
            {Array.from({ length: 16 }).map((_, index) => (
              <span key={index} style={{ animationDelay: `${(index % 7) * 0.12}s` }} />
            ))}
          </div>
        </div>
      )}

      {selected && (
        <Player
          track={selected}
          onClose={() => setSelected(null)}
          standalone={Boolean(health?.standalone)}
          onFindKaraoke={findKaraoke}
          mode={playerMode}
          onModeChange={setPlayerMode}
          lyricsSettings={lyricsSettings}
          onLyricsSettingsChange={setLyricsSettings}
          isQueued={isQueued(selected)}
          onToggleQueue={toggleQueue}
          onNext={() => playNext(selected)}
          hasQueue={queue.length > 0}
          isFavorite={isFavorite(selected)}
          onToggleFavorite={toggleFavorite}
          onTrackUpdated={(updated) => {
            setSelected(updated);
            setResults((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
            setHistory((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
          }}
        />
      )}
    </div>
  );
}
