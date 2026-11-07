import {
  BarChart3,
  Clock3,
  Heart,
  Home,
  LibraryBig,
  ListMusic,
  Mic2,
  MoreHorizontal,
  Music2,
  Trophy,
  Upload
} from "lucide-react";
import { useState } from "react";
import type { View } from "../types";

type Props = {
  view: View;
  onSelect: (view: View) => void;
};

const ITEMS: { id: View; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Главная", icon: Home },
  { id: "search", label: "Каталог", icon: Music2 },
  { id: "library", label: "Библиотека", icon: LibraryBig },
  { id: "favorites", label: "Избранное", icon: Heart },
  { id: "history", label: "История", icon: Clock3 },
  { id: "queue", label: "Очередь", icon: ListMusic },
  { id: "rating", label: "Рейтинг", icon: BarChart3 },
  { id: "achievements", label: "Достижения", icon: Trophy },
  { id: "import", label: "Импорт", icon: Upload }
];

export default function Sidebar({ view, onSelect }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = ITEMS.slice(5);
  const moreActive = moreItems.some((item) => item.id === view);

  function select(next: View) {
    setMoreOpen(false);
    onSelect(next);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo.png" alt="" />
        <div>
          <strong className="sidebar-wordmark" aria-label="Пой и Точка">
            <span className="sw-poy">Пой</span>
            <span className="sw-and">и</span>
            <span className="sw-tochka">Точка</span>
          </strong>
          <span className="sidebar-tagline">караоке</span>
        </div>
      </div>

      <nav className="side-nav">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => select(item.id)}
              type="button"
            >
              <Icon size={21} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          className={`nav-more ${moreActive ? "active" : ""}`}
          onClick={() => setMoreOpen((open) => !open)}
          type="button"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal size={21} />
          <span>Ещё</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more-sheet" onClick={(event) => event.stopPropagation()}>
            <span className="mobile-more-title">Ещё</span>
            <div className="mobile-more-grid">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={view === item.id ? "active" : ""}
                    onClick={() => select(item.id)}
                    type="button"
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-foot">
        <span className="sidebar-mic">
          <Mic2 size={18} />
        </span>
        <span>Android TV</span>
      </div>
    </aside>
  );
}
