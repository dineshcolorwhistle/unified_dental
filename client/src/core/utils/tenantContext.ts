/**
 * Tenant Context Utility
 *
 * Extracts tenant subdomain from the current browser URL.
 * This is the single source of truth for tenant context on the frontend.
 *
 * Examples:
 *   staging-unified.sarvadent.com         → null (platform root / superadmin)
 *   smile-lab.staging-unified.sarvadent.com → "smile-lab"
 *   localhost:5173                        → null (platform root)
 *   smile-lab.localhost:5173              → "smile-lab"
 *   smile-lab.app.example.com             → "smile-lab"
 */

const SYSTEM_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'staging',
  'staging-unified',
  'dev',
  'demo',
  'platform',
  'portal',
  'root',
  'superadmin',
  'backend',
  'localhost',
]);

/**
 * Extract the tenant slug from the current hostname's subdomain.
 * Returns null if on the root/platform domain.
 */
export function getTenantSlug(): string | null {
  const hostname = window.location.hostname.toLowerCase();

  // 1. Check if configured via Vite environment variable
  const configuredBaseDomain = (
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BASE_DOMAIN) ||
    ''
  )
    .toLowerCase()
    .trim();
  if (configuredBaseDomain) {
    if (hostname === configuredBaseDomain || hostname === `www.${configuredBaseDomain}`) {
      return null;
    }
    if (hostname.endsWith(`.${configuredBaseDomain}`)) {
      const sub = hostname.slice(0, -(configuredBaseDomain.length + 1));
      if (!SYSTEM_SUBDOMAINS.has(sub)) {
        return sub;
      }
      return null;
    }
  }

  // 2. Localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return null;
  }

  const parts = hostname.split('.');

  // e.g. "smile-lab.localhost"
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    const sub = parts[0];
    if (!SYSTEM_SUBDOMAINS.has(sub)) {
      return sub;
    }
    return null;
  }

  // 3. Public domains
  // 2 parts: "sarvadent.com" -> platform root
  if (parts.length <= 2) {
    return null;
  }

  // 3 parts: "staging-unified.sarvadent.com" or "smile-lab.sarvadent.com"
  if (parts.length === 3) {
    const sub = parts[0];
    if (SYSTEM_SUBDOMAINS.has(sub)) {
      return null; // Platform root domain (e.g. staging-unified.sarvadent.com)
    }
    return sub; // Tenant domain (e.g. smile-lab.sarvadent.com)
  }

  // 4+ parts: "smile-lab.staging-unified.sarvadent.com"
  if (parts.length >= 4) {
    const sub = parts[0];
    if (!SYSTEM_SUBDOMAINS.has(sub)) {
      return sub;
    }
    return null;
  }

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
  const { protocol, hostname, port } = window.location;
  const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
  const cleanSlug = slug.toLowerCase().trim();

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
    return `${protocol}//${cleanSlug}.localhost${portSuffix}/login`;
  }

  const currentSlug = getTenantSlug();
  if (currentSlug) {
    const domainWithoutSlug = hostname.slice(currentSlug.length + 1);
    return `${protocol}//${cleanSlug}.${domainWithoutSlug}${portSuffix}/login`;
  }

  return `${protocol}//${cleanSlug}.${hostname}${portSuffix}/login`;
}
