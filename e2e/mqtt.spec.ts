import { test, expect } from '@playwright/test';

test.describe('MQTT Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock MQTT API responses for consistent testing
    await page.route('**/api/mqtt/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          connected: true,
          broker_url: 'mqtt://localhost:1883',
          client_id: 'scaleit-bridge-test',
          topic_prefix: 'scaleit',
          devices_with_history: 2,
          total_weight_readings: 150,
          total_status_updates: 45
        })
      });
    });

    await page.route('**/api/mqtt/devices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          devices: [
            {
              device_id: 'c320tcp',
              weight_readings_count: 100,
              status_updates_count: 30,
              last_weight_reading: {
                device_id: 'c320tcp',
                weight: 42.5,
                unit: 'kg',
                timestamp: Date.now() / 1000,
                is_stable: true,
                recorded_at: new Date().toISOString()
              },
              last_status_update: {
                device_id: 'c320tcp',
                status: 'connected',
                timestamp: Date.now() / 1000,
                recorded_at: new Date().toISOString()
              }
            },
            {
              device_id: 'dini01',
              weight_readings_count: 50,
              status_updates_count: 15,
              last_weight_reading: {
                device_id: 'dini01',
                weight: 125.3,
                unit: 'kg',
                timestamp: Date.now() / 1000 - 60,
                is_stable: true,
                recorded_at: new Date(Date.now() - 60000).toISOString()
              },
              last_status_update: null
            }
          ],
          total_count: 2
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('MQTT Status Card', () => {
    test('should display MQTT Status card on dashboard', async ({ page }) => {
      // Look for MQTT Status card
      await expect(page.getByText('MQTT Status')).toBeVisible({ timeout: 10000 });
    });

    test('should show connected status when MQTT is enabled', async ({ page }) => {
      // Wait for the status to load
      await page.waitForTimeout(2000);

      // Should show "Connected" badge
      await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 10000 });
    });

    test('should display broker URL', async ({ page }) => {
      await page.waitForTimeout(2000);

      await expect(page.getByText('mqtt://localhost:1883')).toBeVisible({ timeout: 10000 });
    });

    test('should display client ID', async ({ page }) => {
      await page.waitForTimeout(2000);

      await expect(page.getByText('scaleit-bridge-test')).toBeVisible({ timeout: 10000 });
    });

    test('should display topic prefix', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Should show the topic prefix
      const topicPrefix = page.getByText('scaleit').first();
      await expect(topicPrefix).toBeVisible({ timeout: 10000 });
    });

    test('should display history statistics', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Should show statistics section
      await expect(page.getByText('History Statistics')).toBeVisible({ timeout: 10000 });

      // Should show devices count
      await expect(page.getByText('Devices').first()).toBeVisible();

      // Should show readings count
      await expect(page.getByText('Readings').first()).toBeVisible();

      // Should show updates count
      await expect(page.getByText('Updates').first()).toBeVisible();
    });

    test('should show disabled status when MQTT is disabled', async ({ page }) => {
      // Override mock to return disabled status
      await page.route('**/api/mqtt/status', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: false,
            connected: false,
            broker_url: '',
            client_id: '',
            topic_prefix: 'scaleit',
            devices_with_history: 0,
            total_weight_readings: 0,
            total_status_updates: 0
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await expect(page.getByText('Disabled')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('MQTT is disabled')).toBeVisible({ timeout: 10000 });
    });

    test('should show disconnected status when not connected', async ({ page }) => {
      // Override mock to return disconnected status
      await page.route('**/api/mqtt/status', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: true,
            connected: false,
            broker_url: 'mqtt://localhost:1883',
            client_id: 'scaleit-bridge',
            topic_prefix: 'scaleit',
            devices_with_history: 0,
            total_weight_readings: 0,
            total_status_updates: 0
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await expect(page.getByText('Disconnected')).toBeVisible({ timeout: 10000 });
    });

    test('should have a refresh button', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Find MQTT Status card and look for refresh button within it
      const mqttCard = page.locator('text=MQTT Status').locator('xpath=ancestor::div[contains(@class, "card")]');
      const refreshButton = mqttCard.getByRole('button');

      await expect(refreshButton).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('MQTT History Panel', () => {
    test('should display MQTT History card on dashboard', async ({ page }) => {
      await expect(page.getByText('MQTT History')).toBeVisible({ timeout: 10000 });
    });

    test('should show device selector', async ({ page }) => {
      await page.waitForTimeout(2000);

      await expect(page.getByText('Select Device')).toBeVisible({ timeout: 10000 });
    });

    test('should show no devices message when empty', async ({ page }) => {
      // Override mock to return no devices
      await page.route('**/api/mqtt/devices', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            devices: [],
            total_count: 0
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await expect(page.getByText(/No devices with MQTT history found/)).toBeVisible({ timeout: 10000 });
    });

    test('should auto-select first device', async ({ page }) => {
      // Add routes for device history
      await page.route('**/api/mqtt/history/c320tcp/latest', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            latest_weight: {
              device_id: 'c320tcp',
              weight: 42.5,
              unit: 'kg',
              timestamp: Date.now() / 1000,
              is_stable: true,
              recorded_at: new Date().toISOString()
            },
            latest_status: {
              device_id: 'c320tcp',
              status: 'connected',
              timestamp: Date.now() / 1000,
              recorded_at: new Date().toISOString()
            }
          })
        });
      });

      await page.route('**/api/mqtt/history/c320tcp/stats', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: '2026-01-14T10:00:00Z',
            last_weight_reading: '2026-01-14T12:00:00Z',
            first_status_update: '2026-01-14T10:00:00Z',
            last_status_update: '2026-01-14T12:00:00Z'
          })
        });
      });

      await page.route('**/api/mqtt/history/c320tcp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            weight_readings: [
              {
                device_id: 'c320tcp',
                weight: 42.5,
                unit: 'kg',
                timestamp: Date.now() / 1000,
                is_stable: true,
                recorded_at: new Date().toISOString()
              }
            ],
            status_updates: [],
            total_weight_readings: 100,
            total_status_updates: 30
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Should show statistics for the auto-selected device
      await expect(page.getByText('Statistics')).toBeVisible({ timeout: 10000 });
    });

    test('should display latest reading for selected device', async ({ page }) => {
      // Add mock for latest reading
      await page.route('**/api/mqtt/history/*/latest', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            latest_weight: {
              device_id: 'c320tcp',
              weight: 42.5,
              unit: 'kg',
              timestamp: Date.now() / 1000,
              is_stable: true,
              recorded_at: new Date().toISOString()
            },
            latest_status: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*/stats', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: '2026-01-14T10:00:00Z',
            last_weight_reading: '2026-01-14T12:00:00Z',
            first_status_update: null,
            last_status_update: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*', async route => {
        // Only match the base history endpoint, not sub-paths
        const url = route.request().url();
        if (!url.includes('/latest') && !url.includes('/stats') && !url.includes('/status')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              device_id: 'c320tcp',
              weight_readings: [],
              status_updates: [],
              total_weight_readings: 100,
              total_status_updates: 30
            })
          });
        } else {
          await route.continue();
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Should show latest reading section
      await expect(page.getByText('Latest Reading')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/42\.5/)).toBeVisible({ timeout: 10000 });
    });

    test('should display statistics for selected device', async ({ page }) => {
      // Set up mocks
      await page.route('**/api/mqtt/history/*/latest', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            latest_weight: null,
            latest_status: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*/stats', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            weight_readings_count: 500,
            status_updates_count: 100,
            first_weight_reading: '2026-01-14T08:00:00Z',
            last_weight_reading: '2026-01-14T16:00:00Z',
            first_status_update: '2026-01-14T08:00:00Z',
            last_status_update: '2026-01-14T16:00:00Z'
          })
        });
      });

      await page.route('**/api/mqtt/history/*', async route => {
        const url = route.request().url();
        if (!url.includes('/latest') && !url.includes('/stats') && !url.includes('/status')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              device_id: 'c320tcp',
              weight_readings: [],
              status_updates: [],
              total_weight_readings: 500,
              total_status_updates: 100
            })
          });
        } else {
          await route.continue();
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Should show statistics section
      await expect(page.getByText('Statistics')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Weight Readings')).toBeVisible();
      await expect(page.getByText('Status Updates')).toBeVisible();
    });

    test('should show delete history button', async ({ page }) => {
      // Set up basic mocks
      await page.route('**/api/mqtt/history/*/latest', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            latest_weight: null,
            latest_status: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*/stats', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: null,
            last_weight_reading: null,
            first_status_update: null,
            last_status_update: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*', async route => {
        const url = route.request().url();
        if (!url.includes('/latest') && !url.includes('/stats') && !url.includes('/status')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              device_id: 'c320tcp',
              weight_readings: [],
              status_updates: [],
              total_weight_readings: 0,
              total_status_updates: 0
            })
          });
        } else {
          await route.continue();
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Should show delete button
      await expect(page.getByText('Delete History')).toBeVisible({ timeout: 10000 });
    });

    test('should show confirmation dialog when delete is clicked', async ({ page }) => {
      // Set up basic mocks
      await page.route('**/api/mqtt/history/*/latest', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            latest_weight: null,
            latest_status: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*/stats', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: null,
            last_weight_reading: null,
            first_status_update: null,
            last_status_update: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*', async route => {
        const url = route.request().url();
        if (!url.includes('/latest') && !url.includes('/stats') && !url.includes('/status')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              device_id: 'c320tcp',
              weight_readings: [],
              status_updates: [],
              total_weight_readings: 0,
              total_status_updates: 0
            })
          });
        } else {
          await route.continue();
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Click delete button
      await page.getByText('Delete History').click();

      // Should show confirmation dialog
      await expect(page.getByText('Delete MQTT History')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Are you sure/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
    });

    test('should cancel delete when Cancel is clicked', async ({ page }) => {
      // Set up basic mocks
      await page.route('**/api/mqtt/history/*/latest', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            latest_weight: null,
            latest_status: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*/stats', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            device_id: 'c320tcp',
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: null,
            last_weight_reading: null,
            first_status_update: null,
            last_status_update: null
          })
        });
      });

      await page.route('**/api/mqtt/history/*', async route => {
        const url = route.request().url();
        if (!url.includes('/latest') && !url.includes('/stats') && !url.includes('/status')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              device_id: 'c320tcp',
              weight_readings: [],
              status_updates: [],
              total_weight_readings: 0,
              total_status_updates: 0
            })
          });
        } else {
          await route.continue();
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Click delete button
      await page.getByText('Delete History').click();
      await page.waitForTimeout(500);

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should be closed
      await expect(page.getByText('Delete MQTT History')).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('MQTT API Error Handling', () => {
    test('should handle MQTT status API error gracefully', async ({ page }) => {
      await page.route('**/api/mqtt/status', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Application should still be functional
      await expect(page.getByText('MQTT Status')).toBeVisible({ timeout: 10000 });
    });

    test('should handle MQTT devices API error gracefully', async ({ page }) => {
      await page.route('**/api/mqtt/devices', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should show error message in history panel
      await expect(page.getByText(/Error/)).toBeVisible({ timeout: 10000 });
    });

    test('should handle network timeout gracefully', async ({ page }) => {
      await page.route('**/api/mqtt/status', async route => {
        // Delay response to simulate timeout
        await new Promise(resolve => setTimeout(resolve, 10000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: true,
            connected: true,
            broker_url: 'mqtt://localhost:1883',
            client_id: 'scaleit-bridge',
            topic_prefix: 'scaleit',
            devices_with_history: 0,
            total_weight_readings: 0,
            total_status_updates: 0
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Application should still be functional
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('MQTT Integration with Dashboard', () => {
    test('should display MQTT components alongside other dashboard elements', async ({ page }) => {
      // Check that MQTT components coexist with existing dashboard elements
      await expect(page.getByText('MQTT Status')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('MQTT History')).toBeVisible({ timeout: 10000 });

      // Check for other dashboard elements (from existing tests)
      await expect(page.getByText('Dashboard')).toBeVisible();
    });

    test('should update MQTT status independently of other components', async ({ page }) => {
      let statusCallCount = 0;

      await page.route('**/api/mqtt/status', async route => {
        statusCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: true,
            connected: statusCallCount > 1, // Simulate connection after first call
            broker_url: 'mqtt://localhost:1883',
            client_id: 'scaleit-bridge',
            topic_prefix: 'scaleit',
            devices_with_history: statusCallCount,
            total_weight_readings: statusCallCount * 50,
            total_status_updates: statusCallCount * 10
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // The component should have made at least one API call
      expect(statusCallCount).toBeGreaterThanOrEqual(1);
    });
  });
});
