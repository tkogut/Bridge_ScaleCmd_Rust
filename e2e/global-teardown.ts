import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('Starting E2E test global teardown...');

  try {
    // Clean up any test data or configurations
    console.log('Cleaning up test environment...');

    // You can add cleanup operations here, such as:
    // - Removing test device configurations
    // - Clearing test databases
    // - Resetting application state
    // - Cleaning up temporary files

    // Example: Reset device configurations to default state
    // const browser = await chromium.launch();
    // const page = await browser.newPage();
    // await page.request.delete('http://localhost:8080/api/config/test-devices');
    // await browser.close();

    console.log('Global teardown completed successfully');
  } catch (error) {
    console.error('Global teardown failed:', error);
    // Don't throw error to prevent test failures due to cleanup issues
    console.warn('Continuing despite teardown errors...');
  }
}

export default globalTeardown;
