import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '../components/layout/Header'
import { Anchor } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Cookie Policy - Helmwise',
  description: 'Helmwise Cookie Policy. Learn about the cookies we use and how to manage your cookie preferences.',
}

export default function CookiesPage() {
  const lastUpdated = 'February 2026'

  return (
    <>
      <Header />

      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-4xl mb-2">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">

            {/* Introduction */}
            <section>
              <h2 className="font-display text-2xl mb-4">What Are Cookies</h2>
              <p className="text-muted-foreground">
                Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work more efficiently, provide a better user experience, and give site owners useful information. This policy explains what cookies Helmwise uses and how you can manage them.
              </p>
            </section>

            {/* Essential Cookies */}
            <section>
              <h2 className="font-display text-2xl mb-4">1. Essential Cookies</h2>
              <p className="text-muted-foreground mb-4">
                These cookies are strictly necessary for the Service to function. They cannot be disabled without breaking core functionality.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-muted-foreground">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Cookie</th>
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Purpose</th>
                      <th className="text-left py-3 font-semibold text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">sb-auth-token</td>
                      <td className="py-3 pr-4">Authentication session token via Supabase. Keeps you signed in securely.</td>
                      <td className="py-3">Session</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">sb-refresh-token</td>
                      <td className="py-3 pr-4">Refresh token for maintaining your authenticated session.</td>
                      <td className="py-3">7 days</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">csrf-token</td>
                      <td className="py-3 pr-4">Cross-Site Request Forgery protection. Prevents unauthorized actions on your behalf.</td>
                      <td className="py-3">Session</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Preference Cookies */}
            <section>
              <h2 className="font-display text-2xl mb-4">2. Preference Cookies</h2>
              <p className="text-muted-foreground mb-4">
                These cookies remember your settings and preferences to provide a more personalized experience.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-muted-foreground">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Cookie</th>
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Purpose</th>
                      <th className="text-left py-3 font-semibold text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">theme</td>
                      <td className="py-3 pr-4">Stores your preferred color theme (light or dark mode).</td>
                      <td className="py-3">1 year</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">locale</td>
                      <td className="py-3 pr-4">Stores your preferred language and unit system (nautical miles, knots, etc.).</td>
                      <td className="py-3">1 year</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">vessel-defaults</td>
                      <td className="py-3 pr-4">Remembers your default vessel selection for quicker passage planning.</td>
                      <td className="py-3">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Analytics Cookies */}
            <section>
              <h2 className="font-display text-2xl mb-4">3. Analytics Cookies</h2>
              <p className="text-muted-foreground mb-4">
                These cookies help us understand how the Service is used so we can improve it. All analytics data is collected anonymously.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-muted-foreground">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Cookie</th>
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Purpose</th>
                      <th className="text-left py-3 font-semibold text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">sentry-trace</td>
                      <td className="py-3 pr-4">Anonymous error tracking and performance monitoring via Sentry. Helps us identify and fix issues.</td>
                      <td className="py-3">Session</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4 font-mono text-xs">usage-session</td>
                      <td className="py-3 pr-4">Anonymous session identifier for understanding usage patterns (features used, navigation flows).</td>
                      <td className="py-3">30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground mt-4">
                We do not use cookies for advertising purposes. We do not use third-party advertising cookies or tracking pixels.
              </p>
            </section>

            {/* Managing Cookies */}
            <section>
              <h2 className="font-display text-2xl mb-4">4. How to Manage Cookies</h2>
              <p className="text-muted-foreground mb-4">
                Most web browsers allow you to control cookies through their settings. You can typically find cookie management options in your browser&apos;s &ldquo;Settings,&rdquo; &ldquo;Preferences,&rdquo; or &ldquo;Privacy&rdquo; section.
              </p>
              <p className="text-muted-foreground mb-4">
                Common browser cookie settings:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>Chrome:</strong> Settings &rarr; Privacy and Security &rarr; Cookies and other site data</li>
                <li><strong>Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Cookies and Site Data</li>
                <li><strong>Safari:</strong> Preferences &rarr; Privacy &rarr; Manage Website Data</li>
                <li><strong>Edge:</strong> Settings &rarr; Cookies and site permissions &rarr; Manage and delete cookies</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>Please note:</strong> Blocking essential cookies will prevent you from signing in and using core features of Helmwise. Blocking preference cookies will reset your settings to defaults on each visit.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="font-display text-2xl mb-4">5. Contact</h2>
              <p className="text-muted-foreground">
                For questions about our use of cookies, contact us at{' '}
                <a href="mailto:privacy@helmwise.co" className="text-primary hover:underline">privacy@helmwise.co</a>.
                For more information about how we handle your data, see our{' '}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
              </p>
            </section>

          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-12 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">Helmwise</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Helmwise. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
