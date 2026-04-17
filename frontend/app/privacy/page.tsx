import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "../components/layout/Header";
import { Anchor } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy - Helmwise",
  description:
    "Helmwise Privacy Policy. Learn how we collect, use, and protect your data when using our AI-powered passage planning platform.",
};

export default function PrivacyPage() {
  const lastUpdated = "April 2026";

  return (
    <>
      <Header />

      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-4xl mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            Last updated: {lastUpdated}
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">
            {/* Introduction */}
            <section>
              <h2 className="font-display text-2xl mb-4">Introduction</h2>
              <p className="text-muted-foreground">
                Helmwise (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
                &ldquo;our&rdquo;) is committed to protecting your privacy. This
                Privacy Policy explains how we collect, use, share, and
                safeguard your information when you use our AI-powered passage
                planning platform at helmwise.co (the &ldquo;Service&rdquo;). By
                using the Service, you agree to the collection and use of
                information in accordance with this policy.
              </p>
            </section>

            {/* 1. What Data We Collect */}
            <section>
              <h2 className="font-display text-2xl mb-4">
                1. What Data We Collect
              </h2>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                1.1 Account Information
              </h3>
              <p className="text-muted-foreground">
                When you create an account, we collect your name, email address,
                and authentication credentials. If you subscribe to a paid plan,
                we collect billing information through our payment processor,
                Stripe. We do not store full credit card numbers on our servers.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                1.2 Vessel Data
              </h3>
              <p className="text-muted-foreground">
                You may provide vessel information including vessel name, type,
                length, beam, draft, displacement, fuel capacity, water
                capacity, and engine specifications. This data is used to
                generate accurate passage plans and safety assessments tailored
                to your vessel.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                1.3 Passage Plans
              </h3>
              <p className="text-muted-foreground">
                We collect and store the passage plans you create, including
                departure and arrival ports, waypoints, route data, weather
                briefings, tidal analyses, safety assessments, and any exported
                documents (GPX, PDF). This data is essential for providing the
                Service and maintaining safety audit trails.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                1.4 Usage Analytics
              </h3>
              <p className="text-muted-foreground">
                We collect anonymous usage data to understand how the Service is
                used and to improve it. This includes pages visited, features
                used, session duration, browser type, device type, and general
                geographic region. We use Sentry for error tracking, which may
                collect technical information about errors and crashes you
                encounter.
              </p>
            </section>

            {/* 2. How We Use Your Data */}
            <section>
              <h2 className="font-display text-2xl mb-4">
                2. How We Use Your Data
              </h2>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                2.1 Passage Planning
              </h3>
              <p className="text-muted-foreground">
                Your vessel data and route information are processed by our AI
                agents to generate comprehensive passage plans, including
                weather routing, tidal predictions, safety assessments, and port
                information. This is the core purpose of the Service.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                2.2 Safety Analysis
              </h3>
              <p className="text-muted-foreground">
                Vessel specifications and route data are used to calculate
                safety margins, identify hazards, assess weather risks, and
                generate GO/CAUTION/NO-GO recommendations. Safety audit logs are
                maintained to support the integrity of our safety systems.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                2.3 Service Improvement
              </h3>
              <p className="text-muted-foreground">
                Aggregated and anonymized usage data helps us improve the
                accuracy of our AI agents, identify areas where the Service can
                be enhanced, and prioritize new features. We may analyze passage
                plan patterns in aggregate to improve route recommendations and
                safety assessments.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                2.4 Communications
              </h3>
              <p className="text-muted-foreground">
                We may use your email address to send transactional messages
                (account verification, password resets, subscription
                confirmations), service announcements, and safety-related
                notifications. You can opt out of non-essential communications
                at any time.
              </p>
            </section>

            {/* 3. Data Sharing */}
            <section>
              <h2 className="font-display text-2xl mb-4">3. Data Sharing</h2>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                3.1 Third-Party APIs
              </h3>
              <p className="text-muted-foreground">
                To generate passage plans, we send route and location data to
                third-party data providers including NOAA (National Oceanic and
                Atmospheric Administration), the National Weather Service,
                OpenWeather, and NDBC buoy networks. These requests include
                geographic coordinates but do not include your personal
                information.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                3.2 Service Providers
              </h3>
              <p className="text-muted-foreground">
                We use trusted service providers to operate the platform,
                including Supabase (database and authentication), Stripe
                (payment processing), Sentry (error tracking), Upstash
                (caching), and Resend (transactional email). These providers
                access only the data necessary to perform their services and are
                bound by their own privacy policies.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                3.3 No Sale of Personal Data
              </h3>
              <p className="text-muted-foreground">
                <strong>
                  We do not sell, rent, or trade your personal information to
                  third parties.
                </strong>{" "}
                We do not share your vessel data, passage plans, or personal
                information with advertisers, data brokers, or any other
                commercial entities.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">
                3.4 Legal Requirements
              </h3>
              <p className="text-muted-foreground">
                We may disclose your information if required to do so by law, in
                response to valid legal process, to protect our rights or
                property, or in the event of an emergency involving potential
                threats to personal safety.
              </p>
            </section>

            {/* 4. Data Retention */}
            <section>
              <h2 className="font-display text-2xl mb-4">4. Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                We retain personal data only as long as necessary to provide the
                Service or to meet legal, regulatory, and safety obligations.
                The table below summarizes the retention window for each
                category of data.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-border rounded-md">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-semibold">
                        Data category
                      </th>
                      <th className="text-left p-3 font-semibold">
                        Retention window
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-t border-border">
                      <td className="p-3">
                        Account, vessel profiles, passages, checklists
                      </td>
                      <td className="p-3">
                        For the life of your account. Deleted immediately when
                        you delete your account via{" "}
                        <Link
                          href="/account/privacy"
                          className="text-primary hover:underline"
                        >
                          /account/privacy
                        </Link>
                        .
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="p-3">
                        Safety audit logs (navigation decisions, hazard
                        warnings, overrides)
                      </td>
                      <td className="p-3">
                        7 years after creation, retained in anonymized form
                        following account deletion, for maritime safety and
                        regulatory review.
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="p-3">Subscription and billing records</td>
                      <td className="p-3">
                        7 years after the last transaction, to meet tax and
                        accounting retention requirements.
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="p-3">
                        Analytics and usage events (page views, feature usage)
                      </td>
                      <td className="p-3">
                        25 months in identifiable form; anonymized thereafter
                        (your user ID is removed, the event record may persist
                        for aggregate analysis).
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="p-3">
                        Server logs (IP, request path, status code)
                      </td>
                      <td className="p-3">
                        30 days for operational debugging and abuse detection.
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="p-3">Backups</td>
                      <td className="p-3">
                        Rolling 35 days. Data you have deleted may persist in
                        backups until the rolling window rotates; it will not be
                        restored into production except during disaster
                        recovery.
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="p-3">Inactive accounts</td>
                      <td className="p-3">
                        After 3 years with no sign-in, we will email you a
                        notice and delete your account if we receive no response
                        within 30 days.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-muted-foreground mt-4">
                <strong>Immediate deletion:</strong> When you delete your
                account, your personal data, vessel profiles, passages, and
                checklists are removed synchronously from our production
                database. Safety audit logs are retained as described above but
                are anonymized (your user ID is severed). A compliance log of
                the deletion request itself is kept for regulatory purposes and
                contains no personally identifying information after the
                deletion completes.
              </p>
            </section>

            {/* 5. Your Rights */}
            <section>
              <h2 className="font-display text-2xl mb-4">5. Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                You have the following rights regarding your personal data:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Access:</strong> You can request a copy of all
                  personal data we hold about you.
                </li>
                <li>
                  <strong>Correction:</strong> You can update or correct
                  inaccurate information through your account settings or by
                  contacting us.
                </li>
                <li>
                  <strong>Deletion:</strong> You can delete your account and
                  associated personal data immediately via{" "}
                  <Link
                    href="/account/privacy"
                    className="text-primary hover:underline"
                  >
                    /account/privacy
                  </Link>
                  . The deletion runs synchronously; see §4 for the categories
                  that are removed versus retained in anonymized form.
                </li>
                <li>
                  <strong>Export:</strong> You can download a JSON bundle of all
                  your personal data — account record, vessel profiles,
                  passages, checklists, usage, and safety audit logs — at{" "}
                  <Link
                    href="/account/privacy"
                    className="text-primary hover:underline"
                  >
                    /account/privacy
                  </Link>
                  . Passage plans can also be exported in GPX and PDF formats
                  from the planner.
                </li>
                <li>
                  <strong>Restriction:</strong> You can request that we restrict
                  the processing of your data in certain circumstances.
                </li>
                <li>
                  <strong>Objection:</strong> You can object to the processing
                  of your data for specific purposes, including direct
                  marketing.
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Signed-in users can download or delete their data directly at{" "}
                <Link
                  href="/account/privacy"
                  className="text-primary hover:underline"
                >
                  /account/privacy
                </Link>
                . For any other request, contact us at{" "}
                <a
                  href="mailto:privacy@helmwise.co"
                  className="text-primary hover:underline"
                >
                  privacy@helmwise.co
                </a>
                .
              </p>
            </section>

            {/* 6. GDPR Compliance */}
            <section>
              <h2 className="font-display text-2xl mb-4">6. GDPR Compliance</h2>
              <p className="text-muted-foreground">
                If you are located in the European Union or the European
                Economic Area, you have additional rights under the General Data
                Protection Regulation (GDPR):
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>
                  <strong>Legal Basis:</strong> We process your data based on
                  your consent (account creation), contractual necessity
                  (providing the Service), and legitimate interests (service
                  improvement and safety).
                </li>
                <li>
                  <strong>Data Portability:</strong> You have the right to
                  receive your personal data in a structured, commonly used, and
                  machine-readable format.
                </li>
                <li>
                  <strong>Right to be Forgotten:</strong> You can request
                  complete erasure of your personal data, subject to legal
                  obligations we may have to retain certain records.
                </li>
                <li>
                  <strong>Supervisory Authority:</strong> You have the right to
                  lodge a complaint with your local data protection supervisory
                  authority.
                </li>
                <li>
                  <strong>Data Transfers:</strong> Your data may be transferred
                  to and processed in the United States. We ensure appropriate
                  safeguards are in place for such transfers.
                </li>
              </ul>
            </section>

            {/* 7. Data Security */}
            <section>
              <h2 className="font-display text-2xl mb-4">7. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures to protect your
                data, including encryption in transit (TLS/SSL), encryption at
                rest, row-level security policies on our database, secure
                authentication through Supabase Auth, and regular security
                reviews. However, no method of electronic storage or
                transmission is 100% secure, and we cannot guarantee absolute
                security.
              </p>
            </section>

            {/* 8. Children's Privacy */}
            <section>
              <h2 className="font-display text-2xl mb-4">
                8. Children&apos;s Privacy
              </h2>
              <p className="text-muted-foreground">
                The Service is not intended for children under the age of 16. We
                do not knowingly collect personal data from children. If you
                believe a child has provided us with personal data, please
                contact us and we will promptly delete it.
              </p>
            </section>

            {/* 9. Changes to This Policy */}
            <section>
              <h2 className="font-display text-2xl mb-4">
                9. Changes to This Policy
              </h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will
                notify you of any material changes by posting the updated policy
                on this page and updating the &ldquo;Last updated&rdquo; date.
                For significant changes, we may also send a notification to the
                email address associated with your account. Your continued use
                of the Service after changes constitutes acceptance of the
                updated policy.
              </p>
            </section>

            {/* 10. Contact */}
            <section>
              <h2 className="font-display text-2xl mb-4">10. Contact</h2>
              <p className="text-muted-foreground">
                For questions, concerns, or requests regarding this Privacy
                Policy or your personal data, contact us at:
              </p>
              <p className="text-muted-foreground mt-4">
                <a
                  href="mailto:privacy@helmwise.co"
                  className="text-primary hover:underline"
                >
                  privacy@helmwise.co
                </a>
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
              <Link
                href="/terms"
                className="hover:text-primary transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/cookies"
                className="hover:text-primary transition-colors"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
