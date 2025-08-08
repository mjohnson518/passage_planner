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
  Column,
  Row,
} from '@react-email/components'
import * as React from 'react'

interface UsageReportEmailProps {
  userName?: string
  month: string
  year: number
  stats: {
    passagesPlanned: number
    totalDistance: number
    portsVisited: number
    hoursAtSea: number
  }
  topPassages: Array<{
    name: string
    distance: number
    date: string
  }>
  subscriptionTier: 'free' | 'premium' | 'pro'
  remainingPassages?: number
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helmwise.co'

export const UsageReportEmail = ({
  userName = 'Captain',
  month = 'October',
  year = 2024,
  stats = {
    passagesPlanned: 5,
    totalDistance: 1250,
    portsVisited: 8,
    hoursAtSea: 168,
  },
  topPassages = [],
  subscriptionTier = 'premium',
  remainingPassages,
}: UsageReportEmailProps) => {
  const previewText = `Your ${month} ${year} Passage Planner summary`

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

          <Heading style={h1}>Your {month} sailing summary</Heading>
          
          <Text style={text}>
            Ahoy {userName}! Here's how your passages shaped up this month.
          </Text>

          <Section style={statsGrid}>
            <Row>
              <Column style={statColumn}>
                <Text style={statNumber}>{stats.passagesPlanned}</Text>
                <Text style={statLabel}>Passages Planned</Text>
              </Column>
              <Column style={statColumn}>
                <Text style={statNumber}>{stats.totalDistance.toLocaleString()}</Text>
                <Text style={statLabel}>Nautical Miles</Text>
              </Column>
            </Row>
            <Row style={{ marginTop: '20px' }}>
              <Column style={statColumn}>
                <Text style={statNumber}>{stats.portsVisited}</Text>
                <Text style={statLabel}>Ports Visited</Text>
              </Column>
              <Column style={statColumn}>
                <Text style={statNumber}>{stats.hoursAtSea}</Text>
                <Text style={statLabel}>Hours at Sea</Text>
              </Column>
            </Row>
          </Section>

          {topPassages.length > 0 && (
            <Section style={passagesSection}>
              <Heading as="h2" style={h2}>
                Your top passages this month:
              </Heading>
              
              {topPassages.map((passage, index) => (
                <Section key={index} style={passageItem}>
                  <Row>
                    <Column style={{ width: '60%' }}>
                      <Text style={passageName}>{passage.name}</Text>
                      <Text style={passageDate}>{passage.date}</Text>
                    </Column>
                    <Column style={{ width: '40%', textAlign: 'right' }}>
                      <Text style={passageDistance}>
                        {passage.distance.toLocaleString()} nm
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>
          )}

          {subscriptionTier === 'free' && (
            <Section style={upgradeSection}>
              <Text style={upgradeTitle}>
                📈 You used {stats.passagesPlanned} of your 2 free passages this month
              </Text>
              <Text style={upgradeText}>
                Upgrade to Premium for 10 passages per month, or go Pro for unlimited planning!
              </Text>
              <Button style={upgradeButton} href={`${baseUrl}/pricing`}>
                View Upgrade Options
              </Button>
            </Section>
          )}

          {subscriptionTier === 'premium' && remainingPassages !== undefined && (
            <Section style={usageSection}>
              <Text style={usageText}>
                You have {remainingPassages} passages remaining this month.
                {remainingPassages < 3 && ' Consider upgrading to Pro for unlimited passages!'}
              </Text>
            </Section>
          )}

          <Section style={tipsSection}>
            <Heading as="h2" style={h2}>
              💡 Planning tip of the month
            </Heading>
            <Text style={tipText}>
              Did you know you can save fuel and time by planning passages around favorable 
              currents? Use our tidal planning feature to find the optimal departure times 
              for your next passage.
            </Text>
            <Link href={`${baseUrl}/docs/tidal-planning`} style={tipLink}>
              Learn more about tidal planning →
            </Link>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={`${baseUrl}/dashboard`}>
              Plan Your Next Passage
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Fair winds and following seas,
              <br />
              The Passage Planner Team
            </Text>
            
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/dashboard`} style={footerLink}>
                Dashboard
              </Link>
              {' • '}
              <Link href={`${baseUrl}/passages`} style={footerLink}>
                Your Passages
              </Link>
              {' • '}
              <Link href={`${baseUrl}/account`} style={footerLink}>
                Account Settings
              </Link>
            </Text>
            
            <Text style={unsubscribe}>
              <Link href={`${baseUrl}/unsubscribe`} style={unsubscribeLink}>
                Unsubscribe from monthly reports
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

UsageReportEmail.PreviewProps = {
  userName: 'Captain Smith',
  month: 'October',
  year: 2024,
  stats: {
    passagesPlanned: 8,
    totalDistance: 2450,
    portsVisited: 12,
    hoursAtSea: 312,
  },
  topPassages: [
    { name: 'San Francisco to Half Moon Bay', distance: 25, date: 'Oct 5' },
    { name: 'Half Moon Bay to Monterey', distance: 45, date: 'Oct 12' },
    { name: 'Monterey to Morro Bay', distance: 85, date: 'Oct 19' },
  ],
  subscriptionTier: 'premium',
  remainingPassages: 2,
} as UsageReportEmailProps

export default UsageReportEmail

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
  padding: '0 20px',
}

const text = {
  color: '#64748b',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
  padding: '0 20px',
}

const statsGrid = {
  backgroundColor: '#f8fafc',
  padding: '32px 20px',
  margin: '32px 0',
}

const statColumn = {
  textAlign: 'center' as const,
  padding: '0 10px',
}

const statNumber = {
  color: '#0ea5e9',
  fontSize: '36px',
  fontWeight: '700',
  lineHeight: '40px',
  margin: '0 0 8px',
}

const statLabel = {
  color: '#64748b',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const passagesSection = {
  padding: '0 20px',
  margin: '32px 0',
}

const passageItem = {
  borderBottom: '1px solid #e2e8f0',
  padding: '16px 0',
}

const passageName = {
  color: '#1e293b',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 4px',
}

const passageDate = {
  color: '#94a3b8',
  fontSize: '14px',
  margin: '0',
}

const passageDistance = {
  color: '#64748b',
  fontSize: '16px',
  fontWeight: '500',
  margin: '0',
}

const upgradeSection = {
  backgroundColor: '#eff6ff',
  border: '1px solid #dbeafe',
  borderRadius: '8px',
  padding: '24px',
  margin: '32px 20px',
  textAlign: 'center' as const,
}

const upgradeTitle = {
  color: '#1e40af',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px',
}

const upgradeText = {
  color: '#3730a3',
  fontSize: '14px',
  margin: '0 0 16px',
}

const upgradeButton = {
  backgroundColor: '#3b82f6',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '10px 20px',
}

const usageSection = {
  backgroundColor: '#fef3c7',
  border: '1px solid #fde68a',
  borderRadius: '8px',
  padding: '16px',
  margin: '32px 20px',
}

const usageText = {
  color: '#92400e',
  fontSize: '14px',
  margin: '0',
  textAlign: 'center' as const,
}

const tipsSection = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '24px',
  margin: '32px 20px',
}

const tipText = {
  color: '#166534',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 12px',
  padding: '0',
}

const tipLink = {
  color: '#15803d',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'underline',
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

const unsubscribe = {
  margin: '16px 0 0',
  padding: '0 20px',
  textAlign: 'center' as const,
}

const unsubscribeLink = {
  color: '#94a3b8',
  fontSize: '12px',
  textDecoration: 'underline',
} 