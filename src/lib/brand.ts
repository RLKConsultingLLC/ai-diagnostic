// =============================================================================
// RLK Consulting — Brand Design System
// =============================================================================
// Extracted from official letterhead template + rlkconsultingco.com
// =============================================================================

export const BRAND = {
  // Company
  name: 'RLK Consulting',
  legalName: 'RLK Consulting, LLC',
  tagline: 'CIO Advisory',
  website: 'rlkconsultingco.com',
  productName: 'AI Diagnostic',

  // Color palette — from letterhead gradient bar + heading styles
  colors: {
    navy: '#0B1D3A',         // Primary — headings, header text, CTAs
    navyDark: '#071428',     // Darker variant for hover states
    secondary: '#364E6E',    // H2s, secondary elements
    tertiary: '#6B7F99',     // H3s, footer text, muted content
    accent: '#A8B5C4',       // Labels, CONFIDENTIAL marks, light accents
    light: '#CED5DD',        // Borders, disclaimers, very subtle elements
    body: '#2D2D2D',         // Body text
    bodyMuted: '#5A5A5A',    // Secondary body text
    white: '#FFFFFF',
    offWhite: '#F7F8FA',     // Background surfaces
    warmWhite: '#FAFBFC',    // Card backgrounds
    link: '#0563C1',         // Hyperlinks (from template)

    // Functional colors
    success: '#196B24',      // From Office accent3
    warning: '#E97132',      // From Office accent2
    info: '#156082',         // From Office accent1
    danger: '#A02B93',       // From Office accent5

    // Gradient bar segments (header decoration)
    gradientBar: ['#0B1D3A', '#364E6E', '#6B7F99', '#A8B5C4', '#CED5DD'],
  },

  // Typography — from letterhead styles.xml
  fonts: {
    heading: '"Calibri", "Helvetica Neue", Arial, sans-serif',
    headingLight: '"Calibri Light", "Helvetica Neue", Arial, sans-serif',
    body: '"Calibri", "Helvetica Neue", Arial, sans-serif',
    mono: '"Geist Mono", "SF Mono", monospace',
  },

  // Font sizes (matching template hierarchy)
  sizes: {
    h1: '2.5rem',   // 40px — Calibri Light in template
    h2: '1.75rem',  // 28px — Bold in template
    h3: '1.5rem',   // 24px — Bold in template
    h4: '1.125rem', // 18px
    body: '1rem',    // 16px
    small: '0.875rem', // 14px
    xs: '0.75rem',     // 12px
    xxs: '0.625rem',   // 10px
  },

  // Spacing
  spacing: {
    page: '1in',     // Template margins
    section: '2rem',
    paragraph: '0.75rem',
  },

  // Header/footer from letterhead
  confidential: 'CONFIDENTIAL & PROPRIETARY',
  disclaimer: 'This document contains information proprietary to RLK Consulting, LLC. Unauthorized distribution, reproduction, or disclosure is strictly prohibited.',
} as const;

// CSS custom properties for Tailwind integration
export const CSS_VARIABLES = {
  '--rlk-navy': BRAND.colors.navy,
  '--rlk-navy-dark': BRAND.colors.navyDark,
  '--rlk-secondary': BRAND.colors.secondary,
  '--rlk-tertiary': BRAND.colors.tertiary,
  '--rlk-accent': BRAND.colors.accent,
  '--rlk-light': BRAND.colors.light,
  '--rlk-body': BRAND.colors.body,
  '--rlk-body-muted': BRAND.colors.bodyMuted,
  '--rlk-off-white': BRAND.colors.offWhite,
  '--rlk-link': BRAND.colors.link,
} as const;
