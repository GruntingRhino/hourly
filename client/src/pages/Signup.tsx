import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";


function ZipCodeInput({ zipCodes, onChange }: { zipCodes: string[]; onChange: (z: string[]) => void }) {
  const [input, setInput] = useState("");
  const addZip = () => {
    const z = input.trim();
    if (z && /^\d{5}$/.test(z) && !zipCodes.includes(z)) {
      onChange([...zipCodes, z]);
      setInput("");
    }
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        ZIP Codes <span className="text-gray-400">(service area)</span>
      </label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addZip(); } }}
          placeholder="e.g. 02101"
          maxLength={5}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={addZip} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {zipCodes.map((z) => (
          <span key={z} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-sm">
            {z}
            <button type="button" onClick={() => onChange(zipCodes.filter((x) => x !== z))} className="text-blue-400 hover:text-blue-600">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [role, setRole] = useState(searchParams.get("role") || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [orgName, setOrgName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [zipCodes, setZipCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup({
        email,
        password,
        name,
        role,
        age: age ? parseInt(age) : undefined,
        organizationName: orgName || undefined,
        schoolName: role === "SCHOOL_ADMIN" ? schoolName : undefined,
        schoolDomain: role === "SCHOOL_ADMIN" ? schoolDomain || undefined : undefined,
        zipCodes: (role === "ORG_ADMIN" || role === "SCHOOL_ADMIN") && zipCodes.length > 0 ? zipCodes : undefined,
      });
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // Role selection screen
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <Link to="/" className="block text-center text-2xl font-bold italic mb-8">
            Hourly
          </Link>
          <div className="space-y-3">
            <button
              onClick={() => setRole("STUDENT")}
              className="w-full p-4 border-2 border-gray-200 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium">I would like to volunteer</div>
              <div className="text-sm text-gray-500">Find opportunities and track hours</div>
            </button>
            <button
              onClick={() => setRole("ORG_ADMIN")}
              className="w-full p-4 border-2 border-gray-200 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium">I am looking for volunteers</div>
              <div className="text-sm text-gray-500">Post opportunities and manage attendance</div>
            </button>
            <button
              onClick={() => setRole("SCHOOL_ADMIN")}
              className="w-full p-4 border-2 border-gray-200 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium">I am a school administrator</div>
              <div className="text-sm text-gray-500">Create a school, manage classrooms and audit hours</div>
            </button>
          </div>
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-2xl font-bold italic mb-8">
          Hourly
        </Link>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Sign Up</h2>
            <button
              onClick={() => setRole("")}
              className="text-sm text-blue-600 hover:underline"
            >
              Change role
            </button>
          </div>

          <div className="mb-4 p-2 bg-blue-50 rounded text-sm text-blue-700 text-center">
            {role === "STUDENT" && "Signing up as a Volunteer"}
            {role === "ORG_ADMIN" && "Signing up as an Organization"}
            {role === "SCHOOL_ADMIN" && "Creating a School"}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {role === "STUDENT" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  min={10}
                  max={25}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {role === "ORG_ADMIN" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <ZipCodeInput zipCodes={zipCodes} onChange={setZipCodes} />
              </>
            )}

            {role === "SCHOOL_ADMIN" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School Name
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School Domain <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={schoolDomain}
                    onChange={(e) => setSchoolDomain(e.target.value)}
                    placeholder="e.g. lincoln.edu"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <ZipCodeInput zipCodes={zipCodes} onChange={setZipCodes} />
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
