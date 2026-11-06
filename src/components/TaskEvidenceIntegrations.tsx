import React, { useEffect, useState } from 'react';
import { Check, Copy, Github } from 'lucide-react';
import type { Task } from '../types';
import {
  connectProvider, describeError, fetchIntegrationStatus, taskTag,
  type IntegrationStatus, type ServerProvider,
} from '../lib/integrationsApi';

/**
 * Lets the assignee submit a task with evidence from GitHub (Figma and Canva live in LinkedWork).
 * Whatever is chosen, the task only moves to "submitted". A reviewer still approves it.
 */
export const TaskEvidenceIntegrations: React.FC<{ task: Task; onSubmitted?: () => void }> = ({ task, onSubmitted }) => {
  const orgId = task.orgId;
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const tag = taskTag(task.id);

  const load = () => fetchIntegrationStatus(orgId).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { load(); }, [orgId]);

  if (!status) return null;
  const { github } = status.providers;
  if (!github.configured) return null;

  const link = async (provider: ServerProvider) => {
    setBusy(`link-${provider}`);
    const r = await connectProvider(provider, orgId, { mode: 'link' });
    setMsg({ ok: r.ok, text: r.message });
    await load();
    setBusy(null);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(tag); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const ghost = 'px-3 py-1.5 text-xs font-semibold rounded-xs border border-hairline text-ink-2 hover:bg-paper disabled:opacity-50 cursor-pointer';

  return (
    <div id="task-evidence-integrations" className="mb-4 p-4 bg-paper border border-hairline rounded-xs space-y-4">
      <div>
        <p className="text-xs font-bold font-mono text-ink">Submit with evidence from GitHub</p>
        <p className="text-xs text-ink-3">The task goes to review with proof attached. A reviewer still decides if it is done.</p>
      </div>

      {github.configured && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Github className="w-3.5 h-3.5" /> GitHub</div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-surface border border-hairline rounded-xs text-xs">{tag}</code>
            <button type="button" onClick={copy} className={ghost} aria-label="Copy task tag">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-xs text-ink-3">Include this tag in a commit message or pull request title when you push. Only your own linked GitHub account counts.</p>
          {!github.orgConnected && <p className="text-xs text-amber-800">A lead needs to install the Mika GitHub App for the organisation first (Admin, Integrations).</p>}
          {github.orgConnected && !github.linked && (
            <button className={ghost} disabled={busy === 'link-github'} onClick={() => link('github')}>Link my GitHub account</button>
          )}
        </div>
      )}

      {busy && <p className="text-xs text-ink-3 animate-pulse">Working with the other service. This can take a few seconds.</p>}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{msg.text}</p>}
    </div>
  );
};
