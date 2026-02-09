/**
 * Rewrites a Magento media URL to go through our image proxy at /api/media/.
 * This lets Next.js Image Optimizer fetch images that sit behind HTTP Basic Auth.
 *
 * Input:  "https://38aecb3f61.nxcli.io/media/catalog/product/x.jpg"
 * Output: "/api/media/catalog/product/x.jpg"
 */
export function proxyMagentoImage(url: string | null | undefined): string {
  if (!url) return "";

  // Skip data URIs and already-proxied URLs
  if (url.startsWith("data:") || url.startsWith("/api/media/")) return url;

  // Extract the path portion after /media/
  const mediaIndex = url.indexOf("/media/");
  if (mediaIndex !== -1) {
    const path = url.substring(mediaIndex + "/media/".length);
    return `/api/media/${path}`;
  }

  // Already a relative URL — leave as-is
  if (url.startsWith("/")) return url;

  // Not a Magento media URL — return unchanged
  return url;
}
