/*
# Create global bookmakers catalog
*/

CREATE TABLE IF NOT EXISTS public.bookmakers (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  region text NOT NULL,
  currency text NOT NULL,
  website text NOT NULL,
  supported_sports jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bookmakers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmakers_public_read" ON public.bookmakers;
CREATE POLICY "bookmakers_public_read"
ON public.bookmakers
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "bookmakers_admin_write" ON public.bookmakers;
CREATE POLICY "bookmakers_admin_write"
ON public.bookmakers
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

CREATE INDEX IF NOT EXISTS idx_bookmakers_region_active ON public.bookmakers(region, active);
CREATE INDEX IF NOT EXISTS idx_bookmakers_country_active ON public.bookmakers(country, active);

INSERT INTO public.bookmakers (id, name, country, region, currency, website, supported_sports, active, logo_url)
VALUES
  ('bet365_uk', 'Bet365', 'GB', 'Europe', 'GBP', 'https://www.bet365.com', '["football","tennis","basketball"]'::jsonb, true, NULL),
  ('william_hill_uk', 'William Hill', 'GB', 'Europe', 'GBP', 'https://www.williamhill.com', '["football","horse racing","tennis"]'::jsonb, true, NULL),
  ('betfair_uk', 'Betfair', 'GB', 'Europe', 'GBP', 'https://www.betfair.com', '["football","horse racing","cricket"]'::jsonb, true, NULL),
  ('sky_bet_uk', 'Sky Bet', 'GB', 'Europe', 'GBP', 'https://www.skybet.com', '["football","golf","rugby"]'::jsonb, true, NULL),
  ('ladbrokes_uk', 'Ladbrokes', 'GB', 'Europe', 'GBP', 'https://www.ladbrokes.com', '["football","horse racing","boxing"]'::jsonb, true, NULL),
  ('coral_uk', 'Coral', 'GB', 'Europe', 'GBP', 'https://www.coral.co.uk', '["football","horse racing","tennis"]'::jsonb, true, NULL),
  ('paddy_power_uk', 'Paddy Power', 'GB', 'Europe', 'GBP', 'https://www.paddypower.com', '["football","golf","horse racing"]'::jsonb, true, NULL),
  ('unibet_uk', 'Unibet', 'GB', 'Europe', 'GBP', 'https://www.unibet.co.uk', '["football","tennis","esports"]'::jsonb, true, NULL),
  ('betvictor_uk', 'BetVictor', 'GB', 'Europe', 'GBP', 'https://www.betvictor.com', '["football","tennis","golf"]'::jsonb, true, NULL),

  ('draftkings_us', 'DraftKings', 'US', 'North America', 'USD', 'https://sportsbook.draftkings.com', '["basketball","american football","baseball"]'::jsonb, true, NULL),
  ('fanduel_us', 'FanDuel', 'US', 'North America', 'USD', 'https://sportsbook.fanduel.com', '["basketball","american football","baseball"]'::jsonb, true, NULL),
  ('betmgm_us', 'BetMGM', 'US', 'North America', 'USD', 'https://sports.betmgm.com', '["basketball","american football","hockey"]'::jsonb, true, NULL),
  ('caesars_us', 'Caesars Sportsbook', 'US', 'North America', 'USD', 'https://www.caesars.com/sportsbook-and-casino', '["basketball","american football","baseball"]'::jsonb, true, NULL),
  ('bet365_us', 'bet365 US', 'US', 'North America', 'USD', 'https://www.bet365.com', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('fanatics_us', 'Fanatics Sportsbook', 'US', 'North America', 'USD', 'https://sportsbook.fanatics.com', '["basketball","american football","baseball"]'::jsonb, true, NULL),

  ('hollywoodbets_za', 'Hollywoodbets', 'ZA', 'Africa', 'ZAR', 'https://www.hollywoodbets.net', '["football","rugby","cricket"]'::jsonb, true, NULL),
  ('betway_za', 'Betway', 'ZA', 'Africa', 'ZAR', 'https://www.betway.co.za', '["football","cricket","rugby"]'::jsonb, true, NULL),
  ('supabets_za', 'Supabets', 'ZA', 'Africa', 'ZAR', 'https://www.supabets.co.za', '["football","horse racing","basketball"]'::jsonb, true, NULL),
  ('sportingbet_za', 'Sportingbet', 'ZA', 'Africa', 'ZAR', 'https://www.sportingbet.co.za', '["football","tennis","rugby"]'::jsonb, true, NULL),
  ('gbets_za', 'Gbets', 'ZA', 'Africa', 'ZAR', 'https://www.gbets.co.za', '["football","horse racing","tennis"]'::jsonb, true, NULL),

  ('betway_gh', 'Betway Ghana', 'GH', 'Africa', 'GHS', 'https://www.betway.com.gh', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('betpawa_gh', 'BetPawa', 'GH', 'Africa', 'GHS', 'https://www.betpawa.com', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('xbet_gh', '1xBet Ghana', 'GH', 'Africa', 'GHS', 'https://1xbet.com.gh', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('sportybet_gh', 'SportyBet Ghana', 'GH', 'Africa', 'GHS', 'https://www.sportybet.com', '["football","basketball","tennis"]'::jsonb, true, NULL),

  ('sportpesa_ke', 'SportPesa', 'KE', 'Africa', 'KES', 'https://www.sportpesa.com', '["football","rugby","basketball"]'::jsonb, true, NULL),
  ('betika_ke', 'Betika', 'KE', 'Africa', 'KES', 'https://www.betika.com', '["football","basketball","volleyball"]'::jsonb, true, NULL),
  ('betway_ke', 'Betway Kenya', 'KE', 'Africa', 'KES', 'https://www.betway.co.ke', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('odibets_ke', 'Odibets', 'KE', 'Africa', 'KES', 'https://odibets.com', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('mozzart_ke', 'Mozzart Bet Kenya', 'KE', 'Africa', 'KES', 'https://www.mozzartbet.co.ke', '["football","basketball","tennis"]'::jsonb, true, NULL),

  ('betway_mz', 'Betway Mozambique', 'MZ', 'Africa', 'MZN', 'https://www.betway.co.mz', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('premierbet_mz', 'Premier Bet Mozambique', 'MZ', 'Africa', 'MZN', 'https://www.premierbet.co.mz', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('888bets_mz', '888bets', 'MZ', 'Africa', 'MZN', 'https://888bets.co.mz', '["football","basketball","tennis"]'::jsonb, true, NULL),
  ('mozzart_mz', 'Mozzart Bet Mozambique', 'MZ', 'Africa', 'MZN', 'https://www.mozzartbet.co.mz', '["football","basketball","tennis"]'::jsonb, true, NULL)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  region = EXCLUDED.region,
  currency = EXCLUDED.currency,
  website = EXCLUDED.website,
  supported_sports = EXCLUDED.supported_sports,
  active = EXCLUDED.active,
  logo_url = EXCLUDED.logo_url,
  updated_at = now();
