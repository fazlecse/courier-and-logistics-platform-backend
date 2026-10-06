import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Application, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import httpStatus from 'http-status'
import config from './app/config'
import { globalErrorHandler } from './app/middleware/globalErrorHandler'
import { notFound } from './app/middleware/notFound'
import { AdminRoutes } from './app/module/admin/admin.route'
import { AuthRoutes } from './app/module/auth/auth.route'
import { DeliveryRoutes } from './app/module/delivery/delivery.route'
import { PaymentRoutes } from './app/module/payment/payment.route'
import { UserRoutes } from './app/module/user/user.route'

const app: Application = express()

// Security headers
app.use(helmet())

// Global rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
})
app.use(limiter)

// CORS setup
app.use(
    cors({
        origin: [config.frontend_url, 'http://localhost:3000', 'http://localhost:5173'],
        credentials: true,
    }),
)

// URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }))

// JSON body parser (capturing rawBody for Stripe webhook signature verification)
app.use(
    express.json({
        verify: (req: any, _res, buf) => {
            req.rawBody = buf;
        },
    }),
)
app.use(cookieParser())

// API Routes
app.use('/api/v1/auth', AuthRoutes)
app.use('/api/v1/users', UserRoutes)
app.use('/api/v1/deliveries', DeliveryRoutes)
app.use('/api/v1/payments', PaymentRoutes)
app.use('/api/v1/admin', AdminRoutes)

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Server is running healthy',
        timestamp: new Date().toISOString(),
    })
})

// Root route
app.get('/', async (_req: Request, res: Response) => {
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Welcome to Courier & Logistics Platform API',
    })
})

// Error handlers
app.use(globalErrorHandler)
app.use(notFound)

export default app
