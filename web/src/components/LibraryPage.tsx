import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Download, Link2, Loader2, Play, Search, Trash2, Upload } from "lucide-react";
import { deleteLocalPack, getLocalCatalog } from "../api";
import { LOCAL_GENRES, LOCAL_SONGS, type LocalSong } from "../data/localCatalog";
import type { Track } from "../types";

type Props = {
  onSearch: (query: string) => void;
  onOpenTrack: (track: Track) => void;
};

const IMPORTED_KEY = "poy:localCatalog:v1";

function readImported(): LocalSong[] {
  try {
    const raw = localStorage.getItem(IMPORTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalSong =>
        Boolean(item) &&
        typeof item.title === "string" &&
        typeof item.artist === "string" &&
        item.title.trim() !== "" &&
        item.artist.trim() !== ""
    ).map((item) => ({
      title: item.title.trim(),
      artist: item.artist.trim(),
      genre: typeof item.genre === "string" && item.genre.trim() ? item.genre.trim() : "Мои"
    }));
  } catch {
    return [];
  }
}

export default function LibraryPage({ onSearch, onOpenTrack }: Props) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("Все");
  const [imported, setImported] = useState<LocalSong[]>(readImported);
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [packUrl, setPackUrl] = useState("");
  const [packBusy, setPackBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLocalCatalog() {
      try {
        const data = await getLocalCatalog();
        if (!cancelled) setLocalTracks(data.tracks);
      } catch {
        if (!cancelled) setLocalTracks([]);
      }
    }
    void loadLocalCatalog();
    window.poyCatalogUpdated = () => {
      void loadLocalCatalog();
      setPackBusy(false);
      setPackUrl("");
      setError(null);
    };
    window.poyCatalogError = (message) => {
      setError(message);
      setPackBusy(false);
    };
    return () => {
      cancelled = true;
      delete window.poyCatalogUpdated;
      delete window.poyCatalogError;
    };
  }, []);

  function importPack() {
    if (!window.PoyTV?.importCatalogPack) {
      setError("Импорт ZIP-пакетов доступен только в приложении");
      return;
    }
    setError(null);
    window.PoyTV.importCatalogPack();
  }

  function importPackUrl() {
    if (!packUrl.trim() || packBusy) return;
    if (!window.PoyTV?.importCatalogPackUrl) {
      setError("Загрузка пакета по ссылке доступна только в приложении");
      return;
    }
    setPackBusy(true);
    setError(null);
    window.PoyTV.importCatalogPackUrl(packUrl.trim());
  }

  async function removePack(packId?: string) {
    if (!packId) return;
    try {
      await deleteLocalPack(packId);
      setLocalTracks((previous) => previous.filter((track) => track.pack_id !== packId));
      setError(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось удалить пакет");
    }
  }

  const songs = useMemo(() => [...LOCAL_SONGS, ...imported], [imported]);
  const genres = useMemo(
    () => [...LOCAL_GENRES, ...Array.from(new Set(imported.map((song) => song.genre)))],
    [imported]
  );
  const visible = songs.filter((song) => {
    const text = `${song.title} ${song.artist}`.toLowerCase();
    return (genre === "Все" || song.genre === genre) && text.includes(query.trim().toLowerCase());
  });

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) throw new Error("В файле должен быть массив песен");
        const next: LocalSong[] = parsed
          .filter((item) => item && typeof item.title === "string" && typeof item.artist === "string")
          .map((item) => ({
            title: String(item.title).trim(),
            artist: String(item.artist).trim(),
            genre: typeof item.genre === "string" && item.genre.trim() ? item.genre.trim() : "Мои"
          }))
          .filter((item) => item.title && item.artist);
        if (!next.length) throw new Error("Не найдено ни одной песни");
        const merged = [...imported, ...next].filter(
          (song, index, list) =>
            list.findIndex(
              (other) => other.title.toLowerCase() === song.title.toLowerCase() &&
                other.artist.toLowerCase() === song.artist.toLowerCase()
            ) === index
        );
        setImported(merged);
        localStorage.setItem(IMPORTED_KEY, JSON.stringify(merged));
        setError(null);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Не удалось прочитать каталог");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function downloadTemplate() {
    const data = JSON.stringify(
      [{ title: "Название песни", artist: "Исполнитель", genre: "Мои" }],
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "poy-catalog-template.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="content-page library-page">
      <div className="page-heading search-heading">
        <span className="eyebrow">ЛОКАЛЬНАЯ БИБЛИОТЕКА</span>
        <h1>Свои песни</h1>
        <p className="muted">
          Каталог хранится в приложении. Текст и минус подтягиваются онлайн, поэтому сами песни остаются доступными без интернета только как список.
        </p>
      </div>

      <div className="library-packs">
        <div className="library-packs-head">
          <div>
            <span className="eyebrow">СКАЧАННЫЕ ПАКЕТЫ</span>
            <strong>Полностью офлайн</strong>
          </div>
          <button className="ghost-button" onClick={importPack} type="button">
            <Upload size={16} /> Импорт ZIP-пакета
          </button>
        </div>
        <div className="library-pack-url">
          <Link2 size={16} />
          <input
            value={packUrl}
            onChange={(event) => setPackUrl(event.target.value)}
            placeholder="Ссылка на ZIP-пакет"
            inputMode="url"
          />
          <button className="ghost-button" onClick={importPackUrl} disabled={packBusy || !packUrl.trim()} type="button">
            {packBusy ? <Loader2 className="spin" size={15} /> : <Download size={15} />}
            {packBusy ? "Скачиваем…" : "Скачать"}
          </button>
        </div>
        {localTracks.length > 0 ? (
          <div className="library-grid library-packs-grid">
            {localTracks.map((track) => (
              <div
                key={track.id}
                className="local-song is-pack"
                role="button"
                tabIndex={0}
                onClick={() => onOpenTrack(track)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onOpenTrack(track);
                }}
              >
                <span className="local-song-mark pack-mark">
                  <Play size={18} />
                </span>
                <span className="local-song-copy">
                  <strong>{track.title}</strong>
                  <span>
                    {track.artist} · {track.provider || "локальный пакет"}
                  </span>
                </span>
                <span className="local-song-genre">Офлайн</span>
                {track.pack_id && (
                  <button
                    className="local-song-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removePack(track.pack_id);
                    }}
                    type="button"
                    title="Удалить пакет"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="library-pack-empty">
            Пока пусто. Скачай ZIP-пакет с музыкой и LRC и импортируй его сюда.
          </p>
        )}
      </div>

      <div className="library-toolbar">
        <label className="library-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти в библиотеке"
          />
        </label>
        <button className="ghost-button" onClick={() => fileRef.current?.click()} type="button">
          <Upload size={16} /> Импорт каталога
        </button>
        <button className="ghost-button" onClick={downloadTemplate} type="button">
          <Download size={16} /> Шаблон
        </button>
        {imported.length > 0 && (
          <button
            className="ghost-button"
            onClick={() => {
              setImported([]);
              localStorage.removeItem(IMPORTED_KEY);
            }}
            type="button"
          >
            <Trash2 size={16} /> Очистить мои
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importFile(file);
            event.target.value = "";
          }}
        />
      </div>

      <div className="library-genres">
        {genres.map((item) => (
          <button
            key={item}
            className={`filter-chip ${genre === item ? "active" : ""}`}
            onClick={() => setGenre(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="library-head">
        <span>
          <BookOpen size={17} /> {visible.length} песен
        </span>
        <span className="muted small">Нажми на песню — найдём караоке в YouTube и RuTube</span>
      </div>

      <div className="library-grid">
        {visible.map((song) => (
          <button
            key={`${song.artist}-${song.title}`}
            className="local-song"
            onClick={() => onSearch(`${song.title} ${song.artist} караоке`)}
            type="button"
          >
            <span className="local-song-mark">
              <BookOpen size={20} />
            </span>
            <span className="local-song-copy">
              <strong>{song.title}</strong>
              <span>{song.artist}</span>
            </span>
            <span className="local-song-genre">{song.genre}</span>
          </button>
        ))}
      </div>

      {!visible.length && (
        <div className="empty-panel">
          <p>В библиотеке пока пусто.</p>
        </div>
      )}
    </section>
  );
}
