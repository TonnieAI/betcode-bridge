/*
# Preserve profile privilege lock while allowing language preference updates
*/

CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_lockdown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_claim_role text := null;
  v_claims jsonb := '{}'::jsonb;
BEGIN
  BEGIN
    v_claim_role := nullif(current_setting('request.jwt.claim.role', true), '');
  EXCEPTION
    WHEN OTHERS THEN
      v_claim_role := null;
  END;

  BEGIN
    v_claims := COALESCE(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION
    WHEN OTHERS THEN
      v_claims := '{}'::jsonb;
  END;

  v_claim_role := COALESCE(v_claim_role, v_claims->>'role', auth.role());

  IF v_claim_role = 'service_role' THEN
    RETURN NEW;
  END IF;

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

  IF (to_jsonb(NEW) - ARRAY['username', 'avatar_url', 'preferences', 'notification_settings', 'language'])
      IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['username', 'avatar_url', 'preferences', 'notification_settings', 'language']) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'PROFILE_UPDATE_FORBIDDEN',
      DETAIL = 'Only username, avatar_url, language, preferences, and notification_settings can be changed by this user.',
      HINT = 'Use privileged backend/service-role workflows for role, plan, quota, subscription, country, and currency fields.';
  END IF;

  RETURN NEW;
END;
$$;
