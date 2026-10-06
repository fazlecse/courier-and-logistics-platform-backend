import {
    DeliveryStatus,
    prisma,
    UserRole,
    UserStatus,
} from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { createAuditLog } from '../../utils/auditLog';
import {
    IAssignAgentPayload,
    ICancelDeliveryPayload,
    ICreateDeliveryPayload,
    IDeliveryFilterOptions,
    IUpdateDeliveryPayload,
    IUpdateStatusPayload,
} from './delivery.interface';

// Delivery fee calculation
const calculateDeliveryFee = (weight: number = 1, isExpress: boolean = false): number => {
    const baseFee = 60;
    const additionalWeightFee = weight > 1 ? Math.ceil((weight - 1) * 25) : 0;
    const expressFee = isExpress ? 50 : 0;
    return baseFee + additionalWeightFee + expressFee;
};

// Unique tracking ID generation
const generateTrackingId = (): string => {
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const timePart = Date.now().toString(36).slice(-4).toUpperCase();
    return `TRK-${timePart}-${randomPart}`;
};

// Allowed lifecycle transitions
const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
    [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
    [DeliveryStatus.ASSIGNED]: [DeliveryStatus.ACCEPTED, DeliveryStatus.CANCELLED],
    [DeliveryStatus.ACCEPTED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED],
    [DeliveryStatus.PICKED_UP]: [DeliveryStatus.IN_TRANSIT],
    [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.OUT_FOR_DELIVERY],
    [DeliveryStatus.OUT_FOR_DELIVERY]: [DeliveryStatus.DELIVERED],
    [DeliveryStatus.DELIVERED]: [],
    [DeliveryStatus.CANCELLED]: [],
};

const createDelivery = async (
    userId: string,
    userRole: UserRole,
    payload: ICreateDeliveryPayload,
) => {
    let customerId = userId;

    if (userRole === UserRole.ADMIN && payload.customerId) {
        const customer = await prisma.user.findUnique({
            where: { id: payload.customerId },
        });
        if (!customer || customer.isDeleted) {
            throw new AppError(404, 'Customer specified not found');
        }
        customerId = payload.customerId;
    }

    const deliveryFee = calculateDeliveryFee(
        payload.parcelWeight ?? 1,
        payload.expressDelivery ?? false,
    );

    let trackingId = generateTrackingId();
    let isUnique = false;
    while (!isUnique) {
        const existing = await prisma.delivery.findUnique({ where: { trackingId } });
        if (!existing) {
            isUnique = true;
        } else {
            trackingId = generateTrackingId();
        }
    }

    const result = await prisma.$transaction(async (tx) => {
        const delivery = await tx.delivery.create({
            data: {
                trackingId,
                senderName: payload.senderName,
                senderPhone: payload.senderPhone,
                senderAddress: payload.senderAddress,
                receiverName: payload.receiverName,
                receiverPhone: payload.receiverPhone,
                receiverAddress: payload.receiverAddress,
                parcelType: payload.parcelType,
                parcelWeight: payload.parcelWeight ?? 1,
                expressDelivery: payload.expressDelivery ?? false,
                deliveryFee,
                status: DeliveryStatus.PENDING,
                customerId,
            },
            include: {
                customer: {
                    select: { id: true, name: true, email: true, phone: true },
                },
                statusHistory: true,
            },
        });

        await tx.deliveryStatusHistory.create({
            data: {
                deliveryId: delivery.id,
                status: DeliveryStatus.PENDING,
                changedById: userId,
                note: 'Delivery booked by customer',
            },
        });

        return delivery;
    });

    await createAuditLog({
        userId,
        action: 'CREATE_DELIVERY',
        entity: 'Delivery',
        entityId: result.id,
        description: `Delivery booked with tracking ID: ${trackingId}`,
    });

    return result;
};

