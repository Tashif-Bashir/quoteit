# QuoteIt v1 prototype

Field-rep quoting app for Trust Electric Heating — replaces the paper "Heating
Report". This is a **local prototype only**: no CRM writes, no BigQuery, no
email, no deploy. See `SPEC.md` for the full design spec this was built from.

## Run

```
pip install flask
python app.py
```

Then open http://localhost:5001 — Flask runs with `debug=True` so edits to
`app.py`, `templates/`, or `static/` hot-reload on browser refresh.

## Stack

- Flask serves the page (`templates/index.html`) and one JSON endpoint,
  `/api/catalogue` (rate card, from `catalogue.py`).
- Front end is Preact + htm via ESM, **no build step** — `static/vendor/`
  contains standalone `preact.mjs` / `hooks.mjs` / `htm.mjs`, vendored from
  npm (`package.json` at repo root records the versions; nothing is bundled).
- `static/pricing.js` is a pure-function pricing engine module (no DOM, no
  Preact) — designed to become the tested core of the real app later.
- State (rooms, radiator selections, options) persists to `localStorage` in
  the browser; there is a "Reset quote" link in the top-right corner.

## Today / Appointments tabs (real booking data, read-only)

`scripts/fetch_appointments.py` pulls the last 14 + next 14 days of bookings from
`availability_app`'s `app.bookings` (BigQuery, US region), enriches with
`bronze.sharpspring_leads` (europe-west2 — joined in Python, cross-region SQL is
impossible), and writes `data/appointments.json` + `data/reps.json`. These are
local, gitignored fixtures — **read-only pulls, no CRM/BigQuery writes**.

To reload the fixtures (e.g. after new bookings are made), just re-run the
script with ADC configured:

```
python scripts/fetch_appointments.py
```

Flask serves them at `/api/reps` and `/api/appointments?rep=<name>` — the
appointments endpoint filters server-side to the requested rep only (own-data
rule); it 400s if `rep` is missing.

## Pricing engine acceptance test

`static/pricing.js` reproduces the worked example from `SPEC.md`'s Estimate
mock exactly: 5 radiators (2×N2500 + 1×N1600 living room, 1×N2000 kitchen,
1×NV2500 bedroom), 3 wireless thermostats, 1 app hub, install for 5
radiators, 3 removals, NHS on → **total £7,060.60**, 50% deposit **£3,530.30**.

## Scope note

Prototype only. No build tooling, no tests runner wired in beyond the manual
pricing acceptance check described above. Not for deployment.
