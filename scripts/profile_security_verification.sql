CREATE TEMP TABLE IF NOT EXISTS tmp_profile_security_results (
  test text,
  passed boolean,
  status text,
  detail text
);
TRUNCATE tmp_profile_security_results;

CREATE TEMP TABLE IF NOT EXISTS tmp_profile_security_target (
  id uuid,
  username text,
  avatar_url text,
  role text,
  plan text,
  conversion_limit integer,
  conversions_this_month integer,
  preferences jsonb,
  notification_settings jsonb
);
TRUNCATE tmp_profile_security_target;

INSERT INTO tmp_profile_security_target
SELECT
  id,
  username,
  avatar_url,
  role,
  plan,
  conversion_limit,
  conversions_this_month,
  COALESCE(preferences, '{}'::jsonb),
  COALESCE(notification_settings, '{}'::jsonb)
FROM public.profiles
WHERE role = 'user'
ORDER BY created_at DESC
LIMIT 1;

DO $$
DECLARE
  v_uid uuid;
  v_ok boolean;
BEGIN
  SELECT id INTO v_uid FROM tmp_profile_security_target LIMIT 1;

  IF v_uid IS NULL THEN
    INSERT INTO tmp_profile_security_results(test, passed, status, detail)
    VALUES ('setup_target_user', false, 'ERROR', 'No user profile with role=user found.');
    RETURN;
  END IF;

  -- Authenticated user context
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_uid;
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_role_admin', false, 'UNEXPECTED_SUCCESS', 'Protected role update succeeded unexpectedly.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_role_admin', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;

  BEGIN
    UPDATE public.profiles SET plan = 'basic' WHERE id = v_uid;
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_plan_basic', false, 'UNEXPECTED_SUCCESS', 'Protected plan update succeeded unexpectedly.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_plan_basic', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;

  BEGIN
    UPDATE public.profiles SET conversion_limit = 999999 WHERE id = v_uid;
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_conversion_limit', false, 'UNEXPECTED_SUCCESS', 'Protected conversion_limit update succeeded unexpectedly.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_conversion_limit', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;

  BEGIN
    UPDATE public.profiles SET conversions_this_month = 77 WHERE id = v_uid;
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_conversions_this_month', false, 'UNEXPECTED_SUCCESS', 'Protected conversions_this_month update succeeded unexpectedly.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_conversions_this_month', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;

  BEGIN
    UPDATE public.profiles
    SET
      username = 'security-safe-username',
      avatar_url = 'https://example.com/security.png',
      preferences = jsonb_build_object('ok', true),
      notification_settings = jsonb_build_object('email', false)
    WHERE id = v_uid;
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_safe_fields', true, 'OK', 'Safe fields updated successfully.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_profile_security_results VALUES ('normal_patch_safe_fields', false, SQLSTATE, SQLERRM);
  END;

  -- Service role context
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid::text, 'role', 'service_role')::text, true);

  BEGIN
    UPDATE public.profiles
    SET
      role = 'admin',
      plan = 'basic',
      conversion_limit = 1234,
      conversions_this_month = 5
    WHERE id = v_uid;
    INSERT INTO tmp_profile_security_results VALUES ('service_patch_protected_fields', true, 'OK', 'Service role updated protected fields successfully.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_profile_security_results VALUES ('service_patch_protected_fields', false, SQLSTATE, SQLERRM);
  END;

  -- Restore original values via service context
  UPDATE public.profiles p
  SET
    username = t.username,
    avatar_url = t.avatar_url,
    role = t.role,
    plan = t.plan,
    conversion_limit = t.conversion_limit,
    conversions_this_month = t.conversions_this_month,
    preferences = t.preferences,
    notification_settings = t.notification_settings
  FROM tmp_profile_security_target t
  WHERE p.id = t.id;

  -- Validate restoration
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN tmp_profile_security_target t ON t.id = p.id
    WHERE p.username = t.username
      AND p.avatar_url IS NOT DISTINCT FROM t.avatar_url
      AND p.role = t.role
      AND p.plan = t.plan
      AND p.conversion_limit = t.conversion_limit
      AND p.conversions_this_month = t.conversions_this_month
      AND COALESCE(p.preferences, '{}'::jsonb) = t.preferences
      AND COALESCE(p.notification_settings, '{}'::jsonb) = t.notification_settings
  ) INTO v_ok;

  INSERT INTO tmp_profile_security_results VALUES (
    'restore_original_profile_values',
    v_ok,
    CASE WHEN v_ok THEN 'OK' ELSE 'MISMATCH' END,
    'Profile row restored after test mutations.'
  );
END
$$;

SELECT *
FROM tmp_profile_security_results
ORDER BY test;
