import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import config from "../config";
import { prisma, UserRole } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

declare global {
    namespace Express {
        interface Request {
            user?: {
                email: string;
                name: string;
                userId: string;
                role: UserRole;
            }
        }
    }
}

export const auth = (...requiredRoles: UserRole[]) => {
    return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
        const token = req.cookies.accessToken ?
            req.cookies.accessToken
            :
            req.headers.authorization?.startsWith("Bearer ") ?
                req.headers.authorization?.split(" ")[1]
                : req.headers.authorization;

        if (!token) {
            throw new AppError(401, "You are not logged in. Please log in to access this resource.");
        }

        const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

        if (!verifiedToken.success) {
            throw new AppError(401, verifiedToken.error || "Invalid or expired token");
        }

        const { email, name, userId, role } = verifiedToken.data as JwtPayload & {
            userId: string;
            role: UserRole;
            name: string;
            email: string;
        };

        if (requiredRoles.length && !requiredRoles.includes(role)) {
            throw new AppError(403, "Forbidden. You don't have permission to access this resource.");
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            }
        });

        if (!user || user.isDeleted) {
            throw new AppError(401, "User not found. Please log in again.");
        }

        if (user.status === "BLOCKED") {
            throw new AppError(403, "Your account has been blocked. Please contact support.");
        }

        req.user = {
            email,
            name,
            userId,
            role
        };

        next();
    });
};
