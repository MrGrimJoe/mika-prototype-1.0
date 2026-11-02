/**
 * Mika Central Design System (Tokens & Constants)
 * Authoritative source for all visual tokens across Mika.
 * 
 * Rules:
 * - High-contrast editorial paper & ink palette
 * - Fixed 5-state functional task colors kept strictly segregated
 * - Distinct typography hierarchy (Source Serif 4, Inter, JetBrains Mono)
 * - Calibrated transition physics
 */

export const colors = {
  paper: '#F7F5F0',
  paperRaised: '#EFEBE2',
  paperSunken: '#E8E4DA',
  hairline: '#DAD5C9',
  mutedText: '#6B665A',
  secondaryText: '#5C574B',
  ink: '#1C2438',
  accent: '#2F3B7A',

  // Dark mode inversion
  dark: {
    paper: '#12151C',
    paperRaised: '#181C26',
    paperSunken: '#0E1017',
    hairline: '#282F40',
    mutedText: '#7B8499',
    secondaryText: '#A5AFC4',
    ink: '#E8ECF5',
    accent: '#5E72D9',
  }
} as const;

/**
 * The authoritative task-state definitions and colors (Red, Blue, Yellow, Green, Grey, Red-Denied).
 * Functional status colors ONLY — never reused decoratively.
 */
export const taskStateColors = {
  pending: {
    text: '#B91C1C',      // Red (5.9:1 on bg)
    bg: '#FEF2F2',
    border: '#FECACA',
    dot: '#EF4444',
    label: 'Pending'
  },
  help: {
    text: '#1D4ED8',      // Blue (6.2:1 on bg)
    bg: '#EFF6FF',
    border: '#BFDBFE',
    dot: '#3B82F6',
    label: 'Help Needed'
  },
  submitted: {
    text: '#854D0E',      // Yellow (6.6:1 on bg)
    bg: '#FEFCE8',
    border: '#FEF08A',
    dot: '#EAB308',
    label: 'Submitted'
  },
  done: {
    text: '#15803D',      // Green (4.8:1 on bg)
    bg: '#F0FDF4',
    border: '#BBF7D0',
    dot: '#22C55E',
    label: 'Approved'
  },
  rejected: {
    text: '#B91C1C',      // Same Red as Pending, disambiguated by label
    bg: '#FEF2F2',
    border: '#FECACA',
    dot: '#EF4444',
    label: 'Denied'
  },
  expired: {
    text: '#4B5563',      // Grey (6.9:1 on bg)
    bg: '#F3F4F6',
    border: '#E5E7EB',
    dot: '#9CA3AF',
    label: 'Expired'
  }
} as const;

export type TaskStatusKey = keyof typeof taskStateColors;

export const typography = {
  fontSerif: 'Source Serif 4, Georgia, serif',
  fontBody: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  
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
