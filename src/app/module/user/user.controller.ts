import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { UserService } from './user.service';

const updateProfile = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await UserService.updateProfile(userId, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Profile updated successfully',
        data: result,
    });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await UserService.changePassword(userId, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Password changed successfully',
        data: result,
    });
});

export const UserController = {
    updateProfile,
    changePassword,
};
