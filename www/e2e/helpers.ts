import { Page, Locator, expect } from '@playwright/test';

/**
 * Helper utilities for Playwright tests
 */

export class SpaceHelpers {
  constructor(private page: Page) {}

  /**
   * Get the "New Space" button
   */
  getNewSpaceButton(): Locator {
    return this.page.locator('button:has-text("New Space")');
  }

  /**
   * Create a new space
   */
  async createSpace(): Promise<void> {
    await this.getNewSpaceButton().click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get a space by name
   */
  getSpace(name: string): Locator {
    return this.page.locator(`text=${name}`);
  }

  /**
   * Click on a space to make it active
   */
  async activateSpace(name: string): Promise<void> {
    await this.getSpace(name).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Rename a space using the context menu
   */
  async renameSpace(oldName: string, newName: string): Promise<void> {
    const space = this.getSpace(oldName);
    await space.click({ button: 'right' });
    await this.page.waitForTimeout(300);

    const renameOption = this.page.locator('text=Rename Space');
    await renameOption.click();
    await this.page.waitForTimeout(300);

    const input = this.page.locator('input[type="text"]').first();
    await input.clear();
    await input.fill(newName);

    const saveButton = this.page.locator('button').filter({ hasText: /save|rename|ok/i }).first();
    await saveButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Delete a space using the context menu
   */
  async deleteSpace(name: string): Promise<void> {
    const space = this.getSpace(name);
    await space.click({ button: 'right' });
    await this.page.waitForTimeout(300);

    const removeOption = this.page.locator('text=Remove Space');
    await removeOption.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Verify a space exists
   */
  async expectSpaceExists(name: string): Promise<void> {
    await expect(this.getSpace(name)).toBeVisible();
  }

  /**
   * Get all spaces
   */
  getAllSpaces(): Locator {
    return this.page.locator('div[style*="marginTop"]').filter({ hasText: /Space/ });
  }

  /**
   * Get count of spaces
   */
  async getSpaceCount(): Promise<number> {
    return await this.getAllSpaces().count();
  }
}

export class ChatHelpers {
  constructor(private page: Page) {}

  /**
   * Get the chat input (textarea)
   */
  getChatInput(): Locator {
    return this.page.locator('textarea').first();
  }

  /**
   * Get the last chat input (useful when multiple chats exist)
   */
  getLastChatInput(): Locator {
    return this.page.locator('textarea').last();
  }

  /**
   * Get the "New Chat" button
   */
  getNewChatButton(): Locator {
    return this.page.locator('button:has-text("New Chat")');
  }

  /**
   * Create a new chat by clicking the "New Chat" button
   */
  async createNewChat(): Promise<void> {
    const button = this.getNewChatButton();
    if (await button.isVisible({ timeout: 3000 }).catch(() => false)) {
      await button.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Type a message in the chat input
   */
  async typeMessage(message: string, useLastInput = false): Promise<void> {
    const input = useLastInput ? this.getLastChatInput() : this.getChatInput();
    await input.fill(message);
  }

  /**
   * Send a message using Cmd/Ctrl+Enter
   */
  async sendMessage(message?: string, useLastInput = false): Promise<void> {
    const input = useLastInput ? this.getLastChatInput() : this.getChatInput();

    if (message) {
      await input.fill(message);
    }

    await input.press('Meta+Enter');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Create a chat with a message (type and send)
   */
  async createChatWithMessage(message: string): Promise<void> {
    await this.sendMessage(message);
  }

  /**
   * Navigate to previous chat using keyboard
   */
  async navigateToPreviousChat(): Promise<void> {
    await this.page.keyboard.press('Meta+ArrowLeft');
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigate to next chat using keyboard
   */
  async navigateToNextChat(): Promise<void> {
    await this.page.keyboard.press('Meta+ArrowRight');
    await this.page.waitForTimeout(500);
  }

  /**
   * Branch the current chat
   */
  async branchChat(): Promise<void> {
    const chatHeader = this.page.locator('div').filter({
      has: this.page.locator('textarea')
    }).first();

    const headerButtons = chatHeader.locator('button');
    const buttonCount = await headerButtons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = headerButtons.nth(i);
      const title = await button.getAttribute('title').catch(() => null);

      if (title && title.toLowerCase().includes('branch')) {
        await button.click();
        await this.page.waitForTimeout(500);
        return;
      }
    }

    throw new Error('Branch button not found');
  }

  /**
   * Delete the current chat
   */
  async deleteChat(): Promise<void> {
    const chatHeader = this.page.locator('div').filter({
      has: this.page.locator('textarea')
    }).first();

    const headerButtons = chatHeader.locator('button');
    const buttonCount = await headerButtons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = headerButtons.nth(i);
      const title = await button.getAttribute('title').catch(() => null);

      if (title && (title.toLowerCase().includes('delete') || title.toLowerCase().includes('remove'))) {
        await button.click();
        await this.page.waitForTimeout(500);
        return;
      }
    }

    throw new Error('Delete button not found');
  }

  /**
   * Verify a message exists in the chat
   */
  async expectMessageExists(text: string): Promise<void> {
    await expect(this.page.locator(`text=${text}`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get the model selector button
   */
  getModelSelector(): Locator {
    return this.page.locator('button').filter({ hasText: /claude|opus|gpt/i }).first();
  }

  /**
   * Select a model
   */
  async selectModel(): Promise<void> {
    const selector = this.getModelSelector();
    if (await selector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selector.click();
      await this.page.waitForTimeout(300);

      // Click on first model option
      const modelOptions = this.page.locator('div[role="menuitem"]').or(
        this.page.locator('button').filter({ hasText: /claude|gpt/i })
      );

      if (await modelOptions.count() > 0) {
        await modelOptions.first().click();
        await this.page.waitForTimeout(300);
      }
    }
  }
}

export class UIHelpers {
  constructor(private page: Page) {}

  /**
   * Get the sidebar toggle button
   */
  getSidebarToggle(): Locator {
    return this.page.locator('button').filter({
      has: this.page.locator('svg')
    }).first();
  }

  /**
   * Toggle the sidebar
   */
  async toggleSidebar(): Promise<void> {
    await this.getSidebarToggle().click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Verify sidebar is visible
   */
  async expectSidebarVisible(): Promise<void> {
    await expect(this.page.locator('text=Astral')).toBeVisible();
  }

  /**
   * Verify sidebar is hidden
   */
  async expectSidebarHidden(): Promise<void> {
    const sidebar = this.page.locator('text=Astral').locator('..');
    const isVisible = await sidebar.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Wait for the app to be fully loaded
   */
  async waitForAppLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);
  }
}

/**
 * Initialize all helpers for a page
 */
export function initHelpers(page: Page) {
  return {
    spaces: new SpaceHelpers(page),
    chats: new ChatHelpers(page),
    ui: new UIHelpers(page),
  };
}

/**
 * Common setup for tests
 */
export async function setupTest(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}
