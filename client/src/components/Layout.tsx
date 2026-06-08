import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

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
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = useMemo(() => getNavItems(user?.role ?? ""), [user?.role]);
  const visibleNavItems = navItems.slice(0, 4);
  const overflowNavItems = navItems.slice(4);
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const avatarColor = AVATAR_COLORS[user?.role ?? ""] ?? "#2563EB";

  useEffect(() => {
    let active = true;

    const loadUnreadCount = async () => {
      try {
        const result = await api.get<{ unread: number }>("/messages/notifications/unread-count");
        if (active) setUnreadNotifications(result.unread);
      } catch {
        if (active) setUnreadNotifications(0);
      }
    };

    void loadUnreadCount();
    window.addEventListener("focus", loadUnreadCount);
    const interval = window.setInterval(loadUnreadCount, 30000);

    return () => {
      active = false;
      window.removeEventListener("focus", loadUnreadCount);
      window.clearInterval(interval);
    };
  }, [location.pathname, user?.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav — 58px, white, underline active indicator */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40" style={{ height: 58 }}>
        <div className="max-w-[960px] mx-auto px-4 h-full relative flex items-center justify-between sm:px-8">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center shrink-0 relative z-10">
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
          <nav
            className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-stretch justify-center gap-0.5 lg:flex"
            aria-label="Main navigation"
          >
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

          <nav className="flex items-stretch h-full gap-0.5 lg:hidden" aria-label="Main navigation">
            {visibleNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`flex items-center px-3 text-sm transition-colors border-b-2 ${
                  isActive(item.path)
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {overflowNavItems.length > 0 && (
              <div className="relative flex items-stretch">
                <button
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="flex items-center px-3 text-sm text-gray-600 hover:text-gray-900 border-b-2 border-transparent"
                  aria-label="More navigation items"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                  </svg>
                </button>
                {mobileMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                    {overflowNavItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-4 py-2 text-sm ${
                          isActive(item.path)
                            ? "text-blue-600 font-semibold bg-blue-50"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User profile */}
          <div className="flex items-center gap-2.5 pl-4 border-l border-gray-200 shrink-0 relative z-10">
            <button
              onClick={() => navigate("/messages?tab=notifications")}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Open notifications"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 17a2 2 0 1 0 4 0" />
              </svg>
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>
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
      <main className="max-w-[960px] mx-auto px-4 py-6 pb-12 sm:px-8">
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
        { path: "/messages", label: "Messages" },
        { path: "/settings", label: "Settings" },
      ];
    case "SCHOOL_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/cohorts", label: "Cohorts" },
        { path: "/beneficiaries", label: "Partners" },
        { path: "/launch", label: "Launch" },
        { path: "/settings", label: "Settings" },
        ...((import.meta.env.DEV === true || import.meta.env.VITE_APP_ENV === "development") && role === "SCHOOL_ADMIN"
          ? [{ path: "/admin/impersonate", label: "⚙ Dev: Impersonate" }]
          : []),
      ];
    case "TEACHER":
      return [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/cohorts", label: "Cohorts" },
        { path: "/settings", label: "Settings" },
      ];
    case "BENEFICIARY_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/opportunities", label: "Opportunities" },
        { path: "/messages", label: "Messages" },
        { path: "/settings", label: "Settings" },
      ];
    default:
      return [];
  }
}
