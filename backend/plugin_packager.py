"""Build a target-specific MAI Telegraf host monitoring plugin bundle from the CLI."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path


TARGETS = {"windows", "linux-deb", "linux-rpm", "linux-archive", "macos"}
ARCHITECTURES = {"x86_64", "arm64"}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


PLUGINS = {"cpu", "memory", "disk", "network", "mqtt", "modbus", "opcua"}


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
    return '''[[outputs.postgresql]]
  connection = "${POSTGRES_DSN}"
  schema = "public"
  timestamp_column_name = "time"
  timestamp_column_type = "timestamp with time zone"
  create_templates = [
    'CREATE TABLE {{ .table }} ({{ .columns }})',
    'CREATE INDEX ON {{ .table }} USING btree({{ .columns.Keys.Identifiers | join "," }})'
  ]
'''


def _connector_config(plugin: str) -> str:
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
        "mqtt": '''# Edit this file before installation. Edit the installed copy later and restart Telegraf.
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
if [[ -z "${{POSTGRES_DSN:-}}" && ! -s "${{existing_output}}" ]]; then
  echo "Set POSTGRES_DSN in mai-settings.env for the first MAI plugin installation." >&2
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
  *) echo "Unsupported Telegraf package: ${{package_path}}" >&2; exit 1 ;;
esac

sudo install -d -m 0755 /etc/telegraf/telegraf.d
sudo rm -f /etc/telegraf/telegraf.d/mai-cpu.conf
if [[ -n "${{POSTGRES_DSN:-}}" ]]; then
  rendered_output="$(mktemp)"
  escaped_dsn="$(printf '%s' "${{POSTGRES_DSN}}" | sed 's/[\\/&]/\\\\&/g')"
  sed "s/\\${{POSTGRES_DSN}}/${{escaped_dsn}}/g" "${{script_dir}}/mai-output.conf" > "${{rendered_output}}"
  sudo install -m 0640 "${{rendered_output}}" "${{existing_output}}"
  rm -f "${{rendered_output}}"
else
  echo "Reusing the existing MAI PostgreSQL output configuration."
fi
sudo install -m 0640 "${{script_dir}}/mai-host-base.conf" /etc/telegraf/telegraf.d/mai-host-base.conf
if [[ -s "${{script_dir}}/mai-connector.conf" ]]; then
  sudo install -m 0640 "${{script_dir}}/mai-connector.conf" "/etc/telegraf/telegraf.d/mai-{plugin}.conf"
fi
sudo chown root:telegraf /etc/telegraf/telegraf.d/mai-*.conf
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable --now telegraf
  sudo systemctl restart telegraf
fi
echo "MAI Telegraf {plugin} plugin installed."
'''


def _macos_installer(package_name: str, plugin: str) -> str:
    required, optional = _connector_variables(plugin)
    required_vars = " ".join(required)
    render_vars = " ".join(required + optional)
    return f'''#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
package_path="${{script_dir}}/{package_name}"
if [[ -z "${{POSTGRES_DSN:-}}" ]]; then
  echo "Set POSTGRES_DSN before running this installer." >&2
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
      [[ -n "${{binary}}" ]] || {{ echo "No Telegraf installer was found in the DMG." >&2; exit 1; }}
      sudo install -m 0755 "${{binary}}" /usr/local/bin/telegraf
    fi
    hdiutil detach "${{mount_dir}}"
    rm -rf "${{mount_dir}}"
    trap - EXIT
    ;;
  *) echo "Unsupported Telegraf package: ${{package_path}}" >&2; exit 1 ;;
esac

sudo install -d -m 0755 /usr/local/etc/telegraf.d
sudo rm -f /usr/local/etc/telegraf.d/mai-cpu.conf
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
echo "MAI Telegraf {plugin} plugin files installed. Start or restart Telegraf, then verify in MAI."
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
$ConfigDir = Join-Path $env:ProgramFiles "Telegraf\\telegraf.d"
$ExistingOutput = Join-Path $ConfigDir "mai-output.conf"
if (-not $env:POSTGRES_DSN -and -not (Test-Path $ExistingOutput)) {{
  Add-Type -AssemblyName Microsoft.VisualBasic
  $env:POSTGRES_DSN = [Microsoft.VisualBasic.Interaction]::InputBox(
    "Enter the PostgreSQL connection URL used by the MAI host monitoring plugins.",
    "MAI Telegraf Host Monitoring",
    "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable"
  )
}}
if ([string]::IsNullOrWhiteSpace($env:POSTGRES_DSN) -and -not (Test-Path $ExistingOutput)) {{ throw "A PostgreSQL connection URL is required for the first MAI plugin." }}
foreach ($VariableName in @({required_ps})) {{
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($VariableName))) {{ throw "Set $VariableName before running this installer." }}
}}
$DatabaseUri = $null
if ($env:POSTGRES_DSN -and (-not [Uri]::TryCreate($env:POSTGRES_DSN, [UriKind]::Absolute, [ref]$DatabaseUri) -or
    $DatabaseUri.Scheme -notin @("postgres", "postgresql") -or
    $DatabaseUri.Host -in @("", "HOST") -or
    $DatabaseUri.AbsolutePath -in @("", "/", "/DATABASE") -or
    $DatabaseUri.UserInfo -match '(^USER:|:PASSWORD$)')) {{
  throw "Enter a real PostgreSQL URL for the MAI database. Replace USER, PASSWORD, HOST and DATABASE; do not use a +asyncpg URL."
}}

# Release the running binary before updating the shared Telegraf installation.
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
  $Target = Join-Path $env:ProgramFiles "Telegraf"
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Expand-Archive -Path $Package -DestinationPath $Target -Force
}} else {{
  throw "Unsupported Telegraf package: $Package"
}}

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
Remove-Item (Join-Path $ConfigDir "mai-cpu.conf") -Force -ErrorAction SilentlyContinue
if ($env:POSTGRES_DSN) {{
  $OutputTemplate = Get-Content (Join-Path $BundleDir "mai-output.conf") -Raw
  $OutputTemplate.Replace('${{POSTGRES_DSN}}', $env:POSTGRES_DSN) | Set-Content $ExistingOutput -Encoding UTF8
}} else {{
  Write-Host "Reusing the existing MAI PostgreSQL output configuration."
}}
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
$TelegrafExe = Get-ChildItem (Join-Path $env:ProgramFiles "Telegraf") -Filter "telegraf.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $TelegrafExe) {{ throw "telegraf.exe was not found after installation." }}
if ($TelegrafExe) {{
  $Service = Get-Service -Name "telegraf" -ErrorAction SilentlyContinue
  if ($Service) {{
    Stop-Service -Name "telegraf" -Force
    & $TelegrafExe.FullName --service uninstall
    if ($LASTEXITCODE -ne 0) {{ throw "Could not update the existing Telegraf service." }}
  }}
  & $TelegrafExe.FullName --service install --config-directory $ConfigDir
  if ($LASTEXITCODE -ne 0) {{ throw "Could not install the Telegraf service." }}
  Start-Service -Name "telegraf"
  (Get-Service -Name "telegraf").WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
}}
Write-Host "MAI Telegraf host monitoring plugin installed. Start or restart the Telegraf service, then verify in MAI."
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


def _installation_readme(target_os: str, plugin: str) -> str:
    required, optional = _connector_variables(plugin)
    connector_lines = "\n".join(
        [*(f"export {name}='REPLACE_ME'" for name in required), *(f"export {name}=''" for name in optional)]
    )
    if target_os == "windows":
        connector_lines = "\n".join(
            [*(f'$env:{name} = "REPLACE_ME"' for name in required), *(f'$env:{name} = ""' for name in optional)]
        )
        command = f'''$env:POSTGRES_DSN = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable"
{connector_lines}
.\\install.ps1'''
    else:
        command = '''1. Edit mai-settings.env and set POSTGRES_DSN for the first MAI plugin only.
   Later plugin installations reuse /etc/telegraf/telegraf.d/mai-output.conf.
2. Edit mai-connector.conf with the source settings and all required measurements.
3. Run: ./install.sh'''
    return f'''# MAI Telegraf Host Monitoring

This bundle installs the Telegraf {plugin} connector and writes metrics to PostgreSQL.
Use a PostgreSQL URL that the target machine can reach. Do not include a
SQLAlchemy driver suffix such as `+asyncpg` in the URL.

```text
{command}
```

The installer keeps connector inputs in separate files and one shared PostgreSQL output.
Installing another connector preserves connectors already installed.
Connector settings can be changed later in `/etc/telegraf/telegraf.d/mai-{plugin}.conf`;
validate the configuration and restart Telegraf after editing it.
CPU and memory remain enabled as the host baseline.
On macOS, start Telegraf with --config-directory /usr/local/etc/telegraf.d.
On Linux archive installations, a working Telegraf service must already exist. The database user needs
CONNECT, USAGE/CREATE on the public schema, and table insert/update privileges.
After installation, return to MAI, confirm installation, and verify the plugin.
'''


def build_bundle(target_os: str, architecture: str, telegraf_installer: Path, output_dir: Path, plugin: str = "cpu") -> dict[str, object]:
    if plugin not in PLUGINS:
        raise ValueError(f"Unsupported plugin: {plugin}")
    if target_os not in TARGETS:
        raise ValueError(f"Unsupported target OS/package type: {target_os}")
    if architecture not in ARCHITECTURES:
        raise ValueError(f"Unsupported architecture: {architecture}")
    installer = telegraf_installer.resolve()
    if not installer.is_file():
        raise FileNotFoundError(f"Telegraf installer not found: {installer}")

    output_dir.mkdir(parents=True, exist_ok=True)
    bundle_base = f"mai-telegraf-{plugin}-{target_os}-{architecture}"
    with tempfile.TemporaryDirectory(prefix="mai-plugin-") as temporary:
        staging = Path(temporary) / bundle_base
        staging.mkdir()
        copied_installer = staging / installer.name
        shutil.copy2(installer, copied_installer)
        (staging / "mai-host-base.conf").write_text(_host_base_config(), encoding="utf-8")
        (staging / "mai-output.conf").write_text(_output_config(), encoding="utf-8")
        (staging / "mai-connector.conf").write_text(_connector_config(plugin), encoding="utf-8")
        (staging / "mai-settings.env").write_text(
            "# Required only for the first MAI Telegraf plugin on this host.\n"
            "# Keep this file private because it contains database credentials.\n"
            "POSTGRES_DSN=''\n"
            "# Example: postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable\n",
            encoding="utf-8",
        )
        (staging / "INSTALL.md").write_text(_installation_readme(target_os, plugin), encoding="utf-8")
        tables = {
            "cpu": ["telegraf_cpu"], "memory": ["telegraf_mem"],
            "disk": ["telegraf_disk", "telegraf_diskio"], "network": ["telegraf_net"],
            "mqtt": ["telegraf_mqtt"], "modbus": ["telegraf_modbus"], "opcua": ["telegraf_opcua"],
        }[plugin]
        manifest = {
            "plugin": f"Telegraf {plugin.title()} Connector",
            "version": "1.0.0",
            "target_os": target_os,
            "architecture": architecture,
            "telegraf_installer": installer.name,
            "telegraf_installer_sha256": _sha256(installer),
            "telemetry_destination": "postgresql",
            "measurement": tables[0],
            "measurements": tables,
            "bundle_revision": 4,
        }
        (staging / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        if target_os == "windows":
            script = staging / "install.ps1"
            script.write_text(_windows_installer(installer.name, plugin), encoding="utf-8")
            bundle_path = output_dir / f"{bundle_base}.exe"
            _build_windows_executable(staging, bundle_path, architecture)
        else:
            script = staging / "install.sh"
            script.write_text(_macos_installer(installer.name, plugin) if target_os == "macos" else _linux_installer(installer.name, plugin), encoding="utf-8")
            script.chmod(0o755)
            bundle_path = output_dir / f"{bundle_base}.tar.gz"
            with tarfile.open(bundle_path, "w:gz") as archive:
                archive.add(staging, arcname=staging.name)

    return {
        "filename": bundle_path.name,
        "path": str(bundle_path.resolve()),
        "size_bytes": bundle_path.stat().st_size,
        "checksum_sha256": _sha256(bundle_path),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the MAI Telegraf host monitoring plugin installation bundle.")
    parser.add_argument("--target-os", required=True, choices=sorted(TARGETS))
    parser.add_argument("--architecture", required=True, choices=sorted(ARCHITECTURES))
    parser.add_argument("--telegraf-installer", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--plugin", choices=sorted(PLUGINS), default="cpu")
    args = parser.parse_args()
    print(json.dumps(build_bundle(args.target_os, args.architecture, args.telegraf_installer, args.output_dir, args.plugin)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
