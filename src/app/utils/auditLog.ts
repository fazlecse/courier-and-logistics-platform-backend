import { prisma } from '../lib/prisma';

interface ICreateAuditLog {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    description?: string;
}

export const createAuditLog = async (data: ICreateAuditLog) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                description: data.description,
            },
        });
    } catch (error) {
        // Log error but don't fail the primary transaction/action
        console.error('Failed to create audit log:', error);
    }
};
