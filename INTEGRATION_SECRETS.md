# Mika integration secrets checklist

Everything below is a **placeholder**. Nothing here is a real value, and real values must never be committed.

- **var** goes in `wrangler.jsonc` under `vars` (and in `.dev.vars` locally). It is not secret.
- **secret** is set with `npx wrangler secret put NAME` in production, and in `.dev.vars` locally (git-ignored).
- A value that is empty or still says `REPLACE_ME` leaves that integration switched off. It answers `501 not_configured` and the screens say so.
- Tick the status box as you go.

## Shared plumbing (needed for any of GitHub / Figma / Canva)

| Name | Type | Placeholder | Where it comes from | Status |
|---|---|---|---|---|
| `APP_URL` | var | `https://mika.REPLACE_ME.workers.dev` | The exact address people open Mika at (use `http://localhost:8787` locally). Every callback and webhook URL below is built from it. Behind the Vite dev server use its address instead | [ ] |
| `TOKEN_ENCRYPTION_KEY` | secret | `REPLACE_ME` | You generate it: `openssl rand -base64 32`. Encrypts stored tokens. Losing it means everyone reconnects | [ ] |
| `OAUTH_STATE_SECRET` | secret | `REPLACE_ME` | You generate it: `openssl rand -base64 32`. Signs the connect links | [ ] |

## GitHub (a GitHub **App**, not an OAuth App)

Create it at GitHub, Settings, Developer settings, GitHub Apps, New. Then set:

- **Callback URL:** `APP_URL/api/integrations/github/callback`
- **Request user authorization (OAuth) during installation:** ON (required, this is how Mika proves who installed it)
- **Webhook URL:** `APP_URL/api/webhooks/github`, with a webhook secret you choose
- **Permissions:** Repository, Metadata: read; Contents: read
- **Subscribe to events:** Push, Pull request
- **Where can it be installed:** any account

| Name | Type | Placeholder | Where it comes from | Status |
|---|---|---|---|---|
| `GITHUB_APP_SLUG` | var | `REPLACE_ME` | The last part of the app's public URL (`github.com/apps/<slug>`) | [ ] |
| `GITHUB_APP_ID` | var | `REPLACE_ME` | App settings page, "App ID" | [ ] |
| `GITHUB_APP_CLIENT_ID` | var | `REPLACE_ME` | App settings page, "Client ID" | [ ] |
| `GITHUB_APP_CLIENT_SECRET` | secret | `REPLACE_ME` | App settings page, Generate a new client secret | [ ] |
| `GITHUB_APP_PRIVATE_KEY` | secret | `-----BEGIN RSA PRIVATE KEY----- REPLACE_ME` | App settings page, Generate a private key (.pem). Multi-line: `npx wrangler secret put GITHUB_APP_PRIVATE_KEY < key.pem` | [ ] |
| `GITHUB_WEBHOOK_SECRET` | secret | `REPLACE_ME` | You choose it (`openssl rand -hex 32`); the same value goes in the app's webhook settings | [ ] |

## Figma

Create the app at Figma, Developers, My apps. **Callback URL:** `APP_URL/api/integrations/figma/callback`.
Scopes requested (space separated): `current_user:read`, `file_content:read`, `file_metadata:read`, `file_versions:read`, `file_comments:read`, `webhooks:write`. If Figma's scope picker names them differently, edit `SCOPES` in `worker/integrations/figma.ts`. Enable all six on the app.
Webhooks (activity and the version-label shortcut) need a Figma plan that allows them and an `https://` `APP_URL`; linking, Refresh and previews do not. Details: `docs/INTEGRATIONS_FIGMA_CANVA.md`. Webhook passcodes are generated per webhook and stored only as a hash, so you do not supply one.

| Name | Type | Placeholder | Where it comes from | Status |
|---|---|---|---|---|
| `FIGMA_CLIENT_ID` | var | `REPLACE_ME` | The app's page | [ ] |
| `FIGMA_CLIENT_SECRET` | secret | `REPLACE_ME` | The app's page | [ ] |

## Canva

Create the integration at the Canva Developer Portal. **Redirect URL:** `APP_URL/api/integrations/canva/callback`.
Scopes requested: `design:meta:read`, `design:content:read`, `profile:read`. Check whether Canva requires a review before people outside your own team can connect.

| Name | Type | Placeholder | Where it comes from | Status |
|---|---|---|---|---|
| `CANVA_CLIENT_ID` | var | `REPLACE_ME` | The integration's page | [ ] |
| `CANVA_CLIENT_SECRET` | secret | `REPLACE_ME` | Shown once when generated, so save it straight away | [ ] |

## Google Workspace (runs in the browser, no server secret)

| Name | Type | Placeholder | Where it comes from | Status |
|---|---|---|---|---|
| `GOOGLE_CLIENT_ID` | var | `REPLACE_ME.apps.googleusercontent.com` | Google Cloud Console, Credentials, OAuth client (Web). Authorized origin = `APP_URL` | [ ] |
| `GOOGLE_API_KEY` | var | `REPLACE_ME` | Google Cloud Console, API key, restricted to your domain and the Picker API (Drive picker only) | [ ] |
| `GOOGLE_APP_ID` | var | `REPLACE_ME` | Google Cloud **project number** (Drive picker only) | [ ] |

`GOOGLE_CLIENT_SECRET` is **not** needed: the Google features use each person's own consent in the browser.
Heads up before you apply for Google verification: `WORKSPACE_SCOPES` in `src/lib/auth.ts` includes restricted scopes (`drive.readonly`, `gmail.readonly`) and sensitive ones (`gmail.send`, `chat.messages`, `calendar.events`, and others). Restricted scopes need Google's paid security assessment. Trimming the list to what you really use is the cheapest way through verification.

## `.dev.vars` template (local only, never commit)

See `.dev.vars.example`. Copy it to `.dev.vars` and replace values as you obtain them.
