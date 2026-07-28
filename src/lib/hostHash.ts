// Identity check for share links in multi-host mode — not a security hash.
// Lets us put a short opaque token in a share URL instead of the raw host,
// and check on open whether it matches the currently connected host (or one
// of the saved connections) without ever exposing the host in the link.

function normalizeHostUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function hashHost(url: string): string {
  const normalized = normalizeHostUrl(url);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33 + normalized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
