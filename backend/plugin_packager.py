"""Build a target-specific IIIOT-Veda monitoring plugin bundle from the CLI."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import shlex
import subprocess
import tarfile
import tempfile
import zipfile
from pathlib import Path


TARGETS = {"windows", "linux-deb", "linux-rpm", "macos"}
ARCHITECTURES = {"x86_64", "arm64"}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


PLUGINS = {"cpu", "memory", "disk", "network", "mqtt", "modbus", "opcua", "network-diagnostics", "email-monitoring", "server-monitoring", "desktop-monitoring", "docker", "kubernetes", "mongodb", "mysql", "redis", "sql", "sqlserver", "influxdb", "exec", "http", "http-listener", "nvidia", "s7", "syslog", "cisco-telemetry", "system", "opentelemetry", "nginx", "csv", "grok"}


def _host_base_config() -> str:
    return '''[agent]
  interval = "5s"
  flush_interval = "5s"
  omit_hostname = false

[[inputs.cpu]]
  name_override = "telegraf_cpu"
  percpu = true
  totalcpu = true
  collect_cpu_time = false
  report_active = true

[[inputs.mem]]
  name_override = "telegraf_mem"
'''


def _output_config() -> str:
    return '''[[outputs.influxdb_v3]]
  urls = ["${INFLUXDB3_URL}"]
  token = "${INFLUXDB3_AUTH_TOKEN}"
  database = "${INFLUXDB3_DATABASE}"
'''


def _connector_config(plugin: str) -> str:
    if plugin == "monitoring":
        children = ("disk", "network", "mqtt", "modbus", "opcua", "network-diagnostics", "email-monitoring", "server-monitoring", "desktop-monitoring", "docker", "kubernetes", "mongodb", "mysql", "redis", "sql", "sqlserver", "influxdb", "exec", "http", "http-listener", "nvidia", "s7", "syslog", "cisco-telemetry", "system", "opentelemetry", "nginx", "csv", "grok")
        return "\n".join(_connector_config(child).rstrip() for child in children) + "\n"
    configs = {
        "cpu": "",
        "memory": "",
        "disk": '''[[inputs.disk]]
  name_override = "telegraf_disk"
  ignore_fs = ["tmpfs", "devtmpfs", "devfs", "iso9660", "overlay", "aufs", "squashfs"]

[[inputs.diskio]]
  name_override = "telegraf_diskio"
''',
        "network": '''[[inputs.net]]
  name_override = "telegraf_net"
''',
        "mqtt": '''# Edit this file before installation. Edit the installed copy later and restart the IIIOT-Veda service.
[[inputs.mqtt_consumer]]
  name_override = "telegraf_mqtt"
  servers = ["tcp://127.0.0.1:1883"]
  topics = ["factory/#"]
  username = ""
  password = ""
  topic_tag = "topic"
  data_format = "json"
''',
        "modbus": '''# Edit this file using the device register map before installation.
# Register addresses are zero-based. A documented 40001 register is commonly address 0.
[[inputs.modbus]]
  name_override = "telegraf_modbus"
  name = "energy_meter"
  controller = "tcp://127.0.0.1:502"
  slave_id = 1
  timeout = "2s"
  configuration_type = "register"

  holding_registers = [
    { name = "value", byte_order = "AB", data_type = "UINT16", scale = 1.0, address = [0] },
  ]

  # Add entries as required by the device. Remove the leading # to enable a group.
  # input_registers = [
  #   { name = "temperature", byte_order = "AB", data_type = "INT16", scale = 0.1, address = [0] },
  # ]
  # coils = [
  #   { name = "motor_running", address = [0] },
  # ]
  # discrete_inputs = [
  #   { name = "fault_active", address = [0] },
  # ]
''',
        "opcua": '''# Edit this file before installation. Add one nodes entry per value.
[[inputs.opcua]]
  name = "telegraf_opcua"
  endpoint = "opc.tcp://127.0.0.1:4840"
  security_policy = "None"
  security_mode = "None"
  auth_method = "Anonymous"
  username = ""
  password = ""
  nodes = [
    { name = "value", id = "ns=2;s=Device.Value" },
  ]
''',
        "network-diagnostics": '''# IIIOT-Veda network checks. Replace the example targets before installation.
[[inputs.ping]]
  name_override = "iiiot_veda_ping"
  urls = ["8.8.8.8", "192.168.1.1"]
  count = 3
  method = "native"

[[inputs.http_response]]
  name_override = "iiiot_veda_http_response"
  urls = ["https://example.com"]
  response_timeout = "5s"

[[inputs.dns_query]]
  name_override = "iiiot_veda_dns_query"
  servers = ["8.8.8.8"]
  domains = ["example.com"]

[[inputs.net_response]]
  name_override = "iiiot_veda_net_response"
  protocol = "tcp"
  address = "example.com:443"
  timeout = "5s"

[[inputs.x509_cert]]
  name_override = "iiiot_veda_x509_cert"
  sources = ["https://example.com:443"]

[[inputs.netstat]]
  name_override = "iiiot_veda_netstat"
''',
        "email-monitoring": '''# IIIOT-Veda email endpoint checks. Replace the example mail host.
[[inputs.net_response]]
  name_override = "iiiot_veda_email_response"
  protocol = "tcp"
  address = "mail.example.com:587"
  timeout = "5s"
  read_timeout = "5s"
  expect = "220"

[[inputs.x509_cert]]
  name_override = "iiiot_veda_email_cert"
  sources = ["smtp://mail.example.com:587"]

# Optional on a Postfix server:
# [[inputs.postfix]]
#   name_override = "iiiot_veda_postfix"
''',
        "server-monitoring": '''# IIIOT-Veda server health checks.
[[inputs.system]]
  name_override = "iiiot_veda_system"
[[inputs.swap]]
  name_override = "iiiot_veda_swap"
[[inputs.processes]]
  name_override = "iiiot_veda_processes"

# Optional: enable on hosts that provide pgrep or configure a platform-specific finder.
# [[inputs.procstat]]
#   name_override = "iiiot_veda_procstat"
#   pattern = "nginx|postgres|mysql"

# Optional; enable only when the host provides the required sensors/tools.
# [[inputs.sensors]]
#   name_override = "iiiot_veda_sensors"
# [[inputs.smart]]
#   name_override = "iiiot_veda_smart"
''',
        "desktop-monitoring": '''# IIIOT-Veda desktop health checks. CPU and memory are supplied by the shared host baseline.
[[inputs.system]]
  name_override = "iiiot_veda_desktop_system"
[[inputs.processes]]
  name_override = "iiiot_veda_desktop_processes"

# Windows-specific inputs can be added here when required:
# [[inputs.win_services]]
#   name_override = "iiiot_veda_win_services"
# [[inputs.win_eventlog]]
#   name_override = "iiiot_veda_win_eventlog"
''',
        "docker": '''# Requires access to the Docker daemon socket.
[[inputs.docker]]
  name_override = "iiiot_veda_docker"
  endpoint = "unix:///var/run/docker.sock"
  gather_services = false
  container_name_include = []
  container_name_exclude = []
''',
        "kubernetes": '''# Configure a reachable Kubernetes API and service-account token.
[[inputs.kubernetes]]
  name_override = "iiiot_veda_kubernetes"
  url = "https://127.0.0.1:10250"
  bearer_token = "/var/run/secrets/kubernetes.io/serviceaccount/token"
  insecure_skip_verify = true
''',
        "mongodb": '''[[inputs.mongodb]]
  name_override = "iiiot_veda_mongodb"
  servers = ["mongodb://monitor:password@127.0.0.1:27017"]
  gather_perdb_stats = true
  disconnected_servers_behavior = "skip"
''',
        "mysql": '''[[inputs.mysql]]
  name_override = "iiiot_veda_mysql"
  servers = ["monitor:password@tcp(127.0.0.1:3306)/?tls=false"]
  gather_process_list = true
  gather_innodb_metrics = true
''',
        "redis": '''[[inputs.redis]]
  name_override = "iiiot_veda_redis"
  servers = ["tcp://:password@127.0.0.1:6379"]
''',
        "sql": '''# Generic SQL query input. Supported drivers depend on the bundled runtime.
[[inputs.sql]]
  name_override = "iiiot_veda_sql"
  driver = "pgx"
  dsn = "host=127.0.0.1 port=5432 user=monitor password=password dbname=database sslmode=disable"

  [[inputs.sql.query]]
    query = "SELECT 1 AS value"
    measurement = "iiiot_veda_sql"
''',
        "sqlserver": '''[[inputs.sqlserver]]
  name_override = "iiiot_veda_sqlserver"
  servers = ["Server=127.0.0.1;Port=1433;User Id=monitor;Password=password;app name=IIIOT-Veda;log=1;"]
  database_type = "SQLServer"
  include_query = ["SQLServerPerformanceCounters", "SQLServerWaitStatsCategorized", "SQLServerDatabaseIO", "SQLServerProperties"]
''',
        "influxdb": '''# InfluxDB 2.x OSS monitoring for the configured instance.
# The /metrics endpoint exposes HTTP, query, write, storage, task, Go runtime,
# memory, garbage-collection and other internal service metrics.
[[inputs.prometheus]]
  name_override = "iiiot_veda_influxdb"
  urls = ["http://192.168.10.130:8086/metrics"]
  metric_version = 2
  interval = "30s"
  timeout = "10s"
  enable_request_metrics = true

  # InfluxDB 2.x normally uses a token when /metrics is protected.
  # bearer_token_string = "replace-with-read-token"

  # Basic authentication is available for compatible proxies or endpoints.
  # username = "replace-with-username"
  # password = "replace-with-password"

  [inputs.prometheus.tags]
    monitored_service = "influxdb"
    monitored_instance = "192.168.10.130:8086"

# InfluxDB 1.x alternative: comment the inputs.prometheus block above and
# uncomment this block to collect /debug/vars. InfluxDB 2.x should use /metrics.
# [[inputs.influxdb]]
#   name_prefix = "iiiot_veda_"
#   urls = ["http://192.168.10.130:8086/debug/vars"]
#   username = "replace-with-username"
#   password = "replace-with-password"
#   timeout = "10s"
''',
        "exec": '''# The command must print a supported metric format to stdout.
[[inputs.exec]]
  name_override = "iiiot_veda_exec"
  commands = ["/usr/local/bin/iiiot-veda-metrics"]
  timeout = "5s"
  data_format = "json"
''',
        "http": '''# Poll an HTTP endpoint that returns metric JSON.
[[inputs.http]]
  name_override = "iiiot_veda_http"
  urls = ["https://example.com/metrics"]
  method = "GET"
  timeout = "5s"
  data_format = "json"
''',
        "http-listener": '''# Receive metric JSON over HTTP POST.
[[inputs.http_listener_v2]]
  name_override = "iiiot_veda_http_listener"
  service_address = "tcp://:8080"
  paths = ["/iiiot-veda"]
  data_format = "json"
''',
        "nvidia": '''# Requires nvidia-smi from the NVIDIA driver installation.
[[inputs.nvidia_smi]]
  name_override = "iiiot_veda_nvidia"
  bin_path = "/usr/bin/nvidia-smi"
  timeout = "5s"
''',
        "s7": '''# Siemens S7 PLC example. Replace the address and field definitions.
[[inputs.s7comm]]
  name_override = "iiiot_veda_s7"
  server = "127.0.0.1:102"
  rack = 0
  slot = 1

  [[inputs.s7comm.metric]]
    name = "plc_values"
    fields = [
      { name = "temperature", address = "DB1.R0" },
      { name = "running", address = "DB1.X4.0" },
    ]
''',
        "syslog": '''# Receive RFC3164/RFC5424 messages.
[[inputs.syslog]]
  name_override = "iiiot_veda_syslog"
  server = "tcp://:6514"
  framing = "octet-counting"
  best_effort = true
''',
        "cisco-telemetry": '''# Cisco model-driven telemetry listener.
[[inputs.cisco_telemetry_mdt]]
  name_override = "iiiot_veda_cisco_telemetry"
  transport = "grpc"
  service_address = "0.0.0.0:57000"

  [inputs.cisco_telemetry_mdt.aliases]
    ifstats = "ietf-interfaces:interfaces-state/interface/statistics"
''',
        "system": '''[[inputs.system]]
  name_override = "iiiot_veda_system_extended"
''',
        "opentelemetry": '''# Receive OpenTelemetry metrics, logs, traces, and profiles over gRPC.
[[inputs.opentelemetry]]
  name_override = "iiiot_veda_opentelemetry"
  service_address = "0.0.0.0:4317"
  timeout = "5s"
  max_msg_size = "4MB"
''',
        "nginx": '''# NGINX stub_status endpoint.
[[inputs.nginx]]
  name_override = "iiiot_veda_nginx"
  urls = ["http://127.0.0.1/nginx_status"]
  response_timeout = "5s"
''',
        "csv": '''# CSV is an input data format; this example reads configured CSV files.
[[inputs.file]]
  name_override = "iiiot_veda_csv"
  files = ["/var/lib/iiiot-veda/input/*.csv"]
  data_format = "csv"
  csv_header_row_count = 1
  csv_measurement_column = "measurement"
''',
        "grok": '''# Grok is an input data format; edit patterns to match the source log.
[[inputs.tail]]
  name_override = "iiiot_veda_grok"
  files = ["/var/log/iiiot-veda/*.log"]
  initial_read_offset = "saved-or-end"
  data_format = "grok"
  grok_patterns = ['%{TIMESTAMP_ISO8601:timestamp:ts-"2006-01-02 15:04:05"} %{LOGLEVEL:level:tag} %{GREEDYDATA:message}']
''',
    }
    if plugin not in configs:
        raise ValueError(f"Unsupported plugin: {plugin}")
    return configs[plugin]


def _telegraf_config(plugin: str = "cpu") -> str:
    """Combined representation used by validation and tests."""
    return _host_base_config() + "\n" + _connector_config(plugin) + "\n" + _output_config()


def _connector_variables(plugin: str) -> tuple[list[str], list[str]]:
    # Connector values now live in the editable mai-connector.conf file.
    return [], []


def _linux_installer(package_name: str, plugin: str) -> str:
    required, optional = _connector_variables(plugin)
    required_vars = " ".join(required)
    render_vars = " ".join(required + optional)
    docker_permissions = '''
docker_socket="/var/run/docker.sock"
if [[ -S "${docker_socket}" ]] && id telegraf >/dev/null 2>&1; then
  docker_group="$(stat -c '%G' "${docker_socket}")"
  if getent group "${docker_group}" >/dev/null 2>&1; then
    sudo usermod -aG "${docker_group}" telegraf
  elif command -v setfacl >/dev/null 2>&1; then
    sudo setfacl -m u:telegraf:rw "${docker_socket}"
  else
    echo "IIIOT-Veda cannot grant the service account access to ${docker_socket}." >&2
    exit 1
  fi
fi
''' if plugin == "docker" else ""
    return f'''#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
package_path="${{script_dir}}/{package_name}"

if [[ -f "${{script_dir}}/mai-settings.env" ]]; then
  set -a
  source "${{script_dir}}/mai-settings.env"
  set +a
fi
existing_output="/etc/telegraf/telegraf.d/mai-output.conf"
if [[ ( -z "${{INFLUXDB3_URL:-}}" || -z "${{INFLUXDB3_AUTH_TOKEN:-}}" || -z "${{INFLUXDB3_DATABASE:-}}" ) && ! -s "${{existing_output}}" ]]; then
  echo "Set INFLUXDB3_URL, INFLUXDB3_AUTH_TOKEN and INFLUXDB3_DATABASE in mai-settings.env." >&2
  exit 1
fi
for variable_name in {required_vars}; do
  [[ -n "${{!variable_name:-}}" ]] || {{ echo "Set ${{variable_name}} before running this installer." >&2; exit 1; }}
done

case "${{package_path}}" in
  *.deb) sudo dpkg -i "${{package_path}}" ;;
  *.rpm) sudo rpm -Uvh --replacepkgs "${{package_path}}" ;;
  *.tar.gz|*.tgz)
    temp_dir="$(mktemp -d)"
    trap 'rm -rf "${{temp_dir}}"' EXIT
    tar -xzf "${{package_path}}" -C "${{temp_dir}}"
    binary="$(find "${{temp_dir}}" -type f -name telegraf -perm /111 | head -n 1)"
    sudo install -m 0755 "${{binary}}" /usr/local/bin/telegraf
    ;;
  *) echo "Unsupported IIIOT-Veda runtime package: ${{package_path}}" >&2; exit 1 ;;
esac

sudo install -d -m 0755 /etc/telegraf/telegraf.d
sudo rm -f /etc/telegraf/telegraf.d/mai-cpu.conf
if true; then
  rendered_output="$(mktemp)"
  escaped_dsn="$(printf '%s' "${{POSTGRES_DSN}}" | sed 's/[\\/&]/\\\\&/g')"
  sed "s/\\${{POSTGRES_DSN}}/${{escaped_dsn}}/g" "${{script_dir}}/mai-output.conf" > "${{rendered_output}}"
  sudo install -m 0640 "${{rendered_output}}" "${{existing_output}}"
  rm -f "${{rendered_output}}"
else
  echo "Reusing the existing MAI InfluxDB output configuration."
fi
sudo install -m 0640 "${{script_dir}}/mai-host-base.conf" /etc/telegraf/telegraf.d/mai-host-base.conf
if [[ -s "${{script_dir}}/mai-connector.conf" ]]; then
  sudo install -m 0640 "${{script_dir}}/mai-connector.conf" "/etc/telegraf/telegraf.d/mai-{plugin}.conf"
fi
sudo chown root:telegraf /etc/telegraf/telegraf.d/mai-*.conf
{docker_permissions}
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable --now telegraf
  sudo systemctl restart telegraf
fi
echo "MAI IIIOT-Veda {plugin} plugin installed."
'''


def _macos_installer(package_name: str, plugin: str) -> str:
    required, optional = _connector_variables(plugin)
    required_vars = " ".join(required)
    render_vars = " ".join(required + optional)
    return f'''#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
package_path="${{script_dir}}/{package_name}"
if [[ -f "${{script_dir}}/mai-settings.env" ]]; then
  set -a
  source "${{script_dir}}/mai-settings.env"
  set +a
fi
if [[ -z "${{INFLUXDB3_AUTH_TOKEN:-}}" ]]; then
  echo "Set INFLUXDB3_AUTH_TOKEN before running this installer." >&2
  exit 1
fi
for variable_name in {required_vars}; do
  [[ -n "${{!variable_name:-}}" ]] || {{ echo "Set ${{variable_name}} before running this installer." >&2; exit 1; }}
done

case "${{package_path}}" in
  *.pkg) sudo installer -pkg "${{package_path}}" -target / ;;
  *.tar.gz|*.tgz)
    temp_dir="$(mktemp -d)"
    trap 'rm -rf "${{temp_dir}}"' EXIT
    tar -xzf "${{package_path}}" -C "${{temp_dir}}"
    binary="$(find "${{temp_dir}}" -type f -name telegraf -perm +111 | head -n 1)"
    sudo install -m 0755 "${{binary}}" /usr/local/bin/telegraf
    ;;
  *.zip)
    temp_dir="$(mktemp -d)"
    trap 'rm -rf "${{temp_dir}}"' EXIT
    ditto -x -k "${{package_path}}" "${{temp_dir}}"
    binary="$(find "${{temp_dir}}" -type f -name telegraf -perm +111 | head -n 1)"
    sudo install -m 0755 "${{binary}}" /usr/local/bin/telegraf
    ;;
  *.dmg)
    mount_dir="$(mktemp -d)"
    hdiutil attach "${{package_path}}" -nobrowse -mountpoint "${{mount_dir}}"
    trap 'hdiutil detach "${{mount_dir}}" >/dev/null 2>&1 || true; rm -rf "${{mount_dir}}"' EXIT
    pkg="$(find "${{mount_dir}}" -type f -name '*.pkg' | head -n 1)"
    if [[ -n "${{pkg}}" ]]; then
      sudo installer -pkg "${{pkg}}" -target /
    else
      binary="$(find "${{mount_dir}}" -type f -name telegraf -perm +111 | head -n 1)"
      [[ -n "${{binary}}" ]] || {{ echo "No IIIOT-Veda runtime installer was found in the DMG." >&2; exit 1; }}
      sudo install -m 0755 "${{binary}}" /usr/local/bin/telegraf
    fi
    hdiutil detach "${{mount_dir}}"
    rm -rf "${{mount_dir}}"
    trap - EXIT
    ;;
  *) echo "Unsupported IIIOT-Veda runtime package: ${{package_path}}" >&2; exit 1 ;;
esac

sudo install -d -m 0755 /usr/local/etc/telegraf.d
sudo rm -f /usr/local/etc/telegraf.d/mai-cpu.conf
POSTGRES_DSN="unused"
rendered_output="$(mktemp)"
escaped_dsn="$(printf '%s' "${{POSTGRES_DSN}}" | sed 's/[\\/&]/\\\\&/g')"
sed "s/\\${{POSTGRES_DSN}}/${{escaped_dsn}}/g" "${{script_dir}}/mai-output.conf" > "${{rendered_output}}"
sudo install -m 0640 "${{rendered_output}}" /usr/local/etc/telegraf.d/mai-output.conf
sudo install -m 0640 "${{script_dir}}/mai-host-base.conf" /usr/local/etc/telegraf.d/mai-host-base.conf
rm -f "${{rendered_output}}"
if [[ -s "${{script_dir}}/mai-connector.conf" ]]; then
  rendered_connector="$(mktemp)"
  cp "${{script_dir}}/mai-connector.conf" "${{rendered_connector}}"
  for variable_name in {render_vars}; do
    variable_value="${{!variable_name:-}}"
    [[ "$variable_value" != *$'\n'* && "$variable_value" != *'"'* ]] || {{ echo "$variable_name contains unsupported characters." >&2; exit 1; }}
    escaped_value="$(printf '%s' "$variable_value" | sed 's/[\\/&]/\\\\&/g')"
    sed -i.bak "s/\\${{${{variable_name}}}}/${{escaped_value}}/g" "${{rendered_connector}}"
  done
  sudo install -m 0640 "${{rendered_connector}}" "/usr/local/etc/telegraf.d/mai-{plugin}.conf"
  rm -f "${{rendered_connector}}" "${{rendered_connector}}.bak"
fi
echo "MAI IIIOT-Veda {plugin} plugin files installed. Start or restart the IIIOT-Veda service, then verify in MAI."
'''


def _windows_installer(package_name: str, plugin: str) -> str:
    required, optional = _connector_variables(plugin)
    required_ps = ", ".join(f'"{name}"' for name in required)
    render_ps = ", ".join(f'"{name}"' for name in required + optional)
    return f'''$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {{
  Start-Process powershell.exe -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"") -Verb RunAs -Wait
  exit
}}
$BundleDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Package = Join-Path $BundleDir "{package_name}"
$ConfigDir = Join-Path $env:ProgramFiles "IIIOT-Veda\\config"
$ConnectorTemplatePath = Join-Path $BundleDir "mai-connector.conf"
Add-Type -AssemblyName PresentationFramework
$Start = [System.Windows.MessageBox]::Show("Configure and install the IIIOT-Veda {plugin} plugin?", "IIIOT-Veda Setup", "OKCancel", "Information")
if ($Start -ne "OK") {{ exit }}
if ((Test-Path $ConnectorTemplatePath) -and (Get-Item $ConnectorTemplatePath).Length -gt 0) {{
  $Edit = [System.Windows.MessageBox]::Show("Open configuration to review source addresses and paths?", "IIIOT-Veda Configuration", "YesNo", "Question")
  if ($Edit -eq "Yes") {{ Start-Process notepad.exe -ArgumentList $ConnectorTemplatePath -Wait }}
}}
$Permission = [System.Windows.MessageBox]::Show("Allow administrator changes for files and the monitoring service?", "IIIOT-Veda Permissions", "YesNo", "Warning")
if ($Permission -ne "Yes") {{ exit }}
$ExistingOutput = Join-Path $ConfigDir "mai-output.conf"
foreach ($VariableName in @({required_ps})) {{
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($VariableName))) {{ throw "Set $VariableName before running this installer." }}
}}

# Release the running agent before updating the shared IIIOT-Veda installation.
$ExistingService = Get-Service -Name "telegraf" -ErrorAction SilentlyContinue
if ($ExistingService -and $ExistingService.Status -ne 'Stopped') {{
  Stop-Service -Name "telegraf" -Force
  (Get-Service -Name "telegraf").WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
}}

if ($Package.EndsWith(".msi")) {{
  Start-Process msiexec.exe -ArgumentList @("/i", $Package, "/qn") -Wait -Verb RunAs
}} elseif ($Package.EndsWith(".exe")) {{
  Start-Process $Package -Wait -Verb RunAs
}} elseif ($Package.EndsWith(".zip")) {{
  $Target = Join-Path $env:ProgramFiles "IIIOT-Veda"
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Expand-Archive -Path $Package -DestinationPath $Target -Force
}} else {{
  throw "Unsupported IIIOT-Veda runtime package: $Package"
}}

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
Remove-Item (Join-Path $ConfigDir "mai-cpu.conf") -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $BundleDir "mai-output.conf") $ExistingOutput -Force
Copy-Item (Join-Path $BundleDir "mai-host-base.conf") (Join-Path $ConfigDir "mai-host-base.conf") -Force
$ConnectorPath = Join-Path $BundleDir "mai-connector.conf"
if ((Test-Path $ConnectorPath) -and (Get-Item $ConnectorPath).Length -gt 0) {{
  $ConnectorTemplate = Get-Content $ConnectorPath -Raw
  foreach ($VariableName in @({render_ps})) {{
    $VariableValue = [Environment]::GetEnvironmentVariable($VariableName)
    if ($null -eq $VariableValue) {{ $VariableValue = "" }}
    if ($VariableValue.Contains('"') -or $VariableValue.Contains("`n")) {{ throw "$VariableName contains unsupported characters." }}
    $ConnectorTemplate = $ConnectorTemplate.Replace('${{' + $VariableName + '}}', $VariableValue)
  }}
  $ConnectorTemplate | Set-Content (Join-Path $ConfigDir "mai-{plugin}.conf") -Encoding UTF8
}}
$AgentExe = Get-ChildItem (Join-Path $env:ProgramFiles "IIIOT-Veda") -Filter "telegraf.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $AgentExe) {{ throw "The IIIOT-Veda runtime was not found after installation." }}
if ($AgentExe) {{
  $Service = Get-Service -Name "telegraf" -ErrorAction SilentlyContinue
  if ($Service) {{
    Stop-Service -Name "telegraf" -Force
    & $AgentExe.FullName --service uninstall
    if ($LASTEXITCODE -ne 0) {{ throw "Could not update the existing IIIOT-Veda service." }}
  }}
  & $AgentExe.FullName --service install --config-directory $ConfigDir
  if ($LASTEXITCODE -ne 0) {{ throw "Could not install the IIIOT-Veda service." }}
  Start-Service -Name "telegraf"
  (Get-Service -Name "telegraf").WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
}}
Write-Host "IIIOT-Veda monitoring plugin installed. Start or restart the IIIOT-Veda service, then verify in MAI."
[System.Windows.MessageBox]::Show("IIIOT-Veda {plugin} installation completed.", "IIIOT-Veda Setup", "OK", "Information") | Out-Null
'''


def _build_windows_executable(staging: Path, bundle_path: Path, architecture: str) -> None:
    architecture_name = "arm64" if architecture == "arm64" else "amd64"
    stub = Path(__file__).resolve().parent / "installer_assets" / f"windows-bootstrapper-{architecture_name}.exe"
    if not stub.is_file():
        raise RuntimeError(f"Windows {architecture_name} installer bootstrapper is missing")
    shutil.copy2(stub, bundle_path)
    with zipfile.ZipFile(bundle_path, "a", zipfile.ZIP_DEFLATED) as archive:
        for path in staging.rglob("*"):
            if path.is_file():
                archive.write(path, Path("payload") / path.relative_to(staging))


def _linux_gui_launcher(plugin: str) -> str:
    permissions_message = (
        "Allow administrator changes for the runtime, configuration files and service? "
        "Docker monitoring also grants the IIIOT-Veda service account access to the Docker socket, "
        "which permits control of the local Docker daemon."
        if plugin == "docker"
        else "Allow administrator changes for the runtime, configuration files and service?"
    )
    return f'''#!/usr/bin/env bash
set -euo pipefail
command -v zenity >/dev/null 2>&1 || {{ echo "IIIOT-Veda Setup requires zenity." >&2; exit 1; }}
source_dir="/opt/iiiot-veda/{plugin}"
work_dir="$(mktemp -d)"
trap 'rm -rf "${{work_dir}}"' EXIT
cp -a "${{source_dir}}/." "${{work_dir}}/"
zenity --info --title="IIIOT-Veda Setup" --text="Configure and install the {plugin} plugin."
if [[ -s "${{work_dir}}/mai-connector.conf" ]]; then
  zenity --text-info --editable --title="Plugin configuration" --filename="${{work_dir}}/mai-connector.conf" --width=900 --height=650 > "${{work_dir}}/mai-connector.edited"
  mv "${{work_dir}}/mai-connector.edited" "${{work_dir}}/mai-connector.conf"
fi
zenity --question --title="Permissions" --text="{permissions_message}"
pkexec env DISPLAY="${{DISPLAY:-}}" XAUTHORITY="${{XAUTHORITY:-}}" bash "${{work_dir}}/install.sh"
zenity --info --title="IIIOT-Veda Setup" --text="Installation completed. Return to MAI and verify the plugin."
'''


def _stage_linux_package(staging: Path, root: Path, plugin: str) -> None:
    payload = root / "opt" / "iiiot-veda" / plugin
    payload.mkdir(parents=True)
    for item in staging.iterdir():
        if item.is_file():
            shutil.copy2(item, payload / item.name)
    launcher = root / "usr" / "bin" / f"iiiot-veda-setup-{plugin}"
    launcher.parent.mkdir(parents=True)
    launcher.write_text(_linux_gui_launcher(plugin), encoding="utf-8")
    launcher.chmod(0o755)
    desktop = root / "usr" / "share" / "applications" / f"iiiot-veda-{plugin}.desktop"
    desktop.parent.mkdir(parents=True)
    desktop.write_text(f'''[Desktop Entry]\nType=Application\nName=IIIOT-Veda {plugin.replace('-', ' ').title()} Setup\nExec={launcher}\nTerminal=false\nCategories=System;Settings;\n''', encoding="utf-8")


def _build_deb(staging: Path, bundle_path: Path, plugin: str, architecture: str) -> None:
    with tempfile.TemporaryDirectory(prefix="iiiot-veda-deb-") as temporary:
        root = Path(temporary) / "root"
        _stage_linux_package(staging, root, plugin)
        control_dir = Path(temporary) / "control"
        control_dir.mkdir()
        deb_arch = "arm64" if architecture == "arm64" else "amd64"
        (control_dir / "control").write_text(f'''Package: iiiot-veda-{plugin}\nVersion: 1.0.0\nArchitecture: {deb_arch}\nMaintainer: IIIOT-Veda\nDepends: zenity, policykit-1, bash\nDescription: IIIOT-Veda graphical setup for {plugin}\n''', encoding="utf-8")
        postinst = control_dir / "postinst"
        postinst.write_text(f'''#!/bin/sh
user="${{SUDO_USER:-$(logname 2>/dev/null || true)}}"
if [ -n "$user" ] && command -v runuser >/dev/null 2>&1; then
  runuser -u "$user" -- env DISPLAY="${{DISPLAY:-:0}}" /usr/bin/iiiot-veda-setup-{plugin} >/tmp/iiiot-veda-{plugin}-setup.log 2>&1 &
fi
exit 0
''', encoding="utf-8")
        postinst.chmod(0o755)
        for name, source in (("control.tar.gz", control_dir), ("data.tar.gz", root)):
            with tarfile.open(Path(temporary) / name, "w:gz") as archive:
                for path in source.rglob("*"):
                    archive.add(path, arcname=Path(".") / path.relative_to(source))
        (Path(temporary) / "debian-binary").write_text("2.0\n", encoding="ascii")
        subprocess.run(["ar", "r", str(bundle_path), "debian-binary", "control.tar.gz", "data.tar.gz"], cwd=temporary, check=True, capture_output=True)


def _build_rpm(staging: Path, bundle_path: Path, plugin: str, architecture: str) -> None:
    if not shutil.which("rpmbuild"):
        raise RuntimeError("rpmbuild is required to generate the RPM installer")
    with tempfile.TemporaryDirectory(prefix="iiiot-veda-rpm-") as temporary:
        top = Path(temporary)
        for directory in ("BUILD", "BUILDROOT", "RPMS", "SOURCES", "SPECS", "SRPMS", "TMP"):
            (top / directory).mkdir()
        root = top / "SOURCES" / "payload"
        _stage_linux_package(staging, root, plugin)
        package_name = f"iiiot-veda-{plugin}"
        rpm_arch = "noarch"
        spec = top / "SPECS" / f"{package_name}.spec"
        spec.write_text(f'''Name: {package_name}\nVersion: 1.0.0\nRelease: 1\nSummary: IIIOT-Veda graphical setup for {plugin}\nLicense: Proprietary\nBuildArch: {rpm_arch}\nRequires: zenity, polkit, bash\n%description\nIIIOT-Veda graphical setup for {plugin}.\n%install\nmkdir -p %{{buildroot}}\ncp -a %{{_sourcedir}}/payload/. %{{buildroot}}/\n%post\nuser="${{SUDO_USER:-$(logname 2>/dev/null || true)}}"\nif [ -n "$user" ] && command -v runuser >/dev/null 2>&1; then\n  runuser -u "$user" -- env DISPLAY="${{DISPLAY:-:0}}" /usr/bin/iiiot-veda-setup-{plugin} >/tmp/iiiot-veda-{plugin}-setup.log 2>&1 &\nfi\n%files\n/opt/iiiot-veda/{plugin}\n/usr/bin/iiiot-veda-setup-{plugin}\n/usr/share/applications/iiiot-veda-{plugin}.desktop\n''', encoding="utf-8")
        subprocess.run(["rpmbuild", "--define", f"_topdir {top}", "--define", f"_tmppath {top / 'TMP'}", "-bb", str(spec)], check=True, capture_output=True, text=True)
        built = next((top / "RPMS").rglob("*.rpm"))
        shutil.copy2(built, bundle_path)


def _macos_gui_launcher(plugin: str) -> str:
    return f'''#!/usr/bin/env bash
set -euo pipefail
bundle_dir="$(cd "$(dirname "$0")" && pwd)"
osascript -e 'display dialog "Configure and install the IIIOT-Veda {plugin} plugin?" buttons {{"Cancel", "Continue"}} default button "Continue"'
if [[ -s "${{bundle_dir}}/mai-connector.conf" ]]; then open -W -a TextEdit "${{bundle_dir}}/mai-connector.conf"; fi
osascript -e 'display dialog "Administrator permission is required to install files and the service." buttons {{"Cancel", "Install"}} default button "Install" with icon caution'
osascript -e "do shell script \"bash \" & quoted form of \"${{bundle_dir}}/install.sh\" with administrator privileges"
osascript -e 'display dialog "Installation completed. Return to MAI and verify the plugin." buttons {{"Finish"}} default button "Finish"'
'''


def _build_macos_package(staging: Path, bundle_path: Path, plugin: str, use_dmg: bool) -> None:
    launcher = staging / "IIIOT-Veda Setup.command"
    launcher.write_text(_macos_gui_launcher(plugin), encoding="utf-8")
    launcher.chmod(0o755)
    if use_dmg:
        if not shutil.which("hdiutil"):
            raise RuntimeError("hdiutil on macOS is required to generate a DMG installer")
        subprocess.run(["hdiutil", "create", "-volname", f"IIIOT-Veda {plugin}", "-srcfolder", str(staging), "-ov", "-format", "UDZO", str(bundle_path)], check=True, capture_output=True)
    else:
        if not shutil.which("pkgbuild"):
            raise RuntimeError("pkgbuild on macOS is required to generate a PKG installer")
        root = staging.parent / "pkgroot" / "Applications" / f"IIIOT-Veda {plugin} Setup"
        root.mkdir(parents=True)
        for item in staging.iterdir():
            if item.is_file(): shutil.copy2(item, root / item.name)
        scripts = staging.parent / "pkgscripts"
        scripts.mkdir()
        postinstall = scripts / "postinstall"
        postinstall.write_text(f'''#!/usr/bin/env bash
console_user="$(stat -f '%Su' /dev/console)"
uid="$(id -u "$console_user")"
launchctl asuser "$uid" sudo -u "$console_user" open "/Applications/IIIOT-Veda {plugin} Setup/IIIOT-Veda Setup.command" || true
exit 0
''', encoding="utf-8")
        postinstall.chmod(0o755)
        subprocess.run(["pkgbuild", "--root", str(staging.parent / "pkgroot"), "--scripts", str(scripts), "--identifier", f"com.iiiotveda.{plugin}", "--version", "1.0.0", str(bundle_path)], check=True, capture_output=True)


def _installation_readme(target_os: str, plugin: str) -> str:
    required, optional = _connector_variables(plugin)
    connector_lines = "\n".join(
        [*(f"export {name}='REPLACE_ME'" for name in required), *(f"export {name}=''" for name in optional)]
    )
    if target_os == "windows":
        connector_lines = "\n".join(
            [*(f'$env:{name} = "REPLACE_ME"' for name in required), *(f'$env:{name} = ""' for name in optional)]
        )
        command = f'''$env:INFLUXDB3_URL = "http://localhost:8181"
$env:INFLUXDB3_AUTH_TOKEN = "REPLACE_WITH_TOKEN"
$env:INFLUXDB3_DATABASE = "iiiot_telemetry"
{connector_lines}
.\\install.ps1'''
    else:
        command = '''1. Review the InfluxDB 3 URL, token, and database in mai-settings.env.
   Later plugin installations reuse /etc/telegraf/telegraf.d/mai-output.conf.
2. Edit mai-connector.conf with the source settings and all required measurements.
3. Run: ./install.sh'''
    return f'''# IIIOT-Veda Monitoring

This bundle installs the IIIOT-Veda {plugin} connector and writes metrics to InfluxDB 3.
The target machine must be able to reach the configured InfluxDB URL.

```text
{command}
```

The installer keeps connector inputs in separate files and one shared InfluxDB output.
Installing another connector preserves connectors already installed.
Connector settings can be changed later in `/etc/telegraf/telegraf.d/mai-{plugin}.conf`;
validate the configuration and restart the IIIOT-Veda service after editing it.
CPU and memory remain enabled as the host baseline.
On macOS, start the IIIOT-Veda service with --config-directory /usr/local/etc/telegraf.d.
On Linux installations, a working IIIOT-Veda service must be able to reach InfluxDB and use a token
with write permission for the configured database.
After installation, return to MAI, confirm installation, and verify the plugin.
'''


def build_bundle(target_os: str, architecture: str, telegraf_installer: Path, output_dir: Path, plugin: str = "cpu", connector_config_file: Path | None = None, influx_url: str = "http://localhost:8181", influx_token: str = "", influx_database: str = "iiiot_telemetry") -> dict[str, object]:
    if plugin not in PLUGINS:
        raise ValueError(f"Unsupported plugin: {plugin}")
    if target_os not in TARGETS:
        raise ValueError(f"Unsupported target OS/package type: {target_os}")
    if architecture not in ARCHITECTURES:
        raise ValueError(f"Unsupported architecture: {architecture}")
    installer = telegraf_installer.resolve()
    if not installer.is_file():
        raise FileNotFoundError(f"IIIOT-Veda runtime installer not found: {installer}")

    output_dir.mkdir(parents=True, exist_ok=True)
    bundle_base = f"iiiot-veda-{plugin}-{target_os}-{architecture}"
    with tempfile.TemporaryDirectory(prefix="mai-plugin-") as temporary:
        staging = Path(temporary) / bundle_base
        staging.mkdir()
        installer_suffix = "".join(installer.suffixes)
        copied_installer = staging / f"iiiot-veda-runtime{installer_suffix}"
        shutil.copy2(installer, copied_installer)
        (staging / "mai-host-base.conf").write_text(_host_base_config(), encoding="utf-8")
        output_text = (_output_config()
            .replace("${INFLUXDB3_URL}", influx_url)
            .replace("${INFLUXDB3_AUTH_TOKEN}", influx_token)
            .replace("${INFLUXDB3_DATABASE}", influx_database))
        (staging / "mai-output.conf").write_text(output_text, encoding="utf-8")
        connector_text = connector_config_file.read_text(encoding="utf-8") if connector_config_file else _connector_config(plugin)
        (staging / "mai-connector.conf").write_text(connector_text, encoding="utf-8")
        (staging / "mai-settings.env").write_text(
            "# InfluxDB 3 destination used by this IIIOT-Veda bundle.\n"
            "# Keep this file private because it contains an authorization token.\n"
            f"INFLUXDB3_URL={shlex.quote(influx_url)}\n"
            f"INFLUXDB3_AUTH_TOKEN={shlex.quote(influx_token)}\n"
            f"INFLUXDB3_DATABASE={shlex.quote(influx_database)}\n",
            encoding="utf-8",
        )
        (staging / "INSTALL.md").write_text(_installation_readme(target_os, plugin), encoding="utf-8")
        tables = {
            "cpu": ["telegraf_cpu"], "memory": ["telegraf_mem"],
            "disk": ["telegraf_disk", "telegraf_diskio"], "network": ["telegraf_net"],
            "mqtt": ["telegraf_mqtt"], "modbus": ["telegraf_modbus"], "opcua": ["telegraf_opcua"],
            "network-diagnostics": ["iiiot_veda_ping", "iiiot_veda_http_response", "iiiot_veda_dns_query", "iiiot_veda_net_response", "iiiot_veda_x509_cert", "iiiot_veda_netstat"],
            "email-monitoring": ["iiiot_veda_email_response", "iiiot_veda_email_cert"],
            "server-monitoring": ["iiiot_veda_system", "iiiot_veda_swap", "iiiot_veda_processes", "iiiot_veda_procstat"],
            "desktop-monitoring": ["iiiot_veda_desktop_system", "iiiot_veda_desktop_processes"],
            "docker": ["iiiot_veda_docker"], "kubernetes": ["iiiot_veda_kubernetes"],
            "mongodb": ["iiiot_veda_mongodb"], "mysql": ["iiiot_veda_mysql"], "redis": ["iiiot_veda_redis"],
            "sql": ["iiiot_veda_sql"], "sqlserver": ["iiiot_veda_sqlserver"], "influxdb": ["iiiot_veda_influxdb"], "exec": ["iiiot_veda_exec"],
            "http": ["iiiot_veda_http"], "http-listener": ["iiiot_veda_http_listener"], "nvidia": ["iiiot_veda_nvidia"],
            "s7": ["iiiot_veda_s7"], "syslog": ["iiiot_veda_syslog"], "cisco-telemetry": ["iiiot_veda_cisco_telemetry"],
            "system": ["iiiot_veda_system_extended"], "opentelemetry": ["iiiot_veda_opentelemetry"],
            "nginx": ["iiiot_veda_nginx"], "csv": ["iiiot_veda_csv"], "grok": ["iiiot_veda_grok"],
            "monitoring": ["telegraf_cpu", "telegraf_mem", "telegraf_disk", "telegraf_net", "telegraf_mqtt", "telegraf_modbus", "telegraf_opcua", "iiiot_veda_docker", "iiiot_veda_kubernetes", "iiiot_veda_mongodb", "iiiot_veda_mysql", "iiiot_veda_redis", "iiiot_veda_sql", "iiiot_veda_sqlserver", "iiiot_veda_influxdb", "iiiot_veda_exec", "iiiot_veda_http", "iiiot_veda_http_listener", "iiiot_veda_nvidia", "iiiot_veda_s7", "iiiot_veda_syslog", "iiiot_veda_cisco_telemetry", "iiiot_veda_system_extended", "iiiot_veda_opentelemetry", "iiiot_veda_nginx", "iiiot_veda_csv", "iiiot_veda_grok"],
        }[plugin]
        manifest = {
            "plugin": f"IIIOT-Veda {plugin.replace('-', ' ').title()}",
            "version": "1.0.0",
            "target_os": target_os,
            "architecture": architecture,
            "runtime_installer": copied_installer.name,
            "runtime_installer_sha256": _sha256(installer),
            "telemetry_destination": "influxdb3",
            "measurement": tables[0],
            "measurements": tables,
            "bundle_revision": 7,
        }
        (staging / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        if target_os == "windows":
            script = staging / "install.ps1"
            script.write_text(_windows_installer(copied_installer.name, plugin), encoding="utf-8")
            bundle_path = output_dir / f"{bundle_base}.exe"
            _build_windows_executable(staging, bundle_path, architecture)
        else:
            script = staging / "install.sh"
            installer_script = _macos_installer(copied_installer.name, plugin) if target_os == "macos" else _linux_installer(copied_installer.name, plugin)
            installer_script = installer_script.replace("POSTGRES_DSN", "INFLUXDB3_AUTH_TOKEN").replace("PostgreSQL", "InfluxDB")
            script.write_text(installer_script, encoding="utf-8")
            script.chmod(0o755)
            if target_os == "linux-deb":
                bundle_path = output_dir / f"{bundle_base}.deb"
                _build_deb(staging, bundle_path, plugin, architecture)
            elif target_os == "linux-rpm":
                bundle_path = output_dir / f"{bundle_base}.rpm"
                _build_rpm(staging, bundle_path, plugin, architecture)
            else:
                use_dmg = installer.suffix.lower() == ".dmg"
                bundle_path = output_dir / f"{bundle_base}{'.dmg' if use_dmg else '.pkg'}"
                _build_macos_package(staging, bundle_path, plugin, use_dmg)

    return {
        "filename": bundle_path.name,
        "path": str(bundle_path.resolve()),
        "size_bytes": bundle_path.stat().st_size,
        "checksum_sha256": _sha256(bundle_path),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the IIIOT-Veda monitoring plugin installation bundle.")
    parser.add_argument("--target-os", required=True, choices=sorted(TARGETS))
    parser.add_argument("--architecture", required=True, choices=sorted(ARCHITECTURES))
    parser.add_argument("--telegraf-installer", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--plugin", choices=sorted(PLUGINS), default="cpu")
    parser.add_argument("--connector-config-file", type=Path)
    parser.add_argument("--influx-url", default="http://localhost:8181")
    parser.add_argument("--influx-token", default="")
    parser.add_argument("--influx-database", default="iiiot_telemetry")
    args = parser.parse_args()
    print(json.dumps(build_bundle(args.target_os, args.architecture, args.telegraf_installer, args.output_dir, args.plugin, args.connector_config_file, args.influx_url, args.influx_token, args.influx_database)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
