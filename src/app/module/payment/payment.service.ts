import Stripe from 'stripe';
import config from '../../config';
import {
    PaymentMethod,
    PaymentStatus,
    prisma,
    UserRole,
} from '../../lib/prisma';
import { stripe } from '../../lib/stripe';
import { AppError } from '../../utils/AppError';
import { createAuditLog } from '../../utils/auditLog';
import {
    IInitiatePaymentPayload,
    IPaymentFilterOptions,
    IRefundPaymentPayload,
} from './payment.interface';

const initiatePayment = async (
    userId: string,
    userRole: UserRole,
    payload: IInitiatePaymentPayload,
) => {
    if (!config.stripe_secret_key) {
        throw new AppError(
            500,
            'Stripe payment gateway is not configured. Please set STRIPE_SECRET_KEY in your .env file.',
        );
    }

    const delivery = await prisma.delivery.findUnique({
        where: { id: payload.deliveryId },
        include: { payment: true },
    });

    if (!delivery || delivery.isDeleted) {
        throw new AppError(404, 'Delivery not found');
    }

    if (userRole === UserRole.CUSTOMER && delivery.customerId !== userId) {
        throw new AppError(403, 'Forbidden. You do not have permission to pay for this delivery');
    }

    if (delivery.status === 'CANCELLED') {
        throw new AppError(400, 'Cannot initiate payment for a cancelled delivery');
    }

    if (delivery.payment && delivery.payment.status === PaymentStatus.PAID) {
        throw new AppError(400, 'This delivery has already been paid for');
    }

    let session: Stripe.Checkout.Session;

    try {
        session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Delivery Fee (${delivery.trackingId})`,
                            description: `Parcel: ${delivery.parcelType} | Sender: ${delivery.senderName} | Receiver: ${delivery.receiverName}`,
                        },
                        unit_amount: Math.max(100, Math.round((delivery.deliveryFee / 110) * 100)),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${config.frontend_url}/payment/success?session_id={CHECKOUT_SESSION_ID}&trackingId=${delivery.trackingId}`,
            cancel_url: `${config.frontend_url}/payment/cancel?deliveryId=${delivery.id}`,
            metadata: {
                deliveryId: delivery.id,
                userId,
                trackingId: delivery.trackingId,
            },
        });
    } catch (err: any) {
        throw new AppError(500, `Stripe payment session creation failed: ${err.message}`);
    }

    const payment = await prisma.payment.upsert({
        where: { deliveryId: delivery.id },
        update: {
            amount: delivery.deliveryFee,
            currency: 'USD',
            method: PaymentMethod.STRIPE,
            status: PaymentStatus.PENDING,
            sessionId: session.id,
            paymentUrl: session.url,
        },
        create: {
            deliveryId: delivery.id,
            amount: delivery.deliveryFee,
            currency: 'USD',
            method: PaymentMethod.STRIPE,
            status: PaymentStatus.PENDING,
            sessionId: session.id,
            paymentUrl: session.url,
        },
    });

    await createAuditLog({
        userId,
        action: 'INITIATE_PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        description: `Stripe checkout session initiated for delivery: ${delivery.trackingId}`,
    });

    return {
        paymentId: payment.id,
        sessionId: session.id,
        paymentUrl: session.url,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
    };
};

const verifyPayment = async (sessionId: string) => {
    if (!config.stripe_secret_key) {
        throw new AppError(
            500,
            'Stripe payment gateway is not configured. Please set STRIPE_SECRET_KEY in your .env file.',
        );
    }

    const payment = await prisma.payment.findUnique({
        where: { sessionId },
        include: { delivery: true },
    });

    if (!payment) {
        throw new AppError(404, 'Payment record not found for this session');
    }

    if (payment.status === PaymentStatus.PAID) {
        return payment;
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const transactionId =
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.id;

            const updated = await prisma.payment.update({
                where: { sessionId },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                    transactionId,
                },
                include: { delivery: true },
            });

            await createAuditLog({
                userId: payment.delivery.customerId,
                action: 'PAYMENT_VERIFIED_SUCCESS',
                entity: 'Payment',
                entityId: updated.id,
                description: `Payment confirmed PAID via Stripe verification for tracking: ${updated.delivery.trackingId}`,
            });

            return updated;
        }

        return {
            status: payment.status,
            message: 'Payment has not been completed on Stripe yet',
        };
    } catch (error: any) {
        throw new AppError(500, `Stripe verification failed: ${error.message}`);
    }
};

