import { DeliveryStatus, PaymentStatus, prisma, UserRole, UserStatus } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { createAuditLog } from '../../utils/auditLog';
import {
    IAuditLogFilterOptions,
    IUpdateUserRolePayload,
    IUpdateUserStatusPayload,
    IUserFilterOptions,
} from './admin.interface';

const getAllUsers = async (filters: IUserFilterOptions) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 10);
    const skip = (page - 1) * limit;

    const whereConditions: Record<string, any> = {
        isDeleted: false,
    };

    if (filters.role) {
        whereConditions.role = filters.role;
    }

    if (filters.status) {
        whereConditions.status = filters.status;
    }

    if (filters.search) {
        const searchTerm = filters.search.trim();
        whereConditions.OR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.user.count({ where: whereConditions }),
    ]);

    return {
        data: users,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const updateUserRole = async (
    adminId: string,
    targetUserId: string,
    payload: IUpdateUserRolePayload,
) => {
    if (adminId === targetUserId) {
        throw new AppError(400, 'Admins cannot modify their own role');
    }

    const user = await prisma.user.findUnique({
        where: { id: targetUserId },
    });

    if (!user || user.isDeleted) {
        throw new AppError(404, 'User not found');
    }

    const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { role: payload.role },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            updatedAt: true,
        },
    });

    await createAuditLog({
        userId: adminId,
        action: 'CHANGE_USER_ROLE',
        entity: 'User',
        entityId: targetUserId,
        description: `Admin changed role of ${user.name} from ${user.role} to ${payload.role}`,
    });

    return updated;
};

const updateUserStatus = async (
    adminId: string,
    targetUserId: string,
    payload: IUpdateUserStatusPayload,
) => {
    if (adminId === targetUserId) {
        throw new AppError(400, 'Admins cannot modify their own account status');
    }

    const user = await prisma.user.findUnique({
        where: { id: targetUserId },
    });

    if (!user || user.isDeleted) {
        throw new AppError(404, 'User not found');
    }

    const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { status: payload.status },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            updatedAt: true,
        },
    });

    await createAuditLog({
        userId: adminId,
        action: 'CHANGE_USER_STATUS',
        entity: 'User',
        entityId: targetUserId,
        description: `Admin updated status of ${user.name} from ${user.status} to ${payload.status}`,
    });

    return updated;
};

const getDashboardStats = async () => {
    const [
        totalDeliveries,
        deliveredDeliveries,
        pendingDeliveries,
        inTransitDeliveries,
        cancelledDeliveries,
        revenueAggregate,
        totalUsers,
        totalCustomers,
        totalAgents,
        activeAgents,
    ] = await Promise.all([
        prisma.delivery.count({ where: { isDeleted: false } }),
        prisma.delivery.count({
            where: { status: DeliveryStatus.DELIVERED, isDeleted: false },
        }),
        prisma.delivery.count({
            where: { status: DeliveryStatus.PENDING, isDeleted: false },
        }),
        prisma.delivery.count({
            where: {
                status: {
                    in: [
                        DeliveryStatus.ASSIGNED,
                        DeliveryStatus.ACCEPTED,
                        DeliveryStatus.PICKED_UP,
                        DeliveryStatus.IN_TRANSIT,
                        DeliveryStatus.OUT_FOR_DELIVERY,
                    ],
                },
                isDeleted: false,
            },
        }),
        prisma.delivery.count({
            where: { status: DeliveryStatus.CANCELLED, isDeleted: false },
        }),
        prisma.payment.aggregate({
            _sum: { amount: true },
            _count: { id: true },
            where: { status: PaymentStatus.PAID },
        }),
        prisma.user.count({ where: { isDeleted: false } }),
        prisma.user.count({
            where: { role: UserRole.CUSTOMER, isDeleted: false },
        }),
        prisma.user.count({
            where: { role: UserRole.DELIVERY_AGENT, isDeleted: false },
        }),
        prisma.user.count({
            where: {
                role: UserRole.DELIVERY_AGENT,
                status: UserStatus.ACTIVE,
                isDeleted: false,
            },
        }),
    ]);

    return {
        deliveries: {
            total: totalDeliveries,
            delivered: deliveredDeliveries,
            pending: pendingDeliveries,
            inTransit: inTransitDeliveries,
            cancelled: cancelledDeliveries,
            deliverySuccessRate:
                totalDeliveries > 0
                    ? Number(((deliveredDeliveries / totalDeliveries) * 100).toFixed(2))
                    : 0,
        },
        revenue: {
            totalRevenue: revenueAggregate._sum.amount || 0,
            totalPaidTransactions: revenueAggregate._count.id || 0,
            currency: 'BDT',
        },
        users: {
            totalUsers,
            totalCustomers,
            totalDeliveryAgents: totalAgents,
            activeDeliveryAgents: activeAgents,
        },
    };
};

const getAuditLogs = async (filters: IAuditLogFilterOptions) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 15);
    const skip = (page - 1) * limit;

    const whereConditions: Record<string, any> = {};

    if (filters.entity) {
        whereConditions.entity = filters.entity;
    }

    if (filters.action) {
        whereConditions.action = filters.action;
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        }),
        prisma.auditLog.count({ where: whereConditions }),
    ]);

    return {
        data: logs,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const AdminService = {
    getAllUsers,
    updateUserRole,
    updateUserStatus,
    getDashboardStats,
    getAuditLogs,
};
