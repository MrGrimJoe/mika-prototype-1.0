import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getConfig, PublicConfig } from '../../lib/api';
import { AuthResult, signInWithDevIdentity, signInWithGoogle } from '../../lib/auth';

interface Props {
  onSuccess: (result: AuthResult) => void;
  onError?: (message: string) => void;
  label?: string;
}

/** Google button, with a clearly labelled development form when Google OAuth is not configured yet. */
export const GoogleSignIn: React.FC<Props> = ({ onSuccess, onError, label = 'Sign in with Google' }) => {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => { getConfig().then(setConfig); }, []);

  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : 'Sign-in failed. Please try again.';
    setError(msg);
    onError?.(msg);
  };

  const run = async (fn: () => Promise<AuthResult>) => {
    setBusy(true);
    setError(null);
    try { onSuccess(await fn()); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  if (!config) return <div className="text-xs font-mono text-ink-3 text-center py-3">Loading…</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-st-pending-bg border border-st-pending-border rounded-xs text-xs text-st-pending flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {config.googleClientId ? (
        <button
          type="button"
          onClick={() => run(signInWithGoogle)}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-surface hover:bg-paper text-ink border border-hairline rounded-xs text-sm font-medium shadow-xs transition-all disabled:opacity-50 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
          </svg>
          <span>{busy ? 'Connecting…' : label}</span>
        </button>
      ) : config.devAuth ? (
        <form
          onSubmit={e => { e.preventDefault(); run(() => signInWithDevIdentity(email.trim(), name.trim())); }}
          className="space-y-3 p-4 border border-dashed border-st-help-border bg-st-help-bg rounded-xs"
        >
          <p className="text-xs text-st-help font-semibold">Development sign-in</p>
          <p className="text-xs text-ink-2 leading-relaxed">
            Google sign-in isn't configured on this deployment, so you can sign in with any email. This only exists while DEV_AUTH is on and must never be enabled in production.
          </p>
          <label className="block text-xs font-semibold text-ink">
            Email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
              className="mt-1 w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-ink">
            Full name
            <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              className="mt-1 w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-sm font-normal" />
          </label>
          <button type="submit" disabled={busy}
            className="w-full py-2.5 bg-accent hover:bg-accent-strong text-white rounded-xs text-sm font-semibold disabled:opacity-50 cursor-pointer">
            {busy ? 'Signing in…' : 'Continue (development)'}
          </button>
        </form>
      ) : (
        <div className="p-4 bg-paper border border-hairline rounded-xs text-xs text-ink-2 leading-relaxed">
          Sign-in isn't available yet: this deployment has no Google OAuth client configured. See the README to set one up.
        </div>
      )}
    </div>
  );
};
