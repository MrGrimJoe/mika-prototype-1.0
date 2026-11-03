/**
 * Regenerates the screenshots in docs/design/screenshots/.
 *
 * Usage (from the repo root, with the app running on http://127.0.0.1:3000 via `npm run dev`):
 *   npm i -D playwright && npx playwright install chromium   # once
 *   node docs/design/capture-screenshots.cjs [baseUrl] [outDir]
 *
 * It drives the real flows (sign out, simulate an employee joining, switch to that employee,
 * assign a task) so empty states, populated states, modals and the full-page task view are all captured
 * in three setups: desktop light, desktop dark, and a 390px phone.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const OUT = process.argv[3] || path.join(__dirname, 'screenshots');

const SETUPS = [
  { dir: 'desktop', scheme: 'light', w: 1440, h: 900, mobile: false },
  { dir: 'desktop-dark', scheme: 'dark', w: 1440, h: 900, mobile: false },
  { dir: 'mobile', scheme: 'light', w: 390, h: 844, mobile: true },
];

async function run(setup) {
  const dir = path.join(OUT, setup.dir);
  fs.mkdirSync(dir, { recursive: true });
  const { mobile } = setup;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: setup.w, height: setup.h },
    colorScheme: setup.scheme,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('mika_session', JSON.stringify({ sessionId: 's', token: 't' }));
    localStorage.setItem('mika_user_id', 'u_principal');
  });
  page.on('pageerror', e => console.log(`[${setup.dir}] page error:`, e.message.slice(0, 140)));
  await page.goto(BASE);
  await page.waitForTimeout(1300);

  let n = 0;
  const shot = async (name, fullPage = false) => {
    n += 1;
    await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`), fullPage });
  };
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { console.log(`[${setup.dir}] FAILED ${name}: ${e.message.split('\n')[0].slice(0, 110)}`); }
  };
  const drawerOpen = () => page.locator('#mobile-navigation').evaluate(el => el.classList.contains('translate-x-0')).catch(() => false);
  const nav = async label => {
    if (mobile && !(await drawerOpen())) { await page.getByRole('button', { name: 'Open navigation' }).click(); await page.waitForTimeout(350); }
    await page.locator('aside nav button', { hasText: label }).first().click();
    await page.waitForTimeout(900);
  };

  // Principal (root) screens
  await step('dashboard', async () => { await shot('dashboard'); });
  if (mobile) await step('drawer', async () => { await page.getByRole('button', { name: 'Open navigation' }).click(); await page.waitForTimeout(450); await shot('navigation-drawer'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); });
  await step('staff-empty', async () => { await nav('Staff Directory'); await shot('staff-directory-empty'); });
  await step('join-modal', async () => { await page.getByRole('button', { name: /Simulate join/i }).click(); await page.waitForTimeout(500); await shot('simulate-join-modal'); });
  await step('join', async () => { await page.getByRole('button', { name: 'Join Role' }).click(); await page.waitForTimeout(2200); await shot('staff-directory-populated'); });
  if (!mobile) await step('profile', async () => { await page.getByText('Alice Chen').first().click(); await page.waitForTimeout(900); await shot('profile-modal'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); });
  await step('meetings', async () => { await nav('Meetings'); await shot('meetings'); });
  await step('chat-list', async () => { await nav('Messages'); await shot('messages-list'); });
  await step('chat-thread', async () => { await page.locator('[class*=cursor-pointer]').filter({ hasText: 'Alice Chen' }).first().click(); await page.waitForTimeout(800); await shot('messages-conversation'); });
  await step('files', async () => { await nav('File Vault'); await shot('file-vault'); });
  await step('invites', async () => { await nav('Invitations'); await shot('invitations'); });
  await step('settings', async () => { await nav('Settings'); await shot('settings'); });

  // Switch to the new employee (test-mode persona switcher) and work with tasks
  await step('switch', async () => {
    if (mobile && !(await drawerOpen())) { await page.getByRole('button', { name: 'Open navigation' }).click(); await page.waitForTimeout(350); }
    await page.locator('aside button[title*="Switch active user"]').click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Alice Chen/ }).first().click(); await page.waitForTimeout(800);
    if (mobile) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  });
  await step('taskfeed-empty', async () => { await nav('Task Feed'); await shot('task-feed-empty'); });
  await step('task-modal', async () => { await page.locator('#btn-create-task-main').click(); await page.waitForTimeout(900); await shot('assign-task-modal'); });
  await step('task-create', async () => {
    await page.getByPlaceholder(/Submit Q1/).fill('Prepare term timetable');
    await page.locator('textarea').first().fill('Draft the preschool timetable for next term and share it with the team.');
    const role = page.locator('select').nth(1);
    if ((await role.locator('option').count()) > 1) await role.selectOption({ index: 1 });
    await page.getByRole('button', { name: /Assign Deliverable/ }).click(); await page.waitForTimeout(2200);
    await shot('task-feed-with-task');
  });
  await step('task-open', async () => { await page.getByText('Prepare term timetable').first().click(); await page.waitForTimeout(1200); await shot('task-detail', true); });

  // Signed-out screens (light only is enough, but capture in each setup so dark/mobile are covered too)
  await step('signout', async () => {
    await nav('Sign out'); await page.waitForTimeout(1200); await shot('landing');
    await page.getByRole('button', { name: /Log in/ }).first().click(); await page.waitForTimeout(1000); await shot('sign-in');
  });
  await step('create-org', async () => {
    await page.goto(BASE); await page.waitForTimeout(1000);
    if (await page.getByRole('button', { name: /Create an organisation/ }).count() === 0) {
      await nav('Sign out'); await page.waitForTimeout(1000);
    }
    await page.getByRole('button', { name: /Create an organisation/ }).first().click(); await page.waitForTimeout(1200); await shot('create-organisation');
  });

  await browser.close();
  console.log(`[${setup.dir}] captured ${n} screenshots`);
}

(async () => { for (const s of SETUPS) await run(s); })();
