-- Migration to fix infinite recursion in user_group_memberships SELECT policy
-- Created: 2026-06-17

-- 1. Create a security definer function to check if a user is a manager
CREATE OR REPLACE FUNCTION public.check_user_is_manager(user_id uuid)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_group_memberships m
    JOIN public.user_groups g ON m.group_id = g.id
    WHERE m.user_id = $1
      AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.check_user_is_manager(uuid) TO authenticated;

-- 3. Drop the existing recursive policy
DROP POLICY IF EXISTS "Permitir gestores lerem memberships" ON public.user_group_memberships;

-- 4. Create the new non-recursive policy
CREATE POLICY "Permitir gestores lerem memberships"
  ON public.user_group_memberships FOR SELECT TO authenticated
  USING (
    public.check_user_is_manager(auth.uid())
  );
