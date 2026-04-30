// Shared CarnivoreX brand tokens for auth emails.
// Keep this file dependency-free so every template can import it.

export const BRAND = {
  name: 'CarnivoreX',
  tagline: 'The carnivore lifestyle, simplified.',
  primary: 'hsl(22, 85%, 48%)',
  primaryForeground: '#ffffff',
  text: '#1a1a1a',
  muted: '#6b6b6b',
  faint: '#a1a1a1',
  border: '#ececec',
  bg: '#ffffff',
  surface: '#fafafa',
  radius: '12px',
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
}

export const styles = {
  main: {
    backgroundColor: BRAND.surface,
    fontFamily: BRAND.fontStack,
    margin: 0,
    padding: '32px 0',
  },
  container: {
    backgroundColor: BRAND.bg,
    border: `1px solid ${BRAND.border}`,
    borderRadius: '16px',
    margin: '0 auto',
    maxWidth: '520px',
    padding: '40px 36px',
  },
  brandRow: {
    fontSize: '20px',
    fontWeight: 800 as const,
    letterSpacing: '0.02em',
    color: BRAND.text,
    textTransform: 'uppercase' as const,
    margin: '0 0 28px',
  },
  brandAccent: { color: BRAND.primary },
  h1: {
    fontSize: '24px',
    fontWeight: 700 as const,
    color: BRAND.text,
    lineHeight: '1.25',
    margin: '0 0 16px',
  },
  text: {
    fontSize: '15px',
    color: BRAND.muted,
    lineHeight: '1.6',
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: BRAND.primary,
    color: BRAND.primaryForeground,
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: BRAND.radius,
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  buttonWrap: { margin: '8px 0 28px' },
  link: { color: BRAND.primary, textDecoration: 'underline' },
  divider: {
    borderTop: `1px solid ${BRAND.border}`,
    margin: '32px 0 20px',
  },
  footer: {
    fontSize: '12px',
    color: BRAND.faint,
    lineHeight: '1.5',
    margin: '0',
  },
  code: {
    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
    fontSize: '28px',
    fontWeight: 700 as const,
    color: BRAND.text,
    letterSpacing: '0.4em',
    backgroundColor: BRAND.surface,
    border: `1px solid ${BRAND.border}`,
    borderRadius: BRAND.radius,
    padding: '16px 20px',
    textAlign: 'center' as const,
    margin: '0 0 24px',
  },
}
