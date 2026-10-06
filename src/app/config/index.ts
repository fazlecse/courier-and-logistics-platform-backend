import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
    node_env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5002,
    database_url: process.env.DATABASE_URL,
    backend_url: process.env.BACKEND_URL || 'http://localhost:5002',
    frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000',
    bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
    jwt_access_secret: process.env.JWT_ACCESS_SECRET || 'default-access-secret',
    jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    google_client_id: process.env.GOOGLE_CLIENT_ID,
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
};