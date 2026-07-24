/*
# Add atomic quota-enforced conversion save RPC

This function saves a conversion, increments monthly usage, and writes a log
entry in one transaction while enforcing conversion limits server-side.
*/

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

  SELECT *
  INTO v_profile
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_profile.conversions_this_month >= v_profile.conversion_limit THEN
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

  UPDATE profiles
  SET conversions_this_month = conversions_this_month + 1
  WHERE id = v_user_id;

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
      'percentage', p_conversion_percentage
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
