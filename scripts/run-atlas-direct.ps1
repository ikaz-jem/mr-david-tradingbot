param(
  [Parameter(Mandatory = $true)][string]$Script,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs
)

$envLine = Get-Content -LiteralPath '.env.local' | Where-Object { $_ -like 'MONGODB_URI=*' } | Select-Object -First 1
if (-not $envLine) { throw 'MONGODB_URI is missing from .env.local.' }
$configured = $envLine.Substring('MONGODB_URI='.Length).Trim()
$uri = [System.Uri]$configured
if ($uri.Scheme -ne 'mongodb+srv') { & node --env-file=.env.local --experimental-strip-types $Script @ScriptArgs; exit $LASTEXITCODE }

$srvName = "_mongodb._tcp.$($uri.Host)"
$srv = Invoke-RestMethod -Uri "https://dns.google/resolve?name=$srvName&type=SRV"
if ($srv.Status -ne 0 -or -not $srv.Answer) { throw 'Atlas SRV records could not be resolved.' }
$hosts = @($srv.Answer | ForEach-Object { $parts = $_.data -split ' '; "$($parts[3].TrimEnd('.')):$($parts[2])" }) -join ','
$txt = Invoke-RestMethod -Uri "https://dns.google/resolve?name=$($uri.Host)&type=TXT"
$txtOptions = if ($txt.Status -eq 0 -and $txt.Answer) { ($txt.Answer[0].data -replace '"', '') } else { '' }
$configuredQuery = $uri.Query.TrimStart('?')
$options = @('tls=true', $txtOptions, $configuredQuery) | Where-Object { $_ } | Select-Object -Unique
$env:MONGODB_URI = "mongodb://$($uri.UserInfo)@$hosts$($uri.AbsolutePath)?$($options -join '&')"
& node --env-file=.env.local --experimental-strip-types $Script @ScriptArgs
exit $LASTEXITCODE
