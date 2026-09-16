import { prisma } from './prisma';

export async function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  actorId: string,
  details?: string
) {
  await prisma.auditLog.create({
    data: { entityType, entityId, action, actorId, details },
  });
}
