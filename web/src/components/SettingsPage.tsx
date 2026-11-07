import { ChevronRight, Info, MonitorPlay, Type, Video } from "lucide-react";
import type { PlayerMode } from "../types";

type Props = {
  playerMode: PlayerMode;
  onPlayerModeChange: (mode: PlayerMode) => void;
  onOpenAbout: () => void;
};

export default function SettingsPage({ playerMode, onPlayerModeChange, onOpenAbout }: Props) {
  return (
    <section className="content-page settings-page">
      <div className="page-heading search-heading">
        <span className="eyebrow">НАСТРОЙКИ</span>
        <h1>Настройки</h1>
        <p className="muted">YouTube и RuTube работают сразу.</p>
      </div>

      <div className="settings-card">
        <div className="settings-head">
          <span className="settings-icon settings-icon-violet">
            <MonitorPlay size={24} />
          </span>
          <div>
            <strong>Режим плеера</strong>
            <span className="settings-off">как открывать песню</span>
          </div>
          <button className="settings-about-inline" onClick={onOpenAbout} type="button">
            <Info size={16} />
            О приложении
            <ChevronRight size={15} />
          </button>
        </div>
        <p className="muted">Можно переключать и прямо на экране песни.</p>
        <div className="mode-choice-grid">
          <button
            className={`mode-choice ${playerMode === "video" ? "active" : ""}`}
            onClick={() => onPlayerModeChange("video")}
            type="button"
          >
            <Video size={24} />
            <strong>С видео</strong>
            <span>Караоке-видео и минус</span>
          </button>
          <button
            className={`mode-choice ${playerMode === "text" ? "active" : ""}`}
            onClick={() => onPlayerModeChange("text")}
            type="button"
          >
            <Type size={24} />
            <strong>Только текст</strong>
            <span>Крупный текст, видео скрыто</span>
          </button>
        </div>
      </div>
    </section>
  );
}
