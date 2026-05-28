import Link from "next/link";

export function YourRightsSection() {
  return (
    <section>
      <h2 className="font-display text-2xl mb-4">5. Your Rights</h2>
      <p className="text-muted-foreground mb-4">
        You have the following rights regarding your personal data:
      </p>
      <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
        <li>
          <strong>Access:</strong> You can request a copy of all personal data
          we hold about you.
        </li>
        <li>
          <strong>Correction:</strong> You can update or correct inaccurate
          information through your account settings or by contacting us.
        </li>
        <li>
          <strong>Deletion:</strong> You can delete your account and associated
          personal data immediately via{" "}
          <Link
            href="/account/privacy"
            className="text-primary hover:underline"
          >
            /account/privacy
          </Link>
          . The deletion runs synchronously; see §4 for the categories that are
          removed versus retained in anonymized form.
        </li>
        <li>
          <strong>Export:</strong> You can download a JSON bundle of all your
          personal data (account record, vessel profiles, passages, checklists,
          usage, and safety audit logs) at{" "}
          <Link
            href="/account/privacy"
            className="text-primary hover:underline"
          >
            /account/privacy
          </Link>
          . Passage plans can also be exported in GPX and PDF formats from the
          planner.
        </li>
        <li>
          <strong>Restriction:</strong> You can request that we restrict the
          processing of your data in certain circumstances.
        </li>
        <li>
          <strong>Objection:</strong> You can object to the processing of your
          data for specific purposes, including direct marketing.
        </li>
      </ul>
      <p className="text-muted-foreground mt-4">
        Signed-in users can download or delete their data directly at{" "}
        <Link href="/account/privacy" className="text-primary hover:underline">
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
  );
}
