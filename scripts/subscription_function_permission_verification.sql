CREATE TEMP TABLE IF NOT EXISTS tmp_function_security_results (
  test text,
  passed boolean,
  status text,
  detail text
);
TRUNCATE tmp_function_security_results;

GRANT SELECT, INSERT ON TABLE tmp_function_security_results TO authenticated;
GRANT SELECT, INSERT ON TABLE tmp_function_security_results TO service_role;
SELECT set_config(
  'app.test_uid',
  COALESCE((SELECT id::text FROM public.profiles ORDER BY created_at DESC LIMIT 1), ''),
  false
);

BEGIN;
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := NULLIF(current_setting('app.test_uid', true), '')::uuid;

  IF v_uid IS NULL THEN
    INSERT INTO tmp_function_security_results VALUES ('setup_target_user', false, 'ERROR', 'No profile row found for test user context.');
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM public.sync_profile_plan_for_user(v_uid);
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_sync_profile_plan_for_user', false, 'UNEXPECTED_SUCCESS', 'Authenticated user executed privileged function.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_sync_profile_plan_for_user', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;

  BEGIN
    PERFORM public.expire_stale_subscriptions_for_user(v_uid);
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_expire_stale_subscriptions_for_user', false, 'UNEXPECTED_SUCCESS', 'Authenticated user executed privileged function.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_expire_stale_subscriptions_for_user', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;

  BEGIN
    PERFORM public.cancel_user_subscription(v_uid, NULL, 'permission-test');
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_cancel_user_subscription', false, 'UNEXPECTED_SUCCESS', 'Authenticated user executed privileged function.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_cancel_user_subscription', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;

  BEGIN
    PERFORM public.activate_subscription_by_reference('SEC-ROLE-TEST', '{}'::jsonb);
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_activate_subscription_by_reference', false, 'UNEXPECTED_SUCCESS', 'Authenticated user executed privileged function.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_function_security_results VALUES ('auth_execute_activate_subscription_by_reference', SQLSTATE = '42501', SQLSTATE, SQLERRM);
  END;
END
$$;

COMMIT;

BEGIN;
SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := NULLIF(current_setting('app.test_uid', true), '')::uuid;

  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid::text, 'role', 'service_role')::text, true);

  BEGIN
    PERFORM public.sync_profile_plan_for_user(v_uid);
    INSERT INTO tmp_function_security_results VALUES ('service_execute_sync_profile_plan_for_user', true, 'OK', 'Service role executed function successfully.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_function_security_results VALUES ('service_execute_sync_profile_plan_for_user', false, SQLSTATE, SQLERRM);
  END;

  BEGIN
    PERFORM public.expire_stale_subscriptions_for_user(v_uid);
    INSERT INTO tmp_function_security_results VALUES ('service_execute_expire_stale_subscriptions_for_user', true, 'OK', 'Service role executed function successfully.');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO tmp_function_security_results VALUES ('service_execute_expire_stale_subscriptions_for_user', false, SQLSTATE, SQLERRM);
  END;

  BEGIN
    PERFORM public.cancel_user_subscription(v_uid, NULL, 'permission-test');
    INSERT INTO tmp_function_security_results VALUES ('service_execute_cancel_user_subscription', true, 'OK', 'Service role can execute cancellation workflow.');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      INSERT INTO tmp_function_security_results VALUES ('service_execute_cancel_user_subscription', true, SQLSTATE, SQLERRM);
    ELSE
      INSERT INTO tmp_function_security_results VALUES ('service_execute_cancel_user_subscription', false, SQLSTATE, SQLERRM);
    END IF;
  END;

  BEGIN
    PERFORM public.activate_subscription_by_reference('SEC-ROLE-TEST', '{}'::jsonb);
    INSERT INTO tmp_function_security_results VALUES ('service_execute_activate_subscription_by_reference', true, 'OK', 'Service role can execute activation workflow.');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      INSERT INTO tmp_function_security_results VALUES ('service_execute_activate_subscription_by_reference', true, SQLSTATE, SQLERRM);
    ELSE
      INSERT INTO tmp_function_security_results VALUES ('service_execute_activate_subscription_by_reference', false, SQLSTATE, SQLERRM);
    END IF;
  END;
END
$$;

COMMIT;

SELECT *
FROM tmp_function_security_results
ORDER BY test;
