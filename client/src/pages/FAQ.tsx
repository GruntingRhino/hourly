import { useState } from "react";
import { Link } from "react-router-dom";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

const SECTIONS: FAQSection[] = [
  {
    title: "General",
    items: [
      {
        q: "What is GoodHours?",
        a: "GoodHours is a community service coordination and tracking platform. It connects students, schools, and service organizations with a trusted system for logging, verifying, and reporting volunteer hours — so everyone has a clear, auditable record.",
      },
      {
        q: "Who can use GoodHours?",
        a: "GoodHours is designed for three types of users: students who need to complete community service hours, school administrators who oversee and verify those hours, and partner organizations (beneficiaries) that host volunteer opportunities.",
      },
      {
        q: "Is GoodHours free to use?",
        a: "Yes. GoodHours is free for students and partner organizations. Schools may have access to additional features depending on their plan.",
      },
      {
        q: "How is my data kept private?",
        a: "GoodHours encrypts sensitive personal information at rest and in transit. Student data is only visible to the student, their school administrators, and the organization that verified their hours. We never sell personal data to third parties.",
      },
    ],
  },
  {
    title: "For Students",
    items: [
      {
        q: "How do I join GoodHours as a student?",
        a: "Your school sends you an invitation email with a unique link. Click the link, create your account, and you'll be automatically enrolled in your school's cohort. You don't need to find your school manually.",
      },
      {
        q: "How do I log hours through a school-organized event?",
        a: "Browse opportunities on the Browse page and sign up for a time slot. After the event, your hours are submitted for verification by the organization. Once approved, they count toward your total.",
      },
      {
        q: "What are self-submitted hours and how do I submit them?",
        a: "Self-submitted hours are for volunteer work you completed independently, outside of school-organized events — for example, helping at a local food bank on your own. Go to the Submit Hours page, fill in the organization name, date, hours, and a brief description, and your school administrator will review and approve them.",
      },
      {
        q: "How long does it take for hours to be approved?",
        a: "Approval time depends on your school or the organization reviewing your submission. Most approvals happen within a few business days. You'll receive a notification when your hours are approved or if any changes are requested.",
      },
      {
        q: "What happens if my submission is sent back for revision?",
        a: "You'll see a 'Needs Revision' status on the submission, along with a note from the reviewer explaining what to fix. Open the submission from your Self-Submitted Hours page, make the requested changes, and resubmit.",
      },
    ],
  },
  {
    title: "For Schools & Admins",
    items: [
      {
        q: "How do I register my school on GoodHours?",
        a: "Go to goodhours.app/school/register and sign in with your school Google account. You'll search for your school in the directory, provide a contact email address, and receive a verification link. Once verified, you can start setting up cohorts and inviting students.",
      },
      {
        q: "How do cohorts work and how do I create one?",
        a: "A cohort is a graduating class or group of students with a shared service hour requirement and timeline (e.g., Class of 2028). Go to the Cohorts page and click '+ New Cohort'. You can set the required hours, graduation year, and then import students via CSV or invite them individually.",
      },
      {
        q: "How do I invite students to join?",
        a: "Inside a cohort, use the Import Students option to upload a CSV with student names and email addresses. Then click 'Publish & Send Invites' to email each student their unique invitation link. Students click the link to create their account and are automatically added to the cohort.",
      },
      {
        q: "Can I export hour reports for compliance or record-keeping?",
        a: "Yes. From the Students or Cohorts pages, you can export hour reports as CSV. Reports include each student's name, total verified hours, breakdown by activity, and verification status — suitable for submission to district offices or accreditation bodies.",
      },
    ],
  },
  {
    title: "For Partner Organizations",
    items: [
      {
        q: "How does our organization get listed on GoodHours?",
        a: "A school administrator adds your organization as a partner from their Beneficiaries page. They'll send an invitation to your organization's contact email. Accept the invitation to create your account and start posting volunteer opportunities.",
      },
      {
        q: "How do we verify that a student completed their hours?",
        a: "After a volunteer event, students who signed up will appear in your dashboard with a 'Pending Approval' status. Review each student's submission, confirm the hours, and click Approve. You can also reject or request more information if needed. Approved hours are immediately reflected on the student's record.",
      },
      {
        q: "Can we post multiple time slots for a single opportunity?",
        a: "Yes. When creating an opportunity, you can add multiple time slots — each with its own date, start time, end time, and capacity. Students sign up for individual slots, and you manage each slot's attendance separately.",
      },
    ],
  },
];

function AccordionItem({ q, a }: FAQItem) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex justify-between items-center py-4 text-left gap-4 group"
      >
        <span className="text-[14.5px] font-medium text-[var(--text)] group-hover:text-[var(--action)] transition-colors">
          {q}
        </span>
        <span className={`shrink-0 w-5 h-5 rounded-full border border-[var(--border-s)] flex items-center justify-center transition-transform ${open ? "rotate-45" : ""}`}>
          <svg className="w-3 h-3 text-[var(--text-sec)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-4 text-[13.5px] text-[var(--text-sec)] leading-relaxed pr-8">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="min-h-screen bg-[var(--surface-alt)]">
      {/* Nav */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-full.png" alt="GoodHours" className="h-7 w-auto"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block";
            }} />
          <span className="hidden font-bold text-[var(--action)] text-lg">GoodHours</span>
        </Link>
        <Link to="/login" className="text-sm text-[var(--action)] hover:underline font-medium">Sign in</Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-[28px] font-bold text-[var(--text)] mb-2">Frequently Asked Questions</h1>
        <p className="text-[14.5px] text-[var(--text-sec)] mb-10">Everything you need to know about GoodHours.</p>

        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-alt)]">
                <h2 className="text-[11.5px] font-semibold text-[var(--text-sec)] uppercase tracking-wide">{section.title}</h2>
              </div>
              <div className="px-5">
                {section.items.map((item) => (
                  <AccordionItem key={item.q} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact footer */}
        <div className="mt-10 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6 text-center">
          <div className="text-[15px] font-semibold text-[var(--text)] mb-1">Still have questions?</div>
          <p className="text-[13.5px] text-[var(--text-sec)] mb-3">
            Our team is happy to help. Reach out and we'll get back to you as soon as possible.
          </p>
          <a
            href="mailto:help@goodhours.app"
            className="inline-block px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 transition-opacity"
          >
            Email help@goodhours.app
          </a>
          <div className="mt-5 pt-5 border-t border-[var(--border)] flex justify-center gap-5 text-[12.5px] text-[var(--text-faint)]">
            <Link to="/terms" className="hover:text-[var(--text-sec)]">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-[var(--text-sec)]">Privacy Policy</Link>
            <Link to="/" className="hover:text-[var(--text-sec)]">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
