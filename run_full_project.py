"""
Project launcher — starts backend (uvicorn :8001) and frontend (Vite :3000).
Windows-focused, with cleaner port cleanup, non-blocking logs, and graceful shutdown.
"""

from __future__ import annotations

import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

BACKEND_PORT = 8001
FRONTEND_PORT = 3000
PORTS_TO_CLEAR = [FRONTEND_PORT, BACKEND_PORT]

BACKEND_PYTHON = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
NPM_CMD = Path(r"C:\Program Files\nodejs\npm.cmd")

BACKEND_STARTUP_TIMEOUT = 90   # seconds
HEALTH_CHECK_PATH = "/docs"    # FastAPI docs — cheap existence check
LOG_PREFIX = {
    "backend":  "[backend ]",
    "frontend": "[frontend]",
}


# ── Port helpers ─────────────────────────────────────────────────────────────
def port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _pids_on_port_netstat(port: int) -> list[int]:
    """Parse netstat -ano for PIDs listening/using the given TCP port."""
    try:
        result = subprocess.run(
            ["netstat", "-ano", "-p", "tcp"],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []

    pids: list[int] = []
    needle = f":{port} "
    for line in result.stdout.splitlines():
        if needle not in line:
            continue
        # Only care about LISTENING / ESTABLISHED rows that own the local port
        parts = line.split()
        if len(parts) < 5:
            continue
        local = parts[1]  # e.g. 0.0.0.0:3000 or 127.0.0.1:8001
        if not local.endswith(f":{port}"):
            continue
        pid_str = parts[-1]
        if pid_str.isdigit():
            pids.append(int(pid_str))
    return sorted(set(pids))


def _pids_on_port_powershell(port: int) -> list[int]:
    """Fallback: PowerShell Get-NetTCPConnection (more reliable on some Windows builds)."""
    ps = (
        f"(Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue)"
        f".OwningProcess | Sort-Object -Unique"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []

    pids: list[int] = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if line.isdigit():
            pids.append(int(line))
    return sorted(set(pids))


def kill_pids(pids: list[int], port: int) -> None:
    for pid in pids:
        if pid <= 0:
            continue
        try:
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/T", "/F"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
            )
            print(f"  Killed PID {pid} (port {port})")
        except Exception:
            pass


def clear_port(port: int) -> None:
    pids = _pids_on_port_netstat(port)
    if not pids:
        pids = _pids_on_port_powershell(port)
    if pids:
        kill_pids(pids, port)
    else:
        # Last resort: nothing found but port still reports in use
        pass


def ensure_ports_free(max_attempts: int = 12) -> None:
    for port in PORTS_TO_CLEAR:
        for attempt in range(1, max_attempts + 1):
            if not port_in_use(port):
                break
            print(f"Port {port} in use — clearing ({attempt}/{max_attempts})...")
            clear_port(port)
            time.sleep(0.8)
        else:
            raise RuntimeError(
                f"Port {port} is still occupied after automatic cleanup. "
                "Close the process manually and try again."
            )
    print("Ports 3000 and 8001 are free.")


# ── Process helpers ──────────────────────────────────────────────────────────
def kill_process_tree(pid: Optional[int]) -> None:
    if not pid or pid <= 0:
        return
    try:
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=15,
        )
    except Exception:
        pass


def stop_process(proc: Optional[subprocess.Popen]) -> None:
    if proc is None:
        return
    try:
        if proc.poll() is None:
            kill_process_tree(proc.pid)
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def stream_output(proc: subprocess.Popen, label: str, stop_event: threading.Event) -> None:
    """Background thread: forward process stdout line-by-line without blocking the main loop."""
    prefix = LOG_PREFIX.get(label, f"[{label}]")
    if proc.stdout is None:
        return
    try:
        for line in iter(proc.stdout.readline, ""):
            if stop_event.is_set():
                break
            text = line.rstrip()
            if text:
                print(f"{prefix} {text}")
    except Exception:
        pass


