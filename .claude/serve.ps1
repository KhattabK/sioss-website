# Minimal static file server for local preview (not deployed).
param([int]$Port = 4173)
$root = Split-Path -Parent $PSScriptRoot
$mime = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.json'='application/json'; '.xml'='application/xml'; '.txt'='text/plain; charset=utf-8'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.ico'='image/x-icon'; '.svg'='image/svg+xml'; '.pdf'='application/pdf'; '.mp4'='video/mp4' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    # Local-only helper: POST /__save/<name>.png writes a rendered image into marketing/
    if ($ctx.Request.HttpMethod -eq 'POST' -and $rel -match '^__save/([\w-]+\.png)$') {
      $outDir = Join-Path $root 'marketing'
      if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }
      $ms = New-Object IO.MemoryStream; $ctx.Request.InputStream.CopyTo($ms)
      [IO.File]::WriteAllBytes((Join-Path $outDir $Matches[1]), $ms.ToArray())
      $ctx.Response.StatusCode = 204; continue
    }
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $path.StartsWith($root)) { $ctx.Response.StatusCode = 403; continue }
    if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
    if (-not (Test-Path $path -PathType Leaf)) { $ctx.Response.StatusCode = 404; $path = Join-Path $root '404.html' }
    $bytes = [IO.File]::ReadAllBytes($path)
    $type = $mime[[IO.Path]::GetExtension($path).ToLower()]; if (-not $type) { $type = 'application/octet-stream' }
    $ctx.Response.ContentType = $type
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { Write-Host $_ } finally { $ctx.Response.Close() }
}
