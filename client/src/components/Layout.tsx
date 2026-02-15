import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) return <>{children}</>;

  const navItems = getNavItems(user.role);
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold italic text-gray-900">
            Hourly
          </Link>
          <div className="flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
              <span className="text-sm text-gray-500 hidden md:inline">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function getNavItems(role: string) {
  switch (role) {
    case "STUDENT":
      return [
        { path: "/dashboard", label: "Dashboard", icon: "\u2302" },
        { path: "/browse", label: "Browse", icon: "\u2315" },
        { path: "/messages", label: "Messages", icon: "\u2709" },
        { path: "/settings", label: "Settings", icon: "\u2630" },
      ];
    case "ORG_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard", icon: "\u2302" },
        { path: "/opportunities", label: "Opportunities", icon: "\u2605" },
        { path: "/messages", label: "Messages", icon: "\u2709" },
        { path: "/settings", label: "Settings", icon: "\u2630" },
      ];
    case "SCHOOL_ADMIN":
    case "TEACHER":
    case "DISTRICT_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard", icon: "\u2302" },
        { path: "/groups", label: "Groups", icon: "\u2605" },
        { path: "/messages", label: "Messages", icon: "\u2709" },
        { path: "/settings", label: "Settings", icon: "\u2630" },
      ];
    default:
      return [];
  }
}
