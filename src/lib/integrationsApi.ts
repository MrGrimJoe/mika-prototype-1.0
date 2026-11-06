/** Client for the Worker's integration endpoints. Secrets never reach the browser; this only starts flows and reads status. */
import { api, ApiError } from './api';

export type ServerProvider = 'github' | 'figma' | 'canva';
export const SERVER_PROVIDERS: ServerProvider[] = ['github', 'figma', 'canva'];
/** GitHub, Figma and Canva connect through the server. Google Workspace runs in the browser with the person's own consent. */
export const isServerProvider = (key?: string): key is ServerProvider => !!key && (SERVER_PROVIDERS as string[]).includes(key);

export interface ProviderCapabilities {
  provider: 'figma' | 'canva'; label: string; thumbnails: boolean; versions: boolean;
  comments: 'yes' | 'plan_required' | 'preview_only' | 'no'; webhooks: 'yes' | 'plan_required' | 'preview_only' | 'no';
  exportPreview: boolean; notes: string[];
}
export interface ProviderStatus {
  capabilities?: ProviderCapabilities;   // figma and canva
  configured: boolean;
  missing?: string[];            // only sent to leads
  linked: boolean;               // this person's own account is linked
  accountLabel: string | null;
  orgConnected: boolean;         // a lead connected it for the organisation
  orgAccount: string | null;
}
export interface IntegrationStatus {
  isLead: boolean;
  providers: {
    github: ProviderStatus; figma: ProviderStatus; canva: ProviderStatus;
    google: { configured: boolean; pickerConfigured: boolean; missing?: string[] };
  };
}

export const fetchIntegrationStatus = (orgId: string) =>
  api<IntegrationStatus>(`/api/integrations/status?orgId=${encodeURIComponent(orgId)}`);

export interface ConnectResult { ok: boolean; message: string; accountLabel?: string }

