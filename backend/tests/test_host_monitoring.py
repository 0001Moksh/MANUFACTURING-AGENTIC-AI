"""Run with PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p test_host_monitoring.py."""
import json
import subprocess
import tarfile
import tempfile
import tomllib
import unittest
import zipfile
from unittest.mock import patch
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
    @patch("app.host_telemetry.query_influxdb3_sql_async", return_value=[])
    async def test_missing_memory_measurement_returns_empty_payload(self, _query):
        payload = await memory_payload(None)
        self.assertEqual(payload['samples'], [])
        self.assertEqual(payload['hosts'], [])

    @patch("app.host_telemetry.query_influxdb3_sql_async")
    async def test_chronological_samples_hosts_and_bounds(self, query):
        query.return_value = [
            {'time': '2026-10-30T10:01:00Z', 'host': 'b', 'total': 100, 'used': 70},
            {'time': '2026-10-30T10:00:00Z', 'host': 'a', 'total': 100, 'used': 30},
        ]
        payload = await memory_payload(None, 99999, 99999)
        self.assertEqual(payload['hosts'], ['a', 'b'])
        self.assertEqual(payload['samples'][0]['used_percent'], 30)
        self.assertIn("INTERVAL '1440 minutes'", query.call_args.args[0])
        self.assertIn('LIMIT 5000', query.call_args.args[0])
        self.assertEqual(payload['sample_count'], 2)

    @patch("app.host_telemetry.query_influxdb3_sql_async", return_value=[])
    async def test_memory_verification_never_checks_cpu(self, query):
        metric, error = await latest_plugin_metric(None, 'telegraf_mem')
        self.assertIsNone(metric)
        self.assertTrue(error)
        self.assertIn('FROM "telegraf_mem"', query.call_args.args[0])

    @patch("app.host_telemetry.query_influxdb3_sql_async")
    async def test_both_plugins_verify_their_own_recent_metrics(self, query):
        for table in ['telegraf_cpu', 'telegraf_mem']:
            query.return_value = [{'time': '2026-10-30T10:00:00Z', 'host': 'a'}]
            metric, error = await latest_plugin_metric(None, table)
            self.assertEqual(metric['host'], 'a')
            self.assertIsNone(error)
            self.assertIn(f'FROM "{table}"', query.call_args.args[0])
            self.assertIn("INTERVAL '10 minutes'", query.call_args.args[0])

    @patch("app.host_telemetry.query_influxdb3_sql_async", return_value=[])
    async def test_no_recent_samples_do_not_verify(self, _query):
        metric, error = await latest_plugin_metric(None, 'telegraf_mem')
        self.assertIsNone(metric)

    async def test_identifier_allowlist(self):
        with self.assertRaises(ValueError): await latest_plugin_metric(None, 'other_table')

    @patch("app.host_telemetry.query_influxdb3_sql_async")
    async def test_connector_payload_combines_disk_and_diskio(self, query):
        query.side_effect = [
            [{'time': '2026-10-30T10:00:00Z', 'host': 'a', 'used_percent': 65}],
            [{'time': '2026-10-30T10:00:01Z', 'host': 'a', 'reads': 9}],
        ]
        payload = await connector_payload(None, 'telegraf-disk-monitoring', ['telegraf_disk', 'telegraf_diskio'])
        self.assertEqual(payload['measurements'], ['disk', 'diskio'])
        self.assertEqual(payload['sample_count'], 2)
        self.assertNotIn('time', payload['samples'][0]['fields'])
        self.assertNotIn('host', payload['samples'][0]['fields'])

    async def test_connector_table_allowlist(self):
        with self.assertRaises(ValueError):
            await connector_payload(None, 'bad', ['injected_table'])


