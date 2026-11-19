import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { UpdaterStatusPayload } from '../../shared/types';

export class AutoUpdaterService {
  private initialized = false;

  public initialize(onStatus: (payload: UpdaterStatusPayload) => void): void {
    if (this.initialized) return;
    this.initialized = true;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      onStatus({
        state: 'checking',
        message: 'GitHub Releases üzerinden güncellemeler denetleniyor...',
      });
    });

    autoUpdater.on('update-available', (info) => {
      onStatus({
        state: 'available',
        version: info.version,
        message: `Yeni sürüm mevcut: v${info.version}`,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      onStatus({
        state: 'not-available',
        version: info.version,
        message: `Launcher güncel (v${info.version})`,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      onStatus({
        state: 'downloading',
        progress: Math.round(progress.percent),
        message: `Güncelleme indiriliyor: %${Math.round(progress.percent)}`,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      onStatus({
        state: 'downloaded',
        version: info.version,
        progress: 100,
        message: `v${info.version} indirildi. Kurmak için yeniden başlatabilirsiniz.`,
      });
    });

    autoUpdater.on('error', (err) => {
      onStatus({
        state: 'error',
        message: err?.message || 'Güncelleme denetimi sırasında hata oluştu.',
      });
    });
  }

  public async checkForUpdates(
    onStatus: (payload: UpdaterStatusPayload) => void,
  ): Promise<void> {
    if (!app.isPackaged) {
      onStatus({
        state: 'not-available',
        version: app.getVersion(),
        message: `Geliştirme modunda otomatik güncelleme devre dışı (v${app.getVersion()}).`,
      });
      return;
    }

    await autoUpdater.checkForUpdates();
  }

  public async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) return;
    await autoUpdater.downloadUpdate();
  }

  public installUpdate(): void {
    if (!app.isPackaged) return;
    autoUpdater.quitAndInstall(false, true);
  }
}
