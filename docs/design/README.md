# Mika design refresh

Screenshots of every major screen, captured from the running app with `capture-screenshots.cjs`.

| Folder | Setup |
| --- | --- |
| `screenshots/before/` | Desktop, before the refresh (state of `main` after the accessibility patch) |
| `screenshots/desktop/` | Desktop 1440x900, light |
| `screenshots/desktop-dark/` | Desktop 1440x900, dark (follows the system setting) |
| `screenshots/mobile/` | Phone 390x844, light |

## Before and after

| Before | After |
| --- | --- |
| ![Landing before](screenshots/before/landing.png) | ![Landing after](screenshots/desktop/16-landing.png) |
| ![Invitations before](screenshots/before/invitations.png) | ![Invitations after](screenshots/desktop/10-invitations.png) |
| ![Settings before](screenshots/before/settings.png) | ![Settings after](screenshots/desktop/11-settings.png) |
| ![File Vault before](screenshots/before/file-vault.png) | ![File Vault after](screenshots/desktop/09-file-vault.png) |

## Phone

| Navigation drawer | Staff directory | Messages | Task detail |
| --- | --- | --- | --- |
| ![Drawer](screenshots/mobile/02-navigation-drawer.png) | ![Staff](screenshots/mobile/05-staff-directory-populated.png) | ![Messages](screenshots/mobile/08-messages-conversation.png) | ![Task](screenshots/mobile/15-task-detail.png) |

## Regenerating

```bash
npm run dev                                   # in one terminal (serves http://localhost:3000)
npm i -D playwright && npx playwright install chromium   # once
node docs/design/capture-screenshots.cjs                  # writes docs/design/screenshots/
```

The script drives the real flows (sign out, simulate an employee joining, switch to that employee, assign a task),
so the empty states, populated states, modals and the full-page task view are all captured.

## What the refresh covers

- One accent (indigo) and calm neutral surfaces in light and dark; every text and background pair is at least 4.5:1.
- One type voice: the system UI font (SF Pro on Apple devices, Inter elsewhere). Monospace is reserved for real code (`.font-code`).
- Sentence-case labels, plain-language section names, status names instead of colour names on the task filters.
- Softer shape and depth: larger radii, layered shadows, accent-tinted selection.
- Phones get a top bar and a slide-over navigation drawer; Messages is list-then-conversation; the staff table becomes cards.
