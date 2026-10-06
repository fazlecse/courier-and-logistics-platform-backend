import { Router } from 'express'
import { UserRole } from '../../lib/prisma'
import { auth } from '../../middleware/checkAuth'
import { AuthController } from './auth.controller'
import { validateRequest } from '../../middleware/validateRequest'
import {
    googleLoginValidationSchema,
    loginValidationSchema,
    registerValidationSchema
} from './auth.validation'

const router = Router()

router.post('/register', validateRequest(registerValidationSchema), AuthController.register)
router.post('/login', validateRequest(loginValidationSchema), AuthController.loginUser)
router.post('/google', validateRequest(googleLoginValidationSchema), AuthController.loginWithGoogle)
router.get(
    '/me',
    auth(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.DELIVERY_AGENT),
    AuthController.getMe,
)
router.post('/refresh-token', AuthController.refreshToken)
router.post('/logout', AuthController.logoutUser)
export const AuthRoutes = router
