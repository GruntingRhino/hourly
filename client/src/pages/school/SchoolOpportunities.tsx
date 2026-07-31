import { useEffect, useState } from "react";
import { api, ApiError, getErrorMessage } from "../../lib/api";
import BeneficiaryOpportunities from "../beneficiary/Opportunities";

export default function SchoolOpportunities() {
  const [benId, setBenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ id: string; name: string }>("/schools/my-beneficiary")
      .then((b) => setBenId(b.id))
      .catch((err) => {
        setError(err instanceof ApiError ? getErrorMessage(err, "Request failed.") : "Failed to load school opportunities.");
      });
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center text-[var(--text-sec)]">{error}</div>
    );
  }

  if (!benId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-sm text-[var(--text-sec)]">Loading...</div>
      </div>
    );
  }

  return <BeneficiaryOpportunities overrideBenId={benId} />;
}
