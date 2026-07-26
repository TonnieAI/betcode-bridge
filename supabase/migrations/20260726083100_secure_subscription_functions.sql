/*
# Secure privileged subscription functions

Locks down execution of SECURITY DEFINER billing functions so normal authenticated
users cannot call them directly from the client.
*/

REVOKE EXECUTE ON FUNCTION public.activate_subscription_by_reference(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_subscription_by_reference(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_subscription_by_reference(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_by_reference(text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_user_subscription(uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_profile_plan_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_profile_plan_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_plan_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_plan_for_user(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_stale_subscriptions_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_subscriptions_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_subscriptions_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_subscriptions_for_user(uuid) TO service_role;
