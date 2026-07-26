/*
# Subscription + Payment System

Creates normalized billing tables, secure RLS, and server-side functions for:
- plan catalog
- checkout lifecycle (pending -> active/failed/cancelled)
- webhook idempotency
- profile plan/usage-limit synchronization
- admin/user cancellation workflows
- stale subscription expiration
*/

-- ── Plans ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  duration text NOT NULL DEFAULT 'monthly' CHECK (duration IN ('monthly', 'yearly')),
  usage_limit integer NOT NULL DEFAULT 10,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_public_read" ON public.plans;
CREATE POLICY "plans_public_read"
ON public.plans
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "plans_admin_insert" ON public.plans;
CREATE POLICY "plans_admin_insert"
ON public.plans
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "plans_admin_update" ON public.plans;
CREATE POLICY "plans_admin_update"
ON public.plans
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "plans_admin_delete" ON public.plans;
CREATE POLICY "plans_admin_delete"
ON public.plans
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ── Subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  payment_provider text NOT NULL CHECK (payment_provider IN ('paystack', 'flutterwave', 'stripe')),
  transaction_reference text NOT NULL,
  subscription_status text NOT NULL CHECK (subscription_status IN ('active', 'pending', 'failed', 'cancelled', 'expired')),
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  start_date timestamptz,
  expiry_date timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_reference)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_user_select_or_admin" ON public.subscriptions;
