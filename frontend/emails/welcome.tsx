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

interface WelcomeEmailProps {
  userName?: string
  userEmail: string
  loginUrl?: string
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://passageplanner.com'

export const WelcomeEmail = ({
  userName = 'there',
  userEmail,
  loginUrl = `${baseUrl}/login`,
}: WelcomeEmailProps) => {
  const previewText = `Welcome to Passage Planner - Your AI-powered sailing companion`

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
              alt="Passage Planner"
              style={logo}
            />
          </Section>

          <Heading style={h1}>Welcome aboard, {userName}!</Heading>
          
          <Text style={text}>
            We're thrilled to have you join Passage Planner. You're now part of a community
            of sailors who plan smarter, safer passages with AI-powered insights.
          </Text>

          <Section style={featureSection}>
            <Heading as="h2" style={h2}>
              What you can do with Passage Planner:
            </Heading>
            
            <Section style={featureItem}>
              <Text style={featureTitle}>🌊 Real-time Weather Analysis</Text>
              <Text style={featureDescription}>
                Get comprehensive weather forecasts and routing recommendations
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureTitle}>⚓ Port Information</Text>
              <Text style={featureDescription}>
                Access detailed port data, moorings, and local regulations
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureTitle}>🌙 Tidal Calculations</Text>
              <Text style={featureDescription}>
                Plan your passages with accurate tidal predictions
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureTitle}>🚢 Safety Alerts</Text>
              <Text style={featureDescription}>
                Receive NOTAMs and safety bulletins for your route
              </Text>
            </Section>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Start Planning Your First Passage
            </Button>
          </Section>

          <Text style={text}>
            Need help getting started? Check out our{' '}
            <Link href={`${baseUrl}/docs`} style={link}>
              documentation
            </Link>{' '}
            or reply to this email - we're here to help!
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              Fair winds and following seas,
              <br />
              The Passage Planner Team
            </Text>
            
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/pricing`} style={footerLink}>
                Pricing
              </Link>
              {' • '}
              <Link href={`${baseUrl}/docs`} style={footerLink}>
                Documentation
              </Link>
              {' • '}
              <Link href={`${baseUrl}/support`} style={footerLink}>
                Support
              </Link>
            </Text>
            
            <Text style={footerAddress}>
              Passage Planner Inc.
              <br />
              123 Harbor Way, Marina del Rey, CA 90292
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

WelcomeEmail.PreviewProps = {
  userName: 'Captain Smith',
  userEmail: 'captain@example.com',
} as WelcomeEmailProps

export default WelcomeEmail

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
  padding: '32px 20px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
}

const h1 = {
  color: '#1e293b',
  fontSize: '32px',
  fontWeight: '600',
  lineHeight: '40px',
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
}

const text = {
  color: '#64748b',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
  padding: '0 20px',
}

const featureSection = {
  padding: '32px 20px',
  backgroundColor: '#f8fafc',
  margin: '32px 0',
}

const featureItem = {
  marginBottom: '20px',
}

const featureTitle = {
  color: '#1e293b',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '24px',
  margin: '0 0 4px',
}

const featureDescription = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
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
  padding: '12px 24px',
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
  margin: '0 0 16px',
  padding: '0 20px',
  textAlign: 'center' as const,
}

const footerLink = {
  color: '#64748b',
  textDecoration: 'underline',
}

const footerAddress = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0',
  padding: '0 20px',
  textAlign: 'center' as const,
} 