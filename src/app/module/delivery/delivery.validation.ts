import { z } from 'zod';
import { DeliveryStatus } from '../../lib/prisma';

export const createDeliveryValidationSchema = z.object({
    senderName: z.string().min(2, 'Sender name is required'),
    senderPhone: z.string().regex(/^\+?[0-9\s-]{7,15}$/, 'Invalid sender phone number'),
    senderAddress: z.string().min(5, 'Sender address must be at least 5 characters'),
    receiverName: z.string().min(2, 'Receiver name is required'),
    receiverPhone: z.string().regex(/^\+?[0-9\s-]{7,15}$/, 'Invalid receiver phone number'),
    receiverAddress: z.string().min(5, 'Receiver address must be at least 5 characters'),
    parcelType: z.string().min(2, 'Parcel type is required'),
    parcelWeight: z.number().positive('Parcel weight must be positive').optional(),
    expressDelivery: z.boolean().optional(),
    customerId: z.string().uuid('Invalid customer ID format').optional(),
});

export const updateDeliveryValidationSchema = z.object({
    senderName: z.string().min(2).optional(),
    senderPhone: z.string().regex(/^\+?[0-9\s-]{7,15}$/).optional(),
    senderAddress: z.string().min(5).optional(),
    receiverName: z.string().min(2).optional(),
    receiverPhone: z.string().regex(/^\+?[0-9\s-]{7,15}$/).optional(),
    receiverAddress: z.string().min(5).optional(),
    parcelType: z.string().min(2).optional(),
    parcelWeight: z.number().positive().optional(),
    expressDelivery: z.boolean().optional(),
});

export const assignAgentValidationSchema = z.object({
    deliveryAgentId: z.string().uuid('Invalid delivery agent ID format'),
});

export const updateStatusValidationSchema = z.object({
    status: z.nativeEnum(DeliveryStatus),
    note: z.string().max(255).optional(),
});

export const cancelDeliveryValidationSchema = z.object({
    reason: z.string().max(255).optional(),
});
