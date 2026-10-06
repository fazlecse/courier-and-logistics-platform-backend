import { z } from 'zod';

export const initiatePaymentValidationSchema = z.object({
    deliveryId: z.string().uuid('Invalid delivery ID format'),
});

export const refundPaymentValidationSchema = z.object({
    reason: z.string().max(255, 'Reason cannot exceed 255 characters').optional(),
});
