# Playwright E2E Tests

This directory contains end-to-end tests for the Astral application using Playwright.

## Setup

1. Install dependencies (if not already installed):
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all tests (headless):
```bash
npm run test:e2e
```

### Run tests with UI mode (recommended for development):
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see the browser):
```bash
npm run test:e2e:headed
```

### Debug tests:
```bash
npm run test:e2e:debug
```

### Run specific test file:
```bash
npx playwright test e2e/spaces.spec.ts
```

### Run tests matching a pattern:
```bash
npx playwright test -g "should create a new space"
```

## Test Structure

### `spaces.spec.ts` - Space Management Tests
Tests for managing spaces in the application:
- Loading with default space
- Creating new spaces
- Navigating between spaces
- Renaming spaces via context menu
- Deleting spaces via context menu

### `chats.spec.ts` - Chat Management Tests
Tests for chat functionality:
- Creating new chats from empty space
- Creating multiple chats in a space
- Navigating between chats using keyboard shortcuts
- Branching chats
- Deleting chats
- Handling chat input and message sending
- Selecting and changing chat models

### `integration.spec.ts` - Integration Tests
Comprehensive workflow tests:
- Complete workflow: create space, chats, branch, and navigate
- Sidebar toggle and responsive behavior
- Empty state to chat creation flow
- Multi-space multi-chat scenarios
- Keyboard shortcuts comprehensive test

## Screenshots

All tests capture screenshots during execution. Screenshots are saved in:
```
e2e/screenshots/
```

These screenshots help understand:
- The state of the application at different test stages
- Visual verification of UI changes
- Debugging failed tests

## Key Features Tested

### Space Management
- ✅ Default space creation on first load
- ✅ Creating new spaces
- ✅ Clicking to navigate between spaces
- ✅ Right-click context menu for rename/delete
- ✅ Space rename functionality
- ✅ Space deletion (with protection for last space)

### Chat Management
- ✅ Creating chats from empty state
- ✅ Creating multiple chats in a space
- ✅ Horizontal chat layout
- ✅ "New Chat" button on the right side
- ✅ Chat branching functionality
- ✅ Chat deletion
- ✅ Message input and sending (Cmd/Ctrl+Enter)
- ✅ Multi-line messages (Shift+Enter)
- ✅ Model selection

### Navigation
- ✅ Cmd/Ctrl + ArrowLeft: Navigate to previous chat
- ✅ Cmd/Ctrl + ArrowRight: Navigate to next chat
- ✅ Wrapping navigation (from last to first and vice versa)
- ✅ Sidebar toggle with chevron button

### UI/UX
- ✅ Empty state display
- ✅ Active space highlighting
- ✅ Active chat indication
- ✅ Smooth scrolling to active chat
- ✅ Responsive sidebar

## Test Best Practices

1. **Wait for Load States**: All tests wait for `networkidle` before interacting
2. **Screenshots**: Screenshots are taken at key points for debugging
3. **Timeouts**: Reasonable timeouts are used for async operations
4. **Fallbacks**: Tests include fallback strategies when elements might not be found
5. **Isolation**: Each test is independent and doesn't rely on state from other tests

## Debugging Failed Tests

1. Check the HTML report:
```bash
npx playwright show-report
```

2. View screenshots in `e2e/screenshots/`

3. Run in debug mode:
```bash
npm run test:e2e:debug
```

4. Use Playwright Inspector:
```bash
npx playwright test --debug
```

## CI/CD Integration

The tests are configured to run in CI environments with:
- 2 retries on failure
- Single worker for stability
- Automatic browser installation
- HTML reporter for results

## Extending Tests

To add new tests:

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Import necessary Playwright utilities:
```typescript
import { test, expect } from '@playwright/test';
```
3. Write your test cases following the existing patterns
4. Use descriptive test names and add comments
5. Take screenshots at important steps
6. Ensure tests are isolated and can run independently

## Selectors Used

The tests use various selector strategies:
- Text content: `page.locator('text=My First Space')`
- Button text: `page.locator('button:has-text("New Space")')`
- CSS attributes: `page.locator('div[style*="marginTop"]')`
- Filter chains: `page.locator('button').filter({ hasText: /pattern/ })`
- Parent traversal: `element.locator('..')`

## Known Issues and Limitations

1. Some tests may need adjustment based on actual API responses
2. Model selector tests depend on available models
3. Chat message sending tests may timeout if the API is slow
4. Screenshots may vary based on screen resolution

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Add appropriate screenshots
3. Use meaningful test descriptions
4. Handle edge cases
5. Update this README if adding new test files or features
