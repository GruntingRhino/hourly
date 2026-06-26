import { Link } from "react-router-dom";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const EFFECTIVE_DATE = "April 20, 2026";
const CONTACT_EMAIL = "legal@goodhours.app";
const SUPPORT_EMAIL = "help@goodhours.app";

export default function Terms() {
  const sections: Section[] = [
    {
      id: "acceptance",
      title: "1. Acceptance of Terms",
      content: (
        <>
          <p>
            By accessing or using GoodHours ("Service," "Platform," or "we/us/our"), you agree to
            be bound by these Terms of Service ("Terms"). If you are using GoodHours on behalf of a
            school or organization, you represent that you have the authority to bind that entity to
            these Terms.
          </p>
          <p className="mt-3">
            If you do not agree to these Terms, do not access or use the Service. Your continued
            use following any modification to these Terms constitutes acceptance of the revised
            Terms.
          </p>
          <p className="mt-3">
            <strong>For users under 18:</strong> You must have your parent or legal guardian's
            permission to use this Service. If you are a school administrator granting students
            access, you represent that your institution has obtained any required consents and that
            use of GoodHours complies with applicable law, including FERPA and COPPA.
          </p>
        </>
      ),
    },
    {
      id: "description",
      title: "2. Description of Service",
      content: (
        <>
          <p>
            GoodHours is a community service coordination, tracking, and verification platform that
            connects students, schools, and service organizations ("Beneficiaries"). The Service
            allows:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>
              <strong>Schools</strong> to manage student service-hour requirements, create cohorts,
              approve partner organizations, review submitted hours, and generate compliance reports.
            </li>
            <li>
              <strong>Students</strong> to discover volunteer opportunities, sign up for time slots,
              log check-in and check-out times, submit self-directed service hours, and track
              progress toward graduation or program requirements.
            </li>
            <li>
              <strong>Beneficiary Organizations</strong> to publish volunteer opportunities, manage
              time slots, record attendance, and verify student service hours.
            </li>
          </ul>
          <p className="mt-3">
            GoodHours is a record-keeping and coordination tool. We do not employ or place
            volunteers, and we are not responsible for the conduct of any volunteer activity that
            takes place outside our Platform.
          </p>
        </>
      ),
    },
    {
      id: "eligibility",
      title: "3. Eligibility and Account Registration",
      content: (
        <>
          <p>
            To use GoodHours you must be at least 10 years of age. Users under 13 may only access
            the Service through a school that has agreed to these Terms on their behalf and, where
            required by applicable law, obtained verifiable parental consent.
          </p>
          <p className="mt-3">
            <strong>Registration.</strong> Students join exclusively through a school-issued
            invitation. Beneficiary organizations join through a school-approved invitation.
            School administrators register directly and are responsible for all activity within
            their school's account.
          </p>
          <p className="mt-3">You agree to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>Provide accurate, current, and complete information during registration.</li>
            <li>Maintain the security of your password and promptly notify us of any breach.</li>
            <li>Accept responsibility for all activities that occur under your account.</li>
            <li>Not share your credentials with any other person.</li>
          </ul>
          <p className="mt-3">
            We reserve the right to refuse registration, suspend, or terminate any account at our
            discretion, including where we believe information provided is false or where use
            violates these Terms.
          </p>
        </>
      ),
    },
    {
      id: "roles",
      title: "4. User Roles and Responsibilities",
      content: (
        <>
          <p className="font-medium text-[var(--text)]">4.1 School Administrators and Teachers</p>
          <p className="mt-1.5">
            School administrators are the primary account holders for their institution. By
            registering, school administrators agree to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>
              Use the Platform in compliance with FERPA and all other applicable student privacy
              laws.
            </li>
            <li>
              Obtain any necessary parental or guardian consent before enrolling students under 13.
            </li>
            <li>
              Ensure that teachers and staff who access student data are authorized to do so under
              applicable law.
            </li>
            <li>
              Accurately represent their institutional identity and maintain a valid school domain
              email address.
            </li>
            <li>
              Not use aggregate or individual student data for any purpose inconsistent with the
              educational purpose of the Service.
            </li>
          </ul>

          <p className="font-medium text-[var(--text)] mt-4">4.2 Students</p>
          <p className="mt-1.5">Students agree to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>Submit only truthful and accurate records of service hours.</li>
            <li>
              Not submit hours for service that was not actually performed or that does not meet
              their school's requirements.
            </li>
            <li>Not manipulate, falsify, or tamper with check-in/check-out timestamps.</li>
            <li>
              Obtain required approvals before claiming hours are verified; approval is not
              automatic.
            </li>
          </ul>
          <p className="mt-3">
            <strong>Fraudulent submissions</strong> — including fabricated hours, false
            organizational affiliations, or forged signatures — are a serious violation of these
            Terms and may result in immediate account suspension and notification to the student's
            school.
          </p>

          <p className="font-medium text-[var(--text)] mt-4">4.3 Beneficiary Organizations</p>
          <p className="mt-1.5">Beneficiary organizations agree to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
            <li>
              Accurately represent their organization, including its name, mission, and contact
              information.
            </li>
            <li>
              Only approve hours for service that was genuinely performed and meets published
              opportunity requirements.
            </li>
            <li>
              Comply with all applicable laws governing the supervision of minor volunteers,
              including background-check requirements.
            </li>
            <li>
              Promptly notify GoodHours if they become aware of any misuse of the Platform in
              connection with their organization.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "5. Acceptable Use",
      content: (
        <>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5">
            <li>
              Violate any applicable local, state, national, or international law or regulation.
            </li>
            <li>
              Transmit any content that is unlawful, defamatory, harassing, abusive, threatening,
              obscene, or otherwise objectionable.
            </li>
            <li>
              Impersonate any person, organization, or entity, or misrepresent your affiliation
              with them.
            </li>
            <li>
              Introduce malware, viruses, or any code designed to disrupt, damage, or gain
              unauthorized access to any system.
            </li>
            <li>
              Scrape, crawl, or systematically extract data from the Platform without our express
              written permission.
            </li>
            <li>
              Attempt to circumvent any security feature, access controls, rate limits, or
              authentication mechanism.
            </li>
            <li>
              Use student or personal data obtained through the Platform for commercial purposes,
              advertising, or any purpose outside the educational mission.
            </li>
            <li>
              Create fake accounts, bulk-register users, or otherwise abuse the invitation system.
            </li>
          </ul>
          <p className="mt-3">
            GoodHours reserves the right to investigate suspected violations and to cooperate with
            law enforcement authorities.
          </p>
        </>
      ),
    },
    {
      id: "verification",
      title: "6. Service-Hour Verification and Records",
      content: (
        <>
          <p>
            GoodHours maintains an immutable audit trail of all verification actions. Once a
            service-hour record is verified, it cannot be retroactively altered by the student.
            Schools and authorized administrators may make corrections through the Platform's
            override process, which is itself logged.
          </p>
          <p className="mt-3">
            <strong>Signatures.</strong> Students may be required to submit a drawn or uploaded
            signature as part of the verification process. By submitting a signature, you represent
            that (a) the signature is your own or you are authorized to submit it, and (b) the
            information accompanying the signature is accurate.
          </p>
          <p className="mt-3">
            <strong>Records as Official Documentation.</strong> Schools may use GoodHours records
            as official documentation of community service hours. GoodHours makes no warranty that
            hours recorded on the Platform will be accepted by any particular institution, program,
            or authority. Final acceptance of hours is at the sole discretion of the reviewing
            institution.
          </p>
          <p className="mt-3">
            <strong>Data Export.</strong> Students may request a record of their verified hours at
            any time through the Platform. School administrators may export student data in CSV
            format for official reporting purposes.
          </p>
        </>
      ),
    },
    {
      id: "intellectual-property",
      title: "7. Intellectual Property",
      content: (
        <>
          <p>
            <strong>Our Property.</strong> The GoodHours name, logo, software, design, and content
            are owned by or licensed to GoodHours and are protected by copyright, trademark, and
            other intellectual property laws. You may not copy, modify, distribute, or create
            derivative works without our express written permission.
          </p>
          <p className="mt-3">
            <strong>Your Content.</strong> You retain ownership of any content you submit to the
            Platform (such as descriptions, notes, or uploaded files). By submitting content, you
            grant GoodHours a limited, non-exclusive, royalty-free license to store, process, and
            display that content solely as necessary to provide the Service. We do not claim
            ownership of student data.
          </p>
          <p className="mt-3">
            <strong>Feedback.</strong> If you provide feedback or suggestions about the Service,
            you grant us the right to use that feedback without restriction or compensation.
          </p>
        </>
      ),
    },
    {
      id: "privacy",
      title: "8. Privacy",
      content: (
        <p>
          Your use of the Service is also governed by our{" "}
          <Link to="/privacy" className="text-[var(--action)] underline hover:opacity-80">
            Privacy Policy
          </Link>
          , which is incorporated into these Terms by reference. The Privacy Policy describes how
          we collect, use, and protect personal information, including student data subject to
          FERPA. Please read it carefully.
        </p>
      ),
    },
    {
      id: "third-party",
      title: "9. Third-Party Services",
      content: (
        <>
          <p>
            GoodHours uses a limited number of third-party service providers, including Google
            (for OAuth authentication) and Resend (for transactional email). Use of Google
            authentication is governed by Google's Terms of Service and Privacy Policy.
          </p>
          <p className="mt-3">
            Links to third-party websites or services appearing on the Platform are provided for
            convenience only. GoodHours does not endorse, control, or accept responsibility for
            the content or practices of any third-party site.
          </p>
        </>
      ),
    },
    {
      id: "termination",
      title: "10. Account Termination and Data Deletion",
      content: (
        <>
          <p>
            <strong>By You.</strong> You may delete your account at any time through the Settings
            page. Account deletion triggers a cascading removal of your personal profile, messages,
            service signups, and associated records. Immutable audit-trail entries required for
            compliance purposes may be retained in anonymized or aggregated form.
          </p>
          <p className="mt-3">
            <strong>By GoodHours.</strong> We may suspend or terminate your account, with or
            without notice, if we determine that you have violated these Terms, engaged in
            fraudulent activity, or pose a risk to other users or to the integrity of the Platform.
          </p>
          <p className="mt-3">
            <strong>School Termination.</strong> If a school administrator deletes a school
            account, all associated student and teacher accounts, cohorts, and records are
            permanently removed. Schools are responsible for exporting any necessary records before
            initiating deletion.
          </p>
          <p className="mt-3">
            Termination does not affect any rights or obligations that accrued before the effective
            date of termination.
          </p>
        </>
      ),
    },
    {
      id: "disclaimers",
      title: "11. Disclaimers of Warranties",
      content: (
        <>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY OF ANY KIND.
            TO THE FULLEST EXTENT PERMITTED BY LAW, GOODHOURS EXPRESSLY DISCLAIMS ALL WARRANTIES,
            EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, NON-INFRINGEMENT, AND ACCURACY OF DATA.
          </p>
          <p className="mt-3">
            We do not warrant that (a) the Service will be uninterrupted or error-free; (b) any
            defects or errors will be corrected; (c) the Service is free of viruses or other
            harmful components; or (d) the results of using the Service will meet your
            requirements.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      title: "12. Limitation of Liability",
      content: (
        <>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, GOODHOURS AND ITS OFFICERS,
            DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
            SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF
            THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p className="mt-3">
            IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE GREATER OF (A) THE AMOUNT
            YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM OR (B) ONE HUNDRED US
            DOLLARS ($100).
          </p>
          <p className="mt-3">
            Some jurisdictions do not allow the exclusion or limitation of certain damages, so the
            above limitations may not apply to you.
          </p>
        </>
      ),
    },
    {
      id: "indemnification",
      title: "13. Indemnification",
      content: (
        <p>
          You agree to indemnify, defend, and hold harmless GoodHours and its officers, directors,
          employees, and agents from and against any claims, liabilities, damages, losses, and
          expenses (including reasonable attorneys' fees) arising out of or related to (a) your
          use of the Service, (b) your violation of these Terms, (c) your violation of any
          applicable law or the rights of any third party, or (d) any content you submit to the
          Platform.
        </p>
      ),
    },
    {
      id: "governing-law",
      title: "14. Governing Law and Dispute Resolution",
      content: (
        <>
          <p>
            These Terms are governed by the laws of the State of Delaware, without regard to
            conflict-of-law principles. Any dispute arising from these Terms or your use of the
            Service shall first be addressed through good-faith negotiation. If not resolved within
            30 days, disputes shall be submitted to binding arbitration under the rules of the
            American Arbitration Association, except that either party may seek injunctive or
            other equitable relief in any court of competent jurisdiction.
          </p>
          <p className="mt-3">
            <strong>Class Action Waiver.</strong> You agree that any arbitration will be conducted
            on an individual basis and not as a class or representative action.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      title: "15. Changes to These Terms",
      content: (
        <p>
          We may update these Terms from time to time. We will provide notice of material changes
          by posting the updated Terms on this page with a new effective date and, where
          appropriate, by sending an email to the address associated with your account. Your
          continued use of the Service after the effective date of the revised Terms constitutes
          your acceptance. If you do not agree to the revised Terms, you must stop using the
          Service.
        </p>
      ),
    },
    {
      id: "contact",
      title: "16. Contact Us",
      content: (
        <p>
          Questions about these Terms should be directed to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
            {CONTACT_EMAIL}
          </a>
          . For general support, contact{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--action)] underline hover:opacity-80">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
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
          <Link to="/privacy" className="text-sm text-[var(--text-sec)] hover:text-[var(--text)]">
            Privacy Policy
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
          <h1 className="text-[30px] font-bold text-[var(--text)] mb-2">Terms of Service</h1>
          <p className="text-[13.5px] text-[var(--text-sec)]">
            Effective date: {EFFECTIVE_DATE}
          </p>
          <p className="text-[14px] text-[var(--text-sec)] mt-4 leading-relaxed">
            These Terms of Service govern your access to and use of the GoodHours platform —
            a community service tracking and verification system for students, schools, and
            partner organizations. Please read these Terms carefully before using the Service.
          </p>
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
            Questions about our Terms?
          </div>
          <p className="text-[13px] text-[var(--text-sec)] mb-3">
            We're happy to clarify anything. Reach out and we'll respond promptly.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-block px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 transition-opacity"
          >
            Email {CONTACT_EMAIL}
          </a>
          <div className="mt-5 pt-5 border-t border-[var(--border)] flex justify-center gap-5 text-[12.5px] text-[var(--text-faint)]">
            <Link to="/privacy" className="hover:text-[var(--text-sec)]">Privacy Policy</Link>
            <Link to="/faq" className="hover:text-[var(--text-sec)]">FAQ</Link>
            <Link to="/" className="hover:text-[var(--text-sec)]">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
