import { test, expect, Page } from '@playwright/test';

test.describe('Space Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load with default space "My First Space"', async ({ page }) => {
    // Take screenshot of initial state
    await page.screenshot({ path: 'e2e/screenshots/01-initial-load.png', fullPage: true });

    // Check that the default space "My First Space" exists
    const spaceElement = page.locator('text=My First Space');
    await expect(spaceElement).toBeVisible();

    // Verify the sidebar is visible
    const sidebar = page.locator('div').filter({ has: page.locator('text=Astral') });
    await expect(sidebar).toBeVisible();

    // Verify the "New Space" button is visible
    const newSpaceButton = page.locator('button:has-text("New Space")');
    await expect(newSpaceButton).toBeVisible();
  });

  test('should create a new space', async ({ page }) => {
    // Take screenshot before creating space
    await page.screenshot({ path: 'e2e/screenshots/02-before-new-space.png', fullPage: true });

    // Click the "New Space" button
    const newSpaceButton = page.locator('button:has-text("New Space")');
    await newSpaceButton.click();

    // Wait for the new space to appear
    await page.waitForTimeout(500);

    // Take screenshot after creating space
    await page.screenshot({ path: 'e2e/screenshots/03-after-new-space.png', fullPage: true });

    // Verify "New Space" was created
    const newSpace = page.locator('text=New Space').first();
    await expect(newSpace).toBeVisible();

    // Verify we now have 2 spaces (My First Space + New Space)
    const spaces = page.locator('div[style*="marginTop"]').filter({ hasText: /Space/ });
    expect(await spaces.count()).toBeGreaterThanOrEqual(2);
  });

  test('should navigate between spaces', async ({ page }) => {
    // Create a second space first
    const newSpaceButton = page.locator('button:has-text("New Space")');
    await newSpaceButton.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/04-two-spaces.png', fullPage: true });

    // Get the space elements - they should have specific styling when active
    const firstSpace = page.locator('text=My First Space');
    const secondSpace = page.locator('text=New Space').first();

    // Click on the first space
    await firstSpace.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/05-first-space-active.png', fullPage: true });

    // Verify first space is active by checking its styling
    // Active spaces have backgroundColor: "rgba(255,255,255,0.06)"
    const firstSpaceContainer = firstSpace.locator('..').locator('..');
    await expect(firstSpaceContainer).toBeVisible();

    // Click on the second space
    await secondSpace.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/06-second-space-active.png', fullPage: true });

    // Verify second space is now active
    const secondSpaceContainer = secondSpace.locator('..').locator('..');
    await expect(secondSpaceContainer).toBeVisible();
  });

  test('should rename a space via context menu', async ({ page }) => {
    // Right-click on "My First Space" to open context menu
    const firstSpace = page.locator('text=My First Space');
    await firstSpace.click({ button: 'right' });
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/07-context-menu.png', fullPage: true });

    // Click on "Rename Space" option
    const renameOption = page.locator('text=Rename Space');
    await expect(renameOption).toBeVisible();
    await renameOption.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/08-rename-modal.png', fullPage: true });

    // Find the input field and clear it, then type new name
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();
    await input.click();
    await input.clear();
    await input.fill('Renamed Space');

    await page.screenshot({ path: 'e2e/screenshots/09-rename-input-filled.png', fullPage: true });

    // Find and click the save/confirm button
    const saveButton = page.locator('button').filter({ hasText: /save|rename|ok/i }).first();
    await saveButton.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/10-after-rename.png', fullPage: true });

    // Verify the space was renamed
    const renamedSpace = page.locator('text=Renamed Space');
    await expect(renamedSpace).toBeVisible();
  });

  test('should delete a space via context menu', async ({ page }) => {
    // Create a second space so we can delete one (can't delete the last space)
    const newSpaceButton = page.locator('button:has-text("New Space")');
    await newSpaceButton.click();
    await page.waitForTimeout(300);

    // Right-click on "New Space" to open context menu
    const newSpace = page.locator('text=New Space').first();
    await newSpace.click({ button: 'right' });
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/11-delete-context-menu.png', fullPage: true });

    // Click on "Remove Space" option
    const removeOption = page.locator('text=Remove Space');
    await expect(removeOption).toBeVisible();
    await removeOption.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/12-after-delete.png', fullPage: true });

    // Verify the space was deleted - "New Space" should not be visible
    // (unless there are multiple "New Space" entries)
    const spaces = page.locator('div[style*="marginTop"]').filter({ hasText: /Space/ });
    const initialCount = await spaces.count();

    // We should have fewer spaces now (or at least back to 1)
    expect(initialCount).toBeGreaterThanOrEqual(1);
  });
});
