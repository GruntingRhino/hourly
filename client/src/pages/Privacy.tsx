import { Link } from "react-router-dom";

const EFFECTIVE_DATE = "April 20, 2026";
const CONTACT_EMAIL = "privacy@goodhours.app";
const SUPPORT_EMAIL = "help@goodhours.app";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

export default function Privacy() {
  const sections: Section[] = [
    {
      id: "introduction",
      title: "1. Introduction",
      content: (
        <>
          <p>
            GoodHours ("we," "us," or "our") operates a community service coordination,
            tracking, and verification platform for students, schools, and partner organizations
            ("Beneficiaries"). This Privacy Policy explains how we collect, use, disclose, and
            safeguard personal information when you use the GoodHours platform at{" "}
            <span className="font-medium">goodhours.app</span> and any associated applications
            or services (collectively, the "Service").
          </p>
          <p className="mt-3">
            GoodHours is designed primarily for educational use. Because we serve students —
            including minors — we take privacy seriously and structure our data practices
            accordingly. This Policy is intended to comply with the Family Educational Rights
            and Privacy Act (<strong>FERPA</strong>), the Children's Online Privacy Protection
            Act (<strong>COPPA</strong>), and applicable state privacy laws.
          </p>
          <p className="mt-3">
            Please read this Policy carefully. By using the Service, you acknowledge that you
            have read and understood this Policy.
          </p>
        </>
      ),
    },
    {
      id: "who-we-are",
      title: "2. Who This Policy Applies To",
      content: (
        <>
          <p>This Policy applies to all users of the Service, including:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>
              <strong>School Administrators and Teachers</strong> — staff at educational
              institutions who manage cohorts, verify hours, and access student records.
            </li>
            <li>
              <strong>Students</strong> — individuals enrolled by their school to track and
              verify community service hours. Students join only through school-issued invitations.
            </li>
            <li>
              <strong>Beneficiary Administrators</strong> — staff at partner organizations who
              publish volunteer opportunities and verify student attendance.
            </li>
            <li>
              <strong>Parents and Guardians</strong> — individuals who access a limited
              read-only progress view shared by their child's school account.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "data-collected",
      title: "3. Information We Collect",
      content: (
        <>
          <p className="font-medium text-[var(--text)]">3.1 Information You Provide</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[13px] border border-[var(--border)] rounded-[3px] overflow-hidden">
              <thead>
                <tr className="bg-[var(--surface-alt)] text-left">
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)] w-1/3">Category</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Examples</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)] w-1/4">Who Provides It</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Identity data</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Full name, email address, school or organization affiliation</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">All users</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Authentication data</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Hashed password or Google OAuth identifier</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">All users</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Profile data</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Phone number (encrypted), grade level, house/cohort affiliation, optional bio, optional age (10–25)</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Students, school staff</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Service activity data</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Check-in/check-out timestamps, hours logged, service categories, opportunity signups, cancellations</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Students</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Self-submitted content</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Organization name, date, description of service, supporting notes submitted for review</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Students</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Verification data</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Drawn or uploaded signatures (PNG/PDF, max 5 MB), verifier names and timestamps</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Students, organizations</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Messages</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">In-platform messages between students, school staff, and organizations</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">All users</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Organization data</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Organization name, mission, contact details, opportunity listings, time slots</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Beneficiary admins</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-medium text-[var(--text)] mt-5">3.2 Information Collected Automatically</p>
          <p className="mt-2">
            When you use the Service, we automatically collect limited technical information
            including:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>IP address (used for rate-limiting and security purposes, not stored long-term)</li>
            <li>Browser type and operating system (via standard HTTP headers)</li>
            <li>Timestamps of login, logout, and key actions within the Platform</li>
            <li>Last login date and account status changes</li>
          </ul>
          <p className="mt-3">
            We do not use third-party analytics services (e.g., Google Analytics), advertising
            tracking pixels, or behavioral profiling technologies.
          </p>

          <p className="font-medium text-[var(--text)] mt-5">3.3 Information from Third Parties</p>
          <p className="mt-2">
            If you register or sign in using <strong>Google OAuth</strong>, we receive your name
            and email address from Google as confirmed by you during the OAuth flow. We do not
            receive your Google password or access to your Google account beyond what you
            explicitly authorize.
          </p>
        </>
      ),
    },
    {
      id: "how-we-use",
      title: "4. How We Use Your Information",
      content: (
        <>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
            <li>
              <strong>Provide and operate the Service</strong> — create and maintain your account,
              match students to opportunities, process check-in/check-out records, and route
              verification requests.
            </li>
            <li>
              <strong>Verify and record service hours</strong> — maintain an immutable audit trail
              of all verification actions to support compliance and reporting.
            </li>
            <li>
              <strong>Generate reports and transcripts</strong> — produce student progress reports
              for schools, CSV exports for official filings, and parent progress views.
            </li>
            <li>
              <strong>Send transactional communications</strong> — deliver email verification
              tokens, password reset links, hour-approval notifications, and invitation emails
              via Resend. We do not send promotional or marketing emails.
            </li>
            <li>
              <strong>Enforce security and prevent abuse</strong> — rate-limit requests, detect
              fraudulent submissions, and investigate suspected violations of our Terms of Service.
            </li>
            <li>
              <strong>Improve the Service</strong> — analyze aggregated, de-identified usage
              patterns to improve platform reliability, performance, and features. Individual
              student records are never used for product analytics.
            </li>
            <li>
              <strong>Comply with legal obligations</strong> — respond to lawful requests from
              courts, regulators, and law enforcement as required by applicable law.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "how-we-share",
      title: "5. How We Share Your Information",
      content: (
        <>
          <p>
            We do not sell, rent, or trade your personal information to any third party. We share
            information only as described below.
          </p>

          <p className="font-medium text-[var(--text)] mt-4">5.1 Within the Platform (Role-Based Access)</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[13px] border border-[var(--border)] rounded-[3px] overflow-hidden">
              <thead>
                <tr className="bg-[var(--surface-alt)] text-left">
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Your Role</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Who Can See Your Data</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">What They See</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Student</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Your school's administrators and teachers; partner organizations whose opportunities you've attended</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">
                    School staff: your name, hours, status, cohort<br />
                    Organizations: anonymized label ("Volunteer [ID]") by default; your name only after explicit school approval
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">School admin / teacher</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Other administrators and teachers at the same school</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Account profile; no cross-school access</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top">Beneficiary admin</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Schools that have approved their organization</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Organization name, mission, contact; attendance records for their own events</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-medium text-[var(--text)] mt-5">5.2 Parent Progress Sharing</p>
          <p className="mt-2">
            School administrators may generate a time-limited, read-only parent progress link for
            a student. This link discloses only the student's hours completed, service goal, and
            deadline status. No other personal data is shared through this link.
          </p>

          <p className="font-medium text-[var(--text)] mt-5">5.3 Service Providers</p>
          <p className="mt-2">
            We engage the following sub-processors who handle personal data solely on our
            instruction:
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[13px] border border-[var(--border)] rounded-[3px] overflow-hidden">
              <thead>
                <tr className="bg-[var(--surface-alt)] text-left">
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Provider</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Purpose</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Data Shared</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top font-medium">Neon (database)</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Serverless PostgreSQL database hosting</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">All stored platform data (encrypted at rest and in transit)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top font-medium">Resend</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Transactional email delivery</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Recipient email address and first name (for email personalization)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top font-medium">Google OAuth</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Optional single sign-on authentication</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Name and email (only if you choose Google sign-in)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)] align-top font-medium">Vercel</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Application hosting and serverless compute</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)] align-top">Request logs (IP, path, timestamp) — standard access logs, short retention</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-medium text-[var(--text)] mt-5">5.4 Legal and Safety Disclosures</p>
          <p className="mt-2">
            We may disclose personal information if we believe disclosure is required by law,
            court order, or government regulation; necessary to protect the safety of any person;
            or necessary to investigate fraud or a violation of our Terms.
          </p>

          <p className="font-medium text-[var(--text)] mt-5">5.5 Business Transfers</p>
          <p className="mt-2">
            If GoodHours is involved in a merger, acquisition, or sale of assets, user data may
            be transferred as part of that transaction. We will notify affected users before
            personal data is transferred and becomes subject to a different privacy policy.
          </p>
        </>
      ),
    },
    {
      id: "ferpa",
      title: "6. FERPA — Student Education Records",
      content: (
        <>
          <p>
            To the extent GoodHours is used by a school subject to the Family Educational Rights
            and Privacy Act (FERPA), 20 U.S.C. § 1232g, we act as a "school official" with a
            legitimate educational interest in accordance with 34 C.F.R. § 99.31(a)(1). GoodHours:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
            <li>
              Uses student education records only to perform the service requested by the school
              (tracking and verifying community service hours).
            </li>
            <li>
              Does not re-disclose education records to third parties without the school's
              direction or as required by law.
            </li>
            <li>
              Maintains a <strong>Data Access Log</strong> — an auditable record of each time a
              school staff member views, exports, or deletes student data — to support schools'
              FERPA compliance obligations.
            </li>
            <li>
              Returns or destroys student education records upon the school's request or upon
              termination of the school's account, subject to legal retention requirements.
            </li>
          </ul>
          <p className="mt-3">
            Schools are responsible for honoring student and parent rights under FERPA, including
            the rights to inspect, review, and request amendment of education records. Contact
            your school administrator for FERPA-related requests regarding your student's records
            on GoodHours.
          </p>
        </>
      ),
    },
    {
      id: "coppa",
      title: "7. Children's Privacy (COPPA)",
      content: (
        <>
          <p>
            The Service is designed for use in educational settings and may be used by students as
            young as 10 years old. GoodHours does not knowingly solicit or collect personal
            information directly from children under 13 without verifiable parental consent.
          </p>
          <p className="mt-3">
            Students under 13 may only use the Service <strong>through their school</strong>.
            By enrolling students under 13 on GoodHours, a school administrator represents that
            the school has obtained all necessary parental or guardian consents as required by
            COPPA (15 U.S.C. §§ 6501–6506) and applicable state law.
          </p>
          <p className="mt-3">
            We collect the minimum information necessary from student accounts. Specifically:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>We do not ask students to provide social media handles or public profiles.</li>
            <li>Student names are anonymized ("Volunteer [ID]") when shown to partner organizations by default.</li>
            <li>We do not display student data publicly.</li>
            <li>We do not serve advertising to any users, including children.</li>
          </ul>
          <p className="mt-3">
            Parents or guardians who believe their child's information was collected without proper
            consent may contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
              {CONTACT_EMAIL}
            </a>
            . We will promptly review and, if confirmed, delete the information.
          </p>
        </>
      ),
    },
    {
      id: "data-security",
      title: "8. Data Security",
      content: (
        <>
          <p>
            We implement technical and organizational measures appropriate to the sensitivity of
            the data we process:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
            <li>
              <strong>Encryption at rest:</strong> Phone numbers are encrypted using AES-256-GCM
              with unique initialization vectors. The database itself is hosted on Neon with
              encryption at rest enabled.
            </li>
            <li>
              <strong>Encryption in transit:</strong> All data is transmitted over TLS 1.2 or
              higher. Database connections require TLS (sslmode=require).
            </li>
            <li>
              <strong>Authentication security:</strong> Passwords are hashed using bcrypt with
              a work factor appropriate for current hardware. We support Google OAuth as a
              password-free alternative.
            </li>
            <li>
              <strong>Rate limiting:</strong> Login attempts are limited to 10 per 15 minutes
              per IP. Signup, password reset, and email verification endpoints have independent
              rate limits to prevent brute-force attacks.
            </li>
            <li>
              <strong>Role-based access control:</strong> All API endpoints enforce server-side
              role checks. School data is strictly scoped — no cross-school access is possible.
            </li>
            <li>
              <strong>Immutable audit logs:</strong> All verification actions and data-access
              events are logged with actor, timestamp, and details and cannot be deleted through
              normal platform workflows.
            </li>
          </ul>
          <p className="mt-3">
            No security measure is perfect. If you discover a potential security vulnerability,
            please report it responsibly to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "9. Data Retention",
      content: (
        <>
          <p>
            We retain personal information for as long as your account is active or as needed to
            provide the Service. The following specific retention practices apply:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px] border border-[var(--border)] rounded-[3px] overflow-hidden">
              <thead>
                <tr className="bg-[var(--surface-alt)] text-left">
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Data Type</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]">Retention Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)]">Account profile data</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)]">Until account deletion is requested</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)]">Service-hour records</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)]">Until account deletion; schools should export records before deleting</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)]">Email verification tokens</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)]">24 hours from issuance</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)]">Password reset tokens</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)]">1 hour from issuance</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)]">Student invitation tokens</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)]">72 hours from issuance</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)]">Audit log entries</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)]">Retained for compliance purposes even after account deletion; personally identifiable actor information is subject to review upon request</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-[var(--text)]">Uploaded signature files</td>
                  <td className="px-3 py-2.5 text-[var(--text-sec)]">Retained with the associated verification record; deleted upon account deletion</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            When you delete your account, we perform a cascading deletion of your profile,
            messages, signups, sessions, and associated personal data. Certain anonymized
            records may be retained for legal compliance or aggregate statistical purposes.
          </p>
        </>
      ),
    },
    {
      id: "your-rights",
      title: "10. Your Rights and Choices",
      content: (
        <>
          <p>Depending on your location and role, you may have the following rights:</p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
            <li>
              <strong>Access.</strong> You may view most of your personal data within your
              account settings. Students may access their full hour history via the dashboard.
              School admins can export student records as CSV.
            </li>
            <li>
              <strong>Correction.</strong> You may update your name, email, and profile
              information in account settings. Contact{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
                {SUPPORT_EMAIL}
              </a>{" "}
              if you need help correcting data you cannot edit directly.
            </li>
            <li>
              <strong>Deletion.</strong> You may delete your account at any time in Settings.
              Students under school accounts should contact their school administrator who can
              remove student records. Contact us if you need assistance.
            </li>
            <li>
              <strong>Data portability.</strong> Students may download a summary of their
              verified hours from their dashboard. School admins may export full student records
              via CSV export.
            </li>
            <li>
              <strong>Notification preferences.</strong> You may adjust in-app notification
              preferences in your account settings. You cannot opt out of essential transactional
              emails (e.g., email verification, password reset) while your account is active.
            </li>
            <li>
              <strong>Withdraw Google OAuth.</strong> If you connected your Google account, you
              may revoke this connection from your Google account settings at any time.
            </li>
          </ul>
          <p className="mt-3">
            <strong>FERPA requests.</strong> Students and parents with rights under FERPA should
            direct requests to inspect, amend, or restrict school records to their school
            administrator. GoodHours will cooperate with schools in honoring such requests.
          </p>
          <p className="mt-3">
            <strong>California residents</strong> may have additional rights under the California
            Consumer Privacy Act (CCPA/CPRA). GoodHours does not sell personal information.
            For California rights inquiries, contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "11. Cookies and Tracking Technologies",
      content: (
        <>
          <p>
            GoodHours uses <strong>localStorage</strong> (not cookies) to store your
            authentication token on your device after login. This token:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>Is scoped to the GoodHours origin and not accessible to other websites.</li>
            <li>Contains a signed JWT with your user ID, role, and an expiration timestamp.</li>
            <li>Is cleared when you log out or delete your account.</li>
          </ul>
          <p className="mt-3">
            We do not use third-party tracking cookies, advertising cookies, or behavioral
            analytics. We do not fingerprint your device. We do not participate in cross-site
            tracking.
          </p>
        </>
      ),
    },
    {
      id: "international",
      title: "12. International Users",
      content: (
        <p>
          GoodHours is operated from the United States. If you are located outside the United
          States, your personal information will be transferred to and processed in the United
          States. By using the Service, you consent to this transfer. We apply the same data
          protection standards described in this Policy regardless of where data is processed.
        </p>
      ),
    },
    {
      id: "changes",
      title: "13. Changes to This Privacy Policy",
      content: (
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we
          will update the effective date at the top of this page and send an email notice to
          registered users. For changes affecting student data, we will provide at least 30 days'
          advance notice before the change takes effect. We encourage you to review this Policy
          periodically. Your continued use of the Service after the effective date of a revised
          Policy constitutes your acceptance of the changes.
        </p>
      ),
    },
    {
      id: "contact",
      title: "14. Contact Us",
      content: (
        <>
          <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact:</p>
          <div className="mt-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] px-4 py-3 text-[13px]">
            <p className="font-semibold text-[var(--text)]">GoodHours — Privacy</p>
            <p className="text-[var(--text-sec)] mt-1">
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="text-[var(--text-sec)]">
              Support:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <p className="mt-3">
            We aim to respond to all privacy inquiries within 10 business days.
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--surface-alt)]">
      {/* Nav */}
      <div className="bg-white border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo-full.png"
            alt="GoodHours"
            className="h-7 w-auto"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block";
            }}
          />
          <span className="hidden font-bold text-[var(--action)] text-lg">GoodHours</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/terms" className="text-sm text-[var(--text-sec)] hover:text-[var(--text)]">
            Terms of Service
          </Link>
          <Link
            to="/login"
            className="text-sm text-[var(--action)] hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-[30px] font-bold text-[var(--text)] mb-2">Privacy Policy</h1>
          <p className="text-[13.5px] text-[var(--text-sec)]">Effective date: {EFFECTIVE_DATE}</p>
          <p className="text-[14px] text-[var(--text-sec)] mt-4 leading-relaxed">
            GoodHours is built for educational use. This Privacy Policy describes how we
            collect, use, and protect personal information — including student data — when you
            use our platform. We do not sell personal information and never will.
          </p>

          {/* Quick-summary callout */}
          <div className="mt-5 bg-[var(--in-bg)] border border-[var(--in-b)] rounded-[3px] px-5 py-4">
            <p className="text-[12px] font-semibold text-[var(--action)] uppercase tracking-wide mb-2">
              At a Glance
            </p>
            <ul className="text-[13px] text-[var(--navy)] space-y-1">
              <li>✓ We never sell personal data to advertisers or data brokers.</li>
              <li>✓ Student data is only visible to their school and approved partner organizations.</li>
              <li>✓ Student names are anonymized to partner organizations by default.</li>
              <li>✓ We comply with FERPA and COPPA.</li>
              <li>✓ You can delete your account and data at any time.</li>
            </ul>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-white border border-[var(--border)] rounded-[3px] p-5 mb-8">
          <p className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">
            Table of Contents
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-[13px] text-[var(--action)] hover:underline py-0.5"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((s) => (
            <div
              key={s.id}
              id={s.id}
              className="bg-white border border-[var(--border)] rounded-[3px] px-6 py-5 scroll-mt-6"
            >
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-3">{s.title}</h2>
              <div className="text-[13.5px] text-[var(--text-sec)] leading-relaxed">{s.content}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 bg-white border border-[var(--border)] rounded-[3px] p-6 text-center">
          <div className="text-[14px] font-semibold text-[var(--text)] mb-1">
            Privacy questions or concerns?
          </div>
          <p className="text-[13px] text-[var(--text-sec)] mb-3">
            We respond to all privacy inquiries within 10 business days.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-block px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 transition-opacity"
          >
            Email {CONTACT_EMAIL}
          </a>
          <div className="mt-5 pt-5 border-t border-[var(--border)] flex justify-center gap-5 text-[12.5px] text-[var(--text-faint)]">
            <Link to="/terms" className="hover:text-[var(--text-sec)]">Terms of Service</Link>
            <Link to="/faq" className="hover:text-[var(--text-sec)]">FAQ</Link>
            <Link to="/" className="hover:text-[var(--text-sec)]">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
