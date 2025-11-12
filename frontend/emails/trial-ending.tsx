import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface TrialEndingEmailProps {
  userName?: string
  daysRemaining: number
  upgradeUrl?: string
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helmwise.co'

export const TrialEndingEmail = ({
  userName = 'there',
  daysRemaining = 3,
  upgradeUrl = `${baseUrl}/pricing`,
}: TrialEndingEmailProps) => {
  const previewText = `Your Helmwise trial ends in ${daysRemaining} days`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="120"
              height="40"
              alt="Helmwise"
              style={logo}
            />
          </Section>

          <Section style={warningBanner}>
            <Text style={warningText}>
              ⏰ Your trial ends in {daysRemaining} days
            </Text>
          </Section>

          <Heading style={h1}>Don't lose your passage planning momentum!</Heading>
          
          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            Your Helmwise trial is coming to an end in just {daysRemaining} days. 
            We hope you've enjoyed planning safer, smarter passages with our AI-powered tools.
          </Text>

          <Section style={statsSection}>
            <Heading as="h2" style={h2}>
              What you'll keep with a subscription:
            </Heading>
            
            <Section style={benefitGrid}>
              <Section style={benefitItem}>
                <Text style={benefitEmoji}>📊</Text>
                <Text style={benefitTitle}>Unlimited Passages</Text>
                <Text style={benefitDescription}>
                  Plan as many routes as you need
                </Text>
              </Section>

              <Section style={benefitItem}>
                <Text style={benefitEmoji}>🌍</Text>
                <Text style={benefitTitle}>Global Coverage</Text>
                <Text style={benefitDescription}>
                  Weather and port data worldwide
                </Text>
              </Section>

              <Section style={benefitItem}>
                <Text style={benefitEmoji}>📱</Text>
                <Text style={benefitTitle}>Mobile Access</Text>
                <Text style={benefitDescription}>
                  Plan on any device, anywhere
                </Text>
              </Section>

              <Section style={benefitItem}>
                <Text style={benefitEmoji}>💾</Text>
                <Text style={benefitTitle}>Route History</Text>
                <Text style={benefitDescription}>
                  Keep all your passages saved
                </Text>
              </Section>
            </Section>
          </Section>

          <Section style={pricingSection}>
            <Heading as="h2" style={h2}>
              Choose your plan:
            </Heading>
            
            <Section style={priceCard}>
              <Text style={planName}>Premium</Text>
              <Text style={planPrice}>$19/month</Text>
              <Text style={planFeature}>• 10 passages per month</Text>
              <Text style={planFeature}>• 7-day weather forecasts</Text>
              <Text style={planFeature}>• Email support</Text>
            </Section>

            <Section style={priceCard}>
              <Text style={planName}>Pro</Text>
              <Text style={planPrice}>$49/month</Text>
              <Text style={planFeature}>• Unlimited passages</Text>
              <Text style={planFeature}>• 14-day weather forecasts</Text>
              <Text style={planFeature}>• Priority support</Text>
              <Text style={planFeature}>• API access</Text>
            </Section>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={upgradeUrl}>
              Upgrade Now & Save 20%
            </Button>
            <Text style={discountText}>
              Use code SAILOR20 at checkout
            </Text>
          </Section>

          <Text style={text}>
            Have questions? Reply to this email or check out our{' '}
            <Link href={`${baseUrl}/faq`} style={link}>
              FAQ
            </Link>.
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              Fair winds,
              <br />
              The Helmwise Team
            </Text>
            
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/pricing`} style={footerLink}>
                View Plans
              </Link>
              {' • '}
              <Link href={`${baseUrl}/dashboard`} style={footerLink}>
                Dashboard
              </Link>
              {' • '}
              <Link href={`${baseUrl}/support`} style={footerLink}>
                Support
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

TrialEndingEmail.PreviewProps = {
  userName: 'Captain',
  daysRemaining: 3,
} as TrialEndingEmailProps

export default TrialEndingEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const logoContainer = {
  padding: '32px 20px 20px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
}

const warningBanner = {
  backgroundColor: '#fef3c7',
  padding: '12px 20px',
  margin: '0 0 32px',
  textAlign: 'center' as const,
}

const warningText = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
}

const h1 = {
  color: '#1e293b',
  fontSize: '28px',
  fontWeight: '600',
  lineHeight: '36px',
  margin: '0 0 20px',
  padding: '0 20px',
  textAlign: 'center' as const,
}

const h2 = {
  color: '#1e293b',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '28px',
  margin: '0 0 16px',
  padding: '0 20px',
}

const text = {
  color: '#64748b',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
  padding: '0 20px',
}

const statsSection = {
  margin: '32px 0',
}

const benefitGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '20px',
  padding: '0 20px',
}

const benefitItem = {
  textAlign: 'center' as const,
}

const benefitEmoji = {
  fontSize: '32px',
  margin: '0 0 8px',
}

const benefitTitle = {
  color: '#1e293b',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 4px',
}

const benefitDescription = {
  color: '#64748b',
  fontSize: '14px',
  margin: '0',
}

const pricingSection = {
  backgroundColor: '#f8fafc',
  padding: '32px 0',
  margin: '32px 0',
}

const priceCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '20px',
  margin: '0 20px 16px',
}

const planName = {
  color: '#1e293b',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px',
}

const planPrice = {
  color: '#0ea5e9',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 16px',
}

const planFeature = {
  color: '#64748b',
  fontSize: '14px',
  margin: '0 0 8px',
}

const buttonContainer = {
  padding: '20px',
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#0ea5e9',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}

const discountText = {
  color: '#059669',
  fontSize: '14px',
  fontWeight: '600',
  margin: '8px 0 0',
}

const link = {
  color: '#0ea5e9',
  textDecoration: 'underline',
}

const footer = {
  borderTop: '1px solid #e2e8f0',
  marginTop: '48px',
  paddingTop: '32px',
}

const footerText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 16px',
  padding: '0 20px',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  padding: '0 20px',
  textAlign: 'center' as const,
}

const footerLink = {
  color: '#64748b',
  textDecoration: 'underline',
} 