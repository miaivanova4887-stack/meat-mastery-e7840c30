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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {BRAND.name} password</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Text style={styles.brandRow}>
          Carnivore<span style={styles.brandAccent}>X</span>
        </Text>
        <Heading style={styles.h1}>Reset your password</Heading>
        <Text style={styles.text}>
          We received a request to reset the password on your {BRAND.name} account.
          Choose a new one using the secure link below.
        </Text>
        <div style={styles.buttonWrap}>
          <Button style={styles.button} href={confirmationUrl}>
            Choose a new password
          </Button>
        </div>
        <Text style={styles.text}>
          Link not working? Paste this into your browser:
          <br />
          <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
        </Text>
        <div style={styles.divider} />
        <Text style={styles.footer}>
          If you didn’t request this, you can safely ignore this email — your
          password will not change.
          <br /><br />
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
