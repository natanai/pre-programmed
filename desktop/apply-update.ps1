param(
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][int]$OldPid,
  [Parameter(Mandatory=$true)][string]$TempRoot
)
$ErrorActionPreference = "Stop"
$engine = Join-Path $Root "_engine"
$next = Join-Path $Root "_engine.next"
$previous = Join-Path $Root "_engine.previous"
$switched = $false
$success = $false
try {
  for ($i = 0; $i -lt 120; $i++) {
    if (-not (Get-Process -Id $OldPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
  }
  if (Get-Process -Id $OldPid -ErrorAction SilentlyContinue) {
    throw "The running game did not close. No files were replaced."
  }
  if (-not (Test-Path -LiteralPath $engine) -or -not (Test-Path -LiteralPath $next)) {
    throw "The old or staged engine folder is missing."
  }
  if (Test-Path -LiteralPath $previous) { throw "A previous update recovery folder is already present." }

  Rename-Item -LiteralPath $engine -NewName "_engine.previous"
  Rename-Item -LiteralPath $next -NewName "_engine"
  $switched = $true
  $oldData = Join-Path $previous "data"
  if (Test-Path -LiteralPath $oldData) {
    Move-Item -LiteralPath $oldData -Destination (Join-Path $engine "data")
  }
  $executable = Join-Path $engine "Pre-Programmed.exe"
  if (-not (Test-Path -LiteralPath $executable)) { throw "The replacement executable is missing." }
  Start-Process -FilePath $executable -WorkingDirectory $engine
  $success = $true
} catch {
  $message = $_.Exception.Message
  try {
    if (Test-Path -LiteralPath $previous) {
      if ($switched -and (Test-Path -LiteralPath $engine)) {
        $newData = Join-Path $engine "data"
        if (Test-Path -LiteralPath $newData) {
          Move-Item -LiteralPath $newData -Destination (Join-Path $previous "data")
        }
        Rename-Item -LiteralPath $engine -NewName "_engine.failed"
      }
      if (-not (Test-Path -LiteralPath $engine)) {
        Rename-Item -LiteralPath $previous -NewName "_engine"
      }
    }
  } catch {
    $message += [Environment]::NewLine + "Automatic rollback could not complete: " + $_.Exception.Message
  }
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    "The update could not be installed. Your original game files were kept if possible." + [Environment]::NewLine + [Environment]::NewLine + $message,
    "Pre-Programmed update failed", "OK", "Error"
  ) | Out-Null
  exit 1
} finally {
  if ($success -and (Test-Path -LiteralPath $previous)) {
    Remove-Item -LiteralPath $previous -Recurse -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
