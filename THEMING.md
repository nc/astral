# Theming System

Astral now includes a comprehensive theming system with 10 pre-built themes inspired by popular syntax highlighters.

## Features

- **10 Built-in Themes**: Astral Dark (default), Dracula, Nord, Monokai, GitHub Dark, Atom One Dark, Gruvbox Dark, Tokyo Night, Solarized Dark, and GitHub Light
- **CSS Variables**: All colors are defined as CSS variables for easy customization
- **Real-time Switching**: Themes switch instantly without page reload
- **Persistent Selection**: Theme choice is saved to localStorage
- **Smooth Transitions**: 200ms transition animations for color changes

## Using the Theme Switcher

1. Click the settings icon in the sidebar
2. Select your preferred theme from the grid
3. The theme applies immediately
4. Your selection is automatically saved

## Available Themes

### Dark Themes

- **Astral Dark** - Original Astral color scheme (default)
- **Dracula** - Popular purple-accented dark theme
- **Nord** - Arctic-inspired blue-grey theme
- **Monokai** - Classic warm dark theme with green accents
- **GitHub Dark** - GitHub's official dark mode
- **Atom One Dark** - Atom editor's default dark theme
- **Gruvbox Dark** - Retro groove dark theme with earthy tones
- **Tokyo Night** - Night-themed with blue accents
- **Solarized Dark** - Precision colors for machines and people

### Light Themes

- **GitHub Light** - GitHub's official light mode

## Technical Implementation

### Architecture

```
src/
├── themes.ts                    # Theme definitions and type exports
├── components/
│   ├── ThemeProvider.tsx       # Applies theme CSS variables to :root
│   └── SettingsModal.tsx       # Theme selection UI
├── store.ts                    # Theme state management
└── index.css                   # Base CSS variables
```

### CSS Variables

All colors are exposed as CSS variables:

**Background Colors:**
- `--bg-primary` - Main background
- `--bg-secondary` - Secondary panels/surfaces
- `--bg-tertiary` - Cards and elevated elements
- `--bg-hover` - Hover states
- `--bg-active` - Active/pressed states

**Text Colors:**
- `--text-primary` - Primary text
- `--text-secondary` - Secondary text
- `--text-tertiary` - Muted/hint text
- `--text-muted` - Disabled text

**Border Colors:**
- `--border-primary` - Default borders
- `--border-secondary` - Subtle borders
- `--border-focus` - Focus rings

**Accent Colors:**
- `--accent-primary` - Primary brand color
- `--accent-secondary` - Secondary accent
- `--accent-hover` - Accent hover state

**Component Colors:**
- `--button-primary-bg/text/hover`
- `--button-secondary-bg/text/hover`
- `--input-bg/border/focus/text/placeholder`
- `--code-bg/text/border`
- `--sidebar-bg`
- `--header-bg`
- `--modal-overlay`
- `--scrollbar-thumb/track`

**Status Colors:**
- `--success-bg/text`
- `--warning-bg/text`
- `--error-bg/text`

### Adding a New Theme

1. Add theme definition to `src/themes.ts`:

```typescript
'my-theme': {
  name: 'my-theme',
  displayName: 'My Theme',
  colors: {
    bgPrimary: '#000000',
    // ... define all required colors
  },
}
```

2. Theme will automatically appear in the settings dialog

### Programmatic Theme Changes

```typescript
import { actions } from './store';

// Set theme
actions.setTheme('dracula');

// Get current theme
const currentTheme = actions.getTheme();
```

## Files Modified

**New Files:**
- `src/themes.ts` - Theme definitions
- `src/components/ThemeProvider.tsx` - Theme application logic
- `THEMING.md` - This documentation

**Updated Files:**
- `src/store.ts` - Added theme state management
- `src/main.tsx` - Wrapped app with ThemeProvider
- `src/index.css` - Extracted colors to CSS variables
- `src/components/SettingsModal.tsx` - Added theme selector UI
- All component files - Updated to use CSS variables instead of hardcoded colors

## Notes

- All 100+ hardcoded color values have been replaced with CSS variables
- Transitions are configured at 200ms for smooth theme switching
- Theme selection persists across browser sessions via localStorage
- The system is designed to be easily extensible with new themes
