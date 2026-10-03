import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env['GRIDTWIN_BASE_URL'] ?? 'http://127.0.0.1:18480',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: false,
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 8000,
  },
});
