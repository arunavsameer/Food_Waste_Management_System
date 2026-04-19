# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: testing/specs/caterer.spec.js >> Caterer Dashboard: Full View Tests >> Messages: selecting a direct admin channel replaces the empty state with a chat area
- Location: testing/specs/caterer.spec.js:491:3

# Error details

```
Error: page.goto: Test ended.
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

```

# Test source

```ts
  1   | import path from 'path';
  2   | import { test, expect } from '@playwright/test';
  3   | import { createClient } from '@supabase/supabase-js';
  4   | import dotenv from 'dotenv';
  5   | 
  6   | // Load the local test environment variables from the root folder
  7   | dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
  8   | 
  9   | // Initialize Supabase with the Service Role Key for database cleanup
  10  | const supabase = createClient(
  11  |   process.env.VITE_SUPABASE_URL,
  12  |   process.env.SUPABASE_SERVICE_ROLE_KEY
  13  | );
  14  | 
  15  | const CATERER_EMAIL    = process.env.TEST_CATERER_EMAIL;
  16  | const CATERER_PASSWORD = process.env.TEST_CATERER_PASSWORD;
  17  | 
  18  | // ─────────────────────────────────────────────────────────────────────────────
  19  | // HELPERS
  20  | // ─────────────────────────────────────────────────────────────────────────────
  21  | 
  22  | /** Returns today's date as "YYYY-MM-DD" in local time (mirrors getLocalDateString in LogWasteView). */
  23  | const getLocalDateString = (date = new Date()) => {
  24  |   const y = date.getFullYear();
  25  |   const m = String(date.getMonth() + 1).padStart(2, '0');
  26  |   const d = String(date.getDate()).padStart(2, '0');
  27  |   return `${y}-${m}-${d}`;
  28  | };
  29  | 
  30  | /** Click a sidebar nav button by its visible label text. */
  31  | const goToTab = async (page, label) => {
  32  |   // On the default 1280 px wide viewport the desktop sidebar is open,
  33  |   // so every <span> inside .nav-item is rendered.
  34  |   const btn = page.locator('button.nav-item', { hasText: label });
  35  |   await expect(btn).toBeVisible({ timeout: 8000 });
  36  |   await btn.click();
  37  | };
  38  | 
  39  | // ─────────────────────────────────────────────────────────────────────────────
  40  | // SUITE
  41  | // ─────────────────────────────────────────────────────────────────────────────
  42  | 
  43  | test.describe('Caterer Dashboard: Full View Tests', () => {
  44  |   let catererId;
  45  | 
  46  |   // --- SETUP ---
  47  |   test.beforeAll(async () => {
  48  |     const { data, error } = await supabase.auth.signInWithPassword({
  49  |       email: CATERER_EMAIL,
  50  |       password: CATERER_PASSWORD,
  51  |     });
  52  |     if (error) throw error;
  53  |     catererId = data.user.id;
  54  |   });
  55  | 
  56  |   // --- TEARDOWN: remove any waste reports inserted by the test run ---
  57  |   test.afterAll(async () => {
  58  |     await supabase
  59  |       .from('waste_reports')
  60  |       .delete()
  61  |       .eq('caterer_id', catererId)
  62  |       .eq('report_date', getLocalDateString());         // only touch today's test records
  63  |   });
  64  | 
  65  |   // --- LOGIN BEFORE EVERY TEST ---
  66  |   test.beforeEach(async ({ page }) => {
> 67  |     await page.goto('http://localhost:5173/');
      |                ^ Error: page.goto: Test ended.
  68  | 
  69  |     // Wait for the login form to be ready
  70  |     await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
  71  | 
  72  |     // Fill credentials and submit
  73  |     await page.fill('input[name="email"]', CATERER_EMAIL);
  74  |     await page.fill('input[name="password"]', CATERER_PASSWORD);
  75  |     await page.click('button[type="submit"]');
  76  | 
  77  |     // Wait for AuthListener to redirect to /caterer
  78  |     await page.waitForURL('**/caterer', { timeout: 15000 });
  79  | 
  80  |     // Also wait until the top-bar is rendered to confirm the shell has mounted
  81  |     await expect(page.locator('.top-bar')).toBeVisible({ timeout: 10000 });
  82  |   });
  83  | 
  84  |   // ═══════════════════════════════════════════════════════════════════════════
  85  |   // GROUP 1 — Dashboard Shell  (CatererDashboard.jsx)
  86  |   // ═══════════════════════════════════════════════════════════════════════════
  87  | 
  88  |   test('should render the sidebar with all four navigation items', async ({ page }) => {
  89  |     for (const label of ['Log Waste', 'Messages', 'History', 'Feedback']) {
  90  |       await expect(page.locator('button.nav-item', { hasText: label })).toBeVisible();
  91  |     }
  92  |   });
  93  | 
  94  |   test('should display the caterer mess name in the top-bar after profile loads', async ({ page }) => {
  95  |     // The top-bar user-info section shows "Loading..." while the profile is fetching.
  96  |     // We wait for that text to disappear before asserting.
  97  |     const valueEl = page.locator('.top-bar .user-details .value');
  98  |     await expect(valueEl).not.toHaveText('Loading...', { timeout: 10000 });
  99  |     // After loading, the value must be a non-empty string (the mess name).
  100 |     const text = await valueEl.innerText();
  101 |     expect(text.trim().length).toBeGreaterThan(0);
  102 |   });
  103 | 
  104 |   // NEW: The page title in the top-bar must update to match the active tab.
  105 |   test('Shell: page title updates correctly when switching tabs', async ({ page }) => {
  106 |     const titleEl = page.locator('.top-bar .page-title');
  107 | 
  108 |     // Default tab on load is "log"
  109 |     await expect(titleEl).toHaveText('Log Daily Waste');
  110 | 
  111 |     await goToTab(page, 'Messages');
  112 |     await expect(titleEl).toHaveText('Admin Messages');
  113 | 
  114 |     await goToTab(page, 'History');
  115 |     await expect(titleEl).toHaveText('Waste History');
  116 | 
  117 |     await goToTab(page, 'Feedback');
  118 |     await expect(titleEl).toHaveText('Food Feedback (This Mess)');
  119 |   });
  120 | 
  121 |   // NEW: Active nav item gets the "active" class; inactive ones do not.
  122 |   test('Shell: active nav item has "active" class, others do not', async ({ page }) => {
  123 |     // "Log Waste" is the default active tab
  124 |     const logBtn      = page.locator('button.nav-item', { hasText: 'Log Waste' });
  125 |     const messagesBtn = page.locator('button.nav-item', { hasText: 'Messages' });
  126 | 
  127 |     await expect(logBtn).toHaveClass(/active/);
  128 |     await expect(messagesBtn).not.toHaveClass(/active/);
  129 | 
  130 |     // Switch to Messages → class should move
  131 |     await goToTab(page, 'Messages');
  132 |     await expect(messagesBtn).toHaveClass(/active/);
  133 |     await expect(logBtn).not.toHaveClass(/active/);
  134 |   });
  135 | 
  136 |   // NEW: The sidebar toggle button on desktop collapses the sidebar
  137 |   //      (nav label <span>s disappear when sidebar is closed).
  138 |   test('Shell: desktop sidebar collapses and expands via toggle button', async ({ page }) => {
  139 |     const toggleBtn = page.locator('.toggle-btn');
  140 |     await expect(toggleBtn).toBeVisible();
  141 | 
  142 |     // Before collapse: "Log Waste" label must be visible
  143 |     await expect(page.locator('button.nav-item span', { hasText: 'Log Waste' })).toBeVisible();
  144 | 
  145 |     // Collapse the sidebar
  146 |     await toggleBtn.click();
  147 | 
  148 |     // After collapse: sidebar has "closed" class, nav label span is hidden
  149 |     await expect(page.locator('.sidebar.closed')).toBeVisible({ timeout: 4000 });
  150 |     await expect(page.locator('button.nav-item span', { hasText: 'Log Waste' })).not.toBeVisible();
  151 | 
  152 |     // Re-expand
  153 |     await toggleBtn.click();
  154 |     await expect(page.locator('.sidebar.open')).toBeVisible({ timeout: 4000 });
  155 |     await expect(page.locator('button.nav-item span', { hasText: 'Log Waste' })).toBeVisible();
  156 |   });
  157 | 
  158 |   // NEW: Clicking the avatar opens the profile dropdown.
  159 |   test('Shell: clicking the avatar opens the profile dropdown', async ({ page }) => {
  160 |     // Wait for profile to load (avatar stops showing "...")
  161 |     const avatar = page.locator('.top-bar .avatar');
  162 |     await expect(avatar).not.toHaveText('...', { timeout: 10000 });
  163 | 
  164 |     // Dropdown should not be visible yet
  165 |     await expect(page.locator('.profile-dropdown')).not.toBeVisible();
  166 | 
  167 |     await avatar.click();
```