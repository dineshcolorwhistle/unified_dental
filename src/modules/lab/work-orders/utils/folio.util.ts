import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service';

/**
 * Generate the next sequential folio number for a branch.
 * Format: <BranchCode><4-digit sequential> e.g. CRIMA0145
 *
 * This function calculates the next sequential number by parsing all existing
 * numerical suffixes for work orders under the branch code in the tenant, ensuring
 * that deleted work orders or gaps do not cause collisions or duplicates.
 */
export async function generateFolioNumber(
  prisma: PrismaService,
  tenantId: string,
  branchId: string,
): Promise<string> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { id: true, code: true, name: true },
  });

  if (!branch) {
    throw new NotFoundException(`Branch with ID "${branchId}" not found in this tenant.`);
  }

  // Use branch.code or derive a 3-5 letter prefix from branch name
  let prefix = (branch.code || '').trim().toUpperCase();
  if (!prefix) {
    prefix = branch.name
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 4)
      .toUpperCase();
    if (prefix.length < 3) {
      prefix = (prefix + 'LAB').substring(0, 4);
    }
  }

  // Fetch all existing folio numbers for this tenant starting with branch prefix
  const existingOrders = await prisma.workOrder.findMany({
    where: {
      tenantId,
      folioNumber: {
        startsWith: prefix,
      },
    },
    select: {
      folioNumber: true,
    },
  });

  let maxNum = 0;
  const prefixLength = prefix.length;

  for (const wo of existingOrders) {
    const suffix = wo.folioNumber.substring(prefixLength);
    const match = suffix.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `${prefix}${nextNum.toString().padStart(4, '0')}`;

  // Collision safety fallback loop
  while (
    await prisma.workOrder.findFirst({
      where: { tenantId, folioNumber: candidate },
      select: { id: true },
    })
  ) {
    nextNum++;
    candidate = `${prefix}${nextNum.toString().padStart(4, '0')}`;
  }

  return candidate;
}
