param([Parameter(Mandatory=$true)][string]$JdkPath)
$ErrorActionPreference='Stop'
$signingDirectory=Join-Path $env:LOCALAPPDATA 'ChatReplay\release-signing'
$securePassword=ConvertTo-SecureString (Get-Content -Raw -LiteralPath (Join-Path $signingDirectory 'release-password.dpapi'))
$env:JAVA_HOME=$JdkPath
$env:RELEASE_STORE_FILE=Join-Path $signingDirectory 'chat-replay-release.p12'
$env:RELEASE_STORE_PASSWORD=[System.Net.NetworkCredential]::new('', $securePassword).Password
$env:RELEASE_KEY_PASSWORD=$env:RELEASE_STORE_PASSWORD
$env:RELEASE_KEY_ALIAS='chat-replay'
Push-Location (Join-Path $PSScriptRoot '..\android')
try {
  & .\gradlew.bat assembleStandardRelease assemblePreviewRelease --no-configuration-cache --console=plain
  if($LASTEXITCODE -ne 0){throw 'Android release build failed.'}
} finally {
  Pop-Location
  Remove-Item Env:RELEASE_STORE_FILE,Env:RELEASE_STORE_PASSWORD,Env:RELEASE_KEY_PASSWORD,Env:RELEASE_KEY_ALIAS -ErrorAction SilentlyContinue
}
