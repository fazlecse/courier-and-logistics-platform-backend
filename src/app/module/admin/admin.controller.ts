import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { AdminService } from './admin.service';

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await AdminService.getAllUsers(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Users fetched successfully',
        meta,
        data,
    });
});

const updateUserRole = catchAsync(async (req: Request, res: Response) => {
    const adminId = req.user!.userId;
    const targetUserId = req.params.id as string;
    const result = await AdminService.updateUserRole(adminId, targetUserId, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User role updated successfully',
        data: result,
    });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
    const adminId = req.user!.userId;
    const targetUserId = req.params.id as string;
    const result = await AdminService.updateUserStatus(adminId, targetUserId, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User status updated successfully',
        data: result,
    });
});

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
    const result = await AdminService.getDashboardStats();

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Dashboard statistics fetched successfully',
        data: result,
    });
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await AdminService.getAuditLogs(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Audit logs fetched successfully',
        meta,
        data,
    });
});

export const AdminController = {
    getAllUsers,
    updateUserRole,
    updateUserStatus,
    getDashboardStats,
    getAuditLogs,
};
