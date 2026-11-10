import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.routes import _monitoring_installation_checks


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
