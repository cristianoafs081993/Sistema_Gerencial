type MetadataLike = Record<string, unknown>;

export type AuthUserIdentityLike = {
  id?: string | null;
  email?: string | null;
  user_metadata?: MetadataLike | null;
};

export type TerceirizadoIdentityLike = {
  matricula?: string | null;
  email?: string | null;
};

export type TerceirizadoPermissionIdentityLike = {
  userId?: string | null;
  userEmail?: string | null;
  userMatricula?: string | null;
};

export function normalizeMatricula(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/[^0-9A-Za-z]/g, '')
    .toLowerCase();
}

function metadataString(metadata: MetadataLike | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

export function getAuthUserMatricula(user?: AuthUserIdentityLike | null) {
  if (!user) return '';

  return normalizeMatricula(
    metadataString(user.user_metadata, 'matricula') ||
      metadataString(user.user_metadata, 'username') ||
      metadataString(user.user_metadata, 'identificacao'),
  );
}

export function permissionMatchesTerceirizado(
  permission: TerceirizadoPermissionIdentityLike,
  terceirizado: TerceirizadoIdentityLike,
) {
  const permissionMatricula = normalizeMatricula(permission.userMatricula);
  const terceirizadoMatricula = normalizeMatricula(terceirizado.matricula);

  if (permissionMatricula && terceirizadoMatricula) {
    return permissionMatricula === terceirizadoMatricula;
  }

  const permissionEmail = permission.userEmail?.trim().toLowerCase();
  const terceirizadoEmail = terceirizado.email?.trim().toLowerCase();
  return Boolean(permissionEmail && terceirizadoEmail && permissionEmail === terceirizadoEmail);
}

export function permissionMatchesAuthUser(
  permission: TerceirizadoPermissionIdentityLike,
  user?: AuthUserIdentityLike | null,
) {
  if (!user) return false;

  if (permission.userId && permission.userId === user.id) {
    return true;
  }

  const permissionMatricula = normalizeMatricula(permission.userMatricula);
  const userMatricula = getAuthUserMatricula(user);
  if (permissionMatricula && userMatricula) {
    return permissionMatricula === userMatricula;
  }

  const permissionEmail = permission.userEmail?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();
  return Boolean(permissionEmail && userEmail && permissionEmail === userEmail);
}
