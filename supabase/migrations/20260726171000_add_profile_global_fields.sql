/*
# Add profile country/language/currency fields
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_country_check,
  DROP CONSTRAINT IF EXISTS profiles_currency_check,
  DROP CONSTRAINT IF EXISTS profiles_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_check CHECK (country IN ('US','GB','FR','ZA','GH','KE','MZ','NG')),
  ADD CONSTRAINT profiles_currency_check CHECK (currency IN ('USD','GBP','EUR','NGN','ZAR','GHS','KES','MZN')),
  ADD CONSTRAINT profiles_language_check CHECK (language IN ('en','pt','fr'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, country, currency, language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'US'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'currency', ''), 'USD'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'language', ''), 'en')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
