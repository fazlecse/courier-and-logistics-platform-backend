import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { DeliveryService } from './delivery.service';

const createDelivery = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.createDelivery(user.userId, user.role, req.body);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Delivery booked successfully',
        data: result,
    });
});

const getAllDeliveries = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { data, meta } = await DeliveryService.getAllDeliveries(
        user.userId,
        user.role,
        req.query,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Deliveries fetched successfully',
        meta,
        data,
    });
});

const getDeliveryById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.getDeliveryById(
        req.params.id as string,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Delivery details fetched successfully',
        data: result,
    });
});

const updateDelivery = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.updateDelivery(
        req.params.id as string,
        user.userId,
        user.role,
        req.body,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Delivery updated successfully',
        data: result,
    });
});

const deleteDelivery = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.deleteDelivery(
        req.params.id as string,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Delivery deleted successfully',
        data: result,
    });
});

const assignAgent = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.assignAgent(
        req.params.id as string,
        user.userId,
        req.body,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Delivery agent assigned successfully',
        data: result,
    });
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.updateStatus(
        req.params.id as string,
        user.userId,
        user.role,
        req.body,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Delivery status updated successfully',
        data: result,
    });
});

const cancelDelivery = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.cancelDelivery(
        req.params.id as string,
        user.userId,
        user.role,
        req.body,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Delivery cancelled successfully',
        data: result,
    });
});

const getDeliveryHistory = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await DeliveryService.getDeliveryHistory(
        req.params.id as string,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Delivery status history fetched successfully',
        data: result,
    });
});

const trackDeliveryByTrackingId = catchAsync(async (req: Request, res: Response) => {
    const result = await DeliveryService.trackDeliveryByTrackingId(
        req.params.trackingId as string,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Shipment tracking information fetched successfully',
        data: result,
    });
});

export const DeliveryController = {
    createDelivery,
    getAllDeliveries,
    getDeliveryById,
    updateDelivery,
    deleteDelivery,
    assignAgent,
    updateStatus,
    cancelDelivery,
    getDeliveryHistory,
    trackDeliveryByTrackingId,
};
