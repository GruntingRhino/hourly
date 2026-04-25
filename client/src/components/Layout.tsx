import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const AVATAR_COLORS: Record<string, string> = {
  STUDENT: "#2563EB",
  SCHOOL_ADMIN: "#0891B2",
  TEACHER: "#0891B2",
  BENEFICIARY_ADMIN: "#7C3AED",
};

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

  const avatarColor = AVATAR_COLORS[user?.role ?? ""] ?? "#2563EB";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav — 58px, white, underline active indicator */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40" style={{ height: 58 }}>
        <div className="max-w-[960px] mx-auto px-8 h-full flex items-center">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center shrink-0 mr-8">
            <img
              src="/logo-full.png"
              alt="GoodHours"
              className="h-10 w-auto"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block";
              }}
            />
            <span className="hidden text-xl font-bold text-blue-700">GoodHours</span>
          </Link>

          {/* Nav links — underline active state */}
          <nav className="flex items-stretch h-full gap-0.5 flex-1" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`flex items-center px-3.5 text-sm transition-colors border-b-2 ${
                  isActive(item.path)
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User profile */}
          <div className="flex items-center gap-2.5 pl-4 border-l border-gray-200 shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 select-none"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <span className="text-sm text-gray-700 font-medium hidden md:inline max-w-[180px] truncate">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Log out"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[960px] mx-auto px-8 py-7 pb-12">
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
      return [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/cohorts", label: "Cohorts" },
        { path: "/beneficiaries", label: "Partners" },
        { path: "/submissions", label: "Submissions" },
        { path: "/launch", label: "Launch" },
        { path: "/settings", label: "Settings" },
        ...((import.meta.env.DEV === true || import.meta.env.VITE_APP_ENV === "development") && role === "SCHOOL_ADMIN"
          ? [{ path: "/admin/impersonate", label: "⚙ Dev: Impersonate" }]
          : []),
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