CREATE POLICY "subscriptions_user_select_or_admin"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "subscriptions_admin_write" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_write"
ON public.subscriptions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  transaction_id text,
  gateway_reference text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'refunded')),
  payment_method text,
  payment_provider text NOT NULL CHECK (payment_provider IN ('paystack', 'flutterwave', 'stripe')),
  currency text NOT NULL DEFAULT 'NGN',
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway_reference)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_user_select_or_admin" ON public.payments;
CREATE POLICY "payments_user_select_or_admin"
ON public.payments
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "payments_admin_write" ON public.payments;
CREATE POLICY "payments_admin_write"
ON public.payments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ── Webhook events (idempotency) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('paystack', 'flutterwave', 'stripe')),
  event_key text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_key)
);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_webhook_events_admin_read" ON public.payment_webhook_events;
CREATE POLICY "payment_webhook_events_admin_read"
ON public.payment_webhook_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "payment_webhook_events_admin_write" ON public.payment_webhook_events;
CREATE POLICY "payment_webhook_events_admin_write"
ON public.payment_webhook_events
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry_date ON public.subscriptions(expiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON public.subscriptions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created_at ON public.payment_webhook_events(created_at DESC);

-- ── Shared updated_at trigger ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plans_set_updated_at ON public.plans;
CREATE TRIGGER trg_plans_set_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Plan seeding (idempotent) ─────────────────────────────────────────────────
INSERT INTO public.plans (id, name, price, currency, duration, usage_limit, features, is_active)
VALUES
  (
    'free',
    'Free',
    0,
    'NGN',
    'monthly',
    10,
    '["10 conversions per month", "Access to conversion engine", "Basic history"]'::jsonb,
    true
  ),
  (
    'basic',
    'Basic',
    2500,
    'NGN',
    'monthly',
    50,
    '["50 conversions per month", "Priority queue", "Favorites support"]'::jsonb,
    true
  ),
  (
    'pro',
    'Premium',
    5000,
    'NGN',
    'monthly',
    500,
    '["500 conversions per month", "Advanced analytics", "Faster support"]'::jsonb,
    true
  ),
  (
    'enterprise',
    'Enterprise',
    15000,
    'NGN',
    'monthly',
    10000,
    '["High volume limits", "Priority support", "Custom onboarding"]'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  duration = EXCLUDED.duration,
  usage_limit = EXCLUDED.usage_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ── Profile sync helper ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_profile_plan_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_sub public.subscriptions%ROWTYPE;
  v_limit integer;
BEGIN
  SELECT s.*
  INTO v_active_sub
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.subscription_status = 'active'
    AND (s.expiry_date IS NULL OR s.expiry_date > now())
  ORDER BY s.expiry_date DESC NULLS LAST, s.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT usage_limit INTO v_limit FROM public.plans WHERE id = v_active_sub.plan_id;

    UPDATE public.profiles
    SET
      plan = v_active_sub.plan_id,
      conversion_limit = COALESCE(v_limit, conversion_limit)
    WHERE id = p_user_id;
  ELSE
    SELECT usage_limit INTO v_limit FROM public.plans WHERE id = 'free';

    UPDATE public.profiles
    SET
      plan = 'free',
      conversion_limit = COALESCE(v_limit, 10)
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_plan_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_profile_plan_for_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_plan_for_user(uuid) TO authenticated;

-- ── Expire stale active subscriptions helper ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_stale_subscriptions_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.subscriptions
  SET
    subscription_status = 'expired',
    updated_at = now()
  WHERE user_id = p_user_id
    AND subscription_status = 'active'
    AND expiry_date IS NOT NULL
    AND expiry_date <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    PERFORM public.sync_profile_plan_for_user(p_user_id);
  END IF;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_subscriptions_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_subscriptions_for_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_subscriptions_for_user(uuid) TO authenticated;

-- ── Activate payment-verified subscription ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_subscription_by_reference(
  p_transaction_reference text,
  p_payment_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_subscription_id uuid;
BEGIN
  SELECT *
  INTO v_subscription
  FROM public.subscriptions
  WHERE transaction_reference = p_transaction_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
  END IF;

  IF v_subscription.subscription_status = 'active' THEN
    RETURN v_subscription.id;
  END IF;

  UPDATE public.subscriptions
  SET
    subscription_status = 'active',
    start_date = COALESCE(start_date, now()),
    expiry_date = CASE
      WHEN billing_cycle = 'yearly' THEN now() + interval '1 year'
      ELSE now() + interval '1 month'
    END,
    cancel_at_period_end = false,
    cancelled_at = NULL,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('verification_payload', COALESCE(p_payment_payload, '{}'::jsonb)),
    updated_at = now()
  WHERE id = v_subscription.id
  RETURNING id INTO v_subscription_id;

  UPDATE public.subscriptions
  SET
    subscription_status = 'expired',
    updated_at = now()
  WHERE user_id = v_subscription.user_id
    AND id <> v_subscription.id
    AND subscription_status = 'active';

  UPDATE public.payments
  SET
    status = 'success',
    paid_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('verification_payload', COALESCE(p_payment_payload, '{}'::jsonb))
  WHERE gateway_reference = p_transaction_reference;

  PERFORM public.sync_profile_plan_for_user(v_subscription.user_id);

  RETURN v_subscription_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_subscription_by_reference(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_subscription_by_reference(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_subscription_by_reference(text, jsonb) TO authenticated;

-- ── Cancel current subscription for a user ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_user_subscription(
  p_user_id uuid,
  p_subscription_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'user_requested'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
BEGIN
  SELECT id
  INTO v_subscription_id
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND (
      (p_subscription_id IS NOT NULL AND id = p_subscription_id)
      OR (p_subscription_id IS NULL AND subscription_status = 'active')
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
  END IF;

  UPDATE public.subscriptions
  SET
    subscription_status = 'cancelled',
    cancel_at_period_end = false,
    cancelled_at = now(),
    expiry_date = LEAST(COALESCE(expiry_date, now()), now()),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cancel_reason', p_reason),
    updated_at = now()
  WHERE id = v_subscription_id;

  UPDATE public.payments
  SET status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE status END
  WHERE subscription_id = v_subscription_id;

  PERFORM public.sync_profile_plan_for_user(p_user_id);

  RETURN v_subscription_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, uuid, text) TO authenticated;

-- ── Keep profile plan synced on subscription row changes ──────────────────────
CREATE OR REPLACE FUNCTION public.on_subscription_change_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_profile_plan_for_user(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_sync_profile ON public.subscriptions;
CREATE TRIGGER trg_subscription_sync_profile
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.on_subscription_change_sync_profile();

REVOKE EXECUTE ON FUNCTION public.on_subscription_change_sync_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_subscription_change_sync_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.on_subscription_change_sync_profile() TO authenticated;

-- ── Upgrade existing quota RPC to enforce expiry checks before quota logic ───
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
