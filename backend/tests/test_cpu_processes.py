import asyncio
import threading

import unittest
from unittest.mock import patch

from app import cpu_processes


class ProcessSnapshotTests(unittest.IsolatedAsyncioTestCase):
    async def test_slow_process_scan_does_not_block_or_duplicate(self):
        started = threading.Event()
        release = threading.Event()
        calls = []
        snapshot = {"process_count": 1, "processes": [{"pid": 123}], "services": []}

        def collect():
            calls.append(True)
            started.set()
            release.wait(3)
            return snapshot

        patcher = patch.object(cpu_processes, "collect_process_snapshot", collect)
        patcher.start()
        self.addCleanup(patcher.stop)
        cache = cpu_processes.ProcessSnapshotCache(wait_timeout=0.02)
        try:
            results = await asyncio.wait_for(asyncio.gather(*(cache.get() for _ in range(5))), 1)
            assert started.is_set()
            assert len(calls) == 1
            assert all(result["process_count"] == 0 for result in results)
            assert not cache.task.done()
        finally:
            release.set()
            if cache.task:
                await cache.task
        assert await cache.get() == snapshot
        assert len(calls) == 1


    async def test_failed_scan_retains_last_snapshot(self):
        def collect():
            raise OSError("process scan unavailable")

        patcher = patch.object(cpu_processes, "collect_process_snapshot", collect)
        patcher.start()
        self.addCleanup(patcher.stop)
        cache = cpu_processes.ProcessSnapshotCache()
        previous = {"process_count": 1, "processes": [{"pid": 123}], "services": []}
        cache.snapshot = previous
        assert await cache.get() is previous
