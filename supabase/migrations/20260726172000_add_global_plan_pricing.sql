/*
# Extend plans for localized country/currency pricing
*/

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS currency_symbol text NOT NULL DEFAULT '$',
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS localized_price numeric(12, 2);

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_country_check,
  DROP CONSTRAINT IF EXISTS plans_payment_provider_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_country_check CHECK (country IN ('GLOBAL','US','GB','FR','ZA','GH','KE','MZ','NG')),
  ADD CONSTRAINT plans_payment_provider_check CHECK (payment_provider IN ('paystack','flutterwave','stripe'));

CREATE TABLE IF NOT EXISTS public.plan_localized_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  country text NOT NULL,
  currency text NOT NULL,
  currency_symbol text NOT NULL,
  payment_provider text NOT NULL CHECK (payment_provider IN ('paystack', 'flutterwave', 'stripe')),
  localized_price numeric(12, 2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, country, currency, payment_provider)
);

ALTER TABLE public.plan_localized_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_localized_prices_public_read" ON public.plan_localized_prices;
CREATE POLICY "plan_localized_prices_public_read"
ON public.plan_localized_prices
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "plan_localized_prices_admin_write" ON public.plan_localized_prices;
CREATE POLICY "plan_localized_prices_admin_write"
ON public.plan_localized_prices
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

INSERT INTO public.plan_localized_prices (plan_id, country, currency, currency_symbol, payment_provider, localized_price)
VALUES
  ('pro', 'US', 'USD', '$', 'stripe', 9.99),
  ('pro', 'GB', 'GBP', '£', 'stripe', 7.99),
  ('pro', 'FR', 'EUR', '€', 'stripe', 8.99),
  ('pro', 'ZA', 'ZAR', 'R', 'flutterwave', 179.00),
  ('pro', 'GH', 'GHS', 'GH₵', 'paystack', 95.00),
  ('pro', 'KE', 'KES', 'KSh', 'flutterwave', 1299.00),
  ('pro', 'MZ', 'MZN', 'MT', 'flutterwave', 650.00),
  ('pro', 'NG', 'NGN', '₦', 'paystack', 5000.00),

  ('basic', 'US', 'USD', '$', 'stripe', 4.99),
  ('basic', 'GB', 'GBP', '£', 'stripe', 3.99),
  ('basic', 'FR', 'EUR', '€', 'stripe', 4.49),
  ('basic', 'ZA', 'ZAR', 'R', 'flutterwave', 89.00),
  ('basic', 'GH', 'GHS', 'GH₵', 'paystack', 48.00),
  ('basic', 'KE', 'KES', 'KSh', 'flutterwave', 650.00),
  ('basic', 'MZ', 'MZN', 'MT', 'flutterwave', 320.00),
  ('basic', 'NG', 'NGN', '₦', 'paystack', 2500.00)
ON CONFLICT (plan_id, country, currency, payment_provider) DO UPDATE
SET
  currency_symbol = EXCLUDED.currency_symbol,
  localized_price = EXCLUDED.localized_price,
  is_active = true,
  updated_at = now();
