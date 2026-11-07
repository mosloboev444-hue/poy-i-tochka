import { FormEvent, useEffect, useRef, useState } from "react";
import { Link2, Loader2, X } from "lucide-react";
import { resolveLink } from "../api";
import type { Track } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenTrack: (track: Track) => void;
};

export default function LinkOpen({ open, onClose, onOpenTrack }: Props) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const url = value.trim();
    if (!url || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resolveLink(url);
      onClose();
      onOpenTrack(data.track);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось открыть ссылку");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="link-overlay" onClick={onClose}>
      <form className="link-panel" onSubmit={(event) => void submit(event)} onClick={(event) => event.stopPropagation()}>
        <header className="link-head">
          <span className="link-icon"><Link2 size={20} /></span>
          <div>
            <strong>Открыть по ссылке</strong>
            <span>YouTube, RuTube или VK Видео</span>
          </div>
          <button className="link-close" onClick={onClose} type="button" aria-label="Закрыть">
            <X size={19} />
          </button>
        </header>

        <input
          ref={inputRef}
          className="link-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://youtu.be/… или https://rutube.ru/video/…"
          inputMode="url"
        />
        <p className="link-help">
          Вставь ссылку на ролик. Для VK видео должно быть доступно без входа в аккаунт.
        </p>
        {error && <p className="form-error">{error}</p>}

        <button className="primary-button link-submit" disabled={loading || !value.trim()} type="submit">
          {loading ? <Loader2 className="spin" size={17} /> : <Link2 size={17} />}
          {loading ? "Открываем…" : "Открыть"}
        </button>
      </form>
    </div>
  );
}