const handleWebhook = async (payload: Buffer | any, signature?: string) => {
    if (!config.stripe_webhook_secret) {
        throw new AppError(
            500,
            'STRIPE_WEBHOOK_SECRET is not configured in .env file',
        );
    }

    if (!signature) {
        throw new AppError(400, 'Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            payload,
            signature,
            config.stripe_webhook_secret,
        );
    } catch (err: any) {
        throw new AppError(400, `Stripe Webhook Signature Verification Failed: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;

        const payment = await prisma.payment.findUnique({
            where: { sessionId },
            include: { delivery: true },
        });

        if (payment && payment.status !== PaymentStatus.PAID) {
            const transactionId =
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.id;

            await prisma.payment.update({
                where: { sessionId },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                    transactionId,
                },
            });

            await createAuditLog({
                userId: payment.delivery.customerId,
                action: 'STRIPE_WEBHOOK_PAYMENT_PAID',
                entity: 'Payment',
                entityId: payment.id,
                description: `Payment marked PAID via verified Stripe webhook for tracking: ${payment.delivery.trackingId}`,
            });
        }
    } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const payment = await prisma.payment.findFirst({
            where: { transactionId: paymentIntent.id },
        });

        if (payment) {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: PaymentStatus.FAILED,
                    failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
                },
            });
        }
    }

    return { received: true };
};

const getPaymentById = async (
    paymentId: string,
    userId: string,
    userRole: UserRole,
) => {
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            delivery: {
                select: {
                    id: true,
                    trackingId: true,
                    customerId: true,
                    deliveryFee: true,
                    status: true,
                },
            },
        },
    });

    if (!payment) {
        throw new AppError(404, 'Payment not found');
    }

    if (userRole === UserRole.CUSTOMER && payment.delivery.customerId !== userId) {
        throw new AppError(403, 'Forbidden. You do not have permission to view this payment');
    }

    return payment;
};

const getAllPayments = async (filters: IPaymentFilterOptions) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 10);
    const skip = (page - 1) * limit;

    const whereConditions: Record<string, any> = {};

    if (filters.status) {
        whereConditions.status = filters.status;
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [payments, total] = await Promise.all([
        prisma.payment.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: {
                delivery: {
                    select: {
                        id: true,
                        trackingId: true,
                        senderName: true,
                        receiverName: true,
                        customer: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        }),
        prisma.payment.count({ where: whereConditions }),
    ]);

    return {
        data: payments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const refundPayment = async (
    paymentId: string,
    adminId: string,
    payload: IRefundPaymentPayload,
) => {
    if (!config.stripe_secret_key) {
        throw new AppError(
            500,
            'Stripe payment gateway is not configured. Please set STRIPE_SECRET_KEY in your .env file.',
        );
    }

    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { delivery: true },
    });

    if (!payment) {
        throw new AppError(404, 'Payment not found');
    }

    if (payment.status !== PaymentStatus.PAID) {
        throw new AppError(
            400,
            `Cannot refund payment. Payment status is ${payment.status} (must be PAID)`,
        );
    }

    if (!payment.transactionId) {
        throw new AppError(400, 'Cannot refund payment without a valid transaction ID from Stripe');
    }

    // Call real Stripe Refund API
    try {
        await stripe.refunds.create({
            payment_intent: payment.transactionId,
            reason: 'requested_by_customer',
        });
    } catch (error: any) {
        throw new AppError(500, `Stripe refund failed: ${error.message}`);
    }

    const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            status: PaymentStatus.REFUNDED,
            refundedAt: new Date(),
            refundReason: payload.reason || 'Admin initiated refund',
        },
        include: { delivery: true },
    });

    await createAuditLog({
        userId: adminId,
        action: 'REFUND_PAYMENT',
        entity: 'Payment',
        entityId: paymentId,
        description: `Payment refunded by admin for tracking ID: ${payment.delivery.trackingId}`,
    });

    return updated;
};

export const PaymentService = {
    initiatePayment,
    verifyPayment,
    handleWebhook,
    getPaymentById,
    getAllPayments,
    refundPayment,
};
