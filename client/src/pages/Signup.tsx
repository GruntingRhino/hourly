import { useState } from "react";
import { Link } from "react-router-dom";

const AUDIENCES = [
  {
    id: "school" as const,
    label: "School Administrator",
    title: "Register your school",
    body: "Create a school workspace with Google Sign-In. You'll use your official school email to verify ownership.",
    cta: { to: "/school/register", label: "Register My School →" },
  },
  {
    id: "student" as const,
    label: "Student",
    title: "Join with an invitation",
    body: "Students are invited by their school or cohort. Check your email for a GoodHours invite link, or sign in if you already have an account.",
    cta: { to: "/login", label: "Go to Sign In →" },
  },
  {
    id: "partner" as const,
    label: "Community Organization",
    title: "Partner with a school",
    body: "Organizations are invited by partner schools. If you were asked to join, use the invite link or contact the school administrator.",
    cta: { to: "/login", label: "Go to Sign In →" },
  },
] as const;

export default function Signup() {
  const [audience, setAudience] = useState<typeof AUDIENCES[number]["id"]>("school");
  const selected = AUDIENCES.find((item) => item.id === audience) ?? AUDIENCES[0];

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-xl text-center">
        <Link to="/" className="block text-[20px] font-bold mb-7" style={{ color: "var(--navy)" }}>GoodHours</Link>
        <div className="border border-[var(--border)] rounded-[3px] p-6 text-left" style={{ background: "var(--surface)" }}>
          <h1 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text)" }}>How to Join GoodHours</h1>
          <p className="text-[13px] mb-5" style={{ color: "var(--text-sec)" }}>GoodHours is for users who are 13 or older. Pick the path that matches you. Only school admins create new school workspaces here; students and partners join through invitations.</p>

          <div className="grid gap-2 sm:grid-cols-3 mb-5" role="tablist" aria-label="Join GoodHours as">
            {AUDIENCES.map((item) => {
              const active = item.id === audience;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAudience(item.id)}
                  className={`rounded-[3px] border px-3 py-3 text-left transition-colors`}
                  style={active
                    ? { borderColor: "var(--action)", background: "var(--action-lt)", color: "var(--navy)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-sec)" }
                  }
                  id={`join-tab-${item.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls="join-tabpanel"
                  tabIndex={active ? 0 : -1}
                >
                  <div className="text-[13px] font-semibold" style={{ color: active ? "var(--navy)" : "var(--text)" }}>{item.label}</div>
                  <div className="mt-1 text-[12px] leading-5" style={{ color: "var(--text-faint)" }}>{item.id === "school" ? "Public registration" : "Invitation-based"}</div>
                </button>
              );
            })}
          </div>

          <div
            id="join-tabpanel"
            role="tabpanel"
            aria-labelledby={`join-tab-${audience}`}
            className="rounded-[3px] border border-[var(--border)] p-4"
            style={{ background: "var(--surface-alt)" }}
          >
            <div className="text-[13px] font-semibold mb-1" style={{ color: "var(--text)" }}>{selected.title}</div>
            <div className="text-[13px] mb-4" style={{ color: "var(--text-sec)" }}>{selected.body}</div>
            <Link
              to={selected.cta.to}
              className="inline-flex items-center h-[34px] px-4 rounded-[2px] text-[13px] font-medium text-white"
              style={{ background: "var(--navy)" }}
            >
              {selected.cta.label}
            </Link>
          </div>

          <div className="mt-4 text-[13px]" style={{ color: "var(--text-sec)" }}>
            Already have an account?{" "}
            <Link to="/login" className="hover:underline font-medium" style={{ color: "var(--action)" }}>Sign in</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
