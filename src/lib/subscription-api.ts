import { api } from './api';

type Ok<T> = { success: true; data: T };

export interface Plan {
  code: string;
  name: string;
  priceInr: number;
  periodDays: number;
  badge: string | null;
}
export interface FeatureRow {
  key: string;
  label: string;
  /** null = unlimited, 0 = locked, n = per day */
  free: number | null;
  premium: number | null;
  mine: number | null;
  gated: boolean;
}
export interface SubscriptionOverview {
  enabled: boolean;
  premium: boolean;
  subscription: { plan: string; planCode: string; status: 'active' | 'cancelled' | 'expired'; expiresAt: string; source: string } | null;
  plans: Plan[];
  features: FeatureRow[];
  usage: { likesToday: number };
  testPurchases: boolean;
  billing: { playProductId: string; accountId: string };
}
export interface LikesYou {
  unlocked: boolean;
  count: number;
  people: { id: number | null; name: string | null; age: number | null; photoUrl: string | null; likedAt: string | null }[];
}

export const subscriptionApi = {
  overview: () => api<Ok<SubscriptionOverview>>('/api/subscription', { authed: true }),
  subscribe: (plan: string) => api<Ok<SubscriptionOverview>>('/api/subscription', { method: 'POST', body: { plan }, authed: true }),
  cancel: () => api<Ok<SubscriptionOverview>>('/api/subscription/cancel', { method: 'POST', authed: true }),
  likesYou: () => api<Ok<LikesYou>>('/api/likes-you', { authed: true }),
  rewind: () => api<Ok<{ userId: number }>>('/api/swipes/rewind', { method: 'POST', authed: true }),
};

export const subscriptionKeys = { overview: ['subscription'] as const, likesYou: ['likes-you'] as const };

/** "Unlimited" / "25 per day" / "✓" / "—" for the free vs Spark+ table. */
export function featureValue(v: number | null, isLimit: boolean) {
  if (v === null) return isLimit ? 'Unlimited' : '✓';
  if (v === 0) return '—';
  return isLimit ? `${v} / day` : '✓';
}
