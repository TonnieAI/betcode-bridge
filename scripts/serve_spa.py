from __future__ import annotations

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "dist"
PORT = 5173


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if self.path.startswith("/assets/") or Path(path).exists():
            return super().do_GET()

        # SPA fallback for client-side routes like /login and /reset-password
        self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    if not ROOT.exists():
        raise SystemExit(f"dist directory not found: {ROOT}")

    server = ThreadingHTTPServer(("", PORT), SpaHandler)
    print(f"Serving SPA from {ROOT} at http://localhost:{PORT}")
    server.serve_forever()
