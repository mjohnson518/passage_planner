import Link from "next/link";

export function DataRetentionSection() {
  return (
    <section>
      <h2 className="font-display text-2xl mb-4">4. Data Retention</h2>
      <p className="text-muted-foreground mb-4">
        We retain personal data only as long as necessary to provide the Service
        or to meet legal, regulatory, and safety obligations. The table below
        summarizes the retention window for each category of data.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-md">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-semibold">Data category</th>
              <th className="text-left p-3 font-semibold">Retention window</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-t border-border">
              <td className="p-3">
                Account, vessel profiles, passages, checklists
              </td>
              <td className="p-3">
                For the life of your account. Deleted immediately when you
                delete your account via{" "}
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
                Safety audit logs (navigation decisions, hazard warnings,
                overrides)
              </td>
              <td className="p-3">
                7 years after creation, retained in anonymized form following
                account deletion, for maritime safety and regulatory review.
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3">Subscription and billing records</td>
              <td className="p-3">
                7 years after the last transaction, to meet tax and accounting
                retention requirements.
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3">
                Analytics and usage events (page views, feature usage)
              </td>
              <td className="p-3">
                25 months in identifiable form; anonymized thereafter (your user
                ID is removed, the event record may persist for aggregate
                analysis).
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
                Rolling 35 days. Data you have deleted may persist in backups
                until the rolling window rotates; it will not be restored into
                production except during disaster recovery.
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3">Inactive accounts</td>
              <td className="p-3">
                After 3 years with no sign-in, we will email you a notice and
                delete your account if we receive no response within 30 days.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground mt-4">
        <strong>Immediate deletion:</strong> When you delete your account, your
        personal data, vessel profiles, passages, and checklists are removed
        synchronously from our production database. Safety audit logs are
        retained as described above but are anonymized (your user ID is
        severed). A compliance log of the deletion request itself is kept for
        regulatory purposes and contains no personally identifying information
        after the deletion completes.
      </p>
    </section>
  );
}
