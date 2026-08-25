import { Request, Response, NextFunction } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

/**
 * §18 legacy model consolidation: the legacy ORG_ADMIN / Organization /
 * Opportunity system has no client UI (ORG_ADMIN gets a hardcoded "Account
 * Upgrade Required" page) and no real accounts left, but its write API
 * routes stayed reachable directly. This blocks new legacy write activity
 * at the API layer, matching the client's existing block — apply to
 * create/edit/cancel/announce-shaped routes only. Existing legacy data
 * (historical Signups/ServiceSessions, already-created Opportunities) is
 * untouched and remains fully readable/actionable everywhere it already
 * was (reports, hour totals, audit trails, student-side session
 * check-in/checkout/verification, school-side approval) — this only stops
 * new legacy Organizations/Opportunities from being created or modified.
 */
export function blockFrozenLegacyOrgAdminWrite(req: Request, res: Response) {
  res.status(410).json({
    error: "This account type has been discontinued. Please contact support or sign up again as a Beneficiary Admin.",
    code: "LEGACY_ORG_ADMIN_FROZEN",
  });
}
