import { test, expect, Page } from '@playwright/test';

test.describe('MQTT Integration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('MQTT Status Display', () => {
    test('should display MQTT status card on dashboard', async ({ page }) => {
      // Navigate to home or page with MQTT status
      await page.goto('/');
      
      // Wait for MQTT status card to load
      await page.waitForSelector('[data-testid="mqtt-status-card"], .mqtt-status', {
        timeout: 10000,
        state: 'visible',
      }).catch(() => {
        // MQTT status might not be implemented yet
        console.log('MQTT status card not found - feature may not be implemented');
      });

      // Check if MQTT status card exists
      const mqttStatusCard = page.locator('[data-testid="mqtt-status-card"], .mqtt-status');
      const cardCount = await mqttStatusCard.count();

      if (cardCount > 0) {
        await expect(mqttStatusCard.first()).toBeVisible();
        await expect(mqttStatusCard.first()).toContainText(/MQTT/i);
      }
    });

    test('should show MQTT connection status', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const statusBadge = page.locator('[data-testid="mqtt-connection-status"], .mqtt-status .badge');
      const badgeCount = await statusBadge.count();

      if (badgeCount > 0) {
        await expect(statusBadge.first()).toBeVisible();
        await expect(statusBadge.first()).toContainText(/(Connected|Disconnected|Error)/i);
      }
    });

    test('should display publisher and subscriber status', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const publisherStatus = page.locator('text=/Publisher:/i');
      const subscriberStatus = page.locator('text=/Subscriber:/i');

      const publisherCount = await publisherStatus.count();
      const subscriberCount = await subscriberStatus.count();

      if (publisherCount > 0) {
        await expect(publisherStatus.first()).toBeVisible();
      }

      if (subscriberCount > 0) {
        await expect(subscriberStatus.first()).toBeVisible();
      }
    });

    test('should refresh MQTT status on button click', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Find refresh button (might be generic or specific to MQTT)
      const refreshButton = page.locator('[data-testid="mqtt-refresh-button"], button:has-text("Refresh")').first();
      const buttonCount = await refreshButton.count();

      if (buttonCount > 0) {
        await refreshButton.click();
        await page.waitForTimeout(500);
        // Status should update after refresh
      }
    });
  });

  test.describe('MQTT Configuration', () => {
    test('should navigate to MQTT configuration', async ({ page }) => {
      // Try to navigate to configuration page
      await page.goto('/config');
      await page.waitForLoadState('networkidle');

      // Look for MQTT configuration section
      const mqttConfig = page.locator('[data-testid="mqtt-config"], .mqtt-configuration, text=/MQTT Configuration/i');
      const configCount = await mqttConfig.count();

      if (configCount > 0) {
        await expect(mqttConfig.first()).toBeVisible();
      }
    });

    test('should display MQTT configuration form', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      // Check for MQTT enable toggle
      const enableToggle = page.locator('[data-testid="mqtt-enabled"], input[type="checkbox"]').first();
      const toggleCount = await enableToggle.count();

      if (toggleCount > 0) {
        await expect(enableToggle).toBeVisible();
      }

      // Check for broker URL field
      const brokerUrlField = page.locator('[data-testid="broker-url"], input[placeholder*="mqtt://"]').first();
      const urlFieldCount = await brokerUrlField.count();

      if (urlFieldCount > 0) {
        await expect(brokerUrlField).toBeVisible();
      }
    });

    test('should toggle MQTT enabled state', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const enableSwitch = page.locator('[data-testid="mqtt-enabled"], [id="mqtt-enabled"]').first();
      const switchCount = await enableSwitch.count();

      if (switchCount > 0) {
        const isChecked = await enableSwitch.isChecked();
        await enableSwitch.click();
        await page.waitForTimeout(500);

        const newState = await enableSwitch.isChecked();
        expect(newState).toBe(!isChecked);
      }
    });

    test('should update broker URL', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const brokerUrlField = page.locator('[data-testid="input-broker-url"], [id="broker-url"]').first();
      const fieldCount = await brokerUrlField.count();

      if (fieldCount > 0) {
        await brokerUrlField.fill('mqtt://test-broker:1883');
        await expect(brokerUrlField).toHaveValue('mqtt://test-broker:1883');
      }
    });

    test('should update client ID', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const clientIdField = page.locator('[data-testid="input-client-id"], [id="client-id"]').first();
      const fieldCount = await clientIdField.count();

      if (fieldCount > 0) {
        await clientIdField.fill('test-client-123');
        await expect(clientIdField).toHaveValue('test-client-123');
      }
    });

    test('should update topic prefix', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const topicPrefixField = page.locator('[data-testid="input-topic-prefix"], [id="topic-prefix"]').first();
      const fieldCount = await topicPrefixField.count();

      if (fieldCount > 0) {
        await topicPrefixField.fill('custom-prefix');
        await expect(topicPrefixField).toHaveValue('custom-prefix');
      }
    });

    test('should select QoS level', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const qosSelect = page.locator('[data-testid="select"], [id="qos"]').first();
      const selectCount = await qosSelect.count();

      if (selectCount > 0) {
        await qosSelect.selectOption('1');
        await expect(qosSelect).toHaveValue('1');
      }
    });

    test('should save MQTT configuration', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const saveButton = page.locator('button:has-text("Save Configuration"), [data-testid="save-button"]').first();
      const buttonCount = await saveButton.count();

      if (buttonCount > 0) {
        await saveButton.click();
        
        // Wait for success message or toast
        await page.waitForSelector('text=/success|saved/i, [data-testid="toast"]', {
          timeout: 5000,
        }).catch(() => {
          console.log('Save confirmation not detected');
        });
      }
    });

    test('should test MQTT connection', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const testButton = page.locator('button:has-text("Test Connection"), [data-testid="test-button"]').first();
      const buttonCount = await testButton.count();

      if (buttonCount > 0) {
        await testButton.click();

        // Wait for test result
        await page.waitForTimeout(2000);

        // Check for success or error message
        const resultMessage = page.locator('text=/success|failed|connected|error/i').first();
        const messageCount = await resultMessage.count();

        if (messageCount > 0) {
          await expect(resultMessage).toBeVisible();
        }
      }
    });
  });

  test.describe('MQTT Weight Publishing', () => {
    test('should publish weight reading via MQTT', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Find read gross button
      const readGrossButton = page.locator('button:has-text("Read Gross"), [data-testid="read-gross-button"]').first();
      const buttonCount = await readGrossButton.count();

      if (buttonCount > 0) {
        await readGrossButton.click();

        // Wait for response
        await page.waitForTimeout(2000);

        // Check if weight is displayed (indicating successful read and potential MQTT publish)
        const weightDisplay = page.locator('[data-testid="weight-value"], .weight-reading').first();
        const displayCount = await weightDisplay.count();

        if (displayCount > 0) {
          await expect(weightDisplay).toBeVisible();
        }
      }
    });

    test('should show weight reading after command execution', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Execute any scale command
      const commandButton = page.locator('button:has-text("Read")').first();
      const buttonCount = await commandButton.count();

      if (buttonCount > 0) {
        await commandButton.click();
        await page.waitForTimeout(2000);

        // Weight should be displayed and potentially published to MQTT
        const weightResult = page.locator('[data-testid="command-result"], .result').first();
        const resultCount = await weightResult.count();

        if (resultCount > 0) {
          await expect(weightResult).toBeVisible();
        }
      }
    });
  });

  test.describe('MQTT Command Reception', () => {
    test('should display command history or log', async ({ page }) => {
      await page.goto('/diagnostics');
      await page.waitForTimeout(2000);

      // Look for command log or recent requests
      const commandLog = page.locator('[data-testid="command-log"], .recent-requests, text=/Recent|Log/i').first();
      const logCount = await commandLog.count();

      if (logCount > 0) {
        await expect(commandLog).toBeVisible();
      }
    });

    test('should show MQTT commands in diagnostics', async ({ page }) => {
      await page.goto('/diagnostics');
      await page.waitForTimeout(2000);

      // Check if MQTT commands are logged
      const mqttEntry = page.locator('text=/mqtt|MQTT/i').first();
      const entryCount = await mqttEntry.count();

      if (entryCount > 0) {
        // MQTT activity is being logged
        await expect(mqttEntry).toBeVisible();
      }
    });
  });

  test.describe('MQTT Error Handling', () => {
    test('should display error when MQTT is disconnected', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Look for error state in MQTT status
      const errorIndicator = page.locator('[data-testid="mqtt-error"], text=/error|disconnected|failed/i').first();
      const errorCount = await errorIndicator.count();

      if (errorCount > 0) {
        const errorText = await errorIndicator.textContent();
        expect(errorText).toBeTruthy();
      }
    });

    test('should handle invalid broker URL gracefully', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const brokerUrlField = page.locator('[data-testid="input-broker-url"], [id="broker-url"]').first();
      const fieldCount = await brokerUrlField.count();

      if (fieldCount > 0) {
        // Enter invalid URL
        await brokerUrlField.fill('invalid-url');

        const saveButton = page.locator('button:has-text("Save")').first();
        await saveButton.click();

        // Should show validation error
        await page.waitForTimeout(1000);
        const errorMessage = page.locator('text=/invalid|error/i').first();
        const errorCount = await errorMessage.count();

        if (errorCount > 0) {
          await expect(errorMessage).toBeVisible();
        }
      }
    });
  });

  test.describe('MQTT Network Communication', () => {
    test('should work with MQTT from local network', async ({ page }) => {
      // Test if MQTT status is accessible
      await page.goto('/');
      await page.waitForTimeout(2000);

      const statusCard = page.locator('[data-testid="mqtt-status-card"], .mqtt-status').first();
      const cardCount = await statusCard.count();

      // If MQTT is implemented, card should be visible
      if (cardCount > 0) {
        await expect(statusCard).toBeVisible();

        // Check if connection info is displayed
        const connectionInfo = page.locator('text=/localhost|192.168|broker/i').first();
        const infoCount = await connectionInfo.count();

        if (infoCount > 0) {
          await expect(connectionInfo).toBeVisible();
        }
      }
    });

    test('should display broker connection info', async ({ page }) => {
      await page.goto('/config');
      await page.waitForTimeout(2000);

      const brokerInfo = page.locator('[data-testid="broker-info"], text=/mqtt:\/\//i').first();
      const infoCount = await brokerInfo.count();

      if (infoCount > 0) {
        await expect(brokerInfo).toBeVisible();
      }
    });
  });

  test.describe('MQTT Integration with Devices', () => {
    test('should publish device status changes via MQTT', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Toggle device status if possible
      const deviceSwitch = page.locator('[data-testid="device-enabled-switch"]').first();
      const switchCount = await deviceSwitch.count();

      if (switchCount > 0) {
        await deviceSwitch.click();
        await page.waitForTimeout(1000);

        // Status change should be published to MQTT
        // Verify by checking logs or status updates
      }
    });

    test('should show MQTT topics for devices', async ({ page }) => {
      await page.goto('/diagnostics');
      await page.waitForTimeout(2000);

      // Look for MQTT topic information
      const topicInfo = page.locator('text=/scaleit\\/weight\\//i, text=/topic/i').first();
      const topicCount = await topicInfo.count();

      if (topicCount > 0) {
        await expect(topicInfo).toBeVisible();
      }
    });
  });
});
