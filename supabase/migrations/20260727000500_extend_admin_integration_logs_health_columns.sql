/*
# Extend admin integration logs for health monitoring

Adds structured monitoring fields used by the Admin Integration Health dashboard.
No secret credential values are stored in these fields.
*/

ALTER TABLE public.admin_integration_logs
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS response_time_ms integer;

CREATE INDEX IF NOT EXISTS idx_admin_integration_logs_provider_status_created_at
  ON public.admin_integration_logs (provider, status, created_at DESC);
