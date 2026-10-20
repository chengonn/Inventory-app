# Run interactively in your own PowerShell. No credential is saved or printed.
# Official Supabase Auth Admin API, matching auth.admin.updateUserById.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
$endpoint = 'https://vsrvjhidcltrbzixdcgb.supabase.co/auth/v1/admin/users/06326c79-072c-42a8-abf2-efe95e4872eb'
$expectedEmail = 'chengonnl.cj@gmail.com'

function Read-PrivateValue([string]$prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}

try {
  Write-Host 'Target: inventory-v2-dev DEMO App account only. Production is untouched.'
  Write-Host 'Use a new password DIFFERENT from your production and personal passwords.'
  $adminKey = Read-PrivateValue 'Paste DEMO Supabase secret key or service_role key (hidden)'
  $headers = @{ apikey = $adminKey; Authorization = "Bearer $adminKey" }
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $user = Invoke-RestMethod -Uri $endpoint -Method Get -Headers $headers -TimeoutSec 20 -MaximumRedirection 0
  if ($user.email -cne $expectedEmail -or $user.id -cne '06326c79-072c-42a8-abf2-efe95e4872eb') {
    throw 'Account mismatch'
  }
  $password = Read-PrivateValue 'New DEMO App password (12-1024 characters, hidden)'
  $confirmPassword = Read-PrivateValue 'Repeat new DEMO App password (hidden)'
  if ($password.Length -lt 12 -or $password.Length -gt 1024 -or $password -cne $confirmPassword) {
    Write-Host 'Passwords must match and contain 12-1024 characters. Nothing changed.'
    exit 1
  }
  $confirm = Read-Host 'Type SET to update only the DEMO App password'
  if ($confirm -cne 'SET') { Write-Host 'Cancelled. Nothing changed.'; exit 1 }
  $body = [Text.Encoding]::UTF8.GetBytes((@{ password = $password } | ConvertTo-Json -Compress))
  $updated = Invoke-RestMethod -Uri $endpoint -Method Put -Headers $headers -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 20 -MaximumRedirection 0
  if ($updated.id -cne $user.id) { throw 'Unexpected response' }
  Write-Host 'DEMO App password updated successfully. No secrets were saved. Close this terminal after use.'
} catch {
  Write-Host 'Could not complete the update. Check the DEMO admin key and connection, then retry. No secret details printed.'
  exit 1
} finally {
  if ($body) { [Array]::Clear($body, 0, $body.Length) }
  if ($headers) { $headers.Clear() }
  $adminKey = $null; $password = $null; $confirmPassword = $null; $user = $null; $updated = $null
}
