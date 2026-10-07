import bcrypt from 'bcryptjs';
import {
    DeliveryStatus,
    PaymentMethod,
    PaymentStatus,
    prisma,
    UserRole,
    UserStatus,
} from '../src/app/lib/prisma';

const seed = async () => {
    console.log('🌱 Starting database seeding...');

    // 1. Hash demo passwords
    const saltRounds = 10;
    const adminPassword = await bcrypt.hash('Admin@123', saltRounds);
    const agentPassword = await bcrypt.hash('Agent@123', saltRounds);
    const customerPassword = await bcrypt.hash('Customer@123', saltRounds);

    // 2. Seed Users
    console.log('👤 Seeding demo users...');

    const admin = await prisma.user.upsert({
        where: { email: 'admin@courier.com' },
        update: {
            name: 'Platform Administrator',
            password: adminPassword,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
        },
        create: {
            name: 'Platform Administrator',
            email: 'admin@courier.com',
            password: adminPassword,
            phone: '+8801700000001',
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
        },
    });

    const agent = await prisma.user.upsert({
        where: { email: 'agent@courier.com' },
        update: {
            name: 'Delivery Agent One',
            password: agentPassword,
            role: UserRole.DELIVERY_AGENT,
            status: UserStatus.ACTIVE,
        },
        create: {
            name: 'Delivery Agent One',
            email: 'agent@courier.com',
            password: agentPassword,
            phone: '+8801700000002',
            role: UserRole.DELIVERY_AGENT,
            status: UserStatus.ACTIVE,
        },
    });

    const customer = await prisma.user.upsert({
        where: { email: 'customer@courier.com' },
        update: {
            name: 'Demo Customer',
            password: customerPassword,
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
        },
        create: {
            name: 'Demo Customer',
            email: 'customer@courier.com',
            password: customerPassword,
            phone: '+8801700000003',
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
        },
    });

    console.log('✅ Users seeded:');
    console.log('   - Admin:    admin@courier.com    / Admin@123');
    console.log('   - Agent:    agent@courier.com    / Agent@123');
    console.log('   - Customer: customer@courier.com / Customer@123');

    // 3. Seed Deliveries
    console.log('📦 Seeding demo deliveries...');

    // Delivery 1: PENDING
    const delivery1 = await prisma.delivery.upsert({
        where: { trackingId: 'TRK-DEMO-001' },
        update: {},
        create: {
            trackingId: 'TRK-DEMO-001',
            senderName: customer.name,
            senderPhone: customer.phone || '+8801700000003',
            senderAddress: 'House 12, Road 5, Dhanmondi, Dhaka',
            receiverName: 'Kamal Hossain',
            receiverPhone: '+8801811223344',
            receiverAddress: 'Plot 4, Sector 7, Uttara, Dhaka',
            parcelType: 'Documents',
            parcelWeight: 1.0,
            expressDelivery: false,
            deliveryFee: 60,
            status: DeliveryStatus.PENDING,
            customerId: customer.id,
        },
    });

    await prisma.deliveryStatusHistory.createMany({
        data: [
            {
                deliveryId: delivery1.id,
                status: DeliveryStatus.PENDING,
                changedById: customer.id,
                note: 'Delivery booked by customer',
            },
        ],
        skipDuplicates: true,
    });

    // Delivery 2: ASSIGNED
    const delivery2 = await prisma.delivery.upsert({
        where: { trackingId: 'TRK-DEMO-002' },
        update: {},
        create: {
            trackingId: 'TRK-DEMO-002',
            senderName: customer.name,
            senderPhone: customer.phone || '+8801700000003',
            senderAddress: '15 Motijheel C/A, Dhaka',
            receiverName: 'Rahim Uddin',
            receiverPhone: '+8801911223344',
            receiverAddress: 'Nasirabad H/S, Chittagong',
            parcelType: 'Clothing',
            parcelWeight: 2.0,
            expressDelivery: false,
            deliveryFee: 85,
            status: DeliveryStatus.ASSIGNED,
            customerId: customer.id,
            deliveryAgentId: agent.id,
        },
    });

    await prisma.deliveryStatusHistory.createMany({
        data: [
            {
                deliveryId: delivery2.id,
                status: DeliveryStatus.PENDING,
                changedById: customer.id,
                note: 'Delivery booked',
            },
            {
                deliveryId: delivery2.id,
                status: DeliveryStatus.ASSIGNED,
                changedById: admin.id,
                note: `Assigned to delivery agent: ${agent.name}`,
            },
        ],
        skipDuplicates: true,
    });

    // Delivery 3: IN_TRANSIT
    const delivery3 = await prisma.delivery.upsert({
        where: { trackingId: 'TRK-DEMO-003' },
        update: {},
        create: {
            trackingId: 'TRK-DEMO-003',
            senderName: customer.name,
            senderPhone: customer.phone || '+8801700000003',
            senderAddress: 'Gulshan 2, Dhaka',
            receiverName: 'Sultana Begum',
            receiverPhone: '+8801511223344',
            receiverAddress: 'Zindabazar, Sylhet',
            parcelType: 'Electronics & Gadgets',
            parcelWeight: 3.0,
            expressDelivery: true,
            deliveryFee: 160,
            status: DeliveryStatus.IN_TRANSIT,
            customerId: customer.id,
            deliveryAgentId: agent.id,
        },
    });

    await prisma.deliveryStatusHistory.createMany({
        data: [
            {
                deliveryId: delivery3.id,
                status: DeliveryStatus.PENDING,
                changedById: customer.id,
                note: 'Delivery booked',
            },
            {
                deliveryId: delivery3.id,
                status: DeliveryStatus.ASSIGNED,
                changedById: admin.id,
                note: `Assigned to ${agent.name}`,
            },
            {
                deliveryId: delivery3.id,
                status: DeliveryStatus.ACCEPTED,
                changedById: agent.id,
                note: 'Agent accepted package assignment',
            },
            {
                deliveryId: delivery3.id,
                status: DeliveryStatus.PICKED_UP,
                changedById: agent.id,
                note: 'Package picked up from sender',
            },
            {
                deliveryId: delivery3.id,
                status: DeliveryStatus.IN_TRANSIT,
                changedById: agent.id,
                note: 'Package in transit to delivery hub',
            },
        ],
        skipDuplicates: true,
    });

    // Delivery 4: DELIVERED (with PAID payment)
    const delivery4 = await prisma.delivery.upsert({
        where: { trackingId: 'TRK-DEMO-004' },
        update: {},
        create: {
            trackingId: 'TRK-DEMO-004',
            senderName: customer.name,
            senderPhone: customer.phone || '+8801700000003',
            senderAddress: 'Banani 11, Dhaka',
            receiverName: 'Tanvir Ahmed',
            receiverPhone: '+8801611223344',
            receiverAddress: 'Kazir Dewri, Chittagong',
            parcelType: 'Medical Supplies',
            parcelWeight: 1.5,
            expressDelivery: true,
            deliveryFee: 125,
            status: DeliveryStatus.DELIVERED,
            customerId: customer.id,
            deliveryAgentId: agent.id,
        },
    });

    await prisma.deliveryStatusHistory.createMany({
        data: [
            {
                deliveryId: delivery4.id,
                status: DeliveryStatus.PENDING,
                changedById: customer.id,
                note: 'Delivery booked',
            },
            {
                deliveryId: delivery4.id,
                status: DeliveryStatus.ASSIGNED,
                changedById: admin.id,
                note: `Assigned to ${agent.name}`,
            },
            {
                deliveryId: delivery4.id,
                status: DeliveryStatus.ACCEPTED,
                changedById: agent.id,
                note: 'Agent accepted delivery',
            },
            {
                deliveryId: delivery4.id,
                status: DeliveryStatus.PICKED_UP,
                changedById: agent.id,
                note: 'Picked up from sender',
            },
            {
                deliveryId: delivery4.id,
                status: DeliveryStatus.IN_TRANSIT,
                changedById: agent.id,
                note: 'In transit',
            },
            {
                deliveryId: delivery4.id,
                status: DeliveryStatus.OUT_FOR_DELIVERY,
                changedById: agent.id,
                note: 'Out for final delivery to recipient',
            },
            {
                deliveryId: delivery4.id,
                status: DeliveryStatus.DELIVERED,
                changedById: agent.id,
                note: 'Successfully handed over to recipient',
            },
        ],
        skipDuplicates: true,
    });

    // Seed Payment for Delivery 4
    await prisma.payment.upsert({
        where: { deliveryId: delivery4.id },
        update: {},
        create: {
            deliveryId: delivery4.id,
            amount: 125,
            currency: 'USD',
            method: PaymentMethod.STRIPE,
            status: PaymentStatus.PAID,
            transactionId: 'pi_demo_stripe_paid_004',
            sessionId: 'cs_demo_stripe_session_004',
            paidAt: new Date(),
        },
    });

    // 4. Seed Audit Logs
    console.log('📋 Seeding initial audit logs...');
    await prisma.auditLog.createMany({
        data: [
            {
                userId: admin.id,
                action: 'SYSTEM_SEED',
                entity: 'System',
                description: 'Database initialized with demo users, roles, and deliveries',
            },
            {
                userId: admin.id,
                action: 'ASSIGN_AGENT',
                entity: 'Delivery',
                entityId: delivery2.id,
                description: `Assigned agent ${agent.name} to delivery TRK-DEMO-002`,
            },
            {
                userId: customer.id,
                action: 'PAYMENT_COMPLETED',
                entity: 'Payment',
                entityId: delivery4.id,
                description: 'Stripe payment completed for TRK-DEMO-004',
            },
        ],
        skipDuplicates: true,
    });

    console.log('✨ Seeding completed successfully!');
};

seed()
    .catch((error) => {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
