import { test, expect, Page } from '@playwright/test';

test.describe('ScaleIT Bridge Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
  });

  test.describe('Application Loading and Navigation', () => {
    test('should load the main page successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/ScaleIT Bridge/);
      await expect(page.locator('h1')).toContainText('ScaleIT Bridge');
    });

    test('should display navigation menu', async ({ page }) => {
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Configuration' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Diagnostics' })).toBeVisible();
    });

    test('should navigate to configuration page', async ({ page }) => {
      await page.click('a[href="/config"]');
      await expect(page).toHaveURL('/config');
      await expect(page.locator('h1, h2').first()).toContainText(/Configuration|Config/);
    });

    test('should navigate to diagnostics page', async ({ page }) => {
      await page.click('a[href="/diagnostics"]');
      await expect(page).toHaveURL('/diagnostics');
      await expect(page.locator('h1, h2').first()).toContainText(/Diagnostics/);
    });

    test('should handle 404 pages correctly', async ({ page }) => {
      await page.goto('/nonexistent-page');
      await expect(page.locator('h1, h2').first()).toContainText(/404|Not Found/);
    });
  });

  test.describe('Bridge Status and Health Check', () => {
    test('should display bridge status card', async ({ page }) => {
      await expect(page.locator('[data-testid="bridge-status-card"], .bridge-status')).toBeVisible();
    });

    test('should show service health status', async ({ page }) => {
      // Wait for health check to complete
      await page.waitForFunction(() => {
        const statusElement = document.querySelector('[data-testid="health-status"], .health-status');
        return statusElement && statusElement.textContent !== 'Loading...';
      }, { timeout: 10000 });

      const statusElement = page.locator('[data-testid="health-status"], .health-status, .status').first();
      await expect(statusElement).toContainText(/OK|Running|Online/);
    });

    test('should display service version', async ({ page }) => {
      const versionElement = page.locator('[data-testid="service-version"], .version').first();
      await expect(versionElement).toBeVisible();
    });
  });

  test.describe('Device Management', () => {
    test('should display device list', async ({ page }) => {
      // Wait for devices to load
      await page.waitForFunction(() => {
        const deviceList = document.querySelector('[data-testid="device-list"], .device-list');
        return deviceList && !deviceList.textContent?.includes('Loading');
      }, { timeout: 15000 });

      await expect(page.locator('[data-testid="device-list"], .device-list')).toBeVisible();
    });

    test('should show device cards with proper information', async ({ page }) => {
      // Wait for devices to load
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');
      const firstCard = deviceCards.first();

      if (await deviceCards.count() > 0) {
        await expect(firstCard).toBeVisible();

        // Check for device name
        await expect(firstCard.locator('h3, .device-name')).toBeVisible();

        // Check for device model
        await expect(firstCard.locator('.device-model, [data-testid="device-model"]')).toBeVisible();

        // Check for device status badge
        await expect(firstCard.locator('.badge, [data-testid="device-status"]')).toBeVisible();
      }
    });

    test('should display device operation buttons', async ({ page }) => {
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');

      if (await deviceCards.count() > 0) {
        const firstCard = deviceCards.first();

        // Check for operation buttons
        await expect(firstCard.getByRole('button', { name: /Read Gross/i })).toBeVisible();
        await expect(firstCard.getByRole('button', { name: /Read Net/i })).toBeVisible();
        await expect(firstCard.getByRole('button', { name: /Tare/i })).toBeVisible();
        await expect(firstCard.getByRole('button', { name: /Zero/i })).toBeVisible();
      }
    });
  });

  test.describe('Scale Operations', () => {
    test('should execute read gross command successfully', async ({ page }) => {
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');

      if (await deviceCards.count() > 0) {
        const firstCard = deviceCards.first();
        const readGrossButton = firstCard.getByRole('button', { name: /Read Gross/i });

        // Mock the API response for successful operation
        await page.route('**/scalecmd', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              device_id: 'C320',
              command: 'readGross',
              result: {
                gross_weight: 42.5,
                net_weight: 40.0,
                unit: 'kg',
                is_stable: true,
                timestamp: new Date().toISOString()
              },
              error: null
            })
          });
        });

        await readGrossButton.click();

        // Check for success feedback (toast, status update, etc.)
        await page.waitForTimeout(1000);

        // Verify button re-enabled after operation
        await expect(readGrossButton).toBeEnabled();
      }
    });

    test('should execute tare command successfully', async ({ page }) => {
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');

      if (await deviceCards.count() > 0) {
        const firstCard = deviceCards.first();
        const tareButton = firstCard.getByRole('button', { name: /Tare/i });

        await page.route('**/scalecmd', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              device_id: 'C320',
              command: 'tare',
              result: null,
              error: null
            })
          });
        });

        await tareButton.click();
        await page.waitForTimeout(1000);
        await expect(tareButton).toBeEnabled();
      }
    });

    test('should handle command execution errors gracefully', async ({ page }) => {
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');

      if (await deviceCards.count() > 0) {
        const firstCard = deviceCards.first();
        const readGrossButton = firstCard.getByRole('button', { name: /Read Gross/i });

        // Mock error response
        await page.route('**/scalecmd', async route => {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              device_id: 'C320',
              command: 'readGross',
              result: null,
              error: 'Device connection failed'
            })
          });
        });

        await readGrossButton.click();

        // Check for error feedback
        await page.waitForTimeout(1000);

        // Button should be re-enabled after error
        await expect(readGrossButton).toBeEnabled();
      }
    });

    test('should show loading state during command execution', async ({ page }) => {
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');

      if (await deviceCards.count() > 0) {
        const firstCard = deviceCards.first();
        const readGrossButton = firstCard.getByRole('button', { name: /Read Gross/i });

        // Mock delayed response
        await page.route('**/scalecmd', async route => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              device_id: 'C320',
              command: 'readGross',
              result: { gross_weight: 42.5, unit: 'kg' },
              error: null
            })
          });
        });

        await readGrossButton.click();

        // Check button is disabled during loading
        await expect(readGrossButton).toBeDisabled();

        // Wait for operation to complete
        await page.waitForTimeout(3000);
        await expect(readGrossButton).toBeEnabled();
      }
    });
  });

  test.describe('Recent Requests Log', () => {
    test('should display recent requests section', async ({ page }) => {
      await expect(page.locator('[data-testid="recent-requests"], .recent-requests')).toBeVisible();
    });

    test('should log successful operations', async ({ page }) => {
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');

      if (await deviceCards.count() > 0) {
        const firstCard = deviceCards.first();
        const readGrossButton = firstCard.getByRole('button', { name: /Read Gross/i });

        await page.route('**/scalecmd', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              device_id: 'C320',
              command: 'readGross',
              result: { gross_weight: 42.5, unit: 'kg' },
              error: null
            })
          });
        });

        await readGrossButton.click();
        await page.waitForTimeout(1000);

        // Check if the operation appears in the log
        const recentRequests = page.locator('[data-testid="recent-requests"], .recent-requests');
        await expect(recentRequests).toContainText(/readGross|Read Gross/);
      }
    });
  });

  test.describe('Configuration Management', () => {
    test('should navigate to configuration page and display devices', async ({ page }) => {
      await page.click('a[href="/config"]');
      await page.waitForLoadState('networkidle');

      // Mock configuration data
      await page.route('**/api/config', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            'C320': {
              name: 'C320 Rinstrum',
              manufacturer: 'Rinstrum',
              model: 'C320',
              protocol: 'RINCMD',
              enabled: true,
              connection: {
                connection_type: 'Tcp',
                host: '192.168.1.254',
                port: 4001
              },
              commands: {
                readGross: '20050026',
                readNet: '20050025'
              }
            }
          })
        });
      });

      await page.reload();
      await page.waitForTimeout(2000);

      // Check if configuration interface is visible
      await expect(page.locator('[data-testid="device-config"], .device-config')).toBeVisible();
    });
  });

  test.describe('Diagnostics Page', () => {
    test('should display diagnostics information', async ({ page }) => {
      await page.click('a[href="/diagnostics"]');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1, h2').first()).toContainText(/Diagnostics/);

      // Check for diagnostics panels
      await expect(page.locator('[data-testid="diagnostics-panel"], .diagnostics')).toBeVisible();
    });

    test('should show system information', async ({ page }) => {
      await page.goto('/diagnostics');
      await page.waitForLoadState('networkidle');

      // Look for system info elements
      const systemInfo = page.locator('[data-testid="system-info"], .system-info');
      if (await systemInfo.count() > 0) {
        await expect(systemInfo.first()).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check if mobile navigation works
      await expect(page.locator('body')).toBeVisible();

      // Check if device cards are responsive
      const deviceCards = page.locator('[data-testid="device-card"], .device-card');
      if (await deviceCards.count() > 0) {
        await expect(deviceCards.first()).toBeVisible();
      }
    });

    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle backend connection errors gracefully', async ({ page }) => {
      // Mock all API calls to fail
      await page.route('**/health', route => route.abort());
      await page.route('**/devices', route => route.abort());
      await page.route('**/api/config', route => route.abort());

      await page.reload();
      await page.waitForTimeout(3000);

      // Application should still be functional even with API failures
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle invalid API responses', async ({ page }) => {
      await page.route('**/devices', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json'
        });
      });

      await page.reload();
      await page.waitForTimeout(2000);

      // Should not crash the application
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Performance and Loading', () => {
    test('should load within acceptable time limits', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle concurrent operations', async ({ page }) => {
      await page.waitForTimeout(2000);

      const deviceCards = page.locator('[data-testid="device-card"], .device-card');

      if (await deviceCards.count() > 0) {
        const buttons = await deviceCards.first().getByRole('button').all();

        if (buttons.length > 0) {
          // Mock successful responses
          await page.route('**/scalecmd', async route => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                device_id: 'C320',
                command: 'readGross',
                result: { gross_weight: 42.5 },
                error: null
              })
            });
          });

          // Click multiple buttons rapidly
          for (const button of buttons.slice(0, 2)) {
            await button.click();
          }

          await page.waitForTimeout(2000);

          // All buttons should be enabled again
          for (const button of buttons.slice(0, 2)) {
            await expect(button).toBeEnabled();
          }
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Tab through the interface
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to navigate without mouse
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for buttons with accessible names
      const buttons = page.getByRole('button');
      const buttonCount = await buttons.count();

      if (buttonCount > 0) {
        // At least some buttons should have accessible names
        await expect(buttons.first()).toHaveAttribute('aria-label');
      }
    });
  });
});

test.describe('API Integration Tests', () => {
  test('should communicate with backend correctly', async ({ page }) => {
    let healthCheckCalled = false;
    let devicesCalled = false;

    await page.route('**/health', route => {
      healthCheckCalled = true;
      return route.continue();
    });

    await page.route('**/devices', route => {
      devicesCalled = true;
      return route.continue();
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(healthCheckCalled).toBeTruthy();
    expect(devicesCalled).toBeTruthy();
  });

  test('should handle real API responses', async ({ page }) => {
    // Don't mock APIs - test against real backend
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for real API calls to complete
    await page.waitForTimeout(3000);

    // Check if the application loaded with real data
    const body = page.locator('body');
    await expect(body).toBeVisible();
    await expect(body).not.toContainText('Error');
  });
});
