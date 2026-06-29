import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

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
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Top nav — navy, 54px */}
      <header style={{ background: "var(--navy)", height: 54 }} className="sticky top-0 z-40 flex items-center">
        <div className="max-w-[1080px] mx-auto px-6 h-full flex items-center justify-between w-full">
          {/* Logo */}
          <Link to="/dashboard" tabIndex={-1} className="flex items-center shrink-0">
            <img
              src="/logo-full.png"
              alt="GoodHours"
              className="h-8 w-auto brightness-0 invert"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block";
              }}
            />
            <span className="hidden text-white font-semibold text-[15px] tracking-tight">GoodHours</span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden lg:flex items-stretch h-full gap-0" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`flex items-center px-4 text-[13.5px] border-b-2 transition-colors ${
                  isActive(item.path)
                    ? "text-white border-white font-medium"
                    : "text-white/60 border-transparent hover:text-white/90"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile nav */}
          <nav className="flex items-stretch h-full gap-0 lg:hidden" aria-label="Main navigation">
            {visibleNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`flex items-center px-3 text-[12.5px] border-b-2 transition-colors ${
                  isActive(item.path)
                    ? "text-white border-white font-medium"
                    : "text-white/60 border-transparent hover:text-white/90"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {overflowNavItems.length > 0 && (
              <div className="relative flex items-stretch">
                <button
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="flex items-center px-3 text-white/60 hover:text-white border-b-2 border-transparent"
                  aria-label="More navigation items"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                  </svg>
                </button>
                {mobileMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 border border-[var(--border)] rounded-[3px] py-1 z-50" style={{ background: "var(--surface)" }}>
                    {overflowNavItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-4 py-2 text-[13px] ${
                          isActive(item.path)
                            ? "text-[var(--action)] font-semibold bg-[var(--action-lt)]"
                            : "text-[var(--text)] hover:bg-[var(--surface-alt)]"
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

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Bell icon */}
            <button
              onClick={() => navigate("/messages?tab=notifications")}
              className="text-white/60 hover:text-white relative"
              aria-label="Open notifications"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 17a2 2 0 1 0 4 0" />
              </svg>
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[var(--er-t)] text-white text-[10px] font-semibold flex items-center justify-center px-1">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>
            {/* Gear → settings */}
            <Link to="/settings" className="text-white/60 hover:text-white" aria-label="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            {/* Avatar + name + logout */}
            <div className="flex items-center gap-2 pl-3 border-l border-white/15">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0 select-none"
                style={{ background: "var(--navy-mid)" }}
              >
                {initials}
              </div>
              <span className="text-[13px] text-white/80 hidden md:inline max-w-[140px] truncate">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-[12.5px] text-white/50 hover:text-white/90 transition-colors"
                aria-label="Log out"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1080px] mx-auto px-6 py-6 pb-12">
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
        { path: "/opportunities", label: "Opportunities" },
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
