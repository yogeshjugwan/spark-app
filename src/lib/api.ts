import { API_URL } from './config';
import type { FieldError, Tokens } from './types';

/** An error response from the API: `{ success: false, message, errors? }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: unknown,
  ) {
    super(message);
  }

  /** Per-field validation messages, when the API returned them. */
  get fieldErrors(): FieldError[] {
    return Array.isArray(this.errors) ? (this.errors as FieldError[]) : [];
  }
}

// The auth store plugs in here, so this module doesn't depend on it.
interface AuthHooks {
  getTokens: () => Tokens | null;
  onTokens: (tokens: Tokens) => void | Promise<void>;
  onSessionExpired: () => void | Promise<void>;
}
let auth: AuthHooks | null = null;

// Spark+ paywall: any 402 opens the upgrade screen for that feature (set by the app layout).
let onPaywall: ((feature: string, message: string) => void) | null = null;
export function configurePaywall(fn: typeof onPaywall) {
  onPaywall = fn;
}
export function configureApiAuth(hooks: AuthHooks) {
  auth = hooks;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-serialisable value, or FormData for file uploads. */
  body?: unknown;
  /** Send the access token and refresh it automatically if it has expired. */
  authed?: boolean;
}

async function send(path: string, { method = 'GET', body: rawBody, authed }: RequestOptions, accessToken?: string) {
  // Web uploads build their FormData asynchronously (see upload-form.ts).
  const body = rawBody instanceof Promise ? await rawBody : rawBody;
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        // For FormData, fetch sets multipart/form-data with the boundary itself.
        ...(!isForm && { 'Content-Type': 'application/json' }),
        ...(authed && accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Is the API running?`);
  }

  const json = await res.json().catch(() => ({}));
  if (res.status === 402) onPaywall?.((json.errors as { feature?: string } | undefined)?.feature ?? '', json.message ?? '');
  if (!res.ok) throw new ApiError(res.status, json.message ?? `Request failed (${res.status})`, json.errors);
  return json;
}

// Only one refresh at a time, even if several requests hit a 401 together.
let refreshing: Promise<Tokens | null> | null = null;

function refreshTokens(): Promise<Tokens | null> {
  refreshing ??= (async () => {
    const current = auth?.getTokens();
    if (!current) return null;
    try {
      const json = await send('/api/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } });
      const tokens = json.data.tokens as Tokens;
      await auth?.onTokens(tokens);
      return tokens;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await auth?.onSessionExpired();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!options.authed) return send(path, options);

  try {
    return await send(path, options, auth?.getTokens()?.accessToken);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const tokens = await refreshTokens();
    if (!tokens) throw err;
    return send(path, options, tokens.accessToken);
  }
}
