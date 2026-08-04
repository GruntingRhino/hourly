import { useState, useEffect, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";

interface CustomField {
  label: string;
  value: string;
}

interface OpportunityResponse {
  title?: string;
  description?: string;
  location?: string;
  address?: string;
  date?: unknown;
  startTime?: string;
  endTime?: string;
  durationHours?: number | string;
  capacity?: number | string;
  ageRequirement?: number | string;
  isRecurring?: boolean;
  recurringPattern?: string;
  tags?: string;
  customFields?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDateForInput(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];
  }
  const dt = new Date(value as string);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().split("T")[0];
}

export default function CreateOpportunity() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    address: "",
    date: "",
    startTime: "",
    endTime: "",
    durationHours: "",
    capacity: "",
    ageRequirement: "",
    isRecurring: false,
    recurringPattern: "",
  });

  // Chip tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEditing) {
      queueMicrotask(() => setLoadingExisting(false));
      return;
    }

    let active = true;
    queueMicrotask(() => setLoadingExisting(true));

    (async () => {
      try {
        const opp = await api.get<OpportunityResponse>(`/opportunities/${id}`);
        if (!active) return;

        setForm({
          title: opp.title || "",
          description: opp.description || "",
          location: opp.location || "",
          address: opp.address || "",
          date: formatDateForInput(opp.date),
          startTime: opp.startTime || "",
          endTime: opp.endTime || "",
          durationHours: opp.durationHours?.toString() || "",
          capacity: opp.capacity?.toString() || "",
          ageRequirement: opp.ageRequirement?.toString() || "",
          isRecurring: opp.isRecurring || false,
          recurringPattern: opp.recurringPattern || "",
        });
        try {
          setTags(opp.tags ? JSON.parse(opp.tags) : []);
        } catch {
          setTags([]);
        }
        try {
          setCustomFields(opp.customFields ? JSON.parse(opp.customFields) : []);
        } catch {
          setCustomFields([]);
        }
      } catch {
        if (active) setError("Failed to load opportunity");
      } finally {
        if (active) setLoadingExisting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().replace(/,$/, "");
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { label: "", value: "" }]);
  };

  const updateCustomField = (index: number, field: keyof CustomField, value: string) => {
    setCustomFields(customFields.map((cf, i) => i === index ? { ...cf, [field]: value } : cf));
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        tags,
        location: form.location,
        address: form.address || undefined,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        durationHours: parseFloat(form.durationHours),
        capacity: parseInt(form.capacity),
        ageRequirement: form.ageRequirement ? parseInt(form.ageRequirement) : undefined,
        isRecurring: form.isRecurring,
        recurringPattern: form.isRecurring ? form.recurringPattern || undefined : undefined,
        customFields: customFields.filter((f) => f.label.trim()).length > 0
          ? JSON.stringify(customFields.filter((f) => f.label.trim()))
          : undefined,
      };

      if (isEditing) {
        // Wait for confirmed success before redirecting — a fire-and-forget
        // write here previously navigated away immediately regardless of
        // whether the PUT actually succeeded, so a failed update looked
        // identical to a successful one.
        await api.put(`/opportunities/${id}`, payload);

        const params = new URLSearchParams({
          updatedId: String(id || ""),
          updatedTitle: form.title,
          updatedDate: form.date,
          updatedStartTime: form.startTime,
          updatedEndTime: form.endTime,
          updatedLocation: form.location,
          updatedCapacity: String(parseInt(form.capacity) || 0),
        });
        navigate(`/opportunities?${params.toString()}`);
      } else {
        await api.post("/opportunities", payload);
        navigate("/opportunities");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to ${isEditing ? "update" : "create"} opportunity`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-[20px] font-semibold mb-5">
        {isEditing ? "Edit Opportunity" : "Create Opportunity"}
      </h1>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
        {isEditing && loadingExisting && (
          <div className="mb-4 text-sm text-[var(--text-sec)]">Loading opportunity...</div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
            {error}
          </div>
        )}

        {!loadingExisting && (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Event Name</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={3}
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
            />
          </div>

          {/* Chip tag input */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 p-2 border border-[var(--border-s)] rounded-[2px] min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[var(--in-bg)] text-[var(--action)] rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-blue-400 hover:text-[var(--action)] font-bold leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                name="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => {
                  const val = tagInput.trim();
                  if (val && !tags.includes(val)) setTags([...tags, val]);
                  setTagInput("");
                }}
                placeholder={tags.length === 0 ? "Type tag and press Enter or comma" : ""}
                className="flex-1 min-w-20 outline-none text-sm bg-transparent"
              />
            </div>
            <p className="text-xs text-[var(--text-faint)] mt-1">Press Enter or comma to add a tag</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Location</label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Address <span className="text-[var(--text-faint)]">(optional)</span>
            </label>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="123 Main St, Boston MA"
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Start Time</label>
              <input
                type="text"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                required
                placeholder="10:00 AM"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">End Time</label>
              <input
                type="text"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                required
                placeholder="2:00 PM"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                Duration (hours)
              </label>
              <input
                type="number"
                name="durationHours"
                value={form.durationHours}
                onChange={handleChange}
                required
                step="0.5"
                min="0.5"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                Volunteers Needed
              </label>
              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={handleChange}
                required
                min="1"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Age Requirement (optional)
            </label>
            <input
              type="number"
              name="ageRequirement"
              value={form.ageRequirement}
              onChange={handleChange}
              min="0"
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isRecurring"
              checked={form.isRecurring}
              onChange={handleChange}
              className="w-4 h-4"
            />
            <label className="text-sm font-medium text-[var(--text)]">Recurring Event</label>
          </div>

          {form.isRecurring && (
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                Recurring Pattern
              </label>
              <input
                type="text"
                name="recurringPattern"
                value={form.recurringPattern}
                onChange={handleChange}
                placeholder="e.g. Weekly on Saturdays"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
          )}

          {/* Custom Fields */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-[var(--text)]">Custom Fields</label>
              <button
                type="button"
                onClick={addCustomField}
                className="text-xs text-[var(--action)] hover:text-[var(--navy)] font-medium"
              >
                + Add Field
              </button>
            </div>
            {customFields.length === 0 && (
              <p className="text-xs text-[var(--text-faint)]">Add custom fields to display extra information on your event.</p>
            )}
            <div className="space-y-2">
              {customFields.map((cf, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    name={`customFields.${i}.label`}
                    value={cf.label}
                    onChange={(e) => updateCustomField(i, "label", e.target.value)}
                    placeholder="Field label"
                    className="flex-1 px-2 py-1.5 border border-[var(--border-s)] rounded-[2px] text-sm"
                  />
                  <input
                    type="text"
                    name={`customFields.${i}.value`}
                    value={cf.value}
                    onChange={(e) => updateCustomField(i, "value", e.target.value)}
                    placeholder="Field value"
                    className="flex-1 px-2 py-1.5 border border-[var(--border-s)] rounded-[2px] text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomField(i)}
                    className="text-red-400 hover:text-[var(--er-t)] text-lg leading-none px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-[7px] bg-[var(--action)] text-white rounded-[2px] font-medium hover:opacity-85 disabled:opacity-50"
            >
              {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Opportunity")}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-[var(--border-s)] rounded-[2px] font-medium hover:bg-[var(--surface-alt)]"
            >
              Cancel
            </button>
          </div>
          </form>
        )}
      </div>
    </div>
  );
}
