export const DEFAULT_AUTH_NEXT_PATH = '/';
export const AUTH_INVITE_MODE = 'invite';
export const AUTH_RECOVERY_MODE = 'recovery';

export type AuthPageMode = typeof AUTH_INVITE_MODE | typeof AUTH_RECOVERY_MODE | null;

export function normalizeNextPath(nextPath?: string | null) {
  if (!nextPath) return DEFAULT_AUTH_NEXT_PATH;
  if (!nextPath.startsWith('/')) return DEFAULT_AUTH_NEXT_PATH;
  if (nextPath.startsWith('//')) return DEFAULT_AUTH_NEXT_PATH;
  if (nextPath.startsWith('/auth')) return DEFAULT_AUTH_NEXT_PATH;

  return nextPath;
}

export function buildAuthRoute(nextPath?: string | null) {
  const normalizedNextPath = normalizeNextPath(nextPath);
  return `/auth?next=${encodeURIComponent(normalizedNextPath)}`;
}

export function normalizeAuthMode(mode?: string | null): AuthPageMode {
  if (mode === AUTH_INVITE_MODE || mode === AUTH_RECOVERY_MODE) {
    return mode;
  }

  return null;
}

export function buildInviteRedirectUrl(origin: string, nextPath = DEFAULT_AUTH_NEXT_PATH) {
  const normalizedNextPath = normalizeNextPath(nextPath);
  const redirectUrl = new URL('/auth', origin);
  redirectUrl.searchParams.set('mode', AUTH_INVITE_MODE);
  redirectUrl.searchParams.set('next', normalizedNextPath);
  return redirectUrl.toString();
}

export function resolveAuthRedirectOrigin(currentOrigin: string, configuredOrigin?: string | null) {
  const preferredOrigin = configuredOrigin?.trim();

  if (preferredOrigin) {
    return new URL(preferredOrigin).origin;
  }

  return new URL(currentOrigin).origin;
}

export function isLocalAuthRedirectUrl(redirectUrl: string) {
  try {
    const { hostname, protocol } = new URL(redirectUrl);
    return (
      protocol === 'file:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname === '::1'
    );
  } catch {
    return true;
  }
}
