/*
# Betting Companies Management schema + storage setup

1. Creates table `public.betting_companies`.
2. Prevents duplicate company names (case-insensitive).
3. Creates public storage bucket `betting-logos` (5 MB file size limit, images only).
4. Adds RLS policies:
   - Public read for company list.
   - Admin-only create/update/delete.
5. Adds storage policies:
   - Public read for logo files.
   - Admin-only upload/update/delete in `betting-logos` bucket.
*/

CREATE TABLE IF NOT EXISTS public.betting_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  logo_url text,
  status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_betting_companies_name_unique_ci
  ON public.betting_companies (lower(name));

ALTER TABLE public.betting_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "betting_companies_public_read" ON public.betting_companies;
CREATE POLICY "betting_companies_public_read"
ON public.betting_companies
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "betting_companies_admin_insert" ON public.betting_companies;
CREATE POLICY "betting_companies_admin_insert"
ON public.betting_companies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "betting_companies_admin_update" ON public.betting_companies;
CREATE POLICY "betting_companies_admin_update"
ON public.betting_companies
FOR UPDATE
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

DROP POLICY IF EXISTS "betting_companies_admin_delete" ON public.betting_companies;
CREATE POLICY "betting_companies_admin_delete"
ON public.betting_companies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'betting-logos',
  'betting-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "betting_logos_public_read" ON storage.objects;
CREATE POLICY "betting_logos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'betting-logos');

DROP POLICY IF EXISTS "betting_logos_admin_insert" ON storage.objects;
CREATE POLICY "betting_logos_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'betting-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "betting_logos_admin_update" ON storage.objects;
CREATE POLICY "betting_logos_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'betting-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'betting-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "betting_logos_admin_delete" ON storage.objects;
CREATE POLICY "betting_logos_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'betting-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