# ── Service starters ─────────────────────────────────────────────────────────
def start_backend() -> subprocess.Popen:
    if not BACKEND_PYTHON.is_file():
        raise FileNotFoundError(
            f"Backend Python not found: {BACKEND_PYTHON}\n"
            "Create/activate the venv under backend/venv first."
        )

    cmd = [
        str(BACKEND_PYTHON),
        "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", str(BACKEND_PORT),
    ]
    print(f"Starting backend: {' '.join(cmd)}")
    return subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )


def wait_for_backend(proc: subprocess.Popen, timeout: int = BACKEND_STARTUP_TIMEOUT) -> None:
    """Wait until TCP port is open, without blocking on stdout reads from the child process."""
    deadline = time.time() + timeout
    last_lines: list[str] = []

    while time.time() < deadline:
        if proc.poll() is not None:
            if proc.stdout is not None:
                try:
                    rest = proc.stdout.read()
                    if rest:
                        last_lines.append(rest)
                except Exception:
                    pass
            raise TimeoutError(
                "Backend exited before becoming ready.\n"
                "Last output:\n" + "".join(last_lines)[-3000:]
            )

        if port_in_use(BACKEND_PORT):
            try:
                import urllib.request
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{BACKEND_PORT}{HEALTH_CHECK_PATH}",
                    timeout=2,
                ) as resp:
                    if 200 <= resp.status < 500:
                        print("Backend is ready.")
                        return
            except Exception:
                print("Backend port open (HTTP probe skipped/failed). Starting frontend.")
                return

        time.sleep(0.6)

    raise TimeoutError(
        f"Backend did not become reachable on port {BACKEND_PORT} "
        f"within {timeout}s."
    )


def start_frontend() -> subprocess.Popen:
    npm = str(NPM_CMD) if NPM_CMD.is_file() else "npm"
    cmd = [
        npm, "run", "dev", "--",
        "--host", "0.0.0.0",
        "--port", str(FRONTEND_PORT),
        "--strictPort",
    ]
    print(f"Starting frontend: {' '.join(cmd)}")
    return subprocess.Popen(
        cmd,
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )


# ── Main ─────────────────────────────────────────────────────────────────────
def main() -> int:
    print("Ensuring ports 3000 and 8001 are free...")
    try:
        ensure_ports_free()
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    backend_proc: Optional[subprocess.Popen] = None
    frontend_proc: Optional[subprocess.Popen] = None
    stop_event = threading.Event()
    log_threads: list[threading.Thread] = []

    try:
        backend_proc = start_backend()

        # Start log streaming before readiness checks to avoid blocking on stdout.readline().
        t_be = threading.Thread(
            target=stream_output,
            args=(backend_proc, "backend", stop_event),
            daemon=True,
        )
        t_be.start()
        log_threads.append(t_be)

        wait_for_backend(backend_proc)

        frontend_proc = start_frontend()
        t_fe = threading.Thread(
            target=stream_output,
            args=(frontend_proc, "frontend", stop_event),
            daemon=True,
        )
        t_fe.start()
        log_threads.append(t_fe)

        print()
        print("=" * 52)
        print("  Project is running")
        print(f"  Backend : http://localhost:{BACKEND_PORT}")
        print(f"  Frontend: http://localhost:{FRONTEND_PORT}")
        print("  Press Ctrl+C to stop both services")
        print("=" * 52)
        print()

        # Supervise both processes
        while True:
            if backend_proc.poll() is not None:
                print("Backend exited unexpectedly.", file=sys.stderr)
                return 1
            if frontend_proc.poll() is not None:
                print("Frontend exited unexpectedly.", file=sys.stderr)
                return 1
            time.sleep(1.5)

    except KeyboardInterrupt:
        print("\nStopping services...")
        return 0
    except (TimeoutError, FileNotFoundError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        stop_event.set()
        stop_process(frontend_proc)
        stop_process(backend_proc)
        # Ensure ports are free again after exit
        for port in PORTS_TO_CLEAR:
            if port_in_use(port):
                clear_port(port)
        print("All services stopped.")


if __name__ == "__main__":
    sys.exit(main())