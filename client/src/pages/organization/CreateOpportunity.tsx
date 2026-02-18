import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";

export default function CreateOpportunity() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    location: "",
    address: "",
    date: "",
    startTime: "",
    endTime: "",
    durationHours: "",
    capacity: "",
    ageRequirement: "",
    isRecurring: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEditing) {
      api.get<any>(`/opportunities/${id}`).then((opp) => {
        setForm({
          title: opp.title || "",
          description: opp.description || "",
          tags: opp.tags ? JSON.parse(opp.tags).join(", ") : "",
          location: opp.location || "",
          address: opp.address || "",
          date: opp.date ? new Date(opp.date).toISOString().split("T")[0] : "",
          startTime: opp.startTime || "",
          endTime: opp.endTime || "",
          durationHours: opp.durationHours?.toString() || "",
          capacity: opp.capacity?.toString() || "",
          ageRequirement: opp.ageRequirement?.toString() || "",
          isRecurring: opp.isRecurring || false,
        });
      }).catch(() => setError("Failed to load opportunity"));
    }
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        location: form.location,
        address: form.address || undefined,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        durationHours: parseFloat(form.durationHours),
        capacity: parseInt(form.capacity),
        ageRequirement: form.ageRequirement ? parseInt(form.ageRequirement) : undefined,
        isRecurring: form.isRecurring,
      };

      if (isEditing) {
        await api.put(`/opportunities/${id}`, payload);
      } else {
        await api.post("/opportunities", payload);
      }
      navigate("/opportunities");
    } catch (err: any) {
      setError(err.message || `Failed to ${isEditing ? "update" : "create"} opportunity`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? "Edit Opportunity" : "Create Opportunity"}
      </h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="outdoors, cleanup, community"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="123 Main St, Boston MA"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="text"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                required
                placeholder="10:00 AM"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="text"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                required
                placeholder="2:00 PM"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volunteers Needed
              </label>
              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age Requirement (optional)
            </label>
            <input
              type="number"
              name="ageRequirement"
              value={form.ageRequirement}
              onChange={handleChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
            <label className="text-sm font-medium text-gray-700">Recurring Event</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Opportunity")}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-gray-300 rounded-md font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
