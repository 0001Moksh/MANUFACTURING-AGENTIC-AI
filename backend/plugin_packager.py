"""Build a target-specific MAI Telegraf CPU plugin bundle from the CLI."""

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


def _telegraf_config() -> str:
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

[[outputs.postgresql]]
  connection = "${POSTGRES_DSN}"
  schema = "public"
  timestamp_column_name = "time"
  timestamp_column_type = "timestamp with time zone"
  create_templates = [
    'CREATE TABLE {{ .table }} ({{ .columns }})',
    'CREATE INDEX ON {{ .table }} USING btree({{ .columns.Keys.Identifiers | join "," }})'
  ]
'''


def _linux_installer(package_name: str) -> str:
    return f'''#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
package_path="${{script_dir}}/{package_name}"

if [[ -z "${{POSTGRES_DSN:-}}" ]]; then
  echo "Set POSTGRES_DSN before running this installer." >&2
  exit 1
fi

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
rendered_config="$(mktemp)"
escaped_dsn="$(printf '%s' "${{POSTGRES_DSN}}" | sed 's/[\\/&]/\\\\&/g')"
sed "s/\\${{POSTGRES_DSN}}/${{escaped_dsn}}/g" "${{script_dir}}/mai-cpu.conf" > "${{rendered_config}}"
sudo install -m 0640 "${{rendered_config}}" /etc/telegraf/telegraf.d/mai-cpu.conf
sudo chown root:telegraf /etc/telegraf/telegraf.d/mai-cpu.conf
rm -f "${{rendered_config}}"
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable --now telegraf
  sudo systemctl restart telegraf
fi
echo "MAI Telegraf CPU plugin installed."
'''


def _macos_installer(package_name: str) -> str:
    return f'''#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
package_path="${{script_dir}}/{package_name}"
if [[ -z "${{POSTGRES_DSN:-}}" ]]; then
  echo "Set POSTGRES_DSN before running this installer." >&2
  exit 1
fi

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
rendered_config="$(mktemp)"
escaped_dsn="$(printf '%s' "${{POSTGRES_DSN}}" | sed 's/[\\/&]/\\\\&/g')"
sed "s/\\${{POSTGRES_DSN}}/${{escaped_dsn}}/g" "${{script_dir}}/mai-cpu.conf" > "${{rendered_config}}"
sudo install -m 0640 "${{rendered_config}}" /usr/local/etc/telegraf.d/mai-cpu.conf
rm -f "${{rendered_config}}"
echo "MAI Telegraf CPU plugin files installed. Start or restart Telegraf, then verify in MAI."
'''


def _windows_installer(package_name: str) -> str:
    return f'''$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {{
  Start-Process powershell.exe -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"") -Verb RunAs -Wait
  exit
}}
$BundleDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Package = Join-Path $BundleDir "{package_name}"
if (-not $env:POSTGRES_DSN) {{
  Add-Type -AssemblyName Microsoft.VisualBasic
  $env:POSTGRES_DSN = [Microsoft.VisualBasic.Interaction]::InputBox(
    "Enter the PostgreSQL connection URL used by the MAI CPU plugin.",
    "MAI Telegraf CPU Monitoring",
    "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable"
  )
}}
if ([string]::IsNullOrWhiteSpace($env:POSTGRES_DSN)) {{ throw "A PostgreSQL connection URL is required." }}

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

$ConfigDir = Join-Path $env:ProgramFiles "Telegraf\\telegraf.d"
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
$ConfigTemplate = Get-Content (Join-Path $BundleDir "mai-cpu.conf") -Raw
$ConfigTemplate.Replace('${{POSTGRES_DSN}}', $env:POSTGRES_DSN) | Set-Content (Join-Path $ConfigDir "mai-cpu.conf") -Encoding UTF8
$TelegrafExe = Get-ChildItem (Join-Path $env:ProgramFiles "Telegraf") -Filter "telegraf.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($TelegrafExe) {{
  $Service = Get-Service -Name "telegraf" -ErrorAction SilentlyContinue
  if (-not $Service) {{ & $TelegrafExe.FullName --service install --config (Join-Path $ConfigDir "mai-cpu.conf") }}
  Start-Service -Name "telegraf" -ErrorAction SilentlyContinue
  Restart-Service -Name "telegraf" -Force
}}
Write-Host "MAI Telegraf CPU plugin installed. Start or restart the Telegraf service, then verify in MAI."
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


def _installation_readme(target_os: str) -> str:
    if target_os == "windows":
        command = '''$env:POSTGRES_DSN = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable"
.\\install.ps1'''
    else:
        command = '''export POSTGRES_DSN='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable'
./install.sh
unset POSTGRES_DSN'''
    return f'''# MAI Telegraf CPU Monitoring

This bundle installs Telegraf CPU monitoring and writes metrics to PostgreSQL.
Use a PostgreSQL URL that the target machine can reach. Do not include a
SQLAlchemy driver suffix such as `+asyncpg` in the URL.

```text
{command}
```

Telegraf creates and updates `public.telegraf_cpu`. The database user needs
CONNECT, USAGE/CREATE on the public schema, and table insert/update privileges.
After installation, return to MAI, confirm installation, and verify the plugin.
'''


def build_bundle(target_os: str, architecture: str, telegraf_installer: Path, output_dir: Path) -> dict[str, object]:
    if target_os not in TARGETS:
        raise ValueError(f"Unsupported target OS/package type: {target_os}")
    if architecture not in ARCHITECTURES:
        raise ValueError(f"Unsupported architecture: {architecture}")
    installer = telegraf_installer.resolve()
    if not installer.is_file():
        raise FileNotFoundError(f"Telegraf installer not found: {installer}")

    output_dir.mkdir(parents=True, exist_ok=True)
    bundle_base = f"mai-telegraf-cpu-{target_os}-{architecture}"
    with tempfile.TemporaryDirectory(prefix="mai-plugin-") as temporary:
        staging = Path(temporary) / bundle_base
        staging.mkdir()
        copied_installer = staging / installer.name
        shutil.copy2(installer, copied_installer)
        (staging / "mai-cpu.conf").write_text(_telegraf_config(), encoding="utf-8")
        (staging / "INSTALL.md").write_text(_installation_readme(target_os), encoding="utf-8")
        manifest = {
            "plugin": "Telegraf CPU Monitoring",
            "version": "1.0.0",
            "target_os": target_os,
            "architecture": architecture,
            "telegraf_installer": installer.name,
            "telegraf_installer_sha256": _sha256(installer),
            "telemetry_destination": "postgresql",
            "measurement": "telegraf_cpu",
        }
        (staging / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        if target_os == "windows":
            script = staging / "install.ps1"
            script.write_text(_windows_installer(installer.name), encoding="utf-8")
            bundle_path = output_dir / f"{bundle_base}.exe"
            _build_windows_executable(staging, bundle_path, architecture)
        else:
            script = staging / "install.sh"
            script.write_text(_macos_installer(installer.name) if target_os == "macos" else _linux_installer(installer.name), encoding="utf-8")
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
    parser = argparse.ArgumentParser(description="Build the MAI Telegraf CPU plugin installation bundle.")
    parser.add_argument("--target-os", required=True, choices=sorted(TARGETS))
    parser.add_argument("--architecture", required=True, choices=sorted(ARCHITECTURES))
    parser.add_argument("--telegraf-installer", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(build_bundle(args.target_os, args.architecture, args.telegraf_installer, args.output_dir)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
