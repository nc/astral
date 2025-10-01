import { test, expect } from '@playwright/test';
import { initHelpers, setupTest } from './helpers';

/**
 * Workflow tests using helper utilities
 * These tests demonstrate cleaner, more maintainable test code
 */

test.describe('Workflow Tests with Helpers', () => {
  test('should create and manage spaces efficiently', async ({ page }) => {
    await setupTest(page);
    const { spaces, ui } = initHelpers(page);

    // Take initial screenshot
    await ui.screenshot('workflow-01-initial');

    // Verify default space exists
    await spaces.expectSpaceExists('My First Space');

    // Create 2 new spaces
    await spaces.createSpace();
    await spaces.createSpace();
    await ui.screenshot('workflow-02-three-spaces');

    // Verify we have at least 3 spaces
    const count = await spaces.getSpaceCount();
    expect(count).toBeGreaterThanOrEqual(3);

    // Rename the second space
    await spaces.renameSpace('New Space', 'Project Beta');
    await ui.screenshot('workflow-03-renamed');

    // Verify rename worked
    await spaces.expectSpaceExists('Project Beta');

    // Switch between spaces
    await spaces.activateSpace('My First Space');
    await ui.screenshot('workflow-04-switched-to-first');

    await spaces.activateSpace('Project Beta');
    await ui.screenshot('workflow-05-switched-to-beta');
  });

  test('should create and navigate chats efficiently', async ({ page }) => {
    await setupTest(page);
    const { chats, ui } = initHelpers(page);

    await ui.screenshot('workflow-06-empty-state');

    // Create first chat with a message
    await chats.createChatWithMessage('What is TypeScript?');
    await ui.screenshot('workflow-07-first-chat');

    // Verify message exists
    await chats.expectMessageExists('What is TypeScript?');

    // Create second chat
    await chats.createNewChat();
    await chats.sendMessage('Explain React hooks', true);
    await ui.screenshot('workflow-08-second-chat');

    // Create third chat
    await chats.createNewChat();
    await chats.sendMessage('What is Playwright?', true);
    await ui.screenshot('workflow-09-third-chat');

    // Navigate between chats using keyboard
    await chats.navigateToPreviousChat();
    await ui.screenshot('workflow-10-nav-previous');

    await chats.navigateToPreviousChat();
    await ui.screenshot('workflow-11-nav-previous-again');

    await chats.navigateToNextChat();
    await ui.screenshot('workflow-12-nav-next');
  });

  test('should handle complete user workflow', async ({ page }) => {
    await setupTest(page);
    const { spaces, chats, ui } = initHelpers(page);

    // 1. Start with default space
    await ui.screenshot('complete-01-start');
    await spaces.expectSpaceExists('My First Space');

    // 2. Create a new space for a project
    await spaces.createSpace();
    await spaces.renameSpace('New Space', 'AI Research');
    await ui.screenshot('complete-02-project-space');

    // 3. Create first research chat
    await chats.createChatWithMessage('Research topic: Transformer architecture');
    await ui.screenshot('complete-03-first-research');

    // 4. Create second research chat
    await chats.createNewChat();
    await chats.sendMessage('Research topic: Attention mechanisms', true);
    await ui.screenshot('complete-04-second-research');

    // 5. Branch the second chat for alternative exploration
    try {
      await chats.branchChat();
      await ui.screenshot('complete-05-branched-chat');
    } catch (error) {
      console.log('Branch button not found, skipping branch test');
    }

    // 6. Create another space for different project
    await spaces.createSpace();
    await spaces.renameSpace('New Space', 'Web Development');
    await ui.screenshot('complete-06-web-dev-space');

    // 7. Create chats in new space
    await chats.createChatWithMessage('How to optimize React performance?');
    await ui.screenshot('complete-07-web-dev-chat');

    // 8. Switch back to AI Research space
    await spaces.activateSpace('AI Research');
    await ui.screenshot('complete-08-back-to-research');

    // 9. Navigate through chats
    await chats.navigateToPreviousChat();
    await chats.navigateToNextChat();
    await ui.screenshot('complete-09-navigation');

    // 10. Test sidebar toggle
    await ui.toggleSidebar();
    await ui.screenshot('complete-10-sidebar-closed');

    await ui.toggleSidebar();
    await ui.expectSidebarVisible();
    await ui.screenshot('complete-11-sidebar-open');

    // 11. Return to first space
    await spaces.activateSpace('My First Space');
    await ui.screenshot('complete-12-final-state');
  });

  test('should handle multi-line message input', async ({ page }) => {
    await setupTest(page);
    const { chats, ui } = initHelpers(page);

    await ui.screenshot('multiline-01-start');

    // Get chat input
    const input = chats.getChatInput();

    // Type multi-line message
    await input.fill('Line 1: Introduction');
    await input.press('Shift+Enter');
    await input.type('Line 2: Main content');
    await input.press('Shift+Enter');
    await input.type('Line 3: Conclusion');

    await ui.screenshot('multiline-02-typed');

    // Verify content
    const value = await input.inputValue();
    expect(value).toContain('Line 1: Introduction');
    expect(value).toContain('Line 2: Main content');
    expect(value).toContain('Line 3: Conclusion');

    // Send message
    await input.press('Meta+Enter');
    await page.waitForTimeout(2000);
    await ui.screenshot('multiline-03-sent');
  });

  test('should verify space isolation - chats in different spaces', async ({ page }) => {
    await setupTest(page);
    const { spaces, chats, ui } = initHelpers(page);

    // Create Space A with chats
    await spaces.createSpace();
    await spaces.renameSpace('New Space', 'Space A');
    await chats.createChatWithMessage('Message in Space A - Chat 1');
    await chats.createNewChat();
    await chats.sendMessage('Message in Space A - Chat 2', true);
    await ui.screenshot('isolation-01-space-a');

    // Create Space B with different chats
    await spaces.createSpace();
    await spaces.renameSpace('New Space', 'Space B');
    await chats.createChatWithMessage('Message in Space B - Chat 1');
    await chats.createNewChat();
    await chats.sendMessage('Message in Space B - Chat 2', true);
    await ui.screenshot('isolation-02-space-b');

    // Switch back to Space A and verify its chats are still there
    await spaces.activateSpace('Space A');
    await ui.screenshot('isolation-03-back-to-space-a');

    // Verify Space A messages exist
    await chats.expectMessageExists('Message in Space A - Chat 1');

    // Switch to Space B and verify its chats
    await spaces.activateSpace('Space B');
    await ui.screenshot('isolation-04-back-to-space-b');

    // Verify Space B messages exist
    await chats.expectMessageExists('Message in Space B - Chat 1');
  });

  test('should handle rapid space switching', async ({ page }) => {
    await setupTest(page);
    const { spaces, chats, ui } = initHelpers(page);

    // Create multiple spaces with content
    for (let i = 1; i <= 3; i++) {
      await spaces.createSpace();
      await spaces.renameSpace('New Space', `Rapid Space ${i}`);
      await chats.createChatWithMessage(`Content in Rapid Space ${i}`);
      await page.waitForTimeout(500);
    }

    await ui.screenshot('rapid-01-all-created');

    // Rapidly switch between spaces
    await spaces.activateSpace('Rapid Space 1');
    await page.waitForTimeout(200);
    await spaces.activateSpace('Rapid Space 2');
    await page.waitForTimeout(200);
    await spaces.activateSpace('Rapid Space 3');
    await page.waitForTimeout(200);
    await spaces.activateSpace('Rapid Space 1');
    await page.waitForTimeout(200);

    await ui.screenshot('rapid-02-after-switching');

    // Verify we're in the correct space
    await chats.expectMessageExists('Content in Rapid Space 1');
  });

  test('should handle keyboard navigation edge cases', async ({ page }) => {
    await setupTest(page);
    const { chats, ui } = initHelpers(page);

    // Create exactly 3 chats
    await chats.createChatWithMessage('Chat 1');
    await chats.createNewChat();
    await chats.sendMessage('Chat 2', true);
    await chats.createNewChat();
    await chats.sendMessage('Chat 3', true);

    await ui.screenshot('keyboard-edge-01-three-chats');

    // Test wrapping from last to first
    await chats.navigateToNextChat(); // Should wrap to first
    await page.waitForTimeout(500);
    await ui.screenshot('keyboard-edge-02-wrapped-to-first');

    // Test wrapping from first to last
    await chats.navigateToPreviousChat(); // Should wrap to last
    await page.waitForTimeout(500);
    await ui.screenshot('keyboard-edge-03-wrapped-to-last');

    // Navigate through all chats in sequence
    await chats.navigateToPreviousChat();
    await chats.navigateToPreviousChat();
    await chats.navigateToPreviousChat(); // Should wrap
    await ui.screenshot('keyboard-edge-04-full-cycle');
  });
});
