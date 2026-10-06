import { z } from 'zod';
import { UserRole, UserStatus } from '../../lib/prisma';

export const updateUserRoleValidationSchema = z.object({
    role: z.nativeEnum(UserRole),
});

export const updateUserStatusValidationSchema = z.object({
    status: z.nativeEnum(UserStatus),
});
