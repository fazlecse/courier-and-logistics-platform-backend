import { DeliveryStatus } from '../../lib/prisma';

export interface ICreateDeliveryPayload {
    senderName: string;
    senderPhone: string;
    senderAddress: string;
    receiverName: string;
    receiverPhone: string;
    receiverAddress: string;
    parcelType: string;
    parcelWeight?: number;
    expressDelivery?: boolean;
    customerId?: string;
}

export interface IUpdateDeliveryPayload {
    senderName?: string;
    senderPhone?: string;
    senderAddress?: string;
    receiverName?: string;
    receiverPhone?: string;
    receiverAddress?: string;
    parcelType?: string;
    parcelWeight?: number;
    expressDelivery?: boolean;
}

export interface IAssignAgentPayload {
    deliveryAgentId: string;
}

export interface IUpdateStatusPayload {
    status: DeliveryStatus;
    note?: string;
}

export interface ICancelDeliveryPayload {
    reason?: string;
}

export interface IDeliveryFilterOptions {
    page?: number;
    limit?: number;
    status?: DeliveryStatus;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
