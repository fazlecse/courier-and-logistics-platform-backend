import { Request, Response } from 'express'
import httpStatus from 'http-status'
import { catchAsync } from '../../utils/catchAsync'
import { sendResponse } from '../../utils/sendResponse'
import { IRequestUser } from './auth.interface'
import { AuthService } from './auth.service'

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    })
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    })
}

const clearAuthCookies = (res: Response) => {
    res.cookie("accessToken", "", { httpOnly: true, maxAge: 0 })
    res.cookie("refreshToken", "", { httpOnly: true, maxAge: 0 })
}

const register = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body
    const result = await AuthService.register(payload)

    const { accessToken, refreshToken, user } = result

    setAuthCookies(res, accessToken, refreshToken)

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'User registered successfully',
        data: {
            accessToken,
            refreshToken,
            user,
        },
    })
})

const loginUser = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body
    const result = await AuthService.loginUser(payload)
    const { accessToken, refreshToken } = result

    setAuthCookies(res, accessToken, refreshToken)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User logged in successfully',
        data: {
            accessToken,
            refreshToken
        },
    })
})

const loginWithGoogle = catchAsync(async (req: Request, res: Response) => {
    const { idToken } = req.body
    const result = await AuthService.loginWithGoogle(idToken)

    setAuthCookies(res, result.accessToken, result.refreshToken)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Google sign-in successful',
        data: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user,
            isNewUser: result.isNewUser,
        },
    })
})

const getMe = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as unknown as IRequestUser

    if (!user) {
        throw new Error('User information is missing in the request')
    }

    const result = await AuthService.getMe(user)
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User profile fetched successfully',
        data: result,
    })
})

const refreshToken = catchAsync(async (req: Request, res: Response) => {
    if (!req.cookies.refreshToken) {
        throw new Error('Refresh token is missing')
    }
    const result = await AuthService.refreshToken(req.cookies.refreshToken)
    const { accessToken, refreshToken: newRefreshToken } = result

    setAuthCookies(res, accessToken, newRefreshToken)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'New tokens generated successfully',
        data: {
            accessToken,
            refreshToken: newRefreshToken,
        },
    })
})

const logoutUser = catchAsync(async (_req: Request, res: Response) => {
    await AuthService.logoutUser()
    clearAuthCookies(res)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Logged out successfully',
        data: {},
    })
})


export const AuthController = {
    register,
    loginUser,
    loginWithGoogle,
    getMe,
    refreshToken,
    logoutUser,
}
