/*
# Seed default betting companies (idempotent)

- Inserts core bookmakers if they do not already exist.
- Uses case-insensitive uniqueness check on name to avoid duplicates.
- Leaves existing rows unchanged.
*/

INSERT INTO public.betting_companies (name, website, status)
SELECT seed.name, seed.website, true
FROM (
  VALUES
    ('Bet9ja', 'https://bet9ja.com'),
    ('SportyBet', 'https://sportybet.com'),
    ('BetKing', 'https://betking.com'),
    ('1xBet', 'https://1xbet.ng'),
    ('MSport', 'https://msport.com')
) AS seed(name, website)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.betting_companies existing
  WHERE lower(existing.name) = lower(seed.name)
);
