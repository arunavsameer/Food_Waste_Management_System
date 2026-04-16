import path from 'path'; 
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load the local test environment variables from the root folder
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Initialize Supabase with the Service Role Key for database cleanup
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD;

test.describe('Student Portal: Calendar & Skip Logic', () => {
  let studentId;

  // --- SETUP & TEARDOWN ---
  test.beforeAll(async () => {
    // Authenticate to get the UUID for database verification later
    const { data, error } = await supabase.auth.signInWithPassword({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    });
    if (error) throw error;
    studentId = data.user.id;
  });

  test.afterAll(async () => {
    // Scrub the database of any skips created during the test run
    await supabase.from('skip_table').delete().eq('student_id', studentId);
  });

  // --- THE TESTS ---
  
  test.beforeEach(async ({ page }) => {
    // Based on App.jsx, the Login page is at the root route '/'
    await page.goto('http://localhost:5173/');

    // Ensure the login form is rendered
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Perform Login
    await page.fill('input[name="email"]', STUDENT_EMAIL);
    await page.fill('input[name="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for AuthListener in App.jsx to redirect to the student dashboard
    await page.waitForURL('**/student', { timeout: 10000 });
  });

  test('should load the calendar, caterer dropdown, and menu', async ({ page }) => {
    // 1. Verify the Caterer dropdown is populated with the seeded data
    const catererSelect = page.locator('select.header-select').first();
    await expect(catererSelect).toContainText('Test Mess');

    // 2. Verify the Calendar Grid renders
    const calendarGrid = page.locator('.calendar-grid');
    await expect(calendarGrid).toBeVisible();
    
    // 3. Verify the Menu loads successfully (doesn't get stuck on Loading)
    const menuCard = page.locator('.menu-card');
    await expect(menuCard).toBeVisible();
    await expect(menuCard).not.toContainText('Loading...', { timeout: 10000 });
  });

  test('should allow a student to skip a meal for tomorrow', async ({ page }) => {
    // 1. Target the skip widget
    const skipWidget = page.locator('.eat-skip-card');
    await expect(skipWidget).toBeVisible();

    // 2. Select 'Tomorrow' and 'Dinner' to ensure we are outside the 4-hour cutoff
    const daySelect = skipWidget.locator('select.widget-select').nth(0);
    const mealSelect = skipWidget.locator('select.widget-select').nth(1);
    
    await daySelect.selectOption('Tomorrow');
    await mealSelect.selectOption('Dinner');

    // 3. Click the skip button
    const skipButton = page.locator('button.action-btn', { hasText: 'Skip This Meal' });
    await skipButton.click();

    // 4. Assert the Success UI state appears
    const successCard = page.locator('.eat-skip-card.success-mode');
    await expect(successCard).toBeVisible();
    await expect(successCard).toContainText('Skipped!');

    // 5. Direct Database Verification
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedTomorrow = tomorrow.toISOString().split('T')[0];

    const { data: skipRecords } = await supabase
      .from('skip_table')
      .select('*')
      .eq('student_id', studentId)
      .eq('date', formattedTomorrow)
      .eq('menu_type', 'dinner');

    expect(skipRecords.length).toBe(1);
  });
});