import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../lib/api";

export default function SupervisorVerify() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(token ? "idle" : "error");
  const [message, setMessage] = useState(token ? "" : "No verification link was provided.");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setStatus("submitting"); setMessage("");
    try {
      await api.post(`/beneficiaries/supervisor-verification/${encodeURIComponent(token)}/consume`, { supervisorEmail: email });
      setStatus("success"); setMessage("The service record has been verified. You may close this page.");
    } catch (error: unknown) { setStatus("error"); setMessage(getErrorMessage(error, "This verification link is invalid, expired, or already used.")); }
  };

  return <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4"><div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded p-6"><Link to="/" className="block text-xl font-semibold italic mb-6">GoodHours</Link><h1 className="text-xl font-semibold mb-2">Verify service hours</h1>{status === "success" ? <p className="text-[var(--ok-t)]">{message}</p> : <form onSubmit={submit} className="space-y-4"><p className="text-sm text-[var(--text-sec)]">Enter the school-authorized email address that received this link.</p><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border rounded px-3 py-2" placeholder="supervisor@school.edu" /><button disabled={status === "submitting"} className="w-full py-2 bg-[var(--action)] text-white rounded disabled:opacity-50">{status === "submitting" ? "Verifying..." : "Verify hours"}</button>{status === "error" && <p className="text-sm text-[var(--er-t)]">{message}</p>}</form>}</div></div>;
}
