import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubePromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubePromise) return youtubePromise;
  youtubePromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Не удалось загрузить YouTube API"));
    document.head.appendChild(script);
  });
  return youtubePromise;
}

type Props = {
  videoId: string;
  onTime: (time: number) => void;
  onDuration?: (duration: number) => void;
};

export default function YouTubePlayer({ videoId, onTime, onDuration }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const timeRef = useRef(onTime);
  const durationRef = useRef(onDuration);
  const [started, setStarted] = useState(false);
  timeRef.current = onTime;
  durationRef.current = onDuration;

  useEffect(() => {
    let cancelled = false;
    let player: any = null;
    const container = containerRef.current;
    if (!container) return;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        player = new YT.Player(containerRef.current, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              playerRef.current = event.target;
              durationRef.current?.(event.target.getDuration() || 0);
              try {
                event.target.playVideo();
              } catch {
                // autoplay can be blocked; the overlay button below requests a user gesture
              }
            },
            onStateChange: (event: any) => {
              if (event.data === 1) {
                setStarted(true);
                durationRef.current?.(event.target.getDuration() || 0);
              }
            }
          }
        });
      })
      .catch(() => {
        // The fallback link in the player header remains available.
      });

    const timer = window.setInterval(() => {
      if (player?.getCurrentTime) {
        timeRef.current(player.getCurrentTime() || 0);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      playerRef.current = null;
      if (player?.destroy) {
        try {
          player.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [videoId]);

  function startPlayback() {
    try {
      playerRef.current?.playVideo?.();
    } catch {
      // ignore
    }
    setStarted(true);
  }

  return (
    <div className="yt-wrap">
      <div className="yt-frame" ref={containerRef} />
      {!started && (
        <button className="yt-start" onClick={startPlayback} type="button">
          <span className="yt-start-orb">
            <Play size={28} fill="currentColor" />
          </span>
          <span>Включить видео</span>
        </button>
      )}
    </div>
  );
}
