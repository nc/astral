# Playwright E2E Tests - Quick Reference

## 🚀 Commands

```bash
# Run all tests
npm run test:e2e

# UI mode (best for development)
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Specific file
npx playwright test e2e/spaces.spec.ts

# Specific test
npx playwright test -g "should create a new space"

# Show report
npx playwright show-report
```

## 📂 Test Files

| File | Tests | Focus |
|------|-------|-------|
| `spaces.spec.ts` | 6 | Space CRUD operations |
| `chats.spec.ts` | 8 | Chat creation, navigation, branching |
| `integration.spec.ts` | 5 | End-to-end workflows |
| `workflow.spec.ts` | 8 | Clean tests with helpers |

## 🛠 Helper Classes

### SpaceHelpers
```typescript
const { spaces } = initHelpers(page);

await spaces.createSpace();
await spaces.activateSpace('My Space');
await spaces.renameSpace('Old', 'New');
await spaces.deleteSpace('My Space');
await spaces.expectSpaceExists('My Space');
const count = await spaces.getSpaceCount();
```

### ChatHelpers
```typescript
const { chats } = initHelpers(page);

await chats.createNewChat();
await chats.sendMessage('Hello!');
await chats.navigateToPreviousChat();
await chats.navigateToNextChat();
await chats.branchChat();
await chats.deleteChat();
await chats.expectMessageExists('Hello!');
```

### UIHelpers
```typescript
const { ui } = initHelpers(page);

await ui.toggleSidebar();
await ui.screenshot('my-screenshot');
await ui.waitForAppLoad();
await ui.expectSidebarVisible();
```

## 🎯 Common Patterns

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test';
import { initHelpers, setupTest } from './helpers';

test('my test', async ({ page }) => {
  await setupTest(page);
  const { spaces, chats, ui } = initHelpers(page);

  // Your test code
  await ui.screenshot('step-1');
});
```

### Creating Space with Chats
```typescript
await spaces.createSpace();
await spaces.renameSpace('New Space', 'Project');
await chats.sendMessage('First message');
await chats.createNewChat();
await chats.sendMessage('Second message', true);
```

### Navigation Test
```typescript
await chats.createChatWithMessage('Chat 1');
await chats.createNewChat();
await chats.sendMessage('Chat 2', true);
await chats.navigateToPreviousChat();
await chats.navigateToNextChat();
```

## 📸 Screenshots

Screenshots saved to: `e2e/screenshots/`

```typescript
// Using helper
await ui.screenshot('my-step');

// Direct
await page.screenshot({
  path: 'e2e/screenshots/my-step.png',
  fullPage: true
});
```

## 🔍 Selectors

### Spaces
```typescript
// New Space button
page.locator('button:has-text("New Space")')

// Space by name
page.locator('text=My First Space')

// All spaces
page.locator('div[style*="marginTop"]').filter({ hasText: /Space/ })
```

### Chats
```typescript
// Chat input
page.locator('textarea').first()

// New Chat button
page.locator('button:has-text("New Chat")')

// Message
page.locator('text=Hello')
```

### UI
```typescript
// Sidebar toggle
page.locator('button').filter({ has: page.locator('svg') }).first()

// Astral logo/text
page.locator('text=Astral')
```

## ⌨️ Keyboard Shortcuts

```typescript
// Send message
await input.press('Meta+Enter');

// New line in message
await input.press('Shift+Enter');

// Navigate to previous chat
await page.keyboard.press('Meta+ArrowLeft');

// Navigate to next chat
await page.keyboard.press('Meta+ArrowRight');

// Close modal/dropdown
await page.keyboard.press('Escape');
```

## 🐛 Debugging Tips

### 1. Run in headed mode
```bash
npm run test:e2e:headed
```

### 2. Use debug mode
```bash
npm run test:e2e:debug
```

### 3. Add console logs
```typescript
console.log('Current URL:', page.url());
console.log('Element count:', await elements.count());
```

### 4. Take extra screenshots
```typescript
await ui.screenshot('before-action');
// ... action ...
await ui.screenshot('after-action');
```

### 5. Check element visibility
```typescript
const isVisible = await element.isVisible({ timeout: 2000 })
  .catch(() => false);
console.log('Element visible:', isVisible);
```

### 6. View HTML report
```bash
npx playwright show-report
```

## ⚡ Quick Test Template

```typescript
import { test } from '@playwright/test';
import { initHelpers, setupTest } from './helpers';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('should do something', async ({ page }) => {
    const { spaces, chats, ui } = initHelpers(page);

    await ui.screenshot('start');

    // Your test logic here

    await ui.screenshot('end');
  });
});
```

## 📊 Test Status

Run tests to see:
- ✅ Passed tests (green)
- ❌ Failed tests (red)
- ⏭️ Skipped tests (yellow)

## 🔄 Common Workflows

### Workflow 1: New Space → Chat → Message
```typescript
await spaces.createSpace();
await chats.sendMessage('Hello!');
await ui.screenshot('complete');
```

### Workflow 2: Multiple Spaces → Navigate
```typescript
await spaces.createSpace(); // Space 2
await spaces.createSpace(); // Space 3
await spaces.activateSpace('My First Space');
await spaces.activateSpace('New Space');
```

### Workflow 3: Multiple Chats → Navigate
```typescript
await chats.sendMessage('Chat 1');
await chats.createNewChat();
await chats.sendMessage('Chat 2', true);
await chats.navigateToPreviousChat();
```

## 🎨 Best Practices

1. ✅ Use helpers instead of direct selectors
2. ✅ Take screenshots at key steps
3. ✅ Use descriptive test names
4. ✅ Wait for load states
5. ✅ Handle optional elements gracefully
6. ✅ Clean up test data (spaces are isolated per test)
7. ✅ Use meaningful variable names
8. ✅ Add comments for complex logic
9. ✅ Group related tests in describe blocks
10. ✅ Keep tests independent

## ⚠️ Common Pitfalls

❌ Not waiting for load
```typescript
await page.goto('/');
// ❌ Immediately interact
```
✅ Wait for load
```typescript
await setupTest(page);
// ✅ Now interact
```

❌ Using wrong input
```typescript
await chats.getChatInput().fill('Message'); // First input
await chats.createNewChat();
await chats.getChatInput().fill('Message'); // Still first!
```
✅ Use correct input
```typescript
await chats.getChatInput().fill('Message');
await chats.createNewChat();
await chats.getLastChatInput().fill('Message'); // ✅ Last input
```

❌ Not handling optional elements
```typescript
await button.click(); // Might fail if not visible
```
✅ Check first
```typescript
if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
  await button.click();
}
```

## 📞 Need Help?

1. Check `e2e/README.md` for detailed docs
2. Review `TEST_SUMMARY.md` for overview
3. Look at existing tests for examples
4. Check Playwright docs: https://playwright.dev
5. Review screenshots in `e2e/screenshots/`

---

**Quick Tip:** Use UI mode for the best development experience:
```bash
npm run test:e2e:ui
```
