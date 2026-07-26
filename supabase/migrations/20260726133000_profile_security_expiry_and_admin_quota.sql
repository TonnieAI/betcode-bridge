/*
# Profile security + automatic subscription expiry + admin quota bypass

1) Prevent profile privilege escalation by blocking restricted column updates from
   client roles.
2) Add scheduled daily expiry processing for subscriptions.
3) Allow admins unlimited conversions in save_conversion_with_quota.
*/

-- ── Block restricted profile updates from client roles ────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_profile_safe_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'PROFILE_FIELD_FORBIDDEN: role';
    END IF;

    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'PROFILE_FIELD_FORBIDDEN: plan';
    END IF;

    IF NEW.conversion_limit IS DISTINCT FROM OLD.conversion_limit THEN
      RAISE EXCEPTION 'PROFILE_FIELD_FORBIDDEN: conversion_limit';
    END IF;

    IF NEW.conversions_this_month IS DISTINCT FROM OLD.conversions_this_month THEN
      RAISE EXCEPTION 'PROFILE_FIELD_FORBIDDEN: conversions_this_month';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'PROFILE_FIELD_FORBIDDEN: created_at';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'PROFILE_FIELD_FORBIDDEN: id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_safe_updates ON public.profiles;
CREATE TRIGGER trg_profiles_safe_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_safe_updates();

-- ── Scheduled automatic expiry handling ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_daily_subscription_expiry_sync()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_user_id uuid;
  v_count integer := 0;
  v_user_ids uuid[] := '{}';
BEGIN
  FOR v_row IN
    UPDATE public.subscriptions
    SET
      subscription_status = 'expired',
      updated_at = now()
    WHERE subscription_status = 'active'
      AND expiry_date IS NOT NULL
      AND expiry_date < now()
    RETURNING id, user_id, plan_id, expiry_date
  LOOP
    v_count := v_count + 1;
    v_user_ids := array_append(v_user_ids, v_row.user_id);

    INSERT INTO public.logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      v_row.user_id,
      'subscription_expired',
      'subscription',
      v_row.id::text,
      jsonb_build_object(
        'plan_id', v_row.plan_id,
        'expired_at', v_row.expiry_date
      )
    );
  END LOOP;

  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM unnest(v_user_ids) AS t(user_id)
  LOOP
    PERFORM public.sync_profile_plan_for_user(v_user_id);
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_daily_subscription_expiry_sync() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_daily_subscription_expiry_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_daily_subscription_expiry_sync() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_subscription_expiry_sync() TO service_role;

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron extension could not be created in this environment.';
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'daily-subscription-expiry-sync'
    ) THEN
      PERFORM cron.schedule(
        'daily-subscription-expiry-sync',
        '15 1 * * *',
        $job$SELECT public.run_daily_subscription_expiry_sync();$job$
      );
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule expiry sync job automatically. Configure cron manually in Supabase.';
END;
$$;

-- ── Admin unlimited in quota RPC ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_conversion_with_quota(
  p_source_bookmaker text,
  p_destination_bookmaker text,
  p_code text,
  p_conversion_percentage integer,
  p_matched_count integer,
  p_unavailable_count integer,
  p_total_selections integer,
  p_original_total_odds numeric,
  p_destination_total_odds numeric,
  p_result jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile profiles%ROWTYPE;
  v_conversion_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  PERFORM public.expire_stale_subscriptions_for_user(v_user_id);

  SELECT *
  INTO v_profile
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_profile.role <> 'admin' AND v_profile.conversions_this_month >= v_profile.conversion_limit THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED';
  END IF;

  INSERT INTO conversions (
    user_id,
    source_bookmaker,
    destination_bookmaker,
    code,
    conversion_percentage,
    matched_count,
    unavailable_count,
    total_selections,
    original_total_odds,
    destination_total_odds,
    result
  ) VALUES (
    v_user_id,
    p_source_bookmaker,
    p_destination_bookmaker,
    p_code,
    p_conversion_percentage,
    p_matched_count,
    p_unavailable_count,
    p_total_selections,
    p_original_total_odds,
    p_destination_total_odds,
    COALESCE(p_result, '{}'::jsonb)
  )
  RETURNING id INTO v_conversion_id;

  IF v_profile.role <> 'admin' THEN
    UPDATE profiles
    SET conversions_this_month = conversions_this_month + 1
    WHERE id = v_user_id;
  END IF;

  INSERT INTO logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_user_id,
    'conversion_saved',
    'conversion',
    v_conversion_id::text,
    jsonb_build_object(
      'source', p_source_bookmaker,
      'destination', p_destination_bookmaker,
      'code', p_code,
      'percentage', p_conversion_percentage,
      'role', v_profile.role
    )
  );

  RETURN v_conversion_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_conversion_with_quota(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  jsonb
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.save_conversion_with_quota(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.save_conversion_with_quota(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  jsonb
) TO authenticated;
