import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { formatAuditDetails } from "../../lib/auditDetails";
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

interface AttachmentMeta {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  requirementsNote: string | null;
  preparationNotes: string | null;
  arrivalInstructions: string | null;
  contactInfo: string | null;
  requiredFormUrl: string | null;
  requiredFormName: string | null;
  requiredFormIsRequired: boolean;
  schoolRestrictions: string | null;
  status: string;
  recurrenceRule: string | null;
  timeSlots: TimeSlotBasic[];
  attachments: AttachmentMeta[];
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
    opportunity: { id: string; title: string };
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
  preparationNotes: "",
  arrivalInstructions: "",
  contactInfo: "",
  requiredFormUrl: "",
  requiredFormName: "",
  requiredFormIsRequired: false,
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

export default function BeneficiaryOpportunities({ overrideBenId }: { overrideBenId?: string } = {}) {
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
  const [checklist, setChecklist] = useState<{ opportunity: { id: string; title: string }; slot: { date: string; startTime: string; endTime: string }; records: Array<{ signupId: string; name: string; attendance: string | null }> } | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [approvedSchools, setApprovedSchools] = useState<ApprovedSchool[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);

  // File attachment state
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);

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

  const benId = overrideBenId ?? user?.beneficiaryId;

  const openChecklist = async (signup: SignupRecord) => {
    if (!benId) return;
    try { setChecklist(await api.get(`/beneficiaries/${benId}/opportunities/${signup.slot.opportunity.id}/attendance-checklist?slotId=${signup.slot.id}`)); }
    catch (err: any) { setError(err.message || "Unable to load attendance checklist."); }
  };

  const saveChecklist = async () => {
    if (!benId || !checklist) return;
    setAttendanceSaving(true);
    try {
      await api.post(`/beneficiaries/${benId}/opportunities/${checklist.opportunity.id}/attendance`, {
        records: checklist.records
          .filter((record) => record.attendance === "ATTENDED" || record.attendance === "NO_SHOW")
          .map(({ signupId, attendance }) => ({ signupId, attendance })),
      });
      setChecklist(null);
      await loadSignups();
    } catch (err: any) {
      setError(err.message || "Unable to save attendance.");
    } finally {
      setAttendanceSaving(false);
    }
  };

  const clearError = () => {
    setError("");
    setErrorDetails([]);
  };

