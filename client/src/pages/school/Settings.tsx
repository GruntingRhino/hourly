import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";
import { CollapsibleList } from "../../components/CollapsibleList";
import { OPPORTUNITY_CATEGORY_OPTIONS } from "../../lib/opportunityCategories";

type Tab = "profile" | "rules" | "security" | "notifications" | "privacy" | "integrations" | "data";

interface SchoolData {
  id: string;
  name: string;
  domain: string | null;
  verified: boolean;
  requiredHours: number;
  verificationStandard: string;
  zipCodes: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  serviceStartDate: string | null;
  serviceEndDate: string | null;
  allowSelfSubmission: boolean;
  requireOrgVerification: boolean;
  categoryHourCaps: string | null;
  partnerInviteTemplate: string | null;
}

type CapRow = { category: string; hours: string };
const REQUIRED_CATEGORY_CAP = "Community Service";
const CATEGORY_CAP_OPTIONS = [...OPPORTUNITY_CATEGORY_OPTIONS];

interface SchoolSettingsData {
  schoolId: string;
  allowJoinByCode: boolean;
  partnerInviteTemplate?: string;
}

interface CategoryCapWarning {
  studentId: string;
  studentName: string;
  category: string;
  cap: number;
  approvedHours: number;
  message: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedCohorts: Array<{ id: string; name: string }>;
}

interface DataAccessLogEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel?: string | null;
  details: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

type IntegrationProvider = "CANVAS" | "GOOGLE_CLASSROOM";

interface IntegrationConnectionStatus {
  id: string;
  provider: IntegrationProvider;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  displayName: string | null;
  baseUrl: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: "COMPLETED" | "PARTIAL_FAILED" | "FAILED" | "RUNNING" | null;
  scenario: string;
  mode: "MOCK" | "OAUTH";
}

interface IntegrationSyncCounts {
  cohortsCreated: number;
  cohortsUpdated: number;
  cohortsArchived: number;
  teacherAssignmentsCreated: number;
  invitationsCreated: number;
  invitationsUpdated: number;
  existingUsersLinked: number;
  usersAssignedToCohort: number;
  skipped: number;
  errors: number;
}

interface IntegrationSyncSummary {
  provider: IntegrationProvider;
  mode: "PREVIEW" | "APPLY";
  scenario: string;
  counts: IntegrationSyncCounts;
  operations: Array<{ type: string; target: string; action: string; detail?: string }>;
}

interface IntegrationSyncJob {
  id: string;
  mode: "PREVIEW" | "APPLY";
  status: "RUNNING" | "COMPLETED" | "PARTIAL_FAILED" | "FAILED";
  summary: IntegrationSyncSummary | null;
  startedAt: string;
  finishedAt: string | null;
}

interface IntegrationSyncErrorEntry {
  id: string;
  code: string;
  message: string;
  externalType: string | null;
  externalId: string | null;
  localType: string | null;
  localId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  syncJobId: string;
}

interface IntegrationStatusResponse {
  capabilities?: {
    mockAllowed: boolean;
    oauthConfigured: boolean;
    requestTimeoutMs: number;
    integrationScope: "SINGLE_SCHOOL";
  };
  ops?: {
    connected: boolean;
    mode: "MOCK" | "OAUTH" | null;
    lastSyncAt: string | null;
    lastSyncStatus: "COMPLETED" | "PARTIAL_FAILED" | "FAILED" | "RUNNING" | null;
    recentJobFailures24h: number;
    recentSyncErrors24h: number;
    tokenRefreshFailures24h: number;
    hasRepeatedFailures: boolean;
    staleSync: boolean;
    warnings: string[];
  };
  connection: IntegrationConnectionStatus | null;
  jobs: IntegrationSyncJob[];
}

function isOpaqueIdLike(value: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(value.trim());
}

function formatAccessDetailValue(value: unknown): string {
  if (Array.isArray(value)) {
    const visibleValues = value
      .filter((entry) => !(typeof entry === "string" && isOpaqueIdLike(entry)))
      .map((entry) => String(entry))
      .filter(Boolean);
    return visibleValues.join(", ");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key, nestedValue]) => {
        if (/id$/i.test(key) || /ids$/i.test(key)) return false;
        if (typeof nestedValue === "string" && isOpaqueIdLike(nestedValue)) return false;
        return true;
      })
      .map(([key, nestedValue]) => `${key}: ${formatAccessDetailValue(nestedValue)}`)
      .join(", ");
  }

  return String(value);
}

function normalizeCapRows(input: CapRow[]): CapRow[] {
  const byCategory = new Map<string, CapRow>();

  for (const row of input) {
    const category = row.category.trim();
    if (!category) continue;
    if (category === REQUIRED_CATEGORY_CAP) continue;
    if (!byCategory.has(category)) {
      byCategory.set(category, { category, hours: row.hours });
    }
  }

  return Array.from(byCategory.values()).sort((a, b) => a.category.localeCompare(b.category));
}

function sumConfiguredCapHours(rows: CapRow[]): number {
  return rows.reduce((total, row) => {
    const parsed = Number.parseFloat(row.hours);
    return Number.isFinite(parsed) && parsed > 0 ? total + parsed : total;
  }, 0);
}

