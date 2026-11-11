import unittest
from types import SimpleNamespace
from unittest.mock import patch, AsyncMock
from datetime import datetime

from app.routes import _monitoring_installation_checks
from app import routes
from app.influx_telemetry import InfluxTelemetryError


class DockerVerificationTests(unittest.IsolatedAsyncioTestCase):
    async def verify(self, query_error=None, count=0):
        plugin_id = "iiiot-veda-docker-monitoring"
        row = SimpleNamespace(id=plugin_id, target_os="windows", last_metric_received=datetime(2026, 11, 10))
        db = SimpleNamespace(get=AsyncMock(return_value=row), commit=AsyncMock(), rollback=AsyncMock())
        checks = [{"name": "service_running", "passed": True},
                  {"name": "docker_daemon", "passed": True, "running_containers": count}]
        with patch.dict(routes.PLUGIN_CATALOG, {plugin_id: {}}, clear=True), \
             patch.object(routes, "_seed_default_plugins"), \
             patch.object(routes, "_sync_plugin_catalog", new_callable=AsyncMock), \
             patch.object(routes, "_monitoring_installation_checks", return_value=checks), \
             patch.object(routes, "_docker_daemon_check", return_value={"name": "docker_endpoint", "passed": True}), \
             patch.object(routes.asyncio, "to_thread", new_callable=AsyncMock, return_value={"name": "docker_endpoint", "passed": True}), \
             patch.object(routes, "_plugin_from_db", return_value={}), \
             patch("app.host_telemetry.query_influxdb3_sql_async", new_callable=AsyncMock) as query:
            # The endpoint requires a non-empty catalog entry.
            routes.PLUGIN_CATALOG[plugin_id] = {"id": plugin_id}
            query.return_value = []
            query.side_effect = query_error
            result = await routes.test_plugin(plugin_id, None, db)
            query.assert_awaited_once()
            return result, row

    async def test_idle_docker_executes_query_and_preserves_timestamp(self):
        result, row = await self.verify()
        self.assertTrue(result["success"])
        self.assertEqual(result["metrics_seen"], 0)
        self.assertEqual(row.last_metric_received, datetime(2026, 11, 10))

    async def test_missing_table_allows_idle_docker(self):
        result, _ = await self.verify(InfluxTelemetryError("table 'iiiot_veda_docker' not found"))
        self.assertTrue(result["success"])

    async def test_auth_failure_is_not_hidden_by_idle_docker(self):
        result, _ = await self.verify(InfluxTelemetryError("the request was not authenticated"))
        self.assertFalse(result["success"])
        self.assertTrue(result["verification_error"])
        self.assertNotIn("is connected", result["checks"][-1]["message"])

    async def test_running_container_requires_recent_telemetry(self):
        result, _ = await self.verify(count=1)
        self.assertFalse(result["success"])


class MonitoringInstallationHealthTests(unittest.TestCase):
    @patch("app.routes.subprocess.run")
    @patch("app.routes.Path.stat")
    @patch("app.routes.Path.is_file")
    @patch("app.routes.shutil.which")
    def test_healthy_linux_installation_passes_all_checks(self, which, is_file, stat, run):
        which.side_effect = lambda command: f"/usr/bin/{command}"
        is_file.return_value = True
        stat.return_value = SimpleNamespace(st_size=100)
        run.return_value = SimpleNamespace(returncode=0, stdout="active\n")

        checks = _monitoring_installation_checks("linux-rpm")

        self.assertTrue(all(check["passed"] for check in checks))
        self.assertEqual([check["name"] for check in checks], ["runtime_installed", "required_files", "service_running"])

    @patch("app.routes.subprocess.run")
    @patch("app.routes.Path.is_file", return_value=False)
    @patch("app.routes.shutil.which", return_value=None)
    def test_uninstalled_runtime_and_missing_files_fail(self, _which, _is_file, run):
        run.return_value = SimpleNamespace(returncode=3, stdout="inactive\n")

        checks = _monitoring_installation_checks("linux-rpm")

        self.assertFalse(any(check["passed"] for check in checks))
        self.assertIn("not installed", checks[0]["message"])
        self.assertIn("mai-monitoring.conf", checks[1]["message"])


if __name__ == "__main__":
    unittest.main()
