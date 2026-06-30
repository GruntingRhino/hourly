import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SearchableSelect from "../../components/SearchableSelect";
import { api } from "../../lib/api";
import { buildOpportunityCategoryOptions } from "../../lib/opportunityCategories";

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
    beneficiary: { id: string; name: string; category: string | null; planTier?: "FREE" | "PRO" | null };
  };
}

interface CategoryCapStatus {
  category: string;
  cap: number;
  approvedHours: number;
  remainingHours: number;
  maxedOut: boolean;
  alreadyOverCap: boolean;
}

interface SchoolRules {
  blockedCategories: string[];
  categoryCapStatuses: CategoryCapStatus[];
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLooseSubsequenceMatch(term: string, text: string): boolean {
  let idx = 0;
  for (const ch of text) {
    if (ch === term[idx]) idx += 1;
    if (idx === term.length) return true;
  }
  return false;
}

function scoreSearchTerm(term: string, value: string): number {
  if (!term || !value) return 0;
  if (value === term) return 120;
  if (value.startsWith(term)) return 90;
  if (value.includes(` ${term}`)) return 75;
  if (value.includes(term)) return 60;

  const words = value.split(" ");
  if (words.some((word) => word.startsWith(term))) return 50;
  if (term.length >= 3 && isLooseSubsequenceMatch(term, value)) return 20;
  return 0;
}

function getSlotSearchScore(slot: TimeSlot, rawQuery: string): number {
  const query = normalizeSearchText(rawQuery);
  if (!query) return 1;

  const terms = query.split(" ").filter(Boolean);
  if (!terms.length) return 1;

  const weightedFields = [
    { value: normalizeSearchText(slot.opportunity.title), weight: 5 },
    { value: normalizeSearchText(slot.opportunity.beneficiary.name), weight: 4 },
    { value: normalizeSearchText(slot.opportunity.category), weight: 3 },
    { value: normalizeSearchText(slot.opportunity.location), weight: 2 },
    { value: normalizeSearchText(slot.opportunity.requirementsNote), weight: 1 },
    { value: normalizeSearchText(slot.opportunity.description), weight: 1 },
  ];

  let total = 0;
  for (const term of terms) {
    let bestTermScore = 0;
    for (const field of weightedFields) {
      const score = scoreSearchTerm(term, field.value) * field.weight;
      if (score > bestTermScore) bestTermScore = score;
    }
    if (bestTermScore === 0) return 0;
    total += bestTermScore;
  }

  return total;
}

function getStudentBrowseRank(slot: TimeSlot, rawQuery: string): number {
  const searchScore = getSlotSearchScore(slot, rawQuery);
  const proBoost = slot.opportunity.beneficiary.planTier === "PRO" ? 8 : 0;
  return searchScore * 100 + proBoost;
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
    <div className="border border-[var(--border)] rounded-[3px] p-4 mb-4" style={{ background: "var(--surface)" }}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(-1)}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-alt)]"
          style={{ color: "var(--text-sec)" }}
        >
          ‹
        </button>
        <h2 className="font-semibold" style={{ color: "var(--text)" }}>{monthLabel}</h2>
        <button
          onClick={() => onMonthChange(1)}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-alt)]"
          style={{ color: "var(--text-sec)" }}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] mb-1" style={{ color: "var(--text-faint)" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">{d}</div>
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
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-[2px] text-[13px] transition-colors
                ${isToday && !isSelected ? "ring-1 ring-[var(--action)]" : ""}
                ${count === 0 ? "opacity-30" : ""}
              `}
              style={{
                background: isSelected ? "var(--navy)" : undefined,
                color: isSelected ? "#fff" : count > 0 ? "var(--text)" : "var(--text-faint)",
                fontWeight: count > 0 ? 500 : undefined,
              }}
            >
              <span>{day}</span>
              {count > 0 && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{ background: isSelected ? "#fff" : "var(--action)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] text-[12px] text-center" style={{ color: "var(--text-faint)" }}>
          Showing slots for{" "}
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {" · "}
          <button
            onClick={() => onSelectDate(null)}
            className="hover:underline"
            style={{ color: "var(--action)" }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentBrowse() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [mySignupStatuses, setMySignupStatuses] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [categoryCapStatuses, setCategoryCapStatuses] = useState<CategoryCapStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [available, mySignups, rules] = await Promise.all([
        api.get<TimeSlot[]>("/beneficiaries/available-slots"),
        api.get<{ status: string; slot: { id: string } }[]>("/beneficiaries/my-signups").catch(() => []),
        api.get<SchoolRules>("/schools/my-rules").catch(() => ({ blockedCategories: [], categoryCapStatuses: [] })),
      ]);
      setSlots(available);
      setMySignupStatuses(new Map(mySignups.map((s) => [s.slot.id, s.status])));
      setBlockedCategories((rules?.blockedCategories ?? []).slice().sort((a, b) => a.localeCompare(b)));
      setCategoryCapStatuses(rules?.categoryCapStatuses ?? []);
    } catch {
      setError("Failed to load opportunities. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const blockedCategorySet = new Set(blockedCategories);
  const categoryOptions = buildOpportunityCategoryOptions(slots.map((slot) => slot.opportunity.category))
    .filter((category) => !blockedCategorySet.has(category));
  const blockedSelectedCategory = selectedCategory && blockedCategorySet.has(selectedCategory)
    ? categoryCapStatuses.find((status) => status.category === selectedCategory) ?? null
    : null;

  const handleMonthChange = (dir: 1 | -1) => {
    setCurrentMonth((prev) => {
      const d = new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
      return d;
    });
    setSelectedDate(null);
  };

  const filtered = slots.filter((s) => {
    const signupStatus = mySignupStatuses.get(s.id);
    if (signupStatus && signupStatus !== "CANCELLED") return false;

    if (view === "calendar" && selectedDate) {
      return getSlotDateKey(s.date) === selectedDate;
    }
    if (view === "list" && search) {
      if (getSlotSearchScore(s, search) === 0) return false;
    }
    if (selectedCategory && (s.opportunity.category || "") !== selectedCategory) return false;
    return true;
  });

  const visibleSlots =
    view === "list" && search
      ? [...filtered].sort((a, b) => getStudentBrowseRank(b, search) - getStudentBrowseRank(a, search))
      : filtered;

  return (
    <div>
      <div className="mb-6">
        <div className="text-[12px] mb-1" style={{ color: "var(--text-faint)" }}>Student / Browse</div>
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>Browse Opportunities</h1>
          <div className="flex gap-1 p-1 rounded-[3px] border border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
            <button
              onClick={() => { setView("list"); setSelectedDate(null); }}
              className="px-3 py-1 text-[13px] rounded-[2px] font-medium transition-colors"
              style={view === "list" ? { background: "var(--surface)", color: "var(--text)" } : { color: "var(--text-faint)" }}
            >
              ☰ List
            </button>
            <button
              onClick={() => setView("calendar")}
              className="px-3 py-1 text-[13px] rounded-[2px] font-medium transition-colors"
              style={view === "calendar" ? { background: "var(--surface)", color: "var(--text)" } : { color: "var(--text-faint)" }}
            >
              ▦ Calendar
            </button>
          </div>
        </div>
      </div>

      {view === "list" && (
        <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <input
            type="text"
            placeholder="Search opportunities, organizations, or categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)]"
            style={{ background: "var(--surface)", color: "var(--text)" }}
          />
          <SearchableSelect
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categoryOptions}
            placeholder="Filter by category"
            clearable
            className="w-full h-[34px] px-3 pr-9 border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] text-[13.5px]"
          />
        </div>
      )}

      {!loading && blockedCategories.length > 0 && (
        <div className="mb-4 rounded-[3px] border border-[var(--wn-b)] px-4 py-3 text-[13px]" style={{ background: "var(--wn-bg)", color: "var(--wn-t)" }}>
          Your school has capped these categories for you: {blockedCategories.join(", ")}. You have already reached the maximum allowed hours there, so new opportunities in those categories are hidden.
        </div>
      )}

      {blockedSelectedCategory && (
        <div className="mb-4 rounded-[3px] border border-[var(--er-b)] px-4 py-3 text-[13px]" style={{ background: "var(--er-bg)", color: "var(--er-t)" }}>
          Your school is preventing you from doing more {blockedSelectedCategory.category}. You have already completed {blockedSelectedCategory.approvedHours.toFixed(1)}h, which meets or exceeds the {blockedSelectedCategory.cap}h maximum.
        </div>
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
        <div style={{ color: "var(--text-faint)" }}>Loading opportunities...</div>
      ) : error ? (
        <div className="px-4 py-3 rounded-[3px] border border-[var(--er-b)] text-[13px]" style={{ background: "var(--er-bg)", color: "var(--er-t)" }}>
          {error}
        </div>
      ) : visibleSlots.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-[28px] mb-3" style={{ color: "var(--text-faint)" }}>
            {view === "calendar" && selectedDate ? "📅" : "⌕"}
          </div>
          <div className="font-medium mb-1" style={{ color: "var(--text-sec)" }}>
            {view === "calendar" && selectedDate ? "No opportunities on this date" : "No opportunities found"}
          </div>
          <div className="text-[13px]" style={{ color: "var(--text-faint)" }}>
            {view === "calendar" && selectedDate
              ? "Select a highlighted date to see available slots."
              : search
              ? blockedSelectedCategory
                ? "Choose a different category. Your school has blocked more hours in that category."
                : "Try a different search term."
              : blockedSelectedCategory
              ? "Choose a different category. Your school has blocked more hours in that category."
              : "Your school hasn't approved any partner organizations yet. Check back later."}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleSlots.map((slot) => {
            const signupStatus = mySignupStatuses.get(slot.id);
            const isSignedUp = !!signupStatus && signupStatus !== "CANCELLED";
            const isWaitlisted = signupStatus === "WAITLISTED";
            const isFull = slot._count.signups >= slot.capacity;
            return (
              <Link
                key={slot.id}
                to={`/slot/${slot.id}`}
                state={{ slot }}
                className="block border border-[var(--border)] rounded-[3px] p-4 transition-colors hover:border-[var(--action)]"
                style={{ background: "var(--surface)" }}
                aria-label={`View ${slot.opportunity.title} details`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                      {slot.opportunity.title}
                    </div>
                    <div className="text-[13px] mt-0.5" style={{ color: "var(--text-sec)" }}>
                      {slot.opportunity.beneficiary.name}
                    </div>
                    {slot.opportunity.beneficiary.planTier === "PRO" && (
                      <div className="mt-1">
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            background: "var(--wn-bg)",
                            color: "var(--wn-t)",
                            borderColor: "var(--wn-b)",
                          }}
                          title="Pro partners receive a small placement boost when opportunities are otherwise similarly relevant."
                        >
                          Pro Partner
                        </span>
                      </div>
                    )}
                    {slot.opportunity.category && (
                      <div className="text-[12px] mt-0.5" style={{ color: "var(--action)" }}>
                        {slot.opportunity.category}
                      </div>
                    )}
                    <div className="text-[13px] mt-2" style={{ color: "var(--text-sec)" }}>
                      {new Date(slot.date).toLocaleDateString(undefined, {
                        weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
                      })}
                      {" · "}{slot.startTime}–{slot.endTime}
                      {" · "}
                      <span className="font-semibold" style={{ color: "var(--navy)" }}>{slot.durationHours}h</span>
                    </div>
                    {slot.opportunity.location && (
                      <div className="text-[12.5px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                        {slot.opportunity.location}
                      </div>
                    )}
                    {slot.opportunity.requirementsNote && (
                      <div className="text-[12px] mt-1" style={{ color: "var(--wn-t)" }}>
                        Note: {slot.opportunity.requirementsNote}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-medium" style={{ color: "var(--text-sec)" }}>
                      {slot._count.signups}/{slot.capacity}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--text-faint)" }}>spots</div>
                    <div className="mt-3">
                      {isSignedUp ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-[2px] font-semibold uppercase tracking-wide border" style={
                          isWaitlisted
                            ? { background: "var(--wn-bg)", color: "var(--wn-t)", borderColor: "var(--wn-b)" }
                            : { background: "var(--ok-bg)", color: "var(--ok-t)", borderColor: "var(--ok-b)" }
                        }>
                          {isWaitlisted ? "Waitlisted" : "Signed Up"}
                        </span>
                      ) : isFull ? (
                        <span className="text-[11px] px-2 py-0.5 border rounded-[2px] font-semibold" style={{ background: "var(--wn-bg)", color: "var(--wn-t)", borderColor: "var(--wn-b)" }}>
                          Join Waitlist →
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 border rounded-[2px] font-semibold" style={{ background: "var(--in-bg)", color: "var(--in-t)", borderColor: "var(--in-b)" }}>
                          View Details →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
