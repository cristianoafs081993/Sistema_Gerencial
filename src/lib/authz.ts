type AppMetadataLike = {
  role?: string;
  is_superadmin?: boolean;
};

type AuthUserLike = {
  email?: string | null;
  app_metadata?: AppMetadataLike;
};

export const SUPERADMIN_EMAIL = 'cristiano.cnrn@gmail.com';

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || '';
}

export function isSuperAdminEmail(email?: string | null) {
  return normalizeEmail(email) === SUPERADMIN_EMAIL;
}

export function isSuperAdminUser(user?: AuthUserLike | null) {
  if (!user) return false;

  if (isSuperAdminEmail(user.email)) {
    return true;
  }

  return user.app_metadata?.role === 'superadmin' || user.app_metadata?.is_superadmin === true;
}
