import { useState } from "react";
import { Link } from "react-router-dom";

const AUDIENCES = [
  {
    id: "school" as const,
    label: "School Administrator",
    title: "Register your school",
    body: "Create a school workspace with Google Sign-In. You’ll use your official school email to verify ownership.",
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-2xl text-center">
        <Link to="/" className="block text-2xl font-bold italic mb-8">GoodHours</Link>
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-left shadow-sm">
          <h2 className="text-xl font-bold mb-2 text-gray-900">How to Join GoodHours</h2>
          <p className="text-sm text-gray-500 mb-5">Pick the path that matches you. Only school admins create new school workspaces here; students and partners join through invitations.</p>

          <div className="grid gap-2 sm:grid-cols-3 mb-5" role="tablist" aria-label="Join GoodHours as">
            {AUDIENCES.map((item) => {
              const active = item.id === audience;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAudience(item.id)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  aria-pressed={active}
                >
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-gray-500">{item.id === "school" ? "Public registration" : "Invitation-based"}</div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-1">{selected.title}</div>
            <div className="text-sm text-gray-600 mb-4">{selected.body}</div>
            <Link to={selected.cta.to} className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              {selected.cta.label}
            </Link>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
