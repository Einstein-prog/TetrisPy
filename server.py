import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
HIGHSCORE_FILE = ROOT / "highscore.json"
MAX_REQUEST_SIZE = 1024


class TetrisHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path == "/api/highscore":
            try:
                with HIGHSCORE_FILE.open(encoding="utf-8") as score_file:
                    data = json.load(score_file)
                if not isinstance(data, dict):
                    raise ValueError("Highscore-Datei enthält ein ungültiges Format.")
                score = data.get("score")
                if isinstance(score, bool) or not isinstance(score, int) or score < 0:
                    raise ValueError("Highscore-Datei enthält einen ungültigen Wert.")
            except FileNotFoundError:
                score = 0
            except (OSError, json.JSONDecodeError, ValueError) as error:
                self._send_json(500, {"error": str(error)})
                return

            self._send_json(200, {"score": score})
            return

        super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/highscore":
            self._send_json(404, {"error": "Unbekannter Endpunkt."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Ungültige Content-Length."})
            return
        if content_length <= 0 or content_length > MAX_REQUEST_SIZE:
            self._send_json(400, {"error": "Ungültige Anfragegröße."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            self._send_json(400, {"error": str(error)})
            return
        if not isinstance(payload, dict):
            self._send_json(400, {"error": "Die Anfrage muss ein JSON-Objekt sein."})
            return
        requested_score = payload.get("score")
        if (
            isinstance(requested_score, bool)
            or not isinstance(requested_score, int)
            or requested_score < 0
        ):
            self._send_json(400, {"error": "Score muss eine nichtnegative ganze Zahl sein."})
            return

        try:
            try:
                with HIGHSCORE_FILE.open(encoding="utf-8") as score_file:
                    saved_data = json.load(score_file)
                    if not isinstance(saved_data, dict):
                        raise ValueError("Highscore-Datei enthält ein ungültiges Format.")
                    saved_score = saved_data.get("score", 0)
            except FileNotFoundError:
                saved_score = 0

            if isinstance(saved_score, bool) or not isinstance(saved_score, int) or saved_score < 0:
                raise ValueError("Highscore-Datei enthält einen ungültigen Wert.")

            score = max(saved_score, requested_score)
            temporary_file = HIGHSCORE_FILE.with_suffix(".json.tmp")
            temporary_file.write_text(json.dumps({"score": score}, indent=2) + "\n", encoding="utf-8")
            temporary_file.replace(HIGHSCORE_FILE)
        except (OSError, json.JSONDecodeError, ValueError) as error:
            self._send_json(500, {"error": str(error)})
            return

        self._send_json(200, {"score": score})


if __name__ == "__main__":
    address = ("127.0.0.1", 8000)
    print(f"Tetris läuft unter http://{address[0]}:{address[1]}")
    ThreadingHTTPServer(address, TetrisHandler).serve_forever()
