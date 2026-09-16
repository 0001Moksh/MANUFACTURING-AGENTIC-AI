import asyncio
import http.server
import threading
from app.integrations_service import test_grafana_connection, _sync_ping_grafana

class MockGrafanaHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        auth = self.headers.get("Authorization", "")
        if self.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"database": "ok", "version": "10.0.0"}')
        elif self.path == "/api/org":
            if "Bearer valid-token" in auth:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"id": 1, "name": "Main Org."}')
            else:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"message": "Unauthorized"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

def run_mock_server():
    server = http.server.HTTPServer(("127.0.0.1", 18888), MockGrafanaHandler)
    server.serve_forever()

async def main():
    t = threading.Thread(target=run_mock_server, daemon=True)
    t.start()
    await asyncio.sleep(0.5)

    print("1. Testing valid Grafana server /api/health...")
    res1 = await test_grafana_connection("http://127.0.0.1:18888", timeout=2.0)
    print("Res1:", res1)
    assert res1["success"] is True
    assert res1["status"] == "CONNECTED"
    assert "latency_ms" in res1
    print("PASS: Valid health check succeeded with latency:", res1["latency_ms"], "ms")

    print("\n2. Testing unreachable host with timeout...")
    res2 = await test_grafana_connection("http://127.0.0.99:9999", timeout=1.0)
    print("Res2:", res2)
    assert res2["success"] is False
    assert res2["status"] == "DISCONNECTED"
    print("PASS: Unreachable host handled gracefully.")

    print("\n3. Testing empty URL...")
    res3 = await test_grafana_connection("", timeout=1.0)
    print("Res3:", res3)
    assert res3["success"] is False
    print("PASS: Empty URL handled gracefully.")

    print("\nALL GRAFANA INTEGRATION TESTS PASSED 100%!")

if __name__ == "__main__":
    asyncio.run(main())
