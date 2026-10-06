import { Router } from 'express';
import { UserRole } from '../../lib/prisma';
import { auth } from '../../middleware/checkAuth';
import { validateRequest } from '../../middleware/validateRequest';
import { UserController } from './user.controller';
import {
    changePasswordValidationSchema,
    updateProfileValidationSchema,
} from './user.validation';

const router = Router();

router.patch(
    '/me',
    auth(UserRole.CUSTOMER, UserRole.DELIVERY_AGENT, UserRole.ADMIN),
    validateRequest(updateProfileValidationSchema),
    UserController.updateProfile,
);

router.patch(
    '/me/password',
    auth(UserRole.CUSTOMER, UserRole.DELIVERY_AGENT, UserRole.ADMIN),
    validateRequest(changePasswordValidationSchema),
    UserController.changePassword,
);

export const UserRoutes = router;
