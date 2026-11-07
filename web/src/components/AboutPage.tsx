import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Database,
  LibraryBig,
  Scale,
  Server,
  ShieldCheck,
  Smartphone,
  Tv,
  Wrench
} from "lucide-react";
import { getHealth } from "../api";

type Props = {
  onBack: () => void;
};

export default function AboutPage({ onBack }: Props) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const version = typeof health?.version === "string" ? health.version : "0.2.0";
  const build = typeof health?.build === "number" ? health.build : 2;
  const catalogCount = typeof health?.catalog === "number" ? health.catalog : 0;
  const isTv = window.PoyTV?.isTvDevice?.() ?? true;

  return (
    <section className="content-page about-page">
      <button className="back-link" onClick={onBack} type="button">
        <ArrowLeft size={17} /> Назад в настройки
      </button>

      <div className="about-hero">
        <img src="/logo.png" alt="Пой и Точка" />
        <div>
          <span className="eyebrow">О ПРИЛОЖЕНИИ</span>
          <h1>Пой и Точка</h1>
          <p>
            Караоке для Android TV и телефона: поиск песен, синхронный текст,
            локальная библиотека и офлайн-пакеты.
          </p>
          <div className="about-badges">
            <span>Версия {version}</span>
            <span>Сборка {build}</span>
            <span>{isTv ? "Android TV" : "Android"}</span>
          </div>
        </div>
      </div>

      <div className="about-grid">
        <article className="about-card">
          <div className="about-card-head">
            <span className="about-icon about-icon-pink"><LibraryBig size={21} /></span>
            <div>
              <strong>Что умеет</strong>
              <span>основные возможности</span>
            </div>
          </div>
          <ul>
            <li>Поиск караоке в YouTube и RuTube.</li>
            <li>Тексты LRCLIB с подсветкой по времени.</li>
            <li>Режимы «С видео» и «Только текст».</li>
            <li>Локальная библиотека и ZIP-пакеты с аудио и LRC.</li>
            <li>Скорость, тональность и синхронизация текста.</li>
            <li>Открытие YouTube/RuTube/VK по ссылке.</li>
            <li>Встроенный VPN AmneziaWG.</li>
          </ul>
        </article>

        <article className="about-card">
          <div className="about-card-head">
            <span className="about-icon about-icon-cyan"><Database size={21} /></span>
            <div>
              <strong>Данные и приватность</strong>
              <span>что хранится на устройстве</span>
            </div>
          </div>
          <ul>
            <li>История, избранное, очередь и настройки — только на устройстве.</li>
            <li>Локальные пакеты лежат в памяти приложения, а не в облаке.</li>
            <li>Нет аккаунта, рекламы и аналитики.</li>
            <li>Запросы идут к YouTube, RuTube и LRCLIB только для поиска и текстов.</li>
            <li>VPN-конфиг хранится локально и не передаётся нам.</li>
            <li>Сейчас в локальной библиотеке: {catalogCount} треков.</li>
          </ul>
        </article>

        <article className="about-card">
          <div className="about-card-head">
            <span className="about-icon about-icon-violet"><Wrench size={21} /></span>
            <div>
              <strong>Технически</strong>
              <span>как это сделано</span>
            </div>
          </div>
          <ul>
            <li>Kotlin + WebView, интерфейс на React/TypeScript.</li>
            <li>Локальный сервер на 127.0.0.1:8787.</li>
            <li>Media3 ExoPlayer для RuTube HLS.</li>
            <li>NewPipeExtractor для поиска YouTube.</li>
            <li>Пакет: com.gathin.karaoke, minSdk 26.</li>
            <li>Сборки: arm64 для телефона, arm32 для TV.</li>
          </ul>
        </article>

        <article className="about-card">
          <div className="about-card-head">
            <span className="about-icon about-icon-gold"><Scale size={21} /></span>
            <div>
              <strong>Правовая информация</strong>
              <span>важно знать</span>
            </div>
          </div>
          <p className="about-legal">
            Приложение не содержит и не распространяет музыкальные произведения.
            Поиск и воспроизведение выполняются через сторонние сервисы, права на
            музыку и тексты принадлежат их правообладателям. Пользовательские
            ZIP-пакеты добавляются самим пользователем, и ответственность за их
            содержимое лежит на нём. YouTube, RuTube и VK — товарные знаки их
            владельцев.
          </p>
        </article>
      </div>

      <div className="about-footer-grid">
        <div className="about-note">
          <Server size={17} />
          <span>
            Локальный сервер:{" "}
            <strong>{health ? "подключён" : "нет связи"}</strong>. Порт 8787, только
            на этом устройстве.
          </span>
        </div>
        <div className="about-note">
          {isTv ? <Tv size={17} /> : <Smartphone size={17} />}
          <span>Один APK работает на телевизоре и телефоне, раскладка подстраивается.</span>
        </div>
        <div className="about-note">
          <ShieldCheck size={17} />
          <span>VPN нужен только для доступа к сервисам; локальная сеть не заворачивается.</span>
        </div>
      </div>

      <p className="about-components">
        Открытые компоненты: React, Vite, lucide-react, Kotlin, AndroidX/Media3,
        NewPipeExtractor, NanoHTTPD, AmneziaWG, LRCLIB. Спасибо их авторам.
      </p>
    </section>
  );
}
