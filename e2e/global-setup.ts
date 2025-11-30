import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Starting E2E test global setup...');

  // Create a browser instance for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the frontend to be available
    console.log('Waiting for frontend to be ready...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('Frontend is ready');

    // Wait for the backend to be available
    console.log('Checking backend health...');
    const healthResponse = await page.request.get('http://localhost:8080/health');
    if (!healthResponse.ok()) {
      throw new Error(`Backend health check failed: ${healthResponse.status()}`);
    }
    console.log('Backend is healthy');

    // Setup test data or configurations if needed
    console.log('Setting up test environment...');

    // You can add any additional setup here, such as:
    // - Creating test device configurations
    // - Setting up mock data
    // - Configuring test environment variables

    console.log('Global setup completed successfully');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
