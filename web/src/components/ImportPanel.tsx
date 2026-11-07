import { useRef, useState } from "react";
import { FileAudio2, Loader2, UploadCloud } from "lucide-react";
import { importTrack } from "../api";
import type { Track } from "../types";

type Props = {
  onImported: (track: Track) => void;
};

const ACCEPT = ".mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,audio/*";

export default function ImportPanel({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const track = await importTrack(file);
      onImported(track);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось загрузить файл");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="import-card">
      <div className="import-head">
        <div>
          <span className="eyebrow">СВОЯ ФОНОТЕКА</span>
          <h2>Загрузи трек — сделаем минус</h2>
          <p className="muted">
            MP3, FLAC, WAV, M4A, OGG. Подтянем текст из LRCLIB и отделим вокал через UVR/Demucs.
          </p>
        </div>
        <FileAudio2 className="import-icon" size={42} />
      </div>

      <div
        className={`dropzone ${dragging ? "is-dragging" : ""} ${busy ? "is-busy" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void handleFile(event.dataTransfer.files?.[0]);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
      >
        {busy ? <Loader2 className="spin" size={38} /> : <UploadCloud size={38} />}
        <strong>{busy ? "Загружаем и ищем текст…" : "Перетащи аудио сюда"}</strong>
        <span className="muted">{busy ? "Это займёт пару секунд" : "или нажми, чтобы выбрать файл"}</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {error && <p className="form-error">{error}</p>}
      <p className="muted small">
        Файл остаётся на твоём сервере. Минус создаётся локально, без отправки в сторонние сервисы.
      </p>
    </section>
  );
}
