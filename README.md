# Mika — Recursive Organizational Operating System

Mika models an organization as a recursive tree of departments and roles, with authority that cascades down it. People join through role-specific, time-windowed invite links, sign in with Google only, and work through tasks that move through a strict review flow.

It runs entirely on Cloudflare: **one Worker** serves the React app (static assets) and the `/api/*` routes, **D1** stores data, **R2** stores uploaded files.

---

## 1. Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local         # creates the local D1 tables
npm run build                    # builds the frontend into dist/
npm run dev:api                  # Worker + assets on http://localhost:8787
```

`.dev.vars` (never committed):

```
DEV_AUTH=1
```

`DEV_AUTH=1` turns on a clearly labelled "Development sign-in" form (any email) so you can use the app before you have a Google OAuth client. **Never enable it in production**: it lets anyone sign in as anyone.

For frontend hot reload run `npm run dev` (Vite proxies `/api` to `:8787`) alongside `npm run dev:api`.

Checks: `npm run lint` (type-checks app and Worker), `npm run test:api` (22 checks of the authority rules against a running Worker).

---

## 2. Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create mika                # copy the printed database_id into wrangler.jsonc
npx wrangler r2 bucket create mika-files
npm run db:migrate:remote                  # applies migrations/ to the real database
npm run deploy                             # builds, then deploys
```

You get `https://mika.<your-subdomain>.workers.dev`. That URL is what you use when applying for Google Sign-In below.

Make sure `DEV_AUTH` is `"0"` in `wrangler.jsonc` for the deployed Worker.

---

## 3. Applying for Google Sign-In (OAuth) with the workers.dev domain

1. Go to Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**.
2. Choose **External**. App name "Mika", support email, and add your `workers.dev` host as an authorized domain (Google may ask you to verify `workers.dev` subdomains through Search Console, or to use a custom domain you own — a custom domain attached to the Worker is the smoothest route for verification).
3. Add a privacy policy and home page URL (can be pages on the deployed app).
4. **Scopes — start with sign-in only**: `openid`, `email`, `profile`. These are non-sensitive and need no Google review. Mika's sign-in uses only these.
5. Workspace features (Drive file picker, Docs/Sheets/Slides creation, Calendar, Meet) request **sensitive/restricted** scopes (`drive`, `calendar`, …) lazily, only when a person uses those features. They require Google's verification (and a security assessment for restricted Drive scopes). You can ship sign-in first and apply for these later.
6. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `https://mika.<your-subdomain>.workers.dev` (and `http://localhost:8787` for local testing).
   - No redirect URI is needed: sign-in uses the Google Identity Services token flow.
7. Put the client id in `wrangler.jsonc` → `vars.GOOGLE_CLIENT_ID`, redeploy. The Worker verifies each access token's audience against it. The dev form disappears once this is set and `DEV_AUTH` is off.
8. For the Drive picker also create a browser API key (`GOOGLE_API_KEY`) and note the project number (`GOOGLE_APP_ID`).

While the consent screen is in "Testing" only the test users you list can sign in; click "Publish app" when ready.

---

## 4. Architecture notes

- **Data**: org-scoped document store in D1 (`docs(org_id, kind, id, json, updated_at, deleted)`), kinds: department, role, assignment, user, task, comment, meeting, file, notification, message, connection, compliance, event. Invite links have their own table so a token can be looked up without knowing the org.
- **Authorization is deterministic and server-side.** The Worker imports the same pure rules as the UI (`src/lib/orgRules.ts`): who may create tasks, issue invite links, message whom, and which task state transitions each party may make. AI never decides ALLOW/DENY.
- **Task states**: pending (red) → submitted → done (green); help (blue); rejected (orange, reason required); expired (grey). Only the assignee submits; only the reviewer approves or sends back.
- **Privacy scoping**: you only receive your own notifications, DMs you take part in, and "myself" files you uploaded; integration secrets are never sent to the browser.
- **Sync**: clients poll `/changes?since=` every few seconds (with a small cursor overlap). It is not realtime push; Durable Objects + WebSockets would be the upgrade.
- **Pricing** is computed server-side: $0.30/person/month, plus either bring-your-own-storage or $20 per 250 GiB.
- **Files**: uploaded to R2 (≤50 MB) when the org uses Mika storage; orgs on Drive/self-host storage get a 409 on upload.

---

## 5. Integrations

GitHub (App + webhook), Figma (OAuth, preview export, version-label webhook) and Canva (OAuth + PKCE, design export) live in `worker/integrations/`. Tokens are encrypted (AES-GCM) in D1 and never reach the browser. A task is referenced by the tag `mika#<taskId>` in a commit message, pull request title/description, or Figma version name; only the assigned person's own linked account can submit it.

```
npx tsx scripts/integrations-unit.test.ts     # crypto, OAuth state, GitHub App JWT, link parsing (no server needed)
npm run dev:api  &&  python3 scripts/integrations-e2e.py   # webhooks, isolation, guards (needs the test values in .dev.vars)
```

Figma and Canva files can be linked to a task, with recorded activity kept separate from submission and review: see `docs/INTEGRATIONS_FIGMA_CANVA.md`. Organisations that choose "Host your own server" store files on their own S3-compatible server (`docs/SELF_HOSTED_STORAGE.md`). Tasks also carry Google tools (new Doc/Sheet/Slides, calendar, Meet, Google Tasks, Gmail, Forms, Classroom) that follow each organisation's role permissions. `npm run test:unit` runs the unit suites (the second applies the real migrations to an in-memory SQLite and mocks the providers).

## 6. Not implemented yet

- GitHub, Figma and Canva are implemented but switched off until you add their keys (`INTEGRATION_SECRETS.md`); until then they answer `501 not_configured`. They only ever submit tasks for review, never mark them done.
- Figma and Canva calls follow their documentation and are tested against mocks only: run the manual checks in `docs/INTEGRATIONS_FIGMA_CANVA.md` with a real app registration first.
- Google Workspace features need a real OAuth client, picker keys and Google verification.
- Required-integration gating on join is not enforced server-side.
- Drive / self-host storage modes have no upload path; File Vault link entries are plain links (no thumbnails or snapshots).
