/*
# Ensure UK bookmakers are present in global catalog (idempotent)

- Seeds the requested UK bookmakers into public.bookmakers.
- Uses ON CONFLICT to avoid duplicate rows and keep existing IDs stable.
- Keeps schema unchanged.
*/

INSERT INTO public.bookmakers (id, name, country, region, currency, website, supported_sports, active, logo_url)
VALUES
  ('bet365_uk', 'Bet365', 'GB', 'Europe', 'GBP', 'https://www.bet365.com', '["football","tennis","basketball"]'::jsonb, true, '/logos/bet365.svg'),
  ('william_hill_uk', 'William Hill', 'GB', 'Europe', 'GBP', 'https://www.williamhill.com', '["football","horse racing","tennis"]'::jsonb, true, '/logos/williamhill.svg'),
  ('ladbrokes_uk', 'Ladbrokes', 'GB', 'Europe', 'GBP', 'https://www.ladbrokes.com', '["football","horse racing","boxing"]'::jsonb, true, '/logos/ladbrokes.svg'),
  ('coral_uk', 'Coral', 'GB', 'Europe', 'GBP', 'https://www.coral.co.uk', '["football","horse racing","tennis"]'::jsonb, true, '/logos/coral.svg'),
  ('paddy_power_uk', 'Paddy Power', 'GB', 'Europe', 'GBP', 'https://www.paddypower.com', '["football","golf","horse racing"]'::jsonb, true, '/logos/paddypower.svg'),
  ('sky_bet_uk', 'Sky Bet', 'GB', 'Europe', 'GBP', 'https://www.skybet.com', '["football","golf","rugby"]'::jsonb, true, '/logos/skybet.svg'),
  ('betfair_uk', 'Betfair', 'GB', 'Europe', 'GBP', 'https://www.betfair.com', '["football","horse racing","cricket"]'::jsonb, true, '/logos/betfair.svg'),
  ('betvictor_uk', 'BetVictor', 'GB', 'Europe', 'GBP', 'https://www.betvictor.com', '["football","tennis","golf"]'::jsonb, true, '/logos/betvictor.svg'),
  ('unibet_uk', 'Unibet', 'GB', 'Europe', 'GBP', 'https://www.unibet.co.uk', '["football","tennis","esports"]'::jsonb, true, '/logos/unibet.svg'),
  ('888sport_uk', '888sport', 'GB', 'Europe', 'GBP', 'https://www.888sport.com', '["football","tennis","basketball"]'::jsonb, true, '/logos/888sport.svg')
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
