import bcrypt from "bcryptjs"
import { JwtPayload, SignOptions } from 'jsonwebtoken'
import config from '../../config'
import { prisma, UserRole, UserStatus } from '../../lib/prisma'
import { AppError } from "../../utils/AppError"
import { jwtUtils } from '../../utils/jwt'
import {
    ILoginUserPayload,
    IRegisterUserPayload,
    IRequestUser
} from './auth.interface'


const register = async (payload: IRegisterUserPayload) => {
    const { name, password, phone } = payload
    const email = payload.email.trim().toLowerCase()

    const isUserExists = await prisma.user.findUnique({
        where: { email },
    })

    if (isUserExists) {
        throw new AppError(409, 'User with this email already exists', [
            { field: 'email', message: 'Email is already registered' }
        ])
    }

    const hashedPassword = await bcrypt.hash(password, 8)

    const createdUser = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            phone,
            role: UserRole.CUSTOMER,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
        },
    })

    const { ...user } = createdUser
    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    }

    const accessToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_access_secret,
        config.jwt_access_expires_in as SignOptions
    );

    const refreshToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_refresh_secret,
        config.jwt_refresh_expires_in as SignOptions
    );

    return {
        user,
        accessToken,
        refreshToken
    }
}

const loginUser = async (payload: ILoginUserPayload) => {
    const { password } = payload
    const email = payload.email.trim().toLowerCase()

    const user = await prisma.user.findUnique({
        where: { email },
    })

    if (!user || !user.password) {
        throw new AppError(401, 'Invalid email or password')
    }

    if (user.status !== UserStatus.ACTIVE) {
        throw new AppError(403, 'User account is not active')
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password)

    if (!isPasswordMatched) {
        throw new AppError(401, 'Invalid email or password')
    }

    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    }

    const accessToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_access_secret,
        config.jwt_access_expires_in as SignOptions
    );

    const refreshToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_refresh_secret,
        config.jwt_refresh_expires_in as SignOptions
    );

    return {
        accessToken,
        refreshToken
    }
}

const loginWithGoogle = async (idToken: string) => {
    const { OAuth2Client } = await import('google-auth-library')
    const googleClientId = config.google_client_id || process.env.GOOGLE_CLIENT_ID
    const client = new OAuth2Client(googleClientId)

    const ticket = await client.verifyIdToken({
        idToken,
        audience: googleClientId,
    })

    const googlePayload = ticket.getPayload()

    if (!googlePayload || !googlePayload.email) {
        throw new AppError(401, 'Invalid Google token')
    }

    const email = googlePayload.email.toLowerCase()
    const name = googlePayload.name ?? email.split('@')[0]
    const avatar = googlePayload.picture

    // Link to an existing account by email, otherwise create a new customer
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            name,
            avatar,
            googleId: googlePayload.sub,
        },
        create: {
            name,
            email,
            avatar,
            googleId: googlePayload.sub,
            role: UserRole.CUSTOMER,
        },
    })

    if (user.status !== UserStatus.ACTIVE) {
        throw new AppError(403, 'User account is not active')
    }

    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    }

    const accessToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_access_secret,
        config.jwt_access_expires_in as SignOptions
    );

    const refreshToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_refresh_secret,
        config.jwt_refresh_expires_in as SignOptions
    );

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            status: user.status,
        },
        accessToken,
        refreshToken,
        isNewUser: user.createdAt.getTime() === user.updatedAt.getTime(),
    }
}

const getMe = async (user: IRequestUser) => {
    const isUserExists = await prisma.user.findUnique({
        where: {
            id: user.userId,
        },
        omit: {
            password: true,
        },
    })

    if (!isUserExists) {
        throw new AppError(404, 'User not found')
    }

    return isUserExists
}

const refreshToken = async (token: string) => {
    const verifiedRefreshToken = jwtUtils.verifyToken(token, config.jwt_refresh_secret)

    if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
        throw new AppError(401, 'Invalid or expired refresh token')
    }

    const data = verifiedRefreshToken.data as JwtPayload

    const user = await prisma.user.findUnique({
        where: { id: data.userId },
    })

    if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
        throw new AppError(401, 'User is inactive or not found')
    }

    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    }

    const accessToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_access_secret,
        config.jwt_access_expires_in as SignOptions
    );

    const refreshToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_refresh_secret,
        config.jwt_refresh_expires_in as SignOptions
    );

    return {
        accessToken,
        refreshToken
    }
}

const logoutUser = async () => {
    // Stateless JWTs live on the client; this endpoint exists so the
    // client can clear its cookies and any stored tokens in one place.
    return { message: 'Logged out successfully' }
}



export const AuthService = {
    register,
    loginUser,
    loginWithGoogle,
    getMe,
    refreshToken,
    logoutUser
}
