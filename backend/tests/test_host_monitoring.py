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
from app.host_telemetry import connector_payload, latest_plugin_metric, memory_payload
from plugin_packager import PLUGINS, build_bundle, _connector_config, _host_base_config, _output_config, _telegraf_config


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

    async def test_connector_payload_combines_disk_and_diskio(self):
        db = FakeDB(
            'telegraf_disk', [{'time': '2026-10-30T10:00:00Z', 'host': 'a', 'fields': {'time': 'x', 'host': 'a', 'used_percent': 65}}],
            'telegraf_diskio', [{'time': '2026-10-30T10:00:01Z', 'host': 'a', 'fields': {'time': 'x', 'host': 'a', 'reads': 9}}],
        )
        payload = await connector_payload(db, 'telegraf-disk-monitoring', ['telegraf_disk', 'telegraf_diskio'])
        self.assertEqual(payload['measurements'], ['disk', 'diskio'])
        self.assertEqual(payload['sample_count'], 2)
        self.assertNotIn('time', payload['samples'][0]['fields'])
        self.assertNotIn('host', payload['samples'][0]['fields'])

    async def test_connector_table_allowlist(self):
        with self.assertRaises(ValueError):
            await connector_payload(FakeDB(), 'bad', ['injected_table'])


class BundleTests(unittest.TestCase):
    def test_shared_config_has_one_output_and_both_collectors(self):
        config = tomllib.loads(_telegraf_config())
        self.assertEqual(set(config['inputs']), {'cpu', 'mem'})
        self.assertEqual(len(config['outputs']['postgresql']), 1)
        self.assertEqual(config['inputs']['cpu'][0]['name_override'], 'telegraf_cpu')
        self.assertEqual(config['inputs']['mem'][0]['name_override'], 'telegraf_mem')

    def test_every_connector_config_parses_as_toml(self):
        expected = {
            'disk': {'disk', 'diskio'}, 'network': {'net'}, 'mqtt': {'mqtt_consumer'},
            'modbus': {'modbus'}, 'opcua': {'opcua'},
        }
        replacements = {
            '${MQTT_BROKER}': 'tcp://localhost:1883', '${MQTT_TOPIC}': 'sensors/#', '${MQTT_USERNAME}': '', '${MQTT_PASSWORD}': '', '${MQTT_DATA_FORMAT}': 'json',
            '${MODBUS_DEVICE}': 'meter', '${MODBUS_CONTROLLER}': 'tcp://localhost:502', '${MODBUS_SLAVE_ID}': '1', '${MODBUS_FIELD}': 'value', '${MODBUS_ADDRESS}': '0', '${MODBUS_BYTE_ORDER}': 'AB', '${MODBUS_DATA_TYPE}': 'UINT16', '${MODBUS_SCALE}': '1.0',
            '${OPCUA_ENDPOINT}': 'opc.tcp://localhost:4840', '${OPCUA_SECURITY_POLICY}': 'None', '${OPCUA_SECURITY_MODE}': 'None', '${OPCUA_AUTH_METHOD}': 'Anonymous', '${OPCUA_USERNAME}': '', '${OPCUA_PASSWORD}': '', '${OPCUA_NODE_NAME}': 'state', '${OPCUA_NODE_ID}': 'ns=0;i=2259',
            '${POSTGRES_DSN}': 'postgresql://u:p@localhost/db',
        }
        for plugin, inputs in expected.items():
            config = _telegraf_config(plugin)
            for source, value in replacements.items(): config = config.replace(source, value)
            parsed = tomllib.loads(config)
            self.assertTrue(inputs.issubset(parsed['inputs']))

    def test_bundles_for_all_plugins_and_target_formats(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for target, extension in [('linux-deb', '.deb'), ('linux-rpm', '.rpm'), ('linux-archive', '.tar.gz'), ('macos', '.dmg'), ('windows', '.zip')]:
                installer = root / ('telegraf' + extension)
                installer.write_bytes(b'test vendor package')
                plugins = sorted(PLUGINS) if target == 'linux-rpm' else ['cpu']
                for plugin in plugins:
                    for arch in ['x86_64', 'arm64']:
                        with self.subTest(target=target, plugin=plugin, arch=arch):
                            result = build_bundle(target, arch, installer, root / 'bundles', plugin)
                            if target == 'windows':
                                with zipfile.ZipFile(result['path']) as archive:
                                    base = archive.read('payload/mai-host-base.conf').decode()
                                    output = archive.read('payload/mai-output.conf').decode()
                                    connector = archive.read('payload/mai-connector.conf').decode()
                                    manifest = json.loads(archive.read('payload/manifest.json'))
                                    script = archive.read('payload/install.ps1').decode()
                                    self.assertIn('--config-directory $ConfigDir', script)
                            else:
                                with tarfile.open(result['path']) as archive:
                                    prefix = f'iiiot-veda-{plugin}-{target}-{arch}'
                                    base = archive.extractfile(prefix + '/mai-host-base.conf').read().decode()
                                    output = archive.extractfile(prefix + '/mai-output.conf').read().decode()
                                    connector = archive.extractfile(prefix + '/mai-connector.conf').read().decode()
                                    manifest = json.load(archive.extractfile(prefix + '/manifest.json'))
                                    script = archive.extractfile(prefix + '/install.sh').read().decode()
                                    subprocess.run(['bash', '-n'], input=script, text=True, check=True)
                            self.assertEqual(base, _host_base_config())
                            self.assertEqual(output, _output_config())
                            self.assertEqual(connector, _connector_config(plugin))
                            self.assertEqual(manifest['bundle_revision'], 4)
                            self.assertIn(f'iiiot-veda-{plugin}-', result['filename'])

    def test_invalid_plugin_rejected(self):
        with self.assertRaises(ValueError): build_bundle('linux-rpm', 'x86_64', Path('unused'), Path('unused'), 'unknown')


if __name__ == '__main__': unittest.main()
