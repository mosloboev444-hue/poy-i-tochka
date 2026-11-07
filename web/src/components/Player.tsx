import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import {
  ALargeSmall,
  Disc3,
  ExternalLink,
  FastForward,
  Heart,
  ListCheck,
  ListPlus,
  Loader2,
  Mic2,
  MonitorPlay,
  Music2,
  Pause,
  Play,
  Rewind,
  SkipForward,
  Sparkles,
  Type,
  UserRound,
  Video,
  Volume2,
  WandSparkles,
  X
} from "lucide-react";
import { fetchLyrics, getJob, getRuTubeStream, getYouTubeAudio, startSeparation } from "../api";
import type { Job, Lyrics, LyricsSettings, PlayerMode, Track } from "../types";
import { formatTime } from "../lrc";
import BrandHeader from "./BrandHeader";
import LyricsView from "./LyricsView";
import YouTubePlayer from "./YouTubePlayer";

type Props = {
  track: Track;
  onClose: () => void;
  onTrackUpdated?: (track: Track) => void;
  standalone?: boolean;
  onFindKaraoke?: (track: Track) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (track: Track) => void;
  mode?: PlayerMode;
  onModeChange?: (mode: PlayerMode) => void;
  lyricsSettings?: LyricsSettings;
  onLyricsSettingsChange?: (settings: LyricsSettings) => void;
  isQueued?: boolean;
  onToggleQueue?: (track: Track) => void;
  onNext?: () => void;
  hasQueue?: boolean;
};

function sourceLabel(track: Track): string {
  if (track.source === "youtube") return "YouTube";
  if (track.source === "rutube") return "RuTube";
  if (track.source === "vk") return "VK Video";
  if (track.source === "jamendo") return "Jamendo";
  if (track.source === "audius") return "Audius";
  if (track.is_pack) return "Локальный пакет";
  return "Свой файл";
}

