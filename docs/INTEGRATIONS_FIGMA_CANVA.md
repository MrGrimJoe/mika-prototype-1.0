# Figma and Canva in Mika

Optional. A person who connects neither still uses Mika normally, and Mika never asks anyone to pay for their own Figma or Canva plan.

## What it does

1. **Connect** your own Figma and/or Canva account (OAuth, from the task page).
2. **Link** a Figma file/frame or a Canva design to an assignment. Linking is not submitting.
3. **Activity** is recorded about linked files only: Figma named versions and comments (ids only, never comment text) and, where the provider reports it, that the file changed. Canva reports only a last-modified time.
4. The assignee **submits** one linked file as their deliverable (explicit button; a preview is archived as evidence). This moves the task to *submitted* and nothing further.
5. A reviewer **accepts or sends it back** through the task's normal review flow. Mika mirrors that decision onto the file with the reviewer's id and time.

Activity is never treated as effort, quality or completion. Only submission (assignee) and review (reviewer) count.

## Code map

| Piece | File |
|---|---|
| Provider contract | `worker/integrations/adapter.ts` |
| Figma / Canva adapters (all provider specifics) | `worker/integrations/figma.ts`, `canva.ts` |
| Registry | `worker/integrations/adapters.ts` |
| Link / sync / submit / unlink (provider-neutral) | `worker/integrations/resources.ts` |
| Normalised events, dedupe, review mirroring | `worker/integrations/events.ts` |
| Retry/backoff, error mapping | `worker/integrations/common.ts` |
| Forced refresh, concurrent-refresh recovery | `worker/integrations/accounts.ts` |
| Schema | `migrations/0003_integration_resources.sql` |
| UI | `src/components/LinkedWork.tsx` |

Adding another provider means writing one adapter and registering it. Nothing in `resources.ts`, the routes or the UI names Figma or Canva.

## Routes

`GET /api/integrations/work?orgId&taskId` · `POST /api/integrations/resources` · `POST /api/integrations/resources/:id/{sync,submit,unlink}` · `POST /api/webhooks/figma` · existing connect/callback/disconnect routes. `/figma/export` and `/canva/export` still work (they link, then submit).

Authorization is enforced server side on every call: organisation membership, then task involvement (assignee, assigner, or authority over the role) to read or refresh; only the assignee, using the account they themselves linked, may link, submit or unlink.

## Figma setup

1. Figma, Developers, My apps, create an app.
2. **Callback URL:** `APP_URL/api/integrations/figma/callback`
3. **Scopes** (granular; each backs a feature): `current_user:read`, `file_content:read`, `file_metadata:read`, `file_versions:read`, `file_comments:read`, `webhooks:write`. Sent space-separated.
4. Put `FIGMA_CLIENT_ID` (var) and `FIGMA_CLIENT_SECRET` (secret) in place. No new variables were added by this change.
5. **Webhooks:** registered automatically per linked file (`FILE_VERSION_UPDATE`, `FILE_COMMENT`) to `APP_URL/api/webhooks/figma`. Requires an `https://` public `APP_URL` and a Figma plan that allows webhooks. If unavailable, the file still links and **Refresh** pulls the same activity. Passcodes are stored only as hashes.

People who connected Figma before this change must reconnect once to grant `file_versions:read` and `file_comments:read`; until then those two items show as "not allowed" while everything else works.

## Canva setup

1. Canva Developer Portal, create an integration. **Redirect URL:** `APP_URL/api/integrations/canva/callback`
2. **Scopes:** `design:meta:read`, `design:content:read`, `profile:read` (PKCE S256 is used).
3. Set `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET`. Canva may require review before people outside your own team can connect.

**Not used, on purpose:** Canva's comments API and webhook notifications are marked *preview* by Canva, and preview features block a public integration from passing review. Mika does not depend on them. Canva activity is "the design's modified time went up since the last Refresh". If Canva promotes them to generally available, add them inside `canva.ts` only.

## Local development

`.dev.vars` as in `INTEGRATION_SECRETS.md`; `npm run db:migrate:local`; `npm run build && npm run dev:api`. Figma cannot reach `localhost`, so webhooks stay off locally and Refresh is used.

## Production notes

- Apply the migration before deploying: `npm run db:migrate:remote`.
- Rotating `TOKEN_ENCRYPTION_KEY` makes everyone reconnect.
- `integration_events` is append-only and not pruned automatically. At normal volumes this is small; add a retention job if a deployment links very busy files.
- Sync cadence: manual Refresh, one automatic refresh when a task page is opened and a file has not been checked for an hour, minimum 30 s between provider calls per file, doubling backoff (30 s up to 1 h) after errors, `Retry-After` honoured. There is no background polling.

## Known limitations

- Figma/Canva calls follow the providers' published docs and are tested against mocks. **They have not been run against real provider accounts.** See "Manual checks".
- Figma token endpoints: the code tries `api.figma.com` (HTTP Basic) first and falls back to the older `www.figma.com` form-body style. Confirm which your app uses.
- Figma webhooks fire for *named* versions and comments, not for every edit. Canva has no revision id.
- Preview export for a whole Figma file uses Figma's file thumbnail; paste a frame link (`node-id`) for a full-size render.
- Thumbnails are provider URLs that expire; they are a display hint only. The archived preview made at submission is the evidence.
- GitHub keeps its own code path; only Figma and Canva sit behind the adapter interface.

## Manual checks (need real credentials)

1. Connect Figma, link a file, save a named version, add a comment: events appear via webhook (paid plan) or Refresh.
2. Reconnect an existing Figma account and confirm the new scopes are granted.
3. Connect Canva, link a design, edit it, Refresh: one "file changed" event.
4. Submit each; confirm the task becomes *submitted*, not *done*, and a reviewer's acceptance shows their name.
5. Disconnect each; confirm Figma's webhook list is empty for the app and Canva shows the grant revoked.
