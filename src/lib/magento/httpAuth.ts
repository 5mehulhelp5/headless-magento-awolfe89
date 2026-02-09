/**
 * Returns the Base64-encoded HTTP Basic Auth string for Magento dev site protection.
 * Set MAGENTO_HTTP_AUTH env var as "username:password" to enable.
 * Returns null if not configured.
 */
export function getMagentoHttpAuth(): string | null {
  const auth = process.env.MAGENTO_HTTP_AUTH;
  if (!auth) return null;
  return `Basic ${Buffer.from(auth).toString("base64")}`;
}

/**
 * Returns headers object with Authorization set to Basic auth.
 * Use only when no other Authorization header is needed (e.g., GraphQL, not REST with Bearer token).
 */
export function getMagentoHttpAuthHeaders(): Record<string, string> {
  const auth = getMagentoHttpAuth();
  if (!auth) return {};
  return { Authorization: auth };
}
