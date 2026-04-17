"""
Minimal local server for the dashboard frontend and SQLite-backed API.
"""

from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from dashboard_data import load_dashboard_data

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


class DashboardHandler(SimpleHTTPRequestHandler):
    """Serve frontend assets and a live dashboard API."""

    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/dashboard":
            payload = load_dashboard_data()
            body = json.dumps(payload).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path in {"/", "/index.html"}:
            self.path = "/index.html"

        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def main():
    server = ThreadingHTTPServer((DEFAULT_HOST, DEFAULT_PORT), DashboardHandler)
    print(f"Dashboard server running at http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down dashboard server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
