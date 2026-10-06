import { z } from "zod";

export const registerValidationSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be at most 60 characters"),

  email: z
    .string()
    .email("Invalid email address"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(64, "Password must be at most 64 characters"),

  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Invalid phone number")
    .optional(),
});

export const loginValidationSchema = z.object({
    email: z
      .string()
      .email("Invalid email address"),

    password: z
      .string()
      .min(1, "Password is required"),
  });

export const googleLoginValidationSchema = z.object({
    idToken: z
      .string()
      .min(1, "Google ID token is required"),
  });
