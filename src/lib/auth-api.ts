import { api } from './api';
import type { Session, User } from './types';

// Thin wrappers around the dating API's /api/auth endpoints.

type Ok<T> = { success: true; message?: string; data: T };

export const authApi = {
  signup: (body: { name: string; email?: string; phone?: string; password: string }) =>
    api<Ok<{ user: User }> & { message: string }>('/api/auth/signup', { method: 'POST', body }),

  /** Checks a code (from signup or /otp/send) and logs in. */
  verify: (body: { identifier: string; otp: string }) =>
    api<Ok<Session>>('/api/auth/verify', { method: 'POST', body }),

  login: (body: { identifier: string; password: string }) =>
    api<Ok<Session>>('/api/auth/login', { method: 'POST', body }),

  sendOtp: (body: { identifier: string; purpose: 'login' | 'verify' }) =>
    api<{ success: true; message: string }>('/api/auth/otp/send', { method: 'POST', body }),

  me: () => api<Ok<{ user: User }>>('/api/auth/me', { authed: true }),
};
