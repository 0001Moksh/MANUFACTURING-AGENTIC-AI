"""Share process snapshots without blocking the API event loop on OS calls."""
import asyncio
import logging
import time
from typing import Any, Dict, List

import psutil

logger = logging.getLogger(__name__)


def collect_process_snapshot() -> dict:
    process_handles = []
    for process in psutil.process_iter(["pid", "name", "memory_info", "status", "username", "cmdline"]):
        try:
            if process.pid == 0:
                continue
            process.cpu_percent(interval=None)
            process_handles.append(process)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    time.sleep(0.12)

    processes: List[Dict[str, Any]] = []
    for process in process_handles:
        try:
            info = process.info
            memory_info = info.get("memory_info")
            command = info.get("cmdline") or []
            processes.append({
                "pid": info.get("pid"),
                "name": info.get("name") or "Unknown process",
                "command": " ".join(command[:3]),
                "cpu_percent": round(float(process.cpu_percent(interval=None)), 2),
                "memory_bytes": int(memory_info.rss) if memory_info else 0,
                "status": info.get("status") or "unknown",
                "username": info.get("username"),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    processes.sort(key=lambda item: (item["cpu_percent"], item["memory_bytes"]), reverse=True)

    service_map: Dict[str, Dict[str, Any]] = {}
    for process in processes:
        service = service_map.setdefault(process["name"], {
            "name": process["name"], "instances": 0, "cpu_percent": 0.0, "memory_bytes": 0,
        })
        service["instances"] += 1
        service["cpu_percent"] += process["cpu_percent"]
        service["memory_bytes"] += process["memory_bytes"]
    services = sorted(service_map.values(), key=lambda item: (item["cpu_percent"], item["memory_bytes"]), reverse=True)
    for service in services:
        service["cpu_percent"] = round(service["cpu_percent"], 2)

    return {"process_count": len(processes), "processes": processes, "services": services}


class ProcessSnapshotCache:
    def __init__(self, ttl: float = 5.0, wait_timeout: float = 1.0):
        self.ttl = ttl
        self.wait_timeout = wait_timeout
        self.snapshot = {"process_count": 0, "processes": [], "services": []}
        self.updated_at = float("-inf")
        self.task = None

    async def _refresh(self):
        try:
            self.snapshot = await asyncio.to_thread(collect_process_snapshot)
        except Exception:
            logger.exception("Process snapshot failed; retaining the last snapshot")
        finally:
            self.updated_at = time.monotonic()

    async def get(self) -> dict:
        # A timed-out HTTP request must not start another concurrent OS scan.
        if (self.task is None or self.task.done()) and time.monotonic() - self.updated_at >= self.ttl:
            self.task = asyncio.create_task(self._refresh())
        if self.task is not None and not self.task.done():
            try:
                await asyncio.wait_for(asyncio.shield(self.task), timeout=self.wait_timeout)
            except asyncio.TimeoutError:
                pass
        return self.snapshot


process_snapshots = ProcessSnapshotCache()
