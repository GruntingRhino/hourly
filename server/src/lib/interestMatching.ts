export interface InterestProfile { optedIn: boolean; approvedTags: string[]; }
export interface MatchCandidate { id: string; tags: string[]; }

export function rankInterestMatches(profile: InterestProfile, candidates: MatchCandidate[]): MatchCandidate[] {
  if (!profile.optedIn) return candidates;
  const interests = new Set(profile.approvedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  return candidates
    .map((candidate, index) => ({ candidate, index, score: candidate.tags.reduce((sum, tag) => sum + (interests.has(tag.trim().toLowerCase()) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ candidate }) => candidate);
}
