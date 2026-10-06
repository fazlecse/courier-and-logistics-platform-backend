import { Router } from 'express';
import { UserRole } from '../../lib/prisma';
import { auth } from '../../middleware/checkAuth';
import { validateRequest } from '../../middleware/validateRequest';
import { DeliveryController } from './delivery.controller';
import {
    assignAgentValidationSchema,
    cancelDeliveryValidationSchema,
    createDeliveryValidationSchema,
    updateDeliveryValidationSchema,
    updateStatusValidationSchema,
} from './delivery.validation';

const router = Router();

// Public tracking
router.get('/track/:trackingId', DeliveryController.trackDeliveryByTrackingId);

// Book delivery
router.post(
    '/',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    validateRequest(createDeliveryValidationSchema),
    DeliveryController.createDelivery,
);

// List deliveries (scoped by role, paginated, filterable, searchable)
router.get(
    '/',
    auth(UserRole.CUSTOMER, UserRole.DELIVERY_AGENT, UserRole.ADMIN),
    DeliveryController.getAllDeliveries,
);

// Get single delivery details
router.get(
    '/:id',
    auth(UserRole.CUSTOMER, UserRole.DELIVERY_AGENT, UserRole.ADMIN),
    DeliveryController.getDeliveryById,
);

// Update pending delivery
router.patch(
    '/:id',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    validateRequest(updateDeliveryValidationSchema),
    DeliveryController.updateDelivery,
);

// Soft delete delivery
router.delete(
    '/:id',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    DeliveryController.deleteDelivery,
);

// Assign delivery agent (Admin only)
router.post(
    '/:id/assign',
    auth(UserRole.ADMIN),
    validateRequest(assignAgentValidationSchema),
    DeliveryController.assignAgent,
);

// Update delivery status workflow (Admin or Agent)
router.patch(
    '/:id/status',
    auth(UserRole.ADMIN, UserRole.DELIVERY_AGENT),
    validateRequest(updateStatusValidationSchema),
    DeliveryController.updateStatus,
);

// Cancel delivery (Customer or Admin)
router.post(
    '/:id/cancel',
    auth(UserRole.CUSTOMER, UserRole.ADMIN),
    validateRequest(cancelDeliveryValidationSchema),
    DeliveryController.cancelDelivery,
);

// Get status history timeline
router.get(
    '/:id/history',
    auth(UserRole.CUSTOMER, UserRole.DELIVERY_AGENT, UserRole.ADMIN),
    DeliveryController.getDeliveryHistory,
);

export const DeliveryRoutes = router;
