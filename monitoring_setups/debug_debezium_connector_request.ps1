# Debug posting the Debezium connector payload and print full HTTP response
# Run from this folder:
# .\debug_debezium_connector_request.ps1

$jsonPayload = @"
{
  "name": "mes-workorder-connector",
  "config": {
    "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector",
    "tasks.max": "1",
    "database.hostname": "host.docker.internal",
    "database.port": "1433",
    "database.user": "debezium_user",
    "database.password": "0987654321",
    "database.names": "mes_new",
    "topic.prefix": "mes_server",
    "table.include.list": "dbo.WorkOrder",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:29092",
    "schema.history.internal.kafka.topic": "schema-changes.mes_new",
    "database.encrypt": "false",
    "database.trustServerCertificate": "true"
  }
}
"@

Write-Host "Payload to send:`n" $jsonPayload
Write-Host "Posting to http://localhost:8083/connectors/ ..."

try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8083/connectors/" -Method Post -ContentType "application/json" -Body $jsonPayload -ErrorAction Stop
    Write-Host "HTTP Status:" $resp.StatusCode
    Write-Host "Response headers:`n" ($resp.Headers | Out-String)
    Write-Host "Response content:`n" $resp.Content
} catch {
    Write-Host "Request failed:`n" $_.Exception.Message -ForegroundColor Red
    $webResp = $_.Exception.Response
    if ($webResp -ne $null) {
        $httpResp = [System.Net.HttpWebResponse]$webResp
        Write-Host "HTTP Status:" $httpResp.StatusCode
        Write-Host "Response headers:`n" ($httpResp.Headers | Out-String)
        $sr = New-Object System.IO.StreamReader($httpResp.GetResponseStream())
        $body = $sr.ReadToEnd()
        Write-Host "Response content:`n" $body
    } else {
        Write-Host "No HTTP response available from the exception." -ForegroundColor Yellow
    }
}

Write-Host "Also listing installed connector plugins (short):"
try {
    $plugins = Invoke-RestMethod -Uri "http://localhost:8083/connector-plugins" -Method Get
    $plugins | Select-Object -Property class, `name` | Format-Table -AutoSize
} catch {
    Write-Host "Failed to list connector plugins:" $_.Exception.Message -ForegroundColor Yellow
}

Write-Host "Current connectors (names):"
try {
    $connectors = Invoke-RestMethod -Uri "http://localhost:8083/connectors/" -Method Get
    $connectors | ForEach-Object { Write-Host $_ }
} catch {
    Write-Host "Failed to list connectors:" $_.Exception.Message -ForegroundColor Yellow
}
