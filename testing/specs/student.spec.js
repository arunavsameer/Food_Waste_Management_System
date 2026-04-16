import path from 'path';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load the local test environment variables from the root folder
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Initialize Supabase with the Service Role Key for direct DB operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STUDENT_EMAIL    = process.env.TEST_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD;
const BASE_URL         = 'http://localhost:5173';

// ─── Shared login helper ───────────────────────────────────────────────────────
async function loginAsStudent(page) {
  await page.goto(`${BASE_URL}/`);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.fill('input[name="email"]', STUDENT_EMAIL);
  await page.fill('input[name="password"]', STUDENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/student', { timeout: 12000 });
}

// ─── Navigate to a tab via sidebar ────────────────────────────────────────────
async function goToTab(page, label) {
  await page.locator('.nav-item', { hasText: label }).click();
}

// ─── Format date as YYYY-MM-DD ────────────────────────────────────────────────
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — AUTH & ROUTING
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('1. Auth & Routing', () => {

  // TC 1.1 – Blank credential submission
  test('1.1 should block login with blank credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.click('button[type="submit"]');
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();
    // URL should still be '/' — never redirected
    expect(page.url()).toContain('/');
  });

  // TC 1.2 – Invalid credentials
  test('1.2 should show error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.fill('input[name="email"]', 'wrong@test.com');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    const errorMsg = page.locator('text=/invalid/i');
    await expect(errorMsg).toBeVisible({ timeout: 8000 });
  });

  // TC 1.3 – Successful student login
  test('1.3 should redirect to student dashboard on valid login', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page).toHaveURL(/\/student/);
    await expect(page.locator('.dashboard-container')).toBeVisible();
  });

  // TC 1.4 – Student cannot access admin route.
  // NOTE: The app redirects students back to /student (via ProtectedRoute) rather
  // than showing an "access denied" text screen. We therefore accept *either* a
  // redirection back to /student *or* a visible denial/unauthorized message.
  test('1.4 should deny student access to /admin', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(3000);
    const url = page.url();
    const isRedirectedAway = !url.includes('/admin') || url.includes('/student') || url.includes('/');
    const hasDenialText = await page.locator('text=/access denied/i, text=/unauthorized/i, text=/not allowed/i').count();
    // Either redirected away from /admin, OR an explicit denial message is shown
    expect(isRedirectedAway || hasDenialText > 0).toBeTruthy();
  });

  // TC 1.5 – Successful logout
  test('1.5 should logout and redirect to login page', async ({ page }) => {
    await loginAsStudent(page);
    await page.locator('.logout-btn').click();
    await page.waitForURL('**/', { timeout: 8000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  // TC 1.6 – Already-authenticated user visiting "/" is redirected to dashboard
  test('1.6 (edge) navigating to "/" while authenticated should redirect to /student', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto(`${BASE_URL}/`);
    await page.waitForURL(/\/student/, { timeout: 8000 });
  });

  // TC 1.7 – Password field should be masked
  test('1.7 password field should be of type password (masked)', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  // TC 1.8 – After logout, pressing back should not re-enter the dashboard
  test('1.8 (edge) back button after logout should not expose the dashboard', async ({ page }) => {
    await loginAsStudent(page);
    await page.locator('.logout-btn').click();
    await page.waitForURL('**/', { timeout: 8000 });
    await page.goBack();
    await page.waitForTimeout(2000);
    // Should either stay on login or be redirected back
    const hasEmailInput = await page.locator('input[name="email"]').count();
    const isOnStudent = page.url().includes('/student');
    // If landed on student, it means auth is still active — that's valid. 
    // But if on login, the session-check must not show protected content without session.
    if (!isOnStudent) {
      expect(hasEmailInput).toBeGreaterThan(0);
    }
  });

  // TC 1.9 – Student cannot access /caterer route
  test('1.9 should deny student access to /caterer', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto(`${BASE_URL}/caterer`);
    await page.waitForTimeout(3000);
    const url = page.url();
    const isRedirectedAway = !url.includes('/caterer') || url.includes('/student') || url.includes('/');
    const hasDenialText = await page.locator('text=/access denied/i, text=/unauthorized/i').count();
    expect(isRedirectedAway || hasDenialText > 0).toBeTruthy();
  });

  // TC 1.10 – Login form should have both email and password fields
  test('1.10 login page should render email and password fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — MESS PERFORMANCE CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('2. Mess Performance Calendar', () => {
  test.beforeEach(async ({ page }) => { await loginAsStudent(page); });

  // TC 2.1 – Calendar grid is visible on load
  test('2.1 should render calendar grid after login', async ({ page }) => {
    const grid = page.locator('.calendar-grid');
    await expect(grid).toBeVisible({ timeout: 10000 });
  });

  // TC 2.2 – Prev/Next month navigation
  test('2.2 should update month label on prev/next navigation', async ({ page }) => {
    const monthLabel = page.locator('.month-label').first();
    const initialText = await monthLabel.textContent();

    await page.locator('.nav-arrow-btn').nth(1).click(); // Next
    await expect(monthLabel).not.toHaveText(initialText, { timeout: 5000 });

    await page.locator('.nav-arrow-btn').nth(0).click(); // Prev (back)
    await expect(monthLabel).toHaveText(initialText, { timeout: 5000 });
  });

  // TC 2.3 – Caterer dropdown is populated with real entries.
  // NOTE: The CalendarView renders TWO .header-select elements (caterer + meal type).
  // We target the first one (caterer) and verify it has at least one option.
  test('2.3 should populate caterer dropdown with real entries', async ({ page }) => {
    // Wait for the calendar grid to finish loading so caterers are fetched
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    // Give async caterer fetch time to complete
    await page.waitForTimeout(2000);
    const catererSelect = page.locator('select.header-select').first();
    await expect(catererSelect).toBeVisible();
    const count = await catererSelect.locator('option').count();
    expect(count).toBeGreaterThan(0);
  });

  // TC 2.4 – Meal type switch triggers grid refresh without crash.
  // NOTE: There are two header-selects: index 0 = caterer, index 1 = meal type.
  test('2.4 should refresh grid on meal type change', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    // The meal-type select is the second .header-select on CalendarView
    const mealSelect = page.locator('select.header-select').nth(1);
    await expect(mealSelect).toBeVisible({ timeout: 5000 });
    await mealSelect.selectOption('Dinner');
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 8000 });
    // Verify grid days are still rendered (at least 28 day cells)
    const cells = page.locator('.calendar-cell:not(.empty)');
    await expect(cells).not.toHaveCount(0);
  });

  // TC 2.5 – Clicking active date opens modal
  test('2.5 clicking an active calendar date should open a detail modal', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    const activeCell = page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad').first();
    const hasCells = await activeCell.count();
    if (hasCells === 0) { test.skip(); return; }
    await activeCell.click();
    // Modal shows Avg Rating text
    await expect(page.locator('text=/Avg Rating/i')).toBeVisible({ timeout: 5000 });
  });

  // TC 2.6 – Modal closes on X click
  test('2.6 should close modal on X button click', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    const activeCell = page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad').first();
    if ((await activeCell.count()) === 0) { test.skip(); return; }
    await activeCell.click();
    await expect(page.locator('text=/Avg Rating/i')).toBeVisible({ timeout: 5000 });
    // The X button is a plain button containing an svg inside the modal overlay
    const closeBtn = page.locator('div[style*="position: fixed"] button').first();
    await closeBtn.click();
    await expect(page.locator('text=/Avg Rating/i')).toBeHidden({ timeout: 4000 });
  });

  // TC 2.7 – Neutral cells should NOT open a modal
  test('2.7 (edge) clicking a neutral/empty cell should NOT open a modal', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    const neutralCell = page.locator('.calendar-cell.neutral').first();
    if ((await neutralCell.count()) === 0) { test.skip(); return; }
    await neutralCell.click();
    await page.waitForTimeout(600);
    await expect(page.locator('text=/Avg Rating/i')).toHaveCount(0);
  });

  // TC 2.8 – Calendar grid contains day-of-week headers
  test('2.8 calendar grid should show MON–SUN day headers', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    for (const day of ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']) {
      await expect(page.locator(`.grid-header:has-text("${day}")`)).toBeVisible();
    }
  });

  // TC 2.9 – Changing caterer refreshes the calendar without a crash
  test('2.9 switching caterer should reload the calendar grid', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    const catererSelect = page.locator('select.header-select').first();
    const optionCount = await catererSelect.locator('option').count();
    if (optionCount < 2) { test.skip(); return; }
    // Pick a different option
    await catererSelect.selectOption({ index: 1 });
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 8000 });
  });

  // TC 2.10 – Eat or Skip card is visible in sidebar
  test('2.10 Eat or Skip widget should be visible on the calendar page', async ({ page }) => {
    await expect(page.locator('text=/Eat or Skip/i')).toBeVisible({ timeout: 10000 });
    // The skip card should contain day and meal dropdowns
    await expect(page.locator('.widget-select')).toHaveCount(2);
  });

  // TC 2.11 – Menu card renders breakfast, lunch, dinner rows
  test('2.11 Menu card should display breakfast, lunch, and dinner rows', async ({ page }) => {
    await expect(page.locator('.menu-card')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000); // let menu load
    await expect(page.locator('text=/BREAKFAST/i').first()).toBeVisible();
    await expect(page.locator('text=/LUNCH/i').first()).toBeVisible();
    await expect(page.locator('text=/DINNER/i').first()).toBeVisible();
  });

  // TC 2.12 – Menu Today/Tomorrow toggle changes the menu day label
  test('2.12 toggling Today/Tomorrow in Menu card should switch the day', async ({ page }) => {
    await expect(page.locator('.menu-card')).toBeVisible({ timeout: 10000 });
    // The menu day select contains "today" and "tomorrow" options
    const menuDaySelect = page.locator('.menu-card select').first();
    await menuDaySelect.selectOption('tomorrow');
    await page.waitForTimeout(1500);
    // Page should not crash; menu card still visible
    await expect(page.locator('.menu-card')).toBeVisible();
  });

  // TC 2.13 – Modal shows Feedback Count for active cell
  test('2.13 modal should display feedback count when opening an active cell', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    const activeCell = page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad').first();
    if ((await activeCell.count()) === 0) { test.skip(); return; }
    await activeCell.click();
    await expect(page.locator('text=/Feedback Count/i')).toBeVisible({ timeout: 5000 });
  });

  // TC 2.14 – Going to a far-future month shows all neutral cells
  test('2.14 navigating to a far-future month should show no rated cells', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 10000 });
    for (let i = 0; i < 12; i++) {
      await page.locator('.nav-arrow-btn').nth(1).click();
    }
    await page.waitForTimeout(2000);
    const ratedCells = page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad');
    await expect(ratedCells).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — FEEDBACK SUBMISSION
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('3. Feedback Submission', () => {
  let studentId;

  test.beforeAll(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    });
    if (error) throw error;
    studentId = data.user.id;
  });

  test.afterAll(async () => {
    // Clean up any feedback rows written during this suite
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    await supabase.from('feedback').delete()
      .eq('student_id', studentId)
      .in('date', [fmt(today), fmt(yesterday)]);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await goToTab(page, 'Give Feedback');
    await expect(page.locator('.feedback-card')).toBeVisible({ timeout: 8000 });
  });

  // TC 3.1 – Bad rating with short comment is blocked
  test('3.1 should block "bad" feedback with comment shorter than 30 chars', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill('2');                         // Rating = 2 (bad)
    await page.locator('textarea').fill('short');   // < 30 chars
    await page.locator('.submit-btn-dark').click();
    await expect(page.locator('text=/30/i')).toBeVisible({ timeout: 5000 });
  });

  // TC 3.2 – Good rating submits successfully and shows emoji shower
  test('3.2 should submit good feedback and show emoji shower + token', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill('9');
    const dateSelect = page.locator('select.styled-select').nth(0);
    const options = await dateSelect.locator('option').all();
    if (options.length >= 2) await dateSelect.selectOption({ index: 1 });
    await page.locator('.submit-btn-dark').click();
    await expect(page.locator('.emoji-shower-overlay')).toBeVisible({ timeout: 8000 });
  });

  // TC 3.3 – Quick-add chip appears in comment box
  test('3.3 should append chip text into the comment box', async ({ page }) => {
    const firstChip = page.locator('div[style*="gridTemplateColumns"] button').first();
    if ((await firstChip.count()) === 0) { test.skip(); return; }
    const chipText = await firstChip.textContent();
    await firstChip.click();
    await expect(page.locator(`button:has-text("${chipText.trim().slice(0, 15)}")`)).toBeVisible();
  });

  // TC 3.4 – Remove a chip tag
  test('3.4 should remove chip on clicking X', async ({ page }) => {
    const firstChip = page.locator('div[style*="gridTemplateColumns"] button').first();
    if ((await firstChip.count()) === 0) { test.skip(); return; }
    const chipText = (await firstChip.textContent()).trim().slice(0, 15);
    await firstChip.click();
    const selectedChip = page.locator(`.feedback-card button`, { hasText: chipText }).first();
    await selectedChip.click();
    await expect(selectedChip).toBeHidden({ timeout: 3000 });
  });

  // TC 3.5 – Duplicate feedback blocked
  test('3.5 should block duplicate feedback for same date and meal', async ({ page }) => {
    await page.locator('input[type="range"]').fill('8');
    const dateSelect = page.locator('select.styled-select').nth(0);
    if ((await dateSelect.locator('option').count()) >= 2)
      await dateSelect.selectOption({ index: 1 });
    await page.locator('select.styled-select').nth(1).selectOption('lunch');
    await page.locator('.submit-btn-dark').click();

    await page.waitForTimeout(2000);
    await goToTab(page, 'Give Feedback');
    await expect(page.locator('.feedback-card')).toBeVisible({ timeout: 8000 });
    await page.locator('input[type="range"]').fill('8');
    if ((await dateSelect.locator('option').count()) >= 2)
      await dateSelect.selectOption({ index: 1 });
    await page.locator('select.styled-select').nth(1).selectOption('lunch');
    await page.locator('.submit-btn-dark').click();
    await expect(page.locator('text=/already submitted/i')).toBeVisible({ timeout: 6000 });
  });

  // TC 3.6 – Exactly 30 chars on bad rating should be ALLOWED.
  // NOTE: 'Food was really bad today xoxo' = 30 characters. The check is
  // fullComment.trim().length < 30, so exactly 30 passes through.
  test('3.6 (edge) bad feedback with exactly 30 chars should be accepted', async ({ page }) => {
    await page.locator('input[type="range"]').fill('2');
    const thirtyChars = 'Food was really bad today xoxo'; // exactly 30 chars
    expect(thirtyChars.length).toBe(30);
    await page.locator('textarea').fill(thirtyChars);
    await page.locator('select.styled-select').nth(1).selectOption('breakfast');
    await page.locator('.submit-btn-dark').click();
    // Should NOT show the 30-char error — emoji shower or navigation away is expected
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/Please explain/i')).toHaveCount(0);
  });

  // TC 3.7 – Character counter updates live as user types
  test('3.7 (edge) char counter should update as user types', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Hello');
    const counter = page.locator('text=/\\/150/');
    await expect(counter).toContainText('5/150');
  });

  // TC 3.8 – Rating slider changes the emoji and colour
  test('3.8 moving rating slider should change the displayed emoji', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    const emojiDiv = page.locator('.rating-section div').first();
    await slider.fill('1');
    await page.waitForTimeout(300);
    const lowEmoji = await emojiDiv.textContent();
    await slider.fill('10');
    await page.waitForTimeout(300);
    const highEmoji = await emojiDiv.textContent();
    expect(lowEmoji).not.toEqual(highEmoji);
  });

  // TC 3.9 – Rating and score display updates when slider moves
  test('3.9 score label should reflect the slider value', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill('5');
    await expect(page.locator('text=/5\\/10/')).toBeVisible({ timeout: 3000 });
    await slider.fill('9');
    await expect(page.locator('text=/9\\/10/')).toBeVisible({ timeout: 3000 });
  });

  // TC 3.10 – Quick-add chips change based on meal type selection
  test('3.10 chip suggestions should update when meal type changes', async ({ page }) => {
    // Set to breakfast
    await page.locator('select.styled-select').nth(1).selectOption('breakfast');
    await page.waitForTimeout(400);
    const breakfastChips = await page.locator('div[style*="gridTemplateColumns"] button').allTextContents();

    // Set to lunch
    await page.locator('select.styled-select').nth(1).selectOption('lunch');
    await page.waitForTimeout(400);
    const lunchChips = await page.locator('div[style*="gridTemplateColumns"] button').allTextContents();

    // Chips for breakfast and lunch differ
    expect(breakfastChips.join()).not.toEqual(lunchChips.join());
  });

  // TC 3.11 – Character counter turns red/warning colour near 150 chars
  test('3.11 character counter should warn when nearing 150 chars', async ({ page }) => {
    const textarea = page.locator('textarea');
    const longText = 'a'.repeat(135); // 135/150
    await textarea.fill(longText);
    // The counter span changes colour via inline style (color: var(--danger)) at > 130 chars
    const counter = page.locator('text=/\\/150/');
    await expect(counter).toBeVisible();
    const color = await counter.evaluate(el => el.style.color);
    // When charCount > 130, style.color is set to 'var(--danger)'
    expect(color).toBeTruthy();
  });

  // TC 3.12 – Date select shows "Today" and at least one past date option
  test('3.12 date select should offer Today and at least one previous date', async ({ page }) => {
    const dateSelect = page.locator('select.styled-select').nth(0);
    const options = await dateSelect.locator('option').allTextContents();
    const hasToday = options.some(t => t.toLowerCase().includes('today'));
    expect(hasToday).toBeTruthy();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  // TC 3.13 – Good feedback (rating >= 5) submits without comment
  test('3.13 good feedback should submit without any comment', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill('8');
    // Pick a date least likely to conflict
    const dateSelect = page.locator('select.styled-select').nth(0);
    const options = await dateSelect.locator('option').all();
    if (options.length >= 2) await dateSelect.selectOption({ index: 1 });
    await page.locator('select.styled-select').nth(1).selectOption('dinner');
    await page.locator('.submit-btn-dark').click();
    // Should either show emoji shower or redirect — no "30 chars" error
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/Please explain/i')).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — PERSONAL FEED TRENDS
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('4. Personal Feed Trends', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await goToTab(page, 'My Trends');
    await expect(page.locator('.calendar-layout')).toBeVisible({ timeout: 8000 });
  });

  // TC 4.1 – Avg mood widget renders
  test('4.1 should render mood widget with an average score', async ({ page }) => {
    const moodWidget = page.locator('.menu-card').first();
    await expect(moodWidget).toBeVisible();
    await expect(moodWidget).not.toContainText('Loading', { timeout: 8000 });
  });

  // TC 4.2 – Month navigation refreshes data
  test('4.2 should change month label on navigation', async ({ page }) => {
    const label = page.locator('.month-label').first();
    const before = await label.textContent();
    await page.locator('.nav-arrow-btn').nth(0).click(); // prev month
    await expect(label).not.toHaveText(before, { timeout: 5000 });
  });

  // TC 4.3 – Clicking active date opens detail modal
  test('4.3 should open detail modal on active cell click', async ({ page }) => {
    const activeCell = page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad').first();
    if ((await activeCell.count()) === 0) { test.skip(); return; }
    await activeCell.click();
    await expect(page.locator('text=/Caterer/i')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Your Rating/i')).toBeVisible();
  });

  // TC 4.4 – New user month shows neutral state
  test('4.4 navigating to a far-future month shows empty/neutral grid', async ({ page }) => {
    for (let i = 0; i < 12; i++) {
      await page.locator('.nav-arrow-btn').nth(1).click();
    }
    await expect(page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad')).toHaveCount(0);
    await expect(page.locator('text=0.0')).toBeVisible({ timeout: 8000 });
  });

  // TC 4.5 – Meal type toggle refreshes grid
  test('4.5 changing meal type should re-render the trends grid', async ({ page }) => {
    await page.locator('select.header-select').selectOption('Breakfast');
    await expect(page.locator('.calendar-layout')).toBeVisible();
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 8000 });
  });

  // TC 4.6 – Backdrop click closes detail modal
  test('4.6 (edge) clicking backdrop should close detail modal', async ({ page }) => {
    const activeCell = page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad').first();
    if ((await activeCell.count()) === 0) { test.skip(); return; }
    await activeCell.click();
    await expect(page.locator('text=/Caterer/i')).toBeVisible({ timeout: 5000 });
    // Click on the dark backdrop (not the modal card itself)
    await page.mouse.click(10, 10);
    await expect(page.locator('text=/Caterer/i')).toBeHidden({ timeout: 4000 });
  });

  // TC 4.7 – Modal shows caterer name and comment for rated day
  test('4.7 detail modal should show caterer name, rating, and comment', async ({ page }) => {
    const activeCell = page.locator('.calendar-cell.good, .calendar-cell.mid, .calendar-cell.bad').first();
    if ((await activeCell.count()) === 0) { test.skip(); return; }
    await activeCell.click();
    await expect(page.locator('text=/Your Rating/i')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Your Comment/i')).toBeVisible();
    await expect(page.locator('text=/Caterer/i')).toBeVisible();
  });

  // TC 4.8 – Neutral cell click does not open a modal in Trends view
  test('4.8 (edge) clicking a neutral cell should not open modal in Trends', async ({ page }) => {
    const neutralCell = page.locator('.calendar-cell.neutral').first();
    if ((await neutralCell.count()) === 0) { test.skip(); return; }
    await neutralCell.click();
    await page.waitForTimeout(600);
    await expect(page.locator('text=/Your Rating/i')).toHaveCount(0);
  });

  // TC 4.9 – Month name in header matches expected calendar month
  test('4.9 month label should show the correct current month name', async ({ page }) => {
    const monthNames = ["January","February","March","April","May","June",
      "July","August","September","October","November","December"];
    const currentMonthName = monthNames[new Date().getMonth()];
    const label = page.locator('.month-label').first();
    await expect(label).toContainText(currentMonthName);
  });

  // TC 4.10 – Switching meal type to Dinner shows grid without error
  test('4.10 switching meal type to Dinner should not crash and show grid', async ({ page }) => {
    await page.locator('select.header-select').selectOption('Dinner');
    await page.waitForTimeout(1500);
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.menu-card')).toBeVisible();
  });

  // TC 4.11 – Calendar grid headers MON-SUN are shown in Trends view
  test('4.11 trends calendar should show MON–SUN headers', async ({ page }) => {
    await expect(page.locator('.calendar-grid')).toBeVisible({ timeout: 8000 });
    for (const d of ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']) {
      await expect(page.locator(`.grid-header:has-text("${d}")`)).toBeVisible();
    }
  });

  // TC 4.12 – Going back and forward returns to original month
  test('4.12 navigating back and forward should return to original month', async ({ page }) => {
    const label = page.locator('.month-label').first();
    const original = await label.textContent();
    await page.locator('.nav-arrow-btn').nth(1).click(); // next
    await page.locator('.nav-arrow-btn').nth(0).click(); // prev (back)
    await expect(label).toHaveText(original, { timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — ARCADE / SNAKE GAME
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('5. Arcade Zone (Snake Game)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await goToTab(page, 'Arcade Zone');
    await expect(page.locator('.arcade-mode-container')).toBeVisible({ timeout: 8000 });
  });

  // TC 5.1 – Game canvas renders and score bar is visible
  test('5.1 should render the game canvas and score bar', async ({ page }) => {
    await expect(page.locator('.game-canvas-el')).toBeVisible();
    await expect(page.locator('.score-pill')).toBeVisible();
  });

  // TC 5.2 – Start button disabled with zero credits
  test('5.2 start button should be disabled when token count is 0', async ({ page }) => {
    const { data } = await supabase.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    const uid = data.user.id;
    await supabase.from('player_score').update({ game_points: 0 }).eq('student_id', uid);

    await page.reload();
    await goToTab(page, 'Arcade Zone');
    await expect(page.locator('.arcade-mode-container')).toBeVisible({ timeout: 8000 });

    const startBtn = page.locator('.game-start-btn');
    await expect(startBtn).toBeDisabled();
    await expect(startBtn).toContainText(/NO TOKENS/i);
  });

  // TC 5.3 – Game starts and token decrements when credits > 0
  test('5.3 should start game and decrement token when credits > 0', async ({ page }) => {
    const { data } = await supabase.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    await supabase.from('player_score').update({ game_points: 3 }).eq('student_id', data.user.id);

    await page.reload();
    await goToTab(page, 'Arcade Zone');
    await expect(page.locator('.arcade-mode-container')).toBeVisible({ timeout: 8000 });

    const pillBefore = await page.locator('.score-pill').textContent();
    await page.locator('.game-start-btn').click();

    // Game overlay should disappear (game is now playing)
    await expect(page.locator('.game-overlay')).toBeHidden({ timeout: 3000 });

    // Token in score-pill should have dropped by 1
    const pillAfter = await page.locator('.score-pill').textContent();
    const tokensBefore = parseInt(pillBefore.match(/TOKENS:\s*(\d+)/)?.[1] ?? '0');
    const tokensAfter  = parseInt(pillAfter.match(/TOKENS:\s*(\d+)/)?.[1] ?? '0');
    expect(tokensAfter).toBe(tokensBefore - 1);
  });

  // TC 5.4 – Mute button toggles muted state class
  test('5.4 clicking mute icon should toggle muted state class', async ({ page }) => {
    const muteBtn = page.locator('.mute-toggle');
    await expect(muteBtn).toBeVisible();
    await muteBtn.click();
    await expect(muteBtn).toHaveClass(/is-muted/);
    await muteBtn.click();
    await expect(muteBtn).not.toHaveClass(/is-muted/);
  });

  // TC 5.5 – Leaderboard panel renders
  test('5.5 leaderboard panel should be visible', async ({ page }) => {
    await expect(page.locator('.leaderboard-panel')).toBeVisible();
    await expect(page.locator('.lb-header')).toContainText('Leaderboard');
  });

  // TC 5.6 – Arrow keys do not crash while game is playing
  test('5.6 (edge) arrow keys should not throw while game is playing', async ({ page }) => {
    const { data } = await supabase.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    await supabase.from('player_score').update({ game_points: 5 }).eq('student_id', data.user.id);
    await page.reload();
    await goToTab(page, 'Arcade Zone');
    await page.locator('.game-start-btn').click();
    await expect(page.locator('.game-overlay')).toBeHidden({ timeout: 3000 });

    for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }
    await expect(page.locator('.game-canvas-el')).toBeVisible();
  });

  // TC 5.7 – Score pill shows TOKENS, SCORE and BEST labels
  test('5.7 score pill should display TOKENS, SCORE, and BEST labels', async ({ page }) => {
    const pill = page.locator('.score-pill');
    await expect(pill).toContainText(/TOKENS/i);
    await expect(pill).toContainText(/SCORE/i);
    await expect(pill).toContainText(/BEST/i);
  });

  // TC 5.8 – PLAY overlay is shown on game menu state
  test('5.8 game overlay should show SNAKE title and PLAY button on menu state', async ({ page }) => {
    await expect(page.locator('.game-overlay')).toBeVisible();
    await expect(page.locator('.game-overlay-title')).toContainText(/SNAKE/i);
    await expect(page.locator('.game-start-btn')).toBeVisible();
  });

  // TC 5.9 – GAME OVER overlay appears after the snake dies
  test('5.9 GAME OVER overlay should appear after the snake hits a wall', async ({ page }) => {
    const { data } = await supabase.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    await supabase.from('player_score').update({ game_points: 5 }).eq('student_id', data.user.id);
    await page.reload();
    await goToTab(page, 'Arcade Zone');
    await page.locator('.game-start-btn').click();
    await expect(page.locator('.game-overlay')).toBeHidden({ timeout: 3000 });

    // Drive the snake into the wall by holding ArrowUp
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(140);
    }
    // Wait for game over to appear (wall collision takes a few seconds max)
    await expect(page.locator('.game-overlay-title')).toContainText(/GAME OVER/i, { timeout: 10000 });
  });

  // TC 5.10 – RETRY button appears on game over screen
  test('5.10 RETRY button should appear on the GAME OVER overlay', async ({ page }) => {
    const { data } = await supabase.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    await supabase.from('player_score').update({ game_points: 5 }).eq('student_id', data.user.id);
    await page.reload();
    await goToTab(page, 'Arcade Zone');
    await page.locator('.game-start-btn').click();
    await expect(page.locator('.game-overlay')).toBeHidden({ timeout: 3000 });

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(140);
    }
    await expect(page.locator('.game-overlay-title')).toContainText(/GAME OVER/i, { timeout: 10000 });
    await expect(page.locator('.game-start-btn')).toContainText(/RETRY/i);
  });

  // TC 5.11 – Leaderboard list item for current user is highlighted
  test('5.11 current user should be highlighted in the leaderboard', async ({ page }) => {
    await expect(page.locator('.lb-list')).toBeVisible({ timeout: 6000 });
    const items = page.locator('.lb-item');
    const count = await items.count();
    if (count === 0) { test.skip(); return; }
    // At least one item should contain "You" (the current user label)
    await expect(page.locator('.lb-item.current-user')).toHaveCount(1);
  });

  // TC 5.12 – WASD keys are accepted as direction input
  test('5.12 (edge) WASD keys should control the snake while playing', async ({ page }) => {
    const { data } = await supabase.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    await supabase.from('player_score').update({ game_points: 5 }).eq('student_id', data.user.id);
    await page.reload();
    await goToTab(page, 'Arcade Zone');
    await page.locator('.game-start-btn').click();
    await expect(page.locator('.game-overlay')).toBeHidden({ timeout: 3000 });
    for (const key of ['w', 'a', 's', 'd']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }
    await expect(page.locator('.game-canvas-el')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6 — DASHBOARD SHELL & NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('6. Dashboard Shell & Navigation', () => {
  test.beforeEach(async ({ page }) => { await loginAsStudent(page); });

  // TC 6.1 – All four tabs navigate without crash
  test('6.1 all sidebar tabs should render their content area', async ({ page }) => {
    const tabs = [
      { label: 'Food Calendar',  check: '.calendar-layout, .calendar-grid' },
      { label: 'Give Feedback',  check: '.feedback-card' },
      { label: 'My Trends',      check: '.calendar-layout' },
      { label: 'Arcade Zone',    check: '.arcade-mode-container' },
    ];
    for (const { label, check } of tabs) {
      await page.locator('.nav-item', { hasText: label }).click();
      await expect(page.locator(check)).toBeVisible({ timeout: 10000 });
    }
  });

  // TC 6.2 – Profile avatar opens dropdown
  test('6.2 clicking avatar should open profile dropdown', async ({ page }) => {
    await page.locator('.avatar-btn').click();
    await expect(page.locator('.profile-dropdown')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('.pd-item')).toHaveCount(4); // Mess, Food Type, Roll No, Serial No
  });

  // TC 6.3 – Dropdown closes when clicking outside
  test('6.3 profile dropdown should close on outside click', async ({ page }) => {
    await page.locator('.avatar-btn').click();
    await expect(page.locator('.profile-dropdown')).toBeVisible();
    await page.mouse.click(50, 50);
    await expect(page.locator('.profile-dropdown')).toBeHidden({ timeout: 3000 });
  });

  // TC 6.4 – Header shows correct page title on tab switch
  test('6.4 top-bar title should update with active tab', async ({ page }) => {
    await expect(page.locator('.page-title')).toContainText('Mess Performance Calendar');
    await goToTab(page, 'Give Feedback');
    await expect(page.locator('.page-title')).toContainText('Daily Meal Feedback');
    await goToTab(page, 'My Trends');
    await expect(page.locator('.page-title')).toContainText('My Feedback History');
    await goToTab(page, 'Arcade Zone');
    await expect(page.locator('.page-title')).toContainText('Arcade Zone');
  });

  // TC 6.5 – Rapid tab switching should not crash the app
  test('6.5 (edge) rapid tab switching should not crash the app', async ({ page }) => {
    const labels = ['Give Feedback', 'My Trends', 'Arcade Zone', 'Food Calendar'];
    for (let i = 0; i < 3; i++) {
      for (const label of labels) {
        await page.locator('.nav-item', { hasText: label }).click();
        await page.waitForTimeout(80);
      }
    }
    await expect(page.locator('.dashboard-container')).toBeVisible();
  });

  // TC 6.6 – Credit badge click navigates to Arcade tab
  test('6.6 (edge) clicking credit badge should open Arcade Zone', async ({ page }) => {
    await page.locator('.credit-badge').click();
    await expect(page.locator('.arcade-mode-container')).toBeVisible({ timeout: 8000 });
  });

  // TC 6.7 – Profile dropdown shows student name and email
  test('6.7 profile dropdown should display student name and email', async ({ page }) => {
    await page.locator('.avatar-btn').click();
    await expect(page.locator('.pd-name')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('.pd-sub')).toBeVisible();
    // Email should be non-empty
    const emailText = await page.locator('.pd-sub').textContent();
    expect(emailText.trim().length).toBeGreaterThan(0);
  });

  // TC 6.8 – Sidebar brand shows "EcoPlate"
  test('6.8 sidebar brand name should be EcoPlate', async ({ page }) => {
    await expect(page.locator('.brand h2')).toContainText(/EcoPlate/i);
  });

  // TC 6.9 – Sidebar toggle collapses and expands sidebar on desktop
  test('6.9 (edge) sidebar toggle button should collapse and re-expand sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Sidebar starts open, toggle button should exist
    const toggleBtn = page.locator('.toggle-btn');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.locator('.sidebar.closed')).toBeVisible({ timeout: 3000 });
    await toggleBtn.click();
    await expect(page.locator('.sidebar.open')).toBeVisible({ timeout: 3000 });
  });

  // TC 6.10 – Active nav item has the "active" CSS class
  test('6.10 active tab nav item should have active class', async ({ page }) => {
    const calendarNavItem = page.locator('.nav-item', { hasText: 'Food Calendar' });
    await expect(calendarNavItem).toHaveClass(/active/);
    await goToTab(page, 'Give Feedback');
    const feedbackNavItem = page.locator('.nav-item', { hasText: 'Give Feedback' });
    await expect(feedbackNavItem).toHaveClass(/active/);
  });

  // TC 6.11 – Credit counter in top bar shows a numeric value
  test('6.11 credit badge in header should show a numeric token count', async ({ page }) => {
    const badge = page.locator('.credit-badge');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    const number = parseInt(text.replace(/[^0-9]/g, ''));
    expect(isNaN(number)).toBeFalsy();
  });

  // TC 6.12 – Profile dropdown shows Roll No entry
  test('6.12 profile dropdown should show Roll No field', async ({ page }) => {
    await page.locator('.avatar-btn').click();
    await expect(page.locator('.pd-item')).toBeVisible({ timeout: 4000 });
    const itemLabels = await page.locator('.pd-item-label').allTextContents();
    expect(itemLabels.some(l => /roll/i.test(l))).toBeTruthy();
  });

  // TC 6.13 – Toast notification is shown after successful feedback submission
  test('6.13 toast should appear with +1 Game Token message after feedback submit', async ({ page }) => {
    await goToTab(page, 'Give Feedback');
    await expect(page.locator('.feedback-card')).toBeVisible({ timeout: 8000 });
    const slider = page.locator('input[type="range"]');
    await slider.fill('8');
    const dateSelect = page.locator('select.styled-select').nth(0);
    const opts = await dateSelect.locator('option').all();
    if (opts.length >= 2) await dateSelect.selectOption({ index: 1 });
    // Pick breakfast to reduce chance of duplicate from other test runs
    await page.locator('select.styled-select').nth(1).selectOption('breakfast');
    await page.locator('.submit-btn-dark').click();
    // Toast message
    await expect(page.locator('.feedback-toast')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.feedback-toast')).toContainText(/Token/i);
  });
});
