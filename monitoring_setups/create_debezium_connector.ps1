# Creates a Debezium SQL Server connector using the corrected bootstrap server and trust settings
# Run in PowerShell from this folder:
# .\create_debezium_connector.ps1

$jsonPayload = @"
{
  "name": "mes-workorder-connector",
  "config": {
    "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector",
    "tasks.max": "1",
    "database.hostname": "192.168.10.19",
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

Write-Host "Posting connector payload to http://localhost:8083/connectors/ ..."
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8083/connectors/" -Method Post -ContentType "application/json" -Body $jsonPayload -ErrorAction Stop
    Write-Host "Connector created successfully:`n" ($resp | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "Failed to create connector:" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode.Value__ -NoNewline; Write-Host " " $_.Exception.Message
    if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response body:`n" ($sr.ReadToEnd())
    }
}
