import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 120_000,          // חיפושי אלקטרוניקה אמיתיים אורכים עשרות שניות
  expect: { timeout: 30_000 },
  fullyParallel: false,      // מקורות המידע החיצוניים לא אוהבים עומס מקבילי
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3777',
    locale: 'he-IL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
