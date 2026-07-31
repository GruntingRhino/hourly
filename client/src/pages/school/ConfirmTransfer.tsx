import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";

export default function SchoolConfirmTransfer() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Confirming transfer..." : "Missing transfer token.");

  useEffect(() => {
    if (!token) {
      return;
    }

    api.post<{ message: string }>("/schools/confirm-transfer", { token })
      .then((result) => {
        setStatus("success");
        setMessage(result.message || "Ownership transferred successfully.");
      })
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(getErrorMessage(err, "Transfer confirmation failed."));
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[var(--surface-alt)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6 ">
        <h1 className="text-xl font-bold text-[var(--text)] mb-3">School Ownership Transfer</h1>
        <div className={`rounded-[3px] border px-4 py-3 text-sm ${
          status === "success"
            ? "border-[var(--ok-b)] bg-[var(--ok-bg)] text-[var(--ok-t)]"
            : status === "error"
            ? "border-[var(--er-b)] bg-[var(--er-bg)] text-[var(--er-t)]"
            : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-sec)]"
        }`}>
          {message}
        </div>
        <div className="mt-5">
          <Link to="/login" className="text-sm text-[var(--action)] hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