const getAllDeliveries = async (
    userId: string,
    userRole: UserRole,
    filters: IDeliveryFilterOptions,
) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 10);
    const skip = (page - 1) * limit;

    const whereConditions: Record<string, any> = {
        isDeleted: false,
    };

    // Role-based visibility
    if (userRole === UserRole.CUSTOMER) {
        whereConditions.customerId = userId;
    } else if (userRole === UserRole.DELIVERY_AGENT) {
        whereConditions.deliveryAgentId = userId;
    }

    // Status filter
    if (filters.status) {
        whereConditions.status = filters.status;
    }

    // Search filter
    if (filters.search) {
        const searchTerm = filters.search.trim();
        whereConditions.OR = [
            { trackingId: { contains: searchTerm, mode: 'insensitive' } },
            { senderName: { contains: searchTerm, mode: 'insensitive' } },
            { receiverName: { contains: searchTerm, mode: 'insensitive' } },
            { receiverPhone: { contains: searchTerm, mode: 'insensitive' } },
            { parcelType: { contains: searchTerm, mode: 'insensitive' } },
        ];
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [deliveries, total] = await Promise.all([
        prisma.delivery.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: {
                customer: {
                    select: { id: true, name: true, email: true, phone: true },
                },
                deliveryAgent: {
                    select: { id: true, name: true, email: true, phone: true },
                },
                payment: {
                    select: { id: true, amount: true, status: true, method: true, paidAt: true },
                },
            },
        }),
        prisma.delivery.count({
            where: whereConditions,
        }),
    ]);

    return {
        data: deliveries,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const getDeliveryById = async (
    deliveryId: string,
    userId: string,
    userRole: UserRole,
) => {
    const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
            customer: {
                select: { id: true, name: true, email: true, phone: true },
            },
            deliveryAgent: {
                select: { id: true, name: true, email: true, phone: true },
            },
            payment: true,
            statusHistory: {
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    // Access control
    if (userRole === UserRole.CUSTOMER && delivery.customerId !== userId) {
        throw new AppError(403, 'Forbidden. You do not have permission to view this delivery');
    }

    if (userRole === UserRole.DELIVERY_AGENT && delivery.deliveryAgentId !== userId) {
        throw new AppError(403, 'Forbidden. You do not have permission to view this delivery');
    }

    return delivery;
};

const updateDelivery = async (
    deliveryId: string,
    userId: string,
    userRole: UserRole,
    payload: IUpdateDeliveryPayload,
) => {
    const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    if (userRole === UserRole.CUSTOMER && delivery.customerId !== userId) {
        throw new AppError(403, 'Forbidden. You cannot update this delivery');
    }

    if (delivery.status !== DeliveryStatus.PENDING) {
        throw new AppError(
            400,
            `Cannot update delivery. Only deliveries in PENDING status can be edited (current status: ${delivery.status})`,
        );
    }

    const parcelWeight = payload.parcelWeight ?? (delivery.parcelWeight || 1);
    const expressDelivery = payload.expressDelivery ?? delivery.expressDelivery;
    const deliveryFee = calculateDeliveryFee(parcelWeight, expressDelivery);

    const updated = await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
            senderName: payload.senderName ?? delivery.senderName,
            senderPhone: payload.senderPhone ?? delivery.senderPhone,
            senderAddress: payload.senderAddress ?? delivery.senderAddress,
            receiverName: payload.receiverName ?? delivery.receiverName,
            receiverPhone: payload.receiverPhone ?? delivery.receiverPhone,
            receiverAddress: payload.receiverAddress ?? delivery.receiverAddress,
            parcelType: payload.parcelType ?? delivery.parcelType,
            parcelWeight,
            expressDelivery,
            deliveryFee,
        },
        include: {
            customer: {
                select: { id: true, name: true, email: true, phone: true },
            },
        },
    });

    await createAuditLog({
        userId,
        action: 'UPDATE_DELIVERY',
        entity: 'Delivery',
        entityId: deliveryId,
        description: `Delivery updated while PENDING`,
    });

    return updated;
};

const deleteDelivery = async (
    deliveryId: string,
    userId: string,
    userRole: UserRole,
) => {
    const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    if (userRole === UserRole.CUSTOMER && delivery.customerId !== userId) {
        throw new AppError(403, 'Forbidden. You cannot delete this delivery');
    }

    if (delivery.status !== DeliveryStatus.PENDING && delivery.status !== DeliveryStatus.CANCELLED) {
        throw new AppError(
            400,
            `Cannot delete delivery once in progress. Only PENDING or CANCELLED deliveries can be deleted`,
        );
    }

    // Soft delete
    await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
        },
    });

    await createAuditLog({
        userId,
        action: 'SOFT_DELETE_DELIVERY',
        entity: 'Delivery',
        entityId: deliveryId,
        description: `Delivery soft-deleted`,
    });

    return { message: 'Delivery successfully deleted' };
};

