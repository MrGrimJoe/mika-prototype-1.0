import type { Env } from '../env';
import { HttpError } from '../env';
import { Router, json, readJson } from '../util';
import { requireUser } from '../auth';
import { listDocs } from '../store';
import type { IntegrationConnection } from '../../src/types';
import { isLead, isSet, memberContext, missingFor, type Provider } from './common';
import { canvaCallback, canvaDesigns, canvaStart } from './canva';
import { figmaCallback, figmaFileInfo, figmaStart, figmaWatch, figmaWebhook } from './figma';
import { adapterFor } from './adapters';
import { linkAndSubmit, linkResource, listTaskWork, submitResource, syncResource, unlinkResource } from './resources';
import { githubCallback, githubConfig, githubDisconnect, githubRepos, githubStart, githubTree, githubWebhook } from './github';

const scopeOf = (v: unknown): 'user' | 'org' | 'root' => (v === 'org' || v === 'root' ? v : 'user');

/** What the Integrations screen needs: is each tool set up on this deployment, and is this person / org connected. */
async function status(env: Env, req: Request, url: URL) {
  const user = await requireUser(env, req, url);
  const orgId = url.searchParams.get('orgId');
  const ctx = await memberContext(env, user, orgId);
  const lead = isLead(ctx, user.id);
  const { results } = await env.DB.prepare(
    `SELECT provider, kind, user_id, label FROM integration_accounts WHERE org_id = ?1 AND (kind = 'installation' OR user_id = ?2)`
  ).bind(orgId, user.id).all<{ provider: string; kind: string; user_id: string; label: string }>();
  const conns = await listDocs<IntegrationConnection>(env, orgId!, 'connection');

  const one = (provider: Provider) => {
    const missing = missingFor(env, provider);
    const mine = results.find(r => r.provider === provider && r.kind === 'user');
    const inst = results.find(r => r.provider === provider && r.kind === 'installation');
    return {
      configured: missing.length === 0,
      // What this provider can and cannot do, so the screens never imply more than the API offers.
      ...(provider === 'figma' || provider === 'canva' ? { capabilities: adapterFor(provider).capabilities } : {}),
      // Names of unset secrets are only useful to (and only shown to) people who can fix them.
      ...(lead && missing.length ? { missing } : {}),
      linked: !!mine, accountLabel: mine?.label ?? null,
      orgConnected: provider === 'github' ? !!inst : conns.some(c => c.integrationKey === provider),
      orgAccount: inst?.label ?? conns.find(c => c.integrationKey === provider)?.accountLabel ?? null,
    };
  };
  const googleMissing = ['GOOGLE_CLIENT_ID'].filter(k => !isSet((env as any)[k]));
  const pickerMissing = ['GOOGLE_API_KEY', 'GOOGLE_APP_ID'].filter(k => !isSet((env as any)[k]));
  return json({
    isLead: lead,
    providers: {
      github: one('github'), figma: one('figma'), canva: one('canva'),
      // Google Workspace runs in the browser with each person's own consent; no server secret is involved.
      google: {
        configured: googleMissing.length === 0, pickerConfigured: pickerMissing.length === 0,
        ...(lead ? { missing: [...googleMissing, ...pickerMissing] } : {}),
      },
    },
  });
}

