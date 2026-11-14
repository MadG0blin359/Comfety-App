export const THEME = {
  colors: {
    // Primary Background & Surfaces
    background: '#090D16',
    surfaceElevated: '#131B2E',
    surfaceInteractive: '#1E293B',
    surfaceContainerHigh: '#262A34',
    surfaceContainerLow: '#181B25',

    // Conversation Mode Palette (High-Visibility Sky Blue)
    conversationAccent: '#38BDF8',
    conversationContainer: '#38BDF8',
    onConversationContainer: '#001E2C',
    conversationBorder: '#38BDF8',
    glowConversation: 'rgba(56, 189, 248, 0.16)',

    // Guide Mode Palette (High-Visibility Emerald Green)
    guideAccent: '#34D399',
    guideContainer: '#45DFA4',
    onGuideContainer: '#002114',
    guideBorder: '#34D399',
    glowGuide: 'rgba(52, 211, 153, 0.16)',

    // Typography & Contrast (WCAG AAA >= 7:1)
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',

    // Status, Hazards & Borders
    warning: '#F59E0B',
    danger: '#EF4444',
    safe: '#34D399',
    borderSubtle: '#334155',
  },

  typography: {
    sizes: {
      headlineLg: 26,
      headlineMd: 22,
      bodyTranscript: 22,
      bodyLg: 17,
      bodyMd: 15,
      caption: 13,
      counterDisplay: 40,
    },
    lineHeights: {
      headlineLg: 34,
      headlineMd: 30,
      bodyTranscript: 36, // >= fontSize * 1.6 for Urdu Nastaliq
      bodyLg: 24,
      bodyMd: 22,
      caption: 18,
      counterDisplay: 52,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },

  borderRadius: {
    card: 20,
    button: 14,
    badge: 12,
    iconBox: 16,
    full: 9999,
  },

  touchTargets: {
    min: 48,
    actionButton: 56,
  },
} as const;

export type ThemeType = typeof THEME;
