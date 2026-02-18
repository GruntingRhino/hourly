import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import SignaturePad from "../../components/SignaturePad";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  tags: string | null;
  location: string;
  address: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number;
  ageRequirement: number | null;
  gradeRequirement: string | null;
  isRecurring: boolean;
  status: string;
  organization: { id: string; name: string; description?: string };
  _count: { signups: number };
  signups: { id: string; status: string; user: { id: string; name: string } }[];
}

interface Session {
  id: string;
  status: string;
  verificationStatus: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalHours: number | null;
  signatureType: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [mySignup, setMySignup] = useState<any>(null);
  const [mySession, setMySession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState<"DRAWN" | "FILE">("DRAWN");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  const loadData = async () => {
    try {
      const oppData = await api.get<Opportunity>(`/opportunities/${id}`);
      setOpp(oppData);

      // Check if student has signed up
      const signups = await api.get<any[]>("/signups/my");
      const mine = signups.find((s) => s.opportunity.id === id);
      setMySignup(mine || null);

      // Check if student has a session
      const sessions = await api.get<Session[]>("/sessions/my");
      const sess = sessions.find((s: any) => s.opportunity.id === id);
      setMySession(sess || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSignup = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      await api.post("/signups", { opportunityId: id });
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to sign up");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSignup = async () => {
    if (!mySignup) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/signups/${mySignup.id}/cancel`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!mySession) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/sessions/${mySession.id}/checkin`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to check in");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!mySession) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/sessions/${mySession.id}/checkout`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to check out");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!mySession) return;
    setActionError("");
    if (verifyMethod === "DRAWN" && !signatureData) {
      setActionError("Please draw your signature before submitting.");
      return;
    }
    if (verifyMethod === "FILE" && !signatureFile) {
      setActionError("Please select a file before submitting.");
      return;
    }
    setActionLoading(true);
    try {
      if (verifyMethod === "DRAWN") {
        await api.post(`/sessions/${mySession.id}/submit-verification`, {
          signatureType: "DRAWN",
          signatureData,
        });
      } else {
        const formData = new FormData();
        formData.append("signatureFile", signatureFile!);
        formData.append("signatureType", "FILE");
        const token = localStorage.getItem("hourly_token");
        const res = await fetch(`/api/sessions/${mySession.id}/submit-verification`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to submit");
        }
      }
      setShowVerifyForm(false);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit verification");
    } finally {
      setActionLoading(false);
    }
  };

  // Check if opportunity date has passed (can submit verification)
  const canSubmitVerification = opp && mySession?.status === "COMMITTED" && new Date(opp.date) <= new Date();

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!opp) return <div className="text-red-500">Opportunity not found</div>;

  const tags = opp.tags ? JSON.parse(opp.tags) : [];
  const spotsLeft = opp.capacity - opp._count.signups;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Back
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">{opp.title}</h1>
            <div className="text-gray-500 mt-1">{opp.organization.name}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {opp._count.signups}/{opp.capacity}
            </div>
            <div className="text-xs text-gray-400">signed up</div>
          </div>
        </div>

        <p className="text-gray-700 mb-4">{opp.description}</p>

