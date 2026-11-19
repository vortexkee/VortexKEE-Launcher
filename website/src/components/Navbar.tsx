import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download, Github, Palette } from 'lucide-react';
import { GITHUB_RELEASES_URL, PRODUCT_NAME } from '../config/releaseConfig';
import { WEB_THEMES } from '../themes/themes';

interface NavbarProps {
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  latestVersion: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeThemeId,
  onSelectTheme,
  latestVersion,
}) => {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const currentTheme =
    WEB_THEMES.find((t) => t.id === activeThemeId) ?? WEB_THEMES[0];

  useEffect(() => {
    if (!themeMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [themeMenuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-edge/70 bg-surface-base/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <a href="#" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/50 flex items-center justify-center relative">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 5l8 14L20 5" />
              <path d="M9 5l3 5.5L15 5" opacity="0.65" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-crimson" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-wide text-ink-primary group-hover:text-accent transition-colors">
              {PRODUCT_NAME}
            </span>
            <span className="hidden sm:inline text-[11px] font-mono text-ink-muted">
              {latestVersion}
            </span>
          </div>
        </a>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-ink-secondary">
          <a href="#ozellikler" className="hover:text-accent transition-colors">
            Özellikler
          </a>
          <a href="#temalar" className="hover:text-accent transition-colors">
            Temalar
          </a>
          <a href="#indir" className="hover:text-accent transition-colors">
            İndir
          </a>
        </nav>

        {/* Right Controls: Live Theme Switcher + GitHub + Download */}
        <div className="flex items-center gap-2">
          {/* Compact Theme Switcher */}
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((o) => !o)}
              aria-expanded={themeMenuOpen}
              aria-label="Tema değiştir"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-panel hover:bg-surface-hover border border-edge text-xs font-medium text-ink-primary transition-colors"
            >
              <Palette className="w-3.5 h-3.5 text-accent" />
              <span
                className="w-2.5 h-2.5 rounded-full border border-edge-strong"
                style={{ backgroundColor: currentTheme.swatch.accent }}
              />
              <span className="hidden sm:inline">{currentTheme.name}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-ink-muted transition-transform ${
                  themeMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {themeMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-panel border border-edge-strong shadow-2xl p-2 space-y-1 z-50">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Canlı Tema Önizlemesi
                </div>
                {WEB_THEMES.map((theme) => {
                  const isActive = theme.id === activeThemeId;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        onSelectTheme(theme.id);
                        setThemeMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                        isActive
                          ? 'bg-accent/15 border border-accent/40 text-ink-primary'
                          : 'hover:bg-surface-hover/70 border border-transparent text-ink-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex -space-x-1 shrink-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-edge"
                            style={{ backgroundColor: theme.swatch.base }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-edge"
                            style={{ backgroundColor: theme.swatch.accent }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-edge"
                            style={{ backgroundColor: theme.swatch.secondary }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{theme.name}</div>
                          <div className="text-[10px] text-ink-muted truncate">
                            {theme.tagline}
                          </div>
                        </div>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Releases"
            className="p-2 rounded-xl bg-surface-panel hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>

          <a
            href="#indir"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent text-accent-fg hover:bg-accent-strong text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>İndir</span>
          </a>
        </div>
      </div>
    </header>
  );
};
