import { PaymentStatus } from '../../lib/prisma';

export interface IInitiatePaymentPayload {
    deliveryId: string;
}

export interface IRefundPaymentPayload {
    reason?: string;
}

export interface IPaymentFilterOptions {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
