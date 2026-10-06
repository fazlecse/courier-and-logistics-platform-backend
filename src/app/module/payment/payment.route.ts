import { Router } from 'express';
import { UserRole } from '../../lib/prisma';
import { auth } from '../../middleware/checkAuth';
import { validateRequest } from '../../middleware/validateRequest';
import { PaymentController } from './payment.controller';
import {
    initiatePaymentValidationSchema,
    refundPaymentValidationSchema,
} from './payment.validation';

const router = Router();

// Stripe Webhook (No auth, called by Stripe servers)
router.post('/webhook', PaymentController.handleWebhook);

// Initiate checkout session (Customer or Admin)
router.post(
    '/initiate',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    validateRequest(initiatePaymentValidationSchema),
    PaymentController.initiatePayment,
);

// Verify checkout session
router.get('/verify/:sessionId', PaymentController.verifyPayment);

// Admin refund endpoint
router.post(
    '/:id/refund',
    auth(UserRole.ADMIN),
    validateRequest(refundPaymentValidationSchema),
    PaymentController.refundPayment,
);

// List all payments (Admin only, paginated)
router.get(
    '/',
    auth(UserRole.ADMIN),
    PaymentController.getAllPayments,
);

// Get single payment details (Customer or Admin)
router.get(
    '/:id',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    PaymentController.getPaymentById,
);

export const PaymentRoutes = router;
