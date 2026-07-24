/*
# Fix SECURITY DEFINER exposure on handle_new_user

1. Security Issue
   The function `public.handle_new_user()` is defined as SECURITY DEFINER and was
   executable by `anon` and `authenticated` roles via the PostgREST RPC endpoint
   `/rest/v1/rpc/handle_new_user`. This allowed any client to invoke the function
   directly, bypassing the intended trigger-only execution path.

2. Changes
   - Revoke EXECUTE on `public.handle_new_user` from `PUBLIC`, `anon`, and `authenticated`.
   - The function remains callable by the trigger (runs as the trigger owner / event role)
     because internal trigger invocation does not require explicit EXECUTE grants to
     `anon`/`authenticated`.
   - No changes to function body or logic.

3. Notes
   - SECURITY DEFINER is still appropriate here because the function inserts into
     `public.profiles` and needs elevated privileges to do so during the auth trigger.
   - Only direct RPC invocation by API clients is blocked.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
