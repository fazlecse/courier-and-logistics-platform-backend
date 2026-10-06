import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { PaymentService } from './payment.service';

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await PaymentService.initiatePayment(user.userId, user.role, req.body);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Payment session initiated successfully',
        data: result,
    });
});

const verifyPayment = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.verifyPayment(req.params.sessionId as string);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Payment verification completed',
        data: result,
    });
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody = (req as any).rawBody || req.body;
    const result = await PaymentService.handleWebhook(rawBody, signature);

    res.status(httpStatus.OK).json(result);
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await PaymentService.getPaymentById(
        req.params.id as string,
        user.userId,
        user.role,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Payment details fetched successfully',
        data: result,
    });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await PaymentService.getAllPayments(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Payments fetched successfully',
        meta,
        data,
    });
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
    const adminId = req.user!.userId;
    const result = await PaymentService.refundPayment(
        req.params.id as string,
        adminId,
        req.body,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Payment refunded successfully',
        data: result,
    });
});

export const PaymentController = {
    initiatePayment,
    verifyPayment,
    handleWebhook,
    getPaymentById,
    getAllPayments,
    refundPayment,
};
