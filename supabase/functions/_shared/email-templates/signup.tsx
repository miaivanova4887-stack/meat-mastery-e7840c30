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
import { BRAND, styles } from './_brand.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Activate your {BRAND.name} account</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Text style={styles.brandRow}>
          Carnivore<span style={styles.brandAccent}>X</span>
        </Text>
        <Heading style={styles.h1}>Activate your account</Heading>
        <Text style={styles.text}>
          Welcome to <strong style={{ color: BRAND.text }}>{BRAND.name}</strong>.
          Confirm <Link href={`mailto:${recipient}`} style={styles.link}>{recipient}</Link>{' '}
          to unlock your personalized carnivore plan, recipes, and progress tracking.
        </Text>
        <div style={styles.buttonWrap}>
          <Button style={styles.button} href={confirmationUrl}>
            Activate my CarnivoreX account
          </Button>
        </div>
        <Text style={styles.text}>
          Button not working? Paste this link into your browser:
          <br />
          <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
        </Text>
        <div style={styles.divider} />
        <Text style={styles.footer}>
          You received this email because someone signed up at{' '}
          <Link href={siteUrl} style={{ color: BRAND.faint }}>{siteUrl}</Link>.
          If it wasn’t you, ignore this message — no account will be created.
          <br /><br />
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
