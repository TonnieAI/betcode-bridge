/*
# BetCode Bridge — Core Schema

1. Purpose
   Creates the core data tables for the BetCode Bridge bet-slip conversion platform.
   This is a multi-user app with sign-in, so all tables are owner-scoped with
   user_id DEFAULT auth.uid() and authenticated-only RLS policies.

2. New Tables
   - `profiles` — user profile data (username, avatar, plan, conversion counters)
   - `conversions` — saved conversion results (source/dest bookmaker, code, result JSON, stats)
   - `favorites` — saved favorite bookmaker pairs for quick access
   - `notifications` — user notifications (conversion, odds, maintenance, subscription)
   - `logs` — audit/system log entries

3. Security
   - RLS enabled on every table.
   - 4 CRUD policies per table (select/insert/update/delete), scoped TO authenticated
     with auth.uid() = user_id ownership checks.
   - user_id columns default to auth.uid() so inserts that omit user_id succeed.

4. Notes
   - Uses gen_random_uuid() for all primary keys.
   - created_at defaults to now().
   - All tables use ON DELETE CASCADE from auth.users.
*/

-- ── Profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  avatar_url text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','basic','pro','enterprise')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  conversions_this_month integer NOT NULL DEFAULT 0,
  conversion_limit integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ── Conversions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_bookmaker text NOT NULL,
  destination_bookmaker text NOT NULL,
  code text NOT NULL,
  conversion_percentage integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  unavailable_count integer NOT NULL DEFAULT 0,
  total_selections integer NOT NULL DEFAULT 0,
  original_total_odds numeric NOT NULL DEFAULT 1,
  destination_total_odds numeric NOT NULL DEFAULT 1,
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversions" ON conversions;
CREATE POLICY "select_own_conversions" ON conversions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversions" ON conversions;
CREATE POLICY "insert_own_conversions" ON conversions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_conversions" ON conversions;
CREATE POLICY "update_own_conversions" ON conversions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversions" ON conversions;
CREATE POLICY "delete_own_conversions" ON conversions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conversions_user_id ON conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversions_created_at ON conversions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversions_source ON conversions(source_bookmaker);
CREATE INDEX IF NOT EXISTS idx_conversions_dest ON conversions(destination_bookmaker);

-- ── Favorites ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_bookmaker text NOT NULL,
  destination_bookmaker text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_bookmaker, destination_bookmaker)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_favorites" ON favorites;
CREATE POLICY "select_own_favorites" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_favorites" ON favorites;
CREATE POLICY "insert_own_favorites" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_favorites" ON favorites;
CREATE POLICY "update_own_favorites" ON favorites FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_favorites" ON favorites;
CREATE POLICY "delete_own_favorites" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── Logs ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_logs" ON logs;
CREATE POLICY "select_own_logs" ON logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_logs" ON logs;
CREATE POLICY "insert_own_logs" ON logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_logs" ON logs;
CREATE POLICY "update_own_logs" ON logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_logs" ON logs;
CREATE POLICY "delete_own_logs" ON logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── Auto-create profile on signup ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
