import { UserRole, UserStatus } from '../../lib/prisma';

export interface IUserFilterOptions {
    page?: number;
    limit?: number;
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface IUpdateUserRolePayload {
    role: UserRole;
}

export interface IUpdateUserStatusPayload {
    status: UserStatus;
}

export interface IAuditLogFilterOptions {
    page?: number;
    limit?: number;
    entity?: string;
    action?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
