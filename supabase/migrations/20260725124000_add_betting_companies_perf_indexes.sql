/*
# Performance indexes for betting_companies query patterns

- Supports sorting by created_at.
- Supports filtering by status.
*/

CREATE INDEX IF NOT EXISTS idx_betting_companies_created_at_desc
  ON public.betting_companies (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_betting_companies_status
  ON public.betting_companies (status);
