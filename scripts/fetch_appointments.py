"""Fetch appointment fixture data for QuoteIt's Today / Appointments tabs.

Read-only pulls from the warehouse. Writes local JSON fixtures consumed by the
Flask app — no CRM writes, no BigQuery writes, no email, no deploy.

Two queries, joined in Python (app.* is US, bronze is europe-west2 — cross-region
SQL is impossible):
  1. app.bookings (US) — active + cancelled bookings, last 14 / next 14 days.
     Also app.reps (US) — the field-rep list.
  2. bronze.sharpspring_leads (europe-west2) — enrichment: all three phone
     fields, email, location, keyed on lead_id.

Run with ADC: `python scripts/fetch_appointments.py`
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from google.cloud import bigquery

PROJECT = "trustwarehouse"
LONDON = ZoneInfo("Europe/London")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
APPOINTMENTS_FILE = DATA_DIR / "appointments.json"
REPS_FILE = DATA_DIR / "reps.json"


def _digits(raw: str | None) -> str | None:
    """Normalise a phone number to digits-only with a 44 prefix (shared/phone.py rule)."""
    if not raw:
        return None
    d = "".join(c for c in raw if c.isdigit())
    if not d:
        return None
    if d.startswith("00"):
        d = d[2:]
    elif d.startswith("0"):
        d = "44" + d[1:]
    return d


def fetch_bookings(client: bigquery.Client, date_from: str, date_to: str) -> list[dict]:
    """Bookings (US region) in [date_from, date_to] inclusive, active + cancelled."""
    sql = f"""
        SELECT event_id, lead_id, booker_username, booker_owner_id, booker_name,
               rep_name, rep_owner_id, customer, postcode, appt_date, appt_start,
               appt_end, appt_type, booked_at, status, is_rebook, entered_by,
               cancelled_at, cancelled_by
        FROM `{PROJECT}.app.bookings`
        WHERE appt_date BETWEEN @date_from AND @date_to
          AND customer NOT LIKE 'Zzz Testlead%'
        ORDER BY appt_date, appt_start
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("date_from", "STRING", date_from),
            bigquery.ScalarQueryParameter("date_to", "STRING", date_to),
        ]
    )
    rows = list(client.query(sql, job_config=job_config).result())
    return [dict(r) for r in rows]


def fetch_reps(client: bigquery.Client) -> list[dict]:
    """Field-rep list (US region)."""
    sql = f"""
        SELECT name, email, regions, fallback, freelancer, sharpspring_owner_id
        FROM `{PROJECT}.app.reps`
        ORDER BY name
    """
    rows = list(client.query(sql).result())
    reps = []
    for r in rows:
        d = dict(r)
        d["regions"] = json.loads(d["regions"] or "[]")
        reps.append(d)
    return reps


def fetch_lead_enrichment(client: bigquery.Client, lead_ids: list[str]) -> dict[str, dict]:
    """Enrichment from bronze.sharpspring_leads (europe-west2), keyed on lead id."""
    if not lead_ids:
        return {}
    sql = """
        SELECT id, phone_number, mobile_phone_number,
               alternative_phone_number_5af46947e2fc1 AS alt_phone_number,
               email_address, location_6349396e4a08d AS location
        FROM `bronze.sharpspring_leads`
        WHERE id IN UNNEST(@ids)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("ids", "STRING", lead_ids)]
    )
    rows = list(client.query(sql, job_config=job_config).result())
    by_id: dict[str, dict] = {}
    for r in rows:
        d = dict(r)
        by_id[d["id"]] = d
    return by_id


def _default(o):
    if isinstance(o, datetime):
        return o.isoformat()
    raise TypeError(f"not serialisable: {o!r}")


def main() -> None:
    today_london = datetime.now(LONDON).date()
    date_from = (today_london - timedelta(days=14)).isoformat()
    date_to = (today_london + timedelta(days=14)).isoformat()

    # app.* is US region.
    us_client = bigquery.Client(project=PROJECT)
    bookings = fetch_bookings(us_client, date_from, date_to)
    reps = fetch_reps(us_client)

    # bronze is europe-west2 — separate client/query, join in Python.
    eu_client = bigquery.Client(project=PROJECT, location="europe-west2")
    lead_ids = sorted({b["lead_id"] for b in bookings if b.get("lead_id")})
    enrichment = fetch_lead_enrichment(eu_client, lead_ids)

    appointments = []
    for b in bookings:
        lead = enrichment.get(b.get("lead_id"), {})
        appointments.append(
            {
                **b,
                "phone_number": _digits(lead.get("phone_number")),
                "mobile_phone_number": _digits(lead.get("mobile_phone_number")),
                "alt_phone_number": _digits(lead.get("alt_phone_number")),
                "email": (lead.get("email_address") or "").strip() or None,
                "location": (lead.get("location") or "").strip() or None,
            }
        )

    DATA_DIR.mkdir(exist_ok=True)
    APPOINTMENTS_FILE.write_text(
        json.dumps(
            {
                "fetched_at": datetime.now(LONDON).isoformat(),
                "date_from": date_from,
                "date_to": date_to,
                "appointments": appointments,
            },
            indent=2,
            default=_default,
        )
    )
    REPS_FILE.write_text(json.dumps({"reps": reps}, indent=2, default=_default))

    print(f"Window: {date_from} .. {date_to} (Europe/London)")
    print(f"Total bookings: {len(appointments)}  (leads enriched: {len(enrichment)}/{len(lead_ids)})")
    counts: dict[str, int] = {}
    for a in appointments:
        counts[a["rep_name"]] = counts.get(a["rep_name"], 0) + 1
    for name in sorted(counts):
        print(f"  {name}: {counts[name]}")
    print(f"Reps: {len(reps)}")
    print(f"Wrote {APPOINTMENTS_FILE}")
    print(f"Wrote {REPS_FILE}")


if __name__ == "__main__":
    main()
