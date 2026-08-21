/**
 * Gets the base path for the application.
 * Checks runtime window.env first (for Docker), falls back to build-time BASE_URL.
 */
export function getBasePath(): string {
  // Runtime override from Docker inject-env.cjs
  if (typeof window !== "undefined" && window.env?.VITE_BASE_PATH) {
    const path = window.env.VITE_BASE_PATH;
    // Ensure it ends with /
    return path.endsWith("/") ? path : `${path}/`;
  }
  // Build-time value from Vite
  return import.meta.env.BASE_URL;
}

/**
 * Constructs a URL with the correct base path.
 * @param path - The path to append (should not start with /)
 */
export function withBasePath(path: string): string {
  const base = getBasePath();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${cleanPath}`;
}

let cachedAppBasePath: string | null = null;

/**
 * Gets the base path for in-app routing (React Router basename, share
 * links), as a path relative to the current origin.
 *
 * A build with an absolute asset base URL (e.g. S3) can be served from
 * several places at once: index.html opened on the storage itself lives
 * under the asset prefix (/chewie/), while the same page embedded into
 * ClickHouse's http_server_default_response is served from "/" on the
 * ClickHouse host. So the configured base only tells us where the assets
 * are — where the *app* lives is decided by the URL the page was actually
 * loaded from: use the asset prefix when the page is under it, otherwise
 * the directory the page was served from.
 *
 * Cached on first call (at App mount, before any client-side navigation),
 * since location.pathname changes as the user navigates.
 */
export function getAppBasePath(): string {
  if (cachedAppBasePath !== null) return cachedAppBasePath;

  const base = getBasePath();
  let prefix = base;
  if (/^https?:\/\//.test(base)) {
    try {
      prefix = new URL(base).pathname;
    } catch {
      prefix = "/";
    }
  }

  const pathname = window.location.pathname;
  cachedAppBasePath = pathname.startsWith(prefix)
    ? prefix
    : pathname.slice(0, pathname.lastIndexOf("/") + 1);
  return cachedAppBasePath;
}
