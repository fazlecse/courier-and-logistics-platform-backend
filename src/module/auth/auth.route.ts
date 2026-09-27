import { Router } from 'express'
import { UserRole } from '../../../generated/prisma/enums'
import { auth } from '../../middleware/checkAuth'
import { AuthController } from './auth.controller'
import { validateRequest } from '../../middleware/validateRequest'
import { loginValidationSchema, registerValidationSchema } from './auth.validation'

const router = Router()

router.post('/register', validateRequest(registerValidationSchema), AuthController.registerPatient)
router.post('/login', validateRequest(loginValidationSchema), AuthController.loginUser)
router.get(
    '/me',
    auth(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.DELIVERY_AGENT),
    AuthController.getMe,
)
router.post('/refresh-token', AuthController.refreshToken)
export const AuthRoutes = router
