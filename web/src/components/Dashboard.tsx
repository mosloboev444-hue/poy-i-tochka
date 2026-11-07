import { ChevronRight, Heart, ListMusic, Mic2, Music2, Play, Sparkles, Trophy } from "lucide-react";
import type { Track } from "../types";

type Props = {
  favoritesCount: number;
  history: Track[];
  onSing: () => void;
  onNavigate: (view: "search" | "favorites" | "history") => void;
  onAllKaraoke: () => void;
  onSearch: (query: string) => void;
  onOpenTrack: (track: Track) => void;
};

const POPULAR = [
  {
    title: "Лесник",
    artist: "Король и Шут",
    query: "Лесник Король и Шут караоке",
    cover: "linear-gradient(145deg, #4c1d95, #172554 70%, #0f172a)",
    glyph: "🌲"
  },
  {
    title: "Пачка сигарет",
    artist: "Кино",
    query: "Пачка сигарет Кино караоке",
    cover: "linear-gradient(145deg, #1d4ed8, #0f172a 70%, #020617)",
    glyph: "🚬"
  },
  {
    title: "Давай за...",
    artist: "Любэ",
    query: "Давай за Любэ караоке",
    cover: "linear-gradient(145deg, #9f1239, #431407 70%, #1c1917)",
    glyph: "🔥"
  },
  {
    title: "Владивосток 2000",
    artist: "Мумий Тролль",
    query: "Владивосток 2000 Мумий Тролль караоке",
    cover: "linear-gradient(145deg, #0e7490, #0f172a 70%, #020617)",
    glyph: "🌊"
  }
];

export default function Dashboard({
  favoritesCount,
  history,
  onSing,
  onNavigate,
  onAllKaraoke,
  onSearch,
  onOpenTrack
}: Props) {
  const isTv = typeof window !== "undefined" ? window.PoyTV?.isTvDevice?.() ?? true : true;

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero-inner">
          <img className="dashboard-logo" src="/logo.png" alt="Пой и Точка" />
          <div className="dashboard-hero-copy">
            <span className="eyebrow hero-eyebrow">
              <Sparkles size={14} /> КАРАОКЕ НА {isTv ? "ANDROID TV" : "ANDROID"}
            </span>
            <div className="dashboard-wordmark-wrap">
              <div className="marquee-lamps" aria-hidden>
                {Array.from({ length: 11 }).map((_, index) => (
                  <span key={index} style={{ animationDelay: `${(index % 7) * 0.17}s` }} />
                ))}
              </div>
              <h1 className="dashboard-wordmark" aria-label="Пой и Точка">
                <span className="dw-poy">Пой</span>
                <span className="dw-and">и</span>
                <span className="dw-tochka">Точка</span>
              </h1>
            </div>
            <p>Найди песню, включи минус и пой — текст уже готов.</p>
            <button className="sing-now" onClick={onSing} type="button">
              <Mic2 size={26} />
              <span>Спеть сейчас</span>
              <Play size={22} fill="currentColor" />
            </button>
          </div>
        </div>
      </section>

      <section className="quick-grid">
        <button className="quick-card quick-blue" onClick={() => onNavigate("search")} type="button">
          <Music2 size={34} />
          <strong>Выбрать песню</strong>
          <span>YouTube · RuTube</span>
          <ChevronRight className="quick-arrow" size={22} />
        </button>
        <button className="quick-card quick-orange" onClick={() => onNavigate("favorites")} type="button">
          <Heart size={34} />
          <strong>Избранные песни</strong>
          <span>{favoritesCount > 0 ? `Сохранено: ${favoritesCount}` : "Пока пусто — добавь сердцем"}</span>
          <ChevronRight className="quick-arrow" size={22} />
        </button>
        <button className="quick-card quick-purple" onClick={onAllKaraoke} type="button">
          <ListMusic size={34} />
          <strong>Всё караоке</strong>
          <span>Русские и иностранные списком</span>
          <ChevronRight className="quick-arrow" size={22} />
        </button>
        <button
          className="quick-card quick-green"
          onClick={() => onSearch("лучшие караоке хиты")}
          type="button"
        >
          <Trophy size={34} />
          <strong>Топ песен</strong>
          <span>Хиты, которые поют чаще всего</span>
          <ChevronRight className="quick-arrow" size={22} />
        </button>
      </section>

      <section className="popular-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">ПОПУЛЯРНЫЕ ПЕСНИ</span>
            <h2>С чего начать вечер</h2>
          </div>
          <button className="text-link" onClick={() => onNavigate("search")} type="button">
            Все песни <ChevronRight size={16} />
          </button>
        </div>
        <div className="popular-grid">
          {POPULAR.map((item) => (
            <button
              className="popular-card"
              key={item.title}
              onClick={() => onSearch(item.query)}
              type="button"
            >
              <div className="popular-cover" style={{ background: item.cover }}>
                <span className="popular-glyph">{item.glyph}</span>
                <span className="popular-play">
                  <Play size={18} fill="currentColor" />
                </span>
              </div>
              <strong>{item.title}</strong>
              <span>{item.artist}</span>
            </button>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="popular-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">НЕДАВНО</span>
              <h2>Продолжить петь</h2>
            </div>
            <button className="text-link" onClick={() => onNavigate("history")} type="button">
              История <ChevronRight size={16} />
            </button>
          </div>
          <div className="recent-row">
            {history.slice(0, 5).map((track) => (
              <button className="recent-card" key={track.id} onClick={() => onOpenTrack(track)} type="button">
                {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <span className="recent-fallback"><Music2 size={22} /></span>}
                <span>
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
