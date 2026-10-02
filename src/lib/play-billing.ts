import { Platform } from 'react-native';

import { api } from './api';
import type { SubscriptionOverview } from './subscription-api';

type Iap = typeof import('expo-iap');
type Ok<T> = { success: true; data: T };

// Google Play Billing only exists in the Android app (not web / iOS for now).
export const playBillingAvailable = Platform.OS === 'android';
let iap: Iap | null = null;
let connected: Promise<unknown> | null = null;
async function store() {
  if (!playBillingAvailable) throw new Error('Subscriptions are bought in the Android app');
  iap ??= (await import('expo-iap')) as Iap;
  connected ??= iap.initConnection();
  await connected;
  return iap;
}

export interface PlayOffer {
  basePlanId: string;
  offerToken: string;
  displayPrice: string;
}

/** Store prices per base plan (base plan id = plans.code in the DB), in the buyer's currency. */
export async function loadPlayOffers(productId: string): Promise<Record<string, PlayOffer>> {
  const s = await store();
  const products = (await s.fetchProducts({ skus: [productId], type: 'subs' })) ?? [];
  const out: Record<string, PlayOffer> = {};
  for (const p of products as { subscriptionOffers?: { basePlanIdAndroid?: string | null; offerTokenAndroid?: string | null; displayPrice: string; id: string }[] }[]) {
    for (const o of p.subscriptionOffers ?? []) {
      if (!o.basePlanIdAndroid || !o.offerTokenAndroid) continue;
      // Prefer the plain base-plan offer (no intro discount id) when several exist.
      if (!out[o.basePlanIdAndroid] || !o.id) out[o.basePlanIdAndroid] = { basePlanId: o.basePlanIdAndroid, offerToken: o.offerTokenAndroid, displayPrice: o.displayPrice };
    }
  }
  return out;
}

const verify = (purchaseToken: string) => api<Ok<SubscriptionOverview>>('/api/billing/play/verify', { method: 'POST', body: { purchaseToken }, authed: true });

/**
 * Buy a plan through Google Play. Resolves with the server-verified overview once Google
 * confirms the purchase; the purchase is only finished (acknowledged) after our server
 * has verified and stored it.
 */
export async function buyPlay(productId: string, offer: PlayOffer, accountId: string): Promise<SubscriptionOverview> {
  const s = await store();
  return new Promise((resolve, reject) => {
    const done = () => {
      ok.remove();
      err.remove();
    };
    const ok = s.purchaseUpdatedListener(async (p) => {
      if (p.productId !== productId || !p.purchaseToken) return;
      try {
        const res = await verify(p.purchaseToken);
        await s.finishTransaction({ purchase: p, isConsumable: false });
        done();
        resolve(res.data);
      } catch (e) {
        done();
        reject(e);
      }
    });
    const err = s.purchaseErrorListener((e) => {
      done();
      reject(new Error(e.code === 'user-cancelled' ? 'Purchase cancelled' : (e.message ?? 'Purchase failed')));
    });
    s.requestPurchase({
      type: 'subs',
      request: { google: { skus: [productId], subscriptionOffers: [{ sku: productId, offerToken: offer.offerToken }], obfuscatedAccountId: accountId } },
    }).catch((e: unknown) => {
      done();
      reject(e instanceof Error ? e : new Error(String(e)));
    });
  });
}

/** "Restore purchase": re-send any Play subscriptions this Google account holds. */
export async function restorePlay(productId: string): Promise<SubscriptionOverview | null> {
  const s = await store();
  const purchases = (await s.getAvailablePurchases()) ?? [];
  let last: SubscriptionOverview | null = null;
  for (const p of purchases) {
    if (p.productId !== productId || !p.purchaseToken) continue;
    last = (await verify(p.purchaseToken)).data;
    await s.finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
  }
  return last;
}
