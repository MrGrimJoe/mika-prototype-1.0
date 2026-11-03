/**
 * Mika Central Design System (Tokens & Constants)
 * Authoritative source for all visual tokens across Mika.
 * 
 * Rules:
 * - Quiet neutral surfaces with a single indigo accent
 * - Fixed 5-state functional task colors kept strictly segregated
 * - One type voice: the system UI font (SF Pro on Apple devices, Inter elsewhere); mono only for code
 * - Calibrated transition physics
 */

export const colors = {
  paper: '#F5F5F7',
  paperRaised: '#EFEFF3',
  paperSunken: '#E8E8ED',
  hairline: '#E1E1E6',
  mutedText: '#5E5E67',
  secondaryText: '#46464D',
  ink: '#1D1D22',
  accent: '#3F4FD0',

  // Dark appearance. Mirrors the CSS variables in src/index.css, which follow
  // the system setting (prefers-color-scheme); there is no in-app switch.
  dark: {
    paper: '#101014',
    paperRaised: '#18181D',
    paperSunken: '#0B0B0E',
    surface: '#1C1C22',
    hairline: '#2C2C34',
    mutedText: '#9A9AA5',
    secondaryText: '#C4C4CC',
    ink: '#F5F5F7',
    accent: '#5565E6',
    accentText: '#8E9BFF',
  }
} as const;

/**
 * The authoritative task-state definitions and colors (Red, Blue, Yellow, Green, Grey, Red-Denied).
 * Functional status colors ONLY — never reused decoratively.
 * Values are CSS variables (light/dark defined in src/index.css); the hex is the light fallback.
 */
export const taskStateColors = {
  pending: {
    text: 'var(--status-pending-text, #B91C1C)',      // Red (5.9:1 on bg)
    bg: 'var(--status-pending-bg, #FEF2F2)',
    border: 'var(--status-pending-border, #FECACA)',
    dot: 'var(--status-pending-dot, #EF4444)',
    label: 'Pending'
  },
  help: {
    text: 'var(--status-help-text, #1D4ED8)',      // Blue (6.2:1 on bg)
    bg: 'var(--status-help-bg, #EFF6FF)',
    border: 'var(--status-help-border, #BFDBFE)',
    dot: 'var(--status-help-dot, #3B82F6)',
    label: 'Help Needed'
  },
  submitted: {
    text: 'var(--status-submitted-text, #854D0E)',      // Yellow (6.6:1 on bg)
    bg: 'var(--status-submitted-bg, #FEFCE8)',
    border: 'var(--status-submitted-border, #FEF08A)',
    dot: 'var(--status-submitted-dot, #EAB308)',
    label: 'Submitted'
  },
  done: {
    text: 'var(--status-done-text, #15803D)',      // Green (4.8:1 on bg)
    bg: 'var(--status-done-bg, #F0FDF4)',
    border: 'var(--status-done-border, #BBF7D0)',
    dot: 'var(--status-done-dot, #22C55E)',
    label: 'Approved'
  },
  rejected: {
    text: 'var(--status-pending-text, #B91C1C)',      // Same Red as Pending, disambiguated by label
    bg: 'var(--status-pending-bg, #FEF2F2)',
    border: 'var(--status-pending-border, #FECACA)',
    dot: 'var(--status-pending-dot, #EF4444)',
    label: 'Denied'
  },
  expired: {
    text: 'var(--status-expired-text, #4B5563)',      // Grey (6.9:1 on bg)
    bg: 'var(--status-expired-bg, #F3F4F6)',
    border: 'var(--status-expired-border, #E5E7EB)',
    dot: 'var(--status-expired-dot, #9CA3AF)',
    label: 'Expired'
  }
} as const;

export type TaskStatusKey = keyof typeof taskStateColors;

export const typography = {
  fontSerif: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Segoe UI", Roboto, sans-serif',
  fontBody: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  
  // Mathematical type scale
  scale: {
    h1: '2rem',       // 32px
    h2: '1.5rem',     // 24px
    h3: '1.25rem',    // 20px
    body: '1rem',      // 16px
    bodySmall: '0.875rem', // 14px
    caption: '0.75rem',    // 12px
    monoLabel: '0.6875rem' // 11px
  }
} as const;

export const spacing = {
  space1: '4px',
  space2: '8px',
  space3: '12px',
  space4: '16px',
  space6: '24px',
  space8: '32px',
  space12: '48px',
  space16: '64px'
} as const;

export const motionTokens = {
  pageTransition: {
    duration: 0.5,
    ease: [0.22, 1, 0.36, 1]
  },
  hoverTransition: {
    duration: 0.18,
    ease: 'easeOut'
  },
  revealStaggerDelay: 0.08
} as const;
