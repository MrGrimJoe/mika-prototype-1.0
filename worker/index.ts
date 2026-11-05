import type { Env } from './env';
import { HttpError } from './env';
import { Router, json, readJson } from './util';
import {
  createSession, createUser, devAuthEnabled, endSession, findUserByEmail, findUserBySub,
  requireUser, sessionPayload, verifyGoogleAccessToken,
} from './auth';
import { acceptInvite, createOrganization, issueInviteLink, resolveInviteLink, updateOrganization, type CreateOrgBody } from './orgs';
import { orgChanges, orgState, removeDoc, submitViaShortcut, writeDoc } from './docs';
import { downloadFile, removeFileBlob, uploadFile } from './files';
import { isMember, loadOrgContext, listDocs, orgsForUser } from './store';
import type { IntegrationConnection } from '../src/types';

const router = new Router();

// ---- Public -------------------------------------------------------------------------------
router.add('GET', '/api/health', async () => json({ ok: true, service: 'mika', time: new Date().toISOString() }));


// ---- Auth ---------------------------------------------------------------------------------
async function signInWith(env: Env, identity: { email: string; googleSub?: string; fullName: string; photoUrl?: string }) {
  let user = identity.googleSub ? await findUserBySub(env, identity.googleSub) : null;
  if (!user) user = await findUserByEmail(env, identity.email);
  let created = false;
  if (!user) {
    user = await createUser(env, {
      email: identity.email, googleSub: identity.googleSub, fullName: identity.fullName, avatarUrl: identity.photoUrl,
    });
    created = true;
  } else if (identity.googleSub) {
    await env.DB.prepare('UPDATE users SET google_sub = COALESCE(google_sub, ?2) WHERE id = ?1').bind(user.id, identity.googleSub).run();
  }
  const payload = await sessionPayload(env, user);
  return { success: true, isNew: created || payload.orgs.length === 0, ...payload };
}

router.add('POST', '/api/auth/google', async ({ req }) => {
  const env = currentEnv();
  const { accessToken } = await readJson<{ accessToken?: string }>(req);
  if (!accessToken) throw new HttpError(400, 'accessToken is required');
  return json(await signInWith(env, await verifyGoogleAccessToken(env, accessToken)));
});

// Development-only sign-in for working before Google OAuth is approved. Disabled unless DEV_AUTH=1.
router.add('POST', '/api/auth/dev-login', async ({ req }) => {
  const env = currentEnv();
  if (!devAuthEnabled(env)) throw new HttpError(404, 'Not found');
  const { email, fullName } = await readJson<{ email?: string; fullName?: string }>(req);
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) throw new HttpError(400, 'A valid email is required');
  return json(await signInWith(env, { email: email.toLowerCase(), fullName: fullName?.trim() || email.split('@')[0] }));
});

router.add('GET', '/api/me', async ({ req, url }) => {
  const env = currentEnv();
  const user = await requireUser(env, req, url);
  return json({ user, orgs: await orgsForUser(env, user.id) });
});

router.add('POST', '/api/auth/logout', async ({ req }) => {
  await endSession(currentEnv(), req);
  return json({ success: true });
});

// ---- Organisations ------------------------------------------------------------------------
router.add('POST', '/api/orgs', async ({ req }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  const body = await readJson<CreateOrgBody>(req);
  return json({ success: true, ...(await createOrganization(env, user, body)) }, 201);
});