/** Turns a server refusal into something a person can act on. */
export function describeError(e: unknown, what = 'this integration'): string {
  if (e instanceof ApiError) {
    if (e.body?.code === 'not_configured') {
      const missing: string[] | undefined = e.body.missing;
      return `${what} isn't set up on this server yet.${missing?.length ? ` Missing: ${missing.join(', ')}.` : ''}`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/** Opens the provider's consent page in a popup and waits for our callback page to report back. */
export function runOAuthPopup(url: string): Promise<ConnectResult> {
  return new Promise(resolve => {
    const popup = window.open(url, 'mika_oauth', 'width=640,height=780');
    if (!popup) { window.location.href = url; return; } // popups blocked: finish the flow in this tab instead
    let done = false;
    const finish = (r: ConnectResult) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
      resolve(r);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'MIKA_INTEGRATION') return;
      finish({ ok: !!e.data.ok, message: String(e.data.message || ''), accountLabel: e.data.accountLabel || undefined });
    };
    window.addEventListener('message', onMessage);
    const timer = setInterval(() => {
      if (popup.closed) finish({ ok: false, message: 'The connection window was closed before it finished.' });
    }, 600);
  });
}

export async function connectProvider(
  provider: ServerProvider, orgId: string, opts: { mode?: 'install' | 'link'; scope?: 'user' | 'org' | 'root' } = {}
): Promise<ConnectResult> {
  try {
    const body = provider === 'github' ? { orgId, mode: opts.mode ?? 'link' } : { orgId, scope: opts.scope ?? 'user' };
    const { url } = await api<{ url: string }>(`/api/integrations/${provider}/start`, { method: 'POST', body });
    return await runOAuthPopup(url);
  } catch (e) {
    return { ok: false, message: describeError(e, provider[0].toUpperCase() + provider.slice(1)) };
  }
}

export const disconnectProvider = (provider: ServerProvider, orgId: string, target: 'user' | 'installation' = 'user') =>
  api(`/api/integrations/${provider}/disconnect`, { method: 'POST', body: { orgId, target } });

// ---- Evidence and pickers --------------------------------------------------------------------------------

export interface GithubRepo { id: string; name: string; fullName: string; owner: string; private: boolean; url: string; defaultBranch: string }
export const githubRepos = (orgId: string) =>
  api<{ repos: GithubRepo[]; account: string; truncated: boolean }>(`/api/integrations/github/repos?orgId=${encodeURIComponent(orgId)}`);
export const githubTree = (orgId: string, repo: string, path = '') =>
  api<{ repo: string; path: string; items: { name: string; path: string; type: string; url: string }[] }>(
    `/api/integrations/github/tree?orgId=${encodeURIComponent(orgId)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`);

export const figmaWatch = (orgId: string, taskId: string, fileUrl: string) =>
  api<{ webhookId: string; tag: string; reused: boolean }>(`/api/integrations/figma/watch`, { method: 'POST', body: { orgId, taskId, fileUrl } });
export interface CanvaDesign { id: string; title: string; thumbnailUrl: string | null; editUrl: string | null; viewUrl: string | null; updatedAt: number | null }
export const canvaDesigns = (orgId: string, query = '') =>
  api<{ designs: CanvaDesign[] }>(`/api/integrations/canva/designs?orgId=${encodeURIComponent(orgId)}&query=${encodeURIComponent(query)}`);

// ---- Linked work (provider neutral) ---------------------------------------------------------------------------------

export type DesignProviderKey = 'figma' | 'canva';
export interface LinkedResource {
  id: string; provider: DesignProviderKey; type: string; url: string; title: string; linkedBy: string; linkedAt: number;
  version: string | null; providerModifiedAt: number | null; thumbnailUrl: string | null;
  lastSyncedAt: number | null; syncState: 'never' | 'ok' | 'error' | 'reconnect'; syncError: string | null; nextSyncAfter: number | null; limits: string[];
  submission: { status: 'not_submitted' | 'submitted'; at: number | null; by: string | null };
  review: { status: 'none' | 'awaiting' | 'accepted' | 'returned'; at: number | null; reviewerUserId: string | null; feedback: string | null };
}
export type WorkEventType = 'resource_updated' | 'version_created' | 'comment_added' | 'resource_linked' | 'resource_unlinked' | 'export_completed' | 'submission_made' | 'deliverable_accepted' | 'deliverable_returned';
export interface WorkEvent {
  id: string; resourceId: string; provider: string; type: WorkEventType; category: 'activity' | 'link' | 'submission' | 'review';
  occurredAt: number; receivedAt: number; actorUserId: string | null; hasActor: boolean; metadata: Record<string, string | number | boolean | null>;
}
export interface TaskWork { resources: LinkedResource[]; events: WorkEvent[]; taskStatus: string; canLink: boolean }

export const fetchTaskWork = (orgId: string, taskId: string) =>
  api<TaskWork>(`/api/integrations/work?orgId=${encodeURIComponent(orgId)}&taskId=${encodeURIComponent(taskId)}`);
export const linkResource = (orgId: string, taskId: string, provider: DesignProviderKey, input: string) =>
  api<{ resource: LinkedResource; created: boolean; webhook: { status: 'active' | 'unavailable' | 'unsupported'; reason?: string } }>(
    '/api/integrations/resources', { method: 'POST', body: { orgId, taskId, provider, input } });
export const syncResource = (orgId: string, id: string) =>
  api<{ resource: LinkedResource; throttled?: boolean; retryAt?: number; recorded?: number; error?: { code: string; message: string } }>(
    `/api/integrations/resources/${encodeURIComponent(id)}/sync`, { method: 'POST', body: { orgId } });
export const submitResource = (orgId: string, id: string, format?: 'png' | 'pdf') =>
  api(`/api/integrations/resources/${encodeURIComponent(id)}/submit`, { method: 'POST', body: { orgId, format } });
export const unlinkResource = (orgId: string, id: string) =>
  api(`/api/integrations/resources/${encodeURIComponent(id)}/unlink`, { method: 'POST', body: { orgId } });

/** What to put in a commit message, PR title/description, or Figma version name to submit a task. */
export const taskTag = (taskId: string) => `mika#${taskId}`;
