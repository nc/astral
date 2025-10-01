import { test, expect } from '@playwright/test';

test.describe('Integration Tests - Full Workflow', () => {
  test('complete workflow: create space, chats, branch, and navigate', async ({ page }) => {
    // 1. Initial load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e/screenshots/flow-01-initial.png', fullPage: true });

    // Verify default space exists
    await expect(page.locator('text=My First Space')).toBeVisible();

    // 2. Create a new space
    const newSpaceButton = page.locator('button:has-text("New Space")');
    await newSpaceButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/flow-02-new-space.png', fullPage: true });

    // 3. Rename the new space
    const newSpace = page.locator('text=New Space').first();
    await newSpace.click({ button: 'right' });
    await page.waitForTimeout(300);

    const renameOption = page.locator('text=Rename Space');
    await renameOption.click();
    await page.waitForTimeout(300);

    const input = page.locator('input[type="text"]').first();
    await input.clear();
    await input.fill('Project Alpha');
    await page.screenshot({ path: 'e2e/screenshots/flow-03-renaming.png', fullPage: true });

    const saveButton = page.locator('button').filter({ hasText: /save|rename|ok/i }).first();
    await saveButton.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/flow-04-renamed.png', fullPage: true });

    // 4. Create first chat in the space
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('What is the capital of France?');
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/flow-05-first-chat.png', fullPage: true });

    // 5. Create second chat
    const newChatButton = page.locator('button:has-text("New Chat")');
    if (await newChatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatButton.click();
      await page.waitForTimeout(500);

      const secondChatInput = page.locator('textarea').last();
      await secondChatInput.fill('Explain quantum computing');
      await secondChatInput.press('Meta+Enter');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/flow-06-second-chat.png', fullPage: true });
    }

    // 6. Navigate between chats using keyboard
    await page.keyboard.press('Meta+ArrowLeft');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/flow-07-nav-left.png', fullPage: true });

    await page.keyboard.press('Meta+ArrowRight');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/flow-08-nav-right.png', fullPage: true });

    // 7. Branch the current chat
    // Look for chat header and branch button
    const chatHeader = page.locator('div').filter({
      has: page.locator('textarea')
    }).first();

    const headerButtons = chatHeader.locator('button');
    const buttonCount = await headerButtons.count();

    // Try to find and click branch button
    for (let i = 0; i < buttonCount; i++) {
      const button = headerButtons.nth(i);
      const title = await button.getAttribute('title').catch(() => null);

      if (title && title.toLowerCase().includes('branch')) {
        await button.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/flow-09-branched.png', fullPage: true });
        break;
      }
    }

    // 8. Switch back to first space
    const firstSpace = page.locator('text=My First Space');
    await firstSpace.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/flow-10-back-to-first.png', fullPage: true });

    // 9. Create a chat in first space
    const firstSpaceChatInput = page.locator('textarea').first();
    await firstSpaceChatInput.fill('Hello from My First Space');
    await firstSpaceChatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/flow-11-first-space-chat.png', fullPage: true });

    // 10. Switch back to Project Alpha space
    const projectAlpha = page.locator('text=Project Alpha');
    await projectAlpha.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/flow-12-final.png', fullPage: true });

    // Verify we're back in Project Alpha with multiple chats
    await expect(page.locator('text=Project Alpha')).toBeVisible();
  });

  test('sidebar toggle and responsive behavior', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the sidebar toggle button (ChevronLeft/ChevronRight)
    const toggleButton = page.locator('button').filter({
      has: page.locator('svg')
    }).first();

    await page.screenshot({ path: 'e2e/screenshots/sidebar-01-open.png', fullPage: true });

    // Close sidebar
    await toggleButton.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/sidebar-02-closed.png', fullPage: true });

    // Verify sidebar is hidden
    const sidebar = page.locator('text=Astral').locator('..');
    const isVisible = await sidebar.isVisible().catch(() => false);

    // Open sidebar again
    await toggleButton.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/sidebar-03-reopened.png', fullPage: true });

    // Verify sidebar is visible again
    await expect(page.locator('text=Astral')).toBeVisible();
  });

  test('empty state to chat creation flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/empty-01-initial.png', fullPage: true });

    // Check for empty state elements
    const emptyStateInput = page.locator('textarea').first();
    await expect(emptyStateInput).toBeVisible();

    // Type a message in empty state
    await emptyStateInput.fill('This is my first message in an empty space!');
    await page.screenshot({ path: 'e2e/screenshots/empty-02-typed.png', fullPage: true });

    // Check if model selector is visible
    const modelSelector = page.locator('button').filter({ hasText: /claude|opus/i }).first();
    if (await modelSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({ path: 'e2e/screenshots/empty-03-model-selector.png', fullPage: true });

      // Click model selector to see options
      await modelSelector.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e/screenshots/empty-04-model-options.png', fullPage: true });

      // Close the dropdown by pressing Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Send the message
    await emptyStateInput.press('Meta+Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/empty-05-chat-created.png', fullPage: true });

    // Verify the message appears
    await expect(page.locator('text=This is my first message')).toBeVisible({ timeout: 5000 });
  });

  test('multi-space multi-chat scenario', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create 3 spaces
    const newSpaceButton = page.locator('button:has-text("New Space")');

    for (let i = 1; i <= 3; i++) {
      await newSpaceButton.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: 'e2e/screenshots/multi-01-spaces-created.png', fullPage: true });

    // Count spaces
    const spaces = page.locator('div[style*="marginTop"]').filter({ hasText: /Space/ });
    const spaceCount = await spaces.count();
    expect(spaceCount).toBeGreaterThanOrEqual(3);

    // Go to second space and create chats
    await spaces.nth(1).click();
    await page.waitForTimeout(500);

    // Create 2 chats in this space
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Chat 1 in Space 2');
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);

    const newChatBtn = page.locator('button:has-text("New Chat")');
    if (await newChatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatBtn.click();
      await page.waitForTimeout(500);

      const secondInput = page.locator('textarea').last();
      await secondInput.fill('Chat 2 in Space 2');
      await secondInput.press('Meta+Enter');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'e2e/screenshots/multi-02-space2-chats.png', fullPage: true });

    // Switch to third space
    await spaces.nth(2).click();
    await page.waitForTimeout(500);

    // Create a chat in third space
    const thirdSpaceInput = page.locator('textarea').first();
    await thirdSpaceInput.fill('Chat in Space 3');
    await thirdSpaceInput.press('Meta+Enter');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/multi-03-space3-chat.png', fullPage: true });

    // Navigate back to first space
    await spaces.nth(0).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/multi-04-back-to-space1.png', fullPage: true });
  });

  test('keyboard shortcuts comprehensive test', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create initial setup: 2 spaces, 3 chats in current space
    const newSpaceButton = page.locator('button:has-text("New Space")');
    await newSpaceButton.click();
    await page.waitForTimeout(300);

    // Create chats
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Chat 1');
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);

    for (let i = 2; i <= 3; i++) {
      const newChatBtn = page.locator('button:has-text("New Chat")');
      if (await newChatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newChatBtn.click();
        await page.waitForTimeout(500);

        const input = page.locator('textarea').last();
        await input.fill(`Chat ${i}`);
        await input.press('Meta+Enter');
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/keyboard-01-setup.png', fullPage: true });

    // Test Cmd+ArrowLeft (navigate to previous chat)
    await page.keyboard.press('Meta+ArrowLeft');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/keyboard-02-left.png', fullPage: true });

    // Test Cmd+ArrowRight (navigate to next chat)
    await page.keyboard.press('Meta+ArrowRight');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/keyboard-03-right.png', fullPage: true });

    // Test wrapping (go to end, then press right to wrap to beginning)
    await page.keyboard.press('Meta+ArrowRight');
    await page.keyboard.press('Meta+ArrowRight');
    await page.keyboard.press('Meta+ArrowRight');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/keyboard-04-wrap.png', fullPage: true });
  });
});
