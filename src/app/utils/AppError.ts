export interface IErrorSource {
    field?: string | number;
    message: string;
}

export class AppError extends Error {
    public statusCode: number;
    public errors: IErrorSource[];

    constructor(
        statusCode: number,
        message: string,
        errors: IErrorSource[] = [],
        stack = '',
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
