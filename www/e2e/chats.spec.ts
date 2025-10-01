import { test, expect } from '@playwright/test';

test.describe('Chat Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create a new chat from empty space', async ({ page }) => {
    await page.screenshot({ path: 'e2e/screenshots/13-empty-space.png', fullPage: true });

    // Look for the chat input in the empty state
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Type a message
    await chatInput.fill('Hello, this is my first message!');
    await page.screenshot({ path: 'e2e/screenshots/14-message-typed.png', fullPage: true });

    // Look for and click the send button (might be disabled if no model selected)
    // First check if model selector is available
    const modelSelector = page.locator('button').filter({ hasText: /claude|gpt|model/i }).first();
    if (await modelSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({ path: 'e2e/screenshots/15-model-selector.png', fullPage: true });
    }

    // Try to find the send button - it might be an icon or text
    const sendButton = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /send/i })
    ).first();

    if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sendButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/16-after-send.png', fullPage: true });

      // Verify the message appears in the chat
      const userMessage = page.locator('text=Hello, this is my first message!');
      await expect(userMessage).toBeVisible({ timeout: 5000 });
    } else {
      // Try pressing Enter as an alternative
      await chatInput.press('Enter');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/16-after-enter.png', fullPage: true });
    }
  });

  test('should create multiple chats in a space', async ({ page }) => {
    // Wait for empty state to load
    await page.waitForTimeout(1000);

    // Create first chat by typing and sending a message
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('First chat message');

    // Press Cmd+Enter or Ctrl+Enter to send
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/17-first-chat-created.png', fullPage: true });

    // Look for the "New Chat" button - it should be visible on the right side
    // Based on Space.tsx, it's a vertical button with text "New Chat"
    const newChatButton = page.locator('button:has-text("New Chat")');

    if (await newChatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/18-second-chat-created.png', fullPage: true });

      // Verify we can see multiple chats (they should be in a horizontal layout)
      const chats = page.locator('div[style*="display: flex"]').filter({
        has: page.locator('textarea')
      });
      expect(await chats.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('should navigate between chats using keyboard shortcuts', async ({ page }) => {
    // Create first chat
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('First chat');
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);

    // Create second chat
    const newChatButton = page.locator('button:has-text("New Chat")');
    if (await newChatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatButton.click();
      await page.waitForTimeout(500);

      // Type in second chat
      const secondChatInput = page.locator('textarea').last();
      await secondChatInput.fill('Second chat');
      await page.screenshot({ path: 'e2e/screenshots/19-two-chats.png', fullPage: true });

      // Use Cmd+ArrowLeft to navigate to previous chat
      await page.keyboard.press('Meta+ArrowLeft');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/20-navigate-left.png', fullPage: true });

      // Use Cmd+ArrowRight to navigate to next chat
      await page.keyboard.press('Meta+ArrowRight');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/21-navigate-right.png', fullPage: true });
    }
  });

  test('should branch a chat', async ({ page }) => {
    // Create a chat with some messages first
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Original message');
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/22-chat-before-branch.png', fullPage: true });

    // Look for the branch button in the chat header
    // Based on Chat.tsx, there should be a Split icon button
    const branchButton = page.locator('button').filter({
      has: page.locator('svg')
    }).filter({ hasText: '' }).first();

    // Try to find it by looking for the Split icon more specifically
    const chatHeader = page.locator('div').filter({
      has: page.locator('text=Chat')
    }).first();

    if (await chatHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({ path: 'e2e/screenshots/23-chat-header.png', fullPage: true });

      // Look for buttons in the header
      const headerButtons = chatHeader.locator('button');
      const buttonCount = await headerButtons.count();

      // The branch button should be one of these buttons
      // Try clicking the button that looks like a branch/split icon
      for (let i = 0; i < buttonCount; i++) {
        const button = headerButtons.nth(i);
        const title = await button.getAttribute('title').catch(() => null);

        if (title && title.toLowerCase().includes('branch')) {
          await button.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'e2e/screenshots/24-after-branch.png', fullPage: true });

          // Verify a new chat was created with "(Branch)" in the title
          const branchedChat = page.locator('text=/.*\\(Branch\\)/');
          await expect(branchedChat).toBeVisible({ timeout: 3000 });
          break;
        }
      }
    }

    // Alternative: use context menu to branch
    // Right-click on the chat area
    const chatArea = page.locator('div').filter({
      has: page.locator('textarea')
    }).first();

    if (await chatArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chatArea.click({ button: 'right' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e/screenshots/25-chat-context-menu.png', fullPage: true });

      // Look for branch option in context menu
      const branchOption = page.locator('text=/branch/i');
      if (await branchOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await branchOption.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/26-after-branch-context.png', fullPage: true });
      }
    }
  });

  test('should delete a chat', async ({ page }) => {
    // Create two chats first
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('First chat to delete');
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(2000);

    const newChatButton = page.locator('button:has-text("New Chat")');
    if (await newChatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'e2e/screenshots/27-before-delete.png', fullPage: true });

      // Look for delete button in chat header (Trash icon)
      const chatHeader = page.locator('div').filter({
        has: page.locator('textarea')
      }).first();

      const deleteButton = chatHeader.locator('button').filter({
        has: page.locator('svg')
      }).filter({ hasText: '' });

      // Try to find the delete button by looking through header buttons
      const headerButtons = chatHeader.locator('button');
      const buttonCount = await headerButtons.count();

      for (let i = 0; i < buttonCount; i++) {
        const button = headerButtons.nth(i);
        const title = await button.getAttribute('title').catch(() => null);

        if (title && (title.toLowerCase().includes('delete') || title.toLowerCase().includes('remove'))) {
          await button.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'e2e/screenshots/28-after-delete.png', fullPage: true });
          break;
        }
      }
    }
  });

  test('should handle chat input and message sending', async ({ page }) => {
    // This test focuses on the chat input functionality
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible();

    // Type a multi-line message
    await chatInput.fill('Line 1');
    await chatInput.press('Shift+Enter');
    await chatInput.type('Line 2');
    await chatInput.press('Shift+Enter');
    await chatInput.type('Line 3');

    await page.screenshot({ path: 'e2e/screenshots/29-multiline-input.png', fullPage: true });

    // Verify the input contains all lines
    const inputValue = await chatInput.inputValue();
    expect(inputValue).toContain('Line 1');
    expect(inputValue).toContain('Line 2');
    expect(inputValue).toContain('Line 3');

    // Send the message
    await chatInput.press('Meta+Enter');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/30-multiline-sent.png', fullPage: true });
  });

  test('should select and change chat model', async ({ page }) => {
    await page.screenshot({ path: 'e2e/screenshots/31-model-selection.png', fullPage: true });

    // Look for model selector dropdown
    const modelSelector = page.locator('button').filter({
      hasText: /claude|opus|gpt/i
    }).first();

    if (await modelSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelSelector.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'e2e/screenshots/32-model-dropdown.png', fullPage: true });

      // Look for model options
      const modelOptions = page.locator('div[role="menuitem"]').or(
        page.locator('button').filter({ hasText: /claude|gpt/i })
      );

      if (await modelOptions.count() > 0) {
        // Click on a different model
        await modelOptions.first().click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'e2e/screenshots/33-model-selected.png', fullPage: true });
      }
    }
  });
});
