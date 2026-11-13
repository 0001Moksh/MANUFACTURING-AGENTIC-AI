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
from app.influx_telemetry import InfluxTelemetryError
from app.host_telemetry import (
    connector_payload,
    docker_daemon_is_idle,
    influx_table_is_missing,
    latest_plugin_metric,
    memory_payload,
    plugin_telemetry_is_connected,
)
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
    async def test_idle_docker_daemon_is_a_healthy_zero_container_state(self):
        checks = [{"name": "docker_daemon", "passed": True, "running_containers": 0}]
        self.assertTrue(docker_daemon_is_idle(checks))

    async def test_active_or_unreachable_docker_daemon_requires_telemetry(self):
        self.assertFalse(docker_daemon_is_idle([
            {"name": "docker_daemon", "passed": True, "running_containers": 1},
        ]))
        self.assertFalse(docker_daemon_is_idle([
            {"name": "docker_daemon", "passed": False, "running_containers": 0},
        ]))

    async def test_idle_docker_connects_only_after_a_successful_influx_query(self):
        checks = [{"name": "docker_daemon", "passed": True, "running_containers": 0}]
        self.assertTrue(plugin_telemetry_is_connected("docker", None, True, checks))
        self.assertFalse(plugin_telemetry_is_connected("docker", None, False, checks))
        self.assertFalse(plugin_telemetry_is_connected("cpu", None, True, checks))

    async def test_missing_influx_table_is_an_empty_measurement_not_a_connection_failure(self):
        self.assertTrue(influx_table_is_missing(
            RuntimeError("error while planning query: table 'iiiot_veda_docker' not found")
        ))
        self.assertTrue(influx_table_is_missing(
            RuntimeError("measurement iiiot_veda_docker does not exist")
        ))
        self.assertFalse(influx_table_is_missing(
            RuntimeError('{"error":"the request was not authenticated"}')
        ))

    @patch("app.host_telemetry.query_influxdb3_sql_async")
    async def test_missing_docker_table_returns_an_empty_metric(self, query):
        query.side_effect = InfluxTelemetryError(
            "InfluxDB 3 query failed: table 'iiiot_veda_docker' not found"
        )
        metric, error = await latest_plugin_metric(None, "iiiot_veda_docker")
        self.assertIsNone(metric)
        self.assertIn("No iiiot_veda_docker measurement exists yet", error)

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

    @patch("app.host_telemetry.query_influxdb3_sql_async")
    async def test_event_log_idle_preserves_last_event(self, query):
        query.side_effect = [[], [{'time': '2026-11-06T04:41:07Z', 'host': 'a'}]]
        metric, message = await latest_plugin_metric(None, 'iiiot_veda_win_eventlog', allow_idle=True)
        self.assertEqual(metric['host'], 'a')
        self.assertIn('idle', message)
        self.assertNotIn('INTERVAL', query.call_args.args[0])

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
            'influxdb': {'prometheus'}, 'internal': {'internal'}, 'github': {'github'},
            'exec': {'exec'}, 'execd': {'execd'}, 'file': {'file'}, 'socket-listener': {'socket_listener'},
            'http': {'http'}, 'http-listener': {'http_listener_v2'},
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

    def test_redis_default_does_not_install_a_fake_password(self):
        config = _connector_config('redis')
        parsed = tomllib.loads(config)
        redis_input = parsed['inputs']['redis'][0]
        self.assertEqual(redis_input['servers'], ['tcp://127.0.0.1:6379'])
        self.assertNotIn('password', redis_input)

    def test_mqtt_broker_outage_does_not_stop_shared_service(self):
        parsed = tomllib.loads(_connector_config('mqtt'))
        mqtt_input = parsed['inputs']['mqtt_consumer'][0]
        self.assertEqual(mqtt_input['startup_error_behavior'], 'retry')
        self.assertEqual(mqtt_input['max_reconnect_interval'], '30s')

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
                                self.assertEqual(manifest['bundle_revision'], 8)
                            elif target == 'linux-deb':
                                self.assertTrue(result['filename'].endswith('.deb'))
                                listing = subprocess.run(['ar', 't', result['path']], check=True, capture_output=True, text=True).stdout
                                self.assertIn('data.tar.gz', listing)
                            else:
                                self.assertTrue(result['filename'].endswith('.rpm'))
                                listing = subprocess.run(['rpm', '-qpl', result['path']], check=True, capture_output=True, text=True).stdout
                                self.assertIn(f'iiiot-veda-setup-{plugin}', listing)
                            self.assertIn(f'iiiot-veda-{plugin}-', result['filename'])

    def test_generic_integration_windows_bundles_have_distinct_inputs_and_measurements(self):
        expected = {
            'github': ('github', 'iiiot_veda_github'),
            'exec': ('exec', 'iiiot_veda_exec'),
            'execd': ('execd', 'iiiot_veda_execd'),
            'file': ('file', 'iiiot_veda_file'),
            'socket-listener': ('socket_listener', 'iiiot_veda_socket_listener'),
        }
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            installer = root / 'iiiot-veda-runtime.zip'
            installer.write_bytes(b'test vendor package')
            for plugin, (input_name, measurement) in expected.items():
                with self.subTest(plugin=plugin):
                    result = build_bundle('windows', 'x86_64', installer, root / 'bundles', plugin)
                    with zipfile.ZipFile(result['path']) as archive:
                        config = tomllib.loads(archive.read('payload/mai-connector.conf').decode())
                        manifest = json.loads(archive.read('payload/manifest.json'))
                    self.assertIn(input_name, config['inputs'])
                    self.assertEqual(manifest['measurement'], measurement)
                    self.assertEqual(manifest['bundle_revision'], 8)

    def test_invalid_plugin_rejected(self):
        with self.assertRaises(ValueError): build_bundle('linux-rpm', 'x86_64', Path('unused'), Path('unused'), 'unknown')


if __name__ == '__main__': unittest.main()
