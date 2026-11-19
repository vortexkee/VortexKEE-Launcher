import React from 'react';
import { Check, Palette, Sparkles } from 'lucide-react';
import { LAUNCHER_THEMES, LauncherThemeDefinition } from '../themes/themes';

interface ThemesViewProps {
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
}

const ThemePreviewCard: React.FC<{
  theme: LauncherThemeDefinition;
  isActive: boolean;
  onSelect: () => void;
}> = ({ theme, isActive, onSelect }) => {
  const { preview } = theme;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group text-left rounded-2xl border p-4 transition-all duration-150 flex flex-col gap-3.5 focus:outline-none ${
        isActive
          ? 'bg-surface-panel border-accent ring-2 ring-accent/30 shadow-lg'
          : 'bg-surface-panel/80 border-edge hover:border-edge-strong hover:bg-surface-panel'
      }`}
    >
      {/* Live Miniature Launcher UI Preview */}
      <div
        style={{ backgroundColor: preview.base, borderColor: `${preview.text}22` }}
        className="w-full h-32 rounded-xl border overflow-hidden flex flex-col shadow-inner"
      >
        {/* Mini Titlebar */}
        <div
          style={{ backgroundColor: preview.panel, borderBottomColor: `${preview.text}1A` }}
          className="h-5 px-2.5 flex items-center justify-between border-b"
        >
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: preview.secondary }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: preview.accent }} />
            <span
              className="w-1.5 h-1.5 rounded-full opacity-40"
              style={{ backgroundColor: preview.text }}
            />
          </div>
          <div
            className="h-1.5 w-14 rounded-full opacity-55"
            style={{ backgroundColor: preview.text }}
          />
        </div>

        {/* Mini Body */}
        <div className="flex-1 flex min-h-0">
          {/* Mini Sidebar */}
          <div
            style={{ backgroundColor: preview.panel, borderRightColor: `${preview.text}18` }}
            className="w-8 border-r p-1.5 flex flex-col items-center gap-1.5"
          >
            <div className="w-4 h-3 rounded" style={{ backgroundColor: preview.accent }} />
            <div
              className="w-4 h-2.5 rounded opacity-30"
              style={{ backgroundColor: preview.text }}
            />
            <div
              className="w-4 h-2.5 rounded opacity-20"
              style={{ backgroundColor: preview.text }}
            />
          </div>

          {/* Mini Hero + Bottom Play Strip */}
          <div className="flex-1 p-2 flex flex-col justify-between">
            <div
              style={{ backgroundColor: preview.elevated }}
              className="rounded-lg p-2 space-y-1.5 relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: preview.secondary }}
              />
              <div
                className="h-2 w-20 rounded-full"
                style={{ backgroundColor: preview.text, opacity: 0.9 }}
              />
              <div
                className="h-1.5 w-28 rounded-full"
                style={{ backgroundColor: preview.text, opacity: 0.35 }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: preview.elevated }}
                />
                <div
                  className="h-2 w-12 rounded-full opacity-55"
                  style={{ backgroundColor: preview.text }}
                />
              </div>
              <div
                className="h-4 w-12 rounded-md"
                style={{ backgroundColor: preview.accent }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metadata & Color Swatches */}
      <div className="space-y-1.5 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-ink-primary truncate">
              {theme.name}
            </span>
            {theme.badge && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-surface-elevated border border-edge text-ink-secondary">
                {theme.badge}
              </span>
            )}
          </div>
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent text-accent-fg shrink-0">
              <Check className="w-3 h-3" />
              Aktif
            </span>
          )}
        </div>

        <p className="text-[11px] font-medium text-accent">{theme.subtitle}</p>
        <p className="text-xs text-ink-muted leading-relaxed">{theme.description}</p>
      </div>

      {/* Palette Dots */}
      <div className="flex items-center justify-between pt-2 border-t border-edge/70">
        <div className="flex items-center gap-1.5">
          {[preview.base, preview.panel, preview.accent, preview.secondary, preview.text].map(
            (hex, index) => (
              <span
                key={`${theme.id}-${index}`}
                title={hex}
                style={{ backgroundColor: hex }}
                className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
              />
            ),
          )}
        </div>
        <span className="text-[10px] font-mono text-ink-muted">{theme.id}</span>
      </div>
    </button>
  );
};

export const ThemesView: React.FC<ThemesViewProps> = ({
  activeThemeId,
  onSelectTheme,
}) => {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2">
            <Palette className="w-5 h-5 text-accent" />
            <span>Tema Galerisi</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Tek tıkla görünümü değiştirin; seçiminiz <code className="font-mono text-accent">settings.json</code> dosyasına anında kaydedilir.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-panel border border-edge text-xs text-ink-secondary">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>{LAUNCHER_THEMES.length} Hazır Tema</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {LAUNCHER_THEMES.map((theme) => (
          <ThemePreviewCard
            key={theme.id}
            theme={theme}
            isActive={activeThemeId === theme.id}
            onSelect={() => onSelectTheme(theme.id)}
          />
        ))}
      </div>
    </div>
  );
};
