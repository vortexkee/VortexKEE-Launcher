import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  FileArchive,
  FolderOpen,
  Loader2,
  PackageCheck,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  InstalledModItem,
  MinecraftProfile,
  ModInstallProgressPayload,
  ModLoaderType,
  ModrinthSearchHit,
  ModSortIndex,
} from '../../shared/types';
import { formatBytes, formatDownloadCount, getElectronAPI } from '../utils/api';

type ModsSubTab = 'discover' | 'installed';

interface ModsViewProps {
  selectedProfile: MinecraftProfile | null;
  modInstallProgress: ModInstallProgressPayload | null;
  onError: (message: string | null) => void;
}

const LOADER_OPTIONS: Array<{ id: ModLoaderType; label: string }> = [
  { id: 'fabric', label: 'Fabric' },
  { id: 'forge', label: 'Forge' },
  { id: 'neoforge', label: 'NeoForge' },
];

const SORT_OPTIONS: Array<{ id: ModSortIndex; label: string }> = [
  { id: 'downloads', label: 'Popüler' },
  { id: 'relevance', label: 'Alakalı' },
  { id: 'updated', label: 'Güncel' },
  { id: 'follows', label: 'Takipçi' },
];

export const ModsView: React.FC<ModsViewProps> = ({
  selectedProfile,
  modInstallProgress,
  onError,
}) => {
  const [subTab, setSubTab] = useState<ModsSubTab>('discover');
  const [loaderFilter, setLoaderFilter] = useState<ModLoaderType>('fabric');
  const [sortIndex, setSortIndex] = useState<ModSortIndex>('downloads');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [hits, setHits] = useState<ModrinthSearchHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [installedMods, setInstalledMods] = useState<InstalledModItem[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [localFilter, setLocalFilter] = useState('');
  const [installingIds, setInstallingIds] = useState<Record<string, boolean>>({});
  const [togglingFile, setTogglingFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const profileId = selectedProfile?.id ?? '';
  const gameVersion = selectedProfile?.gameVersion ?? '1.21.4';

  // Sync default loader filter when user switches between vanilla and fabric profiles
  useEffect(() => {
    if (selectedProfile?.loaderType === 'fabric') {
      setLoaderFilter('fabric');
    }
  }, [selectedProfile?.id, selectedProfile?.loaderType]);

  // Debounce Modrinth search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadInstalledMods = useCallback(async () => {
    const api = getElectronAPI();
    if (!api || !profileId) return;
    setLoadingInstalled(true);
    try {
      const list = await api.listInstalledMods(profileId);
      setInstalledMods(list);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInstalled(false);
    }
  }, [profileId, onError]);

  useEffect(() => {
    void loadInstalledMods();
  }, [loadInstalledMods]);

  const runSearch = useCallback(
    async (offset: number, append: boolean) => {
      const api = getElectronAPI();
      if (!api) return;
      if (append) setLoadingMore(true);
      else setSearching(true);
      try {
        const res = await api.searchMods({
          query: debouncedQuery,
          gameVersion,
          loader: loaderFilter,
          index: sortIndex,
          limit: 20,
          offset,
        });
        setHits((prev) => (append ? [...prev, ...res.hits] : res.hits));
        setTotalHits(res.totalHits);
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setSearching(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, gameVersion, loaderFilter, sortIndex, onError],
  );

  useEffect(() => {
    void runSearch(0, false);
  }, [runSearch]);

  const installedProjectIds = useMemo(
    () =>
      new Set(
        installedMods
          .map((item) => item.projectId)
          .filter((id): id is string => Boolean(id)),
      ),
    [installedMods],
  );

  const filteredLocalMods = useMemo(() => {
    const q = localFilter.trim().toLowerCase();
    if (!q) return installedMods;
    return installedMods.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.fileName.toLowerCase().includes(q),
    );
  }, [installedMods, localFilter]);

  const enabledCount = useMemo(
    () => installedMods.filter((m) => m.enabled).length,
    [installedMods],
  );

  const handleInstallMod = async (hit: ModrinthSearchHit) => {
    const api = getElectronAPI();
    if (!api || !profileId) return;

    onError(null);
    setStatusNotice(null);
    setInstallingIds((prev) => ({ ...prev, [hit.projectId]: true }));
    try {
      const result = await api.installMod({
        profileId,
        projectId: hit.projectId,
        title: hit.title,
        iconUrl: hit.iconUrl,
        gameVersion,
        loader: loaderFilter,
      });
      setInstalledMods(result.mods);
      if (result.installedDependencies.length > 0) {
        setStatusNotice(
          `${hit.title} ve zorunlu bağımlılıklar (${result.installedDependencies.join(', ')}) kuruldu.`,
        );
      } else if (result.installedFiles.length > 0) {
        setStatusNotice(`${hit.title} başarıyla mods klasörüne kuruldu.`);
      } else {
        setStatusNotice(`${hit.title} zaten kurulu.`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstallingIds((prev) => ({ ...prev, [hit.projectId]: false }));
    }
  };

  const handleToggleMod = async (mod: InstalledModItem) => {
    const api = getElectronAPI();
    if (!api || !profileId) return;
    setTogglingFile(mod.fileName);
    try {
      const updated = await api.toggleMod(profileId, mod.fileName, !mod.enabled);
      setInstalledMods(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setTogglingFile(null);
    }
  };

  const handleDeleteMod = async (mod: InstalledModItem) => {
    const api = getElectronAPI();
    if (!api || !profileId) return;
    setDeletingFile(mod.fileName);
    try {
      const updated = await api.deleteMod(profileId, mod.fileName);
      setInstalledMods(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingFile(null);
    }
  };

  const handlePickFiles = async () => {
    const api = getElectronAPI();
    if (!api || !profileId) return;
    onError(null);
    try {
      const result = await api.pickAndImportMods(profileId);
      setInstalledMods(result.mods);
      if (result.imported.length > 0) {
        setStatusNotice(`${result.imported.length} mod dosyası eklendi.`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenModsFolder = async () => {
    const api = getElectronAPI();
    if (!api || !profileId) return;
    try {
      await api.openModsDirectory(profileId);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDropFiles = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);

    const api = getElectronAPI();
    if (!api || !profileId) return;

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length === 0) return;

    onError(null);
    const nativePaths: string[] = [];
    const fallbackFiles: File[] = [];

    for (const file of droppedFiles) {
      const resolvedPath = api.getPathForFile(file);
      if (resolvedPath) {
        nativePaths.push(resolvedPath);
      } else {
        fallbackFiles.push(file);
      }
    }

    let importedCount = 0;
    let skippedCount = 0;

    try {
      if (nativePaths.length > 0) {
        const res = await api.importModFiles(profileId, nativePaths);
        importedCount += res.imported.length;
        skippedCount += res.skipped.length;
        setInstalledMods(res.mods);
      }

      for (const file of fallbackFiles) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const res = await api.importModBuffer(profileId, file.name, buffer);
        importedCount += res.imported.length;
        skippedCount += res.skipped.length;
        setInstalledMods(res.mods);
      }

      if (importedCount > 0) {
        setStatusNotice(
          `${importedCount} .jar mod dosyası yüklü modlara eklendi${
            skippedCount > 0 ? ` (${skippedCount} geçersiz dosya atlandı)` : ''
          }.`,
        );
      } else if (skippedCount > 0) {
        onError('Yalnızca .jar uzantılı mod dosyaları eklenebilir.');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!selectedProfile) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-xs text-ink-muted">
        Modları yönetmek için önce bir profil seçin.
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col p-6 gap-4 overflow-hidden relative"
      onDragOver={(e) => {
        if (subTab === 'installed') {
          e.preventDefault();
          e.stopPropagation();
          if (!isDraggingOver) setIsDraggingOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (subTab === 'installed' && e.currentTarget === e.target) {
          setIsDraggingOver(false);
        }
      }}
      onDrop={(e) => {
        if (subTab === 'installed') {
          void handleDropFiles(e);
        }
      }}
    >
      {/* Header & Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-accent" />
            <span>Modlar</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface-panel border border-edge text-ink-secondary">
              {selectedProfile.name} · MC {gameVersion}
            </span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Modrinth üzerinden uyumlu modları tek tıkla kurun veya yerel <code className="font-mono text-accent">mods/</code> klasörünü yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tab switcher */}
          <div className="flex items-center bg-surface-panel border border-edge rounded-xl p-1">
            <button
              type="button"
              onClick={() => setSubTab('discover')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                subTab === 'discover'
                  ? 'bg-accent text-accent-fg'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mod Keşfet (Modrinth)</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('installed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                subTab === 'installed'
                  ? 'bg-accent text-accent-fg'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover/60'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Yüklü Modlar ({installedMods.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleOpenModsFolder()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-surface-panel hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-accent" />
            <span>Mod Klasörünü Aç</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {statusNotice && (
        <div className="shrink-0 px-3.5 py-2 rounded-xl bg-accent/12 border border-accent/40 text-xs text-ink-primary flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-[11px] text-ink-muted hover:text-ink-primary"
          >
            Gizle
          </button>
        </div>
      )}

      {/* Sub-Tab 1: Modrinth Discovery */}
      {subTab === 'discover' && (
        <div className="flex-1 min-h-0 flex flex-col gap-3.5 overflow-hidden">
          {/* Search + Loader + Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Modrinth'te mod ara (ör. Sodium, Iris, JEI, Lithium)..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-surface-panel border border-edge text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            {/* Loader Pills */}
            <div className="flex items-center bg-surface-panel border border-edge rounded-xl p-1">
              {LOADER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLoaderFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    loaderFilter === opt.id
                      ? 'bg-accent/15 text-accent border border-accent/40'
                      : 'text-ink-muted hover:text-ink-primary border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort Select */}
            <select
              value={sortIndex}
              onChange={(e) => setSortIndex(e.target.value as ModSortIndex)}
              aria-label="Sıralama ölçütü"
              className="px-3 py-2 rounded-xl bg-surface-panel border border-edge text-xs text-ink-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-surface-panel">
                  Sırala: {opt.label}
                </option>
              ))}
            </select>
          </div>

          {selectedProfile.loaderType === 'vanilla' && (
            <div className="shrink-0 px-3.5 py-2 rounded-xl bg-surface-panel border border-edge text-[11px] text-ink-secondary">
              Aktif profil <strong>Vanilla</strong> olarak ayarlı. Modların oyun içinde çalışması için{' '}
              <strong>Sürümler</strong> sekmesinden profil yükleyicisini <strong>Fabric</strong> olarak değiştirebilirsiniz.
            </div>
          )}

          {/* Live Search Results */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
            {searching ? (
              <div className="h-48 flex items-center justify-center gap-2 text-xs text-ink-muted">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span>Modrinth modları yükleniyor ({gameVersion} · {loaderFilter})...</span>
              </div>
            ) : hits.length === 0 ? (
              <div className="h-48 rounded-2xl bg-surface-panel border border-edge flex flex-col items-center justify-center gap-2 text-ink-muted">
                <Puzzle className="w-7 h-7 opacity-40" />
                <p className="text-xs">
                  {gameVersion} / {loaderFilter} için eşleşen mod bulunamadı.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {hits.map((hit) => {
                    const isInstalled = installedProjectIds.has(hit.projectId);
                    const isInstalling = Boolean(installingIds[hit.projectId]);
                    const activeProgress =
                      modInstallProgress &&
                      modInstallProgress.projectId === hit.projectId &&
                      modInstallProgress.profileId === profileId &&
                      isInstalling
                        ? modInstallProgress
                        : null;

                    return (
                      <article
                        key={hit.projectId}
                        className="rounded-2xl bg-surface-panel border border-edge hover:border-edge-strong p-4 flex items-start gap-3.5 transition-colors"
                      >
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-edge overflow-hidden shrink-0 flex items-center justify-center">
                          {hit.iconUrl ? (
                            <img
                              src={hit.iconUrl}
                              alt={hit.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Puzzle className="w-5 h-5 text-accent" />
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-ink-primary truncate">
                                {hit.title}
                              </h3>
                              <div className="text-[11px] text-ink-muted flex items-center gap-2">
                                <span>{hit.author}</span>
                                <span>·</span>
                                <span className="font-mono text-ink-secondary">
                                  {formatDownloadCount(hit.downloads)} indirme
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isInstalling || isInstalled}
                              onClick={() => void handleInstallMod(hit)}
                              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                                isInstalled
                                  ? 'bg-surface-elevated text-accent border border-accent/40 cursor-default'
                                  : isInstalling
                                  ? 'bg-accent/20 text-accent border border-accent/40'
                                  : 'bg-accent text-accent-fg hover:bg-accent-strong'
                              }`}
                            >
                              {isInstalling ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>
                                    {activeProgress?.status === 'installing-deps'
                                      ? `Bağımlılıklar %${activeProgress.percentage}`
                                      : activeProgress
                                      ? `%${activeProgress.percentage}`
                                      : 'Hazırlanıyor...'}
                                  </span>
                                </>
                              ) : isInstalled ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Kurulu</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Kur</span>
                                </>
                              )}
                            </button>
                          </div>

                          <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
                            {hit.description}
                          </p>

                          {hit.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {hit.categories.slice(0, 4).map((cat) => (
                                <span
                                  key={`${hit.projectId}-${cat}`}
                                  className="px-1.5 py-0.5 rounded-md text-[10px] bg-surface-elevated border border-edge text-ink-muted capitalize"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {hits.length < totalHits && (
                  <div className="pt-2 pb-1 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void runSearch(hits.length, true)}
                      className="px-4 py-2 rounded-xl bg-surface-panel hover:bg-surface-hover border border-edge text-xs font-medium text-ink-primary transition-colors inline-flex items-center gap-2"
                    >
                      {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
                      <span>
                        Daha Fazla Göster ({hits.length} / {totalHits})
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Installed Local Mods */}
      {subTab === 'installed' && (
        <div className="flex-1 min-h-0 flex flex-col gap-3.5 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localFilter}
                onChange={(e) => setLocalFilter(e.target.value)}
                placeholder="Yüklü modlarda filtrele..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-surface-panel border border-edge text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1.5 rounded-xl bg-surface-panel border border-edge text-[11px] text-ink-secondary font-mono">
                {enabledCount} aktif / {installedMods.length} toplam
              </span>
              <button
                type="button"
                onClick={() => void loadInstalledMods()}
                disabled={loadingInstalled}
                title="Mod listesini yenile"
                className="p-2 rounded-xl bg-surface-panel hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInstalled ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => void handlePickFiles()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent text-accent-fg hover:bg-accent-strong transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>.jar Ekle</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop Target Zone */}
          <div
            className={`shrink-0 rounded-2xl border-2 border-dashed p-3.5 flex items-center justify-between gap-3 transition-colors ${
              isDraggingOver
                ? 'border-accent bg-accent/15 text-ink-primary'
                : 'border-edge-strong/70 bg-surface-panel/60 text-ink-secondary'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-edge flex items-center justify-center text-accent shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-primary">
                  .jar Mod Dosyalarını Buraya Sürükleyip Bırakın
                </div>
                <div className="text-[11px] text-ink-muted">
                  Dışarıdan sürüklediğiniz modlar otomatik olarak <code className="font-mono text-accent">mods/</code> klasörüne kopyalanır.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handlePickFiles()}
              className="px-3 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-primary transition-colors shrink-0"
            >
              Dosya Seç
            </button>
          </div>

          {/* Installed Mods List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {filteredLocalMods.length === 0 ? (
              <div className="h-44 rounded-2xl bg-surface-panel border border-edge flex flex-col items-center justify-center gap-2 text-ink-muted">
                <FileArchive className="w-7 h-7 opacity-40" />
                <p className="text-xs">
                  {installedMods.length === 0
                    ? 'Bu profilde henüz yüklü mod yok. Mod Keşfet sekmesinden kurabilir veya .jar dosyası sürükleyebilirsiniz.'
                    : 'Arama filtresiyle eşleşen mod bulunamadı.'}
                </p>
              </div>
            ) : (
              filteredLocalMods.map((mod) => {
                const isBusy =
                  togglingFile === mod.fileName || deletingFile === mod.fileName;

                return (
                  <div
                    key={mod.fileName}
                    className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      mod.enabled
                        ? 'bg-surface-panel border-edge hover:border-edge-strong'
                        : 'bg-surface-panel/50 border-edge/60 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-edge overflow-hidden shrink-0 flex items-center justify-center">
                        {mod.iconUrl ? (
                          <img
                            src={mod.iconUrl}
                            alt={mod.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileArchive className="w-4 h-4 text-accent" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink-primary truncate">
                            {mod.displayName}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              mod.source === 'modrinth'
                                ? 'bg-accent/15 text-accent border-accent/35'
                                : 'bg-surface-elevated text-ink-muted border-edge'
                            }`}
                          >
                            {mod.source === 'modrinth' ? 'Modrinth' : 'Yerel'}
                          </span>
                          {mod.versionNumber && (
                            <span className="text-[10px] font-mono text-ink-muted">
                              v{mod.versionNumber}
                            </span>
                          )}
                          {!mod.enabled && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-crimson/15 text-crimson border border-crimson/30">
                              Pasif
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-ink-muted truncate mt-0.5">
                          {mod.fileName} · {formatBytes(mod.sizeBytes)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Enable / Disable Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={mod.enabled}
                        aria-label={`${mod.displayName} modunu ${mod.enabled ? 'kapat' : 'aç'}`}
                        disabled={isBusy}
                        onClick={() => void handleToggleMod(mod)}
                        className={`relative w-11 h-6 rounded-full border transition-colors ${
                          mod.enabled
                            ? 'bg-accent border-accent'
                            : 'bg-surface-elevated border-edge-strong'
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 rounded-full transition-transform ${
                            mod.enabled
                              ? 'translate-x-6 bg-accent-fg'
                              : 'translate-x-1 bg-ink-muted'
                          }`}
                        />
                      </button>

                      {/* Delete Mod Button */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDeleteMod(mod)}
                        title="Modu Sil"
                        aria-label={`${mod.displayName} modunu sil`}
                        className="p-2 rounded-xl text-ink-muted hover:text-crimson hover:bg-crimson/10 border border-transparent hover:border-crimson/35 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
