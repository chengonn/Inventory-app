$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env.production.local'
$caPath = Join-Path $projectRoot 'prisma/certs/supabase-ca.crt'
$content = [IO.File]::ReadAllText($envPath)
if ($content -notmatch '(?m)^NEXT_PUBLIC_SUPABASE_URL=https://qrfntparukzqokazvvfh\.supabase\.co\s*$') {
  throw 'Production project does not match inventory-v2-prod. No file changed.'
}
# These endpoints were verified in this project's Supabase Connect UI.
$securePassword = Read-Host 'Enter inventory-v2-prod Database password (hidden, without template brackets)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ([string]::IsNullOrEmpty($plainPassword)) { throw 'Password cannot be empty.' }
  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $runtimeUrl = 'postgresql://postgres.qrfntparukzqokazvvfh:' + $encodedPassword + '@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres'
  $migrationUrl = 'postgresql://postgres.qrfntparukzqokazvvfh:' + $encodedPassword + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require&schema=inventory&sslaccept=strict&sslcert=' + [Uri]::EscapeDataString($caPath)
  $ca = [IO.File]::ReadAllText($caPath).Replace("`r", '').Replace("`n", '\n')
  $updates = @{ DATABASE_URL = $runtimeUrl; DIRECT_URL = $migrationUrl; DATABASE_SSL_CA = '"' + $ca + '"' }
  foreach ($name in $updates.Keys) {
    $pattern = '(?ms)^' + $name + '=.*?(?=^[A-Z_]+=|\z)'
    if ($content -notmatch $pattern) { throw ('Missing setting: ' + $name) }
    $replacement = $name + '=' + $updates[$name] + "`n"
    $content = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement })
  }
  [IO.File]::WriteAllText($envPath, $content, [Text.UTF8Encoding]::new($false))
  Write-Host 'Production connection settings saved. Password was not printed. No database changes performed.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $plainPassword = $null
  $encodedPassword = $null
  $securePassword.Dispose()
}
