import { Router } from 'express';
import { UserRole } from '../../lib/prisma';
import { auth } from '../../middleware/checkAuth';
import { validateRequest } from '../../middleware/validateRequest';
import { AdminController } from './admin.controller';
import {
    updateUserRoleValidationSchema,
    updateUserStatusValidationSchema,
} from './admin.validation';

const router = Router();

// All Admin routes require ADMIN role
router.use(auth(UserRole.ADMIN));

// Platform dashboard statistics
router.get('/dashboard-stats', AdminController.getDashboardStats);

// System audit logs with pagination
router.get('/audit-logs', AdminController.getAuditLogs);

// List users with pagination, filter by role/status, and search
router.get('/users', AdminController.getAllUsers);

// Change user role
router.patch(
    '/users/:id/role',
    validateRequest(updateUserRoleValidationSchema),
    AdminController.updateUserRole,
);

// Change user account status (block / unblock)
router.patch(
    '/users/:id/status',
    validateRequest(updateUserStatusValidationSchema),
    AdminController.updateUserStatus,
);

export const AdminRoutes = router;
