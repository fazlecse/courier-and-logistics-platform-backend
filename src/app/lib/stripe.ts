import Stripe from 'stripe';
import config from '../config';

const stripeSecretKey =
    config.stripe_secret_key ||
    process.env.STRIPE_SECRET_KEY ||
    'sk_test_placeholder_key_for_startup';

export const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia' as any,
    typescript: true,
});
