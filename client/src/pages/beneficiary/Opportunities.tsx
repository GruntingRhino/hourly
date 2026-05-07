import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import SearchableSelect from "../../components/SearchableSelect";
import {
  buildOpportunityCategoryOptions,
  splitOpportunityCategory,
} from "../../lib/opportunityCategories";

interface TimeSlotBasic {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number | null;
  recurringGroupId: string | null;
  _count?: { signups: number };
}

interface DeleteSlotResponse {
  success: boolean;
  cancelledSignupCount?: number;
}

interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  requirementsNote: string | null;
  schoolRestrictions: string | null;
  status: string;
  recurrenceRule: string | null;
  timeSlots: TimeSlotBasic[];
}

interface SignupRecord {
  id: string;
  status: string;
  verificationStatus: string;
  checkedIn: boolean;
  checkedOut: boolean;
  totalHours: number | null;
  rejectionReason: string | null;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    opportunity: { title: string };
  };
  student: { label: string };
}

interface ApprovedSchool {
  id: string;
  name: string;
}

interface VerificationHistoryEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: string };
}

interface SignupHistoryResponse {
  signup: {
    id: string;
    status: string;
    verificationStatus: string;
    totalHours: number | null;
    rejectionReason: string | null;
    student: { id?: string; label: string } | null;
    slot: {
      date: string;
      startTime: string;
      endTime: string;
      durationHours: number;
      opportunity: {
        title: string;
        category: string | null;
        beneficiary: { id: string; name: string; category: string | null };
      };
    };
  };
  history: VerificationHistoryEntry[];
}

function calcDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function parseTimeString(value: string): { hours: number; minutes: number } | null {
  const normalized = value.trim();
  const match12Hour = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12Hour) {
    const rawHours = Number(match12Hour[1]);
    const minutes = Number(match12Hour[2]);
    const meridiem = match12Hour[3].toUpperCase();
    let hours = rawHours % 12;
    if (meridiem === "PM") hours += 12;
    return { hours, minutes };
  }

  const match24Hour = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24Hour) {
    return { hours: Number(match24Hour[1]), minutes: Number(match24Hour[2]) };
  }

  return null;
}

function getSlotEndAt(date: string, endTime: string): Date {
  const parsed = parseTimeString(endTime);
  const endAt = new Date(date);
  if (!parsed) return endAt;
  endAt.setUTCHours(parsed.hours, parsed.minutes, 0, 0);
  return endAt;
}

