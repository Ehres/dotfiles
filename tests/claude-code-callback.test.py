"""Run with python3 tests/claude-code-callback.test.py (no live agents required)."""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / ".agents/skills/claude-code/scripts/notify.py"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("notify", SCRIPT)
callback = importlib.util.module_from_spec(spec)
spec.loader.exec_module(callback)


class CallbackTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            "OC_CALLBACK_SESSION_ID": "ses_origin",
            "OC_CALLBACK_DIRECTORY": "/project with spaces",
            "REX_BLOCK": "block:claude",
        }
        self.event = {
            "hook_event_name": "Stop", "session_id": "claude-session",
            "last_assistant_message": "Terminé !\n`$(touch /not-executed)`",
        }

    @patch.object(callback.subprocess, "run")
    def test_queues_reply_and_resumes_originating_session(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, '{"data": {}}', "")
        callback.notify(self.event, self.env)
        args, kwargs = run.call_args
        command = args[0]
        self.assertEqual(command[:4], ["opencode", "api", "post", "/api/session/ses_origin/synthetic"])
        payload = json.loads(command[5])
        self.assertTrue(payload["resume"])
        self.assertEqual(payload["delivery"], "queue")
        self.assertIn(self.event["last_assistant_message"], payload["text"])
        self.assertIn("Pane: block:claude", payload["text"])
        self.assertEqual(payload["metadata"]["pane"], "block:claude")
        self.assertEqual(kwargs["cwd"], "/project with spaces")
        self.assertNotIn("shell", kwargs)

    @patch.object(callback.subprocess, "run")
    def test_explicit_server_is_preserved(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, '{"data": {}}', "")
        self.env["OC_CALLBACK_SERVER"] = "http://127.0.0.1:9999"
        callback.notify(self.event, self.env)
        self.assertEqual(run.call_args.args[0][2:4], ["--server", self.env["OC_CALLBACK_SERVER"]])

    @patch.object(callback.subprocess, "run")
    def test_unrelated_or_empty_events_do_not_wake_oc(self, run):
        callback.notify(self.event, {})
        callback.notify(dict(self.event, hook_event_name="SubagentStop"), self.env)
        callback.notify(dict(self.event, last_assistant_message="  "), self.env)
        run.assert_not_called()

    @patch.object(callback.subprocess, "run")
    def test_delivery_errors_are_reported(self, run):
        run.return_value = subprocess.CompletedProcess([], 1, "", "Session not found")
        with self.assertRaisesRegex(RuntimeError, "Session not found"):
            callback.notify(self.event, self.env)
        run.return_value = subprocess.CompletedProcess([], 0, '{"error": "not found"}', "")
        with self.assertRaisesRegex(RuntimeError, "did not confirm"):
            callback.notify(self.event, self.env)

    def test_main_failure_does_not_block_claude_stop(self):
        with patch.dict(callback.os.environ, self.env, clear=True):
            with patch.object(callback.json, "load", side_effect=ValueError("invalid JSON")):
                with patch.object(callback.sys, "stderr"):
                    self.assertEqual(callback.main(), 1)


if __name__ == "__main__":
    unittest.main()
