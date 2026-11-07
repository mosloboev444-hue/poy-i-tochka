/// <reference types="vite/client" />

interface Window {
  PoyTV?: {
    playYouTube: (videoId: string) => void;
    setResultsOpen?: (open: boolean) => void;
    onMainMenuReady?: () => void;
    isTvDevice?: () => boolean;
    hlsLoad?: (url: string) => void;
    hlsPlay?: () => void;
    hlsPause?: () => void;
    hlsSeek?: (seconds: number) => void;
    hlsSetVolume?: (value: number) => void;
    hlsSetSpeed?: (value: number) => void;
    hlsSetPitch?: (value: number) => void;
    hlsStop?: () => void;
    importCatalogPack?: () => void;
    importCatalogPackUrl?: (url: string) => void;
  };
  closePoyResults?: () => void;
  poyHandleBack?: () => boolean;
  poyCatalogUpdated?: () => void;
  poyCatalogError?: (message: string) => void;
  poyHlsTime?: (value: number) => void;
  poyHlsDuration?: (value: number) => void;
  poyHlsState?: (playing: boolean) => void;
  poyHlsError?: (message: string) => void;
  poyHlsEnded?: () => void;
}
