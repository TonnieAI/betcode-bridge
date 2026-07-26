param(
    [string]$ServiceRoleKey
)

$ErrorActionPreference = 'Stop'

function Get-EnvValue {
    param(
        [string]$Text,
        [string]$Name
    )

    $m = [regex]::Match($Text, "(?m)^$Name=(.*)$")
    if (-not $m.Success) {
        return $null
    }

    return $m.Groups[1].Value.Trim()
}

function Invoke-HttpCapture {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Body
    )

    try {
        if ([string]::IsNullOrEmpty($Body)) {
            $response = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers
        }
        else {
            $response = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers -Body $Body
        }

        return [ordered]@{
            status = [int]$response.StatusCode
            body = $response.Content
        }
    }
    catch {
        $statusCode = 0
        $content = $_.Exception.Message

        if ($_.Exception.Response) {
            try {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
            catch {
                $statusCode = 0
            }

            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $content = $reader.ReadToEnd()
                $reader.Close()
            }
            catch {
                $content = $_.Exception.Message
            }
        }

        return [ordered]@{
            status = $statusCode
            body = $content
        }
    }
}

function Parse-Json {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    try {
        return ($Text | ConvertFrom-Json)
    }
    catch {
        return $null
    }
}

$envText = Get-Content .env -Raw
$url = Get-EnvValue -Text $envText -Name 'VITE_SUPABASE_URL'
$anon = Get-EnvValue -Text $envText -Name 'VITE_SUPABASE_ANON_KEY'

if (-not $ServiceRoleKey) {
    $ServiceRoleKey = Get-EnvValue -Text $envText -Name 'SUPABASE_SERVICE_ROLE_KEY'
}

if (-not $url -or -not $anon -or -not $ServiceRoleKey) {
    throw 'Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or service-role key.'
}

$email = "sec.verify.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@example.com"
$password = 'S3cure!Pass12345'

$anonHeaders = @{
    apikey = $anon
    'Content-Type' = 'application/json'
}

$signup = Invoke-HttpCapture -Method 'Post' -Uri "$url/auth/v1/signup" -Headers $anonHeaders -Body (@{
    email = $email
    password = $password
    data = @{ username = 'secverify' }
} | ConvertTo-Json -Depth 5)

$signupObj = Parse-Json -Text $signup.body
$token = $signupObj.access_token
$userId = $signupObj.user.id

if (-not $token -or -not $userId) {
    $signin = Invoke-HttpCapture -Method 'Post' -Uri "$url/auth/v1/token?grant_type=password" -Headers $anonHeaders -Body (@{ email = $email; password = $password } | ConvertTo-Json)
    $signinObj = Parse-Json -Text $signin.body
    $token = $signinObj.access_token
    if (-not $userId) {
        $userId = $signinObj.user.id
    }
}

if (-not $token -or -not $userId) {
    throw 'Could not obtain normal user session.'
}

$userHeaders = @{
    apikey = $anon
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
}

$serviceHeaders = @{
    apikey = $ServiceRoleKey
    Authorization = "Bearer $ServiceRoleKey"
    'Content-Type' = 'application/json'
}

$before = Invoke-HttpCapture -Method 'Get' -Uri "$url/rest/v1/profiles?select=id,username,avatar_url,role,plan,conversion_limit,conversions_this_month,preferences,notification_settings&id=eq.$userId" -Headers $userHeaders

$normalAttemptRole = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"role":"admin"}'
$normalAttemptPlan = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"plan":"basic"}'
$normalAttemptLimit = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"conversion_limit":999999}'
$normalAttemptUsage = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"conversions_this_month":77}'
$normalSafeUsername = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"username":"secverify-safe"}'
$normalSafeAvatar = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"avatar_url":"https://example.com/ok.png"}'
$normalSafePrefs = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"preferences":{"theme":"light"}}'
$normalSafeNotif = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $userHeaders -Body '{"notification_settings":{"marketing":false}}'

$servicePatchProtected = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $serviceHeaders -Body '{"role":"admin","plan":"basic","conversion_limit":1234,"conversions_this_month":5}'

