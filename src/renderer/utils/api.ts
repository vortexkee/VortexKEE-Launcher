import type {
  DownloadFileStatus,
  DownloadPhase,
  GameLifecycleState,
  LauncherAPI,
} from '../../shared/types';

export function getElectronAPI(): LauncherAPI | null {
  if (typeof window === 'undefined') return null;
  return window.electronAPI ?? window.launcherAPI ?? null;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function formatDownloadCount(count: number): string {
  if (!count || count < 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function formatPhaseLabel(phase: DownloadPhase): string {
  switch (phase) {
    case 'java':
      return 'Java Runtime';
    case 'metadata':
      return 'Sürüm Manifesti';
    case 'client':
      return 'Minecraft İstemci';
    case 'libraries':
      return 'Kütüphaneler';
    case 'natives':
      return 'Native Kütüphaneler';
    case 'assets':
      return 'Oyun Varlıkları';
    case 'mods':
      return 'Mod İndirme';
    default:
      return phase;
  }
}

export function formatDownloadStatus(status?: DownloadFileStatus): string {
  switch (status) {
    case 'verifying':
      return 'SHA Doğrulanıyor';
    case 'downloading':
      return 'İndiriliyor';
    case 'cached':
      return 'Önbellekten Doğrulandı';
    case 'extracting':
      return 'Arşiv Çıkarılıyor';
    case 'completed':
      return 'Tamamlandı';
    case 'error':
      return 'Hata';
    default:
      return 'Hazırlanıyor';
  }
}

export function formatGameStateLabel(state: GameLifecycleState): string {
  switch (state) {
    case 'idle':
      return 'Hazır';
    case 'preparing':
      return 'Hazırlanıyor';
    case 'downloading':
      return 'İndiriliyor';
    case 'launching':
      return 'Başlatılıyor';
    case 'running':
      return 'Çalışıyor';
    case 'crashed':
      return 'Hata ile Kapandı';
    case 'stopped':
      return 'Durduruldu';
    default:
      return state;
  }
}
