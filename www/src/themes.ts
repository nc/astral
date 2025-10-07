export interface Theme {
  name: string;
  displayName: string;
  colors: {
    // Background colors
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    bgActive: string;

    // Text colors
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textMuted: string;

    // Border colors
    borderPrimary: string;
    borderSecondary: string;
    borderFocus: string;

    // Accent colors
    accentPrimary: string;
    accentSecondary: string;
    accentHover: string;

    // Button colors
    buttonPrimaryBg: string;
    buttonPrimaryText: string;
    buttonPrimaryHover: string;
    buttonSecondaryBg: string;
    buttonSecondaryText: string;
    buttonSecondaryHover: string;

    // Input colors
    inputBg: string;
    inputBorder: string;
    inputFocus: string;
    inputText: string;
    inputPlaceholder: string;

    // Code block colors
    codeBg: string;
    codeText: string;
    codeBorder: string;

    // Special UI colors
    sidebarBg: string;
    headerBg: string;
    modalOverlay: string;
    scrollbarThumb: string;
    scrollbarTrack: string;

    // Status colors
    successBg: string;
    successText: string;
    warningBg: string;
    warningText: string;
    errorBg: string;
    errorText: string;
  };
}

export const themes: Record<string, Theme> = {
  // Current dark theme (default)
  'astral-dark': {
    name: 'astral-dark',
    displayName: 'Astral Dark',
    colors: {
      bgPrimary: '#151817',
      bgSecondary: '#1E2020',
      bgTertiary: '#282B2A',
      bgHover: '#2a2d2c',
      bgActive: '#2f3231',

      textPrimary: '#edecec',
      textSecondary: '#D4D5D4',
      textTertiary: '#8D9693',
      textMuted: '#6b7370',

      borderPrimary: '#333333',
      borderSecondary: '#2a2d2c',
      borderFocus: '#5BA97D',

      accentPrimary: '#5BA97D',
      accentSecondary: '#4a8f68',
      accentHover: '#6cba8e',

      buttonPrimaryBg: '#5BA97D',
      buttonPrimaryText: '#ffffff',
      buttonPrimaryHover: '#6cba8e',
      buttonSecondaryBg: '#1E2020',
      buttonSecondaryText: '#8D9693',
      buttonSecondaryHover: '#282B2A',

      inputBg: '#1E2020',
      inputBorder: '#333333',
      inputFocus: '#5BA97D',
      inputText: '#edecec',
      inputPlaceholder: '#8D9693',

      codeBg: '#1a1d1c',
      codeText: '#e0e0e0',
      codeBorder: '#2a2d2c',

      sidebarBg: '#151817',
      headerBg: '#151817',
      modalOverlay: 'rgba(0, 0, 0, 0.5)',
      scrollbarThumb: '#3a3d3c',
      scrollbarTrack: '#1E2020',

      successBg: '#5BA97D',
      successText: '#ffffff',
      warningBg: '#f59e0b',
      warningText: '#ffffff',
      errorBg: '#ef4444',
      errorText: '#ffffff',
    },
  },

  // Dracula theme - popular dark theme
  'dracula': {
    name: 'dracula',
    displayName: 'Dracula',
    colors: {
      bgPrimary: '#282a36',
      bgSecondary: '#21222c',
      bgTertiary: '#343746',
      bgHover: '#3a3f4b',
      bgActive: '#44475a',

      textPrimary: '#f8f8f2',
      textSecondary: '#e6e6e6',
      textTertiary: '#6272a4',
      textMuted: '#555870',

      borderPrimary: '#44475a',
      borderSecondary: '#3a3f4b',
      borderFocus: '#bd93f9',

      accentPrimary: '#bd93f9',
      accentSecondary: '#a371f7',
      accentHover: '#d4b5ff',

      buttonPrimaryBg: '#bd93f9',
      buttonPrimaryText: '#282a36',
      buttonPrimaryHover: '#d4b5ff',
      buttonSecondaryBg: '#44475a',
      buttonSecondaryText: '#f8f8f2',
      buttonSecondaryHover: '#565869',

      inputBg: '#21222c',
      inputBorder: '#44475a',
      inputFocus: '#bd93f9',
      inputText: '#f8f8f2',
      inputPlaceholder: '#6272a4',

      codeBg: '#21222c',
      codeText: '#f8f8f2',
      codeBorder: '#44475a',

      sidebarBg: '#282a36',
      headerBg: '#282a36',
      modalOverlay: 'rgba(0, 0, 0, 0.6)',
      scrollbarThumb: '#44475a',
      scrollbarTrack: '#21222c',

      successBg: '#50fa7b',
      successText: '#282a36',
      warningBg: '#f1fa8c',
      warningText: '#282a36',
      errorBg: '#ff5555',
      errorText: '#f8f8f2',
    },
  },

  // Nord theme - arctic inspired
  'nord': {
    name: 'nord',
    displayName: 'Nord',
    colors: {
      bgPrimary: '#2e3440',
      bgSecondary: '#3b4252',
      bgTertiary: '#434c5e',
      bgHover: '#4c566a',
      bgActive: '#5a657d',

      textPrimary: '#eceff4',
      textSecondary: '#e5e9f0',
      textTertiary: '#d8dee9',
      textMuted: '#81a1c1',

      borderPrimary: '#4c566a',
      borderSecondary: '#434c5e',
      borderFocus: '#88c0d0',

      accentPrimary: '#88c0d0',
      accentSecondary: '#81a1c1',
      accentHover: '#8fbcbb',

      buttonPrimaryBg: '#88c0d0',
      buttonPrimaryText: '#2e3440',
      buttonPrimaryHover: '#8fbcbb',
      buttonSecondaryBg: '#3b4252',
      buttonSecondaryText: '#d8dee9',
      buttonSecondaryHover: '#434c5e',

      inputBg: '#3b4252',
      inputBorder: '#4c566a',
      inputFocus: '#88c0d0',
      inputText: '#eceff4',
      inputPlaceholder: '#81a1c1',

      codeBg: '#3b4252',
      codeText: '#eceff4',
      codeBorder: '#4c566a',

      sidebarBg: '#2e3440',
      headerBg: '#2e3440',
      modalOverlay: 'rgba(46, 52, 64, 0.75)',
      scrollbarThumb: '#4c566a',
      scrollbarTrack: '#3b4252',

      successBg: '#a3be8c',
      successText: '#2e3440',
      warningBg: '#ebcb8b',
      warningText: '#2e3440',
      errorBg: '#bf616a',
      errorText: '#eceff4',
    },
  },

  // Monokai theme - classic
  'monokai': {
    name: 'monokai',
    displayName: 'Monokai',
    colors: {
      bgPrimary: '#272822',
      bgSecondary: '#1e1f1a',
      bgTertiary: '#3e3d32',
      bgHover: '#49483e',
      bgActive: '#5a594e',

      textPrimary: '#f8f8f2',
      textSecondary: '#f8f8f0',
      textTertiary: '#75715e',
      textMuted: '#5e5d52',

      borderPrimary: '#49483e',
      borderSecondary: '#3e3d32',
      borderFocus: '#a6e22e',

      accentPrimary: '#a6e22e',
      accentSecondary: '#8fbe00',
      accentHover: '#b9f342',

      buttonPrimaryBg: '#a6e22e',
      buttonPrimaryText: '#272822',
      buttonPrimaryHover: '#b9f342',
      buttonSecondaryBg: '#3e3d32',
      buttonSecondaryText: '#f8f8f2',
      buttonSecondaryHover: '#49483e',

      inputBg: '#1e1f1a',
      inputBorder: '#49483e',
      inputFocus: '#a6e22e',
      inputText: '#f8f8f2',
      inputPlaceholder: '#75715e',

      codeBg: '#1e1f1a',
      codeText: '#f8f8f2',
      codeBorder: '#49483e',

      sidebarBg: '#272822',
      headerBg: '#272822',
      modalOverlay: 'rgba(0, 0, 0, 0.7)',
      scrollbarThumb: '#49483e',
      scrollbarTrack: '#1e1f1a',

      successBg: '#a6e22e',
      successText: '#272822',
      warningBg: '#e6db74',
      warningText: '#272822',
      errorBg: '#f92672',
      errorText: '#f8f8f2',
    },
  },

  // GitHub Dark theme
  'github-dark': {
    name: 'github-dark',
    displayName: 'GitHub Dark',
    colors: {
      bgPrimary: '#0d1117',
      bgSecondary: '#161b22',
      bgTertiary: '#21262d',
      bgHover: '#30363d',
      bgActive: '#484f58',

      textPrimary: '#c9d1d9',
      textSecondary: '#b1bac4',
      textTertiary: '#8b949e',
      textMuted: '#6e7681',

      borderPrimary: '#30363d',
      borderSecondary: '#21262d',
      borderFocus: '#58a6ff',

      accentPrimary: '#58a6ff',
      accentSecondary: '#1f6feb',
      accentHover: '#79c0ff',

      buttonPrimaryBg: '#238636',
      buttonPrimaryText: '#ffffff',
      buttonPrimaryHover: '#2ea043',
      buttonSecondaryBg: '#21262d',
      buttonSecondaryText: '#c9d1d9',
      buttonSecondaryHover: '#30363d',

      inputBg: '#0d1117',
      inputBorder: '#30363d',
      inputFocus: '#58a6ff',
      inputText: '#c9d1d9',
      inputPlaceholder: '#8b949e',

      codeBg: '#161b22',
      codeText: '#c9d1d9',
      codeBorder: '#30363d',

      sidebarBg: '#0d1117',
      headerBg: '#0d1117',
      modalOverlay: 'rgba(1, 4, 9, 0.8)',
      scrollbarThumb: '#484f58',
      scrollbarTrack: '#161b22',

      successBg: '#238636',
      successText: '#ffffff',
      warningBg: '#9e6a03',
      warningText: '#ffffff',
      errorBg: '#da3633',
      errorText: '#ffffff',
    },
  },

  // Atom One Dark theme
  'atom-one-dark': {
    name: 'atom-one-dark',
    displayName: 'Atom One Dark',
    colors: {
      bgPrimary: '#282c34',
      bgSecondary: '#21252b',
      bgTertiary: '#2c313a',
      bgHover: '#383e4a',
      bgActive: '#464c5a',

      textPrimary: '#abb2bf',
      textSecondary: '#9da5b4',
      textTertiary: '#5c6370',
      textMuted: '#4b5263',

      borderPrimary: '#3b4048',
      borderSecondary: '#2c313a',
      borderFocus: '#61afef',

      accentPrimary: '#61afef',
      accentSecondary: '#528bff',
      accentHover: '#84c5ff',

      buttonPrimaryBg: '#61afef',
      buttonPrimaryText: '#282c34',
      buttonPrimaryHover: '#84c5ff',
      buttonSecondaryBg: '#2c313a',
      buttonSecondaryText: '#abb2bf',
      buttonSecondaryHover: '#383e4a',

      inputBg: '#21252b',
      inputBorder: '#3b4048',
      inputFocus: '#61afef',
      inputText: '#abb2bf',
      inputPlaceholder: '#5c6370',

      codeBg: '#21252b',
      codeText: '#abb2bf',
      codeBorder: '#3b4048',

      sidebarBg: '#282c34',
      headerBg: '#282c34',
      modalOverlay: 'rgba(0, 0, 0, 0.6)',
      scrollbarThumb: '#3b4048',
      scrollbarTrack: '#21252b',

      successBg: '#98c379',
      successText: '#282c34',
      warningBg: '#e5c07b',
      warningText: '#282c34',
      errorBg: '#e06c75',
      errorText: '#ffffff',
    },
  },

  // Gruvbox Dark theme
  'gruvbox-dark': {
    name: 'gruvbox-dark',
    displayName: 'Gruvbox Dark',
    colors: {
      bgPrimary: '#282828',
      bgSecondary: '#1d2021',
      bgTertiary: '#3c3836',
      bgHover: '#504945',
      bgActive: '#665c54',

      textPrimary: '#ebdbb2',
      textSecondary: '#d5c4a1',
      textTertiary: '#a89984',
      textMuted: '#7c6f64',

      borderPrimary: '#504945',
      borderSecondary: '#3c3836',
      borderFocus: '#b8bb26',

      accentPrimary: '#b8bb26',
      accentSecondary: '#98971a',
      accentHover: '#d5c4a1',

      buttonPrimaryBg: '#b8bb26',
      buttonPrimaryText: '#282828',
      buttonPrimaryHover: '#d5d53e',
      buttonSecondaryBg: '#3c3836',
      buttonSecondaryText: '#ebdbb2',
      buttonSecondaryHover: '#504945',

      inputBg: '#1d2021',
      inputBorder: '#504945',
      inputFocus: '#b8bb26',
      inputText: '#ebdbb2',
      inputPlaceholder: '#a89984',

      codeBg: '#1d2021',
      codeText: '#ebdbb2',
      codeBorder: '#504945',

      sidebarBg: '#282828',
      headerBg: '#282828',
      modalOverlay: 'rgba(29, 32, 33, 0.8)',
      scrollbarThumb: '#504945',
      scrollbarTrack: '#1d2021',

      successBg: '#b8bb26',
      successText: '#282828',
      warningBg: '#fabd2f',
      warningText: '#282828',
      errorBg: '#fb4934',
      errorText: '#ebdbb2',
    },
  },

  // Tokyo Night theme
  'tokyo-night': {
    name: 'tokyo-night',
    displayName: 'Tokyo Night',
    colors: {
      bgPrimary: '#1a1b26',
      bgSecondary: '#16161e',
      bgTertiary: '#24283b',
      bgHover: '#2f3549',
      bgActive: '#414868',

      textPrimary: '#c0caf5',
      textSecondary: '#a9b1d6',
      textTertiary: '#565f89',
      textMuted: '#3b4261',

      borderPrimary: '#2f3549',
      borderSecondary: '#24283b',
      borderFocus: '#7aa2f7',

      accentPrimary: '#7aa2f7',
      accentSecondary: '#7dcfff',
      accentHover: '#9abdf5',

      buttonPrimaryBg: '#7aa2f7',
      buttonPrimaryText: '#1a1b26',
      buttonPrimaryHover: '#9abdf5',
      buttonSecondaryBg: '#24283b',
      buttonSecondaryText: '#c0caf5',
      buttonSecondaryHover: '#2f3549',

      inputBg: '#16161e',
      inputBorder: '#2f3549',
      inputFocus: '#7aa2f7',
      inputText: '#c0caf5',
      inputPlaceholder: '#565f89',

      codeBg: '#16161e',
      codeText: '#c0caf5',
      codeBorder: '#2f3549',

      sidebarBg: '#1a1b26',
      headerBg: '#1a1b26',
      modalOverlay: 'rgba(0, 0, 0, 0.7)',
      scrollbarThumb: '#414868',
      scrollbarTrack: '#16161e',

      successBg: '#9ece6a',
      successText: '#1a1b26',
      warningBg: '#e0af68',
      warningText: '#1a1b26',
      errorBg: '#f7768e',
      errorText: '#ffffff',
    },
  },

  // Solarized Dark theme
  'solarized-dark': {
    name: 'solarized-dark',
    displayName: 'Solarized Dark',
    colors: {
      bgPrimary: '#002b36',
      bgSecondary: '#073642',
      bgTertiary: '#0e4c5e',
      bgHover: '#145870',
      bgActive: '#1b6682',

      textPrimary: '#93a1a1',
      textSecondary: '#839496',
      textTertiary: '#586e75',
      textMuted: '#073642',

      borderPrimary: '#145870',
      borderSecondary: '#0e4c5e',
      borderFocus: '#268bd2',

      accentPrimary: '#268bd2',
      accentSecondary: '#2aa198',
      accentHover: '#4ca3df',

      buttonPrimaryBg: '#268bd2',
      buttonPrimaryText: '#fdf6e3',
      buttonPrimaryHover: '#4ca3df',
      buttonSecondaryBg: '#073642',
      buttonSecondaryText: '#93a1a1',
      buttonSecondaryHover: '#0e4c5e',

      inputBg: '#073642',
      inputBorder: '#145870',
      inputFocus: '#268bd2',
      inputText: '#93a1a1',
      inputPlaceholder: '#586e75',

      codeBg: '#073642',
      codeText: '#93a1a1',
      codeBorder: '#145870',

      sidebarBg: '#002b36',
      headerBg: '#002b36',
      modalOverlay: 'rgba(0, 43, 54, 0.8)',
      scrollbarThumb: '#145870',
      scrollbarTrack: '#073642',

      successBg: '#859900',
      successText: '#fdf6e3',
      warningBg: '#b58900',
      warningText: '#fdf6e3',
      errorBg: '#dc322f',
      errorText: '#fdf6e3',
    },
  },

  // Light theme - GitHub Light inspired
  'github-light': {
    name: 'github-light',
    displayName: 'GitHub Light',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f6f8fa',
      bgTertiary: '#eaeef2',
      bgHover: '#d0d7de',
      bgActive: '#b6bcc3',

      textPrimary: '#24292f',
      textSecondary: '#57606a',
      textTertiary: '#6e7781',
      textMuted: '#8c959f',

      borderPrimary: '#d0d7de',
      borderSecondary: '#eaeef2',
      borderFocus: '#0969da',

      accentPrimary: '#0969da',
      accentSecondary: '#0550ae',
      accentHover: '#218bff',

      buttonPrimaryBg: '#1f883d',
      buttonPrimaryText: '#ffffff',
      buttonPrimaryHover: '#1a7f37',
      buttonSecondaryBg: '#f6f8fa',
      buttonSecondaryText: '#24292f',
      buttonSecondaryHover: '#eaeef2',

      inputBg: '#ffffff',
      inputBorder: '#d0d7de',
      inputFocus: '#0969da',
      inputText: '#24292f',
      inputPlaceholder: '#6e7781',

      codeBg: '#f6f8fa',
      codeText: '#24292f',
      codeBorder: '#d0d7de',

      sidebarBg: '#ffffff',
      headerBg: '#ffffff',
      modalOverlay: 'rgba(0, 0, 0, 0.4)',
      scrollbarThumb: '#d0d7de',
      scrollbarTrack: '#f6f8fa',

      successBg: '#1f883d',
      successText: '#ffffff',
      warningBg: '#bf8700',
      warningText: '#ffffff',
      errorBg: '#cf222e',
      errorText: '#ffffff',
    },
  },
};

export const getTheme = (themeName: string): Theme => {
  return themes[themeName] || themes['astral-dark'];
};

export const themeNames = Object.keys(themes);