router.add('PATCH', '/api/orgs/:orgId', async ({ req, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  return json({ success: true, org: await updateOrganization(env, user, params.orgId, await readJson(req)) });
});

router.add('GET', '/api/orgs/:orgId/state', async ({ req, url, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req, url);
  const ctx = await loadOrgContext(env, params.orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  return json(await orgState(env, params.orgId, user.id));
});

router.add('GET', '/api/orgs/:orgId/changes', async ({ req, url, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req, url);
  const ctx = await loadOrgContext(env, params.orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  return json(await orgChanges(env, params.orgId, Number(url.searchParams.get('since')) || 0, user.id));
});

router.add('PUT', '/api/orgs/:orgId/docs/:kind/:id', async ({ req, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  const doc = await writeDoc(env, user, params.orgId, params.kind, params.id, await readJson(req));
  return json({ success: true, doc });
});

router.add('DELETE', '/api/orgs/:orgId/docs/:kind/:id', async ({ req, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  await removeDoc(env, user, params.orgId, params.kind, params.id);
  if (params.kind === 'file') await removeFileBlob(env, params.orgId, params.id);
  return json({ success: true });
});

// ---- Invite links -------------------------------------------------------------------------
router.add('POST', '/api/orgs/:orgId/links', async ({ req, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  const { link, authorityExplanation } = await issueInviteLink(env, user, params.orgId, await readJson(req));
  return json({ success: true, link, token: link.token, expiresAt: link.expiresAt, authorityExplanation }, 201);
});

router.add('GET', '/api/join/:token', async ({ params }) => json(await resolveInviteLink(currentEnv(), params.token)));

router.add('POST', '/api/join/:token/signup', async ({ req, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  const result = await acceptInvite(env, user, params.token, await readJson(req));
  return json({ success: true, ...result, session: await createSession(env, user.id) });
});

// ---- Files (R2) ---------------------------------------------------------------------------
router.add('POST', '/api/orgs/:orgId/files', async ({ req, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  return json({ success: true, file: await uploadFile(env, user, params.orgId, await req.formData()) }, 201);
});

router.add('GET', '/api/orgs/:orgId/files/:fileId', async ({ req, url, params }) => {
  const env = currentEnv();
  const user = await requireUser(env, req, url);
  return downloadFile(env, user, params.orgId, params.fileId);
});

router.add('POST', '/api/v1/tasks/submit-shortcut', async ({ req }) => {
  const env = currentEnv();
  const user = await requireUser(env, req);
  const task = await submitViaShortcut(env, user, await readJson(req));
  return json({ success: true, taskId: task.id, status: task.status, evidence: task.submissionEvidence });
});
router.add('POST', '/api/webhooks/github', notConfiguredLater('GitHub webhooks'));
router.add('POST', '/api/v1/webhooks/github', notConfiguredLater('GitHub webhooks'));

// ---- Integrations -------------------------------------------------------------------------
router.add('GET', '/api/integrations/connections', async ({ req, url }) => {
  const env = currentEnv();
  const user = await requireUser(env, req, url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return json({ connections: [] });
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  const conns = await listDocs<IntegrationConnection>(env, orgId, 'connection');
  // Never ship stored tokens to the browser.
  return json({ connections: conns.map(({ accessToken, refreshToken, ...safe }: any) => safe) });
});

router.add('GET', '/api/integrations/github/config', async () => json({ clientId: '', isConfigured: false }));

function notConfiguredLater(what: string) {
  return async () => json({ error: `${what} are not enabled on this deployment yet.`, code: 'not_configured' }, 501);
}
const notConfigured = (what: string) => async () =>
  json({ error: `${what} is not connected on this deployment yet.`, code: 'not_configured' }, 501);
for (const [m, p, label] of [
  ['GET', '/api/integrations/github/repos', 'GitHub'],
  ['GET', '/api/integrations/github/tree', 'GitHub'],
  ['GET', '/api/integrations/github/callback', 'GitHub'],
  ['GET', '/api/integrations/figma/files', 'Figma'],
  ['POST', '/api/integrations/figma/export', 'Figma'],
  ['GET', '/api/integrations/canva/designs', 'Canva'],
  ['POST', '/api/integrations/canva/export', 'Canva'],
] as const) router.add(m, p, notConfigured(label));

// ---- Entry -------------------------------------------------------------------------------
let _env: Env;
const currentEnv = () => _env;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    _env = env;
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/config') {
        return json({
          googleClientId: env.GOOGLE_CLIENT_ID || null,
          googleApiKey: env.GOOGLE_API_KEY || null,
          googleAppId: env.GOOGLE_APP_ID || null,
          devAuth: devAuthEnabled(env),
        });
      }
      const res = await router.handle(req, url);
      if (res) return res;
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error('Unhandled error', e);
      return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
    }
  },
};
