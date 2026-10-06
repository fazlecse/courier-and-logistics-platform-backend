import bcrypt from 'bcryptjs';
import config from '../../config';
import { prisma, UserStatus } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { IChangePasswordPayload, IUpdateProfilePayload } from './user.interface';

const updateProfile = async (userId: string, payload: IUpdateProfilePayload) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user || user.isDeleted) {
        throw new AppError(404, 'User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
        throw new AppError(403, 'User account is not active');
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            name: payload.name ?? user.name,
            phone: payload.phone ?? user.phone,
            avatar: payload.avatar ?? user.avatar,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return updatedUser;
};

const changePassword = async (userId: string, payload: IChangePasswordPayload) => {
    const { oldPassword, newPassword } = payload;

    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user || user.isDeleted) {
        throw new AppError(404, 'User not found');
    }

    if (!user.password) {
        throw new AppError(
            400,
            'This account was created using Google OAuth. Password change is not supported.',
        );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        throw new AppError(400, 'Old password does not match', [
            { field: 'oldPassword', message: 'Incorrect old password' },
        ]);
    }

    if (oldPassword === newPassword) {
        throw new AppError(400, 'New password must be different from old password', [
            { field: 'newPassword', message: 'New password cannot be the same as old password' },
        ]);
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt_salt_rounds);

    await prisma.user.update({
        where: { id: userId },
        data: {
            password: hashedPassword,
        },
    });

    return {
        message: 'Password changed successfully',
    };
};

export const UserService = {
    updateProfile,
    changePassword,
};