        {tags.length > 0 && (
          <div className="flex gap-2 mb-4">
            {tags.map((tag: string) => (
              <span key={tag} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <span className="text-gray-500">Location:</span>
            <div className="font-medium">{opp.location}</div>
          </div>
          <div>
            <span className="text-gray-500">Date:</span>
            <div className="font-medium">{new Date(opp.date).toLocaleDateString()}</div>
          </div>
          <div>
            <span className="text-gray-500">Time:</span>
            <div className="font-medium">{opp.startTime} - {opp.endTime}</div>
          </div>
          <div>
            <span className="text-gray-500">Duration:</span>
            <div className="font-medium">{opp.durationHours} hours</div>
          </div>
          {opp.ageRequirement && (
            <div>
              <span className="text-gray-500">Age Requirement:</span>
              <div className="font-medium">{opp.ageRequirement}+</div>
            </div>
          )}
          {opp.isRecurring && (
            <div>
              <span className="text-gray-500">Recurring:</span>
              <div className="font-medium">Yes</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="border-t border-gray-200 pt-4">
          {actionError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {actionError}
            </div>
          )}
          {!mySignup && opp.status === "ACTIVE" && (
            <button
              onClick={handleSignup}
              disabled={actionLoading || spotsLeft <= 0}
              className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? "Signing up..." : spotsLeft <= 0 ? "Join Waitlist" : "Sign Up"}
            </button>
          )}

          {mySignup && mySignup.status === "CONFIRMED" && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 rounded-md text-green-700 text-sm text-center">
                You're signed up for this opportunity
              </div>

              {/* COMMITTED state — waiting for opportunity date to pass */}
              {mySession?.status === "COMMITTED" && !canSubmitVerification && (
                <div className="p-3 bg-blue-50 rounded-md text-blue-700 text-sm text-center">
                  Committed &middot; {mySession.totalHours}h &middot; Verification unlocks after {new Date(opp!.date).toLocaleDateString()}
                </div>
              )}

              {/* COMMITTED and date has passed — show Submit Verification */}
              {canSubmitVerification && !showVerifyForm && (
                <button
                  onClick={() => setShowVerifyForm(true)}
                  className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                >
                  Submit Verification
                </button>
              )}

              {/* Verification submission form */}
              {canSubmitVerification && showVerifyForm && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-medium">Submit Verification</h3>
                  <p className="text-sm text-gray-500">
                    Provide a supervisor signature to verify your {mySession!.totalHours} hours.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setVerifyMethod("DRAWN")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium ${
                        verifyMethod === "DRAWN" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-600 border border-gray-200"
                      }`}
                    >
                      Draw Signature
                    </button>
                    <button
                      onClick={() => setVerifyMethod("FILE")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium ${
                        verifyMethod === "FILE" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-600 border border-gray-200"
                      }`}
                    >
                      Upload File
                    </button>
                  </div>

                  {verifyMethod === "DRAWN" ? (
                    <SignaturePad onSignatureChange={setSignatureData} />
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="text-xs text-gray-400 mt-1">PDF, PNG, or JPG up to 5MB</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitVerification}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading ? "Submitting..." : "Submit for Review"}
                    </button>
                    <button
                      onClick={() => setShowVerifyForm(false)}
                      className="py-2 px-4 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* PENDING_VERIFICATION state */}
              {mySession?.status === "PENDING_VERIFICATION" && (
                <div className="p-3 bg-yellow-50 rounded-md text-yellow-700 text-sm text-center">
                  Verification submitted &middot; {mySession.totalHours}h &middot; Awaiting school review
                </div>
              )}

              {/* Legacy check-in/out flow states */}
              {mySession?.status === "PENDING_CHECKIN" && (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="w-full py-3 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? "Checking in..." : "Check In"}
                </button>
              )}

              {mySession?.status === "CHECKED_IN" && (
                <div>
                  <div className="p-3 bg-blue-50 rounded-md text-blue-700 text-sm text-center mb-3">
                    Checked in at {new Date(mySession.checkInTime!).toLocaleTimeString()}
                  </div>
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="w-full py-3 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Checking out..." : "Check Out"}
                  </button>
                </div>
              )}

              {mySession?.status === "CHECKED_OUT" && (
                <div className="p-3 bg-yellow-50 rounded-md text-yellow-700 text-sm text-center">
                  Checked out &middot; {mySession.totalHours} hours &middot; Awaiting verification
                </div>
              )}

              {mySession?.status === "VERIFIED" && (
                <div className="p-3 bg-green-50 rounded-md text-green-700 text-sm text-center">
                  Verified! {mySession.totalHours} hours approved
                </div>
              )}

              {mySession?.status === "REJECTED" && (
                <div className="p-3 bg-red-50 rounded-md text-red-700 text-sm">
                  <div className="text-center font-medium">Hours rejected</div>
                  {mySession.rejectionReason && (
                    <div className="mt-1 text-center">Reason: {mySession.rejectionReason}</div>
                  )}
                </div>
              )}

              {(mySession?.status === "COMMITTED" || mySession?.status === "PENDING_CHECKIN") && (
                <button
                  onClick={handleCancelSignup}
                  disabled={actionLoading}
                  className="w-full py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
                >
                  Cancel Signup
                </button>
              )}
            </div>
          )}

          {mySignup?.status === "WAITLISTED" && (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 rounded-md text-yellow-700 text-sm text-center">
                You're on the waitlist
              </div>
              <button
                onClick={handleCancelSignup}
                disabled={actionLoading}
                className="w-full py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
              >
                Leave Waitlist
              </button>
            </div>
          )}

          {mySignup?.status === "CANCELLED" && (
            <button
              onClick={handleSignup}
              disabled={actionLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Sign Up Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
