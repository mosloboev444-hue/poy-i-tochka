import type { ReactNode } from "react";
import { ArrowLeft, Mic2, Music2 } from "lucide-react";

type Props = {
  onBack?: () => void;
  actions?: ReactNode;
};

export default function BrandHeader({ onBack, actions }: Props) {
  return (
    <header className="brand-header">
      <button className="brand-back" onClick={onBack} type="button">
        <ArrowLeft size={20} />
        <span>Назад</span>
      </button>

      <div className="brand-wordmark" aria-label="Пой и Точка">
        <Music2 className="brand-note brand-note-left" size={22} />
        <span className="brand-poy">Пой</span>
        <span className="brand-and">и</span>
        <span className="brand-tochka">Точка</span>
        <Mic2 className="brand-mic" size={26} />
        <Music2 className="brand-note brand-note-right" size={20} />
        <span className="brand-underline" aria-hidden />
      </div>

      <div className="brand-actions">{actions}</div>
    </header>
  );
}