const assignAgent = async (
    deliveryId: string,
    adminId: string,
    payload: IAssignAgentPayload,
) => {
    const agent = await prisma.user.findUnique({
        where: { id: payload.deliveryAgentId },
    });

    if (!agent || agent.isDeleted) {
        throw new AppError(404, 'Delivery agent not found');
    }

    if (agent.role !== UserRole.DELIVERY_AGENT) {
        throw new AppError(400, 'Assigned user must have DELIVERY_AGENT role');
    }

    if (agent.status !== UserStatus.ACTIVE) {
        throw new AppError(400, 'Cannot assign an inactive or blocked delivery agent');
    }

    const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    if (delivery.status === DeliveryStatus.CANCELLED || delivery.status === DeliveryStatus.DELIVERED) {
        throw new AppError(400, `Cannot assign agent to a delivery that is ${delivery.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.delivery.update({
            where: { id: deliveryId },
            data: {
                deliveryAgentId: payload.deliveryAgentId,
                status: DeliveryStatus.ASSIGNED,
            },
            include: {
                customer: { select: { id: true, name: true, phone: true } },
                deliveryAgent: { select: { id: true, name: true, phone: true } },
            },
        });

        await tx.deliveryStatusHistory.create({
            data: {
                deliveryId,
                status: DeliveryStatus.ASSIGNED,
                changedById: adminId,
                note: `Delivery assigned to agent: ${agent.name}`,
            },
        });

        return res;
    });

    await createAuditLog({
        userId: adminId,
        action: 'ASSIGN_DELIVERY_AGENT',
        entity: 'Delivery',
        entityId: deliveryId,
        description: `Assigned agent ${agent.name} (${agent.id}) to delivery`,
    });

    return updated;
};

const updateStatus = async (
    deliveryId: string,
    userId: string,
    userRole: UserRole,
    payload: IUpdateStatusPayload,
) => {
    const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    if (userRole === UserRole.DELIVERY_AGENT) {
        if (delivery.deliveryAgentId !== userId) {
            throw new AppError(403, 'Forbidden. You are not assigned to this delivery');
        }
    }

    const allowed = allowedTransitions[delivery.status] || [];

    // Delivery agent must follow strict workflow
    if (userRole === UserRole.DELIVERY_AGENT && !allowed.includes(payload.status)) {
        throw new AppError(
            400,
            `Invalid status transition from ${delivery.status} to ${payload.status}. Allowed next: ${allowed.join(', ') || 'None'}`,
        );
    }

    const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.delivery.update({
            where: { id: deliveryId },
            data: {
                status: payload.status,
            },
            include: {
                customer: { select: { id: true, name: true, phone: true } },
                deliveryAgent: { select: { id: true, name: true, phone: true } },
            },
        });

        await tx.deliveryStatusHistory.create({
            data: {
                deliveryId,
                status: payload.status,
                changedById: userId,
                note: payload.note || `Status updated to ${payload.status}`,
            },
        });

        return res;
    });

    await createAuditLog({
        userId,
        action: 'UPDATE_DELIVERY_STATUS',
        entity: 'Delivery',
        entityId: deliveryId,
        description: `Status changed from ${delivery.status} to ${payload.status}`,
    });

    return updated;
};

const cancelDelivery = async (
    deliveryId: string,
    userId: string,
    userRole: UserRole,
    payload: ICancelDeliveryPayload,
) => {
    const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    if (userRole === UserRole.CUSTOMER && delivery.customerId !== userId) {
        throw new AppError(403, 'Forbidden. You cannot cancel this delivery');
    }

    const nonCancellableStatuses: DeliveryStatus[] = [
        DeliveryStatus.PICKED_UP,
        DeliveryStatus.IN_TRANSIT,
        DeliveryStatus.OUT_FOR_DELIVERY,
        DeliveryStatus.DELIVERED,
    ];

    if (nonCancellableStatuses.includes(delivery.status)) {
        throw new AppError(
            400,
            `Cannot cancel delivery. Package is already ${delivery.status}`,
        );
    }

    if (delivery.status === DeliveryStatus.CANCELLED) {
        throw new AppError(400, 'Delivery is already cancelled');
    }

    const result = await prisma.$transaction(async (tx) => {
        const res = await tx.delivery.update({
            where: { id: deliveryId },
            data: {
                status: DeliveryStatus.CANCELLED,
            },
        });

        await tx.deliveryStatusHistory.create({
            data: {
                deliveryId,
                status: DeliveryStatus.CANCELLED,
                changedById: userId,
                note: payload.reason || 'Delivery cancelled',
            },
        });

        return res;
    });

    await createAuditLog({
        userId,
        action: 'CANCEL_DELIVERY',
        entity: 'Delivery',
        entityId: deliveryId,
        description: `Delivery cancelled. Reason: ${payload.reason || 'Not specified'}`,
    });

    return result;
};

const getDeliveryHistory = async (
    deliveryId: string,
    userId: string,
    userRole: UserRole,
) => {
    const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    if (userRole === UserRole.CUSTOMER && delivery.customerId !== userId) {
        throw new AppError(403, 'Forbidden. You do not have permission to view history');
    }

    if (userRole === UserRole.DELIVERY_AGENT && delivery.deliveryAgentId !== userId) {
        throw new AppError(403, 'Forbidden. You do not have permission to view history');
    }

    const history = await prisma.deliveryStatusHistory.findMany({
        where: { deliveryId },
        orderBy: { createdAt: 'asc' },
    });

    return history;
};

const trackDeliveryByTrackingId = async (trackingId: string) => {
    const delivery = await prisma.delivery.findUnique({
        where: { trackingId },
        select: {
            id: true,
            trackingId: true,
            status: true,
            parcelType: true,
            parcelWeight: true,
            expressDelivery: true,
            senderAddress: true,
            receiverAddress: true,
            createdAt: true,
            updatedAt: true,
            statusHistory: {
                select: {
                    id: true,
                    status: true,
                    note: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    if (!delivery) {
        throw new AppError(404, `No parcel found with tracking ID: ${trackingId}`);
    }

    return delivery;
};

export const DeliveryService = {
    createDelivery,
    getAllDeliveries,
    getDeliveryById,
    updateDelivery,
    deleteDelivery,
    assignAgent,
    updateStatus,
    cancelDelivery,
    getDeliveryHistory,
    trackDeliveryByTrackingId,
};
