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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You’re invited to join {BRAND.name}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Text style={styles.brandRow}>
          Carnivore<span style={styles.brandAccent}>X</span>
        </Text>
        <Heading style={styles.h1}>You’re invited</Heading>
        <Text style={styles.text}>
          Someone invited you to join{' '}
          <Link href={siteUrl} style={styles.link}>
            <strong>{BRAND.name}</strong>
          </Link>
          . Accept your invitation and create your account to get started.
        </Text>
        <div style={styles.buttonWrap}>
          <Button style={styles.button} href={confirmationUrl}>
            Accept invitation
          </Button>
        </div>
        <div style={styles.divider} />
        <Text style={styles.footer}>
          If you weren’t expecting this invitation, you can safely ignore it.
          <br /><br />
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
