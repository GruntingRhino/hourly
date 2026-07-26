import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { SCHOOL_CREATED_BENEFICIARY_PLAN } from "../lib/schoolBeneficiaryPolicy";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

async function getSchoolId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
  return user?.schoolId ?? null;
}

async function getSchoolAdminUserIds(schoolId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { schoolId, role: "SCHOOL_ADMIN" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function getOrCreateSchoolBeneficiary(schoolId: string): Promise<{ id: string }> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
  const existing = await prisma.beneficiary.findFirst({
    where: { createdBySchoolId: schoolId, visibility: "PRIVATE" },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.beneficiary.create({
    data: {
      name: school?.name ?? "School",
      visibility: "PRIVATE",
      createdBySchoolId: schoolId,
      ...SCHOOL_CREATED_BENEFICIARY_PLAN,
      status: "ACTIVE",
    },
    select: { id: true },
  });
}

// POST /api/school-partners — send a partnership request to another school
router.post("/", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const fromSchoolId = await getSchoolId(req.user!.userId);
    if (!fromSchoolId) return res.status(404).json({ error: "No school found" });

    const { toSchoolId, message } = req.body;
    if (!toSchoolId || typeof toSchoolId !== "string") {
      return res.status(400).json({ error: "toSchoolId required" });
    }
    if (toSchoolId === fromSchoolId) {
      return res.status(400).json({ error: "Cannot partner with your own school" });
    }

    const toSchool = await prisma.school.findUnique({ where: { id: toSchoolId }, select: { id: true, name: true } });
    if (!toSchool) return res.status(404).json({ error: "Target school not found" });

    const fromSchool = await prisma.school.findUnique({ where: { id: fromSchoolId }, select: { name: true } });

    // Check for existing request
    const existing = await prisma.schoolPartnerRequest.findFirst({
      where: {
        OR: [
          { fromSchoolId, toSchoolId },
          { fromSchoolId: toSchoolId, toSchoolId: fromSchoolId },
        ],
      },
    });
    if (existing) {
      if (existing.status === "APPROVED") return res.status(400).json({ error: "Schools are already partners" });
      if (existing.status === "PENDING") return res.status(400).json({ error: "A partnership request is already pending" });
    }

    const request = await prisma.schoolPartnerRequest.create({
      data: { fromSchoolId, toSchoolId, message: message ?? null },
    });

    // Notify all admins of the target school
    const adminIds = await getSchoolAdminUserIds(toSchoolId);
    if (adminIds.length > 0) {
      await prisma.notification.createMany({
        data: adminIds.map((userId) => ({
          userId,
          type: "SCHOOL_PARTNER_REQUEST",
          title: `${fromSchool?.name ?? "A school"} wants to partner with you`,
          body: message
            ? `"${message}"`
            : `${fromSchool?.name ?? "A school"} has sent a partnership request. Approve it to share opportunities with their students.`,
          data: JSON.stringify({ href: "/partners?tab=requests", requestId: request.id }),
        })),
      });
    }

    res.status(201).json({ id: request.id, status: request.status });
  } catch (err: any) {
    console.error("[schoolPartners] send error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/school-partners/requests — incoming + outgoing requests for this school
router.get("/requests", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolId(req.user!.userId);
    if (!schoolId) return res.status(404).json({ error: "No school found" });

    const requests = await prisma.schoolPartnerRequest.findMany({
      where: { OR: [{ fromSchoolId: schoolId }, { toSchoolId: schoolId }] },
      include: {
        fromSchool: { select: { id: true, name: true, city: true, state: true } },
        toSchool:   { select: { id: true, name: true, city: true, state: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(requests.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      direction: r.fromSchoolId === schoolId ? "outgoing" : "incoming",
      fromSchool: r.fromSchool,
      toSchool: r.toSchool,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
    })));
  } catch (err) {
    console.error("[schoolPartners] list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/school-partners/requests/:id/respond — approve or reject
router.post("/requests/:id/respond", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schoolId = await getSchoolId(req.user!.userId);
    if (!schoolId) return res.status(404).json({ error: "No school found" });

    const { approve } = req.body;
    if (typeof approve !== "boolean") return res.status(400).json({ error: "approve (boolean) required" });

    const request = await prisma.schoolPartnerRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toSchoolId !== schoolId) return res.status(403).json({ error: "Not authorized" });
    if (request.status !== "PENDING") return res.status(400).json({ error: "Request already resolved" });

    const newStatus = approve ? "APPROVED" : "REJECTED";

    await prisma.schoolPartnerRequest.update({
      where: { id: req.params.id },
      data: { status: newStatus, respondedAt: new Date() },
    });

    if (approve) {
      // Ensure both schools have private beneficiary profiles
      const [fromBen, toBen] = await Promise.all([
        getOrCreateSchoolBeneficiary(request.fromSchoolId),
        getOrCreateSchoolBeneficiary(request.toSchoolId),
      ]);

      // Create mutual SchoolBeneficiaryApprovals (each school approves the other's private beneficiary)
      await prisma.schoolBeneficiaryApproval.upsert({
        where: { schoolId_beneficiaryId: { schoolId: request.toSchoolId, beneficiaryId: fromBen.id } },
        create: { schoolId: request.toSchoolId, beneficiaryId: fromBen.id, status: "APPROVED", approvedAt: new Date() },
        update: { status: "APPROVED", approvedAt: new Date() },
      });
      await prisma.schoolBeneficiaryApproval.upsert({
        where: { schoolId_beneficiaryId: { schoolId: request.fromSchoolId, beneficiaryId: toBen.id } },
        create: { schoolId: request.fromSchoolId, beneficiaryId: toBen.id, status: "APPROVED", approvedAt: new Date() },
        update: { status: "APPROVED", approvedAt: new Date() },
      });

      // Notify the requesting school's admins
      const toSchool = await prisma.school.findUnique({ where: { id: request.toSchoolId }, select: { name: true } });
      const adminIds = await getSchoolAdminUserIds(request.fromSchoolId);
      if (adminIds.length > 0) {
        await prisma.notification.createMany({
          data: adminIds.map((userId) => ({
            userId,
            type: "SCHOOL_PARTNER_APPROVED",
            title: `${toSchool?.name ?? "A school"} accepted your partnership request`,
            body: "You can now share opportunities with each other's students.",
            data: JSON.stringify({ href: "/partners" }),
          })),
        });
      }
    }

    res.json({ status: newStatus });
  } catch (err) {
    console.error("[schoolPartners] respond error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