export default function Player({ track, onClose, onTrackUpdated, standalone, onFindKaraoke, isFavorite, onToggleFavorite, mode = "video", onModeChange, lyricsSettings = { size: "m", color: "gold", font: "serif" }, onLyricsSettingsChange, isQueued, onToggleQueue, onNext, hasQueue }: Props) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(true);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(track.duration ?? null);
  const [instrumentalUrl, setInstrumentalUrl] = useState<string | null>(track.instrumental_url ?? null);
  const [useInstrumental, setUseInstrumental] = useState(Boolean(track.instrumental_url));
  const [job, setJob] = useState<Job | null>(null);
  const [separating, setSeparating] = useState(false);
  const [separateError, setSeparateError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [songSpeed, setSongSpeed] = useState(1);
  const [songPitch, setSongPitch] = useState(1);
  const [rutubeStream, setRutubeStream] = useState<string | null>(null);
  const [hlsError, setHlsError] = useState<string | null>(null);
  const [youtubeAudio, setYoutubeAudio] = useState<string | null>(null);
  const [youtubeAudioLoading, setYoutubeAudioLoading] = useState(false);
  const [youtubeAudioError, setYoutubeAudioError] = useState<string | null>(null);
  const [lyricsOffset, setLyricsOffset] = useState(0);
  const [lyricsRate, setLyricsRate] = useState(1);
  const [textPanel, setTextPanel] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rutubeVideoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeAudioRef = useRef<HTMLAudioElement | null>(null);
  const hlsSettingsRef = useRef({ speed: 1, pitch: 1, volume: 1 });

  const isYouTube = track.source === "youtube" && Boolean(track.video_id);
  const nativeYouTube = typeof window !== "undefined" ? window.PoyTV : undefined;
  const isTvDevice = nativeYouTube?.isTvDevice?.() ?? true;
  const nativeTvYouTube = Boolean(nativeYouTube) && isTvDevice;
  const isRuTube = track.source === "rutube" && Boolean(track.embed_url);
  const isVk = track.source === "vk" && Boolean(track.embed_url);
  const isEmbeddedVideo = isRuTube || isVk;
  const videoId = track.video_id || "";
  const audioSrc = useInstrumental && instrumentalUrl ? instrumentalUrl : track.stream_url;
  const rutubeId = isRuTube ? track.id.replace(/^rutube:/, "") : "";
  const directVideo = isRuTube && mode === "text" && Boolean(rutubeStream);
  const nativeHlsVideo = directVideo && Boolean(window.PoyTV?.hlsLoad);
  const directYouTubeAudio = isYouTube && mode === "text" && Boolean(youtubeAudio);
  const hasMediaControls =
    directVideo || directYouTubeAudio || (Boolean(audioSrc) && !isYouTube && !isEmbeddedVideo);
  const syncAvailable = !isEmbeddedVideo || directVideo || directYouTubeAudio;

  useEffect(() => {
    const saved = localStorage.getItem(`poy:lyricsOffset:${track.id}`);
    setLyricsOffset(saved ? Number(saved) || 0 : 0);
    const savedRate = localStorage.getItem(`poy:lyricsRate:${track.id}`);
    setLyricsRate(savedRate ? Number(savedRate) || 1 : 1);
  }, [track.id]);

  function adjustLyricsOffset(delta: number) {
    setLyricsOffset((previous) => {
      const next = Math.max(-15, Math.min(15, Math.round((previous + delta) * 10) / 10));
      localStorage.setItem(`poy:lyricsOffset:${track.id}`, String(next));
      return next;
    });
  }

  function adjustLyricsRate(delta: number) {
    setLyricsRate((previous) => {
      const next = Math.max(0.85, Math.min(1.15, Math.round((previous + delta) * 100) / 100));
      localStorage.setItem(`poy:lyricsRate:${track.id}`, String(next));
      return next;
    });
  }

  useEffect(() => {
    const savedSpeed = localStorage.getItem(`poy:songSpeed:${track.id}`);
    const savedPitch = localStorage.getItem(`poy:songPitch:${track.id}`);
    setSongSpeed(savedSpeed ? Number(savedSpeed) || 1 : 1);
    setSongPitch(savedPitch ? Number(savedPitch) || 1 : 1);
  }, [track.id]);

  function adjustSongSpeed(delta: number) {
    setSongSpeed((previous) => {
      const next = Math.max(0.75, Math.min(1.25, Math.round((previous + delta) * 100) / 100));
      localStorage.setItem(`poy:songSpeed:${track.id}`, String(next));
      return next;
    });
  }

  function adjustSongPitch(semitones: number) {
    setSongPitch((previous) => {
      const next = Math.max(0.5, Math.min(2, previous * Math.pow(2, semitones / 12)));
      localStorage.setItem(`poy:songPitch:${track.id}`, String(next));
      return next;
    });
  }

  useEffect(() => {
    hlsSettingsRef.current = { speed: songSpeed, pitch: songPitch, volume };
  }, [songSpeed, songPitch, volume]);

  useEffect(() => {
    if (nativeHlsVideo) {
      window.PoyTV?.hlsSetSpeed?.(songSpeed);
      window.PoyTV?.hlsSetPitch?.(songPitch);
    }
    const media = mediaElement();
    if (media) {
      media.playbackRate = songSpeed;
      media.preservesPitch = true;
    }
  }, [songSpeed, songPitch, nativeHlsVideo, directVideo, audioSrc]);

  useEffect(() => {
    if (!isYouTube || mode !== "video" || !nativeTvYouTube) return;
    nativeYouTube?.playYouTube(videoId);
  }, [isYouTube, mode, nativeTvYouTube, nativeYouTube, videoId]);

  useEffect(() => {
    if (!nativeHlsVideo || !rutubeStream) return;
    setHlsError(null);
    window.PoyTV?.hlsLoad?.(rutubeStream);
    window.PoyTV?.hlsSetSpeed?.(hlsSettingsRef.current.speed);
    window.PoyTV?.hlsSetPitch?.(hlsSettingsRef.current.pitch);
    window.PoyTV?.hlsSetVolume?.(hlsSettingsRef.current.volume);
    return () => window.PoyTV?.hlsStop?.();
  }, [nativeHlsVideo, rutubeStream]);

  useEffect(() => {
    window.poyHlsTime = setCurrentTime;
    window.poyHlsDuration = (value) => setAudioDuration(value);
    window.poyHlsState = setIsPlaying;
    window.poyHlsError = (message) => setHlsError(message);
    window.poyHlsEnded = () => setIsPlaying(false);
    return () => {
      delete window.poyHlsTime;
      delete window.poyHlsDuration;
      delete window.poyHlsState;
      delete window.poyHlsError;
      delete window.poyHlsEnded;
    };
  }, []);

  useEffect(() => {
    if (nativeHlsVideo) window.PoyTV?.hlsSetVolume?.(volume);
  }, [nativeHlsVideo, volume]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `poy:lyricsCache:${track.id}`;
    let cached: Lyrics | null = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw) as Lyrics;
    } catch {
      cached = null;
    }
    setLyrics(cached);
    setLyricsLoading(!cached);
    setLyricsError(null);
    setCurrentTime(0);
    setInstrumentalUrl(track.instrumental_url ?? null);
    setUseInstrumental(Boolean(track.instrumental_url));
    setJob(null);
    setSeparateError(null);

    const lyricsRequest: Promise<Lyrics> = track.lyrics_url
      ? fetch(track.lyrics_url).then(async (response) => {
          if (!response.ok) throw new Error("Локальный текст не найден");
          const data = (await response.json()) as { syncedLyrics?: string; plainLyrics?: string };
          return {
            id: 0,
            trackName: track.title,
            artistName: track.artist,
            duration: track.duration ?? null,
            syncedLyrics: data.syncedLyrics ?? null,
            plainLyrics: data.plainLyrics ?? null
          };
        })
      : fetchLyrics(track);

    lyricsRequest
      .then((data) => {
        if (!cancelled) {
          setLyrics(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {
            // storage can be full; lyrics still work in this session
          }
        }
      })
      .catch((exc: unknown) => {
        if (!cancelled && !cached) {
          setLyricsError(exc instanceof Error ? exc.message : "Текст не найден");
        }
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [track.id]);

  useEffect(() => {
    if (!isRuTube || mode !== "text" || !rutubeId) {
      setRutubeStream(null);
      return;
    }
    let cancelled = false;
    setRutubeStream(null);
    getRuTubeStream(rutubeId).then((data) => {
      if (!cancelled && data.url) setRutubeStream(data.url);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isRuTube, mode, rutubeId]);

  useEffect(() => {
    if (!isYouTube || mode !== "text" || !videoId) {
      setYoutubeAudio(null);
      setYoutubeAudioError(null);
      setYoutubeAudioLoading(false);
      return;
    }
    let cancelled = false;
    setYoutubeAudio(null);
    setYoutubeAudioError(null);
    setYoutubeAudioLoading(true);
    getYouTubeAudio(videoId).then((data) => {
      if (!cancelled && data.url) setYoutubeAudio(data.url);
    }).catch((exc: unknown) => {
      if (!cancelled) setYoutubeAudioError(exc instanceof Error ? exc.message : "Не удалось получить аудио YouTube");
    }).finally(() => {
      if (!cancelled) setYoutubeAudioLoading(false);
    });
    return () => { cancelled = true; };
  }, [isYouTube, mode, videoId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getJob(job.id);
        setJob(next);
        if (next.status === "done" && next.result?.instrumental_url) {
          setInstrumentalUrl(next.result.instrumental_url);
          setUseInstrumental(true);
          setSeparating(false);
          const updated = { ...track, instrumental_url: next.result.instrumental_url, is_instrumental: true };
          onTrackUpdated?.(updated);
        }
        if (next.status === "error") {
          setSeparating(false);
          setSeparateError(next.error || "Не удалось отделить вокал");
        }
      } catch (exc) {
        setSeparating(false);
        setSeparateError(exc instanceof Error ? exc.message : "Ошибка задачи");
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, onTrackUpdated, track]);

  async function makeInstrumental() {
    setSeparating(true);
    setSeparateError(null);
    try {
      const response = await startSeparation(track.id);
      if (response.status === "done" && response.result?.instrumental_url) {
        setInstrumentalUrl(response.result.instrumental_url);
        setUseInstrumental(true);
        setSeparating(false);
        onTrackUpdated?.({ ...track, instrumental_url: response.result.instrumental_url, is_instrumental: true });
        return;
      }
      if (response.job_id) {
        setJob({
          id: response.job_id,
          track_id: track.id,
          status: (response.status as Job["status"]) || "queued"
        });
      } else {
        setSeparating(false);
      }
    } catch (exc) {
      setSeparating(false);
      setSeparateError(exc instanceof Error ? exc.message : "Не удалось запустить разделение");
    }
  }

  const background = track.thumbnail || "";
  const duration = audioDuration ?? track.duration ?? 0;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const timeText = (value: number) => (value > 0 ? formatTime(value) : "00:00");
  const lyricsVars = {
    "--lyrics-size":
      lyricsSettings.size === "s"
        ? "clamp(1rem, 2.2vw, 1.7rem)"
        : lyricsSettings.size === "l"
          ? "clamp(1.55rem, 3.45vw, 2.75rem)"
          : "clamp(1.3rem, 2.9vw, 2.35rem)",
    "--lyrics-color":
      lyricsSettings.color === "white"
        ? "#f8f4ff"
        : lyricsSettings.color === "cyan"
          ? "#67e8f9"
          : "#ffd77a",
    "--lyrics-font":
      lyricsSettings.font === "sans"
        ? '"Segoe UI", system-ui, sans-serif'
        : 'Georgia, "Times New Roman", serif'
  } as CSSProperties;

  function mediaElement(): HTMLMediaElement | null {
    if (directVideo) return rutubeVideoRef.current;
    if (directYouTubeAudio) return youtubeAudioRef.current;
    return audioRef.current;
  }

  function togglePlay() {
    if (nativeHlsVideo) {
      if (isPlaying) window.PoyTV?.hlsPause?.();
      else window.PoyTV?.hlsPlay?.();
      return;
    }
    const media = mediaElement();
    if (!media) return;
    if (media.paused) void media.play();
    else media.pause();
  }

  function skip(seconds: number) {
    if (nativeHlsVideo) {
      window.PoyTV?.hlsSeek?.(Math.max(0, currentTime + seconds));
      return;
    }
    const media = mediaElement();
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(media.duration || duration, media.currentTime + seconds));
  }

  function seek(event: MouseEvent<HTMLDivElement>) {
    if (nativeHlsVideo) {
      if (!duration) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      window.PoyTV?.hlsSeek?.(ratio * duration);
      return;
    }
    const media = mediaElement();
    if (!media || !duration || !hasMediaControls) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    media.currentTime = ratio * (media.duration || duration);
  }

  return (
    <div className={`player-overlay song-screen ${mode === "text" ? "text-mode" : ""}`} style={lyricsVars} role="dialog" aria-modal="true">
      <div
        className="player-backdrop"
        style={background ? { backgroundImage: `url(${background})` } : undefined}
      />
      <div className="player-scrim" />
      {isPlaying && (
        <div className="song-visualizer" aria-hidden>
          {Array.from({ length: 16 }).map((_, index) => (
            <span key={index} style={{ animationDelay: `${(index % 8) * 0.12}s` }} />
          ))}
        </div>
      )}

      <BrandHeader
        onBack={onClose}
        actions={
          <>
            {onLyricsSettingsChange && (
              <button
                className={`icon-button ${textPanel ? "active" : ""}`}
                onClick={() => setTextPanel((previous) => !previous)}
                type="button"
                title="Настройка текста"
              >
                <ALargeSmall size={20} />
              </button>
            )}
            {onModeChange && (
              <button
                className="icon-button"
                onClick={() => onModeChange(mode === "text" ? "video" : "text")}
                type="button"
                title={mode === "text" ? "Показать видео" : "Только текст"}
              >
                {mode === "text" ? <Video size={20} /> : <Type size={20} />}
              </button>
            )}
            {onToggleQueue && (
              <button
                className={`icon-button ${isQueued ? "active" : ""}`}
                onClick={() => onToggleQueue(track)}
                type="button"
                title={isQueued ? "Убрать из очереди" : "В очередь"}
              >
                {isQueued ? <ListCheck size={20} /> : <ListPlus size={20} />}
              </button>
            )}
            {hasQueue && onNext && (
              <button className="icon-button" onClick={onNext} type="button" title="Следующая из очереди">
                <SkipForward size={20} />
              </button>
            )}
            {onToggleFavorite && (
              <button
                className={`icon-button ${isFavorite ? "active" : ""}`}
                onClick={() => onToggleFavorite(track)}
                type="button"
                title={isFavorite ? "Убрать из избранного" : "В избранное"}
              >
                <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
              </button>
            )}
            {track.webpage_url && (
              <a className="icon-button" href={track.webpage_url} target="_blank" rel="noreferrer" title="Открыть источник">
                <ExternalLink size={20} />
              </a>
            )}
            <button className="icon-button" onClick={onClose} type="button" title="Закрыть">
              <X size={22} />
            </button>
          </>
        }
      />

      {textPanel && onLyricsSettingsChange && (
        <div className="text-settings-panel">
          <div className="text-panel-head">
            <strong>Настройка текста</strong>
            <button className="text-panel-close" onClick={() => setTextPanel(false)} type="button" title="Закрыть">
              <X size={16} />
            </button>
          </div>
          <div className="text-panel-group">
            <span>Размер</span>
            <div className="text-panel-row">
              {(["s", "m", "l"] as const).map((size) => (
                <button
                  key={size}
                  className={`panel-chip ${lyricsSettings.size === size ? "active" : ""}`}
                  onClick={() => onLyricsSettingsChange({ ...lyricsSettings, size })}
                  type="button"
                >
                  {size === "s" ? "S" : size === "m" ? "M" : "L"}
                </button>
              ))}
            </div>
          </div>
          <div className="text-panel-group">
            <span>Синхронизация</span>
            <div className="sync-row">
              <button className="panel-chip" onClick={() => adjustLyricsOffset(-0.5)} type="button">
                −0.5 с
              </button>
              <button className="panel-chip" onClick={() => adjustLyricsOffset(0.5)} type="button">
                +0.5 с
              </button>
              <span className="sync-value">
                {lyricsOffset > 0 ? "+" : ""}
                {lyricsOffset.toFixed(1)} с
              </span>
              <button className="panel-chip" onClick={() => adjustLyricsOffset(-lyricsOffset)} type="button">
                0
              </button>
            </div>
            <span className="sync-help">Если текст отстаёт — жми «+0.5 с».</span>
          </div>
          <div className="text-panel-group">
            <span>Темп текста</span>
            <div className="sync-row">
              <button className="panel-chip" onClick={() => adjustLyricsRate(-0.01)} type="button">
                −1%
              </button>
              <button className="panel-chip" onClick={() => adjustLyricsRate(0.01)} type="button">
                +1%
              </button>
              <span className="sync-value">{Math.round(lyricsRate * 100)}%</span>
              <button className="panel-chip" onClick={() => adjustLyricsRate(1 - lyricsRate)} type="button">
                100%
              </button>
            </div>
            <span className="sync-help">Если текст отстаёт всё сильнее — добавляй +1%.</span>
          </div>
          <div className="text-panel-group">
            <span>Скорость песни</span>
            <div className="sync-row">
              <button className="panel-chip" onClick={() => adjustSongSpeed(-0.05)} type="button">
                −
              </button>
              <span className="sync-value">{songSpeed.toFixed(2)}×</span>
              <button className="panel-chip" onClick={() => adjustSongSpeed(0.05)} type="button">
                +
              </button>
              <button className="panel-chip" onClick={() => adjustSongSpeed(1 - songSpeed)} type="button">
                1×
              </button>
            </div>
          </div>
          <div className="text-panel-group">
            <span>Тональность</span>
            <div className="sync-row">
              <button className="panel-chip" onClick={() => adjustSongPitch(-1)} type="button">
                −1
              </button>
              <span className="sync-value">
                {Math.round(12 * Math.log2(songPitch)) > 0 ? "+" : ""}
                {Math.round(12 * Math.log2(songPitch))}
              </span>
              <button className="panel-chip" onClick={() => adjustSongPitch(1)} type="button">
                +1
              </button>
              <button className="panel-chip" onClick={() => adjustSongPitch(-12 * Math.log2(songPitch))} type="button">
                0
              </button>
            </div>
            <span className="sync-help">
              {nativeHlsVideo ? "Работает для RuTube HLS" : "Доступно для RuTube в режиме текста"}
            </span>
          </div>
          <div className="text-panel-group">
            <span>Цвет</span>
            <div className="text-panel-row">
              {(["gold", "white", "cyan"] as const).map((color) => (
                <button
                  key={color}
                  className={`color-dot color-${color} ${lyricsSettings.color === color ? "active" : ""}`}
                  onClick={() => onLyricsSettingsChange({ ...lyricsSettings, color })}
                  type="button"
                  title={color === "gold" ? "Золотой" : color === "white" ? "Белый" : "Циан"}
                />
              ))}
            </div>
          </div>
          <div className="text-panel-group">
            <span>Шрифт</span>
            <div className="text-panel-row">
              {(["serif", "sans"] as const).map((font) => (
                <button
                  key={font}
                  className={`panel-chip ${lyricsSettings.font === font ? "active" : ""}`}
                  onClick={() => onLyricsSettingsChange({ ...lyricsSettings, font })}
                  type="button"
                >
                  {font === "serif" ? "С засечками" : "Без засечек"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="song-body">
        <section className="song-main">
          <div className="song-head">
            <div className="song-cover">
              {track.thumbnail ? (
                <img src={track.thumbnail} alt="" />
              ) : (
                <div className="song-cover-fallback">
                  <Mic2 size={46} />
                </div>
              )}
              <span className="cover-glow" />
            </div>
            <div className="song-copy">
              <span className="eyebrow">{sourceLabel(track)}</span>
              <h1 className="song-title">{track.title}</h1>
              <p className="song-artist">{track.artist}</p>
              <div className="song-facts">
                <span>
                  <Disc3 size={15} /> {track.album || track.provider || sourceLabel(track)}
                </span>
                <span>
                  {track.author ? <UserRound size={15} /> : <Music2 size={15} />}{" "}
                  {track.author || (track.is_karaoke ? "караоке-версия" : "оригинал")}
                </span>
              </div>
              <div
                className={`song-progress ${hasMediaControls ? "" : "is-static"}`}
                onClick={seek}
              >
                <div className="song-progress-track">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="song-times">
                  <span>{timeText(currentTime)}</span>
                  <span>{timeText(duration)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="song-stage">
            <div className="stage-frame">
              {isYouTube && mode === "video" && nativeTvYouTube ? (
                <div className="native-player-poster">
                  <MonitorPlay size={46} />
                  <strong>Видео открыто в YouTube TV</strong>
                  <p className="muted small">Видео играет поверх приложения. Закрой его, чтобы вернуться к тексту.</p>
                  <button className="primary-button" onClick={() => nativeYouTube?.playYouTube(videoId)} type="button">
                    <Play size={18} /> Открыть снова
                  </button>
                </div>
              ) : isYouTube && mode === "text" ? (
                <div className="song-audio-stage">
                  {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <Mic2 size={72} />}
                  {youtubeAudioLoading ? <Loader2 className="spin" size={42} /> : <div className="audio-pulse" aria-hidden />}
                  <span className="eyebrow">{youtubeAudioError ? "АУДИО НЕДОСТУПНО" : youtubeAudioLoading ? "ГОТОВИМ АУДИО" : "АУДИО YOUTUBE"}</span>
                </div>
              ) : isYouTube ? (
                <YouTubePlayer
                  videoId={videoId}
                  onTime={setCurrentTime}
                  onDuration={(duration) => setAudioDuration(duration)}
                />
              ) : nativeHlsVideo ? (
                <div className="song-audio-stage">
                  {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <Mic2 size={72} />}
                  <div className="audio-pulse" aria-hidden />
                  <span className="eyebrow">AUDIO RUTUBE · HLS</span>
                </div>
              ) : directVideo ? (
                <video
                  ref={rutubeVideoRef}
                  className="hidden-media"
                  src={rutubeStream || ""}
                  autoPlay
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onLoadedMetadata={(event) => {
                    event.currentTarget.playbackRate = songSpeed;
                    event.currentTarget.preservesPitch = true;
                    setAudioDuration(event.currentTarget.duration);
                  }}
                />
              ) : isEmbeddedVideo ? (
                <iframe
                  className="embed-frame"
                  src={track.embed_url || ""}
                  title={track.title}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : audioSrc ? (
                <div className="song-audio-stage">
                  {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <Mic2 size={72} />}
                  <div className="audio-pulse" aria-hidden>
                    {Array.from({ length: 18 }).map((_, index) => (
                      <span key={index} style={{ animationDelay: `${(index % 8) * 0.1}s` }} />
                    ))}
                  </div>
                  <span className="eyebrow">{useInstrumental ? "МИНУС" : "ОРИГИНАЛ"}</span>
                </div>
              ) : (
                <div className="stage-missing">
                  <Music2 size={46} />
                  <p>Для этого трека нет аудиопотока.</p>
                </div>
              )}
            </div>
          </div>

          {directYouTubeAudio && (
            <audio
              className="hidden-audio"
              key={youtubeAudio}
              ref={youtubeAudioRef}
              src={youtubeAudio || ""}
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = songSpeed;
                event.currentTarget.preservesPitch = true;
                setAudioDuration(event.currentTarget.duration);
              }}
              onError={() => setYoutubeAudioError("YouTube не отдал аудиопоток")}
            />
          )}

          {audioSrc && !isYouTube && !isEmbeddedVideo && (
            <audio
              className="hidden-audio"
              key={audioSrc}
              ref={audioRef}
              src={audioSrc}
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = songSpeed;
                event.currentTarget.preservesPitch = true;
                setAudioDuration(event.currentTarget.duration);
              }}
            />
          )}

          <div className="song-transport">
            {hasMediaControls ? (
              <>
                <button className="transport-button" onClick={() => skip(-10)} type="button" title="Назад на 10 секунд">
                  <Rewind size={22} />
                </button>
                <button className="transport-play" onClick={togglePlay} type="button" title={isPlaying ? "Пауза" : "Играть"}>
                  {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                </button>
                <button className="transport-button" onClick={() => skip(10)} type="button" title="Вперёд на 10 секунд">
                  <FastForward size={22} />
                </button>
                <div className="transport-volume">
                  <Volume2 size={17} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setVolume(next);
                      if (nativeHlsVideo) window.PoyTV?.hlsSetVolume?.(next);
                      const media = mediaElement();
                      if (media) media.volume = next;
                    }}
                    aria-label="Громкость"
                  />
                </div>
              </>
            ) : (
              <span className="transport-note">
                Управление — в официальном плеере {sourceLabel(track)}
              </span>
            )}
          </div>

          {mode === "text" && (
            <p className="muted small text-mode-hint">
              {directYouTubeAudio
                ? "Видео скрыто. Играет аудиодорожка YouTube, текст синхронизирован по времени."
                : isYouTube && youtubeAudioLoading
                  ? "Готовим аудиодорожку YouTube…"
                  : isYouTube && youtubeAudioError
                    ? `Не удалось получить аудио: ${youtubeAudioError}. Переключись на «С видео».`
                    : directVideo
                      ? "Видео скрыто. Играет минус, текст подсвечивается по времени."
                      : "Видео скрыто. Управление — иконкой видео справа сверху."}
            </p>
          )}

          {!isYouTube && !track.is_pack && (
            <div className="karaoke-tools">
              {track.source === "local" ? (
                standalone ? (
                  <button
                    className="primary-button"
                    onClick={() => onFindKaraoke?.(track)}
                    type="button"
                  >
                    <WandSparkles size={18} />
                    Найти минус
                  </button>
                ) : instrumentalUrl ? (
                  <div className="mode-switch" role="group" aria-label="Версия трека">
                    <button
                      className={!useInstrumental ? "active" : ""}
                      onClick={() => setUseInstrumental(false)}
                      type="button"
                    >
                      <Mic2 size={16} /> Оригинал
                    </button>
                    <button
                      className={useInstrumental ? "active" : ""}
                      onClick={() => setUseInstrumental(true)}
                      type="button"
                    >
                      <Sparkles size={16} /> Минус
                    </button>
                  </div>
                ) : (
                  <button className="primary-button" onClick={makeInstrumental} disabled={separating} type="button">
                    {separating ? <Loader2 className="spin" size={18} /> : <WandSparkles size={18} />}
                    {separating ? "Отделяем вокал…" : "Сделать минус"}
                  </button>
                )
              ) : track.is_instrumental && mode !== "text" ? (
                <span className="muted small">В этом треке уже есть минус.</span>
              ) : null}

              {job && job.status !== "done" && (
                <span className="job-note">
                  <Loader2 className="spin" size={14} />
                  {job.status === "queued" ? "В очереди…" : "Считаем UVR/Demucs… это может занять несколько минут"}
                </span>
              )}
              {separateError && <span className="form-error">{separateError}</span>}
              {track.source === "local" && standalone && (
                <span className="muted small">
                  Найдём караоке-версию этой песни на YouTube или RuTube — она уже с минусом.
                </span>
              )}
              {track.source === "local" && !standalone && !instrumentalUrl && !separating && !separateError && (
                <span className="muted small">Вокал убирается локально на сервере — без сторонних API.</span>
              )}
            </div>
          )}

          {isYouTube && mode !== "text" && nativeTvYouTube && (
            <p className="muted small stage-hint">
              Видео играет в YouTube TV. Караоке-версия уже содержит минус.
            </p>
          )}
          {isYouTube && mode !== "text" && !nativeTvYouTube && (
            <p className="muted small stage-hint">
              Видео играет в YouTube. Для синхронного текста включи «Только текст».
            </p>
          )}
          {isEmbeddedVideo && !directVideo && mode !== "text" && (
            <p className="muted small stage-hint">
              {isRuTube ? "RuTube" : "VK Video"} не отдаёт время плеера — текст показан без
              подсветки строк. Минус уже в видео.
            </p>
          )}
        </section>

        <aside className="song-lyrics">
          <LyricsView
            lyrics={lyrics}
            loading={lyricsLoading}
            error={lyricsError}
            currentTime={currentTime}
            syncAvailable={syncAvailable}
            offsetSeconds={lyricsOffset}
            rate={lyricsRate}
          />
        </aside>
      </main>
    </div>
  );
}
