/**
 * Magento REST API helper — server-side only.
 * Uses admin credentials to generate a bearer token, then caches it.
 */

import { getMagentoHttpAuth } from "@/lib/magento/httpAuth";

const MAGENTO_BASE = (
  process.env.MAGENTO_GRAPHQL_URL || "https://magento.test/graphql"
).replace(/\/graphql$/, "");

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAdminToken(): Promise<string> {
  // Reuse cached token if still valid (refresh 5 min before expiry)
  if (cachedToken && Date.now() < tokenExpiresAt - 300_000) {
    return cachedToken;
  }

  const user = process.env.MAGENTO_ADMIN_USER;
  const pass = process.env.MAGENTO_ADMIN_PASS;
  if (!user || !pass) {
    throw new Error("MAGENTO_ADMIN_USER / MAGENTO_ADMIN_PASS not set");
  }

  const httpAuth = getMagentoHttpAuth();
  const res = await fetch(`${MAGENTO_BASE}/rest/V1/integration/admin/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(httpAuth ? { Authorization: httpAuth } : {}),
    },
    body: JSON.stringify({ username: user, password: pass }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get admin token: ${res.status}`);
  }

  const token = (await res.json()) as string;
  cachedToken = token;
  // Magento default token lifetime is 4 hours
  tokenExpiresAt = Date.now() + 4 * 60 * 60 * 1000;
  return token;
}

/**
 * Make a GET request to the Magento REST API.
 */
export async function magentoRestGet<T = unknown>(
  endpoint: string,
): Promise<T> {
  const token = await getAdminToken();
  const httpAuth = getMagentoHttpAuth();
  const res = await fetch(`${MAGENTO_BASE}/rest/V1${endpoint}`, {
    headers: {
      // When HTTP auth is configured, send both as comma-separated value.
      // nginx consumes the Basic part; Magento receives the Bearer part.
      Authorization: httpAuth
        ? `${httpAuth}, Bearer ${token}`
        : `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 }, // cache for 5 min
  });

  if (!res.ok) {
    throw new Error(`Magento REST ${endpoint}: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Make a POST request to the Magento REST API.
 */
export async function magentoRestPost<T = unknown>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  const token = await getAdminToken();
  const httpAuth2 = getMagentoHttpAuth();
  const res = await fetch(`${MAGENTO_BASE}/rest/V1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: httpAuth2
        ? `${httpAuth2}, Bearer ${token}`
        : `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Magento REST POST ${endpoint}: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}
