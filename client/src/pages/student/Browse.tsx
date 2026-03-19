import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number;
  _count: { signups: number };
  opportunity: {
    id: string;
    title: string;
    description: string;
    location: string | null;
    category: string | null;
    requirementsNote: string | null;
    beneficiary: { id: string; name: string; category: string | null };
  };
}

function getSlotDateKey(date: string): string {
  // Take first 10 chars of ISO date string: "YYYY-MM-DD"
  return date.substring(0, 10);
}

function CalendarGrid({
  slots,
  currentMonth,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: {
  slots: TimeSlot[];
  currentMonth: Date;
  selectedDate: string | null;
  onMonthChange: (dir: 1 | -1) => void;
  onSelectDate: (date: string | null) => void;
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const slotsByDate = new Map<string, number>();
  for (const slot of slots) {
    const d = getSlotDateKey(slot.date);
    slotsByDate.set(d, (slotsByDate.get(d) || 0) + 1);
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayKey = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(-1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          ‹
        </button>
        <h2 className="font-semibold text-gray-900">{monthLabel}</h2>
        <button
          onClick={() => onMonthChange(1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = slotsByDate.get(dateKey) || 0;
          const isSelected = selectedDate === dateKey;
          const isToday = dateKey === todayKey;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(isSelected ? null : dateKey)}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-md text-sm transition-colors
                ${isSelected ? "bg-blue-600 text-white" : count > 0 ? "hover:bg-blue-50" : "hover:bg-gray-50"}
                ${isToday && !isSelected ? "ring-1 ring-blue-400" : ""}
                ${count === 0 ? "text-gray-300" : isSelected ? "text-white" : "text-gray-800 font-medium"}
              `}
            >
              <span>{day}</span>
              {count > 0 && (
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    isSelected ? "bg-white" : "bg-blue-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 text-center">
          Showing slots for{" "}
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {" · "}
          <button
            onClick={() => onSelectDate(null)}
            className="text-blue-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentBrowse() {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [mySignupIds, setMySignupIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [available, mySignups] = await Promise.all([
        api.get<TimeSlot[]>("/beneficiaries/available-slots"),
        api.get<{ slot: { id: string } }[]>("/beneficiaries/my-signups").catch(() => []),
      ]);
      setSlots(available);
      setMySignupIds(new Set(mySignups.map((s) => s.slot.id)));
    } catch {
      setError("Failed to load opportunities. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleMonthChange = (dir: 1 | -1) => {
    setCurrentMonth((prev) => {
      const d = new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
      return d;
    });
    setSelectedDate(null);
  };

  const filtered = slots.filter((s) => {
    if (view === "calendar" && selectedDate) {
      return getSlotDateKey(s.date) === selectedDate;
    }
    if (view === "list" && search) {
      const q = search.toLowerCase();
      return (
        s.opportunity.title.toLowerCase().includes(q) ||
        s.opportunity.description.toLowerCase().includes(q) ||
        s.opportunity.beneficiary.name.toLowerCase().includes(q) ||
        (s.opportunity.location?.toLowerCase().includes(q) ?? false) ||
        (s.opportunity.category?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const handleCardClick = (slot: TimeSlot) => {
    navigate(`/slot/${slot.id}`, { state: { slot } });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Browse Opportunities</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => { setView("list"); setSelectedDate(null); }}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              view === "list"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ☰ List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              view === "calendar"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ▦ Calendar
          </button>
        </div>
      </div>

      {view === "list" && (
        <input
          type="text"
          placeholder="Search opportunities, organizations, or categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
        />
      )}

      {view === "calendar" && !loading && (
        <CalendarGrid
          slots={slots}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onMonthChange={handleMonthChange}
          onSelectDate={setSelectedDate}
        />
      )}

      {loading ? (
        <div className="text-gray-500">Loading opportunities...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">
            {view === "calendar" && selectedDate ? "📅" : "⌕"}
          </div>
          <div className="font-medium text-gray-700 mb-1">
            {view === "calendar" && selectedDate
              ? "No opportunities on this date"
              : "No opportunities found"}
          </div>
          <div className="text-sm text-gray-500">
            {view === "calendar" && selectedDate
              ? "Select a highlighted date to see available slots."
              : search
              ? "Try a different search term."
              : "Your school hasn't approved any partner organizations yet. Check back later."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((slot) => {
            const isSignedUp = mySignupIds.has(slot.id);
            const isFull = slot._count.signups >= slot.capacity;
            return (
              <div
                key={slot.id}
                onClick={() => handleCardClick(slot)}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-gray-900">
                      {slot.opportunity.title}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {slot.opportunity.beneficiary.name}
                    </div>
                    {slot.opportunity.category && (
                      <div className="text-xs text-purple-600 mt-0.5">
                        {slot.opportunity.category}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 mt-2">
                      {new Date(slot.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                      {" · "}
                      {slot.startTime}–{slot.endTime}
                      {" · "}
                      <span className="font-medium text-blue-700">
                        {slot.durationHours}h
                      </span>
                    </div>
                    {slot.opportunity.location && (
                      <div className="text-sm text-gray-500 mt-0.5">
                        {slot.opportunity.location}
                      </div>
                    )}
                    {slot.opportunity.requirementsNote && (
                      <div className="text-xs text-orange-600 mt-1">
                        Note: {slot.opportunity.requirementsNote}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-gray-700">
                      {slot._count.signups}/{slot.capacity}
                    </div>
                    <div className="text-xs text-gray-400">spots</div>
                    <div className="mt-3">
                      {isSignedUp ? (
                        <span className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">
                          Signed Up
                        </span>
                      ) : isFull ? (
                        <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full">
                          Full
                        </span>
                      ) : (
                        <span className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full border border-blue-200">
                          View Details →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
