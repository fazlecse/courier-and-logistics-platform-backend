export interface IUpdateProfilePayload {
    name?: string;
    phone?: string;
    avatar?: string;
}

export interface IChangePasswordPayload {
    oldPassword: string;
    newPassword: string;
}
