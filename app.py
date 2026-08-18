"""QuoteIt v1 prototype — Flask server.

Scope guard: no CRM writes, no BigQuery, no email, no deploy. Local prototype only.
Serves the static Preact/htm front end and the catalogue, appointments and reps
JSON endpoints. Appointments/reps are served from local fixtures written by
`scripts/fetch_appointments.py` (read-only warehouse pulls) — "reload fixtures"
means re-running that script, see README.

Login: server-side sessions (flask.session), cookie signed with a SECRET_KEY
read from the gitignored instance/secret_key file (generated once on first
run). data/users.json holds username -> {password_hash, rep_name}, seeded by
scripts/seed_users.py. /api/appointments serves the session rep only — no rep
parameter, 401 when logged out.
"""

import json
import mimetypes
import secrets
from datetime import timedelta
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request, session
from werkzeug.security import check_password_hash

from catalogue import get_catalogue

DATA_DIR = Path(__file__).resolve().parent / "data"
APPOINTMENTS_FILE = DATA_DIR / "appointments.json"
REPS_FILE = DATA_DIR / "reps.json"
USERS_FILE = DATA_DIR / "users.json"

INSTANCE_DIR = Path(__file__).resolve().parent / "instance"
SECRET_KEY_FILE = INSTANCE_DIR / "secret_key"


def _load_or_create_secret_key() -> str:
    INSTANCE_DIR.mkdir(exist_ok=True)
    if SECRET_KEY_FILE.exists():
        return SECRET_KEY_FILE.read_text(encoding="utf-8").strip()
    key = secrets.token_hex(32)
    SECRET_KEY_FILE.write_text(key, encoding="utf-8")
    return key


# Windows registers .js/.mjs as text/plain in some Python installs; browsers
# refuse ES modules with a non-JS MIME type, which blanks the whole app.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")

app = Flask(__name__)
app.secret_key = _load_or_create_secret_key()
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["SESSION_REFRESH_EACH_REQUEST"] = True


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/catalogue")
def api_catalogue():
    return jsonify(get_catalogue())


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@app.route("/api/reps")
def api_reps():
    return jsonify(_load_json(REPS_FILE).get("reps", []))


@app.route("/api/login", methods=["POST"])
def api_login():
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip().lower()
    password = body.get("password") or ""
    users = _load_json(USERS_FILE)
    user = users.get(username)
    if not user or not check_password_hash(user["password_hash"], password):
        abort(401)
    session.permanent = True
    session["username"] = username
    session["rep_name"] = user["rep_name"]
    return jsonify({"rep_name": user["rep_name"]})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({})


@app.route("/api/me")
def api_me():
    rep_name = session.get("rep_name")
    if not rep_name:
        abort(401)
    return jsonify({"rep_name": rep_name})


@app.route("/api/appointments")
def api_appointments():
    """Appointments for the logged-in rep only — own-data rule, enforced server-side.

    No rep parameter is accepted; the session (set at /api/login) decides who
    the caller is, so no rep can see another rep's list from the response body.
    """
    rep = session.get("rep_name")
    if not rep:
        abort(401)
    data = _load_json(APPOINTMENTS_FILE)
    appointments = [a for a in data.get("appointments", []) if a.get("rep_name") == rep]
    return jsonify(
        {
            "fetched_at": data.get("fetched_at"),
            "date_from": data.get("date_from"),
            "date_to": data.get("date_to"),
            "appointments": appointments,
        }
    )


@app.route("/dev/save-icon", methods=["POST"])
def dev_save_icon():
    """Dev-only asset drop: the logo preview page rasterises the icon in-browser
    and POSTs the result here (the browser can't write files itself). Fixed
    whitelist of filenames, always lands in static/icons/ — nothing else.
    """
    name = request.args.get("name", "")
    allowed = {"icon-192.png", "icon-180.png", "icon-32.png", "icon.svg"}
    if name not in allowed:
        abort(400)
    icons_dir = Path(__file__).resolve().parent / "static" / "icons"
    icons_dir.mkdir(exist_ok=True)
    (icons_dir / name).write_bytes(request.get_data())
    return jsonify({"saved": name, "bytes": len(request.get_data())})


if __name__ == "__main__":
    # host 0.0.0.0 = reachable from phones on the same Wi-Fi (LAN only, behind
    # the router; login required for any data). localhost-only would block that.
    app.run(debug=True, port=5001, host="0.0.0.0")
