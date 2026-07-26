/*
# Lock profile privilege-sensitive fields from client-side updates

This migration adds defense-in-depth protections for profile updates:
1) Strict allowlist trigger for non-admin and non-service-role callers.
2) Safer UPDATE RLS policy replacement for authenticated users.
3) Optional profile settings columns users are allowed to edit.
*/

-- Optional user-editable profile settings fields.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Replace the previous permissive update policy with a safer variant.
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile_safe" ON public.profiles;

CREATE POLICY "update_own_profile_safe"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND plan = (SELECT p.plan FROM public.profiles p WHERE p.id = auth.uid())
  AND conversion_limit = (SELECT p.conversion_limit FROM public.profiles p WHERE p.id = auth.uid())
  AND conversions_this_month = (SELECT p.conversions_this_month FROM public.profiles p WHERE p.id = auth.uid())
);

-- Lock every profile column except a short allowlist for regular users.
CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_lockdown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Service role bypass for backend/admin operations.
  IF v_jwt_role = 'service_role' OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admin users can perform privileged profile changes.
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    ) INTO v_is_admin;
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin users may only edit the listed safe fields.
  IF (to_jsonb(NEW) - ARRAY['username', 'avatar_url', 'preferences', 'notification_settings'])
      IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['username', 'avatar_url', 'preferences', 'notification_settings']) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'PROFILE_UPDATE_FORBIDDEN',
      DETAIL = 'Only username, avatar_url, preferences, and notification_settings can be changed by this user.',
      HINT = 'Use privileged backend/service-role workflows for role, plan, quota, and subscription fields.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_profile_privilege_lockdown() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_profile_privilege_lockdown() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_profile_privilege_lockdown() FROM authenticated;

DROP TRIGGER IF EXISTS trg_profiles_safe_updates ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_privilege_lockdown ON public.profiles;

CREATE TRIGGER trg_profiles_privilege_lockdown
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_privilege_lockdown();