class BundleTests(unittest.TestCase):
    def test_shared_config_has_one_output_and_both_collectors(self):
        config = tomllib.loads(_telegraf_config())
        self.assertEqual(set(config['inputs']), {'cpu', 'mem'})
        self.assertEqual(len(config['outputs']['influxdb_v3']), 1)
        self.assertEqual(config['inputs']['cpu'][0]['name_override'], 'telegraf_cpu')
        self.assertEqual(config['inputs']['mem'][0]['name_override'], 'telegraf_mem')

    def test_every_connector_config_parses_as_toml(self):
        expected = {
            'disk': {'disk', 'diskio'}, 'network': {'net'}, 'mqtt': {'mqtt_consumer'},
            'modbus': {'modbus'}, 'opcua': {'opcua'},
            'docker': {'docker'}, 'kubernetes': {'kubernetes'}, 'mongodb': {'mongodb'},
            'mysql': {'mysql'}, 'redis': {'redis'}, 'sql': {'sql'}, 'sqlserver': {'sqlserver'},
            'postgresql': {'postgresql'}, 'win-eventlog': {'win_eventlog'},
            'influxdb': {'prometheus'}, 'internal': {'internal'},
            'exec': {'exec'}, 'http': {'http'}, 'http-listener': {'http_listener_v2'},
            'nvidia': {'nvidia_smi'}, 's7': {'s7comm'}, 'syslog': {'syslog'},
            'cisco-telemetry': {'cisco_telemetry_mdt'}, 'system': {'system'},
            'opentelemetry': {'opentelemetry'}, 'nginx': {'nginx'}, 'csv': {'file'}, 'grok': {'tail'},
        }
        replacements = {
            '${MQTT_BROKER}': 'tcp://localhost:1883', '${MQTT_TOPIC}': 'sensors/#', '${MQTT_USERNAME}': '', '${MQTT_PASSWORD}': '', '${MQTT_DATA_FORMAT}': 'json',
            '${MODBUS_DEVICE}': 'meter', '${MODBUS_CONTROLLER}': 'tcp://localhost:502', '${MODBUS_SLAVE_ID}': '1', '${MODBUS_FIELD}': 'value', '${MODBUS_ADDRESS}': '0', '${MODBUS_BYTE_ORDER}': 'AB', '${MODBUS_DATA_TYPE}': 'UINT16', '${MODBUS_SCALE}': '1.0',
            '${OPCUA_ENDPOINT}': 'opc.tcp://localhost:4840', '${OPCUA_SECURITY_POLICY}': 'None', '${OPCUA_SECURITY_MODE}': 'None', '${OPCUA_AUTH_METHOD}': 'Anonymous', '${OPCUA_USERNAME}': '', '${OPCUA_PASSWORD}': '', '${OPCUA_NODE_NAME}': 'state', '${OPCUA_NODE_ID}': 'ns=0;i=2259',
            '${INFLUXDB3_URL}': 'http://localhost:8181', '${INFLUXDB3_AUTH_TOKEN}': 'token', '${INFLUXDB3_DATABASE}': 'iiiot_telemetry',
        }
        for plugin, inputs in expected.items():
            config = _telegraf_config(plugin)
            for source, value in replacements.items(): config = config.replace(source, value)
            parsed = tomllib.loads(config)
            self.assertTrue(inputs.issubset(parsed['inputs']))

    def test_bundles_for_all_plugins_and_target_formats(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for target, extension in [('linux-deb', '.deb'), ('linux-rpm', '.rpm'), ('windows', '.exe')]:
                installer = root / ('telegraf' + extension)
                installer.write_bytes(b'test vendor package')
                plugins = ['cpu']
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
                                    self.assertIn('IIIOT-Veda Setup', script)
                                self.assertEqual(manifest['bundle_revision'], 7)
                            elif target == 'linux-deb':
                                self.assertTrue(result['filename'].endswith('.deb'))
                                listing = subprocess.run(['ar', 't', result['path']], check=True, capture_output=True, text=True).stdout
                                self.assertIn('data.tar.gz', listing)
                            else:
                                self.assertTrue(result['filename'].endswith('.rpm'))
                                listing = subprocess.run(['rpm', '-qpl', result['path']], check=True, capture_output=True, text=True).stdout
                                self.assertIn(f'iiiot-veda-setup-{plugin}', listing)
                            self.assertIn(f'iiiot-veda-{plugin}-', result['filename'])

    def test_invalid_plugin_rejected(self):
        with self.assertRaises(ValueError): build_bundle('linux-rpm', 'x86_64', Path('unused'), Path('unused'), 'unknown')


if __name__ == '__main__': unittest.main()
