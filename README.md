# Courier & Logistics Platform Backend

This project is the backend API for a Courier and Logistics Platform built using Node.js, TypeScript, Express.js, Prisma, and PostgreSQL. It supports user authentication, parcel delivery operations, role-based access, and tracking-related features for a logistics system.

## Project Overview

The platform is designed for managing delivery operations where:
- customers can register and send parcels,
- admins can manage the system,
- delivery agents can handle assigned deliveries,
- users can track and monitor parcel status.

This backend provides the foundation for a modern courier and logistics application.

## Features

- User registration and login
- JWT-based authentication
- Refresh token support
- Cookie-based auth flow
- Role-based access control
- Delivery management support
- Parcel tracking and status history
- Payment integration support
- Audit logging
- Prisma ORM with PostgreSQL
- Centralized error handling
- Request validation with Zod

## Tech Stack

- Node.js
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- JWT
- bcryptjs
- Zod
- CORS
- Helmet
- dotenv

## Folder Structure

```bash
src/
  app.ts
  server.ts
  config/
  lib/
  middleware/
  module/
    auth/
  utils/
prisma/
  schema/
  migrations/
generated/
  prisma/
```

## Prerequisites

Before running this project, make sure you have:

- Node.js installed
- PostgreSQL database installed and running
- npm installed

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
PORT=5000
DATABASE_URL="postgresql://username:password@localhost:5432/courier_logistics_db"
FRONTEND_URL="http://localhost:3000"
JWT_ACCESS_SECRET="your_access_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
JWT_ACCESS_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="7d"
BCRYPT_SALT_ROUNDS=8
NODE_ENV="development"
```

## Installation

```bash
npm install
```

## Database Setup

Generate Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate dev
```

## Run the Project

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## API Endpoints

### Authentication

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET /api/v1/auth/me
POST /api/v1/auth/refresh-token
```

### Example: Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "123456",
  "phone": "+8801700000000"
}
```

### Example: Login User

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "123456"
}
```

## Response Format

The API returns consistent JSON responses such as:

```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {}
}
```

## Database Models

The project includes these main Prisma models:

- User
- Delivery
- Payment
- DeliveryStatusHistory
- AuditLog

These models support core logistics operations like customer profile handling, parcel delivery records, payment status, and audit logs.

## Authentication Flow

- User registers or logs in
- Backend validates credentials
- JWT access token and refresh token are created
- Tokens are set in cookies
- Protected routes use auth middleware to verify access and role

## Notes

This project is a backend foundation for a courier and logistics platform. It can be extended with:

- parcel booking APIs,
- delivery assignment APIs,
- admin dashboard endpoints,
- payment gateway integration,
- notification service,
- parcel status automation.

## License

This project is licensed under ISC.
