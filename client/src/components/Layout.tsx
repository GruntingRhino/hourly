import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = getNavItems(user?.role ?? "");
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center shrink-0">
            <img
              src="/logo-full.png"
              alt="GoodHours"
              className="h-8 w-auto"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block";
              }}
            />
            <span className="hidden text-xl font-bold text-blue-700">GoodHours</span>
          </Link>

          <nav className="flex items-center gap-0.5" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}

            {/* User profile */}
            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-semibold text-white shrink-0 select-none">
                {initials}
              </div>
              <span className="text-sm text-gray-600 hidden lg:inline max-w-[120px] truncate">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                aria-label="Log out"
              >
                Log out
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function getNavItems(role: string) {
  switch (role) {
    case "STUDENT":
      return [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/browse", label: "Browse" },
        { path: "/submit", label: "Submit Hours" },
        { path: "/settings", label: "Settings" },
      ];
    case "SCHOOL_ADMIN":
    case "TEACHER":
    case "DISTRICT_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/cohorts", label: "Cohorts" },
        { path: "/beneficiaries", label: "Partners" },
        { path: "/discover", label: "Discover" },
        { path: "/submissions", label: "Submissions" },
        { path: "/settings", label: "Settings" },
      ];
    case "BENEFICIARY_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/opportunities", label: "Opportunities" },
        { path: "/settings", label: "Settings" },
      ];
    default:
      return [];
  }
}