  const validateFiles = (files: File[]): string | null => {
    if (files.length > 5) return "Maximum 5 files per upload.";
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) return `"${f.name}" exceeds the 10 MB per-file limit.`;
    }
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > 25 * 1024 * 1024) return "Total file size exceeds 25 MB.";
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const merged = [...attachmentFiles, ...picked].slice(0, 5);
    const err = validateFiles(merged);
    if (err) { showError(err); return; }
    setAttachmentFiles(merged);
    e.target.value = "";
  };

  const removeQueuedFile = (idx: number) =>
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDeleteAttachment = async (opp: Opportunity, attachmentId: string) => {
    if (!benId) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await api.delete(`/beneficiaries/${benId}/opportunities/${opp.id}/attachments/${attachmentId}`);
      setOpportunities((prev) =>
        prev.map((o) => o.id === opp.id
          ? { ...o, attachments: o.attachments.filter((a) => a.id !== attachmentId) }
          : o
        )
      );
    } catch (err: any) {
      showError(err.message || "Failed to delete attachment.");
    } finally {
      setDeletingAttachmentId(null);
    }
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
      preparationNotes: opp.preparationNotes ?? "",
      arrivalInstructions: opp.arrivalInstructions ?? "",
      contactInfo: opp.contactInfo ?? "",
      requiredFormUrl: opp.requiredFormUrl ?? "",
      requiredFormName: opp.requiredFormName ?? "",
      requiredFormIsRequired: opp.requiredFormIsRequired,
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
    setAttachmentFiles([]);
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
          preparationNotes: form.preparationNotes || null,
          arrivalInstructions: form.arrivalInstructions || null,
          contactInfo: form.contactInfo || null,
          requiredFormUrl: form.requiredFormUrl || null,
          requiredFormName: form.requiredFormName || null,
          requiredFormIsRequired: form.requiredFormIsRequired,
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
        preparationNotes: form.preparationNotes || undefined,
        arrivalInstructions: form.arrivalInstructions || undefined,
        contactInfo: form.contactInfo || undefined,
        requiredFormUrl: form.requiredFormUrl || undefined,
        requiredFormName: form.requiredFormName || undefined,
        requiredFormIsRequired: form.requiredFormIsRequired,
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

      const created = await api.post<{ id: string }>(`/beneficiaries/${benId}/opportunities`, body);
      if (attachmentFiles.length > 0) {
        const fd = new FormData();
        for (const f of attachmentFiles) fd.append("files", f);
        try {
          await api.post(`/beneficiaries/${benId}/opportunities/${created.id}/attachments`, fd);
        } catch (uploadErr: any) {
          showError(uploadErr.message || "Opportunity created, but file upload failed.");
        }
      }
      setForm(emptyForm);
      setAttachmentFiles([]);
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

  const formatHistoryDetails = formatAuditDetails;

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
        <h1 className="text-[20px] font-semibold">Opportunities</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        <button onClick={() => setTab("opportunities")}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === "opportunities" ? "border-blue-600 text-[var(--action)]" : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"}`}>
          Opportunities
        </button>
        <button onClick={() => setTab("signups")}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === "signups" ? "border-blue-600 text-[var(--action)]" : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"}`}>
          Student Signups
          {pendingSignups.length > 0 && tab !== "signups" && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-[var(--wn-bg)] text-[var(--wn-t)] rounded-full">{pendingSignups.length}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-[3px] border border-[var(--er-b)] bg-[var(--er-bg)] px-4 py-3 text-sm text-red-800">
          <div className="font-medium">{error}</div>
          {errorDetails.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--er-t)]">
              {errorDetails.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Opportunities tab — two-panel layout */}
      {tab === "opportunities" && (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {/* Left panel: Create / Edit form */}
          <div className="w-full min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4 sm:p-5 xl:w-[55%] xl:flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{editOppId ? "Edit Opportunity" : "Create New Opportunity"}</h2>
              {editOppId && (
                <button type="button" onClick={handleCancelEdit} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-sec)]">
                  Cancel edit
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Category *</label>
                <SearchableSelect
                  value={form.category}
                  onChange={(category) => setForm((p) => ({ ...p, category, customCategory: category }))}
                  options={categoryOptions}
                  placeholder="Search categories or type your own"
                  required
                  allowCustomValue
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Address or virtual" className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Requirements / Notes for Volunteers</label>
                <input type="text" value={form.requirementsNote} onChange={(e) => setForm((p) => ({ ...p, requirementsNote: e.target.value }))}
                  placeholder="e.g. Bring closed-toe shoes, minimum age 16"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>

              <fieldset className="space-y-3 border border-[var(--border)] rounded-[3px] p-3">
                <legend className="px-1 text-sm font-medium text-[var(--text)]">Pro reminder content</legend>
                <p className="text-xs text-[var(--text-faint)]">These fields require GoodHours Pro and are included only in Pro reminder emails.</p>
                <textarea value={form.preparationNotes} onChange={(e) => setForm((p) => ({ ...p, preparationNotes: e.target.value }))}
                  rows={2} placeholder="Preparation notes" aria-label="Preparation notes"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                <textarea value={form.arrivalInstructions} onChange={(e) => setForm((p) => ({ ...p, arrivalInstructions: e.target.value }))}
                  rows={2} placeholder="Arrival and parking instructions" aria-label="Arrival instructions"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                <input type="text" value={form.contactInfo} onChange={(e) => setForm((p) => ({ ...p, contactInfo: e.target.value }))}
                  placeholder="On-site contact name and phone" aria-label="On-site contact"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="url" value={form.requiredFormUrl} onChange={(e) => setForm((p) => ({ ...p, requiredFormUrl: e.target.value }))}
                    placeholder="Required form URL" aria-label="Required form URL"
                    className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                  <input type="text" value={form.requiredFormName} onChange={(e) => setForm((p) => ({ ...p, requiredFormName: e.target.value }))}
                    placeholder="Form name" aria-label="Required form name"
                    className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--text-sec)]">
                  <input type="checkbox" checked={form.requiredFormIsRequired} onChange={(e) => setForm((p) => ({ ...p, requiredFormIsRequired: e.target.checked }))} />
                  Remind volunteers that this form is required
                </label>
              </fieldset>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">
                  Attachments <span className="text-[var(--text-faint)] font-normal text-xs">(optional · up to 5 files · 10 MB each · 25 MB total)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer w-fit px-3 py-1.5 border border-dashed border-[var(--border-s)] rounded-[2px] text-sm text-[var(--text-sec)] hover:bg-[var(--surface-alt)] transition-colors">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                  </svg>
                  Attach files
                  <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*" className="hidden" onChange={handleFileChange} disabled={attachmentFiles.length >= 5} />
                </label>
                {attachmentFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {attachmentFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-sec)]">
                        <svg className="w-3.5 h-3.5 shrink-0 text-[var(--text-faint)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span className="truncate max-w-[200px]">{f.name}</span>
                        <span className="text-[var(--text-faint)]">({(f.size / 1024).toFixed(0)} KB)</span>
                        <button type="button" onClick={() => removeQueuedFile(i)} className="text-red-400 hover:text-[var(--er-t)] ml-auto">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Schedule — shown for both create and edit */}
              <div>
                  {/* Recurring toggle */}
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-sm font-medium text-[var(--text)]">Schedule</label>
                    <div className="flex rounded-[2px] overflow-hidden border border-[var(--border-s)] text-xs">
                      <button type="button"
                        onClick={() => setForm((p) => ({ ...p, recurring: false }))}
                        className={`px-3 py-1.5 ${!form.recurring ? "bg-[var(--action)] text-white" : "bg-[var(--surface)] text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}>
                        Manual
                      </button>
                      <button type="button"
                        onClick={() => setForm((p) => ({ ...p, recurring: true }))}
                        className={`px-3 py-1.5 border-l border-[var(--border-s)] ${form.recurring ? "bg-[var(--action)] text-white" : "bg-[var(--surface)] text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}>
                        Recurring
                      </button>
                    </div>
                  </div>

                  {!form.recurring ? (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-[var(--text-sec)]">Time Slots *</span>
                        <button type="button" onClick={addSlot} className="text-xs text-[var(--action)] hover:underline">+ Add slot</button>
                      </div>
                      <div className="space-y-2">
                        {form.slots.map((slot, i) => (
                          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:items-center">
                            <input type="date" value={slot.date} onChange={(e) => updateSlot(i, "date", e.target.value)}
                              required className="px-2 py-1.5 border border-[var(--border-s)] rounded text-sm sm:col-span-2 lg:col-span-2" />
                            <input type="time" value={slot.startTime} onChange={(e) => updateSlot(i, "startTime", e.target.value)}
                              required className="px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                            <input type="time" value={slot.endTime} onChange={(e) => updateSlot(i, "endTime", e.target.value)}
                              required className="px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                            <div className="flex gap-1 items-center sm:col-span-2 lg:col-span-1">
                              <input type="number" value={slot.capacity} onChange={(e) => updateSlot(i, "capacity", e.target.value)}
                                placeholder="Max volunteers" min={1} className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm"
                                title="Maximum volunteers" />
                              {form.slots.length > 1 && (
                                <button type="button" onClick={() => removeSlot(i)} className="text-red-400 hover:text-[var(--er-t)] text-xs">✕</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-[var(--in-bg)]/50 border border-blue-100 rounded-[3px] p-3">
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
                            <div className="text-xs text-[var(--text-sec)] mb-1">Days of week</div>
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
                                    className={`px-2 py-1 text-xs rounded border ${active ? "bg-[var(--action)] text-white border-blue-600" : "border-[var(--border-s)] text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}>
                                    {name.slice(0, 3)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-[var(--text-sec)] mb-1">Which weeks of the month</div>
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
                                    className={`px-2 py-1 text-xs rounded border ${active ? "bg-[var(--action)] text-white border-blue-600" : "border-[var(--border-s)] text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}>
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs text-[var(--text-sec)] mb-1">Dates of the month</div>
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
                                  className={`w-8 h-8 text-xs rounded border ${active ? "bg-[var(--action)] text-white border-blue-600" : "border-[var(--border-s)] text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}>
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Time & capacity */}
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div>
                          <div className="text-xs text-[var(--text-sec)] mb-1">Start time</div>
                          <input type="time" value={form.recurrenceStartTime}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceStartTime: e.target.value }))}
                            required className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                        </div>
                        <div>
                          <div className="text-xs text-[var(--text-sec)] mb-1">End time</div>
                          <input type="time" value={form.recurrenceEndTime}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceEndTime: e.target.value }))}
                            required className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                        </div>
                        <div>
                          <div className="text-xs text-[var(--text-sec)] mb-1">Max volunteers</div>
                          <input type="number" min={1} value={form.recurrenceCapacity}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceCapacity: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                        </div>
                      </div>

                      {/* Start date + months ahead */}
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div>
                          <div className="text-xs text-[var(--text-sec)] mb-1">Starting from</div>
                          <input type="date" value={form.recurrenceStartDate}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceStartDate: e.target.value }))}
                            required className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                        </div>
                        <div>
                          <div className="text-xs text-[var(--text-sec)] mb-1">Generate for</div>
                          <select value={form.recurrenceMonthsAhead}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceMonthsAhead: parseInt(e.target.value) }))}
                            className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm">
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
                <div className="text-xs text-[var(--text-faint)] bg-[var(--surface-alt)] rounded px-3 py-2">
                  Existing slots can be edited using the pencil icon on each slot. Add new slots above.
                </div>
              )}
              {editOppId && form.recurring && (
                <div className="text-xs text-[var(--wn-t)] bg-[var(--wn-bg)] border border-amber-100 rounded px-3 py-2">
                  Saving will replace all future unbooked slots with a new schedule. Slots with sign-ups are kept.
                </div>
              )}

              {/* Schools panel */}
              <div className="border-t pt-4">
                <div className="text-sm font-medium text-[var(--text)] mb-2">Schools that can participate</div>
                {approvedSchools.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)]">No schools have approved this beneficiary yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedSchools.length === approvedSchools.length}
                        onChange={toggleAllSchools} className="h-4 w-4 rounded border-[var(--border-s)]" />
                      <span className="font-medium text-[var(--text)]">All schools</span>
                    </label>
                    <div className="ml-1 space-y-1">
                      {approvedSchools.map((school) => (
                        <label key={school.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={selectedSchools.includes(school.id)}
                            onChange={() => toggleSchool(school.id)} className="h-4 w-4 rounded border-[var(--border-s)]" />
                          <span className="text-[var(--text-sec)]">{school.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" disabled={creating || saving}
                className="w-full px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm hover:opacity-85 disabled:opacity-50">
                {editOppId
                  ? (saving ? "Saving..." : "Save Changes")
                  : (creating ? "Creating..." : "Create Opportunity")}
              </button>
            </form>
          </div>

          {/* Right panel: Opportunities list */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold text-[var(--text)]">Created Opportunities</h2>
              <div className="relative">
                <button onClick={() => setFilterOpen((p) => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[2px] border ${visibleStatuses.length < 3 ? "border-blue-600 bg-[var(--action)] text-white" : "border-[var(--border-s)] text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Filter
                  {visibleStatuses.length < 3 && (
                    <span className="bg-[var(--surface)] text-[var(--text)] rounded-full px-1.5 font-semibold">{visibleStatuses.length}</span>
                  )}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-[3px]  z-10 p-3 space-y-2">
                    <div className="text-xs font-semibold text-[var(--text-sec)] uppercase tracking-wide mb-1">Show</div>
                    {(["Active", "Upcoming", "Expired"] as const).map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={visibleStatuses.includes(status)}
                          onChange={() => setVisibleStatuses((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status])}
                          className="h-4 w-4 rounded border-[var(--border-s)]" />
                        <span className={status === "Active" ? "text-[var(--ok-t)]" : status === "Upcoming" ? "text-[var(--action)]" : "text-[var(--text-sec)]"}>{status}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-[var(--text-sec)] text-sm">Loading...</div>
            ) : opportunities.length === 0 ? (
              <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-6 text-center text-[var(--text-sec)] text-sm">No opportunities yet.</div>
            ) : (() => {
              const statusOrder: Record<string, number> = { Active: 0, Upcoming: 1, Expired: 2 };
              const sorted = [...opportunities]
                .map((opp) => ({ opp, displayStatus: getDisplayStatus(opp.timeSlots) }))
                .filter(({ displayStatus }) => visibleStatuses.includes(displayStatus))
                .sort((a, b) => (statusOrder[a.displayStatus] ?? 3) - (statusOrder[b.displayStatus] ?? 3));

              return sorted.length === 0 ? (
                <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-6 text-center text-[var(--text-sec)] text-sm">No opportunities match the current filter.</div>
              ) : (
                <div className="space-y-3">
                  {sorted.map(({ opp, displayStatus }) => (
                    <div key={opp.id} className={`bg-white border rounded-[3px] p-4 ${editOppId === opp.id ? "border-blue-400 ring-1 ring-blue-200" : "border-[var(--border)]"}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm">{opp.title}</div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${displayStatus === "Active" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" : displayStatus === "Upcoming" ? "bg-[var(--in-bg)] text-[var(--action)]" : "bg-[var(--surface-alt)] text-[var(--text-sec)]"}`}>
                            {displayStatus}
                          </span>
                          <button onClick={() => handleEdit(opp)}
                            className="text-xs text-[var(--action)] hover:underline">
                            Edit
                          </button>
                          {deleteConfirmId === opp.id ? (
                            <span className="flex items-center gap-1 text-xs">
                              <button onClick={() => handleDelete(opp.id)} disabled={deleting}
                                className="text-[var(--er-t)] hover:underline disabled:opacity-50">
                                {deleting ? "..." : "Confirm"}
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-[var(--text-faint)] hover:text-[var(--text-sec)]">Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(opp.id)}
                              className="text-xs text-red-400 hover:text-[var(--er-t)]">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      {opp.location && <div className="text-xs text-[var(--text-sec)]">{opp.location}</div>}
                      {opp.description && <div className="text-xs text-[var(--text-sec)] mt-0.5 line-clamp-2">{opp.description}</div>}
                      {opp.attachments?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {opp.attachments.map((att) => (
                            <div key={att.id} className="flex items-center gap-1 text-xs border border-[var(--border-s)] rounded px-2 py-0.5 bg-[var(--surface-alt)]">
                              <svg className="w-3 h-3 shrink-0 text-[var(--text-faint)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                              </svg>
                              <a
                                href={`/api/beneficiaries/attachments/${att.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--action)] hover:underline max-w-[160px] truncate"
                                title={att.originalName}
                              >
                                {att.originalName}
                              </a>
                              <span className="text-[var(--text-faint)]">({(att.size / 1024).toFixed(0)} KB)</span>
                              {editOppId === opp.id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(opp, att.id)}
                                  disabled={deletingAttachmentId === att.id}
                                  className="text-red-400 hover:text-[var(--er-t)] disabled:opacity-50 ml-0.5"
                                  title="Remove attachment"
                                >
                                  {deletingAttachmentId === att.id ? "…" : "✕"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {opp.timeSlots.length > 0 && (
                        <div className="mt-2 border-t pt-2 space-y-1">
                          {opp.timeSlots.map((slot) => {
                            const slotDate = new Date(slot.date);
                            const isEditable = slotDate.getTime() > Date.now() + 24 * 60 * 60 * 1000;
                            return (
                              <div key={slot.id} className="flex justify-between items-center text-xs text-[var(--text-sec)]">
                                <span className="flex items-center gap-1.5">
                                  {slot.recurringGroupId && (
                                    <span title="Recurring" className="text-blue-400">↻</span>
                                  )}
                                  {slotDate.toLocaleDateString(undefined, { timeZone: "UTC" })} · {slot.startTime}–{slot.endTime}
                                  {isEditable && (
                                    <button type="button" onClick={() => openEditSlot(slot)}
                                      className="text-[var(--text-faint)] hover:text-[var(--action)] ml-0.5" title="Edit slot">
                                      ✎
                                    </button>
                                  )}
                                </span>
                                <span className="text-[var(--text-faint)]">{slot._count?.signups || 0}{slot.capacity ? `/${slot.capacity}` : ""} signed up</span>
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
            <div className="text-[var(--text-sec)] text-sm">Loading signups...</div>
          ) : signups.length === 0 ? (
            <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">No student signups yet.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-[var(--text-sec)]">Show pending by default, or switch to a specific reviewed status.</div>
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
                        className={`flex items-center gap-2 rounded-[2px] border px-3 py-2 text-sm ${
                          active
                            ? "border-blue-600 bg-[var(--in-bg)] text-[var(--action)]"
                            : "border-[var(--border-s)] bg-[var(--surface)] text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                            active
                              ? "border-blue-600 bg-[var(--action)] text-white"
                              : "border-[var(--border-s)] bg-[var(--surface)] text-transparent"
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
                  <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Pending Review ({pendingSignups.length})</h2>
                  <div className="space-y-3">
                    {pendingSignups.map((s) => (
                      <div key={s.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="font-medium text-sm">{s.student.label}</div>
                            <div className="text-xs text-[var(--text-faint)]">Student identity is hidden for school privacy compliance.</div>
                            <div className="text-xs text-[var(--text-sec)] mt-1">
                              {s.slot.opportunity.title} · {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} {s.slot.startTime}–{s.slot.endTime}
                            </div>
                            <div className="text-xs text-[var(--text-sec)] mt-0.5">
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
                                className="w-16 px-2 py-1 border border-[var(--border-s)] rounded text-xs"
                              />
                              <button onClick={() => handleApprove(s)}
                                disabled={actionId === s.id}
                                className="px-3 py-1.5 bg-[var(--ok-t)] text-white rounded text-xs hover:bg-[var(--ok-t)] disabled:opacity-50">
                                {actionId === s.id ? "..." : "Approve"}
                              </button>
                            </div>
                            <div className="flex gap-1">
                              <input type="text" value={rejectReason[s.id] || ""}
                                onChange={(e) => setRejectReason((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                placeholder="Reason..."
                                className="flex-1 min-w-0 px-2 py-1 border border-[var(--border-s)] rounded text-xs" />
                              <button onClick={() => handleReject(s.id)} disabled={rejectingId === s.id}
                                className="px-2 py-1 bg-[var(--er-bg)] text-[var(--er-t)] border border-[var(--er-b)] rounded text-xs hover:bg-[var(--er-bg)] disabled:opacity-50">
                                {rejectingId === s.id ? "..." : "Reject"}
                              </button>
                            </div>
                            <button onClick={() => setNoShowConfirmId(s.id)} disabled={noShowId === s.id}
                              className="px-2 py-1 text-[var(--text-sec)] border border-[var(--border)] rounded text-xs hover:bg-[var(--surface-alt)] disabled:opacity-50">
                              {noShowId === s.id ? "..." : "No-Show"}
                            </button>
                            <button onClick={() => loadHistory(s.id)} disabled={historyLoadingId === s.id}
                              className="px-2 py-1 text-[var(--text-sec)] border border-[var(--border)] rounded text-xs hover:bg-[var(--surface-alt)] disabled:opacity-50">
                              {historyLoadingId === s.id ? "..." : "History"}
                            </button>
                            <button onClick={() => openChecklist(s)}
                              className="px-2 py-1 text-[var(--text-sec)] border border-[var(--border)] rounded text-xs hover:bg-[var(--surface-alt)]">
                              Attendance list
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
                  <h2 className="text-sm font-semibold text-[var(--text)] mb-3">
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
                        <div key={s.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium text-sm">{s.student.label}</div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "NO_SHOW" ? "bg-[var(--surface-alt)] text-[var(--text-sec)]" : s.verificationStatus === "APPROVED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" : "bg-[var(--er-bg)] text-[var(--er-t)]"}`}>
                                  {s.status === "NO_SHOW" ? "No-Show" : s.verificationStatus === "REJECTED" ? "Denied" : s.verificationStatus}
                                </span>
                              </div>
                              <div className="text-xs text-[var(--text-sec)] mt-1">
                                {s.slot.opportunity.title} · {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {s.totalHours ?? s.slot.durationHours}h
                              </div>
                              {s.rejectionReason && <div className="text-xs text-[var(--er-t)] mt-1 italic">{s.rejectionReason}</div>}
                            </div>

                            <div className="w-full lg:w-[420px] space-y-2">
                              <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] p-2">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-sec)] mb-2">Change decision</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    min={0.25}
                                    step={0.25}
                                    value={approvalHours[s.id] ?? String(s.totalHours ?? s.slot.durationHours)}
                                    onChange={(e) => setApprovalHours((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                    className="w-20 px-2 py-1 border border-[var(--border-s)] rounded text-xs bg-[var(--surface)]"
                                  />
                                  <button onClick={() => handleApprove(s)} disabled={actionId === s.id}
                                    className="px-2.5 py-1 bg-[var(--ok-bg)] text-[var(--ok-t)] border border-[var(--ok-b)] rounded text-xs hover:bg-[var(--ok-bg)] disabled:opacity-50">
                                    {actionId === s.id ? "..." : "Approve"}
                                  </button>
                                  <button onClick={() => handleResetReview(s.id)} disabled={actionId === s.id}
                                    className="px-2.5 py-1 text-[var(--wn-t)] border border-[var(--wn-b)] rounded text-xs hover:bg-[var(--wn-bg)] disabled:opacity-50">
                                    {actionId === s.id ? "..." : "Undo"}
                                  </button>
                                  <button onClick={() => loadHistory(s.id)} disabled={historyLoadingId === s.id}
                                    className="px-2.5 py-1 text-[var(--text-sec)] border border-[var(--border)] rounded text-xs hover:bg-white disabled:opacity-50">
                                    {historyLoadingId === s.id ? "..." : "History"}
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-[2px] border border-red-100 bg-[var(--er-bg)]/50 p-2">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--er-t)] mb-2">Override outcome</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input type="text" value={rejectReason[s.id] || ""}
                                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                    placeholder="Reason for denial"
                                    className="flex-1 min-w-[150px] px-2 py-1 border border-[var(--er-b)] rounded text-xs bg-[var(--surface)]" />
                                  <button onClick={() => handleReject(s.id)} disabled={rejectingId === s.id}
                                    className="px-2.5 py-1 bg-[var(--er-bg)] text-[var(--er-t)] border border-[var(--er-b)] rounded text-xs hover:bg-[var(--er-bg)] disabled:opacity-50">
                                    {rejectingId === s.id ? "..." : "Deny"}
                                  </button>
                                  <button onClick={() => setNoShowConfirmId(s.id)} disabled={noShowId === s.id}
                                    className="px-2.5 py-1 text-[var(--text-sec)] border border-[var(--border)] rounded text-xs hover:bg-white disabled:opacity-50">
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
          <div className="w-full max-w-sm bg-[var(--surface)] rounded-[3px]  border border-[var(--border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text)]">Edit Time Slot</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleDeleteSlot(confirmDeleteSlot)}
                  disabled={deletingSlot || savingSlot}
                  title="Delete time slot"
                  className="text-red-400 hover:text-[var(--er-t)] disabled:opacity-40 p-1 rounded"
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
                  className="text-[var(--text-faint)] hover:text-[var(--text-sec)] text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
            {confirmDeleteSlot && (
              <div className="mb-4 rounded-[3px] border border-[var(--er-b)] bg-[var(--er-bg)] px-3 py-2 text-xs text-[var(--er-t)]">
                This slot has {editSlot._count?.signups || 0} signup{(editSlot._count?.signups || 0) === 1 ? "" : "s"}. Delete again to cancel the slot, remove those signups, and notify affected students automatically.
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-sec)] mb-1">Date</label>
                <input type="date" value={slotForm.date}
                  onChange={(e) => setSlotForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[var(--text-sec)] mb-1">Start time</label>
                  <input type="time" value={slotForm.startTime}
                    onChange={(e) => setSlotForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-sec)] mb-1">End time</label>
                  <input type="time" value={slotForm.endTime}
                    onChange={(e) => setSlotForm((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-sec)] mb-1">Max volunteers</label>
                <input type="number" min={1} value={slotForm.capacity}
                  onChange={(e) => setSlotForm((p) => ({ ...p, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>

              {/* Propagate checkbox — only for recurring slots with date/time change */}
              {editSlot.recurringGroupId && slotChanged && (
                <label className="flex items-start gap-2 cursor-pointer p-3 bg-[var(--in-bg)] rounded-[3px] border border-blue-100">
                  <input type="checkbox" checked={propagateFuture}
                    onChange={(e) => setPropagateFuture(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border-s)]" />
                  <span className="text-xs text-[var(--navy)]">
                    Apply this date/time change to all future slots in this recurring series
                  </span>
                </label>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveSlot} disabled={savingSlot}
                className="flex-1 px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm hover:opacity-85 disabled:opacity-50">
                {savingSlot ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditSlot(null)}
                className="flex-1 px-4 py-2 border border-[var(--border-s)] text-[var(--text-sec)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]">
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
            <div className="w-full max-w-sm bg-[var(--surface)] rounded-[3px]  border border-[var(--border)] p-6">
              <h3 className="font-semibold text-[var(--text)] mb-2">Mark as No-Show?</h3>
              <p className="text-sm text-[var(--text-sec)] mb-1">
                <strong>{signup.student.label}</strong> will be marked as a no-show for:
              </p>
              <p className="text-sm text-[var(--text-sec)] mb-4">
                {signup.slot.opportunity.title} · {new Date(signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })}
              </p>
              <p className="text-xs text-[var(--text-faint)] mb-5">This cannot be undone. The student's hours will not be counted.</p>
              <div className="flex gap-3">
                <button onClick={() => handleNoShow(noShowConfirmId)}
                  className="flex-1 px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm hover:opacity-85">
                  Confirm No-Show
                </button>
                <button onClick={() => setNoShowConfirmId(null)}
                  className="flex-1 px-4 py-2 border border-[var(--border-s)] text-[var(--text-sec)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {checklist && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] rounded-[3px] border border-[var(--border)] max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[var(--text)]">Attendance checklist</h3>
                <p className="mt-1 text-xs text-[var(--text-sec)]">{checklist.opportunity.title} · {new Date(checklist.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {checklist.slot.startTime}–{checklist.slot.endTime}</p>
              </div>
              <button onClick={() => setChecklist(null)} className="text-[var(--text-faint)] hover:text-[var(--text-sec)] text-sm">Close</button>
            </div>
            <div className="p-5 max-h-[52vh] overflow-y-auto space-y-2">
              <p className="text-xs text-[var(--text-faint)]">This front-desk list intentionally contains names only.</p>
              {checklist.records.map((record) => (
                <label key={record.signupId} className="flex items-center justify-between gap-3 rounded border border-[var(--border)] px-3 py-2 text-sm">
                  <span className="font-medium text-[var(--text)]">{record.name}</span>
                  <select value={record.attendance ?? ""} onChange={(event) => setChecklist((current) => current && ({ ...current, records: current.records.map((item) => item.signupId === record.signupId ? { ...item, attendance: event.target.value || null } : item) }))} className="border border-[var(--border-s)] rounded px-2 py-1 text-xs">
                    <option value="">Not recorded</option>
                    <option value="ATTENDED">Attended</option>
                    <option value="NO_SHOW">No-show</option>
                  </select>
                </label>
              ))}
              {checklist.records.length === 0 && <p className="text-sm text-[var(--text-sec)]">No confirmed volunteers are on this list.</p>}
            </div>
            <div className="flex gap-3 border-t border-[var(--border)] px-5 py-4">
              <button onClick={saveChecklist} disabled={attendanceSaving} className="flex-1 px-4 py-2 bg-[var(--action)] text-white rounded text-sm disabled:opacity-50">{attendanceSaving ? "Saving..." : "Save attendance"}</button>
              <button onClick={() => setChecklist(null)} className="px-4 py-2 border border-[var(--border-s)] rounded text-sm text-[var(--text-sec)]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Verification history modal */}
      {historySignup && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[var(--surface)] rounded-[3px]  border border-[var(--border)] max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-[var(--text)]">Verification History</div>
                <div className="text-sm text-[var(--text-sec)] mt-1">
                  {(historySignup.signup.student?.label || "Anonymous volunteer")} · {historySignup.signup.slot.opportunity.title}
                </div>
              </div>
              <button onClick={() => setHistorySignup(null)} className="text-[var(--text-faint)] hover:text-[var(--text-sec)] text-sm">Close</button>
            </div>
            <div className="px-5 py-4 border-b border-[var(--border)] text-sm text-[var(--text-sec)]">
              <div>{new Date(historySignup.signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {historySignup.signup.slot.startTime}–{historySignup.signup.slot.endTime} · {historySignup.signup.totalHours ?? historySignup.signup.slot.durationHours}h</div>
              <div className="mt-1">Current status: <strong>{historySignup.signup.status === "NO_SHOW" ? "No-Show" : historySignup.signup.verificationStatus}</strong></div>
              {historySignup.signup.rejectionReason && <div className="mt-1 text-[var(--er-t)]">Reason: {historySignup.signup.rejectionReason}</div>}
            </div>
            <div className="p-5 overflow-y-auto max-h-[55vh] space-y-3">
              {historySignup.history.length === 0 ? (
                <div className="text-sm text-[var(--text-sec)]">No audit events recorded yet.</div>
              ) : (
                historySignup.history.map((entry) => (
                  <div key={entry.id} className="border border-[var(--border)] rounded-[3px] p-3">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-[var(--text)]">{entry.action}</div>
                        <div className="text-xs text-[var(--text-sec)] mt-0.5">{entry.actor.name} · {entry.actor.role}</div>
                      </div>
                      <div className="text-xs text-[var(--text-faint)] shrink-0">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    {formatHistoryDetails(entry.details) && (
                      <div className="text-xs text-[var(--text-sec)] mt-2">{formatHistoryDetails(entry.details)}</div>
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
