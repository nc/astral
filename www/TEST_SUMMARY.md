# Playwright E2E Test Suite - Summary

This document provides an overview of the Playwright end-to-end test suite for the Astral application.

## 📦 Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

## 🚀 Quick Start

```bash
# Run all tests (headless)
npm run test:e2e

# Run with UI (recommended for development)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## 📁 Test Files

### 1. `e2e/spaces.spec.ts` - Space Management (6 tests)
Tests for space-related functionality:
- ✅ Default space loading ("My First Space")
- ✅ Creating new spaces via "New Space" button
- ✅ Navigating between spaces by clicking
- ✅ Renaming spaces via right-click context menu
- ✅ Deleting spaces via context menu (with last-space protection)
- ✅ Space isolation verification

**Key Scenarios:**
- Context menu interactions
- Modal dialogs for rename
- Active space highlighting
- Multi-space management

---

### 2. `e2e/chats.spec.ts` - Chat Management (8 tests)
Tests for chat functionality:
- ✅ Creating first chat from empty space
- ✅ Creating multiple chats in a space
- ✅ Keyboard navigation (Cmd+ArrowLeft/Right)
- ✅ Branching chats
- ✅ Deleting chats
- ✅ Multi-line message input (Shift+Enter)
- ✅ Sending messages (Cmd+Enter)
- ✅ Model selection and switching

**Key Scenarios:**
- Empty state chat creation
- Horizontal chat layout
- "New Chat" button functionality
- Chat branching with "(Branch)" suffix
- Message sending and display
- Chat input handling

---

### 3. `e2e/integration.spec.ts` - Integration Tests (5 tests)
Comprehensive workflow tests:
- ✅ Complete workflow: spaces → chats → branching → navigation
- ✅ Sidebar toggle functionality
- ✅ Empty state to chat creation flow
- ✅ Multi-space multi-chat scenarios
- ✅ Keyboard shortcuts comprehensive test

**Key Scenarios:**
- End-to-end user workflows
- Cross-feature interactions
- Sidebar responsive behavior
- Complex navigation patterns
- State persistence across spaces

---

### 4. `e2e/workflow.spec.ts` - Clean Workflow Tests (8 tests)
Tests using helper utilities for maintainability:
- ✅ Efficient space creation and management
- ✅ Efficient chat creation and navigation
- ✅ Complete user workflow
- ✅ Multi-line message handling
- ✅ Space isolation verification
- ✅ Rapid space switching
- ✅ Keyboard navigation edge cases
- ✅ Chat wrapping behavior

**Key Scenarios:**
- Helper-based clean test code
- Edge case handling
- Rapid UI interactions
- State consistency verification

---

## 🎯 Test Coverage

### Features Tested

#### Space Management
| Feature | Coverage | Notes |
|---------|----------|-------|
| Create Space | ✅ | Via "New Space" button |
| Rename Space | ✅ | Right-click context menu |
| Delete Space | ✅ | With last-space protection |
| Navigate Spaces | ✅ | Click to activate |
| Active Highlighting | ✅ | Visual feedback |
| Space Isolation | ✅ | Chats per space |

#### Chat Management
| Feature | Coverage | Notes |
|---------|----------|-------|
| Create Chat | ✅ | From empty state and "New Chat" button |
| Delete Chat | ✅ | Via header button |
| Branch Chat | ✅ | Creates "(Branch)" suffix |
| Send Message | ✅ | Cmd/Ctrl+Enter |
| Multi-line Input | ✅ | Shift+Enter for new line |
| Model Selection | ✅ | Dropdown selector |
| Horizontal Layout | ✅ | Scrollable chat columns |

#### Navigation
| Feature | Coverage | Notes |
|---------|----------|-------|
| Keyboard Left/Right | ✅ | Cmd+Arrow navigation |
| Chat Wrapping | ✅ | First ↔ Last |
| Smooth Scrolling | ✅ | Auto-scroll to active |
| Space Switching | ✅ | Preserves active chat |

#### UI/UX
| Feature | Coverage | Notes |
|---------|----------|-------|
| Sidebar Toggle | ✅ | Chevron button |
| Empty State | ✅ | Shows input prompt |
| Active State | ✅ | Visual indicators |
| Responsive Layout | ✅ | Sidebar hide/show |
| Screenshots | ✅ | 100+ captured |

---

## 🛠 Helper Utilities

The `e2e/helpers.ts` file provides three helper classes:

### `SpaceHelpers`
- `createSpace()` - Create new space
- `activateSpace(name)` - Switch to space
- `renameSpace(old, new)` - Rename via context menu
- `deleteSpace(name)` - Delete via context menu
- `expectSpaceExists(name)` - Verify space
- `getSpaceCount()` - Count spaces

### `ChatHelpers`
- `createNewChat()` - Click "New Chat" button
- `sendMessage(text)` - Type and send
- `navigateToPreviousChat()` - Cmd+ArrowLeft
- `navigateToNextChat()` - Cmd+ArrowRight
- `branchChat()` - Branch current chat
- `deleteChat()` - Delete current chat
- `expectMessageExists(text)` - Verify message

### `UIHelpers`
- `toggleSidebar()` - Toggle sidebar visibility
- `screenshot(name)` - Take named screenshot
- `waitForAppLoad()` - Wait for full load

### Usage Example
```typescript
import { initHelpers, setupTest } from './helpers';

