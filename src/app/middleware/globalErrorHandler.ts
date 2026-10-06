import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { ZodError } from 'zod';
import config from '../config';
import { Prisma } from '../lib/prisma';
import { AppError, IErrorSource } from '../utils/AppError';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalErrorHandler = async (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
) => {
    if (config.node_env === 'development') {
        console.error('Error from Global Error Handler:', err);
    }

    let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage: string = 'Internal Server Error';
    let errors: IErrorSource[] = [];

    if (err instanceof ZodError) {
        statusCode = httpStatus.BAD_REQUEST;
        errorMessage = 'Validation error';
        errors = err.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
        }));
    } else if (err instanceof AppError) {
        statusCode = err.statusCode;
        errorMessage = err.message;
        errors = err.errors.length
            ? err.errors
            : [{ message: err.message }];
    } else if (err instanceof Prisma.PrismaClientValidationError) {
        statusCode = httpStatus.BAD_REQUEST;
        errorMessage = 'You have provided incorrect field type or missing fields';
        errors = [{ message: err.message }];
    } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            statusCode = httpStatus.CONFLICT;
            const target = Array.isArray(err.meta?.target)
                ? (err.meta.target as string[]).join(', ')
                : String(err.meta?.target || 'field');
            errorMessage = `Duplicate value for ${target}`;
            errors = [{ field: target, message: `${target} already exists` }];
        } else if (err.code === 'P2003') {
            statusCode = httpStatus.BAD_REQUEST;
            errorMessage = 'Foreign key constraint failed';
            errors = [{ message: 'Referenced record does not exist' }];
        } else if (err.code === 'P2025') {
            statusCode = httpStatus.NOT_FOUND;
            errorMessage = 'Record not found';
            errors = [{ message: 'The requested record does not exist' }];
        } else {
            statusCode = httpStatus.BAD_REQUEST;
            errorMessage = err.message;
            errors = [{ message: err.message }];
        }
    } else if (err instanceof Prisma.PrismaClientInitializationError) {
        if (err.errorCode === 'P1000') {
            statusCode = httpStatus.UNAUTHORIZED;
            errorMessage = 'Authentication failed against database server. Please check credentials.';
        } else if (err.errorCode === 'P1001') {
            statusCode = httpStatus.BAD_GATEWAY;
            errorMessage = "Cannot reach database server";
        }
        errors = [{ message: errorMessage }];
    } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
        statusCode = httpStatus.INTERNAL_SERVER_ERROR;
        errorMessage = 'Error occurred during database query execution';
        errors = [{ message: errorMessage }];
    } else if (err instanceof Error) {
        errorMessage = err.message;
        errors = [{ message: err.message }];
    }

    res.status(statusCode).json({
        success: false,
        statusCode,
        message: errorMessage,
        errors,
        stack: config.node_env === 'development' ? err.stack : undefined,
    });
};
