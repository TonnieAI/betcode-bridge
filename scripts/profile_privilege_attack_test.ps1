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

        return @{
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

        return @{
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
$serviceRole = Get-EnvValue -Text $envText -Name 'SUPABASE_SERVICE_ROLE_KEY'

if (-not $url -or -not $anon) {
    throw 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env'
}

$email = "sec.attack.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@example.com"
$password = 'S3cure!Pass12345'

$publicHeaders = @{
    apikey = $anon
    'Content-Type' = 'application/json'
}

$signUpBody = @{
    email = $email
    password = $password
    data = @{ username = 'attackprobe' }
} | ConvertTo-Json -Depth 5

$signUp = Invoke-HttpCapture -Method 'Post' -Uri "$url/auth/v1/signup" -Headers $publicHeaders -Body $signUpBody
$signUpObj = Parse-Json -Text $signUp.body

$token = $null
$userId = $null
if ($signUpObj) {
    $token = $signUpObj.access_token
    if ($signUpObj.user) {
        $userId = $signUpObj.user.id
    }
}

if (-not $token) {
    $signInBody = @{ email = $email; password = $password } | ConvertTo-Json
    $signIn = Invoke-HttpCapture -Method 'Post' -Uri "$url/auth/v1/token?grant_type=password" -Headers $publicHeaders -Body $signInBody
    $signInObj = Parse-Json -Text $signIn.body
    if ($signInObj) {
        $token = $signInObj.access_token
        if (-not $userId -and $signInObj.user) {
            $userId = $signInObj.user.id
        }
    }
}

if (-not $token -or -not $userId) {
    throw 'Could not acquire auth token for attacker test user.'
}

$authHeaders = @{
    apikey = $anon
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
}

$before = Invoke-HttpCapture -Method 'Get' -Uri "$url/rest/v1/profiles?select=id,username,avatar_url,role,plan,conversion_limit,conversions_this_month,preferences,notification_settings&id=eq.$userId" -Headers $authHeaders

$attemptRole = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $authHeaders -Body '{"role":"admin"}'
$attemptLimit = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $authHeaders -Body '{"conversion_limit":999999}'
$attemptUsername = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $authHeaders -Body '{"username":"attackprobe-safe"}'
$attemptAvatar = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $authHeaders -Body '{"avatar_url":"https://example.com/avatar-test.png"}'

$after = Invoke-HttpCapture -Method 'Get' -Uri "$url/rest/v1/profiles?select=id,username,avatar_url,role,plan,conversion_limit,conversions_this_month,preferences,notification_settings&id=eq.$userId" -Headers $authHeaders

$adminCheck = [ordered]@{
    executed = $false
    status = 'SKIPPED'
    detail = 'SUPABASE_SERVICE_ROLE_KEY not set in .env; could not execute live service-role update verification.'
}

if ($serviceRole) {
    $svcHeaders = @{
        apikey = $serviceRole
        Authorization = "Bearer $serviceRole"
        'Content-Type' = 'application/json'
    }

    $adminCheck.executed = $true

    $svcSet = Invoke-HttpCapture -Method 'Patch' -Uri "$url/rest/v1/profiles?id=eq.$userId" -Headers $svcHeaders -Body '{"role":"admin","plan":"basic","conversion_limit":1234}'
    $svcRead = Invoke-HttpCapture -Method 'Get' -Uri "$url/rest/v1/profiles?select=id,role,plan,conversion_limit&id=eq.$userId" -Headers $svcHeaders

    $adminCheck.request = $svcSet
    $adminCheck.readback = $svcRead
    $adminCheck.status = if ($svcSet.status -ge 200 -and $svcSet.status -lt 300) { 'PASS' } else { 'FAIL' }
}

$result = [ordered]@{
    email = $email
    userId = $userId
    expected = [ordered]@{
        role_patch = 'FAIL'
        conversion_limit_patch = 'FAIL'
        username_patch = 'SUCCESS'
        avatar_patch = 'SUCCESS'
    }
    checks = [ordered]@{
        role_patch = $attemptRole
        conversion_limit_patch = $attemptLimit
        username_patch = $attemptUsername
        avatar_patch = $attemptAvatar
    }
    profile_before = $before
    profile_after = $after
    admin_or_service_role_check = $adminCheck
}

$result | ConvertTo-Json -Depth 12
