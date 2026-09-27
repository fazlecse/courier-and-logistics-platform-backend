import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Application, Request, Response } from 'express'
import httpStatus from "http-status"
import { globalErrorHandler } from './middleware/globalErrorHandler'
import { notFound } from './middleware/notFound'
import { AuthRoutes } from './module/auth/auth.route'
import config from './config'
import helmet from 'helmet'

const app: Application = express()

app.use(
    cors({
        origin: config.frontend_url,
        credentials: true,
    }),
)

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }))

// Middleware to parse JSON bodies
app.use(helmet());
app.use(express.json())
app.use(cookieParser())

app.use('/api/v1/auth', AuthRoutes)

// Basic route
app.get('/', async (req: Request, res: Response) => {
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Welcome to Courier and Logistics Platform',
    })
})

app.use(globalErrorHandler)
app.use(notFound)

export default app
