import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || '1bd0c9e2-9cb3-46d4-9fe4-fdeeda6fffff';

const AUTH_EMAIL = 'ashannimsara1234@gmail.com';
const AUTH_PASSWORD = '87654321';

// ─── Helper to simulate authenticated admin session ──────────────────────────
async function setupAuthenticatedSession(page: any) {
  // 1. Generate a valid signed JWT with the expected secret so Next.js middleware verifies it
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({
    userId: 'admin-test-uid',
    email: AUTH_EMAIL,
    role: 'SUPER_ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  const mockUser = {
    uid: 'admin-test-uid',
    name: 'Ashan Nimsara',
    email: AUTH_EMAIL,
    role: 'SUPER_ADMIN',
  };

  // 2. Set the httpOnly cookie required by Next.js proxy / middleware (src/proxy.ts)
  await page.context().addCookies([
    {
      name: 'token',
      value: token,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  // 3. Inject client-side localStorage and splash flag before any scripts run
  await page.addInitScript(
    ({ t, u }) => {
      window.localStorage.setItem('token', t);
      window.localStorage.setItem('user', JSON.stringify(u));
      window.sessionStorage.setItem('navsense_splash_seen', 'true');
    },
    { t: token, u: mockUser }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PUBLIC ROUTES & AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────
test.describe('1. Public Entry & Authentication', () => {
  test('Root page loads with NavSense title', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/NavSense/);
  });

  test('Login page displays all form elements and action buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const loginCard = page.locator('.login-card');
    await expect(loginCard.getByRole('heading', { name: 'NavSense' })).toBeVisible();
    await expect(loginCard.getByText('Smart Campus Monitoring System')).toBeVisible();

    // Inputs & buttons
    await expect(loginCard.getByPlaceholder('admin@navsense.io')).toBeVisible();
    await expect(loginCard.getByPlaceholder('••••••••')).toBeVisible();
    await expect(loginCard.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(loginCard.getByRole('button', { name: 'Forgot Password?' })).toBeVisible();
    await expect(loginCard.getByRole('button', { name: '⚡ Intro Splash' })).toBeVisible();
  });

  test('Forgot Password toggle switches between forms correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const loginCard = page.locator('.login-card');

    // Click Forgot Password
    await loginCard.getByRole('button', { name: 'Forgot Password?' }).click();
    await expect(loginCard.getByText('Enter your Email')).toBeVisible();
    await expect(loginCard.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();

    // Click Back to Login
    await loginCard.getByRole('button', { name: 'Back to Login' }).click();
    await expect(loginCard.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(loginCard.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('User can sign in with credentials via login form', async ({ page }) => {
    // Avoid splash screen by setting sessionStorage flag
    await page.addInitScript(() => {
      window.sessionStorage.setItem('navsense_splash_seen', 'true');
    });

    await page.goto(`${BASE_URL}/login`);

    const loginCard = page.locator('.login-card');
    await loginCard.getByPlaceholder('admin@navsense.io').fill(AUTH_EMAIL);
    await loginCard.getByPlaceholder('••••••••').fill(AUTH_PASSWORD);
    await loginCard.getByRole('button', { name: 'Sign In' }).click();

    // Verify successful authentication redirects to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('Unauthenticated user is redirected to /login when visiting protected pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/.*\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DASHBOARD & GLOBAL LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
test.describe('2. Dashboard & Layout (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  test('Dashboard loads with stat cards and live status', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Top navbar elements
    await expect(page.locator('.top-navbar-status')).toContainText('Operational');
    await expect(page.locator('.top-navbar-search input')).toBeVisible();

    // Page header
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Stat cards (scoped to .card-grid to avoid strict mode violations with section headings and widgets)
    const cardGrid = page.locator('.card-grid');
    await expect(cardGrid.getByText('Total Buildings')).toBeVisible();
    await expect(cardGrid.getByText('Total Rooms')).toBeVisible();
    await expect(cardGrid.getByText('Occupied Rooms')).toBeVisible();
    await expect(cardGrid.getByText('Active Sensors')).toBeVisible();
    await expect(cardGrid.getByText('Active Alerts')).toBeVisible();

    // Table section heading
    await expect(page.getByRole('heading', { name: 'Occupied Rooms' })).toBeVisible();

    // Recent readings section
    await expect(page.getByRole('heading', { name: 'Recent Readings' })).toBeVisible();
  });

  test('Sidebar contains all navigation links and can be collapsed', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Check main navigation links
    await expect(sidebar.getByRole('link', { name: /Dashboard/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Buildings/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Rooms/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Alerts/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Analytics/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Reports/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Settings/ })).toBeVisible();

    // Toggle collapse button
    const toggleBtn = page.locator('.sidebar-toggle-btn');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.locator('.app-layout')).toHaveClass(/sidebar-is-collapsed/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CORE CAMPUS PAGES
// ─────────────────────────────────────────────────────────────────────────────
test.describe('3. Core Campus Feature Pages', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  test('Buildings page loads with header and Add Building button', async ({ page }) => {
    await page.goto(`${BASE_URL}/buildings`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Buildings', exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: /Add Building/ })).toBeVisible();
  });

  test('Rooms page loads with header and Add Room button', async ({ page }) => {
    await page.goto(`${BASE_URL}/rooms`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Rooms', exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: /Add Room/ })).toBeVisible();
  });

  test('Alerts page loads with header and status view', async ({ page }) => {
    await page.goto(`${BASE_URL}/alerts`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Alerts & Room Status' })).toBeVisible();
  });

  test('Analytics page loads successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  });

  test('Reports page loads with category tabs and filters', async ({ page }) => {
    await page.goto(`${BASE_URL}/reports`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await expect(page.locator('.report-tabs')).toBeVisible();
  });

  test('Settings page loads with configuration tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.locator('.settings-tabs')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. USER LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
test.describe('4. Session Termination', () => {
  test('Logout button clears session and redirects to /login', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.goto(`${BASE_URL}/dashboard`);

    // Click logout
    const logoutBtn = page.locator('.sidebar-logout-btn');
    await logoutBtn.click();

    // Verify redirected to login
    await expect(page).toHaveURL(/.*\/login/);

    // Verify token was removed
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