export default function SchoolSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const [tab, setTab] = useState<Tab>("profile");
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [adminName, setAdminName] = useState(user?.name || "");
  const [schoolName, setSchoolName] = useState("");
  const [domain, setDomain] = useState("");
  const [requiredHours, setRequiredHours] = useState("40");
  const [zipCodes, setZipCodes] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolState, setSchoolState] = useState("");
  const [schoolZip, setSchoolZip] = useState("");
  const [partnerInviteTemplate, setPartnerInviteTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [allowJoinByCode, setAllowJoinByCode] = useState(false);
  const [updatingJoinByCode, setUpdatingJoinByCode] = useState(false);
  const [joinByCodeToast, setJoinByCodeToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Service rules
  const [serviceStartDate, setServiceStartDate] = useState("");
  const [serviceEndDate, setServiceEndDate] = useState("");
  const [allowSelfSubmission, setAllowSelfSubmission] = useState(true);
  const [verificationStandard, setVerificationStandard] = useState("STANDARD");
  const [requireOrgVerification, setRequireOrgVerification] = useState(false);
  const [capRows, setCapRows] = useState<CapRow[]>([]);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesMessage, setRulesMessage] = useState("");
  const [rulesIsError, setRulesIsError] = useState(false);
  const [categoryCapWarnings, setCategoryCapWarnings] = useState<CategoryCapWarning[]>([]);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordIsError, setPasswordIsError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Notifications
  const defaultNotifPrefs = {
    studentJoin: { email: true, inApp: true },
    hourApproval: { email: true, inApp: true },
    orgRequest: { email: true, inApp: true },
  };
  const mergeNotifPrefs = (raw: any) => ({
    studentJoin: { ...defaultNotifPrefs.studentJoin, ...(raw?.studentJoin || {}) },
    hourApproval: { ...defaultNotifPrefs.hourApproval, ...(raw?.hourApproval || {}) },
    orgRequest: { ...defaultNotifPrefs.orgRequest, ...(raw?.orgRequest || {}) },
  });
  const [notifPrefs, setNotifPrefs] = useState<typeof defaultNotifPrefs>(
    mergeNotifPrefs((user as any)?.notificationPreferences)
  );
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");
  const [notifIsError, setNotifIsError] = useState(false);

  // Privacy
  const defaultMsgPrefs = { allowFrom: "EVERYONE", profileVisibility: "EVERYONE" };
  const [msgPrefs, setMsgPrefs] = useState<typeof defaultMsgPrefs>(
    (user as any)?.messagePreferences || defaultMsgPrefs
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");
  const [privacyIsError, setPrivacyIsError] = useState(false);
  const [dataAccessLogs, setDataAccessLogs] = useState<DataAccessLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [transferTargetEmail, setTransferTargetEmail] = useState("");
  const [transferringOwnership, setTransferringOwnership] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const [transferIsError, setTransferIsError] = useState(false);
  const [canvasStatus, setCanvasStatus] = useState<IntegrationStatusResponse | null>(null);
  const [canvasErrors, setCanvasErrors] = useState<IntegrationSyncErrorEntry[]>([]);
  const [canvasScenario, setCanvasScenario] = useState<"default" | "renamed" | "archived" | "deleted" | "student_removed">("default");
  const [canvasConnectMode, setCanvasConnectMode] = useState<"MOCK" | "OAUTH">("MOCK");
  const [canvasBaseUrl, setCanvasBaseUrl] = useState("https://canvas.mock.local");
  const [canvasBusyAction, setCanvasBusyAction] = useState<"" | "connect" | "disconnect" | "preview" | "apply">("");
  const [canvasMessage, setCanvasMessage] = useState("");
  const [canvasIsError, setCanvasIsError] = useState(false);
  const [canvasPreview, setCanvasPreview] = useState<IntegrationSyncSummary | null>(null);
  const [googleClassroomStatus, setGoogleClassroomStatus] = useState<IntegrationStatusResponse | null>(null);
  const [googleClassroomErrors, setGoogleClassroomErrors] = useState<IntegrationSyncErrorEntry[]>([]);
  const [googleClassroomScenario, setGoogleClassroomScenario] = useState<"default" | "renamed" | "archived" | "deleted" | "student_removed">("default");
  const [googleClassroomConnectMode, setGoogleClassroomConnectMode] = useState<"MOCK" | "OAUTH">("MOCK");
  const [googleClassroomBaseUrl, setGoogleClassroomBaseUrl] = useState("https://classroom.googleapis.com");
  const [googleClassroomBusyAction, setGoogleClassroomBusyAction] = useState<"" | "connect" | "disconnect" | "preview" | "apply">("");
  const [googleClassroomMessage, setGoogleClassroomMessage] = useState("");
  const [googleClassroomIsError, setGoogleClassroomIsError] = useState(false);
  const [googleClassroomPreview, setGoogleClassroomPreview] = useState<IntegrationSyncSummary | null>(null);

  useEffect(() => {
    if (user?.schoolId) {
      Promise.all([
        api.get<SchoolData>(`/schools/${user.schoolId}`),
        api.get<SchoolSettingsData>("/schools/settings").catch(() => ({
          schoolId: user.schoolId!,
          allowJoinByCode: false,
        })),
      ]).then(([schoolData, schoolSettings]) => {
        setSchool(schoolData);
        setAdminName(user?.name || "");
        setSchoolName(schoolData.name || "");
        setDomain(schoolData.domain || "");
        setRequiredHours(String(schoolData.requiredHours));
        setAllowJoinByCode(Boolean(schoolSettings.allowJoinByCode));
        setSchoolAddress(schoolData.address || "");
        setSchoolCity(schoolData.city || "");
        setSchoolState(schoolData.state || "");
        setSchoolZip(schoolData.zip || "");
        setPartnerInviteTemplate(schoolData.partnerInviteTemplate || "");
        try {
          const zips = schoolData.zipCodes ? JSON.parse(schoolData.zipCodes) : [];
          setZipCodes(Array.isArray(zips) ? zips.join(", ") : "");
        } catch {
          setZipCodes("");
        }
        // Service rules
        setServiceStartDate(schoolData.serviceStartDate ? schoolData.serviceStartDate.split("T")[0] : "");
        setServiceEndDate(schoolData.serviceEndDate ? schoolData.serviceEndDate.split("T")[0] : "");
        setAllowSelfSubmission(schoolData.allowSelfSubmission ?? true);
        setVerificationStandard(schoolData.verificationStandard || "STANDARD");
        setRequireOrgVerification(schoolData.requireOrgVerification ?? false);
        try {
          const caps = schoolData.categoryHourCaps ? JSON.parse(schoolData.categoryHourCaps) : {};
          setCapRows(normalizeCapRows(
            Object.entries(caps).map(([category, hours]) => ({ category, hours: String(hours) }))
          ));
        } catch {
          setCapRows(normalizeCapRows([]));
        }
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setNotifPrefs(mergeNotifPrefs((user as any)?.notificationPreferences));
  }, [(user as any)?.notificationPreferences]);

  useEffect(() => {
    if (!joinByCodeToast) return;
    const timeoutId = window.setTimeout(() => setJoinByCodeToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [joinByCodeToast]);

  useEffect(() => {
    if (!isAdmin || !user?.schoolId) return;
    api.get<StaffMember[]>(`/schools/${user.schoolId}/staff`)
      .then(setStaff)
      .catch(() => {});
  }, [isAdmin, user?.schoolId]);

  useEffect(() => {
    if (tab !== "data" || !isAdmin || !user?.schoolId) return;
    setLogsLoading(true);
    setLogsError("");
    api.get<DataAccessLogEntry[]>(`/schools/${user.schoolId}/data-access-logs`)
      .then(setDataAccessLogs)
      .catch((err: any) => setLogsError(err.message || "Failed to load data access logs"))
      .finally(() => setLogsLoading(false));
  }, [tab, isAdmin, user?.schoolId]);

  useEffect(() => {
    if (tab !== "integrations" || !isAdmin || !user?.schoolId) return;
    Promise.all([
      api.get<IntegrationStatusResponse>("/integrations/canvas/status"),
      api.get<IntegrationSyncErrorEntry[]>("/integrations/canvas/errors"),
      api.get<IntegrationStatusResponse>("/integrations/googleClassroom/status"),
      api.get<IntegrationSyncErrorEntry[]>("/integrations/googleClassroom/errors"),
    ])
      .then(([canvas, canvasErrs, classroom, classroomErrs]) => {
        setCanvasStatus(canvas);
        setCanvasErrors(canvasErrs);
        setCanvasScenario(
          canvas.connection?.mode === "MOCK"
            ? (canvas.connection.scenario as "default" | "renamed" | "archived" | "deleted" | "student_removed")
            : "default"
        );
        setCanvasConnectMode(canvas.connection?.mode ?? (canvas.capabilities?.mockAllowed === false ? "OAUTH" : "MOCK"));
        setCanvasBaseUrl(canvas.connection?.baseUrl ?? "https://canvas.mock.local");
        setGoogleClassroomStatus(classroom);
        setGoogleClassroomErrors(classroomErrs);
        setGoogleClassroomScenario(
          classroom.connection?.mode === "MOCK"
            ? (classroom.connection.scenario as "default" | "renamed" | "archived" | "deleted" | "student_removed")
            : "default"
        );
        setGoogleClassroomConnectMode(classroom.connection?.mode ?? (classroom.capabilities?.mockAllowed === false ? "OAUTH" : "MOCK"));
        setGoogleClassroomBaseUrl(classroom.connection?.baseUrl ?? "https://classroom.googleapis.com");
      })
      .catch((err: any) => {
        setCanvasMessage(err.message || "Failed to load integration status");
        setCanvasIsError(true);
        setGoogleClassroomMessage(err.message || "Failed to load integration status");
        setGoogleClassroomIsError(true);
      });
  }, [tab, isAdmin, user?.schoolId]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "integrations" && isAdmin) {
      setTab("integrations");
    }

    const canvasStatusParam = searchParams.get("canvas");
    const canvasErrorParam = searchParams.get("canvasError");
    const googleClassroomStatusParam = searchParams.get("googleClassroom");
    const googleClassroomErrorParam = searchParams.get("googleClassroomError");
    if (canvasStatusParam === "connected") {
      setCanvasMessage("Canvas OAuth connection established.");
      setCanvasIsError(false);
    } else if (canvasErrorParam) {
      setCanvasMessage(canvasErrorParam);
      setCanvasIsError(true);
    }
    if (googleClassroomStatusParam === "connected") {
      setGoogleClassroomMessage("Google Classroom OAuth connection established.");
      setGoogleClassroomIsError(false);
    } else if (googleClassroomErrorParam) {
      setGoogleClassroomMessage(googleClassroomErrorParam);
      setGoogleClassroomIsError(true);
    }
    if (!canvasStatusParam && !canvasErrorParam && !googleClassroomStatusParam && !googleClassroomErrorParam) return;

    const next = new URLSearchParams(searchParams);
    next.delete("canvas");
    next.delete("canvasError");
    next.delete("googleClassroom");
    next.delete("googleClassroomError");
    setSearchParams(next, { replace: true });
  }, [isAdmin, searchParams, setSearchParams]);

  const reloadCanvasState = async () => {
    const [status, errors] = await Promise.all([
      api.get<IntegrationStatusResponse>("/integrations/canvas/status"),
      api.get<IntegrationSyncErrorEntry[]>("/integrations/canvas/errors"),
    ]);
    setCanvasStatus(status);
    setCanvasErrors(errors);
    setCanvasScenario(
      status.connection?.mode === "MOCK"
        ? (status.connection.scenario as "default" | "renamed" | "archived" | "deleted" | "student_removed")
        : canvasScenario
    );
    setCanvasConnectMode(status.connection?.mode ?? (status.capabilities?.mockAllowed === false ? "OAUTH" : canvasConnectMode));
    setCanvasBaseUrl(status.connection?.baseUrl ?? canvasBaseUrl);
  };

  const reloadGoogleClassroomState = async () => {
    const [status, errors] = await Promise.all([
      api.get<IntegrationStatusResponse>("/integrations/googleClassroom/status"),
      api.get<IntegrationSyncErrorEntry[]>("/integrations/googleClassroom/errors"),
    ]);
    setGoogleClassroomStatus(status);
    setGoogleClassroomErrors(errors);
    setGoogleClassroomScenario(
      status.connection?.mode === "MOCK"
        ? (status.connection.scenario as "default" | "renamed" | "archived" | "deleted" | "student_removed")
        : googleClassroomScenario
    );
    setGoogleClassroomConnectMode(status.connection?.mode ?? (status.capabilities?.mockAllowed === false ? "OAUTH" : googleClassroomConnectMode));
    setGoogleClassroomBaseUrl(status.connection?.baseUrl ?? googleClassroomBaseUrl);
  };

  const handleCanvasConnect = async () => {
    setCanvasBusyAction("connect");
    setCanvasMessage("");
    setCanvasIsError(false);
    try {
      if (canvasConnectMode === "OAUTH") {
        const result = await api.get<{ url: string }>(
          `/integrations/canvas/oauth/url?baseUrl=${encodeURIComponent(canvasBaseUrl)}&displayName=${encodeURIComponent("Canvas Sandbox")}`
        );
        window.location.assign(result.url);
        return;
      }

      await api.post("/integrations/canvas/connect", {
        mode: "MOCK",
        displayName: "Canvas Mock Sandbox",
        baseUrl: canvasBaseUrl,
        mockScenario: canvasScenario,
      });
      setCanvasMessage("Canvas mock connection created.");
      await reloadCanvasState();
    } catch (err: any) {
      setCanvasMessage(err.message || "Failed to connect Canvas");
      setCanvasIsError(true);
    } finally {
      setCanvasBusyAction("");
    }
  };

  const handleCanvasDisconnect = async () => {
    setCanvasBusyAction("disconnect");
    setCanvasMessage("");
    setCanvasIsError(false);
    try {
      await api.post("/integrations/canvas/disconnect");
      setCanvasPreview(null);
      setCanvasMessage("Canvas disconnected.");
      await reloadCanvasState();
    } catch (err: any) {
      setCanvasMessage(err.message || "Failed to disconnect Canvas");
      setCanvasIsError(true);
    } finally {
      setCanvasBusyAction("");
    }
  };

  const handleCanvasPreview = async () => {
    setCanvasBusyAction("preview");
    setCanvasMessage("");
    setCanvasIsError(false);
    try {
      const result = await api.post<{ summary: IntegrationSyncSummary }>("/integrations/canvas/preview");
      setCanvasPreview(result.summary);
      setCanvasMessage("Canvas preview complete.");
      await reloadCanvasState();
    } catch (err: any) {
      setCanvasMessage(err.message || "Failed to preview Canvas sync");
      setCanvasIsError(true);
    } finally {
      setCanvasBusyAction("");
    }
  };

  const handleCanvasApply = async () => {
    setCanvasBusyAction("apply");
    setCanvasMessage("");
    setCanvasIsError(false);
    try {
      const result = await api.post<{ summary: IntegrationSyncSummary }>("/integrations/canvas/apply");
      setCanvasPreview(result.summary);
      setCanvasMessage("Canvas sync applied.");
      await reloadCanvasState();
    } catch (err: any) {
      setCanvasMessage(err.message || "Failed to apply Canvas sync");
      setCanvasIsError(true);
    } finally {
      setCanvasBusyAction("");
    }
  };

  const handleGoogleClassroomConnect = async () => {
    setGoogleClassroomBusyAction("connect");
    setGoogleClassroomMessage("");
    setGoogleClassroomIsError(false);
    try {
      if (googleClassroomConnectMode === "OAUTH") {
        const result = await api.get<{ url: string }>(
          `/integrations/googleClassroom/oauth/url?baseUrl=${encodeURIComponent(googleClassroomBaseUrl)}&displayName=${encodeURIComponent("Google Classroom")}`
        );
        window.location.assign(result.url);
        return;
      }

      await api.post("/integrations/googleClassroom/connect", {
        mode: "MOCK",
        displayName: "Google Classroom Mock Sandbox",
        baseUrl: googleClassroomBaseUrl,
        mockScenario: googleClassroomScenario,
      });
      setGoogleClassroomMessage("Google Classroom mock connection created.");
      await reloadGoogleClassroomState();
    } catch (err: any) {
      setGoogleClassroomMessage(err.message || "Failed to connect Google Classroom");
      setGoogleClassroomIsError(true);
    } finally {
      setGoogleClassroomBusyAction("");
    }
  };

  const handleGoogleClassroomDisconnect = async () => {
    setGoogleClassroomBusyAction("disconnect");
    setGoogleClassroomMessage("");
    setGoogleClassroomIsError(false);
    try {
      await api.post("/integrations/googleClassroom/disconnect");
      setGoogleClassroomPreview(null);
      setGoogleClassroomMessage("Google Classroom disconnected.");
      await reloadGoogleClassroomState();
    } catch (err: any) {
      setGoogleClassroomMessage(err.message || "Failed to disconnect Google Classroom");
      setGoogleClassroomIsError(true);
    } finally {
      setGoogleClassroomBusyAction("");
    }
  };

  const handleGoogleClassroomPreview = async () => {
    setGoogleClassroomBusyAction("preview");
    setGoogleClassroomMessage("");
    setGoogleClassroomIsError(false);
    try {
      const result = await api.post<{ summary: IntegrationSyncSummary }>("/integrations/googleClassroom/preview");
      setGoogleClassroomPreview(result.summary);
      setGoogleClassroomMessage("Google Classroom preview complete.");
      await reloadGoogleClassroomState();
    } catch (err: any) {
      setGoogleClassroomMessage(err.message || "Failed to preview Google Classroom sync");
      setGoogleClassroomIsError(true);
    } finally {
      setGoogleClassroomBusyAction("");
    }
  };

  const handleGoogleClassroomApply = async () => {
    setGoogleClassroomBusyAction("apply");
    setGoogleClassroomMessage("");
    setGoogleClassroomIsError(false);
    try {
      const result = await api.post<{ summary: IntegrationSyncSummary }>("/integrations/googleClassroom/apply");
      setGoogleClassroomPreview(result.summary);
      setGoogleClassroomMessage("Google Classroom sync applied.");
      await reloadGoogleClassroomState();
    } catch (err: any) {
      setGoogleClassroomMessage(err.message || "Failed to apply Google Classroom sync");
      setGoogleClassroomIsError(true);
    } finally {
      setGoogleClassroomBusyAction("");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const zipArray = zipCodes
        ? zipCodes.split(",").map((z) => z.trim()).filter(Boolean)
        : [];
      await Promise.all(
        [
          isAdmin
            ? api.put(`/schools/${user.schoolId}`, {
                name: schoolName,
                domain: domain || null,
                requiredHours: parseFloat(requiredHours),
                zipCodes: zipArray,
                address: schoolAddress || null,
                city: schoolCity || null,
                state: schoolState || null,
                zip: schoolZip || null,
                partnerInviteTemplate: partnerInviteTemplate.trim() || null,
              })
            : Promise.resolve(null),
          adminName.trim() && adminName.trim() !== user?.name
            ? api.put("/auth/profile", { name: adminName.trim() })
            : Promise.resolve(null),
        ]
      );
      setMessage("Settings updated!");
      await refreshUser();
    } catch (err: any) {
      setMessage(err.message || "Failed to update settings");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleOwnershipTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setTransferringOwnership(true);
    setTransferMessage("");
    setTransferIsError(false);
    try {
      const result = await api.post<{ message: string }>(`/schools/${user.schoolId}/ownership-transfer`, {
        targetEmail: transferTargetEmail,
      });
      setTransferMessage(result.message || "Transfer confirmation sent.");
      setTransferTargetEmail("");
    } catch (err: any) {
      setTransferMessage(err.message || "Failed to start ownership transfer.");
      setTransferIsError(true);
    } finally {
      setTransferringOwnership(false);
    }
  };

  const handleToggleAllowJoinByCode = async () => {
    if (!isAdmin) return;

    const previousValue = allowJoinByCode;
    const nextValue = !previousValue;

    setAllowJoinByCode(nextValue);
    setUpdatingJoinByCode(true);
    setMessage("");
    setIsError(false);

    try {
      const updated = await api.patch<SchoolSettingsData>("/schools/settings", {
        allowJoinByCode: nextValue,
      });
      setAllowJoinByCode(Boolean(updated.allowJoinByCode));
      setMessage("Join-by-code setting updated.");
      setIsError(false);
      setJoinByCodeToast({ type: "success", text: "Join-by-code setting saved." });
    } catch (err: any) {
      setAllowJoinByCode(previousValue);
      setMessage(err.message || "Failed to update join-by-code setting");
      setIsError(true);
      setJoinByCodeToast({
        type: "error",
        text: err.message || "Failed to update join-by-code setting",
      });
    } finally {
      setUpdatingJoinByCode(false);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setSavingRules(true);
    setRulesMessage("");
    setRulesIsError(false);
    setCategoryCapWarnings([]);
    try {
      if (serviceStartDate && serviceEndDate && new Date(serviceEndDate) <= new Date(serviceStartDate)) {
        setRulesMessage("End date must be after start date.");
        setRulesIsError(true);
        return;
      }
      const normalizedCapRows = normalizeCapRows(capRows);
      setCapRows(normalizedCapRows);
      const requiredHoursValue = Number.parseFloat(requiredHours);
      const totalConfiguredCapHours = sumConfiguredCapHours(normalizedCapRows);
      if (
        Number.isFinite(requiredHoursValue)
        && requiredHoursValue > 0
        && totalConfiguredCapHours > requiredHoursValue
      ) {
        setRulesMessage(`Category caps cannot exceed the total required hours of ${requiredHoursValue}h.`);
        setRulesIsError(true);
        return;
      }
      const categoryHourCaps: Record<string, number> | null = normalizedCapRows.length > 0
        ? Object.fromEntries(
          normalizedCapRows
            .filter((r) => r.category.trim() && r.hours.trim())
            .map((r) => [r.category.trim(), parseFloat(r.hours) || 0])
        )
        : null;
      const updated = await api.put<{ categoryCapWarnings?: CategoryCapWarning[] }>(`/schools/${user.schoolId}`, {
        serviceStartDate: serviceStartDate ? new Date(serviceStartDate).toISOString() : null,
        serviceEndDate: serviceEndDate ? new Date(serviceEndDate).toISOString() : null,
        allowSelfSubmission,
        verificationStandard,
        requireOrgVerification,
        categoryHourCaps,
      });
      setCategoryCapWarnings(updated.categoryCapWarnings ?? []);
      setRulesMessage(
        updated.categoryCapWarnings?.length
          ? "Service rules saved. Some students are already above one or more new category caps, so their current hours were kept and they are now blocked from adding more in those categories."
          : "Service rules saved!",
      );
    } catch (err: any) {
      setRulesMessage(err.message || "Failed to save rules");
      setRulesIsError(true);
    } finally {
      setSavingRules(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordIsError(false);
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match");
      setPasswordIsError(true);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters");
      setPasswordIsError(true);
      return;
    }
    setChangingPassword(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      setPasswordMessage("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage(err.message || "Failed to change password");
      setPasswordIsError(true);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete("/auth/account");
      logout();
    } catch (err: any) {
      setMessage(err.message || "Failed to delete account");
      setIsError(true);
      setDeleting(false);
      setDeleteConfirm(false);
      setDeleteInput("");
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    setNotifMessage("");
    setNotifIsError(false);
    try {
      await api.put("/auth/profile", { notificationPreferences: notifPrefs });
      void refreshUser();
      setNotifMessage("Notification preferences saved!");
    } catch {
      setNotifMessage("Failed to save preferences");
      setNotifIsError(true);
    } finally {
      setSavingNotif(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    setPrivacyMessage("");
    setPrivacyIsError(false);
    try {
      await api.put("/auth/profile", { messagePreferences: msgPrefs });
      setPrivacyMessage("Privacy settings saved!");
    } catch {
      setPrivacyMessage("Failed to save settings");
      setPrivacyIsError(true);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const toggleNotif = (key: keyof typeof defaultNotifPrefs, channel: "email" | "inApp") => {
    setNotifPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }));
  };

  const handleExportActivityLog = async () => {
    if (!user?.schoolId) return;
    try {
      const sessions = await api.get<any[]>(`/sessions/school`).catch(() => [] as any[]);
      const rows = [
        ["Student", "Opportunity", "Date", "Hours", "Status"],
        ...sessions.map((s: any) => [
          s.user?.name || "",
          s.opportunity?.title || "",
          s.opportunity?.date ? new Date(s.opportunity.date).toLocaleDateString() : "",
          s.totalHours?.toString() || "",
          s.verificationStatus || s.status || "",
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "activity-log.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err.message || "Failed to export");
      setIsError(true);
    }
  };

  const formatAccessDetails = (raw: string | null) => {
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed)
        .filter(([key, value]) => {
          if (/id$/i.test(key) || /ids$/i.test(key)) return false;
          if (typeof value === "string" && isOpaqueIdLike(value)) return false;
          return true;
        })
        .map(([key, value]) => `${key}: ${formatAccessDetailValue(value)}`)
        .filter((entry) => !entry.endsWith(": "))
        .join(" | ");
    } catch {
      return isOpaqueIdLike(raw) ? "" : raw;
    }
  };

  const notifRows = [
    { key: "studentJoin" as const, label: "Student Joins/Leaves" },
    { key: "hourApproval" as const, label: "Hour Approval Alert" },
    { key: "orgRequest" as const, label: "Org Request Alert" },
  ];
  const requiredHoursValue = Number.parseFloat(requiredHours);
  const totalConfiguredCapHours = sumConfiguredCapHours(capRows);
  const remainingCapHours = Number.isFinite(requiredHoursValue)
    ? Math.max(0, requiredHoursValue - totalConfiguredCapHours)
    : 0;
  const capHoursExceeded = Number.isFinite(requiredHoursValue)
    && requiredHoursValue > 0
    && totalConfiguredCapHours > requiredHoursValue;

  if (loading) return <div className="text-gray-500">Loading settings...</div>;

  const visibleTabs: Tab[] = isAdmin
    ? ["profile", "rules", "security", "notifications", "privacy", "integrations", "data"]
    : ["profile", "security", "notifications", "privacy"];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t === "rules" ? "Service Rules" : t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div data-testid="canvas-integration-card" className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-700 rounded-full flex items-center justify-center text-xl font-semibold text-white select-none">
              {user?.name ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?"}
            </div>
            <div>
              <div className="font-semibold text-lg">{user?.name}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
              {school && (
                <div className="text-sm text-gray-400">
                  {school.name}
                  {!school.verified && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                      Unverified
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              isError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!isAdmin}
                placeholder="e.g. lincoln.edu"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Required Service Hours</label>
              <input
                type="number"
                value={requiredHours}
                onChange={(e) => setRequiredHours(e.target.value)}
                disabled={!isAdmin}
                min="0"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School ZIP Codes <span className="text-gray-400">(comma-separated, for proximity matching)</span>
              </label>
              <input
                type="text"
                value={zipCodes}
                onChange={(e) => setZipCodes(e.target.value)}
                disabled={!isAdmin}
                placeholder="e.g. 02101, 02102"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Address{" "}
                <span className="text-gray-400 font-normal">(used to show nearby partners on the map)</span>
              </label>
              <input
                type="text"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                disabled={!isAdmin}
                placeholder="123 Main St"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <input
                    type="text"
                    value={schoolCity}
                    onChange={(e) => setSchoolCity(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="City"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={schoolState}
                    onChange={(e) => setSchoolState(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="State"
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm uppercase"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={schoolZip}
                    onChange={(e) => setSchoolZip(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="ZIP"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              {school?.latitude && school?.longitude && (
                <p className="mt-1.5 text-xs text-green-600">
                  Location set — map will center on your school.
                </p>
              )}
              {school && !school.latitude && (schoolAddress || schoolCity) && (
                <p className="mt-1.5 text-xs text-amber-600">
                  Save to geocode your address and enable the Discover map.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Partner Invite Template <span className="text-gray-400">(used as the default message for partner invites)</span>
              </label>
              <textarea
                value={partnerInviteTemplate}
                onChange={(e) => setPartnerInviteTemplate(e.target.value)}
                disabled={!isAdmin}
                rows={5}
                placeholder="Tell partners why your school is inviting them and what students need from the partnership."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {isAdmin && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Allow students to join with invite code
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      When off, students cannot join using an invite code.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowJoinByCode}
                    aria-label="Allow students to join with invite code"
                    onClick={handleToggleAllowJoinByCode}
                    disabled={updatingJoinByCode}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      allowJoinByCode ? "bg-blue-600" : "bg-gray-300"
                    } ${updatingJoinByCode ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        allowJoinByCode ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : isAdmin ? "Save Changes" : "Save Profile"}
            </button>
          </form>

          {isAdmin && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Transfer School Ownership</h3>
              <p className="text-sm text-gray-500 mb-4">
                Transfer this school admin role to an existing teacher account. A confirmation email will be sent to your current admin email before anything changes.
              </p>
              {transferMessage && (
                <div className={`mb-4 p-3 rounded-md text-sm ${
                  transferIsError
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-green-50 border border-green-200 text-green-700"
                }`}>
                  {transferMessage}
                </div>
              )}
              <form onSubmit={handleOwnershipTransfer} className="space-y-3">
                <select
                  value={transferTargetEmail}
                  onChange={(e) => setTransferTargetEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  required
                >
                  <option value="">Select a teacher account</option>
                  {staff
                    .filter((member) => member.role === "TEACHER")
                    .map((member) => (
                      <option key={member.id} value={member.email}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={transferringOwnership}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {transferringOwnership ? "Sending..." : "Send Confirmation Email"}
                </button>
              </form>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <button onClick={logout} className="text-red-600 text-sm hover:underline">
              Log Out
            </button>
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div data-testid="google-classroom-integration-card" className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-lg mb-1">Service Rules</h2>
          <p className="text-sm text-gray-500 mb-6">Configure requirements and restrictions for your school's service hours program.</p>

          {rulesMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              rulesIsError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {rulesMessage}
            </div>
          )}
          {!rulesIsError && categoryCapWarnings.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="font-medium mb-2">Students already above a new cap</div>
              <CollapsibleList
                limit={5}
                items={categoryCapWarnings.map((warning) => (
                  <div key={`${warning.studentId}:${warning.category}`}>
                    {warning.message}
                  </div>
                ))}
              />
            </div>
          )}

          <form onSubmit={handleSaveRules} className="space-y-6">
            {/* Section 1: Service Window */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Service Window</h3>
              <p className="text-xs text-gray-500 mb-3">Students cannot log hours outside this date range. Leave blank for no restriction.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={serviceStartDate}
                    onChange={(e) => setServiceStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Deadline)</label>
                  <input
                    type="date"
                    value={serviceEndDate}
                    onChange={(e) => setServiceEndDate(e.target.value)}
                    min={serviceStartDate || undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Self-Submission */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Self-Submitted Hours</h3>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Allow students to self-submit hours</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    When off, students cannot submit hours from activities not organized by a beneficiary partner.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowSelfSubmission}
                  onClick={() => setAllowSelfSubmission((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    allowSelfSubmission ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    allowSelfSubmission ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
            </div>

            {/* Section 3: Verification */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Verification Requirements</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Workflow</label>
                <select
                  value={verificationStandard}
                  onChange={(e) => {
                    const next = e.target.value;
                    setVerificationStandard(next);
                    if (next === "BENEFICIARY_REQUIRED") {
                      setRequireOrgVerification(true);
                    }
                  }}
                  className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="STANDARD">Standard: school staff can review immediately</option>
                  <option value="BENEFICIARY_REQUIRED">Beneficiary-first: partner verification required first</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  This setting now affects actual approval flow for pending verifications.
                </p>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Require beneficiary organization verification before school approval</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    When on, school staff cannot approve legacy service sessions — organization must verify first.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={requireOrgVerification}
                  disabled={verificationStandard === "BENEFICIARY_REQUIRED"}
                  onClick={() => setRequireOrgVerification((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    requireOrgVerification ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    requireOrgVerification ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
            </div>

            {/* Section 4: Category Hour Caps */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Category Hour Caps</h3>
              <p className="text-xs text-gray-500 mb-3">
                Students need {requiredHoursValue || 0} total community service hours. The community service total is fixed by the school requirement below. Category caps carve up that same total and do not add extra hours on top. Leave hours blank for no cap.
              </p>
              <div className="mb-3 grid grid-cols-[1fr_100px_32px] gap-2 items-center">
                <div className="px-2 py-1.5 border border-gray-200 bg-gray-50 rounded text-sm text-gray-700">
                  {REQUIRED_CATEGORY_CAP}
                </div>
                <div className="px-2 py-1.5 border border-gray-200 bg-gray-50 rounded text-sm text-gray-700 text-right">
                  {requiredHoursValue || 0}
                </div>
                <div />
              </div>
              <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${
                capHoursExceeded
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}>
                Configured cap hours: <strong>{totalConfiguredCapHours.toFixed(0)}h</strong>
                {Number.isFinite(requiredHoursValue) && requiredHoursValue > 0 ? (
                  <> of <strong>{requiredHoursValue}h</strong> total required hours · Remaining uncapped hours: <strong>{remainingCapHours.toFixed(0)}h</strong></>
                ) : null}
              </div>
              {capRows.length > 0 && (
                <div className="mb-2 space-y-2">
                  <div className="grid grid-cols-[1fr_100px_32px] gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
                    <div>Category</div>
                    <div>Max Hours</div>
                    <div />
                  </div>
                  {capRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center">
                      <select
                        value={row.category}
                        onChange={(e) => {
                          const next = [...capRows];
                          next[i] = { ...next[i], category: e.target.value };
                          setCapRows(normalizeCapRows(next));
                        }}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Select category</option>
                        {CATEGORY_CAP_OPTIONS.filter((option) => (
                          option === row.category || !capRows.some((capRow, index) => index !== i && capRow.category === option)
                        )).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={row.hours}
                        onChange={(e) => {
                          const next = [...capRows];
                          next[i] = { ...next[i], hours: e.target.value };
                          setCapRows(next);
                        }}
                        min={1}
                        step={1}
                        placeholder="40"
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setCapRows((rows) => rows.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none"
                        aria-label="Remove category"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setCapRows((rows) => [...rows, { category: "", hours: "" }])}
                disabled={capRows.filter((row) => row.category.trim()).length >= CATEGORY_CAP_OPTIONS.length}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add category cap
              </button>
            </div>

            <button
              type="submit"
              disabled={savingRules}
              className="px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {savingRules ? "Saving..." : "Save Service Rules"}
            </button>
          </form>
        </div>
      )}

      {tab === "security" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Change Password</h3>
          {passwordMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              passwordIsError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {passwordMessage}
            </div>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-red-600 mb-1">Delete Account</h3>
            <p className="text-sm text-gray-500 mb-3">
              Permanently deletes your account and removes all associated school data, cohorts, and student associations. This cannot be undone.
            </p>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
              >
                Delete My Account
              </button>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800 mb-3">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-red-300 rounded-md text-sm mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== "DELETE" || deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-1">Notification Preferences</h3>
          <p className="text-sm text-gray-500 mb-6">Choose how you want to be notified.</p>

          {notifMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${notifIsError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
              {notifMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              <div>Notification</div>
              <div className="text-center">Email</div>
              <div className="text-center">In-App</div>
            </div>
            {notifRows.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-3 gap-4 items-center">
                <div className="text-sm font-medium text-gray-700">{label}</div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "email")}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      notifPrefs[key].email ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      notifPrefs[key].email ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "inApp")}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      notifPrefs[key].inApp ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      notifPrefs[key].inApp ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveNotifications}
            disabled={savingNotif}
            className="mt-6 px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {savingNotif ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}

      {tab === "privacy" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-1">Privacy Settings</h3>
          <p className="text-sm text-gray-500 mb-6">Control visibility and message restrictions.</p>

          {privacyMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${privacyIsError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
              {privacyMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Visibility</label>
              <select
                value={msgPrefs.profileVisibility}
                onChange={(e) => setMsgPrefs((p) => ({ ...p, profileVisibility: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="EVERYONE">Everyone</option>
                <option value="SCHOOL">School Only</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Restrictions</label>
              <select
                value={msgPrefs.allowFrom}
                onChange={(e) => setMsgPrefs((p) => ({ ...p, allowFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="EVERYONE">Everyone</option>
                <option value="ORGS_ONLY">Organizations Only</option>
                <option value="ADMINS_ONLY">Admins Only</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSavePrivacy}
            disabled={savingPrivacy}
            className="mt-6 px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {savingPrivacy ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {tab === "data" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-2">Export Activity Log</h3>
          <p className="text-sm text-gray-500 mb-6">
            Download a CSV of all student service sessions at your school.
          </p>
          <button
            onClick={handleExportActivityLog}
            className="px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            Export Activity Log (CSV)
          </button>

          {isAdmin && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Recent Data Access</h3>
                  <p className="text-sm text-gray-500">
                    FERPA audit trail for staff access to student reporting and hour data.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!user?.schoolId) return;
                    setLogsLoading(true);
                    setLogsError("");
                    api.get<DataAccessLogEntry[]>(`/schools/${user.schoolId}/data-access-logs`)
                      .then(setDataAccessLogs)
                      .catch((err: any) => setLogsError(err.message || "Failed to load data access logs"))
                      .finally(() => setLogsLoading(false));
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              {logsError && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {logsError}
                </div>
              )}

              {logsLoading ? (
                <div className="text-sm text-gray-500">Loading access logs...</div>
              ) : dataAccessLogs.length === 0 ? (
                <div className="text-sm text-gray-500">No access events recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  <CollapsibleList
                    limit={10}
                    items={dataAccessLogs.slice(0, 50).map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-gray-200 p-3 overflow-hidden">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 break-words">
                            {entry.actor.name} · {entry.actor.role}
                          </div>
                          <div className="text-xs text-gray-500 break-all">{entry.actor.email}</div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-700 break-words">
                        {entry.action.replaceAll("_", " ")}
                        {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                      </div>
                      {entry.details && (
                        <div className="mt-1 text-xs text-gray-500 break-words">
                          {formatAccessDetails(entry.details)}
                        </div>
                      )}
                    </div>
                  ))} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "integrations" && isAdmin && (
        <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Canvas Integration</h3>
              <p className="text-sm text-gray-500">
                Canvas sync is optional. CSV onboarding remains the default path. Each GoodHours school connects to one Canvas school tenant.
              </p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-medium ${
              canvasStatus?.connection?.status === "CONNECTED"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}>
              {canvasStatus?.connection?.status ?? "DISCONNECTED"}
            </div>
          </div>

          {canvasMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              canvasIsError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {canvasMessage}
            </div>
          )}

          {(canvasStatus?.ops?.warnings?.length ?? 0) > 0 && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <CollapsibleList
                limit={5}
                items={canvasStatus?.ops?.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`}>{warning}</div>
                )) ?? []}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[220px_1fr] mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mock Scenario</label>
              <select
                data-testid="canvas-scenario"
                value={canvasScenario}
                onChange={(e) => setCanvasScenario(e.target.value as typeof canvasScenario)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                disabled={canvasConnectMode !== "MOCK" || canvasStatus?.capabilities?.mockAllowed === false}
              >
            <option value="default">Default</option>
            <option value="renamed">Renamed Courses</option>
            <option value="archived">Archived Course</option>
            <option value="deleted">Deleted Section</option>
            <option value="student_removed">Student Removed</option>
          </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Connection Mode</label>
              <select
                data-testid="canvas-mode"
                value={canvasConnectMode}
                onChange={(e) => setCanvasConnectMode(e.target.value as "MOCK" | "OAUTH")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {(canvasStatus?.capabilities?.mockAllowed ?? true) && <option value="MOCK">Mock Sandbox</option>}
                <option value="OAUTH">Real OAuth</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canvas Base URL</label>
              <input
                data-testid="canvas-base-url"
                type="url"
                value={canvasBaseUrl}
                onChange={(e) => setCanvasBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="https://schoolname.instructure.com"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <div><strong>Connection:</strong> {canvasStatus?.connection?.displayName ?? "Not connected"}</div>
              <div><strong>Base URL:</strong> {canvasStatus?.connection?.baseUrl ?? "N/A"}</div>
              <div><strong>Mode:</strong> {canvasStatus?.connection?.mode ?? canvasConnectMode}</div>
              <div><strong>Last Sync:</strong> {canvasStatus?.connection?.lastSyncedAt ? new Date(canvasStatus.connection.lastSyncedAt).toLocaleString() : "Never"}</div>
              <div><strong>Last Status:</strong> {canvasStatus?.connection?.lastSyncStatus ?? "N/A"}</div>
              <div><strong>Mock Mode:</strong> {canvasStatus?.capabilities?.mockAllowed === false ? "Disabled" : "Available"}</div>
              <div><strong>Scope:</strong> {canvasStatus?.capabilities?.integrationScope === "SINGLE_SCHOOL" ? "Single school" : "N/A"}</div>
              <div><strong>Failures (24h):</strong> {canvasStatus?.ops?.recentJobFailures24h ?? 0}</div>
              <div><strong>Sync Errors (24h):</strong> {canvasStatus?.ops?.recentSyncErrors24h ?? 0}</div>
              <div><strong>Token Refresh Failures (24h):</strong> {canvasStatus?.ops?.tokenRefreshFailures24h ?? 0}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              data-testid="canvas-connect"
              type="button"
              onClick={handleCanvasConnect}
              disabled={canvasBusyAction !== ""}
              className="px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
            >
              {canvasBusyAction === "connect" ? "Connecting..." : canvasConnectMode === "OAUTH" ? "Connect With Canvas OAuth" : "Connect Canvas"}
            </button>
            <button
              data-testid="canvas-disconnect"
              type="button"
              onClick={handleCanvasDisconnect}
              disabled={canvasBusyAction !== "" || !canvasStatus?.connection}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {canvasBusyAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
            </button>
            <button
              data-testid="canvas-preview"
              type="button"
              onClick={handleCanvasPreview}
              disabled={canvasBusyAction !== "" || !canvasStatus?.connection}
              className="px-4 py-2 border border-blue-300 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
            >
              {canvasBusyAction === "preview" ? "Previewing..." : "Preview Sync"}
            </button>
            <button
              data-testid="canvas-apply"
              type="button"
              onClick={handleCanvasApply}
              disabled={canvasBusyAction !== "" || !canvasStatus?.connection}
              className="px-4 py-2 bg-green-700 text-white rounded-md text-sm font-medium hover:bg-green-800 disabled:opacity-50"
            >
              {canvasBusyAction === "apply" ? "Applying..." : "Apply Sync"}
            </button>
          </div>

          {canvasPreview && (
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900 mb-2">Latest Preview Result</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-gray-700 mb-3">
                <div>Cohorts created: {canvasPreview.counts.cohortsCreated}</div>
                <div>Cohorts updated: {canvasPreview.counts.cohortsUpdated}</div>
                <div>Cohorts archived: {canvasPreview.counts.cohortsArchived}</div>
                <div>Teacher assignments: {canvasPreview.counts.teacherAssignmentsCreated}</div>
                <div>Invitations created: {canvasPreview.counts.invitationsCreated}</div>
                <div>Invitations updated: {canvasPreview.counts.invitationsUpdated}</div>
                <div>Existing users linked: {canvasPreview.counts.existingUsersLinked}</div>
                <div>Users assigned: {canvasPreview.counts.usersAssignedToCohort}</div>
                <div>Errors: {canvasPreview.counts.errors}</div>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                {canvasPreview.operations.map((operation, index) => (
                  <div key={`${operation.type}-${index}`}>
                    <strong>{operation.type}</strong> · {operation.action} · {operation.target}
                    {operation.detail ? ` · ${operation.detail}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Recent Sync Jobs</h4>
            {(!canvasStatus?.jobs || canvasStatus.jobs.length === 0) ? (
              <div className="rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                No Canvas sync jobs yet.
              </div>
            ) : (
              <CollapsibleList
                limit={5}
                className="space-y-2"
                items={canvasStatus.jobs.map((job) => (
                  <div key={job.id} className="rounded border border-gray-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong>{job.mode}</strong> · {job.status}
                      </div>
                      <div className="text-gray-500">
                        {new Date(job.startedAt).toLocaleString()}
                      </div>
                    </div>
                    {job.summary && (
                      <div className="mt-2 text-xs text-gray-600">
                        Scenario: {job.summary.scenario} · Cohorts +{job.summary.counts.cohortsCreated} / updated {job.summary.counts.cohortsUpdated} / archived {job.summary.counts.cohortsArchived} · Errors {job.summary.counts.errors}
                      </div>
                    )}
                  </div>
                ))}
              />
            )}
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Recent Sync Errors</h4>
            {canvasErrors.length === 0 ? (
              <div className="rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                No Canvas sync errors recorded.
              </div>
            ) : (
              <CollapsibleList
                limit={5}
                className="space-y-2"
                items={canvasErrors.map((error) => (
                  <div key={error.id} className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <div><strong>{error.code}</strong> · {error.message}</div>
                    <div className="text-xs mt-1">
                      {error.externalType ? `${error.externalType} ${error.externalId ?? ""}` : ""}
                    </div>
                  </div>
                ))}
              />
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Google Classroom Integration</h3>
              <p className="text-sm text-gray-500">
                Google Classroom sync is optional. CSV onboarding remains the default path. Each GoodHours school connects to one Google Classroom school tenant.
              </p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-medium ${
              googleClassroomStatus?.connection?.status === "CONNECTED"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}>
              {googleClassroomStatus?.connection?.status ?? "DISCONNECTED"}
            </div>
          </div>

          {googleClassroomMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              googleClassroomIsError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {googleClassroomMessage}
            </div>
          )}

          {(googleClassroomStatus?.ops?.warnings?.length ?? 0) > 0 && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <CollapsibleList
                limit={5}
                items={googleClassroomStatus?.ops?.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`}>{warning}</div>
                )) ?? []}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[220px_1fr] mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mock Scenario</label>
              <select
                data-testid="google-classroom-scenario"
                value={googleClassroomScenario}
                onChange={(e) => setGoogleClassroomScenario(e.target.value as typeof googleClassroomScenario)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                disabled={googleClassroomConnectMode !== "MOCK" || googleClassroomStatus?.capabilities?.mockAllowed === false}
              >
                <option value="default">Default</option>
                <option value="renamed">Renamed Classes</option>
                <option value="archived">Archived Class</option>
                <option value="deleted">Deleted Class</option>
                <option value="student_removed">Student Removed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Connection Mode</label>
              <select
                data-testid="google-classroom-mode"
                value={googleClassroomConnectMode}
                onChange={(e) => setGoogleClassroomConnectMode(e.target.value as "MOCK" | "OAUTH")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {(googleClassroomStatus?.capabilities?.mockAllowed ?? true) && <option value="MOCK">Mock Sandbox</option>}
                <option value="OAUTH">Real OAuth</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Classroom Base URL</label>
              <input
                data-testid="google-classroom-base-url"
                type="url"
                value={googleClassroomBaseUrl}
                onChange={(e) => setGoogleClassroomBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="https://classroom.googleapis.com"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <div><strong>Connection:</strong> {googleClassroomStatus?.connection?.displayName ?? "Not connected"}</div>
              <div><strong>Base URL:</strong> {googleClassroomStatus?.connection?.baseUrl ?? "N/A"}</div>
              <div><strong>Mode:</strong> {googleClassroomStatus?.connection?.mode ?? googleClassroomConnectMode}</div>
              <div><strong>Last Sync:</strong> {googleClassroomStatus?.connection?.lastSyncedAt ? new Date(googleClassroomStatus.connection.lastSyncedAt).toLocaleString() : "Never"}</div>
              <div><strong>Last Status:</strong> {googleClassroomStatus?.connection?.lastSyncStatus ?? "N/A"}</div>
              <div><strong>Mock Mode:</strong> {googleClassroomStatus?.capabilities?.mockAllowed === false ? "Disabled" : "Available"}</div>
              <div><strong>Scope:</strong> {googleClassroomStatus?.capabilities?.integrationScope === "SINGLE_SCHOOL" ? "Single school" : "N/A"}</div>
              <div><strong>Failures (24h):</strong> {googleClassroomStatus?.ops?.recentJobFailures24h ?? 0}</div>
              <div><strong>Sync Errors (24h):</strong> {googleClassroomStatus?.ops?.recentSyncErrors24h ?? 0}</div>
              <div><strong>Token Refresh Failures (24h):</strong> {googleClassroomStatus?.ops?.tokenRefreshFailures24h ?? 0}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              data-testid="google-classroom-connect"
              type="button"
              onClick={handleGoogleClassroomConnect}
              disabled={googleClassroomBusyAction !== ""}
              className="px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
            >
              {googleClassroomBusyAction === "connect" ? "Connecting..." : googleClassroomConnectMode === "OAUTH" ? "Connect With Google Classroom OAuth" : "Connect Google Classroom"}
            </button>
            <button
              data-testid="google-classroom-disconnect"
              type="button"
              onClick={handleGoogleClassroomDisconnect}
              disabled={googleClassroomBusyAction !== "" || !googleClassroomStatus?.connection}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {googleClassroomBusyAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
            </button>
            <button
              data-testid="google-classroom-preview"
              type="button"
              onClick={handleGoogleClassroomPreview}
              disabled={googleClassroomBusyAction !== "" || !googleClassroomStatus?.connection}
              className="px-4 py-2 border border-blue-300 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
            >
              {googleClassroomBusyAction === "preview" ? "Previewing..." : "Preview Sync"}
            </button>
            <button
              data-testid="google-classroom-apply"
              type="button"
              onClick={handleGoogleClassroomApply}
              disabled={googleClassroomBusyAction !== "" || !googleClassroomStatus?.connection}
              className="px-4 py-2 bg-green-700 text-white rounded-md text-sm font-medium hover:bg-green-800 disabled:opacity-50"
            >
              {googleClassroomBusyAction === "apply" ? "Applying..." : "Apply Sync"}
            </button>
          </div>

          {googleClassroomPreview && (
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900 mb-2">Latest Preview Result</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-gray-700 mb-3">
                <div>Cohorts created: {googleClassroomPreview.counts.cohortsCreated}</div>
                <div>Cohorts updated: {googleClassroomPreview.counts.cohortsUpdated}</div>
                <div>Cohorts archived: {googleClassroomPreview.counts.cohortsArchived}</div>
                <div>Teacher assignments: {googleClassroomPreview.counts.teacherAssignmentsCreated}</div>
                <div>Invitations created: {googleClassroomPreview.counts.invitationsCreated}</div>
                <div>Invitations updated: {googleClassroomPreview.counts.invitationsUpdated}</div>
                <div>Existing users linked: {googleClassroomPreview.counts.existingUsersLinked}</div>
                <div>Users assigned: {googleClassroomPreview.counts.usersAssignedToCohort}</div>
                <div>Errors: {googleClassroomPreview.counts.errors}</div>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                {googleClassroomPreview.operations.map((operation, index) => (
                  <div key={`${operation.type}-${index}`}>
                    <strong>{operation.type}</strong> · {operation.action} · {operation.target}
                    {operation.detail ? ` · ${operation.detail}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Recent Sync Jobs</h4>
            {(!googleClassroomStatus?.jobs || googleClassroomStatus.jobs.length === 0) ? (
              <div className="rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                No Google Classroom sync jobs yet.
              </div>
            ) : (
              <CollapsibleList
                limit={5}
                className="space-y-2"
                items={googleClassroomStatus.jobs.map((job) => (
                  <div key={job.id} className="rounded border border-gray-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong>{job.mode}</strong> · {job.status}
                      </div>
                      <div className="text-gray-500">
                        {new Date(job.startedAt).toLocaleString()}
                      </div>
                    </div>
                    {job.summary && (
                      <div className="mt-2 text-xs text-gray-600">
                        Scenario: {job.summary.scenario} · Cohorts +{job.summary.counts.cohortsCreated} / updated {job.summary.counts.cohortsUpdated} / archived {job.summary.counts.cohortsArchived} · Errors {job.summary.counts.errors}
                      </div>
                    )}
                  </div>
                ))}
              />
            )}
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Recent Sync Errors</h4>
            {googleClassroomErrors.length === 0 ? (
              <div className="rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                No Google Classroom sync errors recorded.
              </div>
            ) : (
              <CollapsibleList
                limit={5}
                className="space-y-2"
                items={googleClassroomErrors.map((error) => (
                  <div key={error.id} className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <div><strong>{error.code}</strong> · {error.message}</div>
                    <div className="text-xs mt-1">
                      {error.externalType ? `${error.externalType} ${error.externalId ?? ""}` : ""}
                    </div>
                  </div>
                ))}
              />
            )}
          </div>
        </div>
        </div>
      )}

      {joinByCodeToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-50 rounded-md border px-4 py-3 text-sm shadow-lg ${
            joinByCodeToast.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {joinByCodeToast.text}
        </div>
      )}
    </div>
  );
}