$planList = Invoke-HttpCapture -Method 'Get' -Uri "$url/rest/v1/plans?select=id,duration,usage_limit&is_active=eq.true&order=id.asc&limit=1" -Headers $serviceHeaders
$planObj = Parse-Json -Text $planList.body
$planId = $null
$duration = 'monthly'
if ($planObj -and $planObj.Count -gt 0) {
    $planId = $planObj[0].id
    if ($planObj[0].duration) {
        $duration = $planObj[0].duration
    }
}

$subscriptionInsert = $null
$cancelRpc = $null
$syncRpc = $null
$expireRpc = $null

if ($planId) {
    $reference = "SEC-VERIFY-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    $subscriptionInsert = Invoke-HttpCapture -Method 'Post' -Uri "$url/rest/v1/subscriptions" -Headers $serviceHeaders -Body (@{
        user_id = $userId
        plan_id = $planId
        payment_provider = 'paystack'
        transaction_reference = $reference
        subscription_status = 'active'
        amount = 1000
        currency = 'NGN'
        billing_cycle = $duration
        start_date = (Get-Date).ToUniversalTime().ToString('o')
        expiry_date = (Get-Date).ToUniversalTime().AddDays(-2).ToString('o')
        metadata = @{ source = 'security_role_verification' }
    } | ConvertTo-Json -Depth 10)

    $syncRpc = Invoke-HttpCapture -Method 'Post' -Uri "$url/rest/v1/rpc/sync_profile_plan_for_user" -Headers $serviceHeaders -Body (@{ p_user_id = $userId } | ConvertTo-Json)
    $expireRpc = Invoke-HttpCapture -Method 'Post' -Uri "$url/rest/v1/rpc/expire_stale_subscriptions_for_user" -Headers $serviceHeaders -Body (@{ p_user_id = $userId } | ConvertTo-Json)
    $cancelRpc = Invoke-HttpCapture -Method 'Post' -Uri "$url/rest/v1/rpc/cancel_user_subscription" -Headers $serviceHeaders -Body (@{ p_user_id = $userId; p_reason = 'security-test' } | ConvertTo-Json)
}

$normalSyncDenied = Invoke-HttpCapture -Method 'Post' -Uri "$url/rest/v1/rpc/sync_profile_plan_for_user" -Headers $userHeaders -Body (@{ p_user_id = $userId } | ConvertTo-Json)
$normalExpireDenied = Invoke-HttpCapture -Method 'Post' -Uri "$url/rest/v1/rpc/expire_stale_subscriptions_for_user" -Headers $userHeaders -Body (@{ p_user_id = $userId } | ConvertTo-Json)
$normalCancelDenied = Invoke-HttpCapture -Method 'Post' -Uri "$url/rest/v1/rpc/cancel_user_subscription" -Headers $userHeaders -Body (@{ p_user_id = $userId; p_reason = 'security-test' } | ConvertTo-Json)

$after = Invoke-HttpCapture -Method 'Get' -Uri "$url/rest/v1/profiles?select=id,username,avatar_url,role,plan,conversion_limit,conversions_this_month,preferences,notification_settings&id=eq.$userId" -Headers $serviceHeaders
$subscriptionsAfter = Invoke-HttpCapture -Method 'Get' -Uri "$url/rest/v1/subscriptions?select=id,subscription_status,expiry_date,cancelled_at,user_id&user_id=eq.$userId&order=created_at.desc&limit=3" -Headers $serviceHeaders

$result = [ordered]@{
    email = $email
    userId = $userId
    normal_user_checks = [ordered]@{
        role_patch = $normalAttemptRole
        plan_patch = $normalAttemptPlan
        conversion_limit_patch = $normalAttemptLimit
        conversions_this_month_patch = $normalAttemptUsage
        safe_username_patch = $normalSafeUsername
        safe_avatar_patch = $normalSafeAvatar
        safe_preferences_patch = $normalSafePrefs
        safe_notification_settings_patch = $normalSafeNotif
        rpc_sync_denied = $normalSyncDenied
        rpc_expire_denied = $normalExpireDenied
        rpc_cancel_denied = $normalCancelDenied
    }
    service_role_checks = [ordered]@{
        protected_profile_patch = $servicePatchProtected
        subscriptions_insert = $subscriptionInsert
        rpc_sync = $syncRpc
        rpc_expire = $expireRpc
        rpc_cancel = $cancelRpc
    }
    profile_before = $before
    profile_after = $after
    subscriptions_after = $subscriptionsAfter
}

$result | ConvertTo-Json -Depth 12
