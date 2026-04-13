/**
 * Links a school's auto-created private Beneficiary to its BeneficiaryDirectory entry.
 *
 * Matching path: School.directoryId → SchoolDirectory.ncessId → BeneficiaryDirectory.ncessId
 *
 * Used at registration time so new school accounts are immediately visible on the map
 * and their opportunities appear as verified partner opportunities.
 */
import prisma from "./prisma";

export async function linkSchoolToBeneficiaryDirectory(
  schoolId: string,
  schoolDirectoryId: string | null | undefined
): Promise<void> {
  if (!schoolDirectoryId) return;

  // Resolve the ncessId from the SchoolDirectory entry
  const sdEntry = await prisma.schoolDirectory.findUnique({
    where: { id: schoolDirectoryId },
    select: { ncessId: true },
  });
  if (!sdEntry?.ncessId) return;

  // Find the corresponding BeneficiaryDirectory entry
  const benDir = await prisma.beneficiaryDirectory.findUnique({
    where: { ncessId: sdEntry.ncessId },
    select: { id: true, latitude: true, longitude: true, website: true },
  });
  if (!benDir) return;

  // Find the school's private beneficiary (auto-created on signup)
  const privateBen = await prisma.beneficiary.findFirst({
    where: { createdBySchoolId: schoolId, visibility: "PRIVATE" },
    select: { id: true },
  });
  if (!privateBen) return;

  await prisma.beneficiary.update({
    where: { id: privateBen.id },
    data: {
      directoryId: benDir.id,
      ...(benDir.latitude != null && benDir.longitude != null
        ? { latitude: benDir.latitude, longitude: benDir.longitude }
        : {}),
      ...(benDir.website ? { website: benDir.website } : {}),
    },
  });

  // Mark the directory entry as claimed by this school
  await prisma.beneficiaryDirectory.update({
    where: { id: benDir.id },
    data: { claimed: true },
  });
}
