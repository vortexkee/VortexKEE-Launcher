import React, { useEffect, useMemo, useState } from 'react';
import {
  FolderOpen,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import type {
  CreateProfileInput,
  FabricLoaderEntry,
  LoaderType,
  MinecraftProfile,
  SystemInfo,
  UpdateProfilePatch,
  VanillaVersionEntry,
} from '../../shared/types';

interface VersionsViewProps {
  systemInfo: SystemInfo | null;
  profiles: MinecraftProfile[];
  selectedProfile: MinecraftProfile | null;
  vanillaVersions: VanillaVersionEntry[];
  fabricLoaders: FabricLoaderEntry[];
  showSnapshots: boolean;
  onToggleSnapshots: (show: boolean) => void;
  onRefreshVersions: () => Promise<void>;
  onSelectProfile: (profileId: string) => void;
  onCreateProfile: (input: CreateProfileInput) => Promise<void>;
  onUpdateProfile: (id: string, patch: UpdateProfilePatch) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onSelectJavaBinary: () => Promise<string | null>;
  onOpenInstanceDir: (profileId: string) => void;
  onLoadFabricLoaders: (gameVersion: string) => Promise<void>;
}

export const VersionsView: React.FC<VersionsViewProps> = ({
  systemInfo,
  profiles,
  selectedProfile,
  vanillaVersions,
  fabricLoaders,
  showSnapshots,
  onToggleSnapshots,
  onRefreshVersions,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onSelectJavaBinary,
  onOpenInstanceDir,
  onLoadFabricLoaders,
}) => {
  const [draftName, setDraftName] = useState('');
  const [draftVersion, setDraftVersion] = useState('1.21.4');
  const [draftLoader, setDraftLoader] = useState<LoaderType>('vanilla');
  const [draftLoaderVersion, setDraftLoaderVersion] = useState('');
  const [draftMemoryGB, setDraftMemoryGB] = useState(4);
  const [draftWidth, setDraftWidth] = useState(1280);
  const [draftHeight, setDraftHeight] = useState(720);
  const [draftFullscreen, setDraftFullscreen] = useState(false);
  const [draftCustomJava, setDraftCustomJava] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const maxRamGB = useMemo(() => {
    const total = systemInfo?.totalMemoryGB ?? 8;
    return Math.max(2, Math.floor(total));
  }, [systemInfo]);

  const filteredVersions = useMemo(() => {
    if (showSnapshots) return vanillaVersions;
    return vanillaVersions.filter((v) => v.type === 'release');
  }, [vanillaVersions, showSnapshots]);

  useEffect(() => {
    if (!selectedProfile) return;
    setDraftName(selectedProfile.name);
    setDraftVersion(selectedProfile.gameVersion);
    setDraftLoader(selectedProfile.loaderType);
    setDraftLoaderVersion(selectedProfile.loaderVersion ?? '');
    setDraftMemoryGB(selectedProfile.memoryGB);
    setDraftWidth(selectedProfile.resolution.width);
    setDraftHeight(selectedProfile.resolution.height);
    setDraftFullscreen(selectedProfile.resolution.fullscreen);
    setDraftCustomJava(selectedProfile.customJavaPath ?? '');
    setSavedNotice(false);
  }, [selectedProfile]);

  useEffect(() => {
    if (draftLoader === 'fabric' && draftVersion) {
      void onLoadFabricLoaders(draftVersion);
    }
  }, [draftLoader, draftVersion, onLoadFabricLoaders]);

  const handleSave = async () => {
    if (!selectedProfile) return;
    setSaving(true);
    try {
      await onUpdateProfile(selectedProfile.id, {
        name: draftName.trim() || selectedProfile.name,
        gameVersion: draftVersion,
        loaderType: draftLoader,
        loaderVersion: draftLoader === 'fabric' ? draftLoaderVersion || undefined : undefined,
        memoryGB: draftMemoryGB,
        resolution: {
          width: draftWidth,
          height: draftHeight,
          fullscreen: draftFullscreen,
        },
        customJavaPath: draftCustomJava.trim() || undefined,
      });
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    const latestRelease =
      vanillaVersions.find((v) => v.type === 'release')?.id ?? '1.21.4';
    await onCreateProfile({
      name: `Yeni Profil ${profiles.length + 1}`,
      gameVersion: latestRelease,
      loaderType: 'vanilla',
      memoryGB: systemInfo?.recommendedMemoryGB ?? 4,
      resolution: { width: 1280, height: 720, fullscreen: false },
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshVersions();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePickJava = async () => {
    const picked = await onSelectJavaBinary();
    if (picked) setDraftCustomJava(picked);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <span>Sürümler &amp; Profiller</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Vanilla ve Fabric kurulum profillerinizi yönetin; her profil izole oyun klasöründe çalışır.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-surface-panel hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sürümleri Yenile</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCreateNew()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent text-accent-fg hover:bg-accent-strong transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Profil</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Profile List */}
        <div className="lg:col-span-4 space-y-2">
          {profiles.map((profile) => {
            const isSelected = selectedProfile?.id === profile.id;
            return (
              <div
                key={profile.id}
                className={`rounded-2xl border p-3.5 transition-all flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-surface-panel border-accent shadow-md'
                    : 'bg-surface-panel/65 border-edge hover:border-edge-strong hover:bg-surface-panel'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectProfile(profile.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-primary truncate">
                      {profile.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        profile.loaderType === 'fabric'
                          ? 'bg-accent/15 text-accent border border-accent/35'
                          : 'bg-surface-elevated text-ink-secondary border border-edge'
                      }`}
                    >
                      {profile.loaderType}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted mt-1">
                    MC {profile.gameVersion} · {profile.memoryGB} GB RAM
                  </div>
                </button>

                {profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void onDeleteProfile(profile.id)}
                    title="Profili Sil"
                    className="p-1.5 rounded-lg text-ink-muted hover:text-crimson hover:bg-crimson/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Profile Editor */}
        {selectedProfile && (
          <div className="lg:col-span-8 rounded-2xl bg-surface-panel border border-edge p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-edge">
              <div>
                <h3 className="text-base font-semibold text-ink-primary">
                  {selectedProfile.name}
                </h3>
                <p className="text-[11px] font-mono text-ink-muted">ID: {selectedProfile.id}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenInstanceDir(selectedProfile.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-elevated hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-accent" />
                <span>Profil Klasörünü Aç</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-secondary">Profil Adı</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-base border border-edge text-xs text-ink-primary focus:outline-none focus:border-accent"
                />
              </div>

              {/* Loader */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-secondary">Mod Yükleyici</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['vanilla', 'fabric'] as LoaderType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDraftLoader(type)}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${
                        draftLoader === type
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'bg-surface-base border-edge text-ink-secondary hover:bg-surface-hover'
                      }`}
                    >
                      {type === 'vanilla' ? 'Vanilla' : 'Fabric'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minecraft Version */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-ink-secondary">
                    Minecraft Sürümü
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSnapshots}
                      onChange={(e) => onToggleSnapshots(e.target.checked)}
                      className="accent-[rgb(var(--accent))]"
                    />
                    <span>Snapshot</span>
                  </label>
                </div>
                <select
                  value={draftVersion}
                  onChange={(e) => setDraftVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-base border border-edge text-xs text-ink-primary focus:outline-none focus:border-accent"
                >
                  {!filteredVersions.some((v) => v.id === draftVersion) && (
                    <option value={draftVersion}>{draftVersion}</option>
                  )}
                  {filteredVersions.map((v) => (
                    <option key={v.id} value={v.id} className="bg-surface-panel">
                      {v.id} {v.type !== 'release' ? `(${v.type})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fabric Loader Version */}
              {draftLoader === 'fabric' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-secondary">
                    Fabric Loader Sürümü
                  </label>
                  <select
                    value={draftLoaderVersion}
                    onChange={(e) => setDraftLoaderVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-base border border-edge text-xs text-ink-primary focus:outline-none focus:border-accent"
                  >
                    <option value="">Otomatik (En Yeni Kararlı)</option>
                    {fabricLoaders.map((item) => (
                      <option key={item.version} value={item.version} className="bg-surface-panel">
                        {item.version} {item.stable ? '(Kararlı)' : '(Beta)'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-secondary">
                    Profil RAM ({draftMemoryGB} GB)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={maxRamGB}
                    step={0.5}
                    value={Math.min(draftMemoryGB, maxRamGB)}
                    onChange={(e) => setDraftMemoryGB(Number(e.target.value))}
                    className="vortex-slider w-full mt-2"
                  />
                </div>
              )}
            </div>

            {draftLoader === 'fabric' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-secondary">
                  Profil RAM Tahsisi: <strong className="text-accent">{draftMemoryGB} GB</strong> /{' '}
                  {maxRamGB} GB
                </label>
                <input
                  type="range"
                  min={1}
                  max={maxRamGB}
                  step={0.5}
                  value={Math.min(draftMemoryGB, maxRamGB)}
                  onChange={(e) => setDraftMemoryGB(Number(e.target.value))}
                  className="vortex-slider w-full"
                />
              </div>
            )}

            {/* Resolution */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-secondary">Genişlik</label>
                <input
                  type="number"
                  min={640}
                  max={7680}
                  value={draftWidth}
                  onChange={(e) => setDraftWidth(Number(e.target.value) || 1280)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-base border border-edge text-xs text-ink-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-secondary">Yükseklik</label>
                <input
                  type="number"
                  min={480}
                  max={4320}
                  value={draftHeight}
                  onChange={(e) => setDraftHeight(Number(e.target.value) || 720)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-base border border-edge text-xs text-ink-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-base border border-edge text-xs text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftFullscreen}
                  onChange={(e) => setDraftFullscreen(e.target.checked)}
                  className="accent-[rgb(var(--accent))]"
                />
                <span>Tam Ekran</span>
              </label>
            </div>

            {/* Profile Custom Java Override */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-secondary">
                Profile Özel Java Yolu (İsteğe Bağlı)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftCustomJava}
                  onChange={(e) => setDraftCustomJava(e.target.value)}
                  placeholder="Boş bırakılırsa Genel Ayarlar / Otomatik Adoptium kullanılır"
                  className="flex-1 px-3 py-2 rounded-xl bg-surface-base border border-edge text-xs font-mono text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => void handlePickJava()}
                  className="px-3 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-edge text-xs font-medium text-ink-primary transition-colors shrink-0"
                >
                  Seç...
                </button>
              </div>
            </div>

            {/* Save Row */}
            <div className="flex items-center justify-between pt-2 border-t border-edge">
              <span className="text-xs text-emerald-400 font-medium">
                {savedNotice ? 'Profil değişiklikleri kaydedildi.' : ''}
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-accent-fg hover:bg-accent-strong disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Kaydediliyor...' : 'Profili Kaydet'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
