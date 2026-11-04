import React, { useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { GoogleSignIn } from './GoogleSignIn';
import type { AuthResult } from '../../lib/auth';

interface SignInViewProps {
  onBackToLanding: () => void;
  onNavigateToCreateOrg: () => void;
  /** Called when the person belongs to at least one organisation. */
  onSignedIn: (result: AuthResult) => void;
  /** Called when the account is valid but has no organisation yet. */
  onNoOrganisation: (result: AuthResult) => void;
}

export const SignInView: React.FC<SignInViewProps> = ({
  onBackToLanding,
  onNavigateToCreateOrg,
  onSignedIn,
  onNoOrganisation,
}) => {
  const [noOrgEmail, setNoOrgEmail] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between selection:bg-paper-sunken selection:text-ink">
      <header className="border-b border-hairline bg-paper px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 text-xs font-mono text-ink-2 hover:text-ink transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return</span>
          </button>
          <span className="font-serif font-bold text-xl tracking-tight text-ink">Mika</span>
          <button
            onClick={onNavigateToCreateOrg}
            className="text-xs font-mono text-accent-fg hover:underline font-semibold cursor-pointer"
          >
            Create organisation
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface border border-hairline rounded-xs shadow-xs p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-serif font-bold text-ink tracking-tight">Log in to Mika</h1>
            <p className="text-sm text-ink-3 mt-1">Use the Google account your organisation knows you by.</p>
          </div>

          {noOrgEmail && (
            <div role="status" className="mb-6 p-3 bg-st-help-bg border border-st-help-border rounded-xs text-xs text-st-help">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  {noOrgEmail} isn't part of an organisation yet. Ask your lead for an invite link, or start your own organisation.
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-st-help-border flex justify-end">
                <button onClick={onNavigateToCreateOrg} className="text-xs font-semibold underline cursor-pointer">
                  Create an organisation →
                </button>
              </div>
            </div>
          )}

          <GoogleSignIn
            onSuccess={result => {
              if (result.orgs.length === 0) {
                setNoOrgEmail(result.user.email);
                onNoOrganisation(result);
              } else {
                onSignedIn(result);
              }
            }}
          />

          <p className="mt-6 text-xs text-ink-3 leading-relaxed text-center">
            Mika never sees your Google password. Your account resolves to the roles you were invited into.
          </p>
        </div>
      </main>

      <footer className="border-t border-hairline bg-paper py-3 text-center text-xs font-mono text-ink-3">
        Deterministic organizational authorization &bull; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
