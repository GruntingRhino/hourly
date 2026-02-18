import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const data = await api.get<{ read: boolean }[]>("/messages/notifications");
        setUnreadCount(data.filter((n) => !n.read).length);
      } catch {
        // ignore
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Reset badge when visiting messages
  useEffect(() => {
    if (location.pathname === "/messages") {
      setUnreadCount(0);
    }
  }, [location.pathname]);

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
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                className={`relative flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {item.path === "/messages" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            ))}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
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
        {children}
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
        { path: "/messages", label: "Messages", icon: "✉" },
        { path: "/settings", label: "Settings", icon: "☰" },
      ];
    case "ORG_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard", icon: "⌂" },
        { path: "/opportunities", label: "Opportunities", icon: "★" },
        { path: "/messages", label: "Messages", icon: "✉" },
        { path: "/settings", label: "Settings", icon: "☰" },
      ];
    case "SCHOOL_ADMIN":
    case "TEACHER":
    case "DISTRICT_ADMIN":
      return [
        { path: "/dashboard", label: "Dashboard", icon: "⌂" },
        { path: "/groups", label: "Groups", icon: "★" },
        { path: "/messages", label: "Messages", icon: "✉" },
        { path: "/settings", label: "Settings", icon: "☰" },
      ];
    default:
      return [];
  }
}
