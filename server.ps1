$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:8085/")
$http.Start()
Write-Host "Server running on http://localhost:8085/"
$folder = $PSScriptRoot

while ($http.IsListening) {
    try {
        $context = $http.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "/index.html" }
        $localPath = Join-Path $folder $urlPath.TrimStart('/')

        if (Test-Path $localPath) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $ext = [System.IO.Path]::GetExtension($localPath)
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                default { $response.ContentType = "application/octet-stream" }
            }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
        # ignore context errors on shutdown
    }
}
