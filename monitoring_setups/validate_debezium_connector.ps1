# Validate Debezium SQL Server connector config using the plugin validate endpoint
# Run from this folder:
# .\validate_debezium_connector.ps1

$connectorClass = 'io.debezium.connector.sqlserver.SqlServerConnector'
$config = @{
    "connector.class" = $connectorClass
    "tasks.max" = "1"
    "database.hostname" = "host.docker.internal"
    "database.port" = "1433"
    "database.user" = "debezium_user"
    "database.password" = "0987654321"
    "database.names" = "mes_new"
    "database.server.name" = "mes_server"
    "table.include.list" = "dbo.WorkOrder"
    "schema.history.internal.kafka.bootstrap.servers" = "kafka:29092"
    "schema.history.internal.kafka.topic" = "schema-changes.mes_new"
    "database.encrypt" = "false"
    "database.trustServerCertificate" = "true"
}

# Try two possible request shapes to the validate endpoint
$body1 = @{ "name" = "mes-workorder-connector"; "config" = $config } | ConvertTo-Json -Depth 5
$body2 = @{ "connector.class" = $connectorClass; "config" = $config } | ConvertTo-Json -Depth 5

$validateUrl = "http://localhost:8083/connector-plugins/$connectorClass/config/validate"
Write-Host "Validating config at: $validateUrl`n"

foreach ($body in @($body1, $body2)) {
    Write-Host "Request body:`n" $body
    try {
        $resp = Invoke-RestMethod -Uri $validateUrl -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
        Write-Host "Validation response:`n" ($resp | ConvertTo-Json -Depth 5)
    } catch {
        Write-Host "Validation request failed:`n" $_.Exception.Message -ForegroundColor Yellow
        if ($_.Exception.Response) {
            $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $bodyResp = $sr.ReadToEnd()
            Write-Host "Response body:`n" $bodyResp
        }
    }
    Write-Host "---"
}

Write-Host "Also try general /connectors/validate endpoint (if supported)"
$body3 = @{ "connector.class" = $connectorClass; "config" = $config } | ConvertTo-Json -Depth 5
$validateUrl2 = "http://localhost:8083/connectors/config/validate"
try {
    $resp2 = Invoke-RestMethod -Uri $validateUrl2 -Method Post -ContentType "application/json" -Body $body3 -ErrorAction Stop
    Write-Host "Validation (connectors/config/validate) response:`n" ($resp2 | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "Request failed:`n" $_.Exception.Message -ForegroundColor Yellow
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response body:`n" ($sr.ReadToEnd())
    }
}
