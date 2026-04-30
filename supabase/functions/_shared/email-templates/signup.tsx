/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const BRAND_NAME = 'CarnivoreX'
const BRAND_TAGLINE = 'Your personalized carnivore companion'
const BRAND_TEXT = '#0f172a'
const BRAND_ACCENT = '#b91c1c'
const BRAND_FAINT = '#94a3b8'

export const SignupEmail = ({
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Activate your {BRAND_NAME} account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandRow}>
          Carnivore<span style={brandAccent}>X</span>
        </Text>
        <Heading style={h1}>Activate your account</Heading>
        <Text style={text}>
          Welcome to <strong style={{ color: BRAND_TEXT }}>{BRAND_NAME}</strong>.
          Confirm <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
          to unlock your personalized carnivore plan, recipes, and progress tracking.
        </Text>
        <div style={buttonWrap}>
          <Button style={button} href={confirmationUrl}>
            Activate my {BRAND_NAME} account
          </Button>
        </div>
        <Text style={text}>
          Button not working? Paste this link into your browser:
          <br />
          <Link href={confirmationUrl} style={link}>{confirmationUrl}</Link>
        </Text>
        <div style={divider} />
        <Text style={footer}>
          You received this email because someone signed up for {BRAND_NAME}.
          If it wasn’t you, ignore this message — no account will be created.
          <br /><br />
          © {new Date().getFullYear()} {BRAND_NAME} · {BRAND_TAGLINE}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandRow = {
  fontSize: '20px',
  fontWeight: 800 as const,
  color: BRAND_TEXT,
  letterSpacing: '-0.02em',
  margin: '0 0 24px',
}
const brandAccent = { color: BRAND_ACCENT }
const h1 = {
  fontSize: '24px',
  fontWeight: 700 as const,
  color: BRAND_TEXT,
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: BRAND_ACCENT, textDecoration: 'underline' }
const buttonWrap = { margin: '8px 0 24px' }
const button = {
  backgroundColor: BRAND_TEXT,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '14px 22px',
  textDecoration: 'none',
}
const divider = {
  borderTop: '1px solid #e2e8f0',
  margin: '28px 0 20px',
}
const footer = { fontSize: '12px', color: BRAND_FAINT, lineHeight: '1.5', margin: 0 }