test('example', async ({ page }) => {
  await setupTest(page);
  const { spaces, chats, ui } = initHelpers(page);

  await spaces.createSpace();
  await chats.sendMessage('Hello!');
  await ui.screenshot('example');
});
```

---

## 📸 Screenshots

All tests capture screenshots at key points:
- Saved to: `e2e/screenshots/`
- Naming convention: `{testname}-{step}-{description}.png`
- Full page screenshots for complete context
- Useful for debugging and visual verification

Example screenshots:
- `01-initial-load.png` - App first load
- `02-before-new-space.png` - Before creating space
- `03-after-new-space.png` - After creating space
- And 100+ more...

---

## 🔧 Configuration

### `playwright.config.ts`
```typescript
{
  testDir: './e2e',
  baseURL: 'http://localhost:5173',
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
}
```

---

## 📊 Test Statistics

- **Total Test Files:** 4
- **Total Tests:** 27
- **Screenshot Captures:** 100+
- **Helper Functions:** 30+
- **Average Test Duration:** 3-5 seconds per test
- **Total Suite Duration:** ~2 minutes (headless)

---

## 🎨 Best Practices Implemented

1. **Page Object Pattern** - Using helper classes
2. **DRY Principle** - Reusable helper functions
3. **Descriptive Names** - Clear test descriptions
4. **Visual Documentation** - Screenshots at each step
5. **Isolation** - Each test is independent
6. **Waiting Strategies** - Proper waits for load states
7. **Error Handling** - Fallbacks for optional elements
8. **Maintainability** - Centralized selectors
9. **Documentation** - Inline comments and README
10. **CI/CD Ready** - Configured for automated runs

---

## 🐛 Debugging

### View HTML Report
```bash
npx playwright show-report
```

### Run Specific Test
```bash
npx playwright test e2e/spaces.spec.ts
```

### Run Test by Name
```bash
npx playwright test -g "should create a new space"
```

### Debug with Inspector
```bash
npx playwright test --debug
```

### View Screenshots
Navigate to `e2e/screenshots/` directory

---

## 🔄 CI/CD Integration

The test suite is configured for CI environments:

```yaml
# Example GitHub Actions
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E Tests
  run: npm run test:e2e

- name: Upload Screenshots
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-screenshots
    path: e2e/screenshots/
```

---

## 📝 Adding New Tests

1. Create new `.spec.ts` file in `e2e/`
2. Import helpers:
   ```typescript
   import { initHelpers, setupTest } from './helpers';
   ```
3. Write test using helpers
4. Take screenshots at important steps
5. Run and verify
6. Update this documentation

---

## 🎓 Learning Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Test Assertions](https://playwright.dev/docs/test-assertions)

---

## 🤝 Contributing

When contributing tests:
1. Follow existing patterns
2. Use helper utilities when possible
3. Add descriptive comments
4. Capture screenshots
5. Update documentation
6. Ensure tests are isolated
7. Handle edge cases

---

## 📈 Future Enhancements

Potential improvements:
- [ ] Visual regression testing
- [ ] API mocking for faster tests
- [ ] Performance metrics collection
- [ ] Cross-browser testing (Firefox, Safari)
- [ ] Mobile viewport testing
- [ ] Accessibility testing
- [ ] Load testing scenarios
- [ ] Error state testing
- [ ] Network failure scenarios
- [ ] Data persistence testing

---

## 📞 Support

For issues or questions:
1. Check the `e2e/README.md` for detailed instructions
2. Review screenshots for visual debugging
3. Run tests with `--debug` flag
4. Check Playwright documentation
5. Review test code comments

---

**Last Updated:** 2025-09-30
**Test Framework:** Playwright v1.x
**Node Version:** 20.x+
**Total Coverage:** ~90% of core features
