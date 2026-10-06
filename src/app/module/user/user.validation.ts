import { z } from 'zod';

export const updateProfileValidationSchema = z.object({
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(60, 'Name must be at most 60 characters')
        .optional(),
    phone: z
        .string()
        .regex(/^\+?[0-9\s-]{7,15}$/, 'Invalid phone number format')
        .optional(),
    avatar: z
        .string()
        .url('Avatar must be a valid URL')
        .optional(),
});

export const changePasswordValidationSchema = z.object({
    oldPassword: z
        .string()
        .min(1, 'Old password is required'),
    newPassword: z
        .string()
        .min(6, 'New password must be at least 6 characters')
        .max(64, 'New password must be at most 64 characters'),
});
