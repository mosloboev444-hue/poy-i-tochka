import { FileAudio2, Heart, ListCheck, ListPlus, Music2, Play, Radio, Video, Youtube } from "lucide-react";
import type { Track } from "../types";
import { formatTime } from "../lrc";

type Props = {
  track: Track;
  onSelect: (track: Track) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (track: Track) => void;
  isQueued?: boolean;
  onToggleQueue?: (track: Track) => void;
};

function SourceIcon({ source }: { source: string }) {
  if (source === "youtube") return <Youtube size={14} />;
  if (source === "rutube") return <Radio size={14} />;
  if (source === "vk") return <Video size={14} />;
  if (source === "local") return <FileAudio2 size={14} />;
  return <Radio size={14} />;
}

export default function TrackCard({ track, onSelect, isFavorite, onToggleFavorite, isQueued, onToggleQueue }: Props) {
  const sourceLabel =
    track.source === "youtube"
      ? "YouTube"
      : track.source === "rutube"
        ? "RuTube"
        : track.source === "vk"
          ? "VK Video"
          : track.source === "jamendo"
          ? "Jamendo"
          : track.source === "audius"
            ? "Audius"
            : "Импорт";

  return (
    <div
      className="track-card"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(track)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(track);
        }
      }}
    >
      <div className="track-art">
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt=""
            loading="lazy"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="track-art-fallback">
            <Music2 size={42} />
          </div>
        )}
        <span className="play-orb">
          <Play size={20} fill="currentColor" />
        </span>
        <span className="duration-chip">{formatTime(track.duration)}</span>
        <div className="track-badges">
          {track.is_karaoke && <span className="badge badge-hot">КАРАОКЕ</span>}
          {!track.is_karaoke && track.is_instrumental && <span className="badge badge-hot">МИНУС</span>}
          {track.has_synced_lyrics && <span className="badge badge-cool">ТЕКСТ</span>}
        </div>
        {onToggleFavorite && (
          <button
            className={`favorite-btn ${isFavorite ? "active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(track);
            }}
            type="button"
            title={isFavorite ? "Убрать из избранного" : "В избранное"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        )}
        {onToggleQueue && (
          <button
            className={`queue-btn ${isQueued ? "active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleQueue(track);
            }}
            type="button"
            title={isQueued ? "Убрать из очереди" : "В очередь"}
          >
            {isQueued ? <ListCheck size={18} /> : <ListPlus size={18} />}
          </button>
        )}
      </div>
      <div className="track-meta">
        <div className="track-title">{track.title}</div>
        <div className="track-artist">{track.artist}</div>
        <div className="track-source">
          <SourceIcon source={track.source} />
          <span>{sourceLabel}</span>
          {track.is_instrumental && <span className="dot-sep">•</span>}
          {track.is_instrumental && <span>минус</span>}
        </div>
      </div>
    </div>
  );
}
