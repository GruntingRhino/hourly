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

  const navItems = getNavItems(user.role);
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold italic text-gray-900">
            GoodHours
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
              <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 hidden md:block">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-500 hidden md:inline">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
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
        { path: "/dashboard", label: "Dashboard", icon: "⌂" },
        { path: "/browse", label: "Browse", icon: "⌕" },
        { path: "/submit", label: "Submit Hours", icon: "+" },
        { path: "/settings", label: "Settings", icon: "☰" },
      ];
    case "SCHOOL_ADMIN":
    case "TEACHER":
    case "DISTRICT_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard", icon: "⌂" },
        { path: "/cohorts", label: "Cohorts", icon: "★" },
        { path: "/beneficiaries", label: "Partners", icon: "♦" },
        { path: "/submissions", label: "Submissions", icon: "✓" },
        { path: "/settings", label: "Settings", icon: "☰" },
      ];
    case "BENEFICIARY_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard", icon: "⌂" },
        { path: "/opportunities", label: "Opportunities", icon: "★" },
        { path: "/settings", label: "Settings", icon: "☰" },
      ];
    default:
      return [];
  }
}
