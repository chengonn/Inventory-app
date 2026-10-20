$ErrorActionPreference = 'Stop'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
Write-Host 'Create a NEW visitor account only in inventory-v2-dev. Company Production is untouched.'
Write-Host 'Private runtime settings are saved in ignored .env.guest.local; never share that file.'
if ((Read-Host 'Type CREATE to continue') -cne 'CREATE') { exit 1 }
$secure = Read-Host 'Paste inventory-v2-dev Secret key or legacy service_role key (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $adminKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $adminKey | & 'C:\Program Files\nodejs\node.exe' --use-system-ca (Join-Path $PSScriptRoot 'create-guest-account.mjs')
} finally {
  $adminKey = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $secure.Dispose()
}
