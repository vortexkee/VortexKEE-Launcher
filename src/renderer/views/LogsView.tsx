import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Search, Terminal, Trash2 } from 'lucide-react';
import type { GameLogLevel, GameLogPayload } from '../../shared/types';

interface LogsViewProps {
  logs: GameLogPayload[];
  onClearLogs: () => void;
}

const LEVELS: Array<'ALL' | GameLogLevel> = ['ALL', 'INFO', 'WARN', 'ERROR', 'STDERR'];

export const LogsView: React.FC<LogsViewProps> = ({ logs, onClearLogs }) => {
  const [filterLevel, setFilterLevel] = useState<'ALL' | GameLogLevel>('ALL');
  const [query, setQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((entry) => {
      if (filterLevel !== 'ALL' && entry.level !== filterLevel) return false;
      if (q && !entry.line.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, filterLevel, query]);

  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs.length, autoScroll]);

  const handleCopyAll = async () => {
    const text = filteredLogs
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] ${l.line}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent" />
            <span>Canlı Oyun Konsolu</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Minecraft JVM stdout / stderr çıktıları gerçek zamanlı olarak aktarılır.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-secondary cursor-pointer select-none px-2.5 py-1.5 rounded-xl bg-surface-panel border border-edge">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-[rgb(var(--accent))]"
            />
            <span>Otomatik Kaydır</span>
          </label>
          <button
            type="button"
            onClick={() => void handleCopyAll()}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-panel hover:bg-surface-hover border border-edge text-ink-secondary hover:text-ink-primary disabled:opacity-40 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-panel hover:bg-crimson/15 border border-edge hover:border-crimson/40 text-ink-secondary hover:text-crimson disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Temizle</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-surface-panel border border-edge rounded-xl p-1">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setFilterLevel(lvl)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                filterLevel === lvl
                  ? 'bg-accent text-accent-fg'
                  : 'text-ink-muted hover:text-ink-primary hover:bg-surface-hover/60'
              }`}
            >
              {lvl === 'ALL' ? `Tümü (${logs.length})` : lvl}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Konsol çıktılarında ara..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface-panel border border-edge text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Console Output Area */}
      <div className="flex-1 min-h-0 rounded-2xl bg-surface-panel border border-edge overflow-y-auto p-3.5 font-mono text-[11px] leading-relaxed">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-ink-muted gap-2">
            <Terminal className="w-8 h-8 opacity-35" />
            <p className="text-xs font-sans">
              {logs.length === 0
                ? 'Henüz konsol çıktısı yok. Oyunu başlattığınızda canlı loglar burada görünecektir.'
                : 'Seçili filtreyle eşleşen log satırı bulunamadı.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((entry, idx) => {
              const levelStyle =
                entry.level === 'ERROR' || entry.level === 'STDERR'
                  ? 'text-crimson'
                  : entry.level === 'WARN'
                  ? 'text-amber-400'
                  : 'text-ink-secondary';

              return (
                <div
                  key={`${entry.timestamp}-${idx}`}
                  className="flex items-start gap-2 hover:bg-surface-elevated/40 px-1.5 py-0.5 rounded"
                >
                  <span className="text-ink-muted shrink-0 select-none">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`shrink-0 font-bold w-14 text-[10px] ${
                      entry.level === 'ERROR' || entry.level === 'STDERR'
                        ? 'text-crimson'
                        : entry.level === 'WARN'
                        ? 'text-amber-400'
                        : 'text-accent'
                    }`}
                  >
                    [{entry.level}]
                  </span>
                  <span className={`break-all whitespace-pre-wrap ${levelStyle}`}>
                    {entry.line}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
};
