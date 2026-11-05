import React, { useEffect, useState } from 'react';
import { Check, Copy, Figma, Github, Layers } from 'lucide-react';
import type { Task } from '../types';
import {
  canvaExport, connectProvider, describeError, fetchIntegrationStatus, figmaExport, figmaWatch, taskTag,
  type IntegrationStatus, type ServerProvider,
} from '../lib/integrationsApi';

/**
 * Lets the assignee submit a task with evidence from GitHub, Figma or Canva.
 * Whatever is chosen, the task only moves to "submitted". A reviewer still approves it.
 */
export const TaskEvidenceIntegrations: React.FC<{ task: Task; onSubmitted?: () => void }> = ({ task, onSubmitted }) => {
  const orgId = task.orgId;
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [canvaUrl, setCanvaUrl] = useState('');
  const [canvaFormat, setCanvaFormat] = useState<'png' | 'pdf'>('png');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const tag = taskTag(task.id);

  const load = () => fetchIntegrationStatus(orgId).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { load(); }, [orgId]);

  if (!status) return null;
  const { github, figma, canva } = status.providers;
  if (!github.configured && !figma.configured && !canva.configured) return null;

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id); setMsg(null);
    try { setMsg({ ok: true, text: await fn() }); onSubmitted?.(); }
    catch (e) { setMsg({ ok: false, text: describeError(e) }); }
    finally { setBusy(null); }
  };
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

  const field = 'flex-1 min-w-0 px-2.5 py-1.5 bg-surface border border-hairline rounded-xs text-xs font-mono focus:outline-none focus:border-accent';
  const btn = 'px-3 py-1.5 text-xs font-semibold rounded-xs bg-accent text-white hover:bg-accent-strong disabled:opacity-50 cursor-pointer';
  const ghost = 'px-3 py-1.5 text-xs font-semibold rounded-xs border border-hairline text-ink-2 hover:bg-paper disabled:opacity-50 cursor-pointer';

  return (
    <div id="task-evidence-integrations" className="mb-4 p-4 bg-paper border border-hairline rounded-xs space-y-4">
      <div>
        <p className="text-xs font-bold font-mono text-ink">Submit with evidence from your tools</p>
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
          <p className="text-[11px] text-ink-3">Include this tag in a commit message or pull request title when you push. Only your own linked GitHub account counts.</p>
          {!github.orgConnected && <p className="text-[11px] text-amber-800">A lead needs to install the Mika GitHub App for the organisation first (Admin, Integrations).</p>}
          {github.orgConnected && !github.linked && (
            <button className={ghost} disabled={busy === 'link-github'} onClick={() => link('github')}>Link my GitHub account</button>
          )}
        </div>
      )}

      {figma.configured && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Figma className="w-3.5 h-3.5" /> Figma</div>
          {figma.linked ? (
            <>
              <div className="flex gap-2">
                <input className={field} value={figmaUrl} onChange={e => setFigmaUrl(e.target.value)} placeholder="Paste a Figma file or frame link" aria-label="Figma link" />
                <button className={btn} disabled={!figmaUrl.trim() || busy === 'figma'}
                  onClick={() => run('figma', async () => { await figmaExport(orgId, task.id, figmaUrl.trim()); return 'Preview attached and task submitted for review.'; })}>
                  Attach and submit
                </button>
              </div>
              <button className={ghost} disabled={!figmaUrl.trim() || busy === 'figma-watch'}
                onClick={() => run('figma-watch', async () => {
                  const r = await figmaWatch(orgId, task.id, figmaUrl.trim());
                  return `Watching that file. Save a Figma version with ${r.tag} in its name and the task is submitted.`;
                })}>
                Submit when I save a tagged version instead
              </button>
            </>
          ) : (
            <button className={ghost} disabled={busy === 'link-figma'} onClick={() => link('figma')}>Connect my Figma account</button>
          )}
        </div>
      )}

      {canva.configured && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Layers className="w-3.5 h-3.5" /> Canva</div>
          {canva.linked ? (
            <div className="flex gap-2">
              <input className={field} value={canvaUrl} onChange={e => setCanvaUrl(e.target.value)} placeholder="Paste a Canva design link" aria-label="Canva link" />
              <select className="px-2 py-1.5 bg-surface border border-hairline rounded-xs text-xs" value={canvaFormat}
                onChange={e => setCanvaFormat(e.target.value as 'png' | 'pdf')} aria-label="Export format">
                <option value="png">PNG</option><option value="pdf">PDF</option>
              </select>
              <button className={btn} disabled={!canvaUrl.trim() || busy === 'canva'}
                onClick={() => run('canva', async () => { await canvaExport(orgId, task.id, canvaUrl.trim(), canvaFormat); return 'Design exported, attached and submitted for review.'; })}>
                Export and submit
              </button>
            </div>
          ) : (
            <button className={ghost} disabled={busy === 'link-canva'} onClick={() => link('canva')}>Connect my Canva account</button>
          )}
        </div>
      )}

      {busy && <p className="text-[11px] text-ink-3 animate-pulse">Working with the other service. This can take a few seconds.</p>}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{msg.text}</p>}
    </div>
  );
};
