import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold italic">Hourly</h1>
          <div className="flex gap-3">
            <Link
              to="/login"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 text-center border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            The System of Record for Student Volunteer Hours
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Hourly connects students, service organizations, and schools with a trusted
            platform for tracking, verifying, and reporting community service hours.
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-gray-900 text-white rounded-md text-lg font-medium hover:bg-gray-800"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="py-16 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
          <div className="border border-gray-200 rounded-lg p-8">
            <h3 className="text-xl font-bold mb-3">For Students</h3>
            <p className="text-gray-600">
              Discover legitimate community service opportunities, track your hours
              automatically, and build a verified record that schools trust.
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-8">
            <h3 className="text-xl font-bold mb-3">For Non-Profits</h3>
            <p className="text-gray-600">
              Post opportunities, manage volunteer capacity, verify attendance,
              and maintain accurate records without paperwork.
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-8">
            <h3 className="text-xl font-bold mb-3">For Schools</h3>
            <p className="text-gray-600">
              Approve organizations, set service requirements, audit hours,
              and accept records with confidence. No manual re-verification needed.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Get Started</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup?role=STUDENT"
              className="px-6 py-3 border border-gray-300 rounded-md font-medium hover:bg-gray-50"
            >
              I'm a Volunteer
            </Link>
            <Link
              to="/signup?role=ORGANIZATION"
              className="px-6 py-3 border border-gray-300 rounded-md font-medium hover:bg-gray-50"
            >
              I'm an Organization
            </Link>
            <Link
              to="/signup?role=SCHOOL"
              className="px-6 py-3 border border-gray-300 rounded-md font-medium hover:bg-gray-50"
            >
              I'm a School
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
