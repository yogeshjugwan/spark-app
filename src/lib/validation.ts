import { z } from 'zod';

// Mirrors the rules in dating-api/src/auth/auth.schemas.ts so users see
// problems before the request is sent. The API still validates everything.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s\-()]{10,18}$/;

export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');

export const identifierRule = z
  .string()
  .trim()
  .min(1, 'Enter your email or phone number')
  .refine((v) => EMAIL_RE.test(v) || PHONE_RE.test(v), 'Enter a valid email or phone number');

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(100),
    email: z
      .string()
      .trim()
      .refine((v) => !v || EMAIL_RE.test(v), 'Enter a valid email'),
    phone: z
      .string()
      .trim()
      .refine((v) => !v || PHONE_RE.test(v), 'Enter a valid phone number'),
    password: passwordRule,
  })
  .refine((d) => d.email || d.phone, { message: 'Add an email or a phone number', path: ['email'] });

export const loginSchema = z.object({
  identifier: identifierRule,
  password: z.string().min(1, 'Enter your password'),
});

/** Same fields as the password form (so one form can switch modes); password is ignored. */
export const codeLoginSchema = z.object({ identifier: identifierRule, password: z.string() });

export type SignupForm = z.infer<typeof signupSchema>;
export type LoginForm = z.infer<typeof loginSchema>;
