import React, { useState, useEffect } from 'react';
import { OverlappingOrgShowcase } from './OverlappingOrgShowcase';

interface LandingPageProps {
  onNavigateToSignIn: () => void;
  onNavigateToCreateOrg: () => void;
  onOpenJoinToken?: (token: string) => void;
  onOpenFlowchart?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateToSignIn,
  onNavigateToCreateOrg,
  onOpenJoinToken
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [joinTokenInput, setJoinTokenInput] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-paper-sunken selection:text-ink font-sans antialiased">
      {/* ─────────────────────────────────────────────────────────────
          1. STICKY NAV BAR
      ───────────────────────────────────────────────────────────── */}
      <header 
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-paper/95 backdrop-blur-md border-b border-hairline shadow-[0_1px_3px_rgba(0,0,0,0.03)]' 
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Wordmark */}
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
            className="text-2xl font-serif font-bold tracking-tight text-ink hover:opacity-85 transition-opacity cursor-pointer text-left"
          >
            Mika
          </button>

          {/* Minimal Links */}
          <div className="flex items-center gap-7 text-xs font-mono text-ink-2">
            <a 
              href="#how-it-works" 
              className="hover:text-ink transition-colors"
            >
              How it works
            </a>
            <a 
              href="#graph-showcase" 
              className="hover:text-ink transition-colors"
            >
              Structure
            </a>
            <button
              onClick={onNavigateToSignIn}
              className="text-ink hover:underline transition-all cursor-pointer font-medium"
            >
              Log in
            </button>
            <button
              onClick={onNavigateToCreateOrg}
              className="px-4 py-2 bg-accent hover:bg-accent-strong text-white rounded-xs font-mono text-xs font-medium shadow-xs transition-all cursor-pointer hover:shadow-sm"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        {/* Subtle slow-moving abstract node background (decorative greyscale canvas) */}
        <div className="absolute inset-0 pointer-events-none opacity-25 overflow-hidden">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#8A8578" strokeWidth="0.75" strokeDasharray="3,6" fill="none">
              <line x1="12%" y1="18%" x2="35%" y2="28%" />
              <line x1="35%" y1="28%" x2="52%" y2="15%" />
              <line x1="52%" y1="15%" x2="78%" y2="32%" />
              <line x1="78%" y1="32%" x2="88%" y2="60%" />
              <line x1="35%" y1="28%" x2="42%" y2="70%" />
              <line x1="42%" y1="70%" x2="68%" y2="78%" />
              <line x1="68%" y1="78%" x2="78%" y2="32%" />
              <line x1="18%" y1="58%" x2="42%" y2="70%" />
            </g>
            <g fill="#8A8578">
              <circle cx="12%" cy="18%" r="2" />
              <circle cx="35%" cy="28%" r="2.5" />
              <circle cx="52%" cy="15%" r="2" />
              <circle cx="78%" cy="32%" r="2.5" />
              <circle cx="88%" cy="60%" r="2" />
              <circle cx="42%" cy="70%" r="2.5" />
              <circle cx="68%" cy="78%" r="2" />
              <circle cx="18%" cy="58%" r="2" />
            </g>
          </svg>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-ink tracking-tight leading-[1.15]">
            Every team has its own shape.<br />
            Mika finally has a place for it.
          </h1>

          <p className="mt-7 text-base sm:text-lg text-ink-2 leading-relaxed max-w-2xl mx-auto font-normal">
            Schools, companies, agencies &mdash; Mika models the way your organization actually operates. 
            Tasks and authority flow to exactly the right person, with nothing to configure by hand.
          </p>

          {/* Two Large Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onNavigateToCreateOrg}
              className="w-full sm:w-auto px-7 py-3.5 bg-accent hover:bg-accent-strong text-white rounded-xs text-xs font-mono font-semibold shadow-xs transition-all hover:shadow-sm cursor-pointer"
            >
              Create an organisation
            </button>
            <button
              onClick={onNavigateToSignIn}
              className="w-full sm:w-auto px-7 py-3.5 bg-transparent hover:bg-paper-raised text-ink border border-hairline hover:border-ink rounded-xs text-xs font-mono font-semibold transition-all cursor-pointer"
            >
              Log in
            </button>
          </div>

          {/* Subtle Invite Link Token Trigger */}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-mono text-ink-2">
            {showTokenInput ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (joinTokenInput.trim() && onOpenJoinToken) {
                    onOpenJoinToken(joinTokenInput.trim());
                  }
                }}
                className="flex items-center gap-2 bg-paper-raised p-1.5 rounded-xs border border-hairline"
              >
                <input
                  type="text"
                  placeholder="Paste invite token..."
                  value={joinTokenInput}
                  onChange={(e) => setJoinTokenInput(e.target.value)}
                  className="bg-paper text-ink px-2.5 py-1 text-xs font-mono rounded-xs border border-hairline focus:outline-hidden focus:border-accent w-52"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-accent text-white text-xs font-mono rounded-xs hover:bg-accent-strong transition-colors cursor-pointer"
                >
                  Join
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenInput(false)}
                  className="px-1.5 text-xs text-ink-3 hover:text-ink cursor-pointer"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowTokenInput(true)}
                className="hover:text-ink hover:underline transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Have an invite token?</span>
                <span className="text-accent-fg font-semibold underline">Enter here &rarr;</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. "HOW IT'S DIFFERENT" SECTION
      ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 border-t border-hairline bg-paper-raised">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 text-center max-w-2xl mx-auto">
            <span className="text-[11px] font-mono text-ink-3">
              How it works
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-2 tracking-tight">
              A typed relationship graph, not rigid boxes.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {/* Block 1 */}
            <div className="p-8 bg-paper border border-hairline rounded-xs hover:border-edge transition-all">
              <span className="text-[11px] font-mono text-ink-3 block mb-3">
                Overlapping teams
              </span>
              <h3 className="text-xl font-serif font-bold text-ink mb-2 tracking-tight">
                One structure, every dimension.
              </h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                A team, a class, a subject, a project &mdash; the same person can belong to all of them at once without duplicate accounts or conflicting hierarchies.
              </p>
            </div>

            {/* Block 2 */}
            <div className="p-8 bg-paper border border-hairline rounded-xs hover:border-edge transition-all">
              <span className="text-[11px] font-mono text-ink-3 block mb-3">
                Directed permissions
              </span>
              <h3 className="text-xl font-serif font-bold text-ink mb-2 tracking-tight">
                Authority that makes sense.
              </h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Tasks and permissions flow to exactly the right person, automatically &mdash; no manual permission-wrangling or redundant administrative overrides.
              </p>
            </div>

            {/* Block 3 */}
            <div className="p-8 bg-paper border border-hairline rounded-xs hover:border-edge transition-all">
              <span className="text-[11px] font-mono text-ink-3 block mb-3">
                Automatic routing
              </span>
              <h3 className="text-xl font-serif font-bold text-ink mb-2 tracking-tight">
                Nothing to configure by hand.
              </h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Build your org visually or let it write itself from a conversation; the underlying recursive structure is calculated and handled for you.
              </p>
            </div>

            {/* Block 4 */}
            <div className="p-8 bg-paper border border-hairline rounded-xs hover:border-edge transition-all">
              <span className="text-[11px] font-mono text-ink-3 block mb-3">
                Rules that always hold
              </span>
              <h3 className="text-xl font-serif font-bold text-ink mb-2 tracking-tight">
                Deterministic, always.
              </h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Every decision about who can assign, approve, or access files is enforced by fixed mathematical rules &mdash; not probabilistic guesses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. VISUAL "GRAPH" SHOWCASE SECTION
      ───────────────────────────────────────────────────────────── */}
      <section id="graph-showcase" className="py-24 px-6 border-t border-hairline bg-paper">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] font-mono text-ink-3">
              Structure
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-2 tracking-tight">
              The structure is the interface.
            </h2>
          </div>

          <OverlappingOrgShowcase />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. CLOSING CTA BAND
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-hairline bg-paper-raised">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-ink tracking-tight">
            Build the structure your team already has.
          </h2>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onNavigateToCreateOrg}
              className="w-full sm:w-auto px-6 py-3 bg-accent hover:bg-accent-strong text-white rounded-xs text-xs font-mono font-semibold shadow-xs transition-all cursor-pointer"
            >
              Create an organisation
            </button>
            <button
              onClick={onNavigateToSignIn}
              className="w-full sm:w-auto px-6 py-3 bg-transparent hover:bg-paper-sunken text-ink border border-hairline hover:border-ink rounded-xs text-xs font-mono font-semibold transition-all cursor-pointer"
            >
              Log in
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-hairline bg-paper">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-ink-3">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-ink text-sm">Mika</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-ink transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-ink transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
