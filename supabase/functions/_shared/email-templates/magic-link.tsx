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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {BRAND.name} sign-in link</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Text style={styles.brandRow}>
          Carnivore<span style={styles.brandAccent}>X</span>
        </Text>
        <Heading style={styles.h1}>Sign in to {BRAND.name}</Heading>
        <Text style={styles.text}>
          Tap the button below to sign in. This link expires shortly for your security.
        </Text>
        <div style={styles.buttonWrap}>
          <Button style={styles.button} href={confirmationUrl}>
            Sign in to CarnivoreX
          </Button>
        </div>
        <Text style={styles.text}>
          Button not working? Paste this into your browser:
          <br />
          <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
        </Text>
        <div style={styles.divider} />
        <Text style={styles.footer}>
          Didn’t request this link? You can safely ignore this email.
          <br /><br />
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
