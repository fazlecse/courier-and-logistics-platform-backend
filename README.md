# Courier & Logistics Platform Backend

A robust, scalable, and secure RESTful API for a Courier & Logistics Platform. Built with Node.js, TypeScript, Express.js, Prisma, and PostgreSQL. Supports user authentication (Email/Password + Google OAuth), parcel delivery operations, role-based access control, Stripe payment integration, and comprehensive admin management.

🌐 **Live Production API**: [https://courier-and-logistics-server.vercel.app](https://courier-and-logistics-server.vercel.app)  
🩺 **Health Check Endpoint**: [https://courier-and-logistics-server.vercel.app/health](https://courier-and-logistics-server.vercel.app/health)

## Project Overview

The platform manages delivery operations where:
- **Customers** can register, book parcel deliveries, track shipments, and pay online
- **Delivery Agents** can accept assignments and update delivery status through the workflow
- **Admins** can manage users, assign agents, monitor dashboard statistics, and view audit logs

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime & Framework | Node.js, TypeScript, Express.js 5 |
| Database & ORM | PostgreSQL + Prisma 7 |
| Validation | Zod |
| Authentication | JWT (Access + Refresh tokens), Google OAuth |
| Payments | Stripe (Checkout Sessions + Webhooks) |
| Security | Helmet, CORS, bcryptjs, express-rate-limit |
| Deployment | Vercel (Production Serverless), Render |

## Project Structure

```
src/
  app.ts                  # Express app configuration
  server.ts               # Server entry point
  config/                 # Environment configuration
  lib/                    # Prisma & Stripe clients
  middleware/             # Auth, validation, rate limiting, error handling
  module/
    auth/                 # Authentication (register, login, Google OAuth, refresh)
    user/                 # User profile management
    delivery/             # Delivery CRUD, tracking, status workflow, assignment
    payment/              # Stripe payment initiation, verification, webhooks, refunds
    admin/                # User management, dashboard stats, audit logs
  utils/                  # Helpers (JWT, responses, audit log, pagination, validators)
prisma/
  schema/                 # Prisma schema (modular)
  migrations/             # Database migrations
  seed.ts                 # Seed script with demo data
docs/
  Courier-Logistics-Platform.postman_collection.json
```

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or remote)
- Stripe account (for payments)
- Google Cloud OAuth client (for social login)

## Environment Variables

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/courier_logistics_db"

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_SALT_ROUNDS=10

# URLs
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Google OAuth (GCP)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYMENT_CURRENCY=bdt
```

## Installation & Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed demo data
npm run db:seed

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@courier.com | Admin@123 |
| Agent | agent@courier.com | Agent@123 |
| Customer | customer@courier.com | Customer@123 |

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Register new customer account |
| POST | `/api/v1/auth/login` | Public | Login with email/password |
| POST | `/api/v1/auth/google` | Public | Login/signup with Google ID token |
| GET | `/api/v1/auth/me` | User | Get current user profile |
| POST | `/api/v1/auth/refresh-token` | Public | Refresh access token |
| POST | `/api/v1/auth/logout` | User | Logout (clears cookies) |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PATCH | `/api/v1/users/me` | User | Update profile (name, phone, avatar) |
| PATCH | `/api/v1/users/me/password` | User | Change password |

### Deliveries

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/deliveries` | Customer, Admin | Book a new parcel delivery |
| GET | `/api/v1/deliveries` | User | List deliveries (role-scoped, paginated, filterable, searchable) |
| GET | `/api/v1/deliveries/:id` | User | Get delivery details |
| PATCH | `/api/v1/deliveries/:id` | Customer, Admin | Update delivery (pending only) |
| DELETE | `/api/v1/deliveries/:id` | Customer, Admin | Soft delete delivery |
| POST | `/api/v1/deliveries/:id/assign` | Admin | Assign delivery agent |
| PATCH | `/api/v1/deliveries/:id/status` | Admin, Agent | Update delivery status |
| POST | `/api/v1/deliveries/:id/cancel` | Customer, Admin | Cancel delivery |
| GET | `/api/v1/deliveries/:id/history` | User | Get status history |
| GET | `/api/v1/deliveries/track/:trackingId` | Public | Track parcel by tracking ID |

### Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/payments/initiate` | Customer | Create Stripe Checkout Session |
| GET | `/api/v1/payments/verify/:sessionId` | Public | Verify payment session |
| GET | `/api/v1/payments/:id` | Owner, Admin | Get payment details |
| GET | `/api/v1/payments` | Admin | List all payments (paginated) |
| POST | `/api/v1/payments/webhook` | Stripe | Stripe webhook handler |
| POST | `/api/v1/payments/:id/refund` | Admin | Refund a payment |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/users` | Admin | List users (paginated, filterable, searchable) |
| PATCH | `/api/v1/admin/users/:id/role` | Admin | Change user role |
| PATCH | `/api/v1/admin/users/:id/status` | Admin | Block/unblock user |
| GET | `/api/v1/admin/dashboard-stats` | Admin | Platform statistics |
| GET | `/api/v1/admin/audit-logs` | Admin | Audit trail (paginated) |

### System

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Health check |
| GET | `/` | Public | API info |

## Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error
```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Deliveries fetched successfully",
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

## Delivery Status Workflow

```
PENDING → ASSIGNED → ACCEPTED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
   ↓         ↓          ↓
CANCELLED  CANCELLED  CANCELLED
```

## Payment Flow

1. Customer books a delivery → status PENDING
2. Customer initiates payment → Stripe Checkout Session created
3. Customer pays on Stripe's hosted page
4. Stripe sends webhook → payment marked PAID
5. Admin assigns agent → status ASSIGNED
6. Agent progresses delivery through workflow
7. On DELIVERY → status DELIVERED

## Deployment

### Vercel (Current Production Deployment)

- **Production Live URL**: [https://courier-and-logistics-server.vercel.app](https://courier-and-logistics-server.vercel.app)
- **Health Check**: [https://courier-and-logistics-server.vercel.app/health](https://courier-and-logistics-server.vercel.app/health)
- Deployed via Vercel CLI / Git integration with zero-config serverless rewrites (`api/index.ts`).

### Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Build Command: `npm install && npx prisma generate && npm run build`
4. Start Command: `npm start`
5. Add environment variables in Render dashboard
6. Set `DATABASE_URL` to your PostgreSQL connection string

### Database

The project uses Prisma with PostgreSQL. For production:
- Use a managed PostgreSQL provider (Render, Supabase, Neon, or Prisma's hosted DB)
- Run `npx prisma migrate deploy` to apply migrations
- Run `npm run db:seed` to populate demo data

## Postman Collection

Import `docs/Courier-Logistics-Platform.postman_collection.json` into Postman for interactive API testing. The collection includes all endpoints with example request bodies and environment variables.

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- JWT-based authentication with refresh token rotation
- Role-based access control (3 roles: CUSTOMER, DELIVERY_AGENT, ADMIN)
- Rate limiting (300 req/15min general, 20 req/15min auth)
- Helmet security headers
- CORS configuration
- Zod input validation on all applicable endpoints
- Soft deletes for data integrity
- Audit logging for critical actions
- Stripe webhook signature verification

## License

ISC
