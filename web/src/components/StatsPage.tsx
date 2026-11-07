import { BarChart3, Clock3, Flame, Heart, Mic2, Star, Trophy } from "lucide-react";
import type { Track, View } from "../types";

type Props = {
  view: Extract<View, "rating" | "achievements">;
  history: Track[];
  favorites: Track[];
};

export default function StatsPage({ view, history, favorites }: Props) {
  const uniqueArtists = new Set(history.map((track) => track.artist).filter(Boolean)).size;
  const totalMinutes = Math.round(
    history.reduce((sum, track) => sum + (track.duration || 0), 0) / 60
  );

  if (view === "rating") {
    return (
      <div className="stats-page">
        <span className="eyebrow">РЕЙТИНГ</span>
        <h1>Твой караоке-путь</h1>
        <p className="muted">Пока без оценки вокала — сначала статистика и любимые песни.</p>

        <div className="stats-hero">
          <div>
            <span className="stats-number">{history.length}</span>
            <span className="muted">песен спето</span>
          </div>
          <div className="stats-badge">
            <Trophy size={34} />
            <span>Уровень {Math.max(1, Math.floor(history.length / 5) + 1)}</span>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <BarChart3 size={24} />
            <strong>{uniqueArtists}</strong>
            <span>исполнителей</span>
          </div>
          <div className="stat-card">
            <Clock3 size={24} />
            <strong>{totalMinutes}</strong>
            <span>минут караоке</span>
          </div>
          <div className="stat-card">
            <Heart size={24} />
            <strong>{favorites.length}</strong>
            <span>в избранном</span>
          </div>
        </div>

        <div className="panel-block">
          <div className="section-head">
            <div>
              <span className="eyebrow">ПОСЛЕДНИЕ</span>
              <h2>Что ты пел</h2>
            </div>
          </div>
          {history.length === 0 ? (
            <p className="muted">Спой первую песню — статистика появится здесь.</p>
          ) : (
            <div className="simple-list">
              {history.slice(0, 8).map((track, index) => (
                <div className="simple-row" key={`${track.id}-${index}`}>
                  <span className="simple-index">{index + 1}</span>
                  <span className="simple-title">{track.title}</span>
                  <span className="muted">{track.artist}</span>
                  <span className="muted">{Math.round((track.duration || 0) / 60)} мин</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const achievements = [
    { id: "first", title: "Первая нота", text: "Спой первую песню", done: history.length >= 1, icon: Mic2 },
    { id: "five", title: "Разогрев", text: "5 песен", done: history.length >= 5, icon: Flame },
    { id: "ten", title: "В ударе", text: "10 песен", done: history.length >= 10, icon: Star },
    { id: "artists", title: "Меломан", text: "3 разных исполнителя", done: uniqueArtists >= 3, icon: BarChart3 },
    { id: "hour", title: "Час на сцене", text: "60 минут караоке", done: totalMinutes >= 60, icon: Clock3 },
    { id: "favorites", title: "Коллекционер", text: "5 песен в избранном", done: favorites.length >= 5, icon: Heart }
  ];

  return (
    <div className="stats-page">
      <span className="eyebrow">ДОСТИЖЕНИЯ</span>
      <h1>Коллекция побед</h1>
      <p className="muted">Простые вехи, которые открываются по мере пения.</p>

      <div className="achievement-grid">
        {achievements.map((item) => {
          const Icon = item.icon;
          return (
            <div className={`achievement ${item.done ? "done" : "locked"}`} key={item.id}>
              <span className="achievement-icon">
                <Icon size={28} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
              <span className="achievement-state">{item.done ? "Открыто" : "Закрыто"}</span>
            </div>
          );
        })}
      </div>

      <div className="panel-block">
        <h2>Скоро</h2>
        <p className="muted">
          Оценка вокала, тональность и работа с микрофоном — следующий экран исполнения.
        </p>
      </div>
    </div>
  );
}
