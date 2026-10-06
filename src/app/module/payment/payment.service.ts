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

    let session: { id: string; url: string | null } = null as any;

    const hasRealStripeKey =
        config.stripe_secret_key &&
        !config.stripe_secret_key.includes('mock') &&
        !config.stripe_secret_key.includes('placeholder');

    if (hasRealStripeKey) {
        try {
            session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `Delivery Fee (${delivery.trackingId})`,
                                description: `Parcel Type: ${delivery.parcelType} | Sender: ${delivery.senderName}`,
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
            throw new AppError(500, `Stripe session creation failed: ${err.message}`);
        }
    } else {
        // Safe development simulation for testing endpoints before adding production key
        const mockSessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        session = {
            id: mockSessionId,
            url: `https://checkout.stripe.com/pay/${mockSessionId}`,
        };
    }

    const payment = await prisma.payment.upsert({
        where: { deliveryId: delivery.id },
        update: {
            amount: delivery.deliveryFee,
            currency: 'BDT',
            method: PaymentMethod.STRIPE,
            status: PaymentStatus.PENDING,
            sessionId: session.id,
            paymentUrl: session.url,
        },
        create: {
            deliveryId: delivery.id,
            amount: delivery.deliveryFee,
            currency: 'BDT',
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

    const hasRealStripeKey =
        config.stripe_secret_key &&
        !config.stripe_secret_key.includes('mock') &&
        !config.stripe_secret_key.includes('placeholder');

    if (!hasRealStripeKey || sessionId.startsWith('cs_test_')) {
        const updated = await prisma.payment.update({
            where: { sessionId },
            data: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                transactionId: `pi_test_${Date.now()}`,
            },
            include: { delivery: true },
        });

        await createAuditLog({
            userId: payment.delivery.customerId,
            action: 'PAYMENT_VERIFIED_SUCCESS',
            entity: 'Payment',
            entityId: updated.id,
            description: `Payment marked PAID via test verification for tracking: ${updated.delivery.trackingId}`,
        });

        return updated;
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const updated = await prisma.payment.update({
                where: { sessionId },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                    transactionId: (session.payment_intent as string) || session.id,
                },
                include: { delivery: true },
            });

            await createAuditLog({
                userId: payment.delivery.customerId,
                action: 'PAYMENT_VERIFIED_SUCCESS',
                entity: 'Payment',
                entityId: updated.id,
                description: `Payment marked PAID via verification for tracking: ${updated.delivery.trackingId}`,
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
    let event: Stripe.Event;

    try {
        if (config.stripe_webhook_secret && signature) {
            event = stripe.webhooks.constructEvent(
                payload,
                signature,
                config.stripe_webhook_secret,
            );
        } else {
            event = payload;
        }
    } catch (err: any) {
        throw new AppError(400, `Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;

        const payment = await prisma.payment.findUnique({
            where: { sessionId },
            include: { delivery: true },
        });

        if (payment && payment.status !== PaymentStatus.PAID) {
            await prisma.payment.update({
                where: { sessionId },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                    transactionId: (session.payment_intent as string) || session.id,
                },
            });

            await createAuditLog({
                userId: payment.delivery.customerId,
                action: 'STRIPE_WEBHOOK_PAYMENT_PAID',
                entity: 'Payment',
                entityId: payment.id,
                description: `Payment marked PAID via Stripe webhook for tracking: ${payment.delivery.trackingId}`,
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

    // Call Stripe refund if transactionId exists
    if (payment.transactionId && !payment.transactionId.startsWith('mock_')) {
        try {
            await stripe.refunds.create({
                payment_intent: payment.transactionId,
                reason: 'requested_by_customer',
            });
        } catch (error: any) {
            console.warn('Stripe refund API call warning:', error.message);
        }
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
