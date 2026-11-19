import React, { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, ShieldCheck, X } from 'lucide-react';

interface MicrosoftLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitToken: (tokenOrCode: string) => Promise<void>;
  onGetAuthUrl: () => Promise<string | null>;
  onOpenExternal: (url: string) => Promise<void>;
}

export const MicrosoftLoginModal: React.FC<MicrosoftLoginModalProps> = ({
  isOpen,
  onClose,
  onSubmitToken,
  onGetAuthUrl,
  onOpenExternal,
}) => {
  const [tokenOrCode, setTokenOrCode] = useState('');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTokenOrCode('');
    void onGetAuthUrl()
      .then((url) => setAuthUrl(url))
      .catch(() => setAuthUrl(null));
  }, [isOpen, onGetAuthUrl]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenOrCode.trim()) {
      setError('Lütfen Microsoft OAuth kodunu veya MSA erişim anahtarını girin.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmitToken(tokenOrCode.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ms-login-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-surface-panel border border-edge-strong shadow-2xl overflow-hidden">
        {/* Top subtle crimson/gold rule */}
        <div className="h-1 w-full bg-gradient-to-r from-accent via-crimson to-accent" />

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 id="ms-login-title" className="text-base font-semibold text-ink-primary">
                  Microsoft ile Giriş Yap
                </h2>
                <p className="text-xs text-ink-muted">
                  İsteğe bağlı · Orijinal Minecraft hesabınızı bağlayın
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs leading-relaxed text-ink-secondary bg-surface-elevated/70 border border-edge rounded-xl p-3">
            Microsoft OAuth → Xbox Live → XSTS → Minecraft Services zinciri üzerinden
            doğrulama yapılır. Oturum anahtarlarınız işletim sistemi anahtar zincirinde
            (<code className="text-accent font-mono">safeStorage</code>) şifrelenerek saklanır.
          </p>

          {authUrl && (
            <button
              type="button"
              onClick={() => void onOpenExternal(authUrl)}
              className="w-full py-2.5 px-3 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-accent/40 text-accent text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Tarayıcıda Microsoft OAuth Sayfasını Aç</span>
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="ms-token-input"
                className="text-xs font-medium text-ink-secondary flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-accent" />
                <span>OAuth Yetkilendirme Kodu veya MSA Access Token</span>
              </label>
              <input
                id="ms-token-input"
                type="password"
                value={tokenOrCode}
                onChange={(e) => setTokenOrCode(e.target.value)}
                placeholder="Ew... veya yetkilendirme kodunu yapıştırın"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-base border border-edge text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent transition-colors font-mono"
              />
            </div>

            {error && (
              <div className="text-xs text-crimson bg-crimson/10 border border-crimson/35 rounded-xl p-2.5">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-ink-secondary hover:bg-surface-hover transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-accent-fg hover:bg-accent-strong disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Doğrulanıyor...' : 'Hesabı Bağla'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
