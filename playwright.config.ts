import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
    testDir: 'e2e',
    timeout: 30_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
    },
    projects: [
        { name: 'phone', use: { ...devices['Pixel 7'] } },
        { name: 'phone-landscape', use: { ...devices['Pixel 7 landscape'] } },
        { name: 'iphone', use: { ...devices['iPhone 14'] } },
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    ],
    webServer: {
        command: 'npm run build && npm run preview',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
