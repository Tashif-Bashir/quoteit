"""Seed (or reseed) data/users.json — QuoteIt local login store.

Scope guard: local prototype only. One user per rep in data/reps.json.
Username = a simple slug of the rep's name ("Chris Krammer" -> "chris.krammer").
Password hash only — via werkzeug.security.generate_password_hash. Never
stores plaintext. Starter passwords are printed to stdout ONLY, once, so the
owner can hand them out; re-running this script rotates every password.

Run: `python scripts/seed_users.py`
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

from werkzeug.security import generate_password_hash

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
REPS_FILE = DATA_DIR / "reps.json"
USERS_FILE = DATA_DIR / "users.json"


def slugify(name: str) -> str:
    """"Chris Krammer" -> "chris.krammer"; strips anything that isn't a letter/digit."""
    parts = [re.sub(r"[^a-z0-9]", "", p.lower()) for p in name.split()]
    return ".".join(p for p in parts if p)


def starter_password(slug: str) -> str:
    digits = f"{random.randint(0, 9999):04d}"
    return f"trust-{slug}-{digits}"


def main() -> None:
    reps = json.loads(REPS_FILE.read_text(encoding="utf-8")).get("reps", [])

    users = {}
    table_rows = []
    for rep in reps:
        name = rep["name"]
        slug = slugify(name)
        password = starter_password(slug)
        users[slug] = {
            "password_hash": generate_password_hash(password),
            "rep_name": name,
        }
        table_rows.append((slug, password))

    USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")

    print(f"Wrote {len(users)} users to {USERS_FILE}\n")
    print(f"{'username':<28}{'starter password'}")
    print("-" * 50)
    for slug, password in table_rows:
        print(f"{slug:<28}{password}")


if __name__ == "__main__":
    main()
