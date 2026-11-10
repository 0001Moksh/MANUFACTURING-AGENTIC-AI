import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.plugin_config_cleanup import request_config_removal


class PluginConfigCleanupTests(unittest.TestCase):
    def test_removes_only_requested_input_and_queues_service_reload(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            config_dir = root / "config"
            config_dir.mkdir()
            (config_dir / "mai-mongodb.conf").write_text("[[inputs.mongodb]]")
            (config_dir / "mai-output.conf").write_text("[[outputs.influxdb_v3]]")
            pending = root / "pending"
            with patch("app.plugin_config_cleanup.installed_config_dir", return_value=config_dir), patch("app.plugin_config_cleanup.PENDING_DIR", pending):
                self.assertEqual(request_config_removal("mongodb"), "removed")
                self.assertFalse((config_dir / "mai-mongodb.conf").exists())
                self.assertTrue((config_dir / "mai-output.conf").exists())
                self.assertTrue((pending / "mongodb.pending").exists())
                self.assertEqual(request_config_removal("mysql"), "absent")
                self.assertFalse((pending / "mysql.pending").exists())

    def test_rejects_path_traversal(self):
        with self.assertRaises(ValueError):
            request_config_removal("../mai-output")
