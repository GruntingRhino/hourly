import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";

export default function SchoolConfirmTransfer() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming transfer...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing transfer token.");
      return;
    }

    api.post<{ message: string }>("/schools/confirm-transfer", { token })
      .then((result) => {
        setStatus("success");
        setMessage(result.message || "Ownership transferred successfully.");
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err.message || "Transfer confirmation failed.");
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-3">School Ownership Transfer</h1>
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          status === "success"
            ? "border-green-200 bg-green-50 text-green-700"
            : status === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-gray-200 bg-gray-50 text-gray-600"
        }`}>
          {message}
        </div>
        <div className="mt-5">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
