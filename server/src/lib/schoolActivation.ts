import crypto from "crypto";
import { hashToken } from "./tokenHash";
import prisma from "./prisma";
import { linkSchoolToBeneficiaryDirectory } from "./schoolBeneficiaryLink";
import { schoolCreatedBeneficiaryPlan } from "./schoolBeneficiaryPolicy";

export type SchoolOwnershipDecision = "APPROVED" | "REJECTED";

/**
 * Independently adjudicate a pending school claim and provision tenant-owned
 * resources only after approval. Directory claiming and approval occur in one
 * transaction so concurrent applicants cannot both become owners.
 */
export async function reviewSchoolOwnership(params: {
  schoolId?: string;
  reviewerId?: string;
  decision: SchoolOwnershipDecision;
  note?: string;
  approvalToken?: string;
}) {
  const candidate = await prisma.school.findFirst({
    where: params.schoolId
      ? { id: params.schoolId }
      : { ownershipApprovalToken: hashToken(params.approvalToken!) },
    select: {
      id: true,
      name: true,
      directoryId: true,
      createdById: true,
      ownershipStatus: true,
      ownershipEvidenceVerifiedAt: true,
      ownershipApprovalToken: true,
      ownershipApprovalTokenExpires: true,
      ownershipApprovalTokenUsedAt: true,
      registrationEmail: true,
    },
  });

  if (!candidate) {
    throw Object.assign(new Error("School application not found"), { status: 404 });
  }
  if (!candidate.createdById) {
    throw Object.assign(new Error("School application has no proposed owner"), { status: 409 });
  }
  if (candidate.ownershipStatus !== "PENDING") {
    throw Object.assign(new Error("School application has already been reviewed"), { status: 409 });
  }
  const tokenApproval = Boolean(params.approvalToken);
  if (!tokenApproval && !params.reviewerId) {
    throw Object.assign(new Error("School ownership reviewer required"), { status: 403 });
  }
  if (!tokenApproval && candidate.createdById === params.reviewerId) {
    throw Object.assign(new Error("School applicants cannot approve their own authority"), { status: 403 });
  }
  if (params.decision === "APPROVED" && !candidate.ownershipEvidenceVerifiedAt && !tokenApproval) {
    throw Object.assign(new Error("School authority evidence has not been verified"), { status: 409 });
  }

  const reviewedAt = new Date();
  const reviewed = await prisma.$transaction(async (tx) => {
    if (params.approvalToken) {
      const consumed = await tx.school.updateMany({
        where: {
          id: candidate.id,
          ownershipStatus: "PENDING",
          ownershipApprovalToken: hashToken(params.approvalToken),
          ownershipApprovalTokenUsedAt: null,
        },
        data: {
          ownershipApprovalTokenUsedAt: reviewedAt,
          ownershipApprovalToken: null,
          ownershipApprovalTokenExpires: null,
        },
      });
      if (consumed.count !== 1) {
        throw Object.assign(new Error("Approval link is invalid, expired, or already used"), { status: 409 });
      }
    }
    const updated = await tx.school.updateMany({
      where: { id: candidate.id, ownershipStatus: "PENDING" },
      data: {
        ownershipStatus: params.decision,
        verified: params.decision === "APPROVED",
        ownershipReviewedAt: reviewedAt,
        ownershipReviewedById: params.reviewerId ?? null,
        ownershipReviewNote: params.note ?? (params.approvalToken ? (params.decision === "APPROVED" ? "Approved by configured business owner email link" : "Rejected by configured business owner email link") : null),
        registrationToken: null,
        registrationTokenExpires: null,
      },
    });
    if (updated.count !== 1) {
      throw Object.assign(new Error("School application has already been reviewed"), { status: 409 });
    }

    if (params.decision === "REJECTED") {
      if (candidate.registrationEmail) {
        await tx.schoolOwnershipBlock.upsert({
          where: { emailHash: hashToken(candidate.registrationEmail) },
          update: { reason: "Rejected by configured business owner email link" },
          create: { emailHash: hashToken(candidate.registrationEmail), schoolId: candidate.id, reason: "Rejected by configured business owner email link" },
        });
      }
      await tx.user.update({
        where: { id: candidate.createdById! },
        data: { tokenVersion: { increment: 1 } },
      });
      return { id: candidate.id, name: candidate.name, ownershipStatus: params.decision };
    }

    if (candidate.directoryId) {
      const claimed = await tx.schoolDirectory.updateMany({
        where: {
          id: candidate.directoryId,
          OR: [
            { claimed: false },
            { claimedBySchoolId: candidate.id },
          ],
        },
        data: { claimed: true, claimedBySchoolId: candidate.id },
      });
      if (claimed.count !== 1) {
        throw Object.assign(new Error("School directory entry is already claimed"), { status: 409 });
      }
    }

    const existingClassroom = await tx.classroom.findFirst({
      where: { schoolId: candidate.id, name: "General" },
      select: { id: true },
    });
    if (!existingClassroom) {
      await tx.classroom.create({
        data: {
          name: "General",
          schoolId: candidate.id,
          teacherId: candidate.createdById!,
          inviteCode: crypto.randomBytes(16).toString("hex"),
        },
      });
    }

    const schoolBeneficiary =
      (await tx.beneficiary.findFirst({
        where: { createdBySchoolId: candidate.id, visibility: "PRIVATE" },
      })) ??
      (await tx.beneficiary.create({
        data: {
          name: candidate.name,
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBySchoolId: candidate.id,
          ...schoolCreatedBeneficiaryPlan("PRIVATE"),
        },
      }));

    await tx.beneficiary.update({
      where: { id: schoolBeneficiary.id },
      data: schoolCreatedBeneficiaryPlan("PRIVATE"),
    });
    await tx.schoolBeneficiaryApproval.upsert({
      where: {
        schoolId_beneficiaryId: {
          schoolId: candidate.id,
          beneficiaryId: schoolBeneficiary.id,
        },
      },
      update: { status: "APPROVED", approvedAt: reviewedAt },
      create: {
        schoolId: candidate.id,
        beneficiaryId: schoolBeneficiary.id,
        status: "APPROVED",
        approvedAt: reviewedAt,
      },
    });

    await tx.user.update({
      where: { id: candidate.createdById! },
      data: { tokenVersion: { increment: 1 } },
    });

    return { id: candidate.id, name: candidate.name, ownershipStatus: params.decision };
  });

  if (params.decision === "APPROVED") {
    await linkSchoolToBeneficiaryDirectory(candidate.id, candidate.directoryId).catch((error) => {
      console.error("[school-ownership] Beneficiary directory link failed:", error);
    });
  }

  return reviewed;
}