function getDisplayStatus(timeSlots: TimeSlotBasic[]): string {
  if (!timeSlots.length) return "Active";
  const today = new Date().toISOString().split("T")[0];
  let allPast = true;
  let allFuture = true;
  for (const slot of timeSlots) {
    const slotDate = new Date(slot.date).toISOString().split("T")[0];
    if (slotDate > today) allPast = false;
    else if (slotDate < today) allFuture = false;
    else { allPast = false; allFuture = false; }
  }
  if (allPast) return "Expired";
  if (allFuture) return "Upcoming";
  return "Active";
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_LABELS = ["1st", "2nd", "3rd", "4th", "5th"];

const emptyForm = {
  title: "",
  category: "",
  customCategory: "",
  description: "",
  location: "",
  requirementsNote: "",
  slots: [{ date: "", startTime: "", endTime: "", capacity: "" }],
  recurring: false,
  recurrenceType: "monthly_day_of_week" as "monthly_day_of_week" | "monthly_dates",
  recurrenceDaysOfWeek: [1] as number[],
  recurrenceWeeksOfMonth: [1] as number[],
  recurrenceDatesOfMonth: [1] as number[],
  recurrenceStartTime: "",
  recurrenceEndTime: "",
  recurrenceCapacity: "10",
  recurrenceMonthsAhead: 6,
  recurrenceStartDate: "",
};

function formatApiErrorWithDetails(err: unknown, fallback: string): { message: string; details: string[] } {
  if (err instanceof ApiError) {
    const body = err.body as { error?: string; details?: Array<{ path?: Array<string | number>; message?: string }> } | null;
    const details = Array.isArray(body?.details)
      ? body.details.map(toReadableValidationMessage).filter(Boolean) as string[]
      : [];
    if (details.length > 0) {
      return { message: "Please fix the issues below.", details };
    }
    if (body?.error) return { message: body.error, details: [] };
  }
  if (err instanceof Error && err.message) return { message: err.message, details: [] };
  return { message: fallback, details: [] };
}

function toReadableValidationMessage(detail: { path?: Array<string | number>; message?: string }): string | null {
  const path = Array.isArray(detail.path) ? detail.path : [];
  const [root, index, field] = path;

  if (root === "title") return "Enter a title.";
  if (root === "category") return "Choose a category.";
  if (root === "customCategory") return "Enter a custom category.";
  if (root === "description") return "Description is too long.";
  if (root === "location") return "Location is too long.";
  if (root === "requirementsNote") return "Requirements / notes are too long.";
  if (root === "timeSlots" && typeof index !== "number") return "Add at least one time slot or switch to recurring schedule.";
  if (root === "timeSlots" && typeof index === "number") {
    const label = `Time slot ${index + 1}`;
    if (field === "date") return `${label}: choose a date.`;
    if (field === "startTime") return `${label}: choose a start time.`;
    if (field === "endTime") return `${label}: choose an end time.`;
    if (field === "capacity") return `${label}: enter a valid volunteer capacity.`;
    if (field === "durationHours") return `${label}: end time must be after start time.`;
  }
  if (root === "recurrenceRule") return "Recurring schedule details are incomplete or invalid.";
  if (detail.message === "Required") return "A required field is missing.";
  return detail.message ?? null;
}

function validateOpportunityForm(form: typeof emptyForm): string[] {
  const details: string[] = [];

  if (!form.title.trim()) details.push("Enter a title.");
  if (!form.category.trim()) details.push("Choose a category.");

  if (!form.recurring) {
    if (form.slots.length === 0) {
      details.push("Add at least one time slot.");
      return details;
    }

    form.slots.forEach((slot, index) => {
      const label = `Time slot ${index + 1}`;
      if (!slot.date) details.push(`${label}: choose a date.`);
      if (!slot.startTime) details.push(`${label}: choose a start time.`);
      if (!slot.endTime) details.push(`${label}: choose an end time.`);
      if (slot.startTime && slot.endTime && calcDurationHours(slot.startTime, slot.endTime) <= 0) {
        details.push(`${label}: end time must be after start time.`);
      }
      if (slot.capacity && (!Number.isInteger(Number(slot.capacity)) || Number(slot.capacity) <= 0)) {
        details.push(`${label}: enter a valid volunteer capacity.`);
      }
    });
  } else {
    if (!form.recurrenceStartDate) details.push("Recurring schedule: choose a start date.");
    if (!form.recurrenceStartTime) details.push("Recurring schedule: choose a start time.");
    if (!form.recurrenceEndTime) details.push("Recurring schedule: choose an end time.");
    if (form.recurrenceStartTime && form.recurrenceEndTime && calcDurationHours(form.recurrenceStartTime, form.recurrenceEndTime) <= 0) {
      details.push("Recurring schedule: end time must be after start time.");
    }
    if (!Number.isInteger(Number(form.recurrenceCapacity)) || Number(form.recurrenceCapacity) <= 0) {
      details.push("Recurring schedule: enter a valid volunteer capacity.");
    }
    if (form.recurrenceType === "monthly_day_of_week") {
      if (form.recurrenceDaysOfWeek.length === 0) details.push("Recurring schedule: choose at least one day of the week.");
      if (form.recurrenceWeeksOfMonth.length === 0) details.push("Recurring schedule: choose at least one week of the month.");
    } else if (form.recurrenceDatesOfMonth.length === 0) {
      details.push("Recurring schedule: choose at least one date of the month.");
    }
  }

  return details;
}

export default function BeneficiaryOpportunities() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"opportunities" | "signups">("opportunities");
  const [signupFilter, setSignupFilter] = useState<"PENDING" | "ALL" | "APPROVED" | "DENIED" | "NO_SHOW">("PENDING");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [signups, setSignups] = useState<SignupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ [id: string]: string }>({});
  const [approvalHours, setApprovalHours] = useState<{ [id: string]: string }>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>(["Active", "Upcoming"]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [noShowConfirmId, setNoShowConfirmId] = useState<string | null>(null);
  const [noShowId, setNoShowId] = useState<string | null>(null);
  const [historySignup, setHistorySignup] = useState<SignupHistoryResponse | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [approvedSchools, setApprovedSchools] = useState<ApprovedSchool[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);

  // Edit / delete state
  const [editOppId, setEditOppId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Slot edit modal state
  const [editSlot, setEditSlot] = useState<TimeSlotBasic | null>(null);
  const [slotForm, setSlotForm] = useState({ date: "", startTime: "", endTime: "", capacity: "" });
  const [propagateFuture, setPropagateFuture] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState(false);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState(false);

  const benId = user?.beneficiaryId;

  const clearError = () => {
    setError("");
    setErrorDetails([]);
  };

  const showError = (message: string, details: string[] = []) => {
    setError(message);
    setErrorDetails(details);
  };

  const loadOpportunities = async () => {
    if (!benId) return;
    setLoading(true);
    try {
      const data = await api.get<Opportunity[]>(`/beneficiaries/${benId}/opportunities`);
      setOpportunities(data);
    } catch {
      showError("Failed to load opportunities.");
    } finally {
      setLoading(false);
    }
  };

  const loadSignups = async () => {
    if (!benId) return;
    setSignupsLoading(true);
    try {
      const data = await api.get<SignupRecord[]>(`/beneficiaries/${benId}/signups`);
      setSignups(data);
    } catch {
      showError("Failed to load signups.");
    } finally {
      setSignupsLoading(false);
    }
  };

  const prefillLocation = () => {
    if (!benId) return;
    api.get<{ address?: string; city?: string; state?: string; zip?: string }>(`/beneficiaries/${benId}`)
      .then((ben) => {
        const parts = [ben.address, ben.city, ben.state, ben.zip].filter(Boolean);
        if (parts.length) setForm((p) => ({ ...p, location: parts.join(", ") }));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!benId) return;
    void loadOpportunities();
    prefillLocation();
    api.get<ApprovedSchool[]>(`/beneficiaries/${benId}/schools`)
      .then((schools) => {
        setApprovedSchools(schools);
        setSelectedSchools(schools.map((s) => s.id));
      })
      .catch(() => {});
  }, [benId]);

  useEffect(() => {
    if (tab === "signups") void loadSignups();
  }, [tab, benId]);

  const addSlot = () => setForm((p) => ({ ...p, slots: [...p.slots, { date: "", startTime: "", endTime: "", capacity: "" }] }));
  const updateSlot = (i: number, field: string, value: string) =>
    setForm((p) => ({ ...p, slots: p.slots.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }));
  const removeSlot = (i: number) => setForm((p) => ({ ...p, slots: p.slots.filter((_, idx) => idx !== i) }));
  const toggleSchool = (id: string) =>
    setSelectedSchools((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  const toggleAllSchools = () =>
    setSelectedSchools((prev) => prev.length === approvedSchools.length ? [] : approvedSchools.map((s) => s.id));
  const categoryOptions = buildOpportunityCategoryOptions(opportunities.map((opp) => opp.category));

  const handleEdit = (opp: Opportunity) => {
    setEditOppId(opp.id);
    const rule = opp.recurrenceRule ? (() => {
      try { return JSON.parse(opp.recurrenceRule!); } catch { return null; }
    })() : null;
    const { selectedCategory, customCategory } = splitOpportunityCategory(opp.category);
    setForm({
      ...emptyForm,
      title: opp.title,
      category: selectedCategory,
      customCategory,
      description: opp.description ?? "",
      location: opp.location ?? "",
      requirementsNote: opp.requirementsNote ?? "",
      slots: [{ date: "", startTime: "", endTime: "", capacity: "" }],
      recurring: !!rule,
      recurrenceType: rule?.type ?? emptyForm.recurrenceType,
      recurrenceDaysOfWeek: rule?.daysOfWeek ?? emptyForm.recurrenceDaysOfWeek,
      recurrenceWeeksOfMonth: rule?.weeksOfMonth ?? emptyForm.recurrenceWeeksOfMonth,
      recurrenceDatesOfMonth: rule?.datesOfMonth ?? emptyForm.recurrenceDatesOfMonth,
      recurrenceStartTime: rule?.startTime ?? emptyForm.recurrenceStartTime,
      recurrenceEndTime: rule?.endTime ?? emptyForm.recurrenceEndTime,
      recurrenceCapacity: rule?.capacity != null ? String(rule.capacity) : emptyForm.recurrenceCapacity,
      recurrenceMonthsAhead: rule?.monthsAhead ?? emptyForm.recurrenceMonthsAhead,
      recurrenceStartDate: new Date().toISOString().split("T")[0],
    });
    const restrictions: string[] = opp.schoolRestrictions ? JSON.parse(opp.schoolRestrictions) : approvedSchools.map((s) => s.id);
    setSelectedSchools(restrictions);
    clearError();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditOppId(null);
    setForm(emptyForm);
    setSelectedSchools(approvedSchools.map((s) => s.id));
    prefillLocation();
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!editOppId) {
      const validationDetails = validateOpportunityForm(form);
      if (validationDetails.length > 0) {
        showError("Please fix the issues below.", validationDetails);
        return;
      }
    }

    if (editOppId) {
      setSaving(true);
      try {
        const editBody: Record<string, unknown> = {
          title: form.title,
          category: form.category,
          customCategory: null,
          description: form.description,
          location: form.location || null,
          requirementsNote: form.requirementsNote || null,
          schoolRestrictions: selectedSchools.length > 0 ? selectedSchools : null,
        };
        if (form.recurring) {
          const dur = calcDurationHours(form.recurrenceStartTime, form.recurrenceEndTime);
          editBody.recurrenceRule = {
            type: form.recurrenceType,
            ...(form.recurrenceType === "monthly_day_of_week"
              ? { daysOfWeek: form.recurrenceDaysOfWeek, weeksOfMonth: form.recurrenceWeeksOfMonth }
              : { datesOfMonth: form.recurrenceDatesOfMonth }),
            startTime: form.recurrenceStartTime,
            endTime: form.recurrenceEndTime,
            durationHours: dur || 1,
            capacity: parseInt(form.recurrenceCapacity) || 10,
            monthsAhead: form.recurrenceMonthsAhead,
          };
        } else if (form.slots.some((s) => s.date && s.startTime && s.endTime)) {
          editBody.timeSlots = form.slots
            .filter((s) => s.date && s.startTime && s.endTime)
            .map((s) => ({
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              durationHours: calcDurationHours(s.startTime, s.endTime) || 1,
              capacity: s.capacity ? parseInt(s.capacity) : 10,
            }));
        }
        const updated = await api.patch<Opportunity>(`/beneficiaries/${benId}/opportunities/${editOppId}`, editBody);
        setOpportunities((prev) => prev.map((o) => o.id === editOppId ? updated : o));
        handleCancelEdit();
      } catch (err) {
        const formatted = formatApiErrorWithDetails(err, "Failed to save changes.");
        showError(formatted.message, formatted.details);
      } finally {
        setSaving(false);
      }
      return;
    }

    setCreating(true);
    try {
      const startDate = form.recurring
        ? (form.recurrenceStartDate || new Date().toISOString().split("T")[0])
        : (form.slots[0]?.date || new Date().toISOString().split("T")[0]);

      const body: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        customCategory: undefined,
        description: form.description,
        location: form.location || undefined,
        requirementsNote: form.requirementsNote || undefined,
        startDate,
        schoolRestrictions: selectedSchools.length > 0 ? selectedSchools : undefined,
      };

      if (form.recurring) {
        const dur = calcDurationHours(form.recurrenceStartTime, form.recurrenceEndTime);
        body.recurrenceRule = {
          type: form.recurrenceType,
          ...(form.recurrenceType === "monthly_day_of_week"
            ? { daysOfWeek: form.recurrenceDaysOfWeek, weeksOfMonth: form.recurrenceWeeksOfMonth }
            : { datesOfMonth: form.recurrenceDatesOfMonth }),
          startTime: form.recurrenceStartTime,
          endTime: form.recurrenceEndTime,
          durationHours: dur || 1,
          capacity: parseInt(form.recurrenceCapacity) || 10,
          monthsAhead: form.recurrenceMonthsAhead,
        };
      } else {
        body.timeSlots = form.slots.map((s) => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          durationHours: calcDurationHours(s.startTime, s.endTime) || 1,
          capacity: s.capacity ? parseInt(s.capacity) : 10,
        }));
      }

      await api.post(`/beneficiaries/${benId}/opportunities`, body);
      setForm(emptyForm);
      prefillLocation();
      setSelectedSchools(approvedSchools.map((s) => s.id));
      void loadOpportunities();
    } catch (err) {
      const formatted = formatApiErrorWithDetails(err, "Failed to create opportunity.");
      showError(formatted.message, formatted.details);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (oppId: string) => {
    setDeleting(true);
    clearError();
    try {
      await api.delete(`/beneficiaries/${benId}/opportunities/${oppId}`);
      setOpportunities((prev) => prev.filter((o) => o.id !== oppId));
      setDeleteConfirmId(null);
      if (editOppId === oppId) handleCancelEdit();
    } catch (err: any) {
      showError(err.message || "Failed to delete opportunity.");
      setDeleteConfirmId(null);
    } finally {
      setDeleting(false);
    }
  };

  const openEditSlot = (slot: TimeSlotBasic) => {
    setEditSlot(slot);
    setSlotForm({
      date: new Date(slot.date).toISOString().split("T")[0],
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: String(slot.capacity ?? 10),
    });
    setPropagateFuture(false);
    setConfirmDeleteSlot(false);
  };

  const slotChanged = editSlot
    ? slotForm.date !== new Date(editSlot.date).toISOString().split("T")[0] ||
      slotForm.startTime !== editSlot.startTime ||
      slotForm.endTime !== editSlot.endTime
    : false;

  const handleSaveSlot = async () => {
    if (!editSlot) return;
    setSavingSlot(true);
    clearError();
    try {
      const updated = await api.patch<TimeSlotBasic>(`/beneficiaries/slots/${editSlot.id}`, {
        date: slotForm.date,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        capacity: parseInt(slotForm.capacity) || editSlot.capacity,
        propagateFuture: propagateFuture && !!editSlot.recurringGroupId && slotChanged,
      });
      setOpportunities((prev) =>
        prev.map((opp) => ({
          ...opp,
          timeSlots: opp.timeSlots.map((s) => {
            if (s.id === editSlot.id) return { ...s, ...updated };
            if (
              propagateFuture &&
              editSlot.recurringGroupId &&
              s.recurringGroupId === editSlot.recurringGroupId
            ) {
              return { ...s, startTime: updated.startTime, endTime: updated.endTime };
            }
            return s;
          }),
        }))
      );
      setEditSlot(null);
      void loadOpportunities();
    } catch (err: any) {
      showError(err.message || "This time slot could not be updated.");
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (forceCancel = false) => {
    if (!editSlot || !benId) return;
    if (!forceCancel && (editSlot._count?.signups || 0) > 0) {
      setConfirmDeleteSlot(true);
      clearError();
      return;
    }
    setDeletingSlot(true);
    clearError();
    try {
      if (forceCancel) {
        await api.post<DeleteSlotResponse>(`/beneficiaries/${benId}/slots/${editSlot.id}/cancel`, { forceCancel: true });
      } else {
        await api.delete<DeleteSlotResponse>(`/beneficiaries/${benId}/slots/${editSlot.id}`);
      }
      setConfirmDeleteSlot(false);
      setEditSlot(null);
      void loadOpportunities();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { code?: string } | null;
        if (body?.code === "SLOT_HAS_SIGNUPS") {
          setConfirmDeleteSlot(true);
          return;
        }
      }
      showError(err instanceof Error ? err.message : "This time slot could not be deleted.");
    } finally {
      setDeletingSlot(false);
    }
  };

  const resolveApprovalHours = (signup: SignupRecord): number => {
    const raw = approvalHours[signup.id];
    const parsed = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : (signup.totalHours ?? signup.slot.durationHours);
  };

  const handleApprove = async (signup: SignupRecord) => {
    const hours = resolveApprovalHours(signup);
    setActionId(signup.id);
    try {
      await api.post(`/beneficiaries/signups/${signup.id}/approve`, { approvedHours: hours });
      await loadSignups();
    } catch (err: any) {
      showError(err.message || "Failed to approve.");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (signupId: string) => {
    const reason = rejectReason[signupId]?.trim();
    if (!reason) { showError("Please enter a reason for rejection."); return; }
    setRejectingId(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/reject`, { reason });
      await loadSignups();
      setRejectReason((prev) => ({ ...prev, [signupId]: "" }));
    } catch (err: any) {
      showError(err.message || "Failed to reject.");
    } finally {
      setRejectingId(null);
    }
  };

  const handleNoShow = async (signupId: string) => {
    setNoShowId(signupId);
    setNoShowConfirmId(null);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/no-show`, {});
      await loadSignups();
    } catch (err: any) {
      showError(err.message || "Failed to mark no-show.");
    } finally {
      setNoShowId(null);
    }
  };

  const handleResetReview = async (signupId: string) => {
    setActionId(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/reset-review`, {});
      await loadSignups();
    } catch (err: any) {
      showError(err.message || "Failed to reset review.");
    } finally {
      setActionId(null);
    }
  };

  const loadHistory = async (signupId: string) => {
    setHistoryLoadingId(signupId);
    clearError();
    try {
      const data = await api.get<SignupHistoryResponse>(`/beneficiaries/signups/${signupId}/history`);
      setHistorySignup(data);
    } catch (err: any) {
      showError(err.message || "Failed to load verification history.");
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const formatHistoryDetails = (raw: string | null) => {
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed).map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
    } catch {
      return raw;
    }
  };

  const getSignupBucket = (signup: SignupRecord): "PENDING" | "APPROVED" | "DENIED" | "NO_SHOW" | "OTHER" => {
    if (signup.status === "NO_SHOW") return "NO_SHOW";
    if (
      signup.status === "CONFIRMED" &&
      signup.verificationStatus === "PENDING" &&
      getSlotEndAt(signup.slot.date, signup.slot.endTime) <= new Date()
    ) {
      return "PENDING";
    }
    if (signup.verificationStatus === "APPROVED") return "APPROVED";
    if (signup.verificationStatus === "REJECTED") return "DENIED";
    return "OTHER";
  };

  const signupBuckets = {
    PENDING: signups.filter((s) => getSignupBucket(s) === "PENDING"),
    APPROVED: signups.filter((s) => getSignupBucket(s) === "APPROVED"),
    DENIED: signups.filter((s) => getSignupBucket(s) === "DENIED"),
    NO_SHOW: signups.filter((s) => getSignupBucket(s) === "NO_SHOW"),
  };
  const pendingSignups = signupBuckets.PENDING;
  const visibleReviewedSignups =
    signupFilter === "ALL"
      ? [...signupBuckets.APPROVED, ...signupBuckets.DENIED, ...signupBuckets.NO_SHOW]
      : signupFilter === "APPROVED"
      ? signupBuckets.APPROVED
      : signupFilter === "DENIED"
      ? signupBuckets.DENIED
      : signupFilter === "NO_SHOW"
      ? signupBuckets.NO_SHOW
      : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Opportunities</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        <button onClick={() => setTab("opportunities")}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === "opportunities" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Opportunities
        </button>
        <button onClick={() => setTab("signups")}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === "signups" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Student Signups
          {pendingSignups.length > 0 && tab !== "signups" && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">{pendingSignups.length}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">{error}</div>
          {errorDetails.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-red-700">
              {errorDetails.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Opportunities tab — two-panel layout */}
      {tab === "opportunities" && (
        <div className="flex gap-6 items-start">
          {/* Left panel: Create / Edit form */}
          <div className="w-[55%] flex-shrink-0 bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{editOppId ? "Edit Opportunity" : "Create New Opportunity"}</h2>
              {editOppId && (
                <button type="button" onClick={handleCancelEdit} className="text-xs text-gray-400 hover:text-gray-600">
                  Cancel edit
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <SearchableSelect
                  value={form.category}
                  onChange={(category) => setForm((p) => ({ ...p, category, customCategory: category }))}
                  options={categoryOptions}
                  placeholder="Search categories or type your own"
                  required
                  allowCustomValue
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Address or virtual" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requirements / Notes for Volunteers</label>
                <input type="text" value={form.requirementsNote} onChange={(e) => setForm((p) => ({ ...p, requirementsNote: e.target.value }))}
                  placeholder="e.g. Bring closed-toe shoes, minimum age 16"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              {/* Schedule — shown for both create and edit */}
              <div>
                  {/* Recurring toggle */}
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-sm font-medium text-gray-700">Schedule</label>
                    <div className="flex rounded-md overflow-hidden border border-gray-300 text-xs">
                      <button type="button"
                        onClick={() => setForm((p) => ({ ...p, recurring: false }))}
                        className={`px-3 py-1.5 ${!form.recurring ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                        Manual
                      </button>
                      <button type="button"
                        onClick={() => setForm((p) => ({ ...p, recurring: true }))}
                        className={`px-3 py-1.5 border-l border-gray-300 ${form.recurring ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                        Recurring
                      </button>
                    </div>
                  </div>

                  {!form.recurring ? (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Time Slots *</span>
                        <button type="button" onClick={addSlot} className="text-xs text-blue-600 hover:underline">+ Add slot</button>
                      </div>
                      <div className="space-y-2">
                        {form.slots.map((slot, i) => (
                          <div key={i} className="grid grid-cols-5 gap-2 items-center">
                            <input type="date" value={slot.date} onChange={(e) => updateSlot(i, "date", e.target.value)}
                              required className="px-2 py-1.5 border border-gray-300 rounded text-sm col-span-2" />
                            <input type="time" value={slot.startTime} onChange={(e) => updateSlot(i, "startTime", e.target.value)}
                              required className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                            <input type="time" value={slot.endTime} onChange={(e) => updateSlot(i, "endTime", e.target.value)}
                              required className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                            <div className="flex gap-1 items-center">
                              <input type="number" value={slot.capacity} onChange={(e) => updateSlot(i, "capacity", e.target.value)}
                                placeholder="Max #" min={1} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                title="Maximum # Volunteers" />
                              {form.slots.length > 1 && (
                                <button type="button" onClick={() => removeSlot(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                      {/* Recurrence type */}
                      <div className="flex gap-4 text-sm">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={form.recurrenceType === "monthly_day_of_week"}
                            onChange={() => setForm((p) => ({ ...p, recurrenceType: "monthly_day_of_week" }))} />
                          <span>Day of week</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={form.recurrenceType === "monthly_dates"}
                            onChange={() => setForm((p) => ({ ...p, recurrenceType: "monthly_dates" }))} />
                          <span>Specific dates</span>
                        </label>
                      </div>

                      {form.recurrenceType === "monthly_day_of_week" ? (
                        <div className="space-y-2">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Days of week</div>
                            <div className="flex flex-wrap gap-1">
                              {DAY_NAMES.map((name, idx) => {
                                const active = form.recurrenceDaysOfWeek.includes(idx);
                                return (
                                  <button key={idx} type="button"
                                    onClick={() => setForm((p) => ({
                                      ...p,
                                      recurrenceDaysOfWeek: active
                                        ? p.recurrenceDaysOfWeek.filter((d) => d !== idx)
                                        : [...p.recurrenceDaysOfWeek, idx].sort(),
                                    }))}
                                    className={`px-2 py-1 text-xs rounded border ${active ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                                    {name.slice(0, 3)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Which weeks of the month</div>
                            <div className="flex gap-1">
                              {WEEK_LABELS.map((label, idx) => {
                                const week = idx + 1;
                                const active = form.recurrenceWeeksOfMonth.includes(week);
                                return (
                                  <button key={week} type="button"
                                    onClick={() => setForm((p) => ({
                                      ...p,
                                      recurrenceWeeksOfMonth: active
                                        ? p.recurrenceWeeksOfMonth.filter((w) => w !== week)
                                        : [...p.recurrenceWeeksOfMonth, week].sort(),
                                    }))}
                                    className={`px-2 py-1 text-xs rounded border ${active ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Dates of the month</div>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                              const active = form.recurrenceDatesOfMonth.includes(d);
                              return (
                                <button key={d} type="button"
                                  onClick={() => setForm((p) => ({
                                    ...p,
                                    recurrenceDatesOfMonth: active
                                      ? p.recurrenceDatesOfMonth.filter((x) => x !== d)
                                      : [...p.recurrenceDatesOfMonth, d].sort((a, b) => a - b),
                                  }))}
                                  className={`w-8 h-8 text-xs rounded border ${active ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Time & capacity */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Start time</div>
                          <input type="time" value={form.recurrenceStartTime}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceStartTime: e.target.value }))}
                            required className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">End time</div>
                          <input type="time" value={form.recurrenceEndTime}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceEndTime: e.target.value }))}
                            required className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Max volunteers</div>
                          <input type="number" min={1} value={form.recurrenceCapacity}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceCapacity: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                        </div>
                      </div>

                      {/* Start date + months ahead */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Starting from</div>
                          <input type="date" value={form.recurrenceStartDate}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceStartDate: e.target.value }))}
                            required className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Generate for</div>
                          <select value={form.recurrenceMonthsAhead}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceMonthsAhead: parseInt(e.target.value) }))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                            {[1,2,3,4,5,6,9,12].map((m) => (
                              <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              {editOppId && !form.recurring && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                  Existing slots can be edited using the pencil icon on each slot. Add new slots above.
                </div>
              )}
              {editOppId && form.recurring && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                  Saving will replace all future unbooked slots with a new schedule. Slots with sign-ups are kept.
                </div>
              )}

              {/* Schools panel */}
              <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Schools that can participate</div>
                {approvedSchools.length === 0 ? (
                  <p className="text-xs text-gray-400">No schools have approved this beneficiary yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedSchools.length === approvedSchools.length}
                        onChange={toggleAllSchools} className="h-4 w-4 rounded border-gray-300" />
                      <span className="font-medium text-gray-700">All schools</span>
                    </label>
                    <div className="ml-1 space-y-1">
                      {approvedSchools.map((school) => (
                        <label key={school.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={selectedSchools.includes(school.id)}
                            onChange={() => toggleSchool(school.id)} className="h-4 w-4 rounded border-gray-300" />
                          <span className="text-gray-600">{school.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" disabled={creating || saving}
                className="w-full px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm hover:opacity-85 disabled:opacity-50">
                {editOppId
                  ? (saving ? "Saving..." : "Save Changes")
                  : (creating ? "Creating..." : "Create Opportunity")}
              </button>
            </form>
          </div>

          {/* Right panel: Opportunities list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Created Opportunities</h2>
              <div className="relative">
                <button onClick={() => setFilterOpen((p) => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border ${visibleStatuses.length < 3 ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Filter
                  {visibleStatuses.length < 3 && (
                    <span className="bg-white text-gray-900 rounded-full px-1.5 font-semibold">{visibleStatuses.length}</span>
                  )}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3 space-y-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Show</div>
                    {(["Active", "Upcoming", "Expired"] as const).map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={visibleStatuses.includes(status)}
                          onChange={() => setVisibleStatuses((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status])}
                          className="h-4 w-4 rounded border-gray-300" />
                        <span className={status === "Active" ? "text-green-700" : status === "Upcoming" ? "text-blue-700" : "text-gray-500"}>{status}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-gray-500 text-sm">Loading...</div>
            ) : opportunities.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">No opportunities yet.</div>
            ) : (() => {
              const statusOrder: Record<string, number> = { Active: 0, Upcoming: 1, Expired: 2 };
              const sorted = [...opportunities]
                .map((opp) => ({ opp, displayStatus: getDisplayStatus(opp.timeSlots) }))
                .filter(({ displayStatus }) => visibleStatuses.includes(displayStatus))
                .sort((a, b) => (statusOrder[a.displayStatus] ?? 3) - (statusOrder[b.displayStatus] ?? 3));

              return sorted.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">No opportunities match the current filter.</div>
              ) : (
                <div className="space-y-3">
                  {sorted.map(({ opp, displayStatus }) => (
                    <div key={opp.id} className={`bg-white border rounded-lg p-4 ${editOppId === opp.id ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm">{opp.title}</div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${displayStatus === "Active" ? "bg-green-50 text-green-700" : displayStatus === "Upcoming" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {displayStatus}
                          </span>
                          <button onClick={() => handleEdit(opp)}
                            className="text-xs text-blue-600 hover:underline">
                            Edit
                          </button>
                          {deleteConfirmId === opp.id ? (
                            <span className="flex items-center gap-1 text-xs">
                              <button onClick={() => handleDelete(opp.id)} disabled={deleting}
                                className="text-red-600 hover:underline disabled:opacity-50">
                                {deleting ? "..." : "Confirm"}
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(opp.id)}
                              className="text-xs text-red-400 hover:text-red-600">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      {opp.location && <div className="text-xs text-gray-500">{opp.location}</div>}
                      {opp.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{opp.description}</div>}
                      {opp.timeSlots.length > 0 && (
                        <div className="mt-2 border-t pt-2 space-y-1">
                          {opp.timeSlots.map((slot) => {
                            const slotDate = new Date(slot.date);
                            const isEditable = slotDate.getTime() > Date.now() + 24 * 60 * 60 * 1000;
                            return (
                              <div key={slot.id} className="flex justify-between items-center text-xs text-gray-600">
                                <span className="flex items-center gap-1.5">
                                  {slot.recurringGroupId && (
                                    <span title="Recurring" className="text-blue-400">↻</span>
                                  )}
                                  {slotDate.toLocaleDateString(undefined, { timeZone: "UTC" })} · {slot.startTime}–{slot.endTime}
                                  {isEditable && (
                                    <button type="button" onClick={() => openEditSlot(slot)}
                                      className="text-gray-300 hover:text-blue-500 ml-0.5" title="Edit slot">
                                      ✎
                                    </button>
                                  )}
                                </span>
                                <span className="text-gray-400">{slot._count?.signups || 0}{slot.capacity ? `/${slot.capacity}` : ""} signed up</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Signups tab */}
      {tab === "signups" && (
        <div>
          {signupsLoading ? (
            <div className="text-gray-500 text-sm">Loading signups...</div>
          ) : signups.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">No student signups yet.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-500">Show pending by default, or switch to a specific reviewed status.</div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["PENDING", "Pending"],
                    ["ALL", "Show everything"],
                    ["NO_SHOW", "No-Show"],
                    ["DENIED", "Denied"],
                    ["APPROVED", "Approved"],
                  ] as const).map(([value, label]) => {
                    const active = signupFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSignupFilter(value)}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                          active
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                            active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-gray-300 bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(signupFilter === "PENDING" || signupFilter === "ALL") && pendingSignups.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending Review ({pendingSignups.length})</h2>
                  <div className="space-y-3">
                    {pendingSignups.map((s) => (
                      <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="font-medium text-sm">{s.student.label}</div>
                            <div className="text-xs text-gray-400">Student identity is hidden for school privacy compliance.</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {s.slot.opportunity.title} · {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} {s.slot.startTime}–{s.slot.endTime}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Duration: {s.slot.durationHours}h
                              {s.checkedIn && s.checkedOut ? " · Attended" : s.checkedIn ? " · Checked in" : " · Not checked in"}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0 min-w-[120px]">
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={0.25}
                                step={0.25}
                                value={approvalHours[s.id] ?? String(s.totalHours ?? s.slot.durationHours)}
                                onChange={(e) => setApprovalHours((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                              <button onClick={() => handleApprove(s)}
                                disabled={actionId === s.id}
                                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                                {actionId === s.id ? "..." : "Approve"}
                              </button>
                            </div>
                            <div className="flex gap-1">
                              <input type="text" value={rejectReason[s.id] || ""}
                                onChange={(e) => setRejectReason((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                placeholder="Reason..."
                                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs" />
                              <button onClick={() => handleReject(s.id)} disabled={rejectingId === s.id}
                                className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100 disabled:opacity-50">
                                {rejectingId === s.id ? "..." : "Reject"}
                              </button>
                            </div>
                            <button onClick={() => setNoShowConfirmId(s.id)} disabled={noShowId === s.id}
                              className="px-2 py-1 text-gray-500 border border-gray-200 rounded text-xs hover:bg-gray-50 disabled:opacity-50">
                              {noShowId === s.id ? "..." : "No-Show"}
                            </button>
                            <button onClick={() => loadHistory(s.id)} disabled={historyLoadingId === s.id}
                              className="px-2 py-1 text-gray-500 border border-gray-200 rounded text-xs hover:bg-gray-50 disabled:opacity-50">
                              {historyLoadingId === s.id ? "..." : "History"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(signupFilter === "ALL" || signupFilter === "APPROVED" || signupFilter === "DENIED" || signupFilter === "NO_SHOW") && visibleReviewedSignups.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    {signupFilter === "ALL"
                      ? `Reviewed (${visibleReviewedSignups.length})`
                      : signupFilter === "APPROVED"
                      ? `Approved (${visibleReviewedSignups.length})`
                      : signupFilter === "DENIED"
                      ? `Denied (${visibleReviewedSignups.length})`
                      : `No-Show (${visibleReviewedSignups.length})`}
                  </h2>
                  <div className="space-y-2">
                      {visibleReviewedSignups.map((s) => (
                        <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium text-sm">{s.student.label}</div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "NO_SHOW" ? "bg-gray-100 text-gray-600" : s.verificationStatus === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                                  {s.status === "NO_SHOW" ? "No-Show" : s.verificationStatus === "REJECTED" ? "Denied" : s.verificationStatus}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {s.slot.opportunity.title} · {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {s.totalHours ?? s.slot.durationHours}h
                              </div>
                              {s.rejectionReason && <div className="text-xs text-red-500 mt-1 italic">{s.rejectionReason}</div>}
                            </div>

                            <div className="w-full lg:w-[420px] space-y-2">
                              <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-2">Change decision</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    min={0.25}
                                    step={0.25}
                                    value={approvalHours[s.id] ?? String(s.totalHours ?? s.slot.durationHours)}
                                    onChange={(e) => setApprovalHours((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                                  />
                                  <button onClick={() => handleApprove(s)} disabled={actionId === s.id}
                                    className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs hover:bg-green-100 disabled:opacity-50">
                                    {actionId === s.id ? "..." : "Approve"}
                                  </button>
                                  <button onClick={() => handleResetReview(s.id)} disabled={actionId === s.id}
                                    className="px-2.5 py-1 text-amber-700 border border-amber-200 rounded text-xs hover:bg-amber-50 disabled:opacity-50">
                                    {actionId === s.id ? "..." : "Undo"}
                                  </button>
                                  <button onClick={() => loadHistory(s.id)} disabled={historyLoadingId === s.id}
                                    className="px-2.5 py-1 text-gray-600 border border-gray-200 rounded text-xs hover:bg-white disabled:opacity-50">
                                    {historyLoadingId === s.id ? "..." : "History"}
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-md border border-red-100 bg-red-50/50 p-2">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-red-500 mb-2">Override outcome</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input type="text" value={rejectReason[s.id] || ""}
                                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                    placeholder="Reason for denial"
                                    className="flex-1 min-w-[150px] px-2 py-1 border border-red-200 rounded text-xs bg-white" />
                                  <button onClick={() => handleReject(s.id)} disabled={rejectingId === s.id}
                                    className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100 disabled:opacity-50">
                                    {rejectingId === s.id ? "..." : "Deny"}
                                  </button>
                                  <button onClick={() => setNoShowConfirmId(s.id)} disabled={noShowId === s.id}
                                    className="px-2.5 py-1 text-gray-600 border border-gray-200 rounded text-xs hover:bg-white disabled:opacity-50">
                                    {noShowId === s.id ? "..." : "Mark No-Show"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Slot edit modal */}
      {editSlot && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Edit Time Slot</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleDeleteSlot(confirmDeleteSlot)}
                  disabled={deletingSlot || savingSlot}
                  title="Delete time slot"
                  className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1 rounded"
                >
                  {deletingSlot ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m-4 0h10"/>
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditSlot(null);
                    setConfirmDeleteSlot(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
            {confirmDeleteSlot && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                This slot has {editSlot._count?.signups || 0} signup{(editSlot._count?.signups || 0) === 1 ? "" : "s"}. Delete again to cancel the slot, remove those signups, and notify affected students automatically.
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={slotForm.date}
                  onChange={(e) => setSlotForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start time</label>
                  <input type="time" value={slotForm.startTime}
                    onChange={(e) => setSlotForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End time</label>
                  <input type="time" value={slotForm.endTime}
                    onChange={(e) => setSlotForm((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max volunteers</label>
                <input type="number" min={1} value={slotForm.capacity}
                  onChange={(e) => setSlotForm((p) => ({ ...p, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>

              {/* Propagate checkbox — only for recurring slots with date/time change */}
              {editSlot.recurringGroupId && slotChanged && (
                <label className="flex items-start gap-2 cursor-pointer p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <input type="checkbox" checked={propagateFuture}
                    onChange={(e) => setPropagateFuture(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                  <span className="text-xs text-blue-800">
                    Apply this date/time change to all future slots in this recurring series
                  </span>
                </label>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveSlot} disabled={savingSlot}
                className="flex-1 px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm hover:opacity-85 disabled:opacity-50">
                {savingSlot ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditSlot(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No-show confirmation modal */}
      {noShowConfirmId && (() => {
        const signup = signups.find((s) => s.id === noShowConfirmId);
        if (!signup) return null;
        return (
          <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Mark as No-Show?</h3>
              <p className="text-sm text-gray-600 mb-1">
                <strong>{signup.student.label}</strong> will be marked as a no-show for:
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {signup.slot.opportunity.title} · {new Date(signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })}
              </p>
              <p className="text-xs text-gray-400 mb-5">This cannot be undone. The student's hours will not be counted.</p>
              <div className="flex gap-3">
                <button onClick={() => handleNoShow(noShowConfirmId)}
                  className="flex-1 px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm hover:opacity-85">
                  Confirm No-Show
                </button>
                <button onClick={() => setNoShowConfirmId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Verification history modal */}
      {historySignup && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-gray-200 max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-900">Verification History</div>
                <div className="text-sm text-gray-500 mt-1">
                  {(historySignup.signup.student?.label || "Anonymous volunteer")} · {historySignup.signup.slot.opportunity.title}
                </div>
              </div>
              <button onClick={() => setHistorySignup(null)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
            </div>
            <div className="px-5 py-4 border-b border-gray-100 text-sm text-gray-600">
              <div>{new Date(historySignup.signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {historySignup.signup.slot.startTime}–{historySignup.signup.slot.endTime} · {historySignup.signup.totalHours ?? historySignup.signup.slot.durationHours}h</div>
              <div className="mt-1">Current status: <strong>{historySignup.signup.status === "NO_SHOW" ? "No-Show" : historySignup.signup.verificationStatus}</strong></div>
              {historySignup.signup.rejectionReason && <div className="mt-1 text-red-600">Reason: {historySignup.signup.rejectionReason}</div>}
            </div>
            <div className="p-5 overflow-y-auto max-h-[55vh] space-y-3">
              {historySignup.history.length === 0 ? (
                <div className="text-sm text-gray-500">No audit events recorded yet.</div>
              ) : (
                historySignup.history.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.action}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{entry.actor.name} · {entry.actor.role}</div>
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    {formatHistoryDetails(entry.details) && (
                      <div className="text-xs text-gray-600 mt-2">{formatHistoryDetails(entry.details)}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
