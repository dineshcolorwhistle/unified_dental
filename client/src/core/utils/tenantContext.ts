/**
 * Tenant Context Utility
 *
 * Extracts tenant subdomain from the current browser URL.
 * This is the single source of truth for tenant context on the frontend.
 *
 * Examples:
 *   localhost:5173            → null (platform domain)
 *   smile-lab.localhost:5173  → "smile-lab"
 *   smile-lab.app.example.com → "smile-lab"
 */

/**
 * Extract the tenant slug from the current hostname's subdomain.
 * Returns null if on the root/platform domain.
 */
export function getTenantSlug(): string | null {
  const hostname = window.location.hostname; // e.g. "smile-lab.localhost" or "localhost"
  const parts = hostname.split('.');

  // Production: subdomain.app.example.com (4 parts) or subdomain.example.com (3 parts)
  // Development: subdomain.localhost (2 parts)
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    // Dev: smile-lab.localhost → subdomain = "smile-lab"
    const sub = parts[0];
    if (sub !== 'www' && sub !== 'api' && sub !== 'app' && sub !== 'localhost') {
      return sub.toLowerCase();
    }
    return null;
  }

  if (parts.length >= 3) {
    // Production: smile-lab.app.example.com
    const sub = parts[0];
    if (sub !== 'www' && sub !== 'api' && sub !== 'app') {
      return sub.toLowerCase();
    }
    return null;
  }

  // Plain "localhost" or single-part hostname
  return null;
}

/**
 * Returns true if the current domain is the platform root (no tenant subdomain).
 */
export function isPlatformDomain(): boolean {
  return getTenantSlug() === null;
}

/**
 * Build a login URL for a specific tenant subdomain.
 */
export function getTenantLoginUrl(slug: string): string {
  const { protocol, port } = window.location;
  const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
  return `${protocol}//${slug}.localhost${portSuffix}/login`;
}