export function registerIntegrationRoutes(router: Router, getEnv: () => Env) {
  const authed = async (req: Request, url?: URL) => requireUser(getEnv(), req, url);
  const q = (url: URL, k: string) => url.searchParams.get(k) || '';

  router.add('GET', '/api/integrations/status', async ({ req, url }) => status(getEnv(), req, url));

  // ---- GitHub
  router.add('GET', '/api/integrations/github/config', async () => json(githubConfig(getEnv())));
  router.add('POST', '/api/integrations/github/start', async ({ req }) => {
    const b = await readJson<{ orgId?: string; mode?: string }>(req);
    return githubStart(getEnv(), await authed(req), b.orgId || '', b.mode === 'install' ? 'install' : 'link');
  });
  router.add('GET', '/api/integrations/github/callback', async ({ req, url }) => githubCallback(getEnv(), req, url));
  router.add('GET', '/api/integrations/github/repos', async ({ req, url }) =>
    json(await githubRepos(getEnv(), await authed(req, url), q(url, 'orgId'))));
  router.add('GET', '/api/integrations/github/tree', async ({ req, url }) =>
    json(await githubTree(getEnv(), await authed(req, url), q(url, 'orgId'), q(url, 'repo'), q(url, 'path'), q(url, 'ref'))));
  router.add('POST', '/api/webhooks/github', async ({ req }) => githubWebhook(getEnv(), req));
  router.add('POST', '/api/v1/webhooks/github', async ({ req }) => githubWebhook(getEnv(), req));

  // ---- Figma
  router.add('POST', '/api/integrations/figma/start', async ({ req }) => {
    const b = await readJson<{ orgId?: string; scope?: string }>(req);
    return figmaStart(getEnv(), await authed(req), b.orgId || '', scopeOf(b.scope));
  });
  router.add('GET', '/api/integrations/figma/callback', async ({ req, url }) => figmaCallback(getEnv(), req, url));
  router.add('GET', '/api/integrations/figma/files', async ({ req, url }) =>
    json(await figmaFileInfo(getEnv(), await authed(req, url), q(url, 'orgId'), q(url, 'url'))));
  // One-step "attach a preview and submit", kept for existing callers: it links the file, then submits it.
  router.add('POST', '/api/integrations/figma/export', async ({ req }) => {
    const b = await readJson<{ orgId?: string; taskId?: string; fileUrl?: string }>(req);
    const r = await linkAndSubmit(getEnv(), await authed(req), 'figma', { orgId: b.orgId, taskId: b.taskId, input: b.fileUrl });
    return json({ task: r.task, file: r.file, resource: r.resource });
  });
  router.add('POST', '/api/integrations/figma/watch', async ({ req }) =>
    json(await figmaWatch(getEnv(), await authed(req), await readJson(req))));
  router.add('POST', '/api/webhooks/figma', async ({ req }) => figmaWebhook(getEnv(), req));

  // ---- Canva
  router.add('POST', '/api/integrations/canva/start', async ({ req }) => {
    const b = await readJson<{ orgId?: string; scope?: string }>(req);
    return canvaStart(getEnv(), await authed(req), b.orgId || '', scopeOf(b.scope));
  });
  router.add('GET', '/api/integrations/canva/callback', async ({ req, url }) => canvaCallback(getEnv(), req, url));
  router.add('GET', '/api/integrations/canva/designs', async ({ req, url }) =>
    json(await canvaDesigns(getEnv(), await authed(req, url), q(url, 'orgId'), q(url, 'query'))));
  router.add('POST', '/api/integrations/canva/export', async ({ req }) => {
    const b = await readJson<{ orgId?: string; taskId?: string; design?: string; format?: string }>(req);
    const r = await linkAndSubmit(getEnv(), await authed(req), 'canva', { orgId: b.orgId, taskId: b.taskId, input: b.design, format: b.format });
    return json({ task: r.task, file: r.file, resource: r.resource });
  });

  // ---- Linked work: provider-neutral. Linking is not submitting; activity is not completion.
  router.add('GET', '/api/integrations/work', async ({ req, url }) =>
    json(await listTaskWork(getEnv(), await authed(req, url), q(url, 'orgId'), q(url, 'taskId'))));
  router.add('POST', '/api/integrations/resources', async ({ req }) =>
    json(await linkResource(getEnv(), await authed(req), await readJson(req)), 201));
  router.add('POST', '/api/integrations/resources/:id/sync', async ({ req, params }) => {
    const b = await readJson<{ orgId?: string }>(req);
    return json(await syncResource(getEnv(), await authed(req), b.orgId || '', params.id));
  });
  router.add('POST', '/api/integrations/resources/:id/submit', async ({ req, params }) => {
    const b = await readJson<{ orgId?: string; format?: string }>(req);
    return json(await submitResource(getEnv(), await authed(req), { orgId: b.orgId, resourceId: params.id, format: b.format }));
  });
  router.add('POST', '/api/integrations/resources/:id/unlink', async ({ req, params }) => {
    const b = await readJson<{ orgId?: string }>(req);
    return json(await unlinkResource(getEnv(), await authed(req), b.orgId || '', params.id));
  });

  // ---- Disconnect (the caller's own link; leads can also remove the org-wide GitHub install)
  router.add('POST', '/api/integrations/:provider/disconnect', async ({ req, params }) => {
    const env = getEnv();
    const user = await authed(req);
    const b = await readJson<{ orgId?: string; target?: string }>(req);
    const orgId = b.orgId || '';
    if (params.provider === 'github') await githubDisconnect(env, user, orgId, b.target === 'installation' ? 'installation' : 'user');
    else await adapterFor(params.provider).disconnect(env, user, orgId); // figma | canva (404 for anything else)
    return json({ ok: true });
  });
}
