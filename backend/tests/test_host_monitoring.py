"""Run with PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p test_host_monitoring.py."""
import json
import subprocess
import tarfile
import tempfile
import tomllib
import unittest
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from app.memory_telemetry import memory_sample
from app.host_telemetry import latest_plugin_metric, memory_payload
from plugin_packager import build_bundle, _telegraf_config


class MemoryNormalizationTests(unittest.TestCase):
    def sample(self, fields):
        return memory_sample({"time": datetime(2026, 10, 30, tzinfo=timezone.utc), "host": "host-a", "fields": fields})

    def test_windows_missing_optional_fields_and_percent_fallback(self):
        row = self.sample({"total": 1000, "used": 250, "available": 750})
        self.assertEqual(row["used_percent"], 25)
        self.assertEqual(row["available_percent"], 75)
        self.assertIsNone(row["free"])
        self.assertIsNone(row["cached"])

    def test_linux_preserves_reported_percent_and_available_semantics(self):
        row = self.sample({"total": 1000, "used": 400, "used_percent": 39, "available": 700, "free": 100, "cached": 600})
        self.assertEqual(row["used_percent"], 39)
        self.assertEqual(row["available"], 700)
        self.assertEqual(row["free"], 100)

    def test_unknown_zero_and_invalid_are_distinct(self):
        row = self.sample({"total": 0, "used": 0, "available": "NaN", "cached": -1, "free": "invalid"})
        self.assertEqual(row["used"], 0)
        self.assertIsNone(row["used_percent"])
        self.assertIsNone(row["available"])
        self.assertIsNone(row["cached"])
        self.assertIsNone(row["free"])


class FakeResult:
    def __init__(self, value): self.value = value
    def scalar(self): return self.value
    def mappings(self): return self
    def all(self): return self.value
    def first(self): return self.value[0] if self.value else None


class FakeDB:
    def __init__(self, *results): self.results = iter(results); self.calls = []
    async def execute(self, query, params=None):
        self.calls.append((str(query), params))
        result = next(self.results)
        if isinstance(result, Exception): raise result
        return FakeResult(result)


class HostTelemetryTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_memory_table_returns_empty_payload(self):
        db = FakeDB(None)
        payload = await memory_payload(db)
        self.assertEqual(payload['samples'], [])
        self.assertEqual(payload['hosts'], [])
        self.assertEqual(len(db.calls), 1)

    async def test_chronological_samples_hosts_and_bounds(self):
        db = FakeDB('telegraf_mem', [
            {'time': '2026-10-30T10:01:00Z', 'host': 'b', 'fields': {'total': 100, 'used': 70}},
            {'time': '2026-10-30T10:00:00Z', 'host': 'a', 'fields': {'total': 100, 'used': 30}},
        ])
        payload = await memory_payload(db, 99999, 99999)
        self.assertEqual(payload['hosts'], ['a', 'b'])
        self.assertEqual(payload['samples'][0]['used_percent'], 30)
        self.assertEqual(db.calls[1][1], {'minutes': 1440, 'limit': 5000})
        self.assertIn('to_jsonb(m)', db.calls[1][0])
        self.assertEqual(payload['sample_count'], 2)

    async def test_memory_verification_never_checks_cpu(self):
        db = FakeDB(None)
        metric, error = await latest_plugin_metric(db, 'telegraf_mem')
        self.assertIsNone(metric)
        self.assertTrue(error)
        self.assertEqual(db.calls[0][1], {'table': 'public.telegraf_mem'})

    async def test_both_plugins_verify_their_own_recent_metrics(self):
        for table in ['telegraf_cpu', 'telegraf_mem']:
            db = FakeDB(table, [{'time': '2026-10-30T10:00:00Z', 'host': 'a'}])
            metric, error = await latest_plugin_metric(db, table)
            self.assertEqual(metric['host'], 'a')
            self.assertIsNone(error)
            self.assertIn(f'FROM public.{table}', db.calls[1][0])
            self.assertIn("INTERVAL '10 minutes'", db.calls[1][0])

    async def test_no_recent_samples_do_not_verify(self):
        metric, error = await latest_plugin_metric(FakeDB('telegraf_mem', []), 'telegraf_mem')
        self.assertIsNone(metric)

    async def test_identifier_allowlist(self):
        db = FakeDB()
        with self.assertRaises(ValueError): await latest_plugin_metric(db, 'other_table')
        self.assertEqual(db.calls, [])

    async def test_database_failures_propagate_for_route_503(self):
        with self.assertRaises(TimeoutError): await memory_payload(FakeDB(TimeoutError()))


class BundleTests(unittest.TestCase):
    def test_shared_config_has_one_output_and_both_collectors(self):
        config = tomllib.loads(_telegraf_config())
        self.assertEqual(set(config['inputs']), {'cpu', 'mem'})
        self.assertEqual(len(config['outputs']['postgresql']), 1)
        self.assertEqual(config['inputs']['cpu'][0]['name_override'], 'telegraf_cpu')
        self.assertEqual(config['inputs']['mem'][0]['name_override'], 'telegraf_mem')

    def test_bundles_for_both_plugins_and_all_target_formats(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for target, extension in [('linux-deb', '.deb'), ('linux-rpm', '.rpm'), ('linux-archive', '.tar.gz'), ('macos', '.dmg'), ('windows', '.zip')]:
                installer = root / ('telegraf' + extension)
                installer.write_bytes(b'test vendor package')
                for plugin in ['cpu', 'memory']:
                    for arch in ['x86_64', 'arm64']:
                        with self.subTest(target=target, plugin=plugin, arch=arch):
                            result = build_bundle(target, arch, installer, root / 'bundles', plugin)
                            if target == 'windows':
                                with zipfile.ZipFile(result['path']) as archive:
                                    config = archive.read('payload/mai-cpu.conf').decode()
                                    manifest = json.loads(archive.read('payload/manifest.json'))
                                    script = archive.read('payload/install.ps1').decode()
                                    self.assertIn('--config (Join-Path $ConfigDir "mai-cpu.conf")', script)
                            else:
                                with tarfile.open(result['path']) as archive:
                                    prefix = f'mai-telegraf-{plugin}-{target}-{arch}'
                                    config = archive.extractfile(prefix + '/mai-cpu.conf').read().decode()
                                    manifest = json.load(archive.extractfile(prefix + '/manifest.json'))
                                    script = archive.extractfile(prefix + '/install.sh').read().decode()
                                    subprocess.run(['bash', '-n'], input=script, text=True, check=True)
                            self.assertEqual(config, _telegraf_config())
                            self.assertEqual(manifest['measurement'], 'telegraf_cpu' if plugin == 'cpu' else 'telegraf_mem')
                            self.assertEqual(manifest['measurements'], ['telegraf_cpu', 'telegraf_mem'])
                            self.assertEqual(manifest['bundle_revision'], 2)
                            self.assertIn(f'mai-telegraf-{plugin}-', result['filename'])

    def test_invalid_plugin_rejected(self):
        with self.assertRaises(ValueError): build_bundle('linux-rpm', 'x86_64', Path('unused'), Path('unused'), 'unknown')


if __name__ == '__main__': unittest.main()
