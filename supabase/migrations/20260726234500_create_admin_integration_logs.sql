/*
# Store admin integration diagnostics safely

- Persists admin bookmaker integration test outcomes.
- Stores only safe metadata and error categories.
- Never stores API keys, passwords, or tokens.
*/

CREATE TABLE IF NOT EXISTS public.admin_integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  admin_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_type text NOT NULL,
  success boolean NOT NULL,
  error_category text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_integration_logs_provider_created_at
  ON public.admin_integration_logs (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_integration_logs_admin_created_at
  ON public.admin_integration_logs (admin_user_id, created_at DESC);
