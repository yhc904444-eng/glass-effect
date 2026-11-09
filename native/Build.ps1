[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework 4.x compiler was not found.' }
$output=Join-Path $PSScriptRoot 'glass-adaptive-sampler.exe'
& $compiler /nologo /target:exe /platform:x64 /optimize+ /r:System.Drawing.dll /r:System.Web.Extensions.dll ('/out:'+$output) (Join-Path $PSScriptRoot 'AdaptiveSampler.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native background sampler compilation failed.' }
Write-Host 'Built native background sampler.'
