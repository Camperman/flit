// Color profiles. The full palettes live in renderer CSS ([data-profile] +
// [data-theme] variable blocks); this registry is the single source for ids,
// display names, and the handful of colors main + the swatch picker need.

export interface ThemeColors {
  /** Window/chrome background (BrowserWindow backgroundColor + swatch bg). */
  bg: string
  accent: string
}

export interface Theme {
  id: string
  label: string
  dark: ThemeColors
  light: ThemeColors
}

export const THEMES: readonly Theme[] = [
  {
    id: 'graphite',
    label: 'Graphite',
    dark: { bg: '#202124', accent: '#4c8bf5' },
    light: { bg: '#f3f4f6', accent: '#3d7bec' }
  },
  {
    id: 'midnight',
    label: 'Midnight',
    dark: { bg: '#10141f', accent: '#8b9cf9' },
    light: { bg: '#eef1f9', accent: '#4f63e7' }
  },
  {
    id: 'forest',
    label: 'Forest',
    dark: { bg: '#141b16', accent: '#5fbf82' },
    light: { bg: '#eef4ef', accent: '#2e8b57' }
  },
  {
    id: 'ember',
    label: 'Ember',
    dark: { bg: '#1e1613', accent: '#f0954f' },
    light: { bg: '#f7f1ea', accent: '#d97a35' }
  },
  {
    id: 'orchid',
    label: 'Orchid',
    dark: { bg: '#1a1420', accent: '#c689e8' },
    light: { bg: '#f5f0f8', accent: '#9a4fd0' }
  },
  {
    id: 'ocean',
    label: 'Ocean',
    dark: { bg: '#0f1c1e', accent: '#35c2b4' },
    light: { bg: '#ecf4f4', accent: '#0e9488' }
  }
]

export const DEFAULT_THEME_ID = 'graphite'

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
