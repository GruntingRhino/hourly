export function buildAnonymousVolunteerLabel(id: string): string {
  return `Volunteer ${id.replace(/-/g, "").slice(-6).toUpperCase()}`;
}
